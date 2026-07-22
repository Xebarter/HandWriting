const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { downloadArtifact } = require('@electron/get');

const desktopRoot = path.join(__dirname, '..');
const electronDir = path.join(desktopRoot, 'node_modules', 'electron');
const electronExe = path.join(electronDir, 'dist', 'electron.exe');
const pathFile = path.join(electronDir, 'path.txt');
const { version } = require(path.join(electronDir, 'package.json'));

function electronReady() {
  return fs.existsSync(electronExe) && fs.existsSync(pathFile);
}

function extractZip(zipPath, destPath) {
  if (process.platform === 'win32') {
    const result = spawnSync('tar', ['-xf', zipPath, '-C', destPath], {
      stdio: 'inherit',
    });

    if (result.status !== 0) {
      throw new Error(`tar extraction failed with code ${result.status ?? 'unknown'}`);
    }
    return;
  }

  const extract = require('extract-zip');
  return extract(zipPath, { dir: destPath });
}

async function installElectronBinary() {
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD === '1') {
    throw new Error('ELECTRON_SKIP_BINARY_DOWNLOAD is set');
  }

  console.log(`Downloading Electron ${version} for ${process.platform}-${process.arch}...`);

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
    force: process.env.force_no_cache === 'true',
  });

  const distPath = path.join(electronDir, 'dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  fs.mkdirSync(distPath, { recursive: true });

  console.log('Extracting Electron...');
  await extractZip(zipPath, distPath);
  await fs.promises.writeFile(pathFile, 'electron.exe');

  if (!electronReady()) {
    throw new Error('Electron extracted but electron.exe is still missing');
  }
}

async function main() {
  if (electronReady()) {
    return;
  }

  console.log('Electron binary missing or incomplete.');

  try {
    await installElectronBinary();
    console.log('Electron ready.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\nElectron install failed:', message);
    console.error('\nTry:');
    console.error('  1. Check your internet connection');
    console.error('  2. Run: node scripts/ensure-electron.cjs');
    console.error('  3. Use the packaged app: npm run dev:packaged');
    console.error('  4. Or run in browser: npm run dev:web');
    process.exit(1);
  }
}

main();
