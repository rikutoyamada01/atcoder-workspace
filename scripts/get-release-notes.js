/**
 * Extracts release notes for a specific version from CHANGELOG.md.
 * Usage: node scripts/get-release-notes.js [version]
 * Example: node scripts/get-release-notes.js 1.6.1
 */

const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');

function getReleaseNotes() {
  const targetVersionRaw = process.argv[2] || '';
  const targetVersion = targetVersionRaw.replace(/^v/, '');

  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error('CHANGELOG.md not found');
    process.exit(1);
  }

  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const lines = content.split('\n');

  let capturing = false;
  const resultLines = [];
  const versionHeaderRegex = /^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+)\]?/;

  for (const line of lines) {
    const match = line.match(versionHeaderRegex);
    if (match) {
      const version = match[1];
      if (capturing) {
        // Stopped at next version header
        break;
      }
      if (!targetVersion || version === targetVersion) {
        capturing = true;
        resultLines.push(line);
      }
    } else if (capturing) {
      resultLines.push(line);
    }
  }

  if (resultLines.length === 0) {
    console.error(`Version ${targetVersionRaw} not found in CHANGELOG.md`);
    process.exit(1);
  }

  console.log(resultLines.join('\n').trim());
}

getReleaseNotes();
