export const SERVICE_VIDEO_AUDIO_EVIDENCE_VERSION = 2;

export type VideoAudioPresence = "PRESENT" | "ABSENT" | "UNVERIFIABLE";

export type VideoAudioProbeResult = {
  presence: VideoAudioPresence;
  trackCount: number | null;
  codec: string | null;
  detectionMethod: "ISO_BMFF_TRACK_TABLE" | "EBML_TRACK_TABLE" | "UNSUPPORTED_CONTAINER";
};

const MP4_CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts"]);

export function probeVideoAudioFromBuffer(
  input: Buffer | Uint8Array,
  mimeType?: string | null,
): VideoAudioProbeResult {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("mp4") || mime.includes("quicktime") || looksLikeMp4(buffer)) {
    const tracks = scanMp4Tracks(buffer, 0, buffer.length, 0);
    if (tracks == null) return unverifiable();
    const audio = tracks.filter((track) => track.handler === "soun");
    return {
      presence: audio.length > 0 ? "PRESENT" : "ABSENT",
      trackCount: audio.length,
      codec: audio.map((track) => track.codec).find(Boolean) || null,
      detectionMethod: "ISO_BMFF_TRACK_TABLE",
    };
  }
  if (mime.includes("webm") || mime.includes("matroska") || looksLikeEbml(buffer)) {
    const tracks = scanEbmlTracks(buffer);
    if (tracks == null) return unverifiable();
    const audio = tracks.filter((track) => track.type === 2);
    return {
      presence: audio.length > 0 ? "PRESENT" : "ABSENT",
      trackCount: audio.length,
      codec: audio.map((track) => track.codec).find(Boolean) || null,
      detectionMethod: "EBML_TRACK_TABLE",
    };
  }
  return unverifiable();
}

export function assertAudioConformsToScope(input: {
  audioExpected: boolean;
  result: VideoAudioProbeResult;
}): void {
  if (input.result.presence === "UNVERIFIABLE") {
    throw new ServiceVideoAudioConformanceError(
      "SERVICE_VIDEO_AUDIO_UNVERIFIABLE",
      "Reliance could not verify whether the uploaded video contains audio.",
    );
  }
  if (!input.audioExpected && input.result.presence === "PRESENT") {
    throw new ServiceVideoAudioConformanceError(
      "SERVICE_VIDEO_UNAUTHORIZED_AUDIO",
      "This Service Video was approved as video only, but the uploaded file contains audio.",
    );
  }
  if (input.audioExpected && input.result.presence !== "PRESENT") {
    throw new ServiceVideoAudioConformanceError(
      "SERVICE_VIDEO_REQUIRED_AUDIO_MISSING",
      "This Service Video was approved to include audio, but the uploaded file has no audio track.",
    );
  }
}

export class ServiceVideoAudioConformanceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ServiceVideoAudioConformanceError";
  }
}

function unverifiable(): VideoAudioProbeResult {
  return {
    presence: "UNVERIFIABLE",
    trackCount: null,
    codec: null,
    detectionMethod: "UNSUPPORTED_CONTAINER",
  };
}

function looksLikeMp4(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
}

function looksLikeEbml(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32BE(0) === 0x1a45dfa3;
}

type Mp4Track = { handler: string; codec: string | null };

function scanMp4Tracks(
  buffer: Buffer,
  start: number,
  end: number,
  depth: number,
): Mp4Track[] | null {
  if (depth > 10) return null;
  const tracks: Mp4Track[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    const size32 = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    let boxSize = size32;
    if (size32 === 1) {
      if (offset + 16 > end) return null;
      const large = buffer.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      boxSize = Number(large);
      headerSize = 16;
    } else if (size32 === 0) {
      boxSize = end - offset;
    }
    if (boxSize < headerSize || offset + boxSize > end) return null;
    const contentStart = offset + headerSize;
    const contentEnd = offset + boxSize;
    if (type === "trak") {
      const handler = findMp4Handler(buffer, contentStart, contentEnd, 0);
      if (handler) tracks.push({ handler, codec: findMp4Codec(buffer, contentStart, contentEnd, 0) });
    } else if (MP4_CONTAINERS.has(type)) {
      const nested = scanMp4Tracks(buffer, contentStart, contentEnd, depth + 1);
      if (nested == null) return null;
      tracks.push(...nested);
    }
    offset += boxSize;
  }
  return tracks;
}

function findMp4Handler(buffer: Buffer, start: number, end: number, depth: number): string | null {
  if (depth > 10) return null;
  let offset = start;
  while (offset + 8 <= end) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (size < 8 || offset + size > end) return null;
    if (type === "hdlr" && offset + 20 <= offset + size) {
      return buffer.toString("ascii", offset + 16, offset + 20);
    }
    if (MP4_CONTAINERS.has(type)) {
      const found = findMp4Handler(buffer, offset + 8, offset + size, depth + 1);
      if (found) return found;
    }
    offset += size;
  }
  return null;
}

function findMp4Codec(buffer: Buffer, start: number, end: number, depth: number): string | null {
  if (depth > 10) return null;
  let offset = start;
  while (offset + 8 <= end) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (size < 8 || offset + size > end) return null;
    if (type === "stsd" && offset + 24 <= offset + size) {
      return buffer.toString("ascii", offset + 20, offset + 24);
    }
    if (MP4_CONTAINERS.has(type)) {
      const found = findMp4Codec(buffer, offset + 8, offset + size, depth + 1);
      if (found) return found;
    }
    offset += size;
  }
  return null;
}

type EbmlTrack = { type: number; codec: string | null };
type EbmlElement = { id: number; dataStart: number; dataEnd: number; nextOffset: number };

function scanEbmlTracks(buffer: Buffer): EbmlTrack[] | null {
  return scanEbmlRange(buffer, 0, buffer.length, 0);
}

function scanEbmlRange(buffer: Buffer, start: number, end: number, depth: number): EbmlTrack[] | null {
  if (depth > 12) return null;
  const tracks: EbmlTrack[] = [];
  let offset = start;
  while (offset < end) {
    const element = readEbmlElement(buffer, offset, end);
    if (!element) return null;
    if (element.id === 0xae) {
      const track = readEbmlTrackEntry(buffer, element.dataStart, element.dataEnd);
      if (track) tracks.push(track);
    } else if ([0x1a45dfa3, 0x18538067, 0x1654ae6b].includes(element.id)) {
      const nested = scanEbmlRange(buffer, element.dataStart, element.dataEnd, depth + 1);
      if (nested == null) return null;
      tracks.push(...nested);
    }
    offset = element.nextOffset;
  }
  return tracks;
}

function readEbmlTrackEntry(buffer: Buffer, start: number, end: number): EbmlTrack | null {
  let type: number | null = null;
  let codec: string | null = null;
  let offset = start;
  while (offset < end) {
    const element = readEbmlElement(buffer, offset, end);
    if (!element) return null;
    if (element.id === 0x83) type = readUnsigned(buffer, element.dataStart, element.dataEnd);
    if (element.id === 0x86) codec = buffer.toString("utf8", element.dataStart, element.dataEnd);
    offset = element.nextOffset;
  }
  return type == null ? null : { type, codec };
}

function readEbmlElement(buffer: Buffer, offset: number, end: number): EbmlElement | null {
  const id = readEbmlVint(buffer, offset, end, false);
  if (!id) return null;
  const size = readEbmlVint(buffer, id.nextOffset, end, true);
  if (!size) return null;
  const dataEnd = size.value === Infinity ? end : size.nextOffset + size.value;
  if (dataEnd > end) return null;
  return { id: id.value, dataStart: size.nextOffset, dataEnd, nextOffset: dataEnd };
}

function readEbmlVint(
  buffer: Buffer,
  offset: number,
  end: number,
  stripMarker: boolean,
): { value: number | typeof Infinity; nextOffset: number } | null {
  if (offset >= end) return null;
  const first = buffer[offset];
  let length = 0;
  for (let index = 1; index <= 8; index += 1) {
    if (first & (1 << (8 - index))) { length = index; break; }
  }
  if (!length || offset + length > end) return null;
  const marker = 1 << (8 - length);
  let value = stripMarker ? first & (marker - 1) : first;
  let unknown = stripMarker && value === marker - 1;
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + buffer[offset + index];
    unknown = unknown && buffer[offset + index] === 0xff;
  }
  return { value: unknown ? Infinity : value, nextOffset: offset + length };
}

function readUnsigned(buffer: Buffer, start: number, end: number): number {
  let value = 0;
  for (let offset = start; offset < end; offset += 1) value = value * 256 + buffer[offset];
  return value;
}
