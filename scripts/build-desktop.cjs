const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const env = {
  ...process.env,
  NEXT_PUBLIC_DESKTOP_APP: '1',
};

const build = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const prepare = spawnSync(process.execPath, ['scripts/prepare-desktop-standalone.cjs'], {
  cwd: projectRoot,
  stdio: 'inherit',
});

process.exit(prepare.status ?? 0);
