const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('handwritingDesktop', {
  isDesktopApp: true,
  platform: process.platform,
});
