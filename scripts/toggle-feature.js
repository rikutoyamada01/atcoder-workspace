const fs = require('fs');
const path = require('path');

// 有効な機能IDのリスト
const VALID_FEATURES = [
  'monaco', 'template', 'test', 'notes', 'submit',
  'dashboard', 'library', 'error', 'export', 'queue',
  'safety', 'autopush'
];

const featureId = process.argv[2];

if (!featureId) {
  console.error('\x1b[31m[Roadmap Error]\x1b[0m Please specify a feature ID to toggle.');
  console.log(`Valid feature IDs: \x1b[36m${VALID_FEATURES.join(', ')}\x1b[0m`);
  process.exit(1);
}

const normalizedId = featureId.toLowerCase().trim();

if (!VALID_FEATURES.includes(normalizedId)) {
  console.error(`\x1b[31m[Roadmap Error]\x1b[0m Invalid feature ID: "${featureId}"`);
  console.log(`Valid feature IDs: \x1b[36m${VALID_FEATURES.join(', ')}\x1b[0m`);
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const roadmapPath = path.join(rootDir, 'roadmap.html');

if (!fs.existsSync(roadmapPath)) {
  console.error('\x1b[31m[Roadmap Error]\x1b[0m roadmap.html not found.');
  process.exit(1);
}

let content = fs.readFileSync(roadmapPath, 'utf8');

// completedSkills = [...] の配列をパース・更新
const regex = /const completedSkills\s*=\s*(\[[^]*?\]);/;
const match = content.match(regex);

if (!match) {
  console.error('\x1b[31m[Roadmap Error]\x1b[0m completedSkills array not found in roadmap.html');
  process.exit(1);
}

let completedSkills = [];
try {
  completedSkills = JSON.parse(match[1]);
} catch (e) {
  console.error('\x1b[31m[Roadmap Error]\x1b[0m Error parsing completedSkills array:', e);
  process.exit(1);
}

const index = completedSkills.indexOf(normalizedId);
let statusMessage = '';

if (index === -1) {
  // 追加
  completedSkills.push(normalizedId);
  completedSkills.sort();
  statusMessage = `Feature \x1b[36m"${normalizedId}"\x1b[0m has been marked as \x1b[32mCOMPLETED\x1b[0m.`;
} else {
  // 削除
  completedSkills.splice(index, 1);
  statusMessage = `Feature \x1b[36m"${normalizedId}"\x1b[0m has been marked as \x1b[31mUNCOMPLETED (Locked)\x1b[0m.`;
}

const replacement = `const completedSkills = ${JSON.stringify(completedSkills)};`;
content = content.replace(regex, replacement);
fs.writeFileSync(roadmapPath, content, 'utf8');

console.log(`\x1b[32m[Roadmap Updated]\x1b[0m ${statusMessage}`);
console.log(`Currently completed features: \x1b[36m[${completedSkills.length > 0 ? completedSkills.join(', ') : 'none'}]\x1b[0m\n`);
