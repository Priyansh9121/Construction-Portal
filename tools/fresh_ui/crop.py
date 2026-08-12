"""
Crop a region out of a PNG, with no image library.

Reviewing this world means looking closely at one object inside a 1440-wide
frame -- a cabin is 300 px of it. Neither PIL nor numpy is installed, and
adding a dependency to look at a rectangle is not worth it, so this decodes
and re-encodes PNG directly using only the standard library.

Usage:
    python3 tools/fresh_ui/crop.py in.png out.png X Y W H
"""

import struct
import sys
import zlib


def read_png(path):
    data = open(path, "rb").read()
    pos, idat, ctype = 8, b"", 6
    width = height = 0
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        if kind == b"IHDR":
            width, height, _, ctype = struct.unpack(">IIBB", data[pos + 8:pos + 18])
        elif kind == b"IDAT":
            idat += data[pos + 8:pos + 8 + length]
        pos += 12 + length

    channels = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = width * channels
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(height):
        filt = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        # Undo the per-scanline filter. This is the whole PNG spec that
        # matters here; everything else is containers.
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if filt == 1:
                line[x] = (line[x] + a) & 255
            elif filt == 2:
                line[x] = (line[x] + b) & 255
            elif filt == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pred = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pred) & 255
        rows.append(bytes(line))
        prev = line
    return width, height, channels, rows


def write_png(path, width, height, channels, rows):
    def chunk(kind, payload):
        return (struct.pack(">I", len(payload)) + kind + payload
                + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF))

    body = b"".join(b"\x00" + r for r in rows)
    header = struct.pack(">IIBBBBB", width, height, 8,
                         6 if channels == 4 else 2, 0, 0, 0)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n"
                           + chunk(b"IHDR", header)
                           + chunk(b"IDAT", zlib.compress(body, 6))
                           + chunk(b"IEND", b""))


def main():
    src, dst, x, y, w, h = (sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7]))
    width, height, channels, rows = read_png(src)
    x, y = max(0, x), max(0, y)
    w, h = min(w, width - x), min(h, height - y)
    out = [rows[yy][x * channels:(x + w) * channels] for yy in range(y, y + h)]
    write_png(dst, w, h, channels, out)
    print(f"{src} -> {dst}  {w}x{h} at {x},{y}")


main()
