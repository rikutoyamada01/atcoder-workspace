(function () {
  'use strict';

  window.AtCoderWorkspace = window.AtCoderWorkspace || {};

  /**
   * Scraper handles DOM inspection of AtCoder problem pages
   * to extract sample test cases and list navigation URLs.
   */
  class Scraper {
    /**
     * Extracts sample inputs and outputs from the task statement DOM.
     * @returns {Object} { cases: Array<{input: string, expected: string}>, warning: string|null, error: string|null }
     */
    extractSampleCases() {
      const taskStatement = document.getElementById('task-statement');
      if (!taskStatement) {
        return {
          cases: [],
          warning: null,
          error: '問題文 (task-statement) がページ内に見つかりません。'
        };
      }

      // Decide whether to use Japanese or English version based on visibility
      let root = taskStatement;
      const langJa = taskStatement.querySelector('.lang-ja');
      const langEn = taskStatement.querySelector('.lang-en');

      if (langJa) {
        const display = this._getDisplayProperty(langJa);
        if (display !== 'none') {
          root = langJa;
        } else if (langEn) {
          root = langEn;
        }
      } else if (langEn) {
        root = langEn;
      }

      const inputs = [];
      const outputs = [];

      // Look for headings that indicate input/output samples
      const headings = Array.from(root.querySelectorAll('h3, h4, .part h3, .part h4'));

      headings.forEach((h) => {
        const text = h.textContent.trim();
        let sibling = h.nextElementSibling;
        let pre = null;

        while (sibling) {
          if (sibling.tagName === 'PRE') {
            pre = sibling;
            break;
          }
          const childPre = sibling.querySelector('pre');
          if (childPre) {
            pre = childPre;
            break;
          }
          // Stop searching if we encounter another heading level
          if (['H3', 'H4'].includes(sibling.tagName)) {
            break;
          }
          sibling = sibling.nextElementSibling;
        }

        if (pre) {
          const sampleText = pre.textContent;
          if (text.includes('入力例') || text.toLowerCase().includes('input')) {
            inputs.push(sampleText);
          } else if (text.includes('出力例') || text.toLowerCase().includes('output')) {
            outputs.push(sampleText);
          }
        }
      });

      const samples = [];
      const len = Math.min(inputs.length, outputs.length);
      for (let i = 0; i < len; i++) {
        samples.push({
          input: inputs[i],
          expected: outputs[i]
        });
      }

      let warning = null;
      let error = null;

      if (inputs.length !== outputs.length) {
        warning = `入力例 (${inputs.length}件) と出力例 (${outputs.length}件) の数が一致しません。`;
      }
      if (samples.length === 0) {
        error = 'サンプルケースが見つかりませんでした。';
      }

      return {
        cases: samples,
        warning,
        error
      };
    }

    /**
     * Resolves display computed style property safely.
     * @private
     * @param {Element} element
     * @returns {string}
     */
    _getDisplayProperty(element) {
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        try {
          const style = window.getComputedStyle(element);
          return style ? style.display : '';
        } catch (e) {
          return '';
        }
      }
      return '';
    }

    /**
     * Fetches the task list for the current contest and parses navigation links.
     * @param {string} contestId - The current contest ID.
     * @param {Function} callback - Callback received with (prevUrl, nextUrl).
     */
    loadNavigationUrls(contestId, callback) {
      fetch(`/contests/${contestId}/tasks`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch task list: ' + res.status);
          return res.text();
        })
        .then((html) => {
          if (!html) {
            callback(null, null);
            return;
          }
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          if (!doc) {
            callback(null, null);
            return;
          }

          const anchors = doc.querySelectorAll('table tbody tr td a');
          if (!anchors || anchors.length === 0) {
            callback(null, null);
            return;
          }

          const links = [];
          anchors.forEach((a) => {
            if (a && typeof a.getAttribute === 'function') {
              const href = a.getAttribute('href');
              if (href && typeof href === 'string' && href.includes(`/contests/${contestId}/tasks/`)) {
                links.push(href);
              }
            }
          });

          const uniqueUrls = [...new Set(links)]
            .map((href) => {
              if (typeof href !== 'string') return '';
              return href.startsWith('/') ? href : '/' + href;
            })
            .filter(Boolean);

          const currentPath = window.location.pathname;
          const index = uniqueUrls.findIndex((url) => {
            if (typeof url !== 'string') return false;
            return currentPath.includes(url) || url.includes(currentPath);
          });

          let prevUrl = null;
          let nextUrl = null;
          if (index !== -1) {
            prevUrl = index > 0 ? uniqueUrls[index - 1] : null;
            nextUrl = index < uniqueUrls.length - 1 ? uniqueUrls[index + 1] : null;
          }
          callback(prevUrl, nextUrl);
        })
        .catch((err) => {
          console.error('Error fetching task navigation:', err);
          callback(null, null);
        });
    }
  }

  window.AtCoderWorkspace.Scraper = new Scraper();
})();
