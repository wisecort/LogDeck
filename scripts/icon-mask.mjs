// Quick Look renders SVGs on an opaque white background. This makes everything outside the Apple-grid
// rounded square (824×824 at 100,100, radius 185, on 1024×1024) transparent, with an anti-aliased edge.
// Usage: node scripts/icon-mask.mjs <in.png> <out.png>
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

const [input, output] = process.argv.slice(2)
const png = readFileSync(input)
let pos = 8
let width = 0
let height = 0
let colorType = 0
const idat = []
while (pos < png.length) {
  const len = png.readUInt32BE(pos)
  const type = png.toString('ascii', pos + 4, pos + 8)
  const chunk = png.subarray(pos + 8, pos + 8 + len)
  if (type === 'IHDR') {
    width = chunk.readUInt32BE(0)
    height = chunk.readUInt32BE(4)
    colorType = chunk[9]
    if (chunk[8] !== 8 || chunk[12] !== 0) throw new Error('only 8-bit non-interlaced PNG')
  } else if (type === 'IDAT') idat.push(chunk)
  pos += 12 + len
}
const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
if (!bpp) throw new Error(`unsupported color type ${colorType}`)
const raw = inflateSync(Buffer.concat(idat))
const stride = width * bpp
const pixels = Buffer.alloc(width * height * 4)
let prev = Buffer.alloc(stride)
for (let y = 0, i = 0; y < height; y++) {
  const filter = raw[i++]
  const line = Buffer.from(raw.subarray(i, i + stride))
  i += stride
  for (let x = 0; x < stride; x++) {
    const a = x >= bpp ? line[x - bpp] : 0
    const b = prev[x]
    const c = x >= bpp ? prev[x - bpp] : 0
    let add = 0
    if (filter === 1) add = a
    else if (filter === 2) add = b
    else if (filter === 3) add = (a + b) >> 1
    else if (filter === 4) {
      const p = a + b - c
      const pa = Math.abs(p - a)
      const pb = Math.abs(p - b)
      const pc = Math.abs(p - c)
      add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
    }
    line[x] = (line[x] + add) & 255
  }
  for (let x = 0; x < width; x++) {
    pixels.set([line[x * bpp], line[x * bpp + 1], line[x * bpp + 2], 255], (y * width + x) * 4)
  }
  prev = line
}

const s = width / 1024
const [x0, y0, x1, y1, r] = [100 * s, 100 * s, 924 * s, 924 * s, 185 * s]
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const px = x + 0.5
    const py = y + 0.5
    const dx = Math.max(x0 + r - px, 0, px - (x1 - r))
    const dy = Math.max(y0 + r - py, 0, py - (y1 - r))
    const dist = Math.hypot(dx, dy) - r // > 0 outside the corner arc
    const outside = px < x0 || px > x1 || py < y0 || py > y1
    const alpha = outside ? 0 : Math.min(1, Math.max(0, 0.5 - dist))
    const o = (y * width + x) * 4
    if (alpha <= 0) pixels.fill(0, o, o + 4)
    else if (alpha < 1) {
      // undo the blend with white done by Quick Look
      for (let k = 0; k < 3; k++) pixels[o + k] = Math.max(0, Math.min(255, Math.round((pixels[o + k] - 255 * (1 - alpha)) / alpha)))
      pixels[o + 3] = Math.round(alpha * 255)
    }
  }
}

const rows = Buffer.alloc((width * 4 + 1) * height)
for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = (buf) => {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, tail])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr.set([8, 6, 0, 0, 0], 8)
writeFileSync(output, Buffer.concat([png.subarray(0, 8), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]))
