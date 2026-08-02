(function () {
  'use strict';

  window.AtCoderWorkspace = window.AtCoderWorkspace || {};

  const TIMEOUT_MS = 15000; // 実行結果タイムアウト (15秒)
  const IDLE_TIMEOUT_MS = 20000; // 空き状態待ちタイムアウト (20秒)
  const IDLE_CHECK_INTERVAL_MS = 1000; // 空き状態確認ポーリング間隔 (1000ms)
  const NEXT_CASE_DELAY_MS = 500; // 次のケース実行前の遅延 (500ms)
  const LOCK_RETRY_DELAY_MS = 1500; // ロック発生時の再試行遅延 (1500ms)
  const DEFAULT_TIME_LIMIT_MS = 2000; // デフォルトの実行時間制限 (2000ms)
  const DEFAULT_MEMORY_LIMIT_MB = 1024; // デフォルトのメモリ制限 (1024MB)
  const MAX_HTTP_RETRIES = 3; // 429・ネットワークエラー時の最大リトライ回数

  /**
   * Runner communicates with AtCoder's custom test endpoint
   * to submit, poll, and verify solutions against sample test cases.
   */
  class Runner {
    /**
     * Calculates retry delay, respecting Retry-After header if present.
     * @private
     * @param {Response} [res]
     * @param {number} attempt
     * @returns {number} Delay in milliseconds
     */
    _getRetryDelay(res, attempt = 1) {
      if (res && res.headers) {
        const retryAfter = res.headers.get('Retry-After');
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) {
            return seconds * 1000;
          }
        }
      }
      return Math.min(2000 * Math.pow(2, attempt - 1), 10000);
    }

    /**
     * Calculates the next polling interval based on elapsed time.
     * @private
     * @param {number} startTime
     * @returns {number}
     */
    _getPollInterval(startTime) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 3000) {
        return 1000;
      }
      return 1500;
    }

    /**
     * Polls the custom test JSON endpoint until completion or timeout.
     * @param {string} contestId
     * @param {Function} resolve
     * @param {Function} reject
     * @param {number} startTime
     * @param {number} [retryCount=0]
     */
    pollResult(contestId, resolve, reject, startTime, retryCount = 0) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        // 15 seconds timeout
        reject(new Error('TLE: 実行制限時間を超過しました (15秒)'));
        return;
      }

      fetch(`/contests/${contestId}/custom_test/json?_=${Date.now()}`)
        .then((res) => {
          if (!res.ok) {
            const err = new Error('Network response not ok: ' + res.status);
            err.status = res.status;
            err.response = res;
            throw err;
          }
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
                () => this.pollResult(contestId, resolve, reject, startTime, 0),
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
              () => this.pollResult(contestId, resolve, reject, startTime, 0),
              this._getPollInterval(startTime)
            );
          }
        })
        .catch((err) => {
          const isNetworkErr =
            err &&
            err.name === 'TypeError' &&
            err.message &&
            err.message.toLowerCase().includes('fetch');
          const is429 = err && err.status === 429;

          if ((is429 || isNetworkErr) && retryCount < MAX_HTTP_RETRIES) {
            const delay = this._getRetryDelay(err.response, retryCount + 1);
            console.warn(
              `[AtCoder Workspace] pollResult error (${err.status || 'NetworkError'}). Retrying (${retryCount + 1}/${MAX_HTTP_RETRIES}) in ${delay}ms...`
            );
            setTimeout(
              () => this.pollResult(contestId, resolve, reject, startTime, retryCount + 1),
              delay
            );
          } else {
            reject(err);
          }
        });
    }

    /**
     * Confirms AtCoder is ready and idle before executing next test.
     * @param {string} contestId
     * @param {Function} onIdle
     * @param {number} startTime
     * @param {number} [retryCount=0]
     */
    ensureIdle(contestId, onIdle, startTime, retryCount = 0) {
      if (Date.now() - startTime > IDLE_TIMEOUT_MS) {
        // 20 seconds timeout
        console.warn('[AtCoder Workspace] Idle check timed out, proceeding anyway.');
        onIdle();
        return;
      }

      fetch(`/contests/${contestId}/custom_test/json?_=${Date.now()}`)
        .then((res) => {
          if (!res.ok) {
            const err = new Error('Network response not ok: ' + res.status);
            err.status = res.status;
            err.response = res;
            throw err;
          }
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
                () => this.ensureIdle(contestId, onIdle, startTime, 0),
                IDLE_CHECK_INTERVAL_MS
              );
              return;
            }
          }
          onIdle();
        })
        .catch((err) => {
          if (err.status === 429 && retryCount < MAX_HTTP_RETRIES) {
            const delay = this._getRetryDelay(err.response, retryCount + 1);
            console.warn(
              `[AtCoder Workspace] Idle check received 429. Retrying (${retryCount + 1}/${MAX_HTTP_RETRIES}) in ${delay}ms...`
            );
            setTimeout(() => this.ensureIdle(contestId, onIdle, startTime, retryCount + 1), delay);
          } else {
            console.warn('[AtCoder Workspace] Idle check failed:', err, ', proceeding anyway.');
            onIdle();
          }
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

      const runNext = (caseRetryCount = 0) => {
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
              setTimeout(() => runNext(0), NEXT_CASE_DELAY_MS);
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
                if (!res.ok) {
                  const err = new Error('POST failed: ' + res.status);
                  err.status = res.status;
                  err.response = res;
                  throw err;
                }
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
                setTimeout(() => runNext(0), NEXT_CASE_DELAY_MS);
              })
              .catch((err) => {
                console.warn(`[AtCoder Workspace] Case ${index + 1} submission error:`, err);

                if (err.message && err.message.includes('LockError')) {
                  // Retry same case on lock
                  console.log(`[AtCoder Workspace] Retrying case ${index + 1} due to lock...`);
                  setTimeout(() => runNext(caseRetryCount), LOCK_RETRY_DELAY_MS);
                } else if (err.status === 429 && caseRetryCount < MAX_HTTP_RETRIES) {
                  const delay = this._getRetryDelay(err.response, caseRetryCount + 1);
                  console.warn(
                    `[AtCoder Workspace] Case ${index + 1} hit HTTP 429. Retrying submission (${caseRetryCount + 1}/${MAX_HTTP_RETRIES}) in ${delay}ms...`
                  );
                  setTimeout(() => runNext(caseRetryCount + 1), delay);
                } else {
                  const isTle = err.message && err.message.includes('TLE');
                  onCaseResult({
                    index,
                    status: isTle ? 'TLE' : 'ERR',
                    message: err.message || '実行エラーが発生しました。',
                  });
                  index++;
                  setTimeout(() => runNext(0), NEXT_CASE_DELAY_MS);
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
