const decoder = new TextDecoder();

function join(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function stripJpegMetadata(input: Uint8Array) {
  const parts = [input.slice(0, 2)];
  let offset = 2;
  let hasEnd = false;
  while (offset < input.length) {
    const start = offset;
    if (input[offset] !== 0xff) throw new Error("Invalid JPEG marker.");
    while (input[offset] === 0xff) offset++;
    const marker = input[offset++];
    if (marker === undefined) throw new Error("Incomplete JPEG marker.");
    if (marker === 0xd9) { parts.push(input.slice(start, offset)); hasEnd = true; break; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { parts.push(input.slice(start, offset)); continue; }
    if (offset + 2 > input.length) throw new Error("Incomplete JPEG segment.");
    const length = (input[offset]! << 8) | input[offset + 1]!;
    const end = offset + length;
    if (length < 2 || end > input.length) throw new Error("Invalid JPEG segment length.");
    if (!(marker === 0xe1 || marker === 0xec || marker === 0xed || marker === 0xfe)) parts.push(input.slice(start, end));
    offset = end;
    if (marker === 0xda) {
      const scanStart = offset;
      while (offset < input.length) {
        if (input[offset] !== 0xff) { offset++; continue; }
        const next = input[offset + 1];
        if (next === undefined) throw new Error("Incomplete JPEG scan.");
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { offset += 2; continue; }
        if (next === 0xff) { offset++; continue; }
        break;
      }
      parts.push(input.slice(scanStart, offset));
    }
  }
  if (!hasEnd) throw new Error("Incomplete JPEG image.");
  return join(parts);
}

function readUint32BE(input: Uint8Array, offset: number) {
  return new DataView(input.buffer, input.byteOffset, input.byteLength).getUint32(offset, false);
}

function stripPngMetadata(input: Uint8Array) {
  const parts = [input.slice(0, 8)];
  let offset = 8;
  let hasEnd = false;
  while (offset + 12 <= input.length) {
    const length = readUint32BE(input, offset);
    const end = offset + 12 + length;
    if (end > input.length) throw new Error("Invalid PNG chunk length.");
    const type = decoder.decode(input.slice(offset + 4, offset + 8));
    if (!["eXIf", "tEXt", "iTXt", "zTXt"].includes(type)) parts.push(input.slice(offset, end));
    offset = end;
    if (type === "IEND") { hasEnd = true; break; }
  }
  if (!hasEnd) throw new Error("Invalid PNG image.");
  return join(parts);
}

function stripWebpMetadata(input: Uint8Array) {
  if (input.length < 12 || decoder.decode(input.slice(0, 4)) !== "RIFF" || decoder.decode(input.slice(8, 12)) !== "WEBP") throw new Error("Invalid WebP image.");
  const parts: Uint8Array[] = [];
  let offset = 12;
  let hasImageData = false;
  while (offset + 8 <= input.length) {
    const size = new DataView(input.buffer, input.byteOffset, input.byteLength).getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (end > input.length) throw new Error("Invalid WebP chunk length.");
    const type = decoder.decode(input.slice(offset, offset + 4));
    if (type === "VP8X") {
      const chunk = input.slice(offset, end);
      if (size < 10) throw new Error("Invalid WebP extended header.");
      chunk[8] = chunk[8]! & ~0x0c;
      parts.push(chunk);
    } else if (type !== "EXIF" && type !== "XMP ") {
      if (type === "VP8 " || type === "VP8L") hasImageData = true;
      parts.push(input.slice(offset, end));
    }
    offset = end;
  }
  if (offset !== input.length || !hasImageData) throw new Error("Invalid WebP image.");
  const body = join(parts);
  const header = input.slice(0, 12);
  new DataView(header.buffer, header.byteOffset, header.byteLength).setUint32(4, 4 + body.length, true);
  return join([header, body]);
}

/** Removes common location-bearing metadata while preserving the original image encoding. */
export function stripImageMetadata(input: Uint8Array, mime: "image/jpeg" | "image/png" | "image/webp") {
  if (mime === "image/jpeg") return stripJpegMetadata(input);
  if (mime === "image/png") return stripPngMetadata(input);
  return stripWebpMetadata(input);
}
