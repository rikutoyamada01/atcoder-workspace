/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const submitterCode = fs.readFileSync(
  path.resolve(__dirname, '../src/content/submitter.js'),
  'utf8'
);

describe('Submitter Module Tests', () => {
  let submitter;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.AtCoderWorkspace = {};

    const script = document.createElement('script');
    script.textContent = submitterCode;
    document.body.appendChild(script);

    submitter = window.AtCoderWorkspace.Submitter;
    global.fetch = jest.fn();
    jest.useFakeTimers({ legacyFakeTimers: true });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

  // ─── Helper: set up a mock native submit form in the DOM ───
  function setupNativeForm(opts = {}) {
    const csrf = opts.csrf || 'page-csrf-token';
    const turnstile = opts.turnstile; // undefined = no Turnstile input
    document.body.innerHTML = `
      <form action="/contests/abc100/submit">
        <input type="hidden" name="csrf_token" value="${csrf}" />
        <input type="hidden" name="data.TaskScreenName" value="abc100_a" />
        <select name="data.LanguageId"><option value="python">Python</option></select>
        <textarea name="sourceCode"></textarea>
        ${turnstile !== undefined ? `<input type="hidden" name="cf-turnstile-response" value="${turnstile}" />` : ''}
      </form>
    `;
  }

  // ─── Unit tests ───

  test('CSRF token extraction from input element', () => {
    document.body.innerHTML = '<input name="csrf_token" value="test-token" />';
    expect(submitter.getCsrfToken()).toBe('test-token');
  });

  test('CSRF token extraction from window context', () => {
    window.csrfToken = 'window-token';
    expect(submitter.getCsrfToken()).toBe('window-token');
    delete window.csrfToken;
  });

  test('Submission ID parsing from list HTML', () => {
    const html = `
      <div>
        <a href="/contests/abc100/submissions/123456">Details</a>
      </div>
    `;
    expect(submitter.parseSubmissionId(html, 'abc100')).toBe('123456');
  });

  test('Submission ID parsing with case mismatch and prefix fallback', () => {
    expect(submitter.parseSubmissionId('href="/contests/abc100/submissions/12345"', 'ABC100')).toBe(
      '12345'
    );
    expect(
      submitter.parseSubmissionId('href="https://atcoder.jp/submissions/67890"', 'abc100')
    ).toBe('67890');
    expect(submitter.parseSubmissionId('href="/submissions/54321"', 'abc100')).toBe('54321');
  });

  test('Extracting validation error message from HTML', () => {
    const errorHTML = `
      <div class="alert alert-danger">
        <button type="button" class="close">×</button>
        ソースコードが短すぎます。
      </div>
    `;
    expect(submitter.extractErrorMessage(errorHTML)).toBe('ソースコードが短すぎます。');

    const formErrorHTML = `
      <div class="has-error">
        <span class="help-block">言語を選択してください。</span>
      </div>
    `;
    expect(submitter.extractErrorMessage(formErrorHTML)).toBe('言語を選択してください。');
    expect(submitter.extractErrorMessage('<div>No errors</div>')).toBeNull();
  });

  test('waitForTurnstile resolves immediately when no input', async () => {
    const result = submitter.waitForTurnstile(null);
    await expect(result).resolves.toBeUndefined();
  });

  test('waitForTurnstile resolves immediately when token already present', async () => {
    const input = document.createElement('input');
    input.value = 'a-valid-turnstile-token-string-that-is-longer-than-20-chars';
    const result = submitter.waitForTurnstile(input);
    await expect(result).resolves.toBeUndefined();
  });

  // ─── Native form submission tests ───

  test('Submits using native form with all fields (including Turnstile)', async () => {
    setupNativeForm({ turnstile: 'valid-turnstile-token-from-widget-longer-than-20' });

    global.fetch = jest.fn((_url, _options) => {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('/contests/abc100/submissions/99999'),
      });
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises(); // waitForTurnstile resolves immediately
    await flushPromises(); // POST

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const postArgs = global.fetch.mock.calls[0];
    expect(postArgs[0]).toBe('/contests/abc100/submit');
    expect(postArgs[1].method).toBe('POST');

    // Check FormData contents
    const body = postArgs[1].body;
    expect(body.get('csrf_token')).toBe('page-csrf-token');
    expect(body.get('data.TaskScreenName')).toBe('abc100_a');
    expect(body.get('data.LanguageId')).toBe('python');
    expect(body.get('sourceCode')).toBe('print(1)');
    expect(body.get('cf-turnstile-response')).toBe(
      'valid-turnstile-token-from-widget-longer-than-20'
    );

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: '99999',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false,
    }));
  });

  test('Submits using native form without Turnstile field', async () => {
    setupNativeForm({ turnstile: undefined }); // No Turnstile on page

    global.fetch = jest.fn(() => {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('/contests/abc100/submissions/88888'),
      });
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises();
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = global.fetch.mock.calls[0][1].body;
    expect(body.get('csrf_token')).toBe('page-csrf-token');
    expect(body.get('sourceCode')).toBe('print(1)');
    expect(body.has('cf-turnstile-response')).toBe(false);

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: '88888',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false,
    }));
  });

  test('Falls back to manual POST when no native form exists', async () => {
    // No form in DOM
    document.body.innerHTML = '';

    global.fetch = jest.fn((url, options) => {
      // GET: return CSRF token page
      if (!options || !options.method) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              '<html><body><input name="csrf_token" value="fresh-csrf" /></body></html>'
            ),
        });
      }
      // POST
      if (options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('/contests/abc100/submissions/77777'),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises(); // fetchFreshCsrfToken
    await flushPromises(); // POST

    expect(global.fetch).toHaveBeenCalledTimes(2);
    // Manual POST uses URLSearchParams
    const postArgs = global.fetch.mock.calls[1];
    expect(postArgs[1].body.get('csrf_token')).toBe('fresh-csrf');
    expect(postArgs[1].body.get('sourceCode')).toBe('print(1)');

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: '77777',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false,
    }));
  });

  // ─── Polling tests ───

  test('Polling loop progress and completion parsing', async () => {
    setupNativeForm({ turnstile: 'valid-turnstile-token-longer-than-twenty-chars-here' });

    const tableHTML_WJ = `
      <table>
        <thead><tr><th>提出時間</th><th>問題</th><th>ユーザ</th><th>言語</th><th>結果</th><th>実行時間</th><th>メモリ</th></tr></thead>
        <tbody><tr>
          <td>2026-06-08</td><td>A</td><td>user</td>
          <td><a href="/contests/abc100/submissions/777">Python</a></td>
          <td><span class="label label-warning">WJ</span></td><td></td><td></td>
        </tr></tbody>
      </table>
    `;
    const tableHTML_Progress = `
      <table>
        <thead><tr><th>提出時間</th><th>問題</th><th>ユーザ</th><th>言語</th><th>結果</th><th>実行時間</th><th>メモリ</th></tr></thead>
        <tbody><tr>
          <td>2026-06-08</td><td>A</td><td>user</td>
          <td><a href="/contests/abc100/submissions/777">Python</a></td>
          <td><span class="label label-warning">1/15</span></td><td></td><td></td>
        </tr></tbody>
      </table>
    `;
    const tableHTML_AC = `
      <table>
        <thead><tr><th>提出時間</th><th>問題</th><th>ユーザ</th><th>言語</th><th>結果</th><th>実行時間</th><th>メモリ</th></tr></thead>
        <tbody><tr>
          <td>2026-06-08</td><td>A</td><td>user</td>
          <td><a href="/contests/abc100/submissions/777">Python</a></td>
          <td><span class="label label-success">AC</span></td><td>10 ms</td><td>1024 KB</td>
        </tr></tbody>
      </table>
    `;

    let pollCount = 0;
    global.fetch = jest.fn((url, options) => {
      // POST submission
      if (options && options.method === 'POST') {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('/contests/abc100/submissions/777'),
        });
      }
      // GET polling
      if (url.includes('/submissions/me')) {
        pollCount++;
        const htmls = [tableHTML_WJ, tableHTML_Progress, tableHTML_AC];
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(htmls[pollCount - 1]),
        });
      }
      return Promise.resolve({ ok: true, text: () => Promise.resolve('') });
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises(); // Turnstile (immediate) + POST
    await flushPromises();

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({
      submissionId: '777',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false,
    }));

    // Poll 1: WJ
    jest.advanceTimersByTime(2000);
    await flushPromises();
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({
      submissionId: '777',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false,
    }));

    // Poll 2: 1/15
    jest.advanceTimersByTime(2000);
    await flushPromises();
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({
      submissionId: '777',
      status: '1/15',
      time: '',
      memory: '',
      isComplete: false,
    }));

    // Poll 3: AC
    jest.advanceTimersByTime(2000);
    await flushPromises();
    expect(callback).toHaveBeenLastCalledWith(expect.objectContaining({
      submissionId: '777',
      status: 'AC',
      time: '10 ms',
      memory: '1024 KB',
      isComplete: true,
    }));
  });

  // ─── Error handling tests ───

  test('Submit reports error on login redirect (manual fallback)', async () => {
    // No form → triggers manual fallback → fetchFreshCsrfToken detects login page
    document.body.innerHTML = '';
    global.fetch = jest.fn(() => {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('Please Login to AtCoder /login ログインしてください。'),
      });
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises();

    expect(callback).toHaveBeenCalledWith({
      error: 'AtCoderにログインしていません。提出するには AtCoder のサイトでログインしてください。',
    });
  });

  test('Submit reports validation error from alert-danger', async () => {
    setupNativeForm({ turnstile: 'valid-turnstile-token-longer-than-twenty-chars' });

    global.fetch = jest.fn(() => {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(`
          <div class="alert alert-danger">
            前回の提出から30秒間は提出できません。
          </div>
        `),
      });
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises();
    await flushPromises();

    expect(callback).toHaveBeenCalledWith({
      error:
        '前回の提出から30秒間は提出できません。前回の提出完了から30秒以上経過するまでお待ちください。',
    });
  });
});
