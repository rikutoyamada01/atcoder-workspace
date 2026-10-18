const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

const rootDir = path.resolve(__dirname, '..');
const pagesDir = path.join(rootDir, 'pages');
const baseUrl = 'https://rikutoyamada01.github.io/atcoder-workspace';
const shouldWrite = process.argv.includes('--write');

function getHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir);
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      getHtmlFiles(fullPath, fileList);
    } else if (entry.endsWith('.html') && !/^google[a-z0-9]+\.html$/i.test(entry)) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

function httpsPostJson(urlString, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const payload = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Length': Buffer.byteLength(payload),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function base64UrlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function runLocalOAuthFlow() {
  const authIdx = process.argv.indexOf('--auth');
  const clientId = (process.argv[authIdx + 1] || process.env.CWS_CLIENT_ID || '').trim();
  const clientSecret = (process.argv[authIdx + 2] || process.env.CWS_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    console.error('❌ Usage: node scripts/seo-pdca-audit.js --auth <CLIENT_ID> <CLIENT_SECRET>');
    process.exit(1);
  }

  const port = 8888;
  const redirectUri = `http://localhost:${port}`;
  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  console.log('\n============================================================');
  console.log('🔐 Google Search Console OAuth 2.0 Setup (No Service Account Key Needed)');
  console.log('============================================================\n');
  console.log(
    '1. 以下の URL をブラウザで開いて、Search Console の Google アカウントで許可してください:\n'
  );
  console.log(authUrl);
  console.log('\n⏳ ブラウザでの認可完了を http://localhost:8888 で待機しています...\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url, redirectUri);
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Authorization failed: ${error}`);
          server.close();
          reject(new Error(`OAuth authorization error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Waiting for OAuth code...');
          return;
        }

        const tokenBody = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }).toString();

        const tokenRes = await httpsPostJson(
          'https://oauth2.googleapis.com/token',
          { 'Content-Type': 'application/x-www-form-urlencoded' },
          tokenBody
        );

        if (!tokenRes.refresh_token) {
          throw new Error(`No refresh_token returned: ${JSON.stringify(tokenRes)}`);
        }

        const credPath = path.join(rootDir, '.gsc-credentials.json');
        fs.writeFileSync(
          credPath,
          JSON.stringify(
            {
              type: 'authorized_user',
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: tokenRes.refresh_token,
            },
            null,
            2
          ) + '\n',
          'utf8'
        );

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<h2>✅ Google Search Console 連携完了！.gsc-credentials.json に自動保存しました。このタブは閉じて構いません。</h2>'
        );
        server.close();

        console.log('✅ .gsc-credentials.json にリフレッシュトークンを自動保存しました！\n');
        resolve();
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port);
  });
}

async function getAccessToken(creds) {
  // OAuth 2.0 User Refresh Token (recommended when iam.disableServiceAccountKeyCreation is enforced)
  if (creds.refresh_token && creds.client_id && creds.client_secret) {
    const tokenBody = new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    }).toString();
    const tokenRes = await httpsPostJson(
      'https://oauth2.googleapis.com/token',
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      tokenBody
    );
    return tokenRes.access_token;
  }

  // Fallback: Service Account JSON key
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = base64UrlEncode(signer.sign(creds.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const tokenBody = `grant_type=${encodeURIComponent(
    'urn:ietf:params:oauth:grant-type:jwt-bearer'
  )}&assertion=${encodeURIComponent(assertion)}`;
  const tokenRes = await httpsPostJson(
    'https://oauth2.googleapis.com/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    tokenBody
  );
  return tokenRes.access_token;
}

async function fetchGscMetrics() {
  const credPath = process.env.GSC_CREDENTIALS_PATH || path.join(rootDir, '.gsc-credentials.json');
  if (!fs.existsSync(credPath)) {
    console.log(
      'ℹ️  [GSC] No .gsc-credentials.json found. Run `node scripts/seo-pdca-audit.js --auth <CLIENT_ID> <CLIENT_SECRET>` to authorize.'
    );
    return null;
  }

  try {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    const siteUrl = process.env.GSC_SITE_URL || `${baseUrl}/`;
    const accessToken = await getAccessToken(creds);

    const formatDate = (daysAgo) => {
      const d = new Date(Date.now() - daysAgo * 86400000);
      return d.toISOString().slice(0, 10);
    };

    const apiEndpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      siteUrl
    )}/searchAnalytics/query`;

    const recentData = await httpsPostJson(
      apiEndpoint,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      {
        startDate: formatDate(10),
        endDate: formatDate(3),
        dimensions: ['query', 'page'],
        rowLimit: 50,
      }
    );

    const rows = recentData.rows || [];
    console.log(`✅ [GSC] Retrieved ${rows.length} query/page rows for ${siteUrl}`);
    const lowCtrOpportunities = rows.filter((r) => r.impressions >= 20 && r.ctr < 0.03);
    const strikingDistance = rows.filter((r) => r.position >= 5 && r.position <= 20);

    if (lowCtrOpportunities.length > 0) {
      console.log('🎯 [GSC] High-Impression / Low-CTR Opportunities:');
      lowCtrOpportunities.slice(0, 5).forEach((r) => {
        console.log(
          `   - "${r.keys[0]}" (${r.keys[1]}): ${r.impressions} imp, ${(r.ctr * 100).toFixed(
            1
          )}% CTR, pos ${r.position.toFixed(1)}`
        );
      });
    }
    if (strikingDistance.length > 0) {
      console.log('📈 [GSC] Striking-Distance Queries (Pos 5-20):');
      strikingDistance.slice(0, 5).forEach((r) => {
        console.log(
          `   - "${r.keys[0]}" (${r.keys[1]}): pos ${r.position.toFixed(1)}, ${r.impressions} imp`
        );
      });
    }
    return { rows, lowCtrOpportunities, strikingDistance };
  } catch (err) {
    console.warn(`⚠️  [GSC] Failed to query Search Console API: ${err.message}`);
    return null;
  }
}

function extractMeta(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function auditPages() {
  const htmlFiles = getHtmlFiles(pagesDir);
  const pageReports = [];
  let warningCount = 0;

  htmlFiles.forEach((filePath) => {
    const relFromPages = path.relative(pagesDir, filePath).replace(/\\/g, '/');
    const html = fs.readFileSync(filePath, 'utf8');
    const isRedirect = /http-equiv=["']refresh["']/i.test(html);
    const title = extractMeta(html, /<title>([^<]+)<\/title>/i);
    const description =
      extractMeta(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      extractMeta(html, /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    const canonical = extractMeta(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const ogTitle = extractMeta(
      html,
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
    );
    const ogImage = extractMeta(
      html,
      /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i
    );
    const jsonLdMatches = [
      ...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ];

    const issues = [];
    if (isRedirect) {
      issues.push('Uses meta refresh redirect (weak for SEO/AEO)');
    } else {
      if (!title) issues.push('Missing <title>');
      if (!description) issues.push('Missing <meta name="description">');
      if (!canonical) issues.push('Missing <link rel="canonical">');
      if (!ogTitle) issues.push('Missing og:title');
      if (!ogImage) issues.push('Missing og:image');
      if (jsonLdMatches.length === 0) {
        issues.push('Missing JSON-LD structured data (<script type="application/ld+json">)');
      } else {
        jsonLdMatches.forEach((m, idx) => {
          try {
            JSON.parse(m[1]);
          } catch (e) {
            issues.push(`Invalid JSON-LD block #${idx + 1}: ${e.message}`);
          }
        });
      }
    }

    warningCount += issues.length;
    const stat = fs.statSync(filePath);
    pageReports.push({
      relFromPages,
      url: `${baseUrl}/${relFromPages}`,
      isRedirect,
      title: title || relFromPages,
      description: description || '',
      canonical,
      jsonLdCount: jsonLdMatches.length,
      lastmod: stat.mtime.toISOString().slice(0, 10),
      issues,
    });
  });

  console.log('\n📊 [SEO/AEO HTML Audit Summary]');
  pageReports.forEach((p) => {
    const status = p.issues.length === 0 ? '✅ OK' : `⚠️  ${p.issues.length} issue(s)`;
    console.log(` - pages/${p.relFromPages}: ${status}`);
    p.issues.forEach((iss) => console.log(`     • ${iss}`));
  });

  const requiredAssets = ['sitemap.xml', 'robots.txt', 'llms.txt'];
  requiredAssets.forEach((asset) => {
    const exists = fs.existsSync(path.join(pagesDir, asset));
    if (!exists) {
      warningCount++;
      console.log(` - pages/${asset}: ⚠️  Missing file`);
    } else {
      console.log(` - pages/${asset}: ✅ Present`);
    }
  });

  if (shouldWrite) {
    writeSeoAeoAssets(pageReports);
  }

  console.log(`\nTotal SEO/AEO warnings: ${warningCount}`);
  return { pageReports, warningCount };
}

function writeSeoAeoAssets(pageReports) {
  const publicPages = pageReports.filter((p) => !p.isRedirect);

  const sitemapEntries = publicPages
    .map(
      (p) => `  <url>
    <loc>${p.canonical || p.url}</loc>
    <lastmod>${p.lastmod}</lastmod>
  </url>`
    )
    .join('\n');
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</urlset>
`;
  fs.writeFileSync(path.join(pagesDir, 'sitemap.xml'), sitemapXml, 'utf8');
  console.log('✍️  Generated pages/sitemap.xml');

  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;
  fs.writeFileSync(path.join(pagesDir, 'robots.txt'), robotsTxt, 'utf8');
  console.log('✍️  Generated pages/robots.txt');

  const docLinks = publicPages
    .map((p) => `- [${p.title}](${p.canonical || p.url}): ${p.description}`)
    .join('\n');
  const llmsTxt = `# AtCoder Workspace (Competitive Programming Workspace)

> AtCoderの問題ページを、ブラウザ上の統合開発環境（オンラインIDE）に変える無料・オープンソース（MIT License）のGoogle Chrome拡張機能です。環境構築不要（GCCやVSCodeの設定不要）、サンプル入出力のコピペ不要（ワンクリック自動テスト・Diff比較）、画面やタブの移動不要で、問題を開いた瞬間からC++・Python・Rust・Java等のコーディングと提出を完結できます。生成AIによる自動解答生成機能を排除しているため、AtCoderの競技規約に完全準拠しています。

## 解決する課題と主な特徴

- **環境構築ゼロで即開始**: コンパイラ導入やローカルエディタ設定で挫折することなく、Chrome拡張機能を追加するだけでMonaco Editor（VSCode同等）による分割画面コーディングが可能。
- **ワンクリック自動サンプルテスト**: 問題ページ内のサンプル入力・出力例を自動抽出し、AtCoder公式カスタムテストAPIでバックグラウンド実行、AC/WA/TLE/REの判定とDiff表示を自動実行。
- **自動保存と復習ステータス管理**: キー入力停止1.5秒でローカル自動保存。さらに「自力AC」「解説AC」の個別ステータス記録・絞り込みによる復習管理に対応。

## ドキュメント・解説記事一覧

${docLinks}
`;
  fs.writeFileSync(path.join(pagesDir, 'llms.txt'), llmsTxt, 'utf8');
  console.log('✍️  Generated pages/llms.txt');
}

async function main() {
  if (process.argv.includes('--auth')) {
    await runLocalOAuthFlow();
  }
  console.log('🚀 Running AtCoder Workspace SEO & AEO PDCA Audit...\n');
  await fetchGscMetrics();
  auditPages();
}

main();
