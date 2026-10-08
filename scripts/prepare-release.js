/**
 * Automated Release Preparation Script
 *
 * Extracts release changes and linked issues strictly from Pull Requests merged into develop:
 * 1. Determines merge base between master and develop/HEAD to identify new merge commits.
 * 2. Fetches merged Pull Requests via GitHub CLI or git merge logs.
 * 3. Strictly parses "Ref: #XX" or "Related: #XX" to avoid accidental issue closures.
 * 4. Categorizes changes into Added / Fixed / Changed.
 * 5. Updates package.json, manifest.json, cache-busters, and CHANGELOG.md.
 * 6. Generates release-pr-body.md with "Closes #XX" statements for master release PR.
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

// Helper to run commands strictly within rootDir
function run(cmd, options = {}) {
  return execSync(cmd, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.silent ? ['pipe', 'pipe', 'ignore'] : ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

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
  console.error(`❌ Invalid version or release type: ${typeOrVersion}`);
  console.error('Usage: node scripts/prepare-release.js [patch|minor|major|X.Y.Z]');
  process.exit(1);
}

console.log(`🚀 Preparing release: v${currentVersion} -> v${nextVersion}`);

// 3. Determine git merge-base between master and HEAD/develop
let mergeBase = null;
try {
  mergeBase = run('git merge-base origin/master HEAD', { silent: true });
} catch (e) {
  try {
    mergeBase = run('git merge-base master HEAD', { silent: true });
  } catch (err) {
    console.warn('⚠️ Could not determine merge-base with master. Falling back to HEAD~30.');
  }
}

// 4. Identify merged PR numbers from git merge commits since merge-base
const mergedPRNumbersInGit = new Set();
try {
  const gitLogRange = mergeBase ? `${mergeBase}..HEAD` : 'HEAD~30..HEAD';
  const mergeLog = run(`git log ${gitLogRange} --merges --oneline`, { silent: true });
  if (mergeLog) {
    const lines = mergeLog.split('\n');
    lines.forEach((line) => {
      // Matches standard GitHub merge commit: "Merge pull request #123 from ..." or "... (#123)"
      const prMatch = line.match(/Merge pull request #(\d+)/i) || line.match(/\(#(\d+)\)$/);
      if (prMatch) {
        mergedPRNumbersInGit.add(Number(prMatch[1]));
      }
    });
  }
} catch (e) {
  console.warn('⚠️ Could not extract merge commits from git log.');
}

// 5. Fetch merged PRs from GitHub via gh CLI
let mergedPRs = [];
let ghSuccess = false;
try {
  // Query up to 100 merged PRs
  const ghOutput = run(
    'gh pr list --state merged --base develop --limit 100 --json number,title,body,mergedAt',
    { silent: true }
  );
  const allMerged = JSON.parse(ghOutput);
  ghSuccess = true;

  if (mergedPRNumbersInGit.size > 0) {
    // Strictly filter to PRs that are actually merged in this branch's history
    mergedPRs = allMerged.filter((pr) => mergedPRNumbersInGit.has(pr.number));
  } else {
    // If no git merge commits found (e.g., shallow clone), use PRs merged recently
    mergedPRs = allMerged.slice(0, 30);
  }
} catch (e) {
  console.warn('⚠️ gh CLI query failed or unavailable.');
}

// Fallback: If gh CLI failed but we have PR numbers from git log
if (!ghSuccess && mergedPRNumbersInGit.size > 0) {
  mergedPRNumbersInGit.forEach((num) => {
    mergedPRs.push({
      number: num,
      title: `Pull Request #${num}`,
      body: '',
    });
  });
}

// 6. Preview fallback for dry-run if no merged PRs exist yet
if (mergedPRs.length === 0) {
  if (isDryRun) {
    console.log('ℹ️ No merged PRs found yet. Gathering unmerged commits for dry-run preview...');
    try {
      const gitLogRange = mergeBase ? `${mergeBase}..HEAD` : 'HEAD~10..HEAD';
      const commitLog = run(`git log ${gitLogRange} --no-merges --oneline`, { silent: true });
      if (commitLog) {
        commitLog.split('\n').forEach((line) => {
          const parts = line.split(' ');
          const hash = parts[0];
          const message = parts.slice(1).join(' ').trim();
          mergedPRs.push({
            number: hash,
            title: message,
            body: '',
            isCommit: true,
          });
        });
      }
    } catch (e) {
      // ignore git log failure in dry-run preview
    }
  } else {
    console.error('❌ No merged Pull Requests found since last release on master.');
    console.error(
      '   Aborting release preparation. Ensure PRs are merged into develop before preparing release.'
    );
    process.exit(1);
  }
}

console.log(`📋 Found ${mergedPRs.length} item(s) to process.`);

// 7. Categorize changes and extract issues strictly
const added = [];
const fixed = [];
const changed = [];
const other = [];
const issueNumbers = new Set();

// Strict regex matching:
// - Body: line must start with optional bullet and strictly "Ref: #XX", "Refs: #XX", or "Related: #XX"
const strictRefRegex = /(?:^|\n)\s*[-*]?\s*(?:Ref|Refs|Related):\s*#(\d+)\b/gi;
// - Title: match #XX but avoid repository prefixes like "owner/repo#XX"
const strictTitleIssueRegex = /(?:^|[^\w/])#(\d+)\b/g;

mergedPRs.forEach((item) => {
  const title = item.title || '';
  const body = item.body || '';

  // Extract issues from body
  let refMatch;
  while ((refMatch = strictRefRegex.exec(body)) !== null) {
    issueNumbers.add(refMatch[1]);
  }

  // Extract issues from title (excluding other/repo#XX)
  let titleMatch;
  while ((titleMatch = strictTitleIssueRegex.exec(title)) !== null) {
    issueNumbers.add(titleMatch[1]);
  }

  // Formatting display line
  const displayLine = item.isCommit
    ? `- ${title} (${item.number})`
    : `- ${title} ([#${item.number}](https://github.com/rikutoyamada01/atcoder-workspace/pull/${item.number}))`;

  const lower = title.toLowerCase();
  if (lower.startsWith('feat:') || lower.startsWith('feat(') || body.includes('- [x] 🚀 新機能')) {
    added.push(displayLine);
  } else if (
    lower.startsWith('fix:') ||
    lower.startsWith('fix(') ||
    body.includes('- [x] 🐛 不具合修正')
  ) {
    fixed.push(displayLine);
  } else if (
    lower.startsWith('docs:') ||
    lower.startsWith('chore:') ||
    lower.startsWith('refactor:') ||
    body.includes('- [x] 📚 ドキュメント') ||
    body.includes('- [x] ⚙️')
  ) {
    changed.push(displayLine);
  } else {
    other.push(displayLine);
  }
});

const sortedIssues = Array.from(issueNumbers).sort((a, b) => Number(a) - Number(b));
console.log(
  `🔗 Extracted target issues for auto-close: ${sortedIssues.map((n) => '#' + n).join(', ') || 'none'}`
);

// 8. Generate Changelog entry
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

// 9. Generate PR Body
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

// 10. Apply updates to files
packageJson.version = nextVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log(`✅ Updated package.json to v${nextVersion}`);

const nodeBin = process.execPath;
run(`"${nodeBin}" "${path.join(rootDir, 'scripts', 'sync-version.js')}"`);

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

run(`"${nodeBin}" "${path.join(rootDir, 'scripts', 'build-changelog.js')}"`);

const prBodyPath = path.join(rootDir, 'release-pr-body.md');
fs.writeFileSync(prBodyPath, prBody, 'utf8');
console.log(`✅ Generated release-pr-body.md for PR creation.`);

console.log(`\n🎉 Release preparation for v${nextVersion} complete!`);
