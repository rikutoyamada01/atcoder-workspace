/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const runnerCode = fs.readFileSync(path.resolve(__dirname, '../src/content/runner.js'), 'utf8');

describe('Runner Module Tests', () => {
  let runner;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.AtCoderWorkspace = {};

    const script = document.createElement('script');
    script.textContent = runnerCode;
    document.body.appendChild(script);

    runner = window.AtCoderWorkspace.Runner;
    global.fetch = jest.fn();
    // Use legacy fake timers so promises/microtasks resolve normally
    jest.useFakeTimers({ legacyFakeTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Helper to flush promise microtasks
  const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

  test('ensureIdle calls onIdle immediately when custom test is completed', async () => {
    const mockResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          Result: { Status: 3 }, // 3 = Completed/Idle
        }),
    };
    global.fetch.mockResolvedValue(mockResponse);

    const onIdle = jest.fn();
    runner.ensureIdle('abc100', onIdle, Date.now());

    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test('ensureIdle waits and polls again when custom test is running', async () => {
    // 1st call: Status 1 (Compiling), 2nd call: Status 3 (Completed)
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      });

    const onIdle = jest.fn();
    runner.ensureIdle('abc100', onIdle, Date.now());

    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onIdle).not.toHaveBeenCalled();

    // Idle check interval is 1000ms.
    // Advance timer by 999ms: should not poll again.
    jest.advanceTimersByTime(999);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance timer by 1ms (total 1000ms): should trigger poll.
    jest.advanceTimersByTime(1);
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test('ensureIdle retries after delay on HTTP 429 response', async () => {
    // 1st call: HTTP 429, 2nd call: Status 3 (Completed)
    const mockHeaders = new Map([['Retry-After', '2']]);
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: mockHeaders,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      });

    const onIdle = jest.fn();
    runner.ensureIdle('abc100', onIdle, Date.now());

    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(onIdle).not.toHaveBeenCalled();

    // Retry delay based on Retry-After header is 2000ms.
    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  test('pollResult times out after 15 seconds with TLE', () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    const startTime = Date.now() - 16000; // Over 15s ago

    runner.pollResult('abc100', resolve, reject, startTime);

    expect(reject).toHaveBeenCalledWith(new Error('TLE: 実行制限時間を超過しました (15秒)'));
    expect(resolve).not.toHaveBeenCalled();
  });

  test('pollResult resolves on custom test completed', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          Result: {
            Status: 3,
            ExitCode: 0,
            TimeConsumption: 10,
            MemoryConsumption: 2048,
            Output: btoa('hello\n'),
            Error: btoa(''),
          },
        }),
    });

    const resolve = jest.fn();
    const reject = jest.fn();

    runner.pollResult('abc100', resolve, reject, Date.now());

    await flushPromises();

    expect(resolve).toHaveBeenCalledWith({
      Stdout: 'hello\n',
      Stderr: '',
      ExitCode: 0,
      TimeConsumption: 10,
      MemoryConsumption: 2048,
    });
    expect(reject).not.toHaveBeenCalled();
  });

  test('pollResult retries after delay on HTTP 429 response', async () => {
    // 1st call: HTTP 429, 2nd call: Completed
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              ExitCode: 0,
              TimeConsumption: 5,
              MemoryConsumption: 1024,
              Output: btoa('retried success\n'),
              Error: btoa(''),
            },
          }),
      });

    const resolve = jest.fn();
    const reject = jest.fn();

    runner.pollResult('abc100', resolve, reject, Date.now());

    await flushPromises();

    // 1st fetch failed with 429, should not reject yet
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();

    // Default 1st retry delay is 2000ms
    jest.advanceTimersByTime(2000);
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith({
      Stdout: 'retried success\n',
      Stderr: '',
      ExitCode: 0,
      TimeConsumption: 5,
      MemoryConsumption: 1024,
    });
  });

  test('runSampleTests reports error when CSRF token is missing', async () => {
    // Make sure AtCoder status is idle
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Result: { Status: 3 } }),
    });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'input1', expected: 'expected1' }];
    runner.runSampleTests('abc100', 'print(1)', 'python', samples, onCaseResult, onComplete);

    await flushPromises();

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'ERR',
      message: 'CSRFトークンが見つかりません。',
    });

    // Next case delay is 500ms.
    // Advance by 499ms: should not complete yet.
    jest.advanceTimersByTime(499);
    await flushPromises();
    expect(onComplete).not.toHaveBeenCalled();

    // Advance by 1ms (total 500ms): should complete.
    jest.advanceTimersByTime(1);
    await flushPromises();

    expect(onComplete).toHaveBeenCalled();
  });

  test('runSampleTests successfully runs test case and returns AC status', async () => {
    // Add CSRF input to mock DOM
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    // 1st fetch: ensureIdle (status 3)
    // 2nd fetch: submit (ok)
    // 3rd fetch: pollResult (status 3, AC result)
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''), // empty response from submit
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              ExitCode: 0,
              TimeConsumption: 5,
              MemoryConsumption: 1024,
              Output: btoa('out1\n'),
              Error: btoa(''),
            },
          }),
      });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'in1', expected: 'out1' }];
    runner.runSampleTests('abc100', 'print("out1")', 'python', samples, onCaseResult, onComplete);

    // Flush ensureIdle promise chain
    await flushPromises();

    // Flush submit promise chain
    await flushPromises();

    // Flush pollResult promise chain
    await flushPromises();

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'AC',
      time: 5,
      memory: 1024,
      output: 'out1\n',
      expected: 'out1',
      stderr: '',
    });

    // Next case delay is 500ms.
    // Advance by 499ms: should not complete yet.
    jest.advanceTimersByTime(499);
    await flushPromises();
    expect(onComplete).not.toHaveBeenCalled();

    // Advance by 1ms (total 500ms): should complete.
    jest.advanceTimersByTime(1);
    await flushPromises();

    expect(onComplete).toHaveBeenCalled();
  });

  test('runSampleTests retries POST submission on HTTP 429 response', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    // 1st fetch: ensureIdle (ok)
    // 2nd fetch: submit (HTTP 429)
    // 3rd fetch: ensureIdle on retry (ok)
    // 4th fetch: submit on retry (ok)
    // 5th fetch: pollResult (status 3, AC)
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '1']]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              ExitCode: 0,
              TimeConsumption: 12,
              MemoryConsumption: 1024,
              Output: btoa('out1\n'),
              Error: btoa(''),
            },
          }),
      });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'in1', expected: 'out1' }];
    runner.runSampleTests('abc100', 'print("out1")', 'python', samples, onCaseResult, onComplete);

    await flushPromises(); // 1st ensureIdle
    await flushPromises(); // 1st submit (429)

    expect(onCaseResult).not.toHaveBeenCalled();

    // Retry delay is 1000ms (Retry-After: 1)
    jest.advanceTimersByTime(1000);
    await flushPromises(); // 2nd ensureIdle
    await flushPromises(); // 2nd submit
    await flushPromises(); // pollResult

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'AC',
      time: 12,
      memory: 1024,
      output: 'out1\n',
      expected: 'out1',
      stderr: '',
    });
  });

  test('runSampleTests returns TLE status if execution time exceeds time limit', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    window.AtCoderWorkspace.Scraper = {
      extractTimeLimit: () => 1500, // 1500 ms limit
      extractMemoryLimit: () => 1024,
    };

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              ExitCode: 0,
              TimeConsumption: 1600, // exceeds 1500 ms
              MemoryConsumption: 1024,
              Output: btoa('out1\n'),
              Error: btoa(''),
            },
          }),
      });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'in1', expected: 'out1' }];
    runner.runSampleTests('abc100', 'print("out1")', 'python', samples, onCaseResult, onComplete);

    await flushPromises(); // ensureIdle
    await flushPromises(); // submit
    await flushPromises(); // pollResult

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'TLE',
      time: 1600,
      memory: 1024,
      output: 'out1\n',
      expected: 'out1',
      stderr: '',
    });
  });

  test('runSampleTests returns MLE status if memory usage exceeds memory limit', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    window.AtCoderWorkspace.Scraper = {
      extractTimeLimit: () => 2000,
      extractMemoryLimit: () => 512, // 512 MB limit (524288 KB)
    };

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              ExitCode: 0,
              TimeConsumption: 100,
              MemoryConsumption: 600000, // exceeds 524288 KB
              Output: btoa('out1\n'),
              Error: btoa(''),
            },
          }),
      });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'in1', expected: 'out1' }];
    runner.runSampleTests('abc100', 'print("out1")', 'python', samples, onCaseResult, onComplete);

    await flushPromises(); // ensureIdle
    await flushPromises(); // submit
    await flushPromises(); // pollResult

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'MLE',
      time: 100,
      memory: 600000,
      output: 'out1\n',
      expected: 'out1',
      stderr: '',
    });
  });

  test('runSampleTests returns TLE status if pollResult times out locally', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      });

    // Mock pollResult to throw/reject immediately to simulate TLE
    runner.pollResult = jest.fn((contestId, resolve, reject) => {
      reject(new Error('TLE: 実行制限時間を超過しました (15秒)'));
    });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'in1', expected: 'out1' }];
    runner.runSampleTests('abc100', 'print("out1")', 'python', samples, onCaseResult, onComplete);

    await flushPromises(); // ensureIdle
    await flushPromises(); // submit
    await flushPromises(); // pollResult reject

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'TLE',
      message: 'TLE: 実行制限時間を超過しました (15秒)',
    });
  });

  test('pollResult schedules next poll with dynamic backoff depending on elapsed time', async () => {
    const startTime = Date.now();
    let nowMock = startTime;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMock);

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Result: { Status: 1 } }),
    });

    const resolve = jest.fn();
    const reject = jest.fn();

    // Poll 1 (at 0ms elapsed) -> schedules next for 1000ms
    runner.pollResult('abc100', resolve, reject, startTime);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance by 999ms: should not poll.
    nowMock = startTime + 999;
    jest.advanceTimersByTime(999);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance by 1ms (total 1000ms): Poll 2 fires -> schedules next for 2000ms
    nowMock = startTime + 1000;
    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Advance to 2000ms: Poll 3 fires -> schedules next for 3000ms
    nowMock = startTime + 2000;
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // Advance to 3000ms: Poll 4 fires -> elapsed >= 3000ms, schedules next for 4500ms (1500ms interval)
    nowMock = startTime + 3000;
    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(4);

    // Advance by 1499ms: should not poll.
    nowMock = startTime + 4499;
    jest.advanceTimersByTime(1499);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(4);

    // Advance by 1ms (total 4500ms): Poll 5 fires
    nowMock = startTime + 4500;
    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(5);
  });

  test('_getRetryDelay respects Retry-After header and falls back to exponential backoff', () => {
    const mockHeadersWithSec = new Map([['Retry-After', '3']]);
    expect(runner._getRetryDelay({ headers: mockHeadersWithSec }, 1)).toBe(3000);

    expect(runner._getRetryDelay(null, 1)).toBe(2000);
    expect(runner._getRetryDelay(null, 2)).toBe(4000);
    expect(runner._getRetryDelay(null, 3)).toBe(8000);
    expect(runner._getRetryDelay(null, 4)).toBe(10000); // capped at 10s
  });

  test('runSampleTests returns WA status when output does not match expected', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              Output: btoa('wrong_output\n'),
              ExitCode: 0,
              TimeConsumption: 100,
              MemoryConsumption: 2000,
            },
          }),
      });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'in1', expected: 'correct_output' }];
    runner.runSampleTests('abc100', 'code', 'cpp', samples, onCaseResult, onComplete);

    await flushPromises(); // ensureIdle
    await flushPromises(); // submit
    await flushPromises(); // pollResult

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'WA',
      time: 100,
      memory: 2000,
      output: 'wrong_output\n',
      expected: 'correct_output',
      stderr: '',
    });
  });

  test('runSampleTests returns RE status when ExitCode is non-zero or stderr is present', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              Output: btoa(''),
              Error: btoa('Segmentation fault\n'),
              ExitCode: 139,
              TimeConsumption: 50,
              MemoryConsumption: 1000,
            },
          }),
      });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const samples = [{ input: 'in1', expected: 'out1' }];
    runner.runSampleTests('abc100', 'code', 'cpp', samples, onCaseResult, onComplete);

    await flushPromises(); // ensureIdle
    await flushPromises(); // submit
    await flushPromises(); // pollResult

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'RE',
      time: 50,
      memory: 1000,
      output: '',
      expected: 'out1',
      stderr: 'Segmentation fault\n',
    });
  });

  test('runSampleTests returns FINISHED status when expected is empty or not provided', async () => {
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ Result: { Status: 3 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            Result: {
              Status: 3,
              Output: btoa('custom output 42\n'),
              ExitCode: 0,
              TimeConsumption: 80,
              MemoryConsumption: 3000,
            },
          }),
      });

    const onCaseResult = jest.fn();
    const onComplete = jest.fn();

    const customCases = [
      {
        id: 'custom_1',
        name: 'N=1 Corner Case',
        input: '1\n',
        expected: '', // empty expected -> FINISHED
        isCustom: true,
      },
    ];

    runner.runSampleTests('abc100', 'code', 'python', customCases, onCaseResult, onComplete);

    await flushPromises(); // ensureIdle
    await flushPromises(); // submit
    await flushPromises(); // pollResult

    expect(onCaseResult).toHaveBeenCalledWith({
      index: 0,
      status: 'FINISHED',
      time: 80,
      memory: 3000,
      output: 'custom output 42\n',
      expected: '',
      stderr: '',
      name: 'N=1 Corner Case',
      isCustom: true,
    });
  });
});
