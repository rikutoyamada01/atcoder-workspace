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

    // Idle check interval is 300ms.
    // Advance timer by 299ms: should not poll again.
    jest.advanceTimersByTime(299);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance timer by 1ms (total 300ms): should trigger poll.
    jest.advanceTimersByTime(1);
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

    // Next case delay is 50ms.
    // Advance by 49ms: should not complete yet.
    jest.advanceTimersByTime(49);
    await flushPromises();
    expect(onComplete).not.toHaveBeenCalled();

    // Advance by 1ms (total 50ms): should complete.
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

    // Next case delay is 50ms.
    // Advance by 49ms: should not complete yet.
    jest.advanceTimersByTime(49);
    await flushPromises();
    expect(onComplete).not.toHaveBeenCalled();

    // Advance by 1ms (total 50ms): should complete.
    jest.advanceTimersByTime(1);
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

  test('pollResult schedules next poll with dynamic backoff depending on elapsed time', async () => {
    const startTime = Date.now();
    let nowMock = startTime;
    jest.spyOn(Date, 'now').mockImplementation(() => nowMock);

    // Mock fetch to return running status (Status 1) so it keeps polling
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ Result: { Status: 1 } }),
    });

    const resolve = jest.fn();
    const reject = jest.fn();

    // Poll 1 (at 0ms elapsed) -> schedules next for 200ms
    runner.pollResult('abc100', resolve, reject, startTime);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance by 199ms: should not poll.
    nowMock = startTime + 199;
    jest.advanceTimersByTime(199);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance by 1ms (total 200ms): Poll 2 fires -> schedules next for 400ms
    nowMock = startTime + 200;
    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Advance by 199ms: should not poll.
    nowMock = startTime + 399;
    jest.advanceTimersByTime(199);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Advance by 1ms (total 400ms): Poll 3 fires -> schedules next for 600ms
    nowMock = startTime + 400;
    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // Advance to 600ms
    nowMock = startTime + 600;
    jest.advanceTimersByTime(200);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(4); // Poll 4 at 600ms, schedules next for 800ms

    // Advance to 800ms
    nowMock = startTime + 800;
    jest.advanceTimersByTime(200);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(5); // Poll 5 at 800ms, schedules next for 1000ms

    // Advance to 1000ms
    nowMock = startTime + 1000;
    jest.advanceTimersByTime(200);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(6); // Poll 6 at 1000ms, schedules next for 1500ms (elapsed >= 1000ms)

    // Now polling interval is 500ms.
    // Advance by 499ms: should not poll.
    nowMock = startTime + 1499;
    jest.advanceTimersByTime(499);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(6);

    // Advance by 1ms (total 1500ms): Poll 7 fires -> schedules next for 2000ms
    nowMock = startTime + 1500;
    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(7);

    // Advance to 2000ms
    nowMock = startTime + 2000;
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(8); // Poll 8 at 2000ms, schedules next for 2500ms

    // Advance to 2500ms
    nowMock = startTime + 2500;
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(9); // Poll 9 at 2500ms, schedules next for 3000ms

    // Advance to 3000ms
    nowMock = startTime + 3000;
    jest.advanceTimersByTime(500);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(10); // Poll 10 at 3000ms, schedules next for 4000ms (elapsed >= 3000ms)

    // Now polling interval is 1000ms.
    // Advance by 999ms: should not poll.
    nowMock = startTime + 3999;
    jest.advanceTimersByTime(999);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(10);

    // Advance by 1ms (total 4000ms): Poll 11 fires -> schedules next for 5000ms
    nowMock = startTime + 4000;
    jest.advanceTimersByTime(1);
    await flushPromises();
    expect(global.fetch).toHaveBeenCalledTimes(11);
  });
});
