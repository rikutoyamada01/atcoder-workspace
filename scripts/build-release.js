const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tempDir = path.join(distDir, 'temp');

// 1. package.jsonからバージョン取得
const packageJson = require(path.join(rootDir, 'package.json'));
const version = packageJson.version;
const zipFileName = `atcoder-workspace-v${version}.zip`;
const zipFilePath = path.join(distDir, zipFileName);

console.log(`Starting release build for version ${version}...`);

// 2. クリーンアップと一時ディレクトリ作成
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

// 3. ファイルのコピー
const filesToCopy = [
  { src: 'manifest.json', dest: 'manifest.json' },
  { src: 'LICENSE', dest: 'LICENSE' },
  { src: 'README.md', dest: 'README.md' },
  { src: 'src', dest: 'src', isDir: true },
  { src: 'lib', dest: 'lib', isDir: true }
];

filesToCopy.forEach(item => {
  const srcPath = path.join(rootDir, item.src);
  const destPath = path.join(tempDir, item.dest);
  
  if (fs.existsSync(srcPath)) {
    if (item.isDir) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
    console.log(`Copied ${item.src} to package`);
  } else {
    console.warn(`Warning: ${item.src} not found`);
  }
});

// 4. ZIP圧縮の実行 (Windows/Mac/Linuxで動作するtarを使用)
console.log(`Creating ZIP archive: ${zipFileName}...`);
try {
  // tar -a -c -f <zipFile> -C <dir> .
  // Windowsのtar.exeでも -a (auto-compress) オプションが動作します
  execSync(`tar -a -c -f "${zipFilePath}" -C "${tempDir}" .`, { stdio: 'inherit' });
  console.log(`ZIP archive created successfully at: ${zipFilePath}`);
} catch (error) {
  console.log('Failed to create ZIP archive using tar. Attempting PowerShell fallback...');
  try {
    // Windows PowerShell fallback
    // Compress-Archive コマンドを使用
    const psCommand = `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipFilePath}' -Force"`;
    execSync(psCommand, { stdio: 'inherit' });
    console.log(`ZIP archive created successfully using PowerShell at: ${zipFilePath}`);
  } catch (psError) {
    console.error('PowerShell build also failed:', psError.message);
    process.exit(1);
  }
}

// 5. 一時ディレクトリの削除
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Cleaned up temporary files. Build complete!');
