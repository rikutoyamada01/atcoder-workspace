/** @jest-environment jsdom */
const fs = require('fs');
const path = require('path');
const { auditPages, writeSeoAeoAssets } = require('../scripts/seo-pdca-audit');

const pagesDir = path.resolve(__dirname, '../pages');
const baseUrl = 'https://rikutoyamada01.github.io/atcoder-workspace/';
const publicPages = [
  'presentation.html',
  'article.html',
  'roadmap.html',
  'privacy.html',
  ...fs.readdirSync(path.join(pagesDir, 'article')).map((name) => `article/${name}`),
].filter((name) => name.endsWith('.html'));

function readPage(name) {
  return new DOMParser().parseFromString(
    fs.readFileSync(path.join(pagesDir, name), 'utf8'),
    'text/html'
  );
}

afterEach(() => jest.restoreAllMocks());

test.each(publicPages)('%s has crawlable links and deployed metadata assets', (name) => {
  const page = readPage(name);
  const pageUrl = new URL(name, baseUrl);
  expect(page.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(pageUrl.href);
  expect(page.querySelectorAll('nav a').length).toBeGreaterThan(4);
  expect(page.querySelectorAll('nav [aria-current="page"]').length).toBeLessThanOrEqual(1);
  expect(page.querySelectorAll('h1')).toHaveLength(1);

  const links = [...page.querySelectorAll('a[href], link[href], script[src]')].map(
    (node) => node.getAttribute('href') || node.getAttribute('src')
  );
  links.push(page.querySelector('meta[property="og:image"]').content);
  const targets = links
    .map((value) => new URL(value, pageUrl))
    .filter((url) => url.href.startsWith(baseUrl));
  targets.forEach((target) => {
    const file = path.join(
      pagesDir,
      decodeURIComponent(target.pathname.slice(new URL(baseUrl).pathname.length)) || 'index.html'
    );
    expect(fs.existsSync(file)).toBe(true);
  });
  targets
    .filter((target) => target.hash && target.pathname.endsWith('.html'))
    .forEach((target) => {
      const file = path.join(
        pagesDir,
        decodeURIComponent(target.pathname.slice(new URL(baseUrl).pathname.length))
      );
      const doc = new DOMParser().parseFromString(fs.readFileSync(file, 'utf8'), 'text/html');
      expect(doc.getElementById(decodeURIComponent(target.hash.slice(1)))).not.toBeNull();
    });

  const schemas = [...page.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => JSON.parse(script.textContent))
    .flatMap((schema) => schema['@graph'] || [schema]);
  schemas
    .filter((item) => item['@type'] === 'Article')
    .forEach((article) => {
      expect(article.headline).toBe(page.querySelector('h1').textContent.trim());
      expect(article.mainEntityOfPage).toBe(pageUrl.href);
      expect(article.dateModified).toBe(page.querySelector('time').getAttribute('datetime'));
    });
});

test('installation links point to the actual store and instructions', () => {
  const page = readPage('presentation.html');
  expect(page.querySelectorAll('a.install-button')).toHaveLength(2);
  page.querySelectorAll('a.install-button').forEach((link) => {
    expect(link.href).toContain(
      'chromewebstore.google.com/detail/atcoder-workspace/apoklhnhpoljcmnhcglejgjopfolhaeh'
    );
  });
  expect(page.querySelector('#getting-started a[href*="practice_1"]')).not.toBeNull();
  expect(page.querySelector('.faq-section').textContent).toContain('実行先はAtCoder');
});

test('local audit detects a missing deployed OGP image', () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  expect(auditPages().warningCount).toBe(0);
  const exists = fs.existsSync.bind(fs);
  jest
    .spyOn(fs, 'existsSync')
    .mockImplementation((file) =>
      String(file).endsWith(path.join('assets', 'icon128.png')) ? false : exists(file)
    );
  const result = auditPages();
  expect(
    result.pageReports.find((page) => page.relFromPages === 'presentation.html').issues
  ).toEqual(expect.arrayContaining([expect.stringContaining('Missing deployed resource')]));
});

test('generated sitemap excludes redirects and filesystem timestamps', () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const { pageReports } = auditPages();
  const write = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  writeSeoAeoAssets(pageReports);
  const sitemap = write.mock.calls.find(([file]) => file.endsWith('sitemap.xml'))[1];
  expect(sitemap.match(/<loc>/g)).toHaveLength(publicPages.length);
  expect(sitemap).not.toContain('index.html');
  expect(sitemap).not.toContain('<lastmod>');
});

function simulator() {
  const page = readPage('article/complexity.html');
  const code = page.querySelector('script:not([src]):not([type])').textContent;
  new Function('document', code)(page);
  page.dispatchEvent(new Event('DOMContentLoaded'));
  return page;
}

test('simulator gives estimates, handles both sides of the limit, and does not cap exponents at 60', () => {
  const page = simulator();
  const input = page.getElementById('inputN');
  const result = page.getElementById('resultStatus');
  expect(result.textContent).toContain('この仮定では2秒以内');
  page.querySelector('[data-type="ON2"]').click();
  expect(result.textContent).toContain('この仮定では2秒超');
  expect(result.textContent).not.toMatch(/AC|TLE/);
  input.value = '80';
  input.dispatchEvent(new Event('input'));
  page.querySelector('[data-type="O2N"]').click();
  expect(page.getElementById('resultDetail').textContent).toContain('1.21e+24');
  expect(result.textContent).toContain('実測が必要');
  input.value = '1024';
  input.dispatchEvent(new Event('input'));
  expect(page.getElementById('resultDetail').textContent).not.toMatch(/NaN|Infinity/);
});

test.each(['', '0', '-1', '1.5', '9007199254740992'])('simulator rejects invalid N=%s', (value) => {
  const page = simulator();
  page.getElementById('inputN').value = value;
  page.getElementById('inputN').dispatchEvent(new Event('input'));
  expect(page.getElementById('resultStatus').textContent).toContain('入力を確認');
});

test.each(['presentation.html', 'privacy.html', 'article/integerization-tips.html'])(
  'MathJax is only requested by pages marked for formulas: %s',
  (name) => {
    const page = readPage(name);
    const code = fs.readFileSync(path.join(pagesDir, 'components.js'), 'utf8');
    new Function('document', 'window', code)(page, {});
    page.dispatchEvent(new Event('DOMContentLoaded'));
    expect(Boolean(page.getElementById('MathJax-script'))).toBe(
      page.body.hasAttribute('data-math')
    );
  }
);
