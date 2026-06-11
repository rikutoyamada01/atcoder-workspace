(function () {
  'use strict';

  // Parse contest and task IDs from pathname
  const pathMatch = window.location.pathname.match(/\/contests\/([^/]+)\/tasks\/([^/]+)/);
  if (!pathMatch) return;

  const contestId = pathMatch[1];
  const problemId = pathMatch[2];

  let langSelect = null;

  /**
   * Initializes the workspace and coordinates modules.
   */
  function init() {
    langSelect = document.querySelector('select[name="data.LanguageId"]');

    const layout = window.AtCoderWorkspace.Layout;
    if (!layout) {
      console.error('[AtCoder Workspace] Layout module not found!');
      return;
    }

    // Initialize layout; notify editor on resizing
    layout.init(() => {
      notifyEditor({ type: 'resize' });
    });

    setupMessageEvents();
  }

  /**
   * Binds communication events between the extension background/editor page and host AtCoder page.
   */
  function setupMessageEvents() {
    const layout = window.AtCoderWorkspace.Layout;
    const scraper = window.AtCoderWorkspace.Scraper;
    const runner = window.AtCoderWorkspace.Runner;

    window.addEventListener('message', (e) => {
      const iframe = layout ? layout.getIframe() : null;
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (!e.data || typeof e.data !== 'object') return;

      console.log(
        '[AtCoder Workspace] Content Script: Received message from iframe',
        e.data.type,
        e.data
      );

      switch (e.data.type) {
        case 'editor-ready':
          if (!scraper) return;
          scraper.loadNavigationUrls(contestId, (prevUrl, nextUrl) => {
            const options = [];
            if (langSelect) {
              langSelect.querySelectorAll('option').forEach((opt) => {
                options.push({
                  value: opt.value,
                  text: opt.textContent,
                });
              });
            }

            // Detect page dark mode based on background brightness
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            const rgb = bodyBg.match(/\d+/g);
            let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (rgb && rgb.length >= 3) {
              const brightness =
                (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
              isDark = brightness < 125;
            }

            // AtCoder language selection element helper logic (with retries)
            const sendConfigWithRetry = (retriesLeft) => {
              const selectedLanguageId = langSelect ? langSelect.value : null;

              if (!selectedLanguageId && retriesLeft > 0) {
                console.log('[AtCoder Workspace] Language selection empty, retrying in 100ms...');
                setTimeout(() => sendConfigWithRetry(retriesLeft - 1), 100);
                return;
              }

              notifyEditor({
                type: 'init-config',
                contestId,
                problemId,
                selectedLanguageId:
                  selectedLanguageId || (options.length > 0 ? options[0].value : null),
                languages: options,
                prevUrl,
                nextUrl,
                isDark,
              });
            };

            sendConfigWithRetry(5);
          });
          break;

        case 'update-language':
          if (langSelect && e.data.languageId) {
            langSelect.value = e.data.languageId;
            langSelect.dispatchEvent(new Event('change'));
          }
          break;

        case 'navigate':
          if (e.data.url) {
            window.location.href = e.data.url;
          }
          break;

        case 'submit-code':
          try {
            const submitter = window.AtCoderWorkspace.Submitter;
            if (!submitter) {
              notifyEditor({
                type: 'submit-error',
                message: '提出モジュールが見つかりません。',
              });
              break;
            }
            if (!e.data.code || !e.data.code.trim()) {
              notifyEditor({
                type: 'submit-error',
                message: '提出するコードを入力してください。',
              });
              break;
            }
            if (!e.data.languageId) {
              notifyEditor({
                type: 'submit-error',
                message: 'プログラミング言語が選択されていません。',
              });
              break;
            }

            notifyEditor({
              type: 'submit-start',
            });

            submitter.submit(contestId, problemId, e.data.languageId, e.data.code, (res) => {
              if (res.error) {
                notifyEditor({
                  type: 'submit-error',
                  message: res.error,
                });
              } else if (res.status === 'WAITING_CAPTCHA') {
                notifyEditor({
                  type: 'submit-captcha-waiting',
                  message: res.message,
                });
              } else if (res.isComplete) {
                notifyEditor({
                  type: 'submit-complete',
                  submissionId: res.submissionId,
                  status: res.status,
                  time: res.time,
                  memory: res.memory,
                });
              } else {
                notifyEditor({
                  type: 'submit-status',
                  submissionId: res.submissionId,
                  status: res.status,
                  time: res.time,
                  memory: res.memory,
                });
              }
            });
          } catch (err) {
            console.error('Submission execution failed:', err);
            notifyEditor({
              type: 'submit-error',
              message: '提出処理中にエラーが発生しました: ' + err.message,
            });
          }
          break;

        case 'run-tests':
          try {
            if (!e.data.languageId) {
              notifyEditor({
                type: 'test-error',
                message: 'プログラミング言語が選択されていません。',
              });
              break;
            }
            if (!e.data.code || !e.data.code.trim()) {
              notifyEditor({
                type: 'test-error',
                message: '実行するコードを入力してください。',
              });
              break;
            }
            if (!scraper || !runner) {
              notifyEditor({
                type: 'test-error',
                message: 'モジュール初期化エラーが発生しました。',
              });
              break;
            }

            // Extract sample test cases
            const scrapeResult = scraper.extractSampleCases();
            if (scrapeResult.error) {
              notifyEditor({
                type: 'test-error',
                message: scrapeResult.error,
              });
              break;
            }

            if (scrapeResult.warning) {
              console.warn(`[AtCoder Workspace] ${scrapeResult.warning}`);
            }

            const samples = scrapeResult.cases;

            notifyEditor({
              type: 'test-start',
              total: samples.length,
            });

            runner.runSampleTests(
              contestId,
              e.data.code,
              e.data.languageId,
              samples,
              (caseRes) => {
                notifyEditor({
                  type: 'test-case-result',
                  index: caseRes.index,
                  status: caseRes.status,
                  time: caseRes.time,
                  memory: caseRes.memory,
                  output: caseRes.output,
                  expected: caseRes.expected,
                  stderr: caseRes.stderr,
                  message: caseRes.message,
                });
              },
              () => {
                notifyEditor({ type: 'test-complete' });
              }
            );
          } catch (err) {
            console.error('Test execution failed:', err);
            notifyEditor({
              type: 'test-error',
              message: 'テスト実行中にエラーが発生しました: ' + err.message,
            });
          }
          break;
      }
    });

    // Listen to lang dropdown changes directly on AtCoder main page
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        notifyEditor({
          type: 'language-change',
          languageId: langSelect.value,
        });
      });
    }
  }

  /**
   * Helper function to post messages to the editor iframe.
   * @param {Object} message
   */
  function notifyEditor(message) {
    const layout = window.AtCoderWorkspace.Layout;
    const iframe = layout ? layout.getIframe() : null;
    if (iframe && iframe.contentWindow) {
      console.log(
        '[AtCoder Workspace] Content Script: Sending message to iframe',
        message.type,
        message
      );
      iframe.contentWindow.postMessage(message, '*');
    }
  }

  // Keyboard shortcut listener (Ctrl+J) to toggle console visibility
  window.addEventListener('keydown', (e) => {
    const layout = window.AtCoderWorkspace.Layout;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
      if (layout && layout.isOpen()) {
        const iframe = layout.getIframe();
        if (iframe && iframe.contentWindow) {
          e.preventDefault();
          notifyEditor({ type: 'toggle-console' });
        }
      }
    }
  });

  // Run initializer on document ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
