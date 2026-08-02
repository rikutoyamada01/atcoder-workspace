const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const isCheckOnly = process.argv.includes('--check');

// 1. package.json から正本バージョンを取得
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

if (isCheckOnly) {
  console.log(`🔍 Checking version synchronization against package.json (${version})...\n`);
} else {
  console.log(`🔄 Synchronizing version ${version} across the repository...\n`);
}

let updatedCount = 0;
let mismatchCount = 0;
const mismatches = [];

// 2. manifest.json のバージョン検証 / 更新
const manifestPath = path.join(rootDir, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== version) {
    if (isCheckOnly) {
      mismatches.push(`manifest.json (found '${manifest.version}', expected '${version}')`);
      mismatchCount++;
    } else {
      manifest.version = version;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
      console.log(`✅ Updated manifest.json version -> ${version}`);
      updatedCount++;
    }
  } else if (!isCheckOnly) {
    console.log(`ℹ️ manifest.json version is already up to date (${version})`);
  }
}

// 3. pages/ 以下の HTML ファイル内のキャッシュバスター ?v=X.X.X の検証 / 自動更新
const pagesDir = path.join(rootDir, 'pages');

function getHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const htmlFiles = getHtmlFiles(pagesDir);
const cacheBusterRegex = /(\.(?:css|js))\?v=([\d.\w-]+)/g;

htmlFiles.forEach((filePath) => {
  const relativePath = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  let match;
  let fileHasMismatch = false;

  // Check for any cache-buster queries not matching target version
  while ((match = cacheBusterRegex.exec(content)) !== null) {
    const foundVer = match[2];
    if (foundVer !== version) {
      fileHasMismatch = true;
      if (isCheckOnly) {
        mismatches.push(`${relativePath} (${match[0]} -> expected ?v=${version})`);
      }
    }
  }

  if (fileHasMismatch) {
    if (isCheckOnly) {
      mismatchCount++;
    } else {
      const newContent = content.replace(cacheBusterRegex, `$1?v=${version}`);
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ Updated asset cache-buster in ${relativePath} -> ?v=${version}`);
      updatedCount++;
    }
  }
});

if (isCheckOnly) {
  if (mismatchCount > 0) {
    console.error(
      `❌ Version synchronization check FAILED! (${mismatchCount} mismatch(es) found):`
    );
    mismatches.forEach((msg) => console.error(`   - ${msg}`));
    console.error(
      '\n💡 Run "npm run version:sync" to automatically synchronize all version strings.'
    );
    process.exit(1);
  } else {
    console.log(
      `✅ Version synchronization check PASSED! All versions are synchronized with package.json (${version}).`
    );
  }
} else {
  console.log(`\n🎉 Version synchronization complete! (${updatedCount} file(s) updated)`);
}
