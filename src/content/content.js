(function () {
  'use strict';

  // Parse contest and task IDs
  const pathMatch = window.location.pathname.match(/\/contests\/([^/]+)\/tasks\/([^/]+)/);
  if (!pathMatch) return;

  const contestId = pathMatch[1];
  const problemId = pathMatch[2];

  let splitRatio = 0.5; // Default 50% split
  let panelOpen = true; // Default open
  let isDragging = false;

  // DOM Elements
  let mainContainer, wrapper, splitter, panel, iframe, toggleBtn;
  let langSelect;

  function init() {
    mainContainer = document.getElementById('main-container');
    if (!mainContainer) return;

    langSelect = document.querySelector('select[name="data.LanguageId"]');

    // Load saved settings safely
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings:split_ratio', 'settings:panel_open'], (res) => {
        if (res['settings:split_ratio'] !== undefined) {
          splitRatio = parseFloat(res['settings:split_ratio']);
        }
        if (res['settings:panel_open'] !== undefined) {
          panelOpen = res['settings:panel_open'];
        }
        setupLayout();
      });
    } else {
      setupLayout();
    }
  }

  function setupLayout() {
    // 1. Move footer inside main-container so it scrolls with it
    const footer = document.querySelector('footer') || document.getElementById('footer');
    if (footer && mainContainer) {
      mainContainer.appendChild(footer);
    }

    // 2. Create workspace wrapper
    wrapper = document.createElement('div');
    wrapper.id = 'atcoder-workspace-wrapper';
    mainContainer.parentNode.insertBefore(wrapper, mainContainer);
    wrapper.appendChild(mainContainer);

    // 3. Create splitter
    splitter = document.createElement('div');
    splitter.id = 'atcoder-workspace-splitter';

    // 4. Create side panel
    panel = document.createElement('div');
    panel.id = 'atcoder-workspace-panel';

    // 5. Create editor iframe
    iframe = document.createElement('iframe');
    iframe.id = 'atcoder-workspace-iframe';
    iframe.src = chrome.runtime.getURL('src/editor/editor.html');
    panel.appendChild(iframe);

    // Append splitter and panel
    wrapper.appendChild(splitter);
    wrapper.appendChild(panel);

    // 6. Create toggle button
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'atcoder-workspace-toggle-btn';
    document.body.appendChild(toggleBtn);

    // Bind events
    setupResizeEvents();
    setupMessageEvents();

    // Apply initial layout state
    applyLayoutState();
  }

  function applyLayoutState() {
    if (panelOpen) {
      // Reset scroll position to top to align navbar and wrapper
      window.scrollTo(0, 0);

      document.documentElement.classList.add('atcoder-workspace-active');
      document.body.classList.add('atcoder-workspace-active');

      mainContainer.style.width = `${(1 - splitRatio) * 100}%`;
      panel.style.width = `${splitRatio * 100}%`;
      toggleBtn.classList.add('open');
      toggleBtn.innerHTML = '›';
      
      // Calculate navbar height and set wrapper top
      const navbar = document.querySelector('.navbar') || document.getElementById('header');
      const navbarHeight = navbar ? navbar.offsetHeight : 50;
      wrapper.style.top = `${navbarHeight}px`;
    } else {
      document.documentElement.classList.remove('atcoder-workspace-active');
      document.body.classList.remove('atcoder-workspace-active');

      mainContainer.style.width = '';
      panel.style.width = '';
      toggleBtn.classList.remove('open');
      toggleBtn.innerHTML = '‹';

      wrapper.style.top = '';
    }
  }

  function setupResizeEvents() {
    // Splitter drag resize logic
    splitter.addEventListener('mousedown', (e) => {
      isDragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      iframe.style.pointerEvents = 'none'; // Prevent iframe swallowing mouse events
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const newWidth = wrapperRect.right - e.clientX;
      const percentage = newWidth / wrapperRect.width;

      // Restrict split width between 20% and 80%
      if (percentage > 0.2 && percentage < 0.8) {
        splitRatio = percentage;
        mainContainer.style.width = `${(1 - splitRatio) * 100}%`;
        panel.style.width = `${splitRatio * 100}%`;
        
        // Notify editor that size changed
        notifyEditor({ type: 'resize' });
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        iframe.style.pointerEvents = 'auto';

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.set({ 'settings:split_ratio': splitRatio });
        }
      }
    });

    // Window resize handling
    window.addEventListener('resize', () => {
      if (panelOpen) {
        // Recalculate navbar height on resize
        const navbar = document.querySelector('.navbar') || document.getElementById('header');
        const navbarHeight = navbar ? navbar.offsetHeight : 50;
        wrapper.style.top = `${navbarHeight}px`;

        notifyEditor({ type: 'resize' });
      }
    });

    // Toggle button click
    toggleBtn.addEventListener('click', () => {
      panelOpen = !panelOpen;
      applyLayoutState();
      
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.storage.local.set({ 'settings:panel_open': panelOpen });
      }
      
      // Delay resize notification slightly to allow DOM transitions to complete
      setTimeout(() => {
        notifyEditor({ type: 'resize' });
      }, 50);
    });
  }

  function loadNavigationUrls(callback) {
    fetch(`/contests/${contestId}/tasks`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch task list: ' + res.status);
        return res.text();
      })
      .then(html => {
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
        anchors.forEach(a => {
          if (a && typeof a.getAttribute === 'function') {
            const href = a.getAttribute('href');
            if (href && typeof href === 'string' && href.includes(`/contests/${contestId}/tasks/`)) {
              links.push(href);
            }
          }
        });

        const uniqueUrls = [...new Set(links)].map(href => {
          if (typeof href !== 'string') return '';
          return href.startsWith('/') ? href : '/' + href;
        }).filter(Boolean);

        const currentPath = window.location.pathname;
        const index = uniqueUrls.findIndex(url => {
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
      .catch(err => {
        console.error('Error fetching task navigation:', err);
        callback(null, null);
      });
  }

  function setupMessageEvents() {
    // Listen for messages from editor iframe
    window.addEventListener('message', (e) => {
      // Validate it is from our editor iframe
      if (!iframe || e.source !== iframe.contentWindow) return;
      if (!e.data || typeof e.data !== 'object') return;

      console.log('[AtCoder Workspace] Content Script: Received message from iframe', e.data.type, e.data);

      switch (e.data.type) {
        case 'editor-ready':
          loadNavigationUrls((prevUrl, nextUrl) => {
            const options = [];
            if (langSelect) {
              langSelect.querySelectorAll('option').forEach(opt => {
                options.push({
                  value: opt.value,
                  text: opt.textContent
                });
              });
            }

            // Detect dark mode using relative luminance
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            const rgb = bodyBg.match(/\d+/g);
            let isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (rgb && rgb.length >= 3) {
              const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
              isDark = brightness < 125; // standard luminance threshold (less than 125 is dark)
            }

            notifyEditor({
              type: 'init-config',
              contestId,
              problemId,
              selectedLanguageId: langSelect ? langSelect.value : null,
              languages: options,
              prevUrl,
              nextUrl,
              isDark
            });
          });
          break;

        case 'update-language':
          // User changed language in editor dropdown, sync with AtCoder page
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

        case 'run-tests':
          try {
            if (!e.data.languageId) {
              notifyEditor({
                type: 'test-error',
                message: 'プログラミング言語が選択されていません。'
              });
              break;
            }
            if (!e.data.code || !e.data.code.trim()) {
              notifyEditor({
                type: 'test-error',
                message: '実行するコードを入力してください。'
              });
              break;
            }

            const samples = extractSampleCases();
            if (samples.length === 0) {
              notifyEditor({
                type: 'test-error',
                message: 'サンプルケースが見つかりませんでした。'
              });
              break;
            }

            notifyEditor({
              type: 'test-start',
              total: samples.length
            });

            runSampleTests(
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
                  message: caseRes.message
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
              message: 'テスト実行中にエラーが発生しました: ' + err.message
            });
          }
          break;
      }
    });

    // Listen for language dropdown change on the main AtCoder page
    if (langSelect) {
      langSelect.addEventListener('change', () => {
        notifyEditor({
          type: 'language-change',
          languageId: langSelect.value
        });
      });
    }
  }

  function extractSampleCases() {
    const taskStatement = document.getElementById('task-statement');
    if (!taskStatement) return [];

    let root = taskStatement;
    const langJa = taskStatement.querySelector('.lang-ja');
    const langEn = taskStatement.querySelector('.lang-en');
    if (langJa && window.getComputedStyle(langJa).display !== 'none') {
      root = langJa;
    } else if (langEn && window.getComputedStyle(langEn).display !== 'none') {
      root = langEn;
    }

    const inputs = [];
    const outputs = [];

    // Find all headings
    const headings = Array.from(root.querySelectorAll('h3, h4, .part h3, .part h4'));
    
    headings.forEach(h => {
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
        if (['H3', 'H4'].includes(sibling.tagName)) {
          break;
        }
        sibling = sibling.nextElementSibling;
      }

      if (pre) {
        if (text.includes('入力例') || text.toLowerCase().includes('input')) {
          inputs.push(pre.textContent);
        } else if (text.includes('出力例') || text.toLowerCase().includes('output')) {
          outputs.push(pre.textContent);
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
    return samples;
  }

  function pollResult(resolve, reject, startTime) {
    if (Date.now() - startTime > 15000) { // 15 seconds timeout
      reject(new Error('TLE: 実行制限時間を超過しました (15秒)'));
      return;
    }

    fetch(`/contests/${contestId}/custom_test/json?_=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error('Network response not ok: ' + res.status);
        return res.json();
      })
      .then(data => {
        if (data && data.Result) {
          const statusVal = data.Result.Status !== undefined ? data.Result.Status : data.Result.status;
          const status = statusVal !== undefined ? Number(statusVal) : null;
          console.log('[AtCoder Workspace] Poll status:', status);
          
          // AtCoder Custom Test Statuses:
          // 0: Queued, 1: Compiling, 2: Running, 3: Completed
          if (status === 0 || status === 1 || status === 2) {
            setTimeout(() => pollResult(resolve, reject, startTime), 1000);
          } else {
            // Decode Base64 Output/Error as fallback if plaintext root properties are missing
            const stdout = data.Stdout !== undefined ? data.Stdout : 
                           (data.Result.Output !== undefined ? atob(data.Result.Output) : '');
            const stderr = data.Stderr !== undefined ? data.Stderr : 
                           (data.Result.Error !== undefined ? atob(data.Result.Error) : '');
            
            resolve({
              Stdout: stdout,
              Stderr: stderr,
              ExitCode: data.Result.ExitCode,
              TimeConsumption: data.Result.TimeConsumption,
              MemoryConsumption: data.Result.MemoryConsumption
            });
          }
        } else {
          setTimeout(() => pollResult(resolve, reject, startTime), 1000);
        }
      })
      .catch(err => {
        reject(err);
      });
  }

  function ensureIdle(onIdle, startTime) {
    if (Date.now() - startTime > 20000) { // 20 seconds timeout
      console.warn('[AtCoder Workspace] Idle check timed out, proceeding anyway.');
      onIdle();
      return;
    }

    fetch(`/contests/${contestId}/custom_test/json?_=${Date.now()}`)
      .then(res => {
        if (!res.ok) return { Result: null };
        return res.json();
      })
      .then(data => {
        if (data && data.Result) {
          const statusVal = data.Result.Status !== undefined ? data.Result.Status : data.Result.status;
          const status = statusVal !== undefined ? Number(statusVal) : null;
          console.log('[AtCoder Workspace] Idle check status:', status);
          // 0: Queued, 1: Compiling, 2: Running
          if (status === 0 || status === 1 || status === 2) {
            console.log('[AtCoder Workspace] Custom test is currently busy (status:', status, '), waiting...');
            setTimeout(() => ensureIdle(onIdle, startTime), 1000);
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

  function runSampleTests(code, languageId, samples, onCaseResult, onComplete) {
    let index = 0;

    function runNext() {
      if (index >= samples.length) {
        onComplete();
        return;
      }

      const sample = samples[index];

      // Ensure AtCoder is idle before submitting
      ensureIdle(() => {
        // Get CSRF Token
        let csrfToken = '';
        const tokenInput = document.querySelector('input[name="csrf_token"]');
        if (tokenInput) csrfToken = tokenInput.value;
        if (!csrfToken && window.csrfToken) csrfToken = window.csrfToken;

        if (!csrfToken) {
          onCaseResult({
            index,
            status: 'ERR',
            message: 'CSRFトークンが見つかりません。'
          });
          index++;
          setTimeout(runNext, 1000);
          return;
        }

        const params = new URLSearchParams();
        params.append('csrf_token', csrfToken);
        params.append('sourceCode', code);
        params.append('data.LanguageId', languageId);
        params.append('input', sample.input);

        fetch(`/contests/${contestId}/custom_test/submit/json`, {
          method: 'POST',
          body: params
        })
        .then(res => {
          if (!res.ok) throw new Error('POST failed: ' + res.status);
          return res.text(); // Read as text first to handle plain text error messages or empty body
        })
        .then(text => {
          // AtCoder returns an empty body (200 OK, Content-Length: 0) on successful custom test submission
          if (!text || !text.trim()) {
            console.log('[AtCoder Workspace] Custom test submitted successfully (empty response).');
            return {};
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            if (text.includes('前回のカスタムテスト')) {
              throw new Error('LockError: 前回のカスタムテストの実行が終了していません。');
            }
            throw new Error('JSON parse failed (len=' + text.length + '): ' + JSON.stringify(text).substring(0, 100));
          }
          return data;
        })
        .then(data => {
          return new Promise((resolve, reject) => {
            pollResult(resolve, reject, Date.now());
          });
        })
        .then(result => {
          // Compare outputs (normalize line endings and trim whitespace)
          const actualOutput = result.Stdout !== undefined ? result.Stdout : (result.Output !== undefined ? result.Output : '');
          const actual = actualOutput.trim().replace(/\r\n/g, '\n');
          const expected = (sample.expected || '').trim().replace(/\r\n/g, '\n');

          const exitCode = result.ExitCode !== undefined ? Number(result.ExitCode) : 0;
          let status = 'WA';
          if (actual === expected && exitCode === 0) {
            status = 'AC';
          } else if (exitCode !== 0 || result.Stderr) {
            status = 'RE'; // Runtime Error
          }

          onCaseResult({
            index,
            status,
            time: result.TimeConsumption !== undefined ? result.TimeConsumption : result.Time,
            memory: result.MemoryConsumption !== undefined ? result.MemoryConsumption : result.Memory,
            output: actualOutput,
            expected: sample.expected,
            stderr: result.Stderr || ''
          });

          index++;
          setTimeout(runNext, 1000); // Wait 1 second before next case
        })
        .catch(err => {
          console.warn(`[AtCoder Workspace] Case ${index + 1} submission error:`, err);
          
          if (err.message && err.message.includes('LockError')) {
            // Lock detected, retry the same case after 1.5 seconds without incrementing index
            console.log(`[AtCoder Workspace] Retrying case ${index + 1} due to lock...`);
            setTimeout(runNext, 1500);
          } else {
            onCaseResult({
              index,
              status: 'ERR',
              message: err.message || '実行エラーが発生しました。'
            });
            index++;
            setTimeout(runNext, 1000);
          }
        });
      }, Date.now());
    }

    runNext();
  }

  function notifyEditor(message) {
    if (iframe && iframe.contentWindow) {
      console.log('[AtCoder Workspace] Content Script: Sending message to iframe', message.type, message);
      iframe.contentWindow.postMessage(message, '*');
    }
  }

  // Run initial setup
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
