const { app, BrowserWindow, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3310;
const HOST = '127.0.0.1';
const APP_URL = `http://${HOST}:${PORT}`;

let serverProcess = null;
let mainWindow = null;
let startedServer = false;

function projectRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }

  return path.resolve(__dirname, '..', '..');
}

function log(message) {
  console.log(`[desktop] ${message}`);
}

function resolveBrandIcon() {
  const candidates = [
    path.join(projectRoot(), 'public', 'favicon.ico'),
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.resolve(__dirname, '..', '..', 'public', 'favicon.ico'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
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
    log(`Starting production server: ${serverPath}`);
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: root,
      env: { ...env, NODE_ENV: 'production' },
      stdio: 'inherit',
    });
    startedServer = true;
    return;
  }

  const devScript = path.join(root, 'scripts', 'run-desktop-dev.cjs');
  log(`Starting dev server: ${devScript}`);
  serverProcess = spawn(process.execPath, [devScript], {
    cwd: root,
    env,
    stdio: 'inherit',
    windowsHide: false,
  });
  startedServer = true;

  serverProcess.on('error', (error) => {
    log(`Server process error: ${error.message}`);
  });

  serverProcess.on('exit', (code, signal) => {
    log(`Server process exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'HandWriting Desktop',
        'The local app server stopped unexpectedly. Close the app and run npm run dev again.'
      );
      app.quit();
    }
  });
}

function isServerAvailable() {
  return new Promise((resolve) => {
    const request = http.get(APP_URL, (response) => {
      response.resume();
      resolve(true);
    });

    request.on('error', () => resolve(false));
    request.setTimeout(1500, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(maxAttempts = 120) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await isServerAvailable()) {
      log(`Server ready at ${APP_URL}`);
      return;
    }

    if (attempt === 1 || attempt % 10 === 0) {
      log(`Waiting for server (${attempt}/${maxAttempts})...`);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${APP_URL}`);
}

async function createWindow() {
  const iconPath = resolveBrandIcon();
  if (iconPath) {
    log(`Using app icon: ${iconPath}`);
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    title: 'HandWriting',
    autoHideMenuBar: true,
    show: false,
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  await mainWindow.loadURL(APP_URL);
  log('Window loaded');
}

function stopServer() {
  if (!startedServer || !serverProcess || serverProcess.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    serverProcess.kill('SIGTERM');
  }
}

async function bootDesktopApp() {
  const alreadyRunning = await isServerAvailable();

  if (alreadyRunning) {
    log(`Reusing existing server at ${APP_URL}`);
  } else {
    startNextServer();
    await waitForServer();
  }

  await createWindow();
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.handwriting.desktop');
  }

  try {
    await bootDesktopApp();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Failed to start: ${message}`);
    dialog.showErrorBox('HandWriting Desktop', message);
    stopServer();
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox('HandWriting Desktop', message);
    }
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
