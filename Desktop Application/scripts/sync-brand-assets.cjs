const fs = require('fs');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const publicDir = path.join(desktopRoot, '..', 'public');
const buildDir = path.join(desktopRoot, 'build');

const assetCopies = [
  ['favicon.ico', 'icon.ico'],
  ['favicon.svg', 'icon.svg'],
  ['favicon-96x96.png', 'icon-96.png'],
  ['apple-touch-icon.png', 'apple-touch-icon.png'],
  ['web-app-manifest-192x192.png', 'icon-192.png'],
  ['web-app-manifest-512x512.png', 'icon-512.png'],
  ['web-app-manifest-512x512.png', 'icon.png'],
  ['site.webmanifest', 'site.webmanifest'],
];

if (!fs.existsSync(publicDir)) {
  console.error(`Missing public folder: ${publicDir}`);
  process.exit(1);
}

fs.mkdirSync(buildDir, { recursive: true });

for (const [sourceName, targetName] of assetCopies) {
  const sourcePath = path.join(publicDir, sourceName);
  const targetPath = path.join(buildDir, targetName);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Missing brand asset: ${sourcePath}`);
    process.exit(1);
  }

  fs.copyFileSync(sourcePath, targetPath);
}

console.log('Synced brand assets from public/ to Desktop Application/build/');
