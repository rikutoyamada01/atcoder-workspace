/**
 * Chrome Web Store API v2 - Package Upload Script (Upload Only / Draft)
 *
 * Uploads the built release ZIP (`dist/atcoder-workspace-vX.Y.Z.zip`) to the
 * Chrome Web Store Developer Console using the official Google Chrome Web Store API v2.
 *
 * NOTE: This script intentionally performs ONLY `upload` (and `fetchStatus` polling).
 * It does NOT call `:publish`, allowing manual store listing updates and smoke testing
 * before submitting for review in the Developer Console.
 *
 * Required Environment Variables:
 *   - CWS_PUBLISHER_ID  : Publisher ID from Chrome Web Store Developer Console -> Account
 *   - CWS_EXTENSION_ID  : 32-character Extension ID from Chrome Web Store
 *   - CWS_CLIENT_ID     : OAuth 2.0 Client ID from Google Cloud Console
 *   - CWS_CLIENT_SECRET : OAuth 2.0 Client Secret from Google Cloud Console
 *   - CWS_REFRESH_TOKEN : OAuth 2.0 Refresh Token (scope: https://www.googleapis.com/auth/chromewebstore)
 *
 * Usage:
 *   node scripts/upload-webstore.js [--if-configured] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

const zipFileName = `atcoder-workspace-v${version}.zip`;
const zipFilePath = path.join(rootDir, 'dist', zipFileName);

const isIfConfigured = process.argv.includes('--if-configured');
const isDryRun = process.argv.includes('--dry-run');

const REQUIRED_ENV_KEYS = [
  'CWS_PUBLISHER_ID',
  'CWS_EXTENSION_ID',
  'CWS_CLIENT_ID',
  'CWS_CLIENT_SECRET',
  'CWS_REFRESH_TOKEN',
];

function checkEnvConfiguration() {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key] || !process.env[key].trim());
  return {
    isConfigured: missing.length === 0,
    missing,
  };
}

function httpsRequest(options, bodyBuffer = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = rawBody ? JSON.parse(rawBody) : {};
        } catch (e) {
          parsed = { raw: rawBody };
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

async function fetchAccessToken(clientId, clientSecret, refreshToken) {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const payload = Buffer.from(params.toString(), 'utf8');

  const res = await httpsRequest(
    {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': payload.length,
      },
    },
    payload
  );

  if (res.statusCode !== 200 || !res.body.access_token) {
    const errMsg = res.body.error_description || res.body.error || JSON.stringify(res.body);
    throw new Error(`Failed to obtain OAuth2 access token (HTTP ${res.statusCode}): ${errMsg}`);
  }

  return res.body.access_token;
}

async function uploadPackage(accessToken, publisherId, extensionId, zipBuffer) {
  const uploadPath = `/upload/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}:upload`;

  const res = await httpsRequest(
    {
      hostname: 'chromewebstore.googleapis.com',
      path: uploadPath,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Type': 'application/zip',
        'Content-Length': zipBuffer.length,
      },
    },
    zipBuffer
  );

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `Chrome Web Store API upload failed (HTTP ${res.statusCode}): ${JSON.stringify(res.body)}`
    );
  }

  return res.body;
}

async function fetchItemStatus(accessToken, publisherId, extensionId) {
  const statusPath = `/v2/publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}:fetchStatus`;

  const res = await httpsRequest({
    hostname: 'chromewebstore.googleapis.com',
    path: statusPath,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-goog-api-version': '2',
    },
  });

  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `Chrome Web Store API fetchStatus failed (HTTP ${res.statusCode}): ${JSON.stringify(res.body)}`
    );
  }

  return res.body;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLocalAuthFlow() {
  const http = require('http');
  const authIdx = process.argv.indexOf('--auth');
  const clientId = (process.argv[authIdx + 1] || process.env.CWS_CLIENT_ID || '').trim();
  const clientSecret = (process.argv[authIdx + 2] || process.env.CWS_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    console.error('❌ Usage: node scripts/upload-webstore.js --auth <CLIENT_ID> <CLIENT_SECRET>');
    process.exit(1);
  }

  const port = 8888;
  const redirectUri = `http://localhost:${port}`;
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/chromewebstore',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  console.log('\n============================================================');
  console.log('🔐 Chrome Web Store OAuth 2.0 Refresh Token Generator');
  console.log('============================================================\n');
  console.log('1. 以下の URL をブラウザで開いて Google アカウントで許可してください:\n');
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

        const params = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        });
        const payload = Buffer.from(params.toString(), 'utf8');

        const tokenRes = await httpsRequest(
          {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': payload.length,
            },
          },
          payload
        );

        if (tokenRes.statusCode !== 200 || !tokenRes.body.refresh_token) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Failed to get refresh_token: ${JSON.stringify(tokenRes.body)}`);
          server.close();
          reject(
            new Error(
              `Token exchange failed (HTTP ${tokenRes.statusCode}): ${JSON.stringify(tokenRes.body)}`
            )
          );
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          '<h2>✅ 認証成功！ターミナルに戻って CWS_REFRESH_TOKEN をコピーしてください。このタブは閉じて構いません。</h2>'
        );
        server.close();

        console.log(
          '✅ 認可に成功しました！以下の値を GitHub Secrets の CWS_REFRESH_TOKEN に登録してください:\n'
        );
        console.log('------------------------------------------------------------');
        console.log(`CWS_REFRESH_TOKEN=${tokenRes.body.refresh_token}`);
        console.log('------------------------------------------------------------\n');
        resolve();
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port);
  });
}

async function main() {
  if (process.argv.includes('--auth')) {
    await runLocalAuthFlow();
    return;
  }

  console.log(`📦 Target package: dist/${zipFileName} (v${version})`);

  if (!fs.existsSync(zipFilePath)) {
    console.error(`❌ Release ZIP not found at: ${zipFilePath}`);
    console.error('💡 Run "npm run build" first to generate the release ZIP.');
    process.exit(1);
  }

  const { isConfigured, missing } = checkEnvConfiguration();

  if (isDryRun) {
    console.log('🔍 [DRY-RUN] Validating package and Chrome Web Store API v2 parameters...');
    const stats = fs.statSync(zipFilePath);
    console.log(`✅ Found ZIP file (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(
      `ℹ️ Configured credentials: ${isConfigured ? 'All present' : `Missing (${missing.join(', ')})`}`
    );
    console.log('Dry run completed. No network requests sent.');
    return;
  }

  if (!isConfigured) {
    if (isIfConfigured) {
      console.log(
        `ℹ️ Skipping Chrome Web Store upload: missing environment variable(s): ${missing.join(', ')}`
      );
      console.log(
        '   Configure these variables in GitHub Actions Secrets to enable automatic CWS draft uploads.'
      );
      return;
    }
    console.error(
      `❌ Missing required Chrome Web Store API environment variable(s): ${missing.join(', ')}`
    );
    process.exit(1);
  }

  const publisherId = process.env.CWS_PUBLISHER_ID.trim();
  const extensionId = process.env.CWS_EXTENSION_ID.trim();
  const clientId = process.env.CWS_CLIENT_ID.trim();
  const clientSecret = process.env.CWS_CLIENT_SECRET.trim();
  const refreshToken = process.env.CWS_REFRESH_TOKEN.trim();

  console.log('🔐 Requesting OAuth 2.0 access token from Google...');
  const accessToken = await fetchAccessToken(clientId, clientSecret, refreshToken);

  const zipBuffer = fs.readFileSync(zipFilePath);
  console.log(
    `🚀 Uploading ${zipFileName} (${(zipBuffer.length / 1024).toFixed(2)} KB) to Chrome Web Store API v2...`
  );
  const uploadResult = await uploadPackage(accessToken, publisherId, extensionId, zipBuffer);

  let uploadState = uploadResult.uploadState;
  console.log(`📡 Initial upload state: ${uploadState || 'UNKNOWN'}`);

  // Poll fetchStatus if upload is processed asynchronously
  const maxAttempts = 12;
  let attempt = 0;
  while (uploadState === 'IN_PROGRESS' && attempt < maxAttempts) {
    attempt++;
    console.log(
      `⏳ Upload is IN_PROGRESS. Polling fetchStatus (attempt ${attempt}/${maxAttempts})...`
    );
    await sleep(5000);
    const statusResult = await fetchItemStatus(accessToken, publisherId, extensionId);
    uploadState = statusResult.lastAsyncUploadState;
    console.log(`📡 Current async upload state: ${uploadState || 'UNKNOWN'}`);
  }

  if (uploadState !== 'SUCCEEDED') {
    throw new Error(
      `Chrome Web Store package upload did not succeed. Final state: ${uploadState} (${JSON.stringify(uploadResult)})`
    );
  }

  console.log(`\n🎉 Successfully uploaded ${zipFileName} to Chrome Web Store (saved as draft)!`);
  console.log(
    '👉 Next step: Open Chrome Web Store Developer Console, update listing text if needed, and click "Submit for review".'
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Chrome Web Store upload error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  checkEnvConfiguration,
  fetchAccessToken,
  uploadPackage,
  fetchItemStatus,
  runLocalAuthFlow,
};
