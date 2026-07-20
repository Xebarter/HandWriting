const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3310;
const HOST = '127.0.0.1';
const APP_URL = `http://${HOST}:${PORT}`;

let serverProcess = null;
let mainWindow = null;

function projectRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }

  return path.resolve(__dirname, '..', '..');
}

function startNextServer() {
  const root = projectRoot();
  const env = {
    ...process.env,
    NEXT_PUBLIC_DESKTOP_APP: '1',
    PORT: String(PORT),
    HOSTNAME: HOST,
  };

  if (app.isPackaged) {
    const serverPath = path.join(root, 'server.js');
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: root,
      env: { ...env, NODE_ENV: 'production' },
      stdio: 'inherit',
    });
    return;
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  serverProcess = spawn(npmCmd, ['run', 'desktop:dev'], {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: true,
  });
}

function waitForServer(maxAttempts = 120) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      const request = http.get(APP_URL, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        attempts += 1;
        if (attempts >= maxAttempts) {
          reject(new Error(`Timed out waiting for ${APP_URL}`));
          return;
        }
        setTimeout(check, 500);
      });
    };

    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title: 'HandWriting',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadURL(APP_URL);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t']);
  } else {
    serverProcess.kill('SIGTERM');
  }
}

app.whenReady().then(async () => {
  startNextServer();

  try {
    await waitForServer();
    await createWindow();
  } catch (error) {
    console.error('[desktop] Failed to start:', error);
    stopServer();
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});
