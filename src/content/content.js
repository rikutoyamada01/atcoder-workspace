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
      // Validate source is extension origin
      if (!e.data || typeof e.data !== 'object') return;

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

  function notifyEditor(message) {
    if (iframe && iframe.contentWindow) {
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
