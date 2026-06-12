(function () {
  'use strict';

  window.AtCoderWorkspace = window.AtCoderWorkspace || {};

  /**
   * Submitter handles posting submission data to AtCoder and
   * polling the status of the submission until judging completes.
   */
  class Submitter {
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
      // Check if there is a Turnstile container on the page
      let hasTurnstile = false;
      if (form) {
        const container = form.querySelector(
          '.cf-turnstile, #cf-turnstile, [class*="cf-turnstile"], [id*="cf-turnstile"]'
        );
        if (container) hasTurnstile = true;
      } else if (input) {
        hasTurnstile = true;
      }

      // No Turnstile on this page – proceed immediately
      if (!hasTurnstile && !input) return Promise.resolve();
      // Already has a valid-looking token (long string, not 'hidden' or empty)
      if (input && input.value && input.value.length > 20) return Promise.resolve();

      return new Promise((resolve, reject) => {
        const start = Date.now();
        let scrolled = false;

        const check = () => {
          const currentInput =
            input || (form ? form.querySelector('input[name="cf-turnstile-response"]') : null);
          if (currentInput && currentInput.value && currentInput.value.length > 20) {
            console.log('[AtCoder Workspace] Turnstile token received.');
            // Remove highlight if applied
            if (form) {
              const container = form.querySelector(
                '.cf-turnstile, #cf-turnstile, [class*="cf-turnstile"], [id*="cf-turnstile"]'
              );
              if (container) {
                container.style.outline = '';
                container.style.boxShadow = '';
              }
            }
            resolve();
          } else {
            const elapsed = Date.now() - start;

            // 4 seconds passed and still no token – ask user to check and solve Turnstile
            if (elapsed > 4000 && !scrolled) {
              scrolled = true;
              if (callback) {
                callback({
                  status: 'WAITING_CAPTCHA',
                  message: 'ボット認証（Cloudflare Turnstile）を待機しています。手動でのクリック（私は人間です）が必要な場合があります。',
                });
              }

              // Scroll to the Turnstile container and highlight it
              if (form) {
                const container = form.querySelector(
                  '.cf-turnstile, #cf-turnstile, [class*="cf-turnstile"], [id*="cf-turnstile"]'
                );
                if (container) {
                  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  container.style.outline = '3px solid #ff4d4f';
                  container.style.outlineOffset = '4px';
                  container.style.borderRadius = '4px';
                  container.style.boxShadow = '0 0 12px rgba(255, 77, 79, 0.7)';
                  container.style.transition = 'all 0.3s ease';
                }
              }
            }

            if (elapsed > 45000) { // Timeout after 45s
              // Remove highlight
              if (form) {
                const container = form.querySelector(
                  '.cf-turnstile, #cf-turnstile, [class*="cf-turnstile"], [id*="cf-turnstile"]'
                );
                if (container) {
                  container.style.outline = '';
                  container.style.boxShadow = '';
                }
              }
              reject(
                new Error(
                  'ボット判定(Cloudflare Turnstile)の自動認証がタイムアウトしました。左側の提出フォーム内のチェックボックスを手動でクリックして認証を完了させてから再度お試しください。'
                )
              );
            } else {
              setTimeout(check, 300);
            }
          }
        };
        check();
      });
    }

    /**
     * Submits code to AtCoder and polls the status.
     *
     * Strategy: Load the official submit page (/contests/{contestId}/submit)
     * inside a hidden iframe. This triggers Cloudflare Turnstile to execute
     * and automatically solve itself in most cases. If Cloudflare demands a
     * manual click, the iframe is popped up in the center of the screen
     * temporarily so the user can click it.
     *
     * @param {string} contestId
     * @param {string} problemId
     * @param {string} languageId
     * @param {string} code
     * @param {Function} callback - Called with progress updates or error
     */
    submit(contestId, problemId, languageId, code, callback) {
      this._submitViaHiddenIframe(contestId, problemId, languageId, code, callback);
    }

    /**
     * Submission path: loads /submit page in an iframe to handle Turnstile.
     * @private
     */
    _submitViaHiddenIframe(contestId, problemId, languageId, code, callback) {
      console.log('[AtCoder Workspace] Preparing hidden iframe for submission...');

      // 1. Remove any stale iframe
      const existingIframe = document.getElementById('atcoder-workspace-submit-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      // 2. Create hidden iframe (must be sized and positioned offscreen, not display:none,
      // so Turnstile's iframe inside can render and execute script properly)
      const iframe = document.createElement('iframe');
      iframe.id = 'atcoder-workspace-submit-iframe';
      iframe.style.position = 'fixed';
      iframe.style.width = '320px';
      iframe.style.height = '180px';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.backgroundColor = '#ffffff';
      iframe.style.border = 'none';
      iframe.src = `/contests/${contestId}/submit?task_screen_name=${problemId}`;
      document.body.appendChild(iframe);

      if (callback) {
        callback({
          status: 'WAITING_CAPTCHA',
          message: '提出ページをロード中（ボット判定を解決しています）...',
        });
      }

      let submissionAttempted = false;

      // 3. Handle load and Turnstile polling
      iframe.onload = () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const form = iframeDoc.querySelector('form[action*="/submit"]');
          if (!form) {
            // Check if login is required
            if (
              iframeDoc.body.innerHTML.includes('/login') ||
              iframeDoc.body.innerHTML.includes('ログイン') ||
              iframeDoc.body.innerHTML.includes('Sign In')
            ) {
              throw new Error(
                'AtCoderにログインしていません。提出するには AtCoder のサイトでログインしてください。'
              );
            }
            throw new Error(
              '提出フォームが見つかりません。コンテストへの登録状態を確認してください。'
            );
          }

          const turnstileInput = form.querySelector('input[name="cf-turnstile-response"]');

          this.waitForTurnstile(turnstileInput, form, callback)
            .then(() => {
              if (submissionAttempted) return;
              submissionAttempted = true;

              if (callback) {
                callback({
                  status: 'SUBMITTING',
                  message: 'コードを送信しています...',
                });
              }

              // Set values on the iframe form
              const textarea = form.querySelector('textarea[name="sourceCode"]');
              if (textarea) textarea.value = code;

              const taskInput = form.querySelector('[name="data.TaskScreenName"]');
              if (taskInput) taskInput.value = problemId;

              const langSelect = form.querySelector('select[name="data.LanguageId"]');
              if (langSelect) langSelect.value = languageId;

              const langInput = form.querySelector('input[name="data.LanguageId"]');
              if (langInput) langInput.value = languageId;

              const formData = new FormData(form);
              if (!formData.get('sourceCode') || formData.get('sourceCode').trim() === '') {
                formData.set('sourceCode', code);
              }

              const actionUrl = form.getAttribute('action') || `/contests/${contestId}/submit`;
              return fetch(actionUrl, {
                method: 'POST',
                body: formData,
                credentials: 'include',
              });
            })
            .then((res) => {
              if (res) return this._handleSubmitResponse(res, contestId, callback);
            })
            .catch((err) => {
              console.error('[AtCoder Workspace] Iframe submission error:', err);
              callback({ error: err.message || '送信中にエラーが発生しました。' });
            })
            .finally(() => {
              // Remove the iframe safely after submission
              setTimeout(() => {
                const f = document.getElementById('atcoder-workspace-submit-iframe');
                if (f) f.remove();
              }, 2000);
            });
        } catch (err) {
          console.error('[AtCoder Workspace] Hidden iframe setup failed:', err);
          callback({ error: err.message || '提出ページの初期化に失敗しました。' });
          if (iframe) iframe.remove();
        }
      };

      // Iframe loading timeout (15s)
      setTimeout(() => {
        const f = document.getElementById('atcoder-workspace-submit-iframe');
        if (f && f.onload && !submissionAttempted) {
          f.onload = null;
          f.remove();
          callback({
            error:
              '提出ページのロードがタイムアウトしました。通信環境を確認し、ページをリロードして再度お試しください。',
          });
        }
      }, 15000);
    }

    /**
     * Handles the POST response from the submit endpoint.
     * @private
     */
    _handleSubmitResponse(res, contestId, callback) {
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
          // Send initial status update
          callback({
            submissionId,
            status: 'WJ',
            time: '',
            memory: '',
            isComplete: false,
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
      const pollInterval = 2000; // 2 seconds

      const checkStatus = () => {
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
            });

            if (!isComplete) {
              setTimeout(checkStatus, pollInterval);
            }
          })
          .catch((err) => {
            console.error('[AtCoder Workspace] Polling error:', err);
            // Don't abort immediately on a single polling network error, retry
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
