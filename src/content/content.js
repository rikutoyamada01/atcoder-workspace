(function () {
  'use strict';

  // Parse contest and task IDs from pathname
  const pathMatch = window.location.pathname.match(/\/contests\/([^/]+)\/tasks\/([^/]+)/);
  if (!pathMatch) return;

  const contestId = pathMatch[1];
  const problemId = pathMatch[2];

  let langSelect = null;
  let isEditorReady = false;
  const messageQueue = [];

  /**
   * Safely retrieves the language select element, binding change listener if newly found.
   * @returns {HTMLSelectElement|null}
   */
  function getLangSelect() {
    if (!langSelect) {
      langSelect = document.querySelector('select[name="data.LanguageId"]');
      if (langSelect) {
        langSelect.addEventListener('change', () => {
          notifyEditor({
            type: 'language-change',
            languageId: langSelect.value,
          });
          if (
            langSelect.value &&
            typeof chrome !== 'undefined' &&
            chrome.storage &&
            chrome.storage.local
          ) {
            chrome.storage.local.set({ 'settings:last_selected_language': langSelect.value });
          }
        });
      }
    }
    return langSelect;
  }

  /**
   * Initializes the workspace and coordinates modules.
   */
  function init() {
    getLangSelect();

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
    checkPendingSubmission();
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
          isEditorReady = true;
          while (messageQueue.length > 0) {
            const queuedMsg = messageQueue.shift();
            notifyEditor(queuedMsg);
          }
          if (!scraper) return;
          scraper.loadNavigationUrls(contestId, (prevUrl, nextUrl) => {
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
              const currentLangSelect = getLangSelect();
              const selectedLanguageId = currentLangSelect ? currentLangSelect.value : null;

              const options = [];
              if (currentLangSelect) {
                currentLangSelect.querySelectorAll('option').forEach((opt) => {
                  options.push({
                    value: opt.value,
                    text: opt.textContent,
                  });
                });
              }

              if (
                (!currentLangSelect || !selectedLanguageId || options.length === 0) &&
                retriesLeft > 0
              ) {
                console.log(
                  '[AtCoder Workspace] Language selection or options empty, retrying in 100ms...'
                );
                setTimeout(() => sendConfigWithRetry(retriesLeft - 1), 100);
                return;
              }

              const sendConfig = (finalLangId) => {
                notifyEditor({
                  type: 'init-config',
                  contestId,
                  problemId,
                  selectedLanguageId: finalLangId,
                  languages: options,
                  prevUrl,
                  nextUrl,
                  isDark,
                });
              };

              if (
                !selectedLanguageId &&
                typeof chrome !== 'undefined' &&
                chrome.storage &&
                chrome.storage.local
              ) {
                chrome.storage.local.get(['settings:last_selected_language'], (res) => {
                  const lastLang = res['settings:last_selected_language'];
                  const existsInOptions = options.some((opt) => opt.value === lastLang);
                  const finalLangId =
                    lastLang && existsInOptions
                      ? lastLang
                      : options.length > 0
                        ? options[0].value
                        : null;

                  // Update the native select element as well
                  if (finalLangId && currentLangSelect && currentLangSelect.value !== finalLangId) {
                    currentLangSelect.value = finalLangId;
                    currentLangSelect.dispatchEvent(new Event('change'));
                  }

                  sendConfig(finalLangId);
                });
              } else {
                const finalLangId =
                  selectedLanguageId || (options.length > 0 ? options[0].value : null);
                sendConfig(finalLangId);
              }
            };

            sendConfigWithRetry(10);
          });
          break;

        case 'update-language': {
          const currentLangSelect = getLangSelect();
          if (currentLangSelect && e.data.languageId) {
            currentLangSelect.value = e.data.languageId;
            currentLangSelect.dispatchEvent(new Event('change'));
          }
          break;
        }

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
                  turnstileDebug: res.turnstileDebug,
                });
              } else {
                notifyEditor({
                  type: 'submit-status',
                  submissionId: res.submissionId,
                  status: res.status,
                  time: res.time,
                  memory: res.memory,
                  turnstileDebug: res.turnstileDebug,
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
  }

  /**
   * Helper function to post messages to the editor iframe.
   * @param {Object} message
   */
  function notifyEditor(message) {
    if (!isEditorReady) {
      console.log(
        '[AtCoder Workspace] Content Script: Queueing message to iframe (editor not ready yet)',
        message.type,
        message
      );
      messageQueue.push(message);
      return;
    }

    const layout = window.AtCoderWorkspace.Layout;
    const iframe = layout ? layout.getIframe() : null;
    if (iframe && iframe.contentWindow) {
      console.log(
        '[AtCoder Workspace] Content Script: Sending message to iframe',
        message.type,
        message
      );
      iframe.contentWindow.postMessage(message, '*');
    } else {
      console.log(
        '[AtCoder Workspace] Content Script: Queueing message (iframe not available)',
        message.type,
        message
      );
      messageQueue.push(message);
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

  /**
   * Checks if there is a pending submission in storage and resumes polling if found.
   */
  function checkPendingSubmission() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get(['pending_submission'], (res) => {
      const pending = res.pending_submission;
      if (!pending) return;

      console.log('[AtCoder Workspace] Found pending submission in storage. Resuming polling...', pending);

      const submitter = window.AtCoderWorkspace.Submitter;
      if (!submitter) {
        console.error('[AtCoder Workspace] Submitter module not found during resume!');
        return;
      }

      // Notify editor that we are resuming a background submission polling
      notifyEditor({
        type: 'pending-submit-status',
        problemId: pending.problemId,
        submissionId: pending.submissionId,
        status: 'WJ',
        time: '',
        memory: '',
      });

      submitter.poll(pending.contestId, pending.submissionId, (pollRes) => {
        if (pollRes.error) {
          notifyEditor({
            type: 'submit-error',
            message: pollRes.error,
          });
        } else if (pollRes.isComplete) {
          notifyEditor({
            type: 'pending-submit-complete',
            submissionId: pollRes.submissionId,
            contestId: pending.contestId,
            problemId: pending.problemId,
            languageId: pending.languageId,
            code: pending.code,
            status: pollRes.status,
            time: pollRes.time,
            memory: pollRes.memory,
          });
        } else {
          notifyEditor({
            type: 'pending-submit-status',
            problemId: pending.problemId,
            submissionId: pollRes.submissionId,
            status: pollRes.status,
            time: pollRes.time,
            memory: pollRes.memory,
          });
        }
      });
    });
  }

  // Run initializer on document ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
