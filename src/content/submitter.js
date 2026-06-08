(function () {
  'use strict';

  window.AtCoderWorkspace = window.AtCoderWorkspace || {};

  /**
   * Submitter handles posting submission data to AtCoder and
   * polling the status of the submission until judging completes.
   */
  class Submitter {
    /**
     * Extracts the CSRF token.
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
     * Submits code to AtCoder and polls the status.
     * @param {string} contestId
     * @param {string} problemId
     * @param {string} languageId
     * @param {string} code
     * @param {Function} callback - Called with progress updates or error
     */
    submit(contestId, problemId, languageId, code, callback) {
      const csrfToken = this.getCsrfToken();
      if (!csrfToken) {
        callback({ error: 'CSRFトークンが見つかりません。' });
        return;
      }

      const params = new URLSearchParams();
      params.append('csrf_token', csrfToken);
      params.append('data.TaskScreenName', problemId);
      params.append('data.LanguageId', languageId);
      params.append('sourceCode', code);

      fetch(`/contests/${contestId}/submit`, {
        method: 'POST',
        body: params
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`送信に失敗しました (ステータス: ${res.status})`);
          }
          return res.text();
        })
        .then((html) => {
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
        })
        .catch((err) => {
          console.error('[AtCoder Workspace] Submission error:', err);
          callback({ error: err.message || '送信中にエラーが発生しました。' });
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
        fetch(`/contests/${contestId}/submissions/me?_=${Date.now()}`)
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
