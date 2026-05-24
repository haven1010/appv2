/**
 * Generate tab bar icons for WeChat mini program
 * Creates simple circle icons with letters
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const OUT = path.resolve(__dirname, 'images/tabbar');

// ── PNG Generator ──
function crc32(buf) {
  let c = 0xffffffff;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = (v & 1) ? (0xedb88320 ^ (v >>> 1)) : (v >>> 1);
    table[n] = v;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function createPNG(width, height, pixels) {
  // pixels: raw RGBA buffer (width * height * 4)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Add filter byte (0 = None) before each row
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 4);
    raw[offset] = 0; // filter none
    pixels.copy(raw, offset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw);
  const idat = chunk('IDAT', compressed);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    idat,
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon Drawer ──
function makeCircleIcon(size, letter, fgColor, bgColor) {
  const pixels = Buffer.alloc(size * size * 4, 0);

  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const rr = r * r;

  // Parse colors
  const fg = {
    r: parseInt(fgColor.slice(1,3), 16),
    g: parseInt(fgColor.slice(3,5), 16),
    b: parseInt(fgColor.slice(5,7), 16),
  };
  const bg = {
    r: parseInt(bgColor.slice(1,3), 16),
    g: parseInt(bgColor.slice(3,5), 16),
    b: parseInt(bgColor.slice(5,7), 16),
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = dx * dx + dy * dy;
      const idx = (y * size + x) * 4;

      let alpha = 0;
      let cr = 0, cg = 0, cb = 0;

      if (dist <= rr) {
        // Inside circle - fill with bg color
        const edge = 1 - Math.min((Math.sqrt(dist) - r * 0.85) / (r * 0.15), 1);
        alpha = Math.round(edge * 255);
        cr = bg.r; cg = bg.g; cb = bg.b;
      }

      pixels[idx] = cr;
      pixels[idx+1] = cg;
      pixels[idx+2] = cb;
      pixels[idx+3] = alpha;
    }
  }

  // Draw letter using simplified pixel patterns
  drawLetter(pixels, size, letter, fg);

  return pixels;
}

function drawLetter(pixels, size, letter, fg) {
  // Simple bitmap fonts 5x7 grid, scaled to size
  const fonts = {
    '首': [
      [0,1,1,1,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,1,0,1,0],
      [0,1,0,1,0],
      [1,1,1,1,1],
      [0,1,0,1,0],
    ],
    '签': [
      [1,1,1,1,1],
      [0,1,0,1,0],
      [1,1,1,1,1],
      [0,0,1,0,0],
      [1,1,1,1,1],
      [1,0,1,0,1],
      [0,0,1,0,0],
    ],
    '玉': [
      [1,0,1,0,1],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,1,1,1,0],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,1,1,1,0],
    ],
    '我': [
      [0,1,1,1,0],
      [1,0,1,0,0],
      [0,1,1,1,0],
      [1,1,1,1,1],
      [0,0,1,0,0],
      [1,1,1,1,1],
      [1,0,1,0,0],
    ],
  };

  const font = fonts[letter];
  if (!font) return;

  const fh = font.length, fw = font[0].length;
  const cellW = size / (fw + 2);
  const cellH = size / (fh + 2);
  const cellSize = Math.min(cellW, cellH);
  const startX = (size - fw * cellSize) / 2;
  const startY = (size - fh * cellSize) / 2;

  for (let row = 0; row < fh; row++) {
    for (let col = 0; col < fw; col++) {
      if (!font[row][col]) continue;
      const px = Math.round(startX + col * cellSize);
      const py = Math.round(startY + row * cellSize);
      for (let dy = 0; dy < Math.ceil(cellSize); dy++) {
        for (let dx = 0; dx < Math.ceil(cellSize); dx++) {
          const x = px + dx, y = py + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            const idx = (y * size + x) * 4;
            pixels[idx] = fg.r;
            pixels[idx+1] = fg.g;
            pixels[idx+2] = fg.b;
            pixels[idx+3] = 255;
          }
        }
      }
    }
  }
}

// ── Generate Icons ──
function makeIcon(letter, isActive) {
  const size = 60;
  const fgColor = '#667eea';
  const bgActive = '#667eea';
  const bgInactive = '#e0dce6';

  const bg = isActive ? bgActive : 'transparent';

  // For active: filled circle with white text
  // For inactive: no circle, gray text
  const pixels = Buffer.alloc(size * size * 4, 0);

  const cx = size / 2, cy = size / 2, r = size * 0.42;

  const textColor = isActive ? { r: 255, g: 255, b: 255 } : { r: 180, g: 180, b: 190 };
  const bgColor = isActive ? { r: 102, g: 126, b: 234 } : null;

  if (isActive && bgColor) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;

        if (dist <= r) {
          const edge = Math.max(0, Math.min(1, (r - dist) / 2));
          const alpha = Math.round(edge * 255);
          pixels[idx] = bgColor.r;
          pixels[idx+1] = bgColor.g;
          pixels[idx+2] = bgColor.b;
          pixels[idx+3] = alpha;
        }
      }
    }
  }

  // Draw simple letter as pixels
  const letterMap = {
    '首': [[1,4],[2,4],[3,4],[0,3],[1,3],[2,3],[3,3],[4,3],[2,5],[2,6]],
    '签': [[1,1],[2,1],[3,1],[0,3],[1,3],[2,3],[3,3],[4,3],[2,4],[2,5],[1,6],[2,6],[3,6]],
    '玉': [[1,1],[3,1],[2,2],[1,3],[2,3],[3,3],[2,4],[1,5],[2,5],[3,5],[2,6]],
    '我': [[0,1],[2,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2],[2,3],[0,4],[2,4],[4,4],[0,5],[1,5],[2,5],[3,5],[4,5],[2,6]],
  };

  const dots = letterMap[letter];
  if (dots) {
    const scale = size / 7;
    for (const [col, row] of dots) {
      const px = Math.round(col * scale + scale * 0.5);
      const py = Math.round(row * scale + scale * 0.5);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx, y = py + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            const idx = (y * size + x) * 4;
            pixels[idx] = textColor.r;
            pixels[idx+1] = textColor.g;
            pixels[idx+2] = textColor.b;
            pixels[idx+3] = 255;
          }
        }
      }
    }
  }

  return pixels;
}

// Generate all icons
const items = [
  { name: 'home', letter: '首', label: '首页' },
  { name: 'qrcode', letter: '签', label: '签到' },
  { name: 'chat', letter: '玉', label: '小玉' },
  { name: 'profile', letter: '我', label: '我的' },
];

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

for (const item of items) {
  const inactivePixels = makeIcon(item.letter, false);
  const activePixels = makeIcon(item.letter, true);

  const inactivePNG = createPNG(60, 60, inactivePixels);
  const activePNG = createPNG(60, 60, activePixels);

  fs.writeFileSync(path.join(OUT, `${item.name}.png`), inactivePNG);
  fs.writeFileSync(path.join(OUT, `${item.name}-active.png`), activePNG);

  console.log(`✓ ${item.label}: ${item.name}.png + ${item.name}-active.png`);
}

console.log('\nAll icons generated!');
