(function () {
  'use strict';

  window.AtCoderWorkspace = window.AtCoderWorkspace || {};

  /**
   * Submitter handles posting submission data to AtCoder and
   * polling the status of the submission until judging completes.
   */
  class Submitter {
    constructor() {
      this.lastTurnstileStatus = 'unknown';
    }

    /**
     * Extracts the CSRF token from the current page DOM.
     * @returns {string}
     */
    getCsrfToken() {
      let csrfToken = '';
      const tokenInput = document.querySelector('input[name="csrf_token"]');
      if (tokenInput) csrfToken = tokenInput.value;
      if (!csrfToken && window.csrfToken) csrfToken = window.csrfToken;
      return csrfToken;
    }

    /**
     * Fetches a fresh CSRF token from the contest's submit page.
     * Used only as a fallback when no native form is available.
     * @param {string} contestId
     * @returns {Promise<string>}
     */
    fetchFreshCsrfToken(contestId) {
      return fetch(`/contests/${contestId}/submit`)
        .then((res) => {
          if (!res.ok) throw new Error('CSRFトークンの取得に失敗しました。');
          return res.text();
        })
        .then((html) => {
          if (html.includes('/login') || html.includes('ログイン') || html.includes('Sign In')) {
            throw new Error(
              'AtCoderにログインしていません。提出するには AtCoder のサイトでログインしてください。'
            );
          }
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const tokenInput = doc.querySelector('input[name="csrf_token"]');
          if (tokenInput && tokenInput.value) {
            return tokenInput.value;
          }
          throw new Error(
            'CSRFトークンが見つかりません。コンテストへの登録状態を確認してください。'
          );
        });
    }

    /**
     * Waits for the Cloudflare Turnstile hidden input to receive a valid token.
     * Turnstile tokens are long base64 strings (typically 300+ chars).
     * @param {HTMLInputElement|null} input
     * @returns {Promise<void>}
     */
    waitForTurnstile(input, form, callback) {
      // If token already present, skip Turnstile handling
      if (input && input.value && input.value.length > 20) {
        this.lastTurnstileStatus = 'token_already_present';
        return Promise.resolve();
      }

      // Check if there is a Turnstile container on the page
      // Note: AtCoder uses "cf-challenge" class, not "cf-turnstile"
      let hasTurnstile = false;
      let container = null;
      try {
        if (form) {
          container = form.querySelector(
            '.cf-turnstile, .cf-challenge, #cf-turnstile, [class*="cf-turnstile"], [data-sitekey]'
          );
          if (container) hasTurnstile = true;
        } else if (input) {
          container = input.closest('form')
            ? input
                .closest('form')
                .querySelector(
                  '.cf-turnstile, .cf-challenge, #cf-turnstile, [class*="cf-turnstile"], [data-sitekey]'
                )
            : null;
          if (container) hasTurnstile = true;
        }
      } catch (e) {
        console.warn('[AtCoder Workspace] Error checking Turnstile container existence:', e);
      }

      if (container) {
        this.lastTurnstileStatus = container.dataset.turnstileStatus || 'implicit';
      } else {
        this.lastTurnstileStatus = hasTurnstile ? 'implicit' : 'no_container';
      }

      // No Turnstile on this page – proceed immediately
      if (!hasTurnstile && !input) return Promise.resolve();

      // Get the input element
      const currentInput =
        input || (form ? form.querySelector('input[name="cf-turnstile-response"]') : null);

      // Already has a valid-looking token (long string, not 'hidden' or empty)
      if (currentInput && currentInput.value && currentInput.value.length > 20) {
        this.lastTurnstileStatus = 'token_already_present';
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const start = Date.now();
        let resolved = false;
        let poppedUp = false;
        let observer = null;
        let timer = null;
        let labelElement = null;

        // Keep track of original styles to restore them later
        const originalStyles = {};
        const stylesToModify = [
          'position',
          'bottom',
          'left',
          'zIndex',
          'opacity',
          'backgroundColor',
          'padding',
          'borderRadius',
          'boxShadow',
          'border',
          'transition',
        ];

        const cleanup = () => {
          if (observer) {
            observer.disconnect();
            observer = null;
          }
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          // Restore container styling
          if (container) {
            stylesToModify.forEach((prop) => {
              container.style[prop] = originalStyles[prop] || '';
            });
            // Ensure container becomes hidden/less visible after use to keep UI clean
            container.style.opacity = '0.01';
          }
          // Remove dynamically created label
          if (labelElement && labelElement.parentNode) {
            labelElement.parentNode.removeChild(labelElement);
            labelElement = null;
          }
        };

        const checkToken = () => {
          if (resolved) return true;
          if (container && container.dataset.turnstileStatus) {
            this.lastTurnstileStatus = container.dataset.turnstileStatus;
          }
          if (currentInput && currentInput.value && currentInput.value.length > 20) {
            console.log('[AtCoder Workspace] Turnstile token received.');
            resolved = true;
            cleanup();
            resolve();
            return true;
          }
          return false;
        };

        // 1. Setup MutationObserver to watch for any changes in the Turnstile container or form
        const observerTarget = container || form || document.body;
        if (observerTarget) {
          observer = new MutationObserver(() => {
            checkToken();
          });
          observer.observe(observerTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['value', 'class', 'style', 'src'],
          });
        }

        // 2. Setup periodic check (polling) as fallback and for status updates/timeouts
        const poll = () => {
          if (resolved) return;

          // Check token first
          if (checkToken()) return;

          const elapsed = Date.now() - start;

          // 600ms passed and still no token – float Turnstile widget in viewport
          if (elapsed > 600 && !poppedUp) {
            poppedUp = true;
            if (callback) {
              callback({
                status: 'WAITING_CAPTCHA',
                message:
                  'ボット認証（Cloudflare Turnstile）を待機しています。手動でのクリック（私は人間です）が必要な場合があります。',
              });
            }

            if (container) {
              // Save original styles
              stylesToModify.forEach((prop) => {
                originalStyles[prop] = container.style[prop];
              });

              // Apply floating styling to make the Turnstile widget visible at the bottom-left of the viewport
              container.style.position = 'fixed';
              container.style.bottom = '20px';
              container.style.left = '20px';
              container.style.zIndex = '999999';
              container.style.opacity = '1';
              container.style.backgroundColor = '#ffffff';
              container.style.padding = '32px 12px 12px 12px'; // Extra top padding for label
              container.style.borderRadius = '8px';
              container.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.2)';
              container.style.border = '2px solid #ff4d4f';
              container.style.transition = 'all 0.3s ease';

              // Create and append custom instruction label inside container
              labelElement = document.createElement('div');
              labelElement.id = 'atcoder-workspace-turnstile-label';
              labelElement.textContent = 'ボット認証が必要です。チェックを入れてください';
              labelElement.style.position = 'absolute';
              labelElement.style.top = '8px';
              labelElement.style.left = '0';
              labelElement.style.right = '0';
              labelElement.style.fontSize = '11.5px';
              labelElement.style.fontWeight = 'bold';
              labelElement.style.color = '#ff4d4f';
              labelElement.style.textAlign = 'center';
              labelElement.style.pointerEvents = 'none'; // Prevent blocking clicks on iframe
              container.appendChild(labelElement);
            }
          }

          if (elapsed > 45000) {
            // Timeout after 45s
            cleanup();
            reject(
              new Error(
                'ボット判定(Cloudflare Turnstile)の自動認証がタイムアウトしました。しばらく待ってから再度提出をお試しください。'
              )
            );
            return;
          }

          // Continue polling fallback
          timer = setTimeout(poll, 300);
        };

        // Start polling
        poll();
      });
    }

    /**
     * Submits code to AtCoder and polls the status.
     *
     * Strategy: Use the NATIVE submit form on the current task page.
     * The task page has a submit form that includes CSRF token, Turnstile
     * response, and all necessary hidden fields. By using FormData from
     * this live DOM form, we include everything AtCoder expects — including
     * the Cloudflare Turnstile token.
     *
     * @param {string} contestId
     * @param {string} problemId
     * @param {string} languageId
     * @param {string} code
     * @param {Function} callback - Called with progress updates or error
     */
    submit(contestId, problemId, languageId, code, callback) {
      const nativeForm = document.querySelector('form[action*="/submit"]');

      if (nativeForm) {
        this._submitViaNativeForm(nativeForm, contestId, problemId, languageId, code, callback);
      } else {
        console.warn(
          '[AtCoder Workspace] Native submit form not found, falling back to manual POST.'
        );
        this._submitManual(contestId, problemId, languageId, code, callback);
      }
    }

    /**
     * Pre-warms the Turnstile widget by floating it invisibly in the viewport,
     * resetting it, and waiting for a new token to be generated in the background.
     * @param {HTMLFormElement} form
     */
    preWarmTurnstile(form) {
      const container = form.querySelector(
        '.cf-turnstile, .cf-challenge, #cf-turnstile, [class*="cf-turnstile"], [data-sitekey]'
      );
      const turnstileInput = form.querySelector('input[name="cf-turnstile-response"]');
      if (!container || !turnstileInput) return;

      // 1. Clear previous value
      turnstileInput.value = '';
      delete container.dataset.turnstileStatus;

      // Keep track of styles to modify
      const stylesToModify = [
        'position',
        'bottom',
        'left',
        'zIndex',
        'opacity',
        'backgroundColor',
        'padding',
        'borderRadius',
        'boxShadow',
        'border',
        'transition',
        'pointerEvents',
      ];
      const originalStyles = {};
      stylesToModify.forEach((prop) => {
        originalStyles[prop] = container.style[prop];
      });

      // 2. Float container invisibly in the viewport to bypass lazy loading
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.left = '20px';
      container.style.zIndex = '999999';
      container.style.opacity = '0.01'; // Rendered but invisible to the user
      container.style.pointerEvents = 'none'; // Ensure user clicks pass through
      container.style.transition = 'none'; // No sliding transitions for warming

      // 3. Trigger reset in MAIN world to initiate fresh challenge
      document.dispatchEvent(new CustomEvent('atcoder-workspace-reset-turnstile'));

      // 4. Watch for background token generation
      const start = Date.now();
      let resolved = false;
      let observer = null;
      let timer = null;

      const cleanupWarming = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        // Restore container to its original layout position (hidden state)
        stylesToModify.forEach((prop) => {
          container.style[prop] = originalStyles[prop] || '';
        });
        container.style.opacity = '0.01';
      };

      const checkWarmingToken = () => {
        if (resolved) return true;
        if (turnstileInput.value && turnstileInput.value.length > 20) {
          console.log('[AtCoder Workspace] Background Turnstile pre-warming completed.');
          resolved = true;
          cleanupWarming();
          return true;
        }
        return false;
      };

      // Watch DOM mutations
      observer = new MutationObserver(() => {
        checkWarmingToken();
      });
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['value', 'class', 'style', 'src'],
      });

      // Poll as fallback / timeout (5 seconds maximum for warming)
      const pollWarming = () => {
        if (resolved) return;
        if (checkWarmingToken()) return;

        const elapsed = Date.now() - start;
        if (elapsed > 5000) {
          console.log('[AtCoder Workspace] Background Turnstile pre-warming timeout.');
          resolved = true;
          cleanupWarming();
          return;
        }

        timer = setTimeout(pollWarming, 300);
      };

      pollWarming();
    }

    /**
     * Primary submission path: uses the native form DOM to build the request.
     * @private
     */
    _submitViaNativeForm(form, contestId, problemId, languageId, code, callback) {
      // Set the code into the textarea
      const textarea = form.querySelector('textarea[name="sourceCode"]');
      if (textarea) {
        textarea.value = code;
      }

      // Ensure task and language are set correctly
      const taskInput = form.querySelector('[name="data.TaskScreenName"]');
      if (taskInput) taskInput.value = problemId;

      const langSelect = form.querySelector('select[name="data.LanguageId"]');
      if (langSelect) langSelect.value = languageId;

      const langInput = form.querySelector('input[name="data.LanguageId"]');
      if (langInput) langInput.value = languageId;

      // Keep the existing token if present, do not clear it, and do not reset Turnstile.
      const turnstileInput = form.querySelector('input[name="cf-turnstile-response"]');

      // Wait for the Turnstile widget to generate a valid token
      this.waitForTurnstile(turnstileInput, form, callback)
        .then(() => {
          if (callback) {
            callback({
              status: 'SUBMITTING',
              message: 'コードを送信しています...',
              turnstileDebug: this.lastTurnstileStatus,
            });
          }

          // Build FormData from the live native form
          const formData = new FormData(form);

          if (!formData.get('sourceCode') || formData.get('sourceCode').trim() === '') {
            formData.set('sourceCode', code);
          }

          const actionUrl = form.getAttribute('action') || `/contests/${contestId}/submit`;
          return fetch(actionUrl, {
            method: 'POST',
            body: formData,
            credentials: 'include',
          }).finally(() => {
            this.preWarmTurnstile(form);
          });
        })
        .then((res) => {
          if (res)
            return this._handleSubmitResponse(
              res,
              contestId,
              problemId,
              languageId,
              code,
              callback
            );
        })
        .catch((err) => {
          console.error('[AtCoder Workspace] Submission error:', err);
          callback({ error: err.message || '送信中にエラーが発生しました。' });
        });
    }

    /**
     * Fallback submission path: builds FormData manually without DOM form.
     * @private
     */
    _submitManual(contestId, problemId, languageId, code, callback) {
      this.fetchFreshCsrfToken(contestId)
        .then((csrfToken) => {
          const params = new URLSearchParams();
          params.append('csrf_token', csrfToken);
          params.append('data.TaskScreenName', problemId);
          params.append('data.LanguageId', languageId);
          params.append('sourceCode', code);

          console.log('[AtCoder Workspace] Submitting manually (no Turnstile):', {
            problemId,
            languageId,
            codeLength: code.length,
          });

          return fetch(`/contests/${contestId}/submit`, {
            method: 'POST',
            body: params,
            credentials: 'include',
          });
        })
        .then((res) =>
          this._handleSubmitResponse(res, contestId, problemId, languageId, code, callback)
        )
        .catch((err) => {
          console.error('[AtCoder Workspace] Submission error:', err);
          callback({ error: err.message || '送信中にエラーが発生しました。' });
        });
    }

    /**
     * Handles the POST response from the submit endpoint.
     * @private
     */
    _handleSubmitResponse(res, contestId, problemId, languageId, code, callback) {
      return res
        .text()
        .then((html) => {
          // Check if session has expired / not logged in
          if (html.includes('/login') || html.includes('ログイン') || html.includes('Sign In')) {
            throw new Error(
              'AtCoderにログインしていません。提出するには AtCoder のサイトでログインしてください。'
            );
          }

          // Check for validation errors in the HTML response
          const errorMsg = this.extractErrorMessage(html);
          if (errorMsg) {
            if (
              errorMsg.includes('エラーが発生しました') ||
              errorMsg === 'エラーが発生しました。'
            ) {
              throw new Error(
                'エラーが発生しました。（セッション切れ、コンテスト未登録、またはトークン不一致の可能性があります。コンテストに参加登録しているか確認し、ページを一度リロードしてから再度提出をお試しください。）'
              );
            }
            if (errorMsg.includes('30秒間は提出できません')) {
              throw new Error(
                '前回の提出から30秒間は提出できません。前回の提出完了から30秒以上経過するまでお待ちください。'
              );
            }
            throw new Error(errorMsg);
          }

          // Parse submission ID from redirected HTML response
          const submissionId = this.parseSubmissionId(html, contestId);
          if (!submissionId) {
            console.warn(
              '[AtCoder Workspace] Could not parse submissionId from submit response, checking submissions/me...'
            );
            return this.fetchLatestSubmissionId(contestId).then((latestId) => {
              if (!latestId) {
                throw new Error('提出IDの取得に失敗しました。');
              }
              return latestId;
            });
          }
          return submissionId;
        })
        .then((submissionId) => {
          // Save pending submission info to storage
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
              pending_submission: {
                submissionId,
                contestId,
                problemId,
                languageId,
                code,
                timestamp: Date.now(),
              },
            });
          }

          // Send initial status update
          callback({
            submissionId,
            status: 'WJ',
            time: '',
            memory: '',
            isComplete: false,
            turnstileDebug: this.lastTurnstileStatus,
          });

          // Start polling
          this.poll(contestId, submissionId, callback);
        });
    }

    /**
     * Parse the HTML response to find the submission ID.
     * @param {string} html
     * @param {string} contestId
     * @returns {string|null}
     */
    parseSubmissionId(html, contestId) {
      if (!html) return null;
      // Try with contestId first (case-insensitive)
      let regex = new RegExp(`/contests/${contestId}/submissions/(\\d+)`, 'i');
      let match = html.match(regex);
      if (match) return match[1];

      // Fallback: search for any /submissions/{id} pattern
      regex = /\/submissions\/(\d+)/i;
      match = html.match(regex);
      return match ? match[1] : null;
    }

    /**
     * Fetches /contests/{contestId}/submissions/me to find the latest submission ID.
     * @param {string} contestId
     * @returns {Promise<string|null>}
     */
    fetchLatestSubmissionId(contestId) {
      return fetch(`/contests/${contestId}/submissions/me`)
        .then((res) => {
          if (!res.ok) return null;
          return res.text();
        })
        .then((html) => {
          if (html.includes('/login') || html.includes('ログイン') || html.includes('Sign In')) {
            throw new Error(
              'AtCoderにログインしていません。提出するには AtCoder のサイトでログインしてください。'
            );
          }
          return this.parseSubmissionId(html, contestId);
        })
        .catch(() => null);
    }

    /**
     * Extracts validation error messages from the HTML response if any exist.
     * @param {string} html
     * @returns {string|null}
     */
    extractErrorMessage(html) {
      if (!html) return null;
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // AtCoder bootstrap error alerts
        const alert = doc.querySelector('.alert-danger, .alert-error');
        if (alert) {
          // Exclude close buttons text if present
          const closeBtn = alert.querySelector('button');
          if (closeBtn) {
            try {
              closeBtn.remove();
            } catch (e) {
              // ignore
            }
          }
          return alert.textContent.trim().replace(/\s+/g, ' ');
        }

        // Form field errors
        const hasError = doc.querySelector('.has-error, .help-block');
        if (hasError) {
          return hasError.textContent.trim().replace(/\s+/g, ' ');
        }
      } catch (e) {
        console.error('Failed to parse error message:', e);
      }
      return null;
    }

    /**
     * Polls the submissions/me page for the status of a specific submission.
     * @param {string} contestId
     * @param {string} submissionId
     * @param {Function} callback
     */
    poll(contestId, submissionId, callback) {
      let pollInterval = 2000; // Start at 2 seconds
      const maxPollInterval = 10000; // Cap at 10 seconds to reduce server load
      const startTime = Date.now();
      const maxDuration = 5 * 60 * 1000; // 5 minutes timeout limit

      const checkStatus = () => {
        if (Date.now() - startTime > maxDuration) {
          console.error('[AtCoder Workspace] Polling timed out after 5 minutes');
          callback({
            submissionId,
            status: 'ERR',
            isComplete: true,
            turnstileDebug: this.lastTurnstileStatus,
          });
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove('pending_submission');
          }
          return;
        }

        fetch(`/contests/${contestId}/submissions/me?_=${Date.now()}`, { credentials: 'include' })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`結果の取得に失敗しました (ステータス: ${res.status})`);
            }
            return res.text();
          })
          .then((html) => {
            const info = this.parseSubmissionRow(html, submissionId, contestId);
            if (!info) {
              // Submission might not be visible in the first page yet, wait and retry
              pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
              setTimeout(checkStatus, pollInterval);
              return;
            }

            const status = info.status;
            const isComplete = this.isFinalStatus(status);

            callback({
              submissionId,
              status: status,
              time: info.time,
              memory: info.memory,
              isComplete,
              turnstileDebug: this.lastTurnstileStatus,
            });

            if (isComplete) {
              if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove('pending_submission');
              }
            } else {
              pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
              setTimeout(checkStatus, pollInterval);
            }
          })
          .catch((err) => {
            console.error('[AtCoder Workspace] Polling error:', err);
            // Don't abort immediately on a single polling network error, retry
            pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
            setTimeout(checkStatus, pollInterval);
          });
      };

      setTimeout(checkStatus, pollInterval);
    }

    /**
     * Parses the submission row for status, time, and memory.
     * @param {string} htmlText
     * @param {string} submissionId
     * @param {string} contestId
     * @returns {Object|null}
     */
    parseSubmissionRow(htmlText, submissionId, _contestId) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const table = doc.querySelector('table');
      if (!table) return null;

      // Find header mapping
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
        th.textContent.trim()
      );
      let statusIdx = 6;
      let timeIdx = 7;
      let memoryIdx = 8;

      if (headers.length > 0) {
        const findHeaderIndex = (names) => {
          return headers.findIndex((h) => names.some((name) => h.includes(name)));
        };
        const sIdx = findHeaderIndex(['結果', 'Status']);
        if (sIdx !== -1) statusIdx = sIdx;
        const tIdx = findHeaderIndex(['実行時間', 'Time']);
        if (tIdx !== -1) timeIdx = tIdx;
        const mIdx = findHeaderIndex(['メモリ', 'Memory']);
        if (mIdx !== -1) memoryIdx = mIdx;
      }

      const rows = Array.from(table.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const link = row.querySelector(`a[href*="/submissions/${submissionId}"]`);
        if (link) {
          const cells = row.querySelectorAll('td');
          if (cells.length > Math.max(statusIdx, timeIdx, memoryIdx)) {
            const statusCell = cells[statusIdx];
            let statusText = statusCell.textContent.trim();
            const badge = statusCell.querySelector('span');
            if (badge) {
              statusText = badge.textContent.trim();
            }

            const timeText = cells[timeIdx] ? cells[timeIdx].textContent.trim() : '';
            const memoryText = cells[memoryIdx] ? cells[memoryIdx].textContent.trim() : '';

            return {
              status: statusText,
              time: timeText,
              memory: memoryText,
            };
          }
        }
      }
      return null;
    }

    /**
     * Determines if a status is final.
     * @param {string} status
     * @returns {boolean}
     */
    isFinalStatus(status) {
      if (!status) return false;
      const uStatus = status.toUpperCase();
      if (uStatus === 'WJ') return false;
      if (/^\d+\/\d+$/.test(uStatus)) return false;
      return true;
    }
  }

  window.AtCoderWorkspace.Submitter = new Submitter();
})();
