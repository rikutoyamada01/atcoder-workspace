(function () {
  'use strict';

  let editor = null;
  let contestId = null;
  let problemId = null;
  let currentLanguageId = null;

  let prevUrl = null;
  let nextUrl = null;
  let saveTimeout = null;

  // DOM Elements
  const langSelect = document.getElementById('language-select');
  const saveStatus = document.getElementById('save-status');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const testBtn = document.getElementById('test-btn');
  const submitBtn = document.getElementById('submit-btn');
  const consoleToggleBtn = document.getElementById('console-slider-btn');
  const testSummary = document.getElementById('test-summary');
  const consolePanel = document.getElementById('console-panel');
  const consoleResults = document.getElementById('console-results');

  let isTesting = false;
  let isSubmitting = false;
  let isSubmitPhase1 = false;
  let resultsCount = 0;
  let acCount = 0;
  let totalCount = 0;

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setButtonsDisabled(disabled) {
    // Block navigation during Phase 1 submission or sample testing
    prevBtn.disabled = isSubmitPhase1 || isTesting ? true : !prevUrl;
    nextBtn.disabled = isSubmitPhase1 || isTesting ? true : !nextUrl;
    testBtn.disabled = disabled;
    submitBtn.disabled = disabled;
    langSelect.disabled = disabled;
  }

  function toggleConsole(forceState) {
    const isVisible = consolePanel.style.display === 'flex';
    const nextState = forceState !== undefined ? forceState : !isVisible;

    if (nextState) {
      consolePanel.style.display = 'flex';
      consoleToggleBtn.textContent = '▼';
      consoleToggleBtn.classList.add('active');
    } else {
      consolePanel.style.display = 'none';
      consoleToggleBtn.textContent = '▲';
      consoleToggleBtn.classList.remove('active');
    }

    // Defer editor layout to let DOM updates reflect first
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
    }, 0);
  }

  // IndexedDB constants and helper functions
  const DB_NAME = 'AtCoderWorkspaceDB';
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject(e.target.error);
      request.onsuccess = (e) => resolve(e.target.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('submissions')) {
          db.createObjectStore('submissions', { keyPath: 'id' });
        }
      };
    });
  }

  function saveSubmissionToDB(submission) {
    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction('submissions', 'readwrite');
          const store = tx.objectStore('submissions');
          const request = store.put(submission);
          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e.target.error);
        });
      })
      .catch((err) => {
        console.error('[AtCoder Workspace] IndexedDB error:', err);
      });
  }

  // Web Audio API synthesized sounds
  function playChimeAC() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const noteDuration = 0.15; // 150ms per note
      const volume = 0.1;

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * noteDuration);

        gainNode.gain.setValueAtTime(0, ctx.currentTime + index * noteDuration);
        gainNode.gain.linearRampToValueAtTime(
          volume,
          ctx.currentTime + index * noteDuration + 0.02
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + (index + 1.5) * noteDuration
        );

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime + index * noteDuration);
        osc.stop(ctx.currentTime + (index + 2) * noteDuration);
      });
    } catch (err) {
      console.error('Audio playback failed:', err);
    }
  }

  function playBeepWA() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const freq = 220.0; // A3
      const beepDuration = 0.15;
      const gap = 0.1;
      const volume = 0.15;

      [0, beepDuration + gap].forEach((startTimeOffset) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);

        gainNode.gain.setValueAtTime(0, ctx.currentTime + startTimeOffset);
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTimeOffset + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + startTimeOffset + beepDuration
        );

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime + startTimeOffset);
        osc.stop(ctx.currentTime + startTimeOffset + beepDuration);
      });
    } catch (err) {
      console.error('Audio playback failed:', err);
    }
  }

  testBtn.onclick = () => {
    if (isTesting || isSubmitting || !editor) return;
    saveCodeSync();

    // Open console drawer
    toggleConsole(true);
    consoleResults.innerHTML = '<div style="font-size: 12px; color: #777;">準備中...</div>';

    console.log('[AtCoder Workspace] Editor: Sending run-tests message to parent', {
      languageId: currentLanguageId,
      codeLength: editor.getValue().length,
    });

    window.parent.postMessage(
      {
        type: 'run-tests',
        code: editor.getValue(),
        languageId: currentLanguageId,
      },
      '*'
    );
  };

  submitBtn.onclick = () => {
    if (isTesting || isSubmitting || !editor) return;
    saveCodeSync();

    // Open console drawer
    toggleConsole(true);
    consoleResults.innerHTML = '<div style="font-size: 12px; color: #777;">提出準備中...</div>';

    console.log('[AtCoder Workspace] Editor: Sending submit-code message to parent', {
      languageId: currentLanguageId,
      codeLength: editor.getValue().length,
    });

    window.parent.postMessage(
      {
        type: 'submit-code',
        code: editor.getValue(),
        languageId: currentLanguageId,
      },
      '*'
    );
  };

  consoleToggleBtn.onclick = () => {
    toggleConsole();
  };

  // Helper to map AtCoder language names to Monaco Editor language IDs
  function getLanguageMode(langText) {
    if (!langText) return 'plaintext';
    const lower = langText.toLowerCase();

    if (
      lower.includes('c++') ||
      lower.includes('gcc') ||
      lower.includes('clang++') ||
      lower.includes('g++')
    )
      return 'cpp';
    if (lower.includes('python') || lower.includes('pypy')) return 'python';
    if (lower.includes('rust')) return 'rust';
    if (lower.includes('java')) return 'java';
    if (lower.includes('go') || lower.includes('golang')) return 'go';
    if (lower.includes('haskell')) return 'haskell';
    if (lower.includes('javascript') || lower.includes('node') || lower.includes('js'))
      return 'javascript';
    if (lower.includes('typescript') || lower.includes('ts')) return 'typescript';
    if (lower.includes('ruby')) return 'ruby';
    if (lower.includes('c#') || lower.includes('mono')) return 'csharp';
    if (lower.includes('php')) return 'php';
    if (lower.includes('kotlin')) return 'kotlin';
    if (lower.includes('swift')) return 'swift';
    if (lower.includes('scala')) return 'scala';
    if (lower.includes('bash') || lower.includes('shell')) return 'shell';

    return 'plaintext';
  }

  // Notify parent content script that editor is ready
  window.parent.postMessage({ type: 'editor-ready' }, '*');

  // Listen for messages from parent content script
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;

    console.log('[AtCoder Workspace] Editor: Received message from parent', e.data.type, e.data);

    switch (e.data.type) {
      case 'init-config':
        contestId = e.data.contestId;
        problemId = e.data.problemId;
        currentLanguageId = e.data.selectedLanguageId;
        prevUrl = e.data.prevUrl;
        nextUrl = e.data.nextUrl;

        // Configure Navigation Buttons
        updateNavigationButtons();

        // Populate Languages
        populateLanguageSelect(e.data.languages, e.data.selectedLanguageId);

        // Save the last selected language
        if (currentLanguageId && isContextValid()) {
          chrome.storage.local.set({ 'settings:last_selected_language': currentLanguageId });
        }

        // Load Monaco Editor
        initMonaco(e.data.isDark);
        break;

      case 'language-change':
        if (e.data.languageId && e.data.languageId !== currentLanguageId) {
          // Save code under the OLD language ID before switching
          saveCodeSync();
          currentLanguageId = e.data.languageId;
          langSelect.value = currentLanguageId;
          onLanguageChanged();

          // Save the last selected language
          if (currentLanguageId && isContextValid()) {
            chrome.storage.local.set({ 'settings:last_selected_language': currentLanguageId });
          }
        }
        break;

      case 'resize':
        if (editor) {
          editor.layout();
        }
        break;

      case 'toggle-console':
        toggleConsole();
        break;

      case 'submit-start':
        isSubmitting = true;
        isSubmitPhase1 = true;
        setButtonsDisabled(true);
        toggleConsole(true);

        testSummary.textContent = '提出中...';
        testSummary.className = 'summary-running';

        consoleResults.innerHTML =
          '<div style="font-size: 12px; color: #777;">提出処理を開始しました...</div>';
        break;

      case 'submit-captcha-waiting':
        testSummary.textContent = 'ボット認証の待機中...';
        testSummary.className = 'summary-running';

        consoleResults.innerHTML = `
          <div style="font-size: 12px; color: #333;">
            <div style="margin-bottom: 8px; color: #ff8c00; font-weight: bold;">⚠️ ${escapeHtml(e.data.message)}</div>
            <div style="line-height: 1.6;">
              ボット判定（Cloudflare Turnstile）の認証完了を待機しています。<br>
              左側の提出フォーム内のチェックボックス（私は人間です）を必要に応じて手動でクリックして認証を完了させてください。<br>
              （対象エリアまで画面を自動スクロールし、赤枠でハイライトしています）
            </div>
          </div>
        `;
        break;

      case 'submit-status':
        isSubmitPhase1 = false;
        setButtonsDisabled(true); // Re-enable navigation if available because Phase 1 is done

        // Update Console Results
        consoleResults.innerHTML = `
          <div style="font-size: 12px; color: #333;">
            <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-running">${escapeHtml(e.data.status)}</span></div>
            <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
            <div style="margin-bottom: 8px;">メモリ: ${escapeHtml(e.data.memory)}</div>
            <div>
              <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
            </div>
          </div>
        `;
        consoleResults.scrollTop = consoleResults.scrollHeight;

        testSummary.textContent = `ジャッジ中... (${e.data.status})`;
        testSummary.className = 'summary-running';
        break;

      case 'submit-complete': {
        isSubmitting = false;
        isSubmitPhase1 = false;
        setButtonsDisabled(false);

        const isAC = e.data.status === 'AC';
        if (isAC) {
          testSummary.textContent = `ジャッジ完了: ${e.data.status}`;
          testSummary.className = 'summary-ac';
          playChimeAC();
        } else {
          testSummary.textContent = `ジャッジ完了: ${e.data.status}`;
          testSummary.className = 'summary-wa';
          playBeepWA();
        }

        // Update Console Results
        consoleResults.innerHTML = `
          <div style="font-size: 12px; color: #333;">
            <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-${e.data.status.toLowerCase()}">${escapeHtml(e.data.status)}</span></div>
            <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
            <div style="margin-bottom: 8px;">メモリ: ${escapeHtml(e.data.memory)}</div>
            <div>
              <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
            </div>
          </div>
        `;
        consoleResults.scrollTop = consoleResults.scrollHeight;

        // Trigger Notification
        if (typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl:
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            title: `ジャッジ完了 (${problemId})`,
            message: `結果: ${e.data.status} | 実行時間: ${e.data.time} | メモリ: ${e.data.memory}`,
            priority: 1,
          });
        }

        // Save to IndexedDB
        if (editor) {
          saveSubmissionToDB({
            id: e.data.submissionId,
            contestId: contestId,
            problemId: problemId,
            languageId: currentLanguageId,
            code: editor.getValue(),
            status: e.data.status,
            time: e.data.time,
            memory: e.data.memory,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'submit-error':
        isSubmitting = false;
        isSubmitPhase1 = false;
        setButtonsDisabled(false);

        testSummary.textContent = `エラー: ${e.data.message}`;
        testSummary.className = 'summary-wa';

        consoleResults.innerHTML = `
          <div class="case-error-block">
            <div class="case-io-label">エラー:</div>
            <pre class="case-error-content">${escapeHtml(e.data.message)}</pre>
          </div>
        `;
        consoleResults.scrollTop = consoleResults.scrollHeight;
        break;

      case 'pending-submit-status':
        if (e.data.problemId === problemId) {
          isSubmitting = true;
          isSubmitPhase1 = false;
          setButtonsDisabled(true);
          toggleConsole(true);

          testSummary.textContent = `ジャッジ中... (${e.data.status})`;
          testSummary.className = 'summary-running';

          consoleResults.innerHTML = `
            <div style="font-size: 12px; color: #333;">
              <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-running">${escapeHtml(e.data.status)}</span></div>
              <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
              <div style="margin-bottom: 8px;">メモリ: ${escapeHtml(e.data.memory)}</div>
              <div>
                <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
              </div>
            </div>
          `;
          consoleResults.scrollTop = consoleResults.scrollHeight;
        }
        break;

      case 'pending-submit-complete': {
        const isAC = e.data.status === 'AC';
        if (isAC) {
          playChimeAC();
        } else {
          playBeepWA();
        }

        // Trigger Notification
        if (typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl:
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            title: `ジャッジ完了 (${e.data.problemId})`,
            message: `結果: ${e.data.status} | 実行時間: ${e.data.time} | メモリ: ${e.data.memory}`,
            priority: 1,
          });
        }

        // Save to IndexedDB
        saveSubmissionToDB({
          id: e.data.submissionId,
          contestId: e.data.contestId,
          problemId: e.data.problemId,
          languageId: e.data.languageId,
          code: e.data.code,
          status: e.data.status,
          time: e.data.time,
          memory: e.data.memory,
          timestamp: Date.now(),
        });

        if (e.data.problemId === problemId) {
          isSubmitting = false;
          isSubmitPhase1 = false;
          setButtonsDisabled(false);

          testSummary.textContent = `ジャッジ完了: ${e.data.status}`;
          testSummary.className = isAC ? 'summary-ac' : 'summary-wa';

          consoleResults.innerHTML = `
            <div style="font-size: 12px; color: #333;">
              <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-${e.data.status.toLowerCase()}">${escapeHtml(e.data.status)}</span></div>
              <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
              <div style="margin-bottom: 8px;">メモリ: ${escapeHtml(e.data.memory)}</div>
              <div>
                <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
              </div>
            </div>
          `;
          consoleResults.scrollTop = consoleResults.scrollHeight;
        }
        break;
      }

      case 'test-start':
        isTesting = true;
        totalCount = e.data.total;
        resultsCount = 0;
        acCount = 0;
        setButtonsDisabled(true);

        testSummary.textContent = `実行中... (0/${totalCount})`;
        testSummary.className = 'summary-running';

        consoleResults.innerHTML = '';
        consoleResults.scrollTop = 0; // Reset scroll to top
        for (let i = 0; i < totalCount; i++) {
          const row = document.createElement('div');
          row.className = 'case-row';
          row.id = `case-row-${i}`;
          row.innerHTML = `
            <div class="case-row-header">
              <span class="case-icon">▶</span>
              <span class="case-label">ケース ${i + 1}:</span>
              <span class="case-status status-running">実行中</span>
            </div>
            <div class="case-row-body" style="display: none;"></div>
          `;
          consoleResults.appendChild(row);
        }
        break;

      case 'test-case-result': {
        if (!isTesting) return;
        resultsCount++;

        const row = document.getElementById(`case-row-${e.data.index}`);
        if (row) {
          const status = e.data.status;
          if (status === 'AC') {
            acCount++;
          }

          const statusBadge = row.querySelector('.case-status');
          statusBadge.textContent = status;
          statusBadge.className = `case-status status-${status.toLowerCase()}`;

          // Add metadata (Time / Memory)
          let metaStr = '';
          if (e.data.time !== undefined) {
            const timeVal = typeof e.data.time === 'number' ? `${e.data.time} ms` : e.data.time;
            const memoryVal =
              typeof e.data.memory === 'number'
                ? `${Math.round(e.data.memory / 1024)} MB`
                : e.data.memory;
            metaStr = `<span class="case-meta">(${timeVal} / ${memoryVal})</span>`;
            row.querySelector('.case-row-header').insertAdjacentHTML('beforeend', metaStr);
          }

          const body = row.querySelector('.case-row-body');
          const icon = row.querySelector('.case-icon');
          let bodyHtml = '';
          if (status === 'AC' || status === 'WA') {
            body.style.display = status === 'AC' ? 'none' : 'block';
            icon.textContent = status === 'AC' ? '▶' : '▼';
            bodyHtml = `
              <div class="case-io-grid">
                <div class="case-io-block">
                  <div class="case-io-label">期待される出力:</div>
                  <pre class="case-io-content">${escapeHtml(e.data.expected)}</pre>
                </div>
                <div class="case-io-block">
                  <div class="case-io-label">実際の出力:</div>
                  <pre class="case-io-content">${escapeHtml(e.data.output)}</pre>
                </div>
              </div>
            `;
          } else if (status === 'RE' || status === 'ERR') {
            body.style.display = 'block';
            icon.textContent = '▼';
            const errMsg =
              e.data.stderr || e.data.message || '実行時エラーまたはその他のエラーが発生しました。';
            bodyHtml = `
              <div class="case-error-block">
                <div class="case-io-label">エラー詳細 (stderr):</div>
                <pre class="case-error-content">${escapeHtml(errMsg)}</pre>
              </div>
            `;
          }
          body.innerHTML = bodyHtml;

          // Add click listener on header to toggle body visibility & icon
          const header = row.querySelector('.case-row-header');
          header.onclick = () => {
            const isVisible = body.style.display === 'block';
            body.style.display = isVisible ? 'none' : 'block';
            icon.textContent = isVisible ? '▶' : '▼';
          };
        }

        testSummary.textContent = `実行中... (${resultsCount}/${totalCount})`;

        // Auto-scroll to the bottom of the console results
        consoleResults.scrollTop = consoleResults.scrollHeight;
        break;
      }

      case 'test-complete':
        isTesting = false;
        setButtonsDisabled(false);

        if (acCount === totalCount) {
          testSummary.textContent = `すべてAC (${acCount}/${totalCount})`;
          testSummary.className = 'summary-ac';
        } else {
          testSummary.textContent = `WAあり (${acCount}/${totalCount} AC)`;
          testSummary.className = 'summary-wa';
        }
        break;

      case 'test-error':
        isTesting = false;
        setButtonsDisabled(false);

        testSummary.textContent = `エラー: ${e.data.message}`;
        testSummary.className = 'summary-wa';

        consoleResults.innerHTML = `
          <div class="case-error-block">
            <div class="case-io-label">エラー:</div>
            <pre class="case-error-content">${escapeHtml(e.data.message)}</pre>
          </div>
        `;

        // Auto-scroll to the bottom of the console results
        consoleResults.scrollTop = consoleResults.scrollHeight;
        break;
    }
  });

  function updateNavigationButtons() {
    if (prevUrl) {
      prevBtn.disabled = isSubmitPhase1 || isTesting ? true : false;
      prevBtn.onclick = () => {
        if (isTesting) {
          if (!confirm('テスト実行中にページ遷移すると、テスト結果が失われます。本当に遷移しますか？')) {
            return;
          }
        }
        saveCodeSync();
        window.parent.postMessage({ type: 'navigate', url: prevUrl }, '*');
      };
    } else {
      prevBtn.disabled = true;
    }

    if (nextUrl) {
      nextBtn.disabled = isSubmitPhase1 || isTesting ? true : false;
      nextBtn.onclick = () => {
        if (isTesting) {
          if (!confirm('テスト実行中にページ遷移すると、テスト結果が失われます。本当に遷移しますか？')) {
            return;
          }
        }
        saveCodeSync();
        window.parent.postMessage({ type: 'navigate', url: nextUrl }, '*');
      };
    } else {
      nextBtn.disabled = true;
    }
  }

  function populateLanguageSelect(languages, selectedId) {
    langSelect.innerHTML = '';
    if (!languages || languages.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '言語情報なし';
      langSelect.appendChild(opt);
      return;
    }

    languages.forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.value;
      opt.textContent = lang.text;
      langSelect.appendChild(opt);
    });

    langSelect.value = selectedId || '';

    langSelect.onchange = () => {
      // Save code under the OLD language ID before switching
      saveCodeSync();
      currentLanguageId = langSelect.value;

      // Save the last selected language
      if (currentLanguageId && isContextValid()) {
        chrome.storage.local.set({ 'settings:last_selected_language': currentLanguageId });
      }

      // Notify parent AtCoder page
      window.parent.postMessage({ type: 'update-language', languageId: currentLanguageId }, '*');
      onLanguageChanged();
    };
  }

  function initMonaco(isDark) {
    // Set theme class on body to prevent styling overrides
    document.body.className = isDark ? 'vs-dark-theme' : 'vs-theme';

    // Configure Monaco Loader
    require.config({ paths: { vs: '../../lib/monaco/vs' } });

    require(['vs/editor/editor.main'], () => {
      const selectedOption = langSelect.options[langSelect.selectedIndex];
      const langText = selectedOption ? selectedOption.textContent : '';
      const mode = getLanguageMode(langText);

      // Load initial code from storage
      const storageKey = `code:${contestId}:${problemId}:${currentLanguageId}`;
      chrome.storage.local.get([storageKey], (res) => {
        const initialCode = res[storageKey] || '';

        // Create Monaco instance
        editor = monaco.editor.create(document.getElementById('editor-container'), {
          value: initialCode,
          language: mode,
          theme: isDark ? 'vs-dark' : 'vs',
          automaticLayout: false, // We control it via message events

          // F-2 requirements: Disable AI & Intellisense / Auto-suggestions
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          snippetSuggestions: 'none',
          wordBasedSuggestions: false,
          minimap: { enabled: false }, // Keep interface clean

          // Coding assist features (still enabled)
          tabSize: 4,
          insertSpaces: true,
          autoIndent: 'brackets',
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnType: true,
          formatOnPaste: true,
          fontSize: 14,
          lineHeight: 20,

          // Scrolling configuration
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          scrollBeyondLastLine: false,
          padding: {
            bottom: 100, // Adds a 100px padding (approx. 5 lines) at the bottom
          },
        });

        // Add Monaco shortcut key for toggling console (Ctrl+J)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
          toggleConsole();
        });

        // Trigger layout asynchronously to ensure correct size on load
        setTimeout(() => {
          if (editor) editor.layout();
        }, 100);

        saveStatus.textContent = '保存済';

        // Set up change listener for Auto-Save (F-3)
        editor.onDidChangeModelContent(() => {
          saveStatus.textContent = '変更中...';
          clearTimeout(saveTimeout);
          saveTimeout = setTimeout(() => {
            saveCode();
          }, 1500);
        });
      });
    });
  }

  function onLanguageChanged() {
    if (!editor) return;

    const selectedOption = langSelect.options[langSelect.selectedIndex];
    const langText = selectedOption ? selectedOption.textContent : '';
    const mode = getLanguageMode(langText);

    // Load new code
    const storageKey = `code:${contestId}:${problemId}:${currentLanguageId}`;
    chrome.storage.local.get([storageKey], (res) => {
      const code = res[storageKey] || '';

      // Update Monaco Editor model
      const oldModel = editor.getModel();
      const newModel = monaco.editor.createModel(code, mode);
      editor.setModel(newModel);
      if (oldModel) oldModel.dispose();

      // Trigger layout again to adapt size
      setTimeout(() => {
        if (editor) editor.layout();
      }, 50);

      saveStatus.textContent = '保存済';

      // Re-setup change listener for new model
      editor.onDidChangeModelContent(() => {
        saveStatus.textContent = '変更中...';
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveCode();
        }, 1500);
      });
    });
  }

  function isContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }

  function saveCode() {
    if (!isContextValid()) return;
    if (!editor || !contestId || !problemId || !currentLanguageId) return;
    const code = editor.getValue();
    const storageKey = `code:${contestId}:${problemId}:${currentLanguageId}`;

    chrome.storage.local.set({ [storageKey]: code }, () => {
      saveStatus.textContent = '保存済';
    });
  }

  function saveCodeSync() {
    if (!isContextValid()) return;
    if (!editor || !contestId || !problemId || !currentLanguageId) return;
    clearTimeout(saveTimeout);
    const code = editor.getValue();
    const storageKey = `code:${contestId}:${problemId}:${currentLanguageId}`;

    chrome.storage.local.set({ [storageKey]: code });
    saveStatus.textContent = '保存済';
  }

  // Handle auto-save on tab close / switch / visibility change
  window.addEventListener('beforeunload', saveCodeSync);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveCodeSync();
    }
  });

  // Global keyboard shortcut for the editor iframe itself (Ctrl+J)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      toggleConsole();
    }
  });
})();
