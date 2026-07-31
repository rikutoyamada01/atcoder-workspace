const fs = require('fs');
const path = require('path');

const jaPath = path.join(__dirname, '../_locales/ja/messages.json');
const enPath = path.join(__dirname, '../_locales/en/messages.json');

console.log('🌐 Checking i18n keys synchronization between ja and en messages.json...\n');

let hasError = false;

if (!fs.existsSync(jaPath)) {
  console.error(`❌ Missing Japanese locale file: ${jaPath}`);
  process.exit(1);
}

if (!fs.existsSync(enPath)) {
  console.error(`❌ Missing English locale file: ${enPath}`);
  process.exit(1);
}

const ja = JSON.parse(fs.readFileSync(jaPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const jaKeys = Object.keys(ja);
const enKeys = Object.keys(en);

const missingInEn = jaKeys.filter((key) => !(key in en));
const missingInJa = enKeys.filter((key) => !(key in ja));

const emptyInJa = jaKeys.filter((key) => !ja[key].message || ja[key].message.trim() === '');
const emptyInEn = enKeys.filter((key) => !en[key].message || en[key].message.trim() === '');

console.log(`📊 Statistics:`);
console.log(`   - Japanese (ja) keys: ${jaKeys.length}`);
console.log(`   - English (en) keys:  ${enKeys.length}\n`);

if (missingInEn.length > 0) {
  hasError = true;
  console.error(`❌ Keys present in 'ja' but missing in 'en' (${missingInEn.length}):`);
  missingInEn.forEach((key) => console.error(`   - ${key}`));
  console.log('');
}

if (missingInJa.length > 0) {
  hasError = true;
  console.error(`❌ Keys present in 'en' but missing in 'ja' (${missingInJa.length}):`);
  missingInJa.forEach((key) => console.error(`   - ${key}`));
  console.log('');
}

if (emptyInJa.length > 0) {
  hasError = true;
  console.error(`⚠️ Empty messages in 'ja' (${emptyInJa.length}):`);
  emptyInJa.forEach((key) => console.error(`   - ${key}`));
  console.log('');
}

if (emptyInEn.length > 0) {
  hasError = true;
  console.error(`⚠️ Empty messages in 'en' (${emptyInEn.length}):`);
  emptyInEn.forEach((key) => console.error(`   - ${key}`));
  console.log('');
}

if (hasError) {
  console.error('❌ i18n keys synchronization check FAILED!');
  process.exit(1);
} else {
  console.log('✅ i18n keys check PASSED! All keys in ja and en are perfectly synchronized.');
}
