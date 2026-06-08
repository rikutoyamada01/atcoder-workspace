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

  test('Submission POST parameters validation', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="my-csrf" />';
    
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('/contests/abc100/submissions/99999')
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchArgs = global.fetch.mock.calls[0];
    expect(fetchArgs[0]).toBe('/contests/abc100/submit');
    expect(fetchArgs[1].method).toBe('POST');
    
    // Check parameters
    const bodyParams = fetchArgs[1].body;
    expect(bodyParams.get('csrf_token')).toBe('my-csrf');
    expect(bodyParams.get('data.TaskScreenName')).toBe('abc100_a');
    expect(bodyParams.get('data.LanguageId')).toBe('python');
    expect(bodyParams.get('sourceCode')).toBe('print(1)');

    expect(callback).toHaveBeenCalledWith({
      submissionId: '99999',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false
    });
  });

  test('Polling loop progress and completion parsing', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="my-csrf" />';

    // 1st fetch: POST submission
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('/contests/abc100/submissions/777')
    });

    // 2nd fetch: polling 1 (WJ status in table row)
    const tableHTML_WJ = `
      <table>
        <thead>
          <tr>
            <th>提出時間</th>
            <th>問題</th>
            <th>ユーザ</th>
            <th>言語</th>
            <th>結果</th>
            <th>実行時間</th>
            <th>メモリ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2026-06-08</td>
            <td>A</td>
            <td>user</td>
            <td><a href="/contests/abc100/submissions/777">Python</a></td>
            <td><span class="label label-warning">WJ</span></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(tableHTML_WJ)
    });

    // 3rd fetch: polling 2 (1/15 progress status in table row)
    const tableHTML_Progress = `
      <table>
        <thead>
          <tr>
            <th>提出時間</th>
            <th>問題</th>
            <th>ユーザ</th>
            <th>言語</th>
            <th>結果</th>
            <th>実行時間</th>
            <th>メモリ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2026-06-08</td>
            <td>A</td>
            <td>user</td>
            <td><a href="/contests/abc100/submissions/777">Python</a></td>
            <td><span class="label label-warning">1/15</span></td>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(tableHTML_Progress)
    });

    // 4th fetch: polling 3 (AC final status in table row)
    const tableHTML_AC = `
      <table>
        <thead>
          <tr>
            <th>提出時間</th>
            <th>問題</th>
            <th>ユーザ</th>
            <th>言語</th>
            <th>結果</th>
            <th>実行時間</th>
            <th>メモリ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2026-06-08</td>
            <td>A</td>
            <td>user</td>
            <td><a href="/contests/abc100/submissions/777">Python</a></td>
            <td><span class="label label-success">AC</span></td>
            <td>10 ms</td>
            <td>1024 KB</td>
          </tr>
        </tbody>
      </table>
    `;
    global.fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(tableHTML_AC)
    });

    const callback = jest.fn();
    submitter.submit('abc100', 'abc100_a', 'python', 'print(1)', callback);

    await flushPromises();

    // After post submit:
    expect(callback).toHaveBeenCalledWith({
      submissionId: '777',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false
    });

    // Advance 2s to trigger 1st poll
    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(callback).toHaveBeenLastCalledWith({
      submissionId: '777',
      status: 'WJ',
      time: '',
      memory: '',
      isComplete: false
    });

    // Advance 2s to trigger 2nd poll
    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(callback).toHaveBeenLastCalledWith({
      submissionId: '777',
      status: '1/15',
      time: '',
      memory: '',
      isComplete: false
    });

    // Advance 2s to trigger 3rd poll
    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(callback).toHaveBeenLastCalledWith({
      submissionId: '777',
      status: 'AC',
      time: '10 ms',
      memory: '1024 KB',
      isComplete: true
    });
  });
});
