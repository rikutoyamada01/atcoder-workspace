const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../node_modules/monaco-editor/min/vs');
const dest = path.join(__dirname, '../lib/monaco/vs');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) {
    console.error(`Source directory not found: ${from}`);
    process.exit(1);
  }
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  fs.readdirSync(from).forEach(element => {
    const stat = fs.lstatSync(path.join(from, element));
    if (stat.isFile()) {
      fs.copyFileSync(path.join(from, element), path.join(to, element));
    } else if (stat.isDirectory()) {
      copyFolderSync(path.join(from, element), path.join(to, element));
    }
  });
}

console.log('Copying Monaco Editor files...');
copyFolderSync(src, dest);
console.log('Monaco Editor setup complete. Files copied to:', dest);
