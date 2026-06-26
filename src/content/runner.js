(function () {
  'use strict';

  window.AtCoderWorkspace = window.AtCoderWorkspace || {};

  const TIMEOUT_MS = 15000; // 実行結果タイムアウト (15秒)
  const IDLE_TIMEOUT_MS = 20000; // 空き状態待ちタイムアウト (20秒)
  const IDLE_CHECK_INTERVAL_MS = 300; // 空き状態確認ポーリング間隔 (300ms)
  const NEXT_CASE_DELAY_MS = 50; // 次のケース実行前の遅延 (50ms)
  const LOCK_RETRY_DELAY_MS = 1500; // ロック発生時の再試行遅延 (1500ms)
  const DEFAULT_TIME_LIMIT_MS = 2000; // デフォルトの実行時間制限 (2000ms)
  const DEFAULT_MEMORY_LIMIT_MB = 1024; // デフォルトのメモリ制限 (1024MB)

  /**
   * Runner communicates with AtCoder's custom test endpoint
   * to submit, poll, and verify solutions against sample test cases.
   */
  class Runner {
    /**
     * Calculates the next polling interval based on elapsed time.
     * @private
     * @param {number} startTime
     * @returns {number}
     */
    _getPollInterval(startTime) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1000) {
        return 200;
      }
      if (elapsed < 3000) {
        return 500;
      }
      return 1000;
    }

    /**
     * Polls the custom test JSON endpoint until completion or timeout.
     * @param {string} contestId
     * @param {Function} resolve
     * @param {Function} reject
     * @param {number} startTime
     */
    pollResult(contestId, resolve, reject, startTime) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        // 15 seconds timeout
        reject(new Error('TLE: 実行制限時間を超過しました (15秒)'));
        return;
      }

      fetch(`/contests/${contestId}/custom_test/json?_=${Date.now()}`)
        .then((res) => {
          if (!res.ok) throw new Error('Network response not ok: ' + res.status);
          return res.json();
        })
        .then((data) => {
          if (data && data.Result) {
            const statusVal =
              data.Result.Status !== undefined ? data.Result.Status : data.Result.status;
            const status = statusVal !== undefined ? Number(statusVal) : null;
            console.log('[AtCoder Workspace] Poll status:', status);

            // AtCoder Custom Test Statuses:
            // 0: Queued, 1: Compiling, 2: Running, 3: Completed
            if (status === 0 || status === 1 || status === 2) {
              setTimeout(
                () => this.pollResult(contestId, resolve, reject, startTime),
                this._getPollInterval(startTime)
              );
            } else {
              // Decode Base64 Output/Error as fallback if plaintext root properties are missing
              const stdout =
                data.Stdout !== undefined
                  ? data.Stdout
                  : data.Result.Output !== undefined
                    ? atob(data.Result.Output)
                    : '';
              const stderr =
                data.Stderr !== undefined
                  ? data.Stderr
                  : data.Result.Error !== undefined
                    ? atob(data.Result.Error)
                    : '';

              resolve({
                Stdout: stdout,
                Stderr: stderr,
                ExitCode: data.Result.ExitCode,
                TimeConsumption: data.Result.TimeConsumption,
                MemoryConsumption: data.Result.MemoryConsumption,
              });
            }
          } else {
            setTimeout(
              () => this.pollResult(contestId, resolve, reject, startTime),
              this._getPollInterval(startTime)
            );
          }
        })
        .catch((err) => {
          reject(err);
        });
    }

    /**
     * Confirms AtCoder is ready and idle before executing next test.
     * @param {string} contestId
     * @param {Function} onIdle
     * @param {number} startTime
     */
    ensureIdle(contestId, onIdle, startTime) {
      if (Date.now() - startTime > IDLE_TIMEOUT_MS) {
        // 20 seconds timeout
        console.warn('[AtCoder Workspace] Idle check timed out, proceeding anyway.');
        onIdle();
        return;
      }

      fetch(`/contests/${contestId}/custom_test/json?_=${Date.now()}`)
        .then((res) => {
          if (!res.ok) return { Result: null };
          return res.json();
        })
        .then((data) => {
          if (data && data.Result) {
            const statusVal =
              data.Result.Status !== undefined ? data.Result.Status : data.Result.status;
            const status = statusVal !== undefined ? Number(statusVal) : null;
            console.log('[AtCoder Workspace] Idle check status:', status);

            // 0: Queued, 1: Compiling, 2: Running
            if (status === 0 || status === 1 || status === 2) {
              console.log(
                '[AtCoder Workspace] Custom test is currently busy (status:',
                status,
                '), waiting...'
              );
              setTimeout(
                () => this.ensureIdle(contestId, onIdle, startTime),
                IDLE_CHECK_INTERVAL_MS
              );
              return;
            }
          }
          onIdle();
        })
        .catch((err) => {
          console.warn('[AtCoder Workspace] Idle check failed:', err, ', proceeding anyway.');
          onIdle();
        });
    }

    /**
     * Executes the list of test cases sequentially.
     * @param {string} contestId
     * @param {string} code
     * @param {string} languageId
     * @param {Array<Object>} samples
     * @param {Function} onCaseResult
     * @param {Function} onComplete
     */
    runSampleTests(contestId, code, languageId, samples, onCaseResult, onComplete) {
      let index = 0;

      const runNext = () => {
        if (index >= samples.length) {
          onComplete();
          return;
        }

        const sample = samples[index];

        this.ensureIdle(
          contestId,
          () => {
            const csrfToken = this._getCsrfToken();

            if (!csrfToken) {
              onCaseResult({
                index,
                status: 'ERR',
                message: 'CSRFトークンが見つかりません。',
              });
              index++;
              setTimeout(runNext, NEXT_CASE_DELAY_MS);
              return;
            }

            const params = new URLSearchParams();
            params.append('csrf_token', csrfToken);
            params.append('sourceCode', code);
            params.append('data.LanguageId', languageId);
            params.append('input', sample.input);

            fetch(`/contests/${contestId}/custom_test/submit/json`, {
              method: 'POST',
              body: params,
            })
              .then((res) => {
                if (!res.ok) throw new Error('POST failed: ' + res.status);
                return res.text();
              })
              .then((text) => {
                // AtCoder returns empty body on successful submission
                if (!text || !text.trim()) {
                  console.log('[AtCoder Workspace] Custom test submitted successfully.');
                  return {};
                }

                let data;
                try {
                  data = JSON.parse(text);
                } catch (e) {
                  if (text.includes('前回のカスタムテスト')) {
                    throw new Error('LockError: 前回のカスタムテストの実行が終了していません。');
                  }
                  throw new Error(
                    'JSON parse failed (len=' +
                      text.length +
                      '): ' +
                      JSON.stringify(text).substring(0, 100)
                  );
                }
                return data;
              })
              .then((_data) => {
                return new Promise((resolve, reject) => {
                  this.pollResult(contestId, resolve, reject, Date.now());
                });
              })
              .then((result) => {
                const actualOutput =
                  result.Stdout !== undefined
                    ? result.Stdout
                    : result.Output !== undefined
                      ? result.Output
                      : '';
                const actual = actualOutput.trim().replace(/\r\n/g, '\n');
                const expected = (sample.expected || '').trim().replace(/\r\n/g, '\n');

                const exitCode = result.ExitCode !== undefined ? Number(result.ExitCode) : 0;
                const timeConsumption =
                  result.TimeConsumption !== undefined ? Number(result.TimeConsumption) : 0;
                const memoryConsumption =
                  result.MemoryConsumption !== undefined ? Number(result.MemoryConsumption) : 0;

                const scraper = window.AtCoderWorkspace.Scraper;
                const timeLimit =
                  scraper && typeof scraper.extractTimeLimit === 'function'
                    ? scraper.extractTimeLimit()
                    : DEFAULT_TIME_LIMIT_MS;
                const memoryLimit =
                  scraper && typeof scraper.extractMemoryLimit === 'function'
                    ? scraper.extractMemoryLimit()
                    : DEFAULT_MEMORY_LIMIT_MB;

                let status = 'WA';
                if (timeConsumption >= timeLimit) {
                  status = 'TLE';
                } else if (memoryConsumption > memoryLimit * 1024) {
                  status = 'MLE';
                } else if (actual === expected && exitCode === 0) {
                  status = 'AC';
                } else if (exitCode !== 0 || result.Stderr) {
                  status = 'RE';
                }

                onCaseResult({
                  index,
                  status,
                  time: result.TimeConsumption !== undefined ? result.TimeConsumption : result.Time,
                  memory:
                    result.MemoryConsumption !== undefined
                      ? result.MemoryConsumption
                      : result.Memory,
                  output: actualOutput,
                  expected: sample.expected,
                  stderr: result.Stderr || '',
                });

                index++;
                setTimeout(runNext, NEXT_CASE_DELAY_MS);
              })
              .catch((err) => {
                console.warn(`[AtCoder Workspace] Case ${index + 1} submission error:`, err);

                if (err.message && err.message.includes('LockError')) {
                  // Retry same case on lock
                  console.log(`[AtCoder Workspace] Retrying case ${index + 1} due to lock...`);
                  setTimeout(runNext, LOCK_RETRY_DELAY_MS);
                } else {
                  const isTle = err.message && err.message.includes('TLE');
                  onCaseResult({
                    index,
                    status: isTle ? 'TLE' : 'ERR',
                    message: err.message || '実行エラーが発生しました。',
                  });
                  index++;
                  setTimeout(runNext, NEXT_CASE_DELAY_MS);
                }
              });
          },
          Date.now()
        );
      };

      runNext();
    }

    /**
     * Extracts CSRF token from input field or window context.
     * @private
     * @returns {string}
     */
    _getCsrfToken() {
      let csrfToken = '';
      const tokenInput = document.querySelector('input[name="csrf_token"]');
      if (tokenInput) csrfToken = tokenInput.value;
      if (!csrfToken && window.csrfToken) csrfToken = window.csrfToken;
      return csrfToken;
    }
  }

  window.AtCoderWorkspace.Runner = new Runner();
})();
