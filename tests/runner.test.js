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

    // Advance timer by 1000ms to trigger setTimeout
    jest.advanceTimersByTime(1000);
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

    jest.advanceTimersByTime(1000); // Wait next case delay
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

    jest.advanceTimersByTime(1000); // Case completed delay
    await flushPromises();

    expect(onComplete).toHaveBeenCalled();
  });

  test('runSampleTests returns TLE status if execution time exceeds time limit', async () => {
    // Add CSRF input to mock DOM
    document.body.innerHTML = '<input name="csrf_token" value="dummy-csrf-token" />';

    // Mock Scraper limits
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
});
