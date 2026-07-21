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

// Generate changelog.json from CHANGELOG.md
try {
  require('./build-changelog');
} catch (err) {
  console.warn('Failed to build changelog.json:', err.message);
}

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
  { src: '_locales', dest: '_locales', isDir: true },
  { src: 'src', dest: 'src', isDir: true },
  { src: 'lib', dest: 'lib', isDir: true },
];

filesToCopy.forEach((item) => {
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

// 4. ZIP圧縮の実行 (WindowsはPowerShell、他はtarを使用)
console.log(`Creating ZIP archive: ${zipFileName}...`);
const isWindows = process.platform === 'win32';

if (isWindows) {
  try {
    // Windows PowerShell - Compress-Archive コマンドを使用
    const psCommand = `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipFilePath}' -Force"`;
    execSync(psCommand, { stdio: 'inherit' });
    console.log(`ZIP archive created successfully using PowerShell at: ${zipFilePath}`);
  } catch (error) {
    console.error('PowerShell build failed:', error.message);
    process.exit(1);
  }
} else {
  try {
    // macOS/Linux - tar を使用
    execSync(`tar -a -c -f "${zipFilePath}" -C "${tempDir}" .`, { stdio: 'inherit' });
    console.log(`ZIP archive created successfully using tar at: ${zipFilePath}`);
  } catch (error) {
    console.error('Tar build failed:', error.message);
    process.exit(1);
  }
}

// 5. 一時ディレクトリの削除
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Cleaned up temporary files. Build complete!');
