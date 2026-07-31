import { describe, expect, it } from "vitest";
import { probeVideoDurationSecondsFromBuffer } from "./server-video-duration";

function ebmlElement(id: number[], data: Buffer): Buffer {
  if (data.length >= 127) throw new Error("Test element is too large.");
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | data.length]), data]);
}

function unknownSizeElement(id: number[], data: Buffer): Buffer {
  return Buffer.concat([Buffer.from(id), Buffer.from([0xff]), data]);
}

function unsignedInteger(value: number): Buffer {
  if (value <= 0xff) return Buffer.from([value]);
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16BE(value);
  return bytes;
}

function simpleBlock(relativeTimestamp: number): Buffer {
  const data = Buffer.alloc(5);
  data[0] = 0x81;
  data.writeInt16BE(relativeTimestamp, 1);
  data[3] = 0x80;
  return ebmlElement([0xa3], data);
}

function mediaRecorderWebm(
  clusterTimestamp: number,
  relativeTimestamp: number
): Buffer {
  const ebmlHeader = ebmlElement([0x1a, 0x45, 0xdf, 0xa3], Buffer.alloc(0));
  const timestampScale = ebmlElement(
    [0x2a, 0xd7, 0xb1],
    Buffer.from([0x0f, 0x42, 0x40])
  );
  const info = ebmlElement([0x15, 0x49, 0xa9, 0x66], timestampScale);
  const cluster = unknownSizeElement(
    [0x1f, 0x43, 0xb6, 0x75],
    Buffer.concat([
      ebmlElement([0xe7], unsignedInteger(clusterTimestamp)),
      simpleBlock(relativeTimestamp),
    ])
  );
  const segment = unknownSizeElement(
    [0x18, 0x53, 0x80, 0x67],
    Buffer.concat([info, cluster])
  );
  return Buffer.concat([ebmlHeader, segment]);
}

describe("probeVideoDurationSecondsFromBuffer", () => {
  it("derives duration from MediaRecorder WebM block timestamps when Info.Duration is absent", () => {
    const duration = probeVideoDurationSecondsFromBuffer(
      mediaRecorderWebm(8_000, 512),
      "video/webm;codecs=vp9"
    );

    expect(duration).toBeCloseTo(8.512, 3);
  });

  it("still exposes an over-limit WebM duration without Info.Duration", () => {
    const duration = probeVideoDurationSecondsFromBuffer(
      mediaRecorderWebm(30_000, 900),
      "video/webm;codecs=vp9"
    );

    expect(duration).toBeCloseTo(30.9, 3);
  });
});
