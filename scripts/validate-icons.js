import fs from 'fs';
import path from 'path';

function inspectIco(filePath) {
  const buf = fs.readFileSync(filePath);
  const reserved = buf.readUInt16LE(0);
  const type = buf.readUInt16LE(2); // 1 = ICO, 2 = CUR
  const count = buf.readUInt16LE(4);

  const images = [];
  for (let i = 0; i < count; i++) {
    const offset = 6 + i * 16;
    const width = buf.readUInt8(offset) || 256;
    const height = buf.readUInt8(offset + 1) || 256;
    const bpp = buf.readUInt16LE(offset + 6);
    const size = buf.readUInt32LE(offset + 8);
    images.push({ width, height, bpp, size });
  }

  return {
    valid: reserved === 0 && type === 1,
    format: 'Windows Icon Resource (ICO)',
    imageCount: count,
    resolutions: images.map(img => `${img.width}x${img.height} (${img.bpp}bpp)`).join(', ')
  };
}

function inspectIcns(filePath) {
  const buf = fs.readFileSync(filePath);
  const magic = buf.toString('ascii', 0, 4);
  const fileLength = buf.readUInt32BE(4);

  const tags = [];
  let offset = 8;
  while (offset < buf.length) {
    const tag = buf.toString('ascii', offset, offset + 4);
    const tagLength = buf.readUInt32BE(offset + 4);
    tags.push(`${tag} (${tagLength} bytes)`);
    offset += tagLength;
    if (tagLength <= 0) break;
  }

  return {
    valid: magic === 'icns' && fileLength === buf.length,
    format: 'Apple Icon Family (ICNS)',
    fileLength,
    tags: tags.join(', ')
  };
}

function inspectPng(filePath) {
  const buf = fs.readFileSync(filePath);
  const isPng = buf.toString('hex', 0, 8) === '89504e470d0a1a0a';
  let width = 0;
  let height = 0;
  if (isPng) {
    width = buf.readUInt32BE(16);
    height = buf.readUInt32BE(20);
  }
  return {
    valid: isPng,
    format: 'Portable Network Graphics (PNG)',
    dimensions: `${width}x${height}`
  };
}

const files = [
  { path: 'assets/icons/app/icon.ico', type: 'ico' },
  { path: 'assets/icons/app/icon.icns', type: 'icns' },
  { path: 'assets/icons/tray/tray-16.png', type: 'png' },
  { path: 'assets/icons/tray/tray-32.png', type: 'png' },
  { path: 'assets/icons/tray/tray-Template.png', type: 'png' },
  { path: 'assets/icons/tray/tray-Template@2x.png', type: 'png' },
  { path: 'assets/icons/app/png/16x16.png', type: 'png' },
  { path: 'assets/icons/app/png/24x24.png', type: 'png' },
  { path: 'assets/icons/app/png/32x32.png', type: 'png' },
  { path: 'assets/icons/app/png/48x48.png', type: 'png' },
  { path: 'assets/icons/app/png/64x64.png', type: 'png' },
  { path: 'assets/icons/app/png/128x128.png', type: 'png' },
  { path: 'assets/icons/app/png/256x256.png', type: 'png' },
  { path: 'assets/icons/app/png/512x512.png', type: 'png' }
];

console.log('=== FORMAT VALIDATION REPORT ===\n');
for (const f of files) {
  const fullPath = path.resolve(f.path);
  let res;
  if (f.type === 'ico') res = inspectIco(fullPath);
  else if (f.type === 'icns') res = inspectIcns(fullPath);
  else res = inspectPng(fullPath);

  console.log(`[FILE]: ${f.path}`);
  console.log(`  Valid: ${res.valid}`);
  console.log(`  Format: ${res.format}`);
  if (res.imageCount) console.log(`  Image Count: ${res.imageCount} images [${res.resolutions}]`);
  if (res.tags) console.log(`  Apple Elements: [${res.tags}]`);
  if (res.dimensions) console.log(`  Dimensions: ${res.dimensions}`);
  console.log('');
}
