const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const DESKTOP_PORT = 3310;

const env = {
  ...process.env,
  NEXT_PUBLIC_DESKTOP_APP: '1',
};

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stopDesktopServerOnWindows() {
  const portCheck = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-NetTCPConnection -LocalPort ${DESKTOP_PORT} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique`,
    ],
    { encoding: 'utf8' }
  );

  const pids = (portCheck.stdout || '')
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);

  for (const pid of pids) {
    console.log(`Stopping desktop server process on port ${DESKTOP_PORT} (PID ${pid})...`);
    spawnSync('taskkill', ['/pid', String(pid), '/f', '/t'], { stdio: 'ignore' });
  }
}

function stopProjectStandaloneServer() {
  const serverPath = path.join(standaloneDir, 'server.js');
  if (!fs.existsSync(serverPath)) {
    return;
  }

  if (process.platform === 'win32') {
    const normalized = standaloneDir.replace(/\\/g, '\\\\');
    spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${normalized}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: 'ignore' }
    );
    return;
  }

  spawnSync('pkill', ['-f', standaloneDir], { stdio: 'ignore' });
}

function prepareStandaloneDirectory() {
  stopDesktopServerOnWindows();
  stopProjectStandaloneServer();

  if (!fs.existsSync(standaloneDir)) {
    return;
  }

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      fs.rmSync(standaloneDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (error && error.code === 'EBUSY' && attempt < 8) {
        console.warn(
          `Standalone folder is locked (attempt ${attempt}/8). Close HandWriting Desktop and retrying...`
        );
        sleep(500 * attempt);
        stopDesktopServerOnWindows();
        stopProjectStandaloneServer();
        continue;
      }

      throw new Error(
        'Could not clear .next/standalone. Close HandWriting Desktop, stop "npm run desktop:start", then run build again.'
      );
    }
  }
}

prepareStandaloneDirectory();

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
