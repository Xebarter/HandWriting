const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const serverPath = path.join(projectRoot, '.next', 'standalone', 'server.js');

const env = {
  ...process.env,
  NEXT_PUBLIC_DESKTOP_APP: '1',
  PORT: process.env.PORT || '3310',
  HOSTNAME: process.env.HOSTNAME || '127.0.0.1',
  NODE_ENV: 'production',
};

const child = spawn(process.execPath, [serverPath], {
  cwd: path.join(projectRoot, '.next', 'standalone'),
  env,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
