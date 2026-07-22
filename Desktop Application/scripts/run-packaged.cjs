const { spawn } = require('child_process');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const projectRoot = path.join(desktopRoot, '..');
const unpackedExe = path.join(desktopRoot, 'release', 'win-unpacked', 'HandWriting.exe');

const fs = require('fs');

if (process.platform === 'win32' && fs.existsSync(unpackedExe)) {
  console.log(`Starting packaged app: ${unpackedExe}`);
  const child = spawn(unpackedExe, [], { stdio: 'inherit', windowsHide: false });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  console.error('Packaged app not found. Build it first with: npm run package');
  console.error('Or use Electron dev mode: npm run dev');
  process.exit(1);
}
