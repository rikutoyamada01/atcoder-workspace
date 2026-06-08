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
            throw new Error('AtCoderにログインしていません。ログインしてください。');
          }
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const tokenInput = doc.querySelector('input[name="csrf_token"]');
          if (tokenInput && tokenInput.value) {
            return tokenInput.value;
          }
          throw new Error('CSRFトークンが見つかりません。コンテストへの登録状態を確認してください。');
        });
    }

    /**
     * Waits for the Cloudflare Turnstile hidden input to receive a valid token.
     * Turnstile tokens are long base64 strings (typically 300+ chars).
     * @param {HTMLInputElement|null} input
     * @returns {Promise<void>}
     */
    waitForTurnstile(input) {
      // No Turnstile on this page – proceed immediately
      if (!input) return Promise.resolve();
      // Already has a valid-looking token (long string, not 'hidden' or empty)
      if (input.value && input.value.length > 20) return Promise.resolve();

      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          if (input.value && input.value.length > 20) {
            console.log('[AtCoder Workspace] Turnstile token received.');
            resolve();
          } else if (Date.now() - start > 15000) {
            // Timeout after 15s – proceed anyway (might fail)
            console.warn('[AtCoder Workspace] Turnstile token not received within 15s, proceeding without it.');
            resolve();
          } else {
            setTimeout(check, 300);
          }
        };
        check();
      });
    }

    /**
     * Submits code to AtCoder and polls the status.
     *
     * Strategy: Use the NATIVE submit form on the current task page.
     * The task page has a submit form that includes CSRF token, Turnstile
     * response, and all necessary hidden fields. By using FormData from
     * this live DOM form, we include everything AtCoder expects — including
     * the Cloudflare Turnstile token that can only be obtained from a
     * rendered page (not via fetch).
     *
     * @param {string} contestId
     * @param {string} problemId
     * @param {string} languageId
     * @param {string} code
     * @param {Function} callback - Called with progress updates or error
     */
    submit(contestId, problemId, languageId, code, callback) {
      // Find the native submit form on the current task page
      const nativeForm = document.querySelector('form[action*="/submit"]');

      if (nativeForm) {
        this._submitViaNativeForm(nativeForm, contestId, problemId, languageId, code, callback);
      } else {
        // Fallback: POST manually (will likely fail if Turnstile is required)
        console.warn('[AtCoder Workspace] Native submit form not found, falling back to manual POST.');
        this._submitManual(contestId, problemId, languageId, code, callback);
      }
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

      // Also check for hidden input version
      const langInput = form.querySelector('input[name="data.LanguageId"]');
      if (langInput) langInput.value = languageId;

      // Wait for the Turnstile widget to generate a valid token
      const turnstileInput = form.querySelector('input[name="cf-turnstile-response"]');
      this.waitForTurnstile(turnstileInput)
        .then(() => {
          // Build FormData from the live native form – captures ALL fields
          // including csrf_token, cf-turnstile-response, and any other hidden inputs
          const formData = new FormData(form);

          // Ensure sourceCode is set (FormData reads from textarea.value)
          if (!formData.get('sourceCode') || formData.get('sourceCode').trim() === '') {
            formData.set('sourceCode', code);
          }

          // Debug: log what we're sending (redact sensitive values)
          const debugEntries = [];
          for (const [key, val] of formData.entries()) {
            if (key === 'sourceCode') {
              debugEntries.push(`${key}=[${typeof val === 'string' ? val.length : 0} chars]`);
            } else if (key === 'csrf_token') {
              debugEntries.push(`${key}=${String(val).substring(0, 8)}...`);
            } else if (key === 'cf-turnstile-response') {
              debugEntries.push(`${key}=[${String(val).length} chars]`);
            } else if (val instanceof File) {
              debugEntries.push(`${key}=[File: ${val.name || 'empty'}]`);
            } else {
              debugEntries.push(`${key}=${val}`);
            }
          }
          console.log('[AtCoder Workspace] Submitting via native form:', debugEntries);

          const actionUrl = form.getAttribute('action') || `/contests/${contestId}/submit`;
          return fetch(actionUrl, {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
        })
        .then((res) => this._handleSubmitResponse(res, contestId, callback))
        .catch((err) => {
          console.error('[AtCoder Workspace] Submission error:', err);
          callback({ error: err.message || '送信中にエラーが発生しました。' });
        });
    }

    /**
     * Fallback submission path: builds FormData manually without DOM form.
     * This path does NOT include a Turnstile token and may fail on
     * pages protected by Cloudflare Turnstile.
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
            credentials: 'include'
          });
        })
        .then((res) => this._handleSubmitResponse(res, contestId, callback))
        .catch((err) => {
          console.error('[AtCoder Workspace] Submission error:', err);
          callback({ error: err.message || '送信中にエラーが発生しました。' });
        });
    }

    /**
     * Handles the POST response from the submit endpoint.
     * @private
     */
    _handleSubmitResponse(res, contestId, callback) {
      return res.text().then((html) => {
        // Check if session has expired / not logged in
        if (html.includes('/login') || html.includes('ログイン') || html.includes('Sign In')) {
          throw new Error('AtCoderにログインしていません。ログインしてください。');
        }

        // Check for validation errors in the HTML response
        const errorMsg = this.extractErrorMessage(html);
        if (errorMsg) {
          if (errorMsg.includes('エラーが発生しました') || errorMsg === 'エラーが発生しました。') {
            throw new Error('エラーが発生しました。（セッション切れ、コンテストの未登録、またはCSRFトークン不一致の可能性があります。一度ページをリロードしてからお試しください。）');
          }
          throw new Error(errorMsg);
        }

        // Parse submission ID from redirected HTML response
        const submissionId = this.parseSubmissionId(html, contestId);
        if (!submissionId) {
          console.warn('[AtCoder Workspace] Could not parse submissionId from submit response, checking submissions/me...');
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
          isComplete: false
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
            throw new Error('AtCoderにログインしていません。ログインしてください。');
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
            } catch (e) {}
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
              isComplete
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
    parseSubmissionRow(htmlText, submissionId, contestId) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      const table = doc.querySelector('table');
      if (!table) return null;

      // Find header mapping
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      let statusIdx = 6;
      let timeIdx = 7;
      let memoryIdx = 8;

      if (headers.length > 0) {
        const findHeaderIndex = (names) => {
          return headers.findIndex(h => names.some(name => h.includes(name)));
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
              memory: memoryText
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
