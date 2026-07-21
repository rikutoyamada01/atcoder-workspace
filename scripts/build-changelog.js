/**
 * Parses CHANGELOG.md and converts it into src/changelog.json
 * Used during build time to supply release notes to the extension UI.
 */

const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'CHANGELOG.md');
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'changelog.json');

function parseChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.warn('CHANGELOG.md not found. Generating empty src/changelog.json');
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify([], null, 2), 'utf8');
    return;
  }

  const content = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const lines = content.split('\n');

  const releases = [];
  let currentRelease = null;

  const versionHeaderRegex =
    /^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+)\]?(?:\s+-\s+([0-9]{4}-[0-9]{2}-[0-9]{2}))?/;

  for (const line of lines) {
    const match = line.match(versionHeaderRegex);
    if (match) {
      if (currentRelease) {
        currentRelease.content = currentRelease.contentLines.join('\n').trim();
        delete currentRelease.contentLines;
        releases.push(currentRelease);
      }
      currentRelease = {
        version: match[1],
        date: match[2] || '',
        contentLines: [],
      };
    } else if (currentRelease) {
      currentRelease.contentLines.push(line);
    }
  }

  if (currentRelease) {
    currentRelease.content = currentRelease.contentLines.join('\n').trim();
    delete currentRelease.contentLines;
    releases.push(currentRelease);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(releases, null, 2), 'utf8');
  console.log(`Generated ${OUTPUT_PATH} with ${releases.length} releases.`);
}

parseChangelog();
