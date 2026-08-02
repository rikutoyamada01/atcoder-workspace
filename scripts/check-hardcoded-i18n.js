const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

// Regex for detecting Japanese characters (Kanji, Hiragana, Katakana)
const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

console.log('🔍 Auditing hardcoded Japanese strings in src/ ...\n');

let totalMatches = 0;
let totalFilesWithMatches = 0;

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const files = getAllFiles(srcDir);

files.forEach((filePath) => {
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const fileMatches = [];

  let inBlockComment = false;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip block comments
    if (trimmed.startsWith('/*')) inBlockComment = true;
    if (inBlockComment) {
      if (trimmed.endsWith('*/')) inBlockComment = false;
      return;
    }

    // Skip single line comments and debug console calls
    if (trimmed.startsWith('//')) return;
    if (trimmed.startsWith('*')) return;
    if (
      trimmed.startsWith('console.log(') ||
      trimmed.startsWith('console.warn(') ||
      trimmed.startsWith('console.error(')
    )
      return;

    // Skip HTML lines already having data-i18n or data-i18n-placeholder attributes
    if (
      filePath.endsWith('.html') &&
      (trimmed.includes('data-i18n=') || trimmed.includes('data-i18n-placeholder='))
    ) {
      return;
    }

    // Check if line has Japanese characters
    if (japaneseRegex.test(line)) {
      fileMatches.push({ lineNum, line: trimmed });
    }
  });

  if (fileMatches.length > 0) {
    totalFilesWithMatches++;
    console.log(`📄 \x1b[33m${relativePath}\x1b[0m (${fileMatches.length} hardcoded strings):`);
    fileMatches.forEach((m) => {
      console.log(`   L${m.lineNum}: \x1b[36m${m.line.substring(0, 100)}\x1b[0m`);
      totalMatches++;
    });
    console.log('');
  }
});

console.log('--------------------------------------------------');
if (totalMatches > 0) {
  console.log(
    `⚠️ Found ${totalMatches} hardcoded Japanese string(s) across ${totalFilesWithMatches} file(s).`
  );
  console.log(
    '   Please replace these with i18nProvider.t(...) or chrome.i18n.getMessage(...) for 100% i18n coverage.'
  );
} else {
  console.log('🎉 100% HARDCODED-FREE! All UI strings are properly internationalized.');
}
