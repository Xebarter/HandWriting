const { spawnSync } = require('child_process');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const projectRoot = path.join(desktopRoot, '..');
const packOnly = process.argv.includes('--dir');
const builderArgs = packOnly ? ['--dir'] : ['--win', '--x64'];
const electronBuilder = path.join(desktopRoot, 'node_modules', 'electron-builder', 'cli.js');

function run(label, command, args, cwd) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(
  'Building Next.js standalone bundle',
  process.execPath,
  [path.join(projectRoot, 'scripts', 'build-desktop.cjs')],
  projectRoot
);

run(
  'Syncing brand assets from public/',
  process.execPath,
  [path.join(desktopRoot, 'scripts', 'sync-brand-assets.cjs')],
  desktopRoot
);

run(
  packOnly ? 'Packaging Electron app (unpacked)' : 'Packaging Electron app',
  process.execPath,
  [electronBuilder, ...builderArgs],
  desktopRoot
);

if (!packOnly) {
  console.log('\nDesktop package complete.');
  console.log(`Release folder: ${path.join(desktopRoot, 'release')}`);
  console.log(`Installer: ${path.join(desktopRoot, 'release', 'HandWriting Setup 0.1.0.exe')}`);
}
