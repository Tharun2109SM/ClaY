export type ImageDimensions = {
  width: number | null;
  height: number | null;
};

function readUint16(buffer: Buffer, offset: number, littleEndian = false) {
  return littleEndian
    ? buffer.readUInt16LE(offset)
    : buffer.readUInt16BE(offset);
}

function readUint32(buffer: Buffer, offset: number, littleEndian = false) {
  return littleEndian
    ? buffer.readUInt32LE(offset)
    : buffer.readUInt32BE(offset);
}

export function getImageDimensions(buffer: Buffer): ImageDimensions {
  if (buffer.length < 24) {
    return { width: null, height: null };
  }

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  if (isPng) {
    return {
      width: readUint32(buffer, 16),
      height: readUint32(buffer, 20),
    };
  }

  const isGif =
    buffer.toString("ascii", 0, 3) === "GIF" && buffer.length >= 10;

  if (isGif) {
    return {
      width: readUint16(buffer, 6, true),
      height: readUint16(buffer, 8, true),
    };
  }

  const isWebp =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";

  if (isWebp) {
    const format = buffer.toString("ascii", 12, 16);

    if (format === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }

    if (format === "VP8 " && buffer.length >= 30) {
      return {
        width: readUint16(buffer, 26, true) & 0x3fff,
        height: readUint16(buffer, 28, true) & 0x3fff,
      };
    }

    if (format === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);

      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;

  if (isJpeg) {
    let offset = 2;

    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const length = readUint16(buffer, offset + 2);

      if (length < 2) {
        break;
      }

      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        if (offset + 9 >= buffer.length) {
          break;
        }

        return {
          height: readUint16(buffer, offset + 5),
          width: readUint16(buffer, offset + 7),
        };
      }

      offset += 2 + length;
    }
  }

  return { width: null, height: null };
}
