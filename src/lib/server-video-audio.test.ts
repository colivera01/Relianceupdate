import { describe, expect, it } from "vitest";

import {
  assertAudioConformsToScope,
  probeVideoAudioFromBuffer,
  ServiceVideoAudioConformanceError,
} from "./server-video-audio";

function box(type: string, payload: Buffer) {
  const output = Buffer.alloc(8 + payload.length);
  output.writeUInt32BE(output.length, 0);
  output.write(type, 4, 4, "ascii");
  payload.copy(output, 8);
  return output;
}

function mp4WithHandler(handler: "soun" | "vide") {
  const hdlr = Buffer.alloc(12);
  hdlr.write(handler, 8, 4, "ascii");
  return Buffer.concat([
    box("ftyp", Buffer.from("isom0000", "ascii")),
    box("moov", box("trak", box("mdia", box("hdlr", hdlr)))),
  ]);
}

function ebmlElement(id: number[], payload: Buffer) {
  return Buffer.concat([Buffer.from(id), Buffer.from([0x80 | payload.length]), payload]);
}

function webmWithAudioTrack() {
  const track = ebmlElement([0xae], Buffer.concat([
    ebmlElement([0x83], Buffer.from([2])),
    ebmlElement([0x86], Buffer.from("A_OPUS")),
  ]));
  return ebmlElement([0x16, 0x54, 0xae, 0x6b], track);
}

describe("server video audio evidence", () => {
  it("detects MP4 audio and video-only track tables", () => {
    expect(probeVideoAudioFromBuffer(mp4WithHandler("soun"), "video/mp4")).toMatchObject({
      presence: "PRESENT",
      trackCount: 1,
      detectionMethod: "ISO_BMFF_TRACK_TABLE",
    });
    expect(probeVideoAudioFromBuffer(mp4WithHandler("vide"), "video/mp4")).toMatchObject({
      presence: "ABSENT",
      trackCount: 0,
    });
  });

  it("detects WebM audio tracks", () => {
    expect(probeVideoAudioFromBuffer(webmWithAudioTrack(), "video/webm")).toMatchObject({
      presence: "PRESENT",
      trackCount: 1,
      codec: "A_OPUS",
      detectionMethod: "EBML_TRACK_TABLE",
    });
  });

  it("handles MediaRecorder-style unknown-length WebM master containers", () => {
    const videoTrack = ebmlElement([0xae], ebmlElement([0x83], Buffer.from([1])));
    const tracks = ebmlElement([0x16, 0x54, 0xae, 0x6b], videoTrack);
    const segment = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67, 0xff]), tracks]);

    expect(probeVideoAudioFromBuffer(segment, "video/webm")).toMatchObject({
      presence: "ABSENT",
      trackCount: 0,
      detectionMethod: "EBML_TRACK_TABLE",
    });
  });

  it("fails closed for unauthorized, missing, and unverifiable audio", () => {
    expect(() => assertAudioConformsToScope({
      audioExpected: false,
      result: probeVideoAudioFromBuffer(mp4WithHandler("soun"), "video/mp4"),
    })).toThrowError(ServiceVideoAudioConformanceError);
    expect(() => assertAudioConformsToScope({
      audioExpected: true,
      result: probeVideoAudioFromBuffer(mp4WithHandler("vide"), "video/mp4"),
    })).toThrow("approved to include audio");
    expect(() => assertAudioConformsToScope({
      audioExpected: false,
      result: probeVideoAudioFromBuffer(Buffer.from("not-video"), "application/octet-stream"),
    })).toThrow("could not verify");
  });
});
