const fs = require('fs');
const path = require('path');

console.log('[build] Preparing deployment assets...');

const frontendDir = path.resolve(__dirname, 'frontend');
const nestedFrontendDir = path.join(frontendDir, 'frontend');

if (fs.existsSync(frontendDir)) {
  if (!fs.existsSync(nestedFrontendDir)) {
    try {
      fs.symlinkSync('.', nestedFrontendDir, 'dir');
      console.log('[build] Created symlink frontend/frontend -> .');
    } catch (e) {
      console.log('[build] Symlink fallback to directory copy:', e.message);
      try {
        fs.mkdirSync(nestedFrontendDir, { recursive: true });
        for (const file of fs.readdirSync(frontendDir)) {
          if (file !== 'frontend' && file !== 'node_modules') {
            fs.cpSync(path.join(frontendDir, file), path.join(nestedFrontendDir, file), { recursive: true });
          }
        }
        console.log('[build] Copied frontend files into frontend/frontend successfully.');
      } catch (err) {
        console.error('[build] Error copying files:', err);
      }
    }
  } else {
    console.log('[build] frontend/frontend already exists.');
  }
}
console.log('[build] Build completed successfully.');
