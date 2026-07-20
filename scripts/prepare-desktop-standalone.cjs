const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const staticSource = path.join(projectRoot, '.next', 'static');
const staticTarget = path.join(standaloneDir, '.next', 'static');
const publicSource = path.join(projectRoot, 'public');
const publicTarget = path.join(standaloneDir, 'public');

function copyRecursive(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`Missing path: ${source}`);
  }

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(from, to);
      continue;
    }

    fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(standaloneDir)) {
  console.error('Standalone output not found. Run build:desktop first.');
  process.exit(1);
}

console.log('Copying .next/static into standalone bundle...');
copyRecursive(staticSource, staticTarget);

console.log('Copying public assets into standalone bundle...');
copyRecursive(publicSource, publicTarget);

console.log('Desktop standalone bundle is ready at .next/standalone');
