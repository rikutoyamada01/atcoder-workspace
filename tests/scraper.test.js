/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const scraperCode = fs.readFileSync(path.resolve(__dirname, '../src/content/scraper.js'), 'utf8');

describe('Scraper Module Tests', () => {
  beforeEach(() => {
    // Reset DOM and reload the scraper script into jsdom context
    document.body.innerHTML = '';
    window.AtCoderWorkspace = {};

    const script = document.createElement('script');
    script.textContent = scraperCode;
    document.body.appendChild(script);
  });

  test('extractSampleCases extracts valid samples in Japanese text', () => {
    document.body.innerHTML = `
      <div id="task-statement">
        <span class="lang-ja">
          <h3>入力例 1</h3>
          <pre>3\n1 2 3</pre>
          <h3>出力例 1</h3>
          <pre>6</pre>
          <h3>入力例 2</h3>
          <pre>4\n1 2 3 4</pre>
          <h3>出力例 2</h3>
          <pre>10</pre>
        </span>
      </div>
    `;

    const scraper = window.AtCoderWorkspace.Scraper;
    expect(scraper).toBeDefined();

    const result = scraper.extractSampleCases();
    expect(result.error).toBeNull();
    expect(result.warning).toBeNull();
    expect(result.cases).toHaveLength(2);
    expect(result.cases[0]).toEqual({ input: '3\n1 2 3', expected: '6' });
    expect(result.cases[1]).toEqual({ input: '4\n1 2 3 4', expected: '10' });
  });

  test('extractSampleCases extracts English samples when Japanese not visible', () => {
    // Mock getComputedStyle for .lang-ja display: none
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (el) => {
      if (el.classList.contains('lang-ja')) {
        return { display: 'none' };
      }
      return { display: 'block' };
    };

    document.body.innerHTML = `
      <div id="task-statement">
        <span class="lang-ja" class="lang-ja">
          <h3>入力例 1</h3>
          <pre>3</pre>
        </span>
        <span class="lang-en">
          <h3>Sample Input 1</h3>
          <pre>10</pre>
          <h3>Sample Output 1</h3>
          <pre>20</pre>
        </span>
      </div>
    `;

    const scraper = window.AtCoderWorkspace.Scraper;
    const result = scraper.extractSampleCases();
    window.getComputedStyle = originalGetComputedStyle; // Restore

    expect(result.error).toBeNull();
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0]).toEqual({ input: '10', expected: '20' });
  });

  test('extractSampleCases warns when inputs and outputs count mismatch', () => {
    document.body.innerHTML = `
      <div id="task-statement">
        <h3>入力例 1</h3>
        <pre>3</pre>
        <h3>入力例 2</h3>
        <pre>4</pre>
        <h3>出力例 1</h3>
        <pre>6</pre>
      </div>
    `;

    const scraper = window.AtCoderWorkspace.Scraper;
    const result = scraper.extractSampleCases();
    expect(result.warning).toContain('入力例 (2件) と出力例 (1件) の数が一致しません。');
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0]).toEqual({ input: '3', expected: '6' });
  });

  test('extractSampleCases returns error when no samples found', () => {
    document.body.innerHTML = `
      <div id="task-statement">
        <p>サンプルはありません。</p>
      </div>
    `;

    const scraper = window.AtCoderWorkspace.Scraper;
    const result = scraper.extractSampleCases();
    expect(result.error).toBe('サンプルケースが見つかりませんでした。');
    expect(result.cases).toHaveLength(0);
  });

  test('extractSampleCases returns error when task-statement does not exist', () => {
    document.body.innerHTML = `<div>何もないページ</div>`;

    const scraper = window.AtCoderWorkspace.Scraper;
    const result = scraper.extractSampleCases();
    expect(result.error).toBe('問題文 (task-statement) がページ内に見つかりません。');
  });
});
