const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

const env = {
  ...process.env,
  NEXT_PUBLIC_DESKTOP_APP: '1',
};

const child = spawn(process.execPath, [nextBin, 'dev', '-p', '3310', '--hostname', '127.0.0.1'], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
