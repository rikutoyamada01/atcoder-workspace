/**
 * Automated Release Preparation Script
 *
 * Extracts release changes and linked issues strictly from Pull Requests merged into develop:
 * 1. Queries GitHub PRs merged into develop since the last release (or parses merge commits).
 * 2. Extracts referenced issues strictly from PR body "Ref: #XX" or "Related: #XX".
 * 3. Categorizes changes into Added / Fixed / Changed based on PR titles and type labels.
 * 4. Updates package.json, manifest.json, cache-busters, and CHANGELOG.md.
 * 5. Generates release-pr-body.md with "Closes #XX" statements for master release PR.
 *
 * Usage:
 *   node scripts/prepare-release.js [patch|minor|major|x.y.z] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

const typeOrVersion = process.argv[2] || 'patch';
const isDryRun = process.argv.includes('--dry-run');

// 1. Read current version
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// 2. Calculate next version
let nextVersion = '';
if (typeOrVersion === 'patch') {
  nextVersion = `${major}.${minor}.${patch + 1}`;
} else if (typeOrVersion === 'minor') {
  nextVersion = `${major}.${minor + 1}.0`;
} else if (typeOrVersion === 'major') {
  nextVersion = `${major + 1}.0.0`;
} else if (/^\d+\.\d+\.\d+$/.test(typeOrVersion)) {
  nextVersion = typeOrVersion;
} else {
  console.error(`Invalid version or release type: ${typeOrVersion}`);
  console.error('Usage: node scripts/prepare-release.js [patch|minor|major|X.Y.Z]');
  process.exit(1);
}

console.log(`🚀 Preparing release: v${currentVersion} -> v${nextVersion}`);

// 3. Determine the cutoff date/commit of the last release on master
let lastReleaseDate = null;
try {
  // Get date of the last commit on master
  const dateStr = execSync('git log -1 --format=%cI origin/master', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore'],
  }).trim();
  if (dateStr) {
    lastReleaseDate = new Date(dateStr);
  }
} catch (e) {
  try {
    const dateStr = execSync('git log -1 --format=%cI master', { encoding: 'utf8' }).trim();
    if (dateStr) {
      lastReleaseDate = new Date(dateStr);
    }
  } catch (err) {
    // ignore
  }
}

// 4. Fetch merged PRs from GitHub via gh CLI
let mergedPRs = [];
try {
  const ghOutput = execSync(
    'gh pr list --state merged --base develop --limit 50 --json number,title,body,mergedAt',
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
  );
  const allMerged = JSON.parse(ghOutput);

  // Filter PRs merged after the last release date
  if (lastReleaseDate) {
    mergedPRs = allMerged.filter((pr) => new Date(pr.mergedAt) > lastReleaseDate);
  } else {
    mergedPRs = allMerged.slice(0, 20);
  }
} catch (e) {
  console.warn('⚠️ gh CLI not available or failed. Falling back to git merge commits.');
}

// Fallback: If gh CLI didn't return PRs, parse git log for merge commits
if (mergedPRs.length === 0) {
  try {
    const rawLog = execSync('git log origin/master..HEAD --merges --oneline', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (rawLog) {
      const lines = rawLog.split('\n');
      lines.forEach((line) => {
        const prMatch = line.match(/Merge pull request #(\d+) from (.+)/);
        if (prMatch) {
          mergedPRs.push({
            number: Number(prMatch[1]),
            title: prMatch[2],
            body: '',
          });
        }
      });
    }
  } catch (err) {
    // ignore
  }
}

console.log(`📋 Found ${mergedPRs.length} merged Pull Request(s) since last release.`);

// 5. Categorize changes and extract issues strictly from PRs
const added = [];
const fixed = [];
const changed = [];
const other = [];
const issueNumbers = new Set();

// Regular expressions to extract strictly formatted issues (Ref: #XX, Related: #XX, (#XX))
const refRegex = /(?:Ref|Related|Refs|Fixes|Closes):\s*#(\d+)/gi;
const inlineIssueRegex = /#(\d+)/g;

mergedPRs.forEach((pr) => {
  const title = pr.title || '';
  const body = pr.body || '';

  // 1. Extract from PR body (strict Ref: #XX)
  let refMatch;
  while ((refMatch = refRegex.exec(body)) !== null) {
    issueNumbers.add(refMatch[1]);
  }

  // 2. Also check PR title for (#XX) or #XX
  let titleMatch;
  while ((titleMatch = inlineIssueRegex.exec(title)) !== null) {
    issueNumbers.add(titleMatch[1]);
  }

  // 3. Categorize PR
  const lower = title.toLowerCase();
  const prDisplay = `- ${title} ([#${pr.number}](https://github.com/rikutoyamada01/atcoder-workspace/pull/${pr.number}))`;

  if (lower.startsWith('feat:') || lower.startsWith('feat(') || body.includes('- [x] 🚀 新機能')) {
    added.push(prDisplay);
  } else if (
    lower.startsWith('fix:') ||
    lower.startsWith('fix(') ||
    body.includes('- [x] 🐛 不具合修正')
  ) {
    fixed.push(prDisplay);
  } else if (
    lower.startsWith('docs:') ||
    lower.startsWith('chore:') ||
    lower.startsWith('refactor:') ||
    body.includes('- [x] 📚 ドキュメント') ||
    body.includes('- [x] ⚙️')
  ) {
    changed.push(prDisplay);
  } else {
    other.push(prDisplay);
  }
});

// Fallback: If no PRs merged yet, check direct commits for dry-run/preview
if (mergedPRs.length === 0) {
  try {
    const rawLog = execSync('git log origin/master..HEAD --oneline --no-merges', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    if (rawLog) {
      rawLog.split('\n').forEach((line) => {
        const parts = line.split(' ');
        const hash = parts[0];
        const message = parts.slice(1).join(' ').trim();
        let m;
        while ((m = inlineIssueRegex.exec(message)) !== null) {
          issueNumbers.add(m[1]);
        }
        const lower = message.toLowerCase();
        if (lower.startsWith('feat:') || lower.startsWith('feat(')) {
          added.push(`- ${message} (${hash})`);
        } else if (lower.startsWith('fix:') || lower.startsWith('fix(')) {
          fixed.push(`- ${message} (${hash})`);
        } else {
          changed.push(`- ${message} (${hash})`);
        }
      });
    }
  } catch (e) {}
}

const sortedIssues = Array.from(issueNumbers).sort((a, b) => Number(a) - Number(b));
console.log(
  `🔗 Extracted ${sortedIssues.length} target issue(s) for auto-close: ${sortedIssues.map((n) => '#' + n).join(', ') || 'none'}`
);

// 6. Generate Changelog entry
const today = new Date().toISOString().split('T')[0];
let changelogSection = `## [${nextVersion}] - ${today}\n\n`;

if (added.length > 0) {
  changelogSection += `### Added\n${added.join('\n')}\n\n`;
}
if (fixed.length > 0) {
  changelogSection += `### Fixed\n${fixed.join('\n')}\n\n`;
}
if (changed.length > 0) {
  changelogSection += `### Changed\n${changed.join('\n')}\n\n`;
}
if (other.length > 0) {
  changelogSection += `### Other Changes\n${other.join('\n')}\n\n`;
}

// 7. Generate PR Body
let prBody = `## Release v${nextVersion}\n\n`;
if (sortedIssues.length > 0) {
  prBody += `### 関連・自動クローズ対象 Issue\n`;
  prBody += sortedIssues.map((num) => `Closes #${num}`).join(', ') + '\n\n';
}

prBody += `### リリース概要 (マージ済み PR 一覧)\n\n`;
if (added.length > 0) {
  prBody += `#### 🚀 新機能 (Added)\n${added.join('\n')}\n\n`;
}
if (fixed.length > 0) {
  prBody += `#### 🐛 不具合修正 (Fixed)\n${fixed.join('\n')}\n\n`;
}
if (changed.length > 0) {
  prBody += `#### ⚙️ 内部改善・変更 (Changed)\n${changed.join('\n')}\n\n`;
}
if (other.length > 0) {
  prBody += `#### 📦 その他 (Other)\n${other.join('\n')}\n\n`;
}

prBody += `### リリース後チェックリスト\n`;
prBody += `- [ ] master マージ後に自動リリースワークフロー (\`release.yml\`) が起動することを確認\n`;
prBody += `- [ ] GitHub Releases に ZIP パッケージ (\`atcoder-workspace-v${nextVersion}.zip\`) が生成されたことを確認\n`;
prBody += `- [ ] ストア更新用パッケージの提出\n`;

if (isDryRun) {
  console.log('\n--- [DRY-RUN] CHANGELOG ENTRY ---');
  console.log(changelogSection);
  console.log('--- [DRY-RUN] PR BODY ---');
  console.log(prBody);
  console.log('Dry run completed. No files modified.');
  process.exit(0);
}

// 8. Apply updates to files
packageJson.version = nextVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log(`✅ Updated package.json to v${nextVersion}`);

execSync('node scripts/sync-version.js', { stdio: 'inherit' });

if (fs.existsSync(changelogPath)) {
  const oldChangelog = fs.readFileSync(changelogPath, 'utf8');
  const headerEndIndex = oldChangelog.indexOf('## [');
  let newChangelog = '';
  if (headerEndIndex !== -1) {
    newChangelog =
      oldChangelog.slice(0, headerEndIndex) + changelogSection + oldChangelog.slice(headerEndIndex);
  } else {
    newChangelog = oldChangelog + '\n\n' + changelogSection;
  }
  fs.writeFileSync(changelogPath, newChangelog, 'utf8');
  console.log(`✅ Updated CHANGELOG.md for v${nextVersion}`);
}

execSync('node scripts/build-changelog.js', { stdio: 'inherit' });

const prBodyPath = path.join(rootDir, 'release-pr-body.md');
fs.writeFileSync(prBodyPath, prBody, 'utf8');
console.log(`✅ Generated release-pr-body.md for PR creation.`);

console.log(`\n🎉 Release preparation for v${nextVersion} complete!`);
