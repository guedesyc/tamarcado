import test from "node:test";
import assert from "node:assert/strict";
import { stripImageMetadata } from "../src/lib/image-metadata.ts";

const ascii = value => new TextEncoder().encode(value);
const join = (...parts) => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
};

test("removes JPEG application metadata but preserves image scan data", () => {
  const exif = new Uint8Array([0xff, 0xe1, 0, 8, 69, 120, 105, 102, 0, 0]);
  const scan = new Uint8Array([0xff, 0xda, 0, 2, 0x11, 0x22, 0xff, 0xd9]);
  const result = stripImageMetadata(join(new Uint8Array([0xff, 0xd8]), exif, scan), "image/jpeg");
  assert.deepEqual([...result], [...new Uint8Array([0xff, 0xd8]), ...scan]);
});

test("removes PNG EXIF and text chunks while retaining image chunks", () => {
  const chunk = (type, data = new Uint8Array()) => {
    const result = new Uint8Array(12 + data.length);
    new DataView(result.buffer).setUint32(0, data.length, false);
    result.set(ascii(type), 4); result.set(data, 8);
    return result;
  };
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const result = stripImageMetadata(join(signature, chunk("IHDR", new Uint8Array(13)), chunk("eXIf", ascii("location")), chunk("iTXt", ascii("private text")), chunk("IDAT", new Uint8Array([1])), chunk("IEND")), "image/png");
  const text = new TextDecoder().decode(result);
  assert.match(text, /IDAT/);
  assert.doesNotMatch(text, /eXIf|iTXt|location|private text/);
});

test("removes WebP EXIF/XMP chunks and clears metadata feature flags", () => {
  const chunk = (type, data) => {
    const header = new Uint8Array(8);
    header.set(ascii(type)); new DataView(header.buffer).setUint32(4, data.length, true);
    return data.length % 2 ? join(header, data, new Uint8Array([0])) : join(header, data);
  };
  const vp8xData = new Uint8Array(10); vp8xData[0] = 0x0c;
  const body = join(chunk("VP8X", vp8xData), chunk("EXIF", ascii("GPS")), chunk("XMP ", ascii("private")), chunk("VP8 ", new Uint8Array([1, 2])));
  const header = new Uint8Array(12); header.set(ascii("RIFF")); header.set(ascii("WEBP"), 8);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  const result = stripImageMetadata(join(header, body), "image/webp");
  const text = new TextDecoder().decode(result);
  assert.match(text, /VP8X/); assert.match(text, /VP8 /);
  assert.doesNotMatch(text, /EXIF|XMP |GPS|private/);
  assert.equal(result[20] & 0x0c, 0);
  assert.equal(new DataView(result.buffer).getUint32(4, true), result.length - 8);
});
