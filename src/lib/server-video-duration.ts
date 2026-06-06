export class ServerVideoDurationProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerVideoDurationProbeError";
  }
}

const MP4_CONTAINER_BOXES = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
]);

export function probeVideoDurationSecondsFromBuffer(
  input: Buffer | Uint8Array,
  mimeType?: string | null
): number {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const normalizedMimeType = String(mimeType || "").toLowerCase();

  const mp4Duration =
    normalizedMimeType.includes("mp4") ||
    normalizedMimeType.includes("quicktime") ||
    looksLikeMp4(buffer)
      ? probeMp4DurationSeconds(buffer)
      : null;
  if (mp4Duration != null) return mp4Duration;

  const webmDuration =
    normalizedMimeType.includes("webm") ||
    normalizedMimeType.includes("matroska") ||
    looksLikeEbml(buffer)
      ? probeWebmDurationSeconds(buffer)
      : null;
  if (webmDuration != null) return webmDuration;

  throw new ServerVideoDurationProbeError(
    "Could not read video duration from uploaded media."
  );
}

function looksLikeMp4(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
}

function looksLikeEbml(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32BE(0) === 0x1a45dfa3;
}

function probeMp4DurationSeconds(buffer: Buffer): number | null {
  return findMp4DurationInRange(buffer, 0, buffer.length, 0);
}

function findMp4DurationInRange(
  buffer: Buffer,
  start: number,
  end: number,
  depth: number
): number | null {
  if (depth > 8) return null;

  let offset = start;
  while (offset + 8 <= end) {
    const size32 = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    let boxSize = size32;

    if (size32 === 1) {
      if (offset + 16 > end) return null;
      const largeSize = buffer.readBigUInt64BE(offset + 8);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      boxSize = Number(largeSize);
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = end - offset;
    }

    if (boxSize < headerSize || offset + boxSize > end) return null;

    const contentStart = offset + headerSize;
    const contentEnd = offset + boxSize;

    if (type === "mvhd") {
      const duration = readMp4MovieHeaderDuration(buffer, contentStart, contentEnd);
      if (duration != null) return duration;
    }

    if (MP4_CONTAINER_BOXES.has(type)) {
      const nestedDuration = findMp4DurationInRange(
        buffer,
        contentStart,
        contentEnd,
        depth + 1
      );
      if (nestedDuration != null) return nestedDuration;
    }

    offset += boxSize;
  }

  return null;
}

function readMp4MovieHeaderDuration(
  buffer: Buffer,
  start: number,
  end: number
): number | null {
  if (start + 20 > end) return null;

  const version = buffer.readUInt8(start);
  if (version === 1) {
    if (start + 32 > end) return null;
    const timescale = buffer.readUInt32BE(start + 20);
    const rawDuration = buffer.readBigUInt64BE(start + 24);
    if (!timescale || rawDuration > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return positiveFiniteDuration(Number(rawDuration) / timescale);
  }

  const timescale = buffer.readUInt32BE(start + 12);
  const rawDuration = buffer.readUInt32BE(start + 16);
  if (!timescale) return null;
  return positiveFiniteDuration(rawDuration / timescale);
}

function probeWebmDurationSeconds(buffer: Buffer): number | null {
  return findWebmDurationInRange(buffer, 0, buffer.length, 0);
}

type EbmlElement = {
  id: number;
  dataStart: number;
  dataEnd: number;
  nextOffset: number;
};

function findWebmDurationInRange(
  buffer: Buffer,
  start: number,
  end: number,
  depth: number
): number | null {
  if (depth > 8) return null;

  let offset = start;
  while (offset < end) {
    const element = readEbmlElement(buffer, offset, end);
    if (!element) return null;

    if (element.id === 0x1549a966) {
      const infoDuration = readWebmInfoDuration(
        buffer,
        element.dataStart,
        element.dataEnd
      );
      if (infoDuration != null) return infoDuration;
    }

    if (element.id === 0x18538067 || element.id === 0x1a45dfa3) {
      const nestedDuration = findWebmDurationInRange(
        buffer,
        element.dataStart,
        element.dataEnd,
        depth + 1
      );
      if (nestedDuration != null) return nestedDuration;
    }

    offset = element.nextOffset;
  }

  return null;
}

function readWebmInfoDuration(
  buffer: Buffer,
  start: number,
  end: number
): number | null {
  let offset = start;
  let timestampScale = 1_000_000;
  let duration: number | null = null;

  while (offset < end) {
    const element = readEbmlElement(buffer, offset, end);
    if (!element) return null;

    if (element.id === 0x2ad7b1) {
      const scale = readUnsignedInteger(buffer, element.dataStart, element.dataEnd);
      if (scale > 0) timestampScale = scale;
    } else if (element.id === 0x4489) {
      duration = readEbmlFloat(buffer, element.dataStart, element.dataEnd);
    }

    offset = element.nextOffset;
  }

  if (duration == null) return null;
  return positiveFiniteDuration((duration * timestampScale) / 1_000_000_000);
}

function readEbmlElement(
  buffer: Buffer,
  offset: number,
  end: number
): EbmlElement | null {
  const id = readEbmlId(buffer, offset, end);
  if (!id) return null;

  const size = readEbmlSize(buffer, id.nextOffset, end);
  if (!size) return null;

  const dataStart = size.nextOffset;
  const dataEnd = size.value === Infinity ? end : dataStart + size.value;
  if (dataEnd > end) return null;

  return {
    id: id.value,
    dataStart,
    dataEnd,
    nextOffset: dataEnd,
  };
}

function readEbmlId(
  buffer: Buffer,
  offset: number,
  end: number
): { value: number; nextOffset: number } | null {
  if (offset >= end) return null;
  const first = buffer[offset];
  const length = ebmlVintLength(first);
  if (!length || offset + length > end) return null;

  let value = 0;
  for (let i = 0; i < length; i += 1) {
    value = value * 256 + buffer[offset + i];
  }

  return { value, nextOffset: offset + length };
}

function readEbmlSize(
  buffer: Buffer,
  offset: number,
  end: number
): { value: number | typeof Infinity; nextOffset: number } | null {
  if (offset >= end) return null;
  const first = buffer[offset];
  const length = ebmlVintLength(first);
  if (!length || offset + length > end) return null;

  const markerMask = 1 << (8 - length);
  let value = first & (markerMask - 1);
  let allValueBitsSet = value === markerMask - 1;

  for (let i = 1; i < length; i += 1) {
    value = value * 256 + buffer[offset + i];
    allValueBitsSet = allValueBitsSet && buffer[offset + i] === 0xff;
  }

  return {
    value: allValueBitsSet ? Infinity : value,
    nextOffset: offset + length,
  };
}

function ebmlVintLength(firstByte: number): number | null {
  for (let length = 1; length <= 8; length += 1) {
    if (firstByte & (1 << (8 - length))) return length;
  }
  return null;
}

function readUnsignedInteger(buffer: Buffer, start: number, end: number): number {
  let value = 0;
  for (let offset = start; offset < end; offset += 1) {
    value = value * 256 + buffer[offset];
  }
  return value;
}

function readEbmlFloat(buffer: Buffer, start: number, end: number): number | null {
  const length = end - start;
  if (length === 4) return buffer.readFloatBE(start);
  if (length === 8) return buffer.readDoubleBE(start);
  return null;
}

function positiveFiniteDuration(seconds: number): number | null {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
