const fs = require('fs');
const path = require('path');

console.log('[build] Preparing frontend deployment assets...');

const nestedFrontendDir = path.resolve(__dirname, 'frontend');

if (!fs.existsSync(nestedFrontendDir)) {
  try {
    fs.symlinkSync('.', nestedFrontendDir, 'dir');
    console.log('[build] Created symlink ./frontend -> .');
  } catch (e) {
    console.log('[build] Symlink fallback to directory copy:', e.message);
    try {
      fs.mkdirSync(nestedFrontendDir, { recursive: true });
      for (const file of fs.readdirSync(__dirname)) {
        if (file !== 'frontend' && file !== 'node_modules' && file !== 'build.js') {
          fs.cpSync(path.join(__dirname, file), path.join(nestedFrontendDir, file), { recursive: true });
        }
      }
      console.log('[build] Copied files into ./frontend successfully.');
    } catch (err) {
      console.error('[build] Error copying files:', err);
    }
  }
} else {
  console.log('[build] ./frontend already exists.');
}
console.log('[build] Frontend build completed successfully.');
