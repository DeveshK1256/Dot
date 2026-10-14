import fs from 'fs';
import path from 'path';
import png2icons from 'png2icons';

const masterPngPath = path.resolve('assets/icons/master-app-icon.png');
const icoOutputPath = path.resolve('assets/icons/app/icon.ico');
const icnsOutputPath = path.resolve('assets/icons/app/icon.icns');

console.log('Reading master PNG:', masterPngPath);
const inputBuffer = fs.readFileSync(masterPngPath);

// Generate ICO (multi-resolution container: 16, 24, 32, 48, 64, 128, 256)
console.log('Generating multi-resolution ICO...');
const icoBuffer = png2icons.createICO(inputBuffer, png2icons.BILINEAR, 0, false, true);
if (icoBuffer) {
  fs.writeFileSync(icoOutputPath, icoBuffer);
  console.log('Wrote ICO to:', icoOutputPath, `(${icoBuffer.length} bytes)`);
} else {
  console.error('Failed to create ICO buffer');
  process.exit(1);
}

// Generate ICNS (Apple Icon Family: icp4, icp5, icp6, ic07, ic08, ic09, ic10)
console.log('Generating Apple ICNS icon family...');
const icnsBuffer = png2icons.createICNS(inputBuffer, png2icons.BILINEAR, 0);
if (icnsBuffer) {
  fs.writeFileSync(icnsOutputPath, icnsBuffer);
  console.log('Wrote ICNS to:', icnsOutputPath, `(${icnsBuffer.length} bytes)`);
} else {
  console.error('Failed to create ICNS buffer');
  process.exit(1);
}

console.log('Conversion completed successfully.');
