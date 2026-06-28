(function () {
  'use strict';

  window.AtCoderWorkspace = window.AtCoderWorkspace || {};

  /**
   * Layout manager handles DOM transformations, side panel layout,
   * splitter resizing, and responsive visibility of the editor frame.
   */
  class Layout {
    constructor() {
      this.splitRatio = 0.5;
      this.panelOpen = true;
      this.isDragging = false;
      this.mainContainer = null;
      this.wrapper = null;
      this.splitter = null;
      this.panel = null;
      this.iframe = null;
      this.toggleBtn = null;
      this.onResize = null;
    }

    /**
     * Initializes the layout settings and builds the DOM wrapper.
     * @param {Function} onResizeCallback - Callback invoked when the pane is resized.
     */
    init(onResizeCallback) {
      this.mainContainer = document.getElementById('main-container');
      if (!this.mainContainer) return;

      this.onResize = onResizeCallback;

      // Load saved settings from extension storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['settings:split_ratio', 'settings:panel_open'], (res) => {
          if (res['settings:split_ratio'] !== undefined) {
            this.splitRatio = parseFloat(res['settings:split_ratio']);
          }
          if (res['settings:panel_open'] !== undefined) {
            this.panelOpen = res['settings:panel_open'];
          }
          this.setupLayout();
          this.setupStatusSelector();
        });
      } else {
        this.setupLayout();
        this.setupStatusSelector();
      }
    }

    /**
     * Injects the self/editorial AC status select dropdown next to the problem title.
     */
    setupStatusSelector() {
      // Find problem title element
      const titleSpan = document.querySelector('.col-sm-12 span.h2');
      if (!titleSpan) return;

      // Extract contestId and problemId from URL
      const match = window.location.pathname.match(/\/contests\/([^/]+)\/tasks\/([^/]+)/);
      if (!match) return;

      const contestId = match[1];
      const problemId = match[2];
      const statusKey = `status:${contestId}:${problemId}`;

      // Create select element
      const select = document.createElement('select');
      select.className = 'ac-status-select';
      select.id = 'ac-status-select';
      select.style.display = 'inline-block';
      select.style.width = 'auto';
      select.style.marginLeft = '12px';
      select.style.padding = '4px 8px';
      select.style.fontSize = '12px';
      select.style.height = '28px';
      select.style.borderRadius = '4px';
      select.style.verticalAlign = 'middle';
      select.style.border = '1px solid #ccc';
      select.style.backgroundColor = '#fff';
      select.style.color = '#333';

      // Load translations using chrome.i18n
      const tUnsolved =
        typeof chrome !== 'undefined' && chrome.i18n
          ? chrome.i18n.getMessage('options_status_option_unsolved')
          : '未学習';
      const tSelf =
        typeof chrome !== 'undefined' && chrome.i18n
          ? chrome.i18n.getMessage('options_status_option_self')
          : '自力AC';
      const tEditorial =
        typeof chrome !== 'undefined' && chrome.i18n
          ? chrome.i18n.getMessage('options_status_option_editorial')
          : '解説AC';

      const options = [
        { value: 'unsolved', text: tUnsolved },
        { value: 'self_ac', text: tSelf },
        { value: 'editorial_ac', text: tEditorial },
      ];

      options.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.text;
        select.appendChild(o);
      });

      // Insert into title element
      titleSpan.appendChild(select);

      // Prevent/Destroy Select2 customization on this select box to keep it simple without search box
      const preventSelect2 = () => {
        const script = document.createElement('script');
        script.textContent = `
          (function() {
            const run = () => {
              const $ = window.jQuery;
              if ($ && $.fn && $.fn.select2) {
                $('#ac-status-select').select2('destroy');
              }
            };
            run();
            setTimeout(run, 100);
            setTimeout(run, 500);
          })();
        `;
        document.body.appendChild(script);
        script.remove();
      };
      preventSelect2();

      // Style helper to colorize selector based on status
      const updateSelectStyle = (val) => {
        if (val === 'self_ac') {
          select.style.backgroundColor = '#e8f5e9';
          select.style.color = '#2e7d32';
          select.style.borderColor = '#a5d6a7';
        } else if (val === 'editorial_ac') {
          select.style.backgroundColor = '#fff8e1';
          select.style.color = '#b78103';
          select.style.borderColor = '#ffe082';
        } else {
          select.style.backgroundColor = '#f5f5f5';
          select.style.color = '#616161';
          select.style.borderColor = '#e0e0e0';
        }
      };

      // Load initial state
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([statusKey, 'stats:ac_problems'], (res) => {
          const status = res && res[statusKey];
          if (status) {
            select.value = status;
          } else {
            // Default to self_ac if already solved, else unsolved
            const acProblems = (res && res['stats:ac_problems']) || [];
            const problemKey = `${contestId}:${problemId}`;
            if (acProblems.includes(problemKey)) {
              select.value = 'self_ac';
              // Backport default solved status to storage
              chrome.storage.local.set({ [statusKey]: 'self_ac' });
            } else {
              select.value = 'unsolved';
            }
          }
          updateSelectStyle(select.value);
        });
      } else {
        updateSelectStyle(select.value);
      }

      // Handle status change
      select.onchange = () => {
        const val = select.value;
        updateSelectStyle(val);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [statusKey]: val });
        }
      };
    }

    /**
     * Constructs and inserts the workspace panels, splitter, and toggle button.
     */
    setupLayout() {
      // 1. Move footer inside main-container so it scrolls with it
      const footer = document.querySelector('footer') || document.getElementById('footer');
      if (footer && this.mainContainer) {
        this.mainContainer.appendChild(footer);
      }

      // 2. Create workspace wrapper
      this.wrapper = document.createElement('div');
      this.wrapper.id = 'atcoder-workspace-wrapper';
      this.mainContainer.parentNode.insertBefore(this.wrapper, this.mainContainer);
      this.wrapper.appendChild(this.mainContainer);

      // 3. Create splitter
      this.splitter = document.createElement('div');
      this.splitter.id = 'atcoder-workspace-splitter';

      // 4. Create side panel
      this.panel = document.createElement('div');
      this.panel.id = 'atcoder-workspace-panel';

      // 5. Create editor iframe
      this.iframe = document.createElement('iframe');
      this.iframe.id = 'atcoder-workspace-iframe';
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
        this.iframe.src = chrome.runtime.getURL('src/editor/editor.html');
      } else {
        this.iframe.src = 'src/editor/editor.html'; // Fallback for testing/standalone
      }
      this.panel.appendChild(this.iframe);

      // Append splitter and panel
      this.wrapper.appendChild(this.splitter);
      this.wrapper.appendChild(this.panel);

      // 6. Create toggle button
      this.toggleBtn = document.createElement('button');
      this.toggleBtn.id = 'atcoder-workspace-toggle-btn';
      document.body.appendChild(this.toggleBtn);

      // Bind interaction events
      this.setupResizeEvents();

      // Apply initial layout state
      this.applyLayoutState();
    }

    /**
     * Applies the width configurations and active CSS classes based on open/closed state.
     */
    applyLayoutState() {
      if (this.panelOpen) {
        // Reset scroll position to top to align navbar and wrapper
        window.scrollTo(0, 0);

        document.documentElement.classList.add('atcoder-workspace-active');
        document.body.classList.add('atcoder-workspace-active');

        this.mainContainer.style.width = `${(1 - this.splitRatio) * 100}%`;
        this.panel.style.width = `${this.splitRatio * 100}%`;
        this.toggleBtn.classList.add('open');
        this.toggleBtn.innerHTML = '›';

        // Calculate navbar height and set wrapper top
        const navbar = document.querySelector('.navbar') || document.getElementById('header');
        const navbarHeight = navbar ? navbar.offsetHeight : 50;
        this.wrapper.style.top = `${navbarHeight}px`;
      } else {
        document.documentElement.classList.remove('atcoder-workspace-active');
        document.body.classList.remove('atcoder-workspace-active');

        this.mainContainer.style.width = '';
        this.panel.style.width = '';
        this.toggleBtn.classList.remove('open');
        this.toggleBtn.innerHTML = '‹';

        this.wrapper.style.top = '';
      }
    }

    /**
     * Binds mouse drag and window resize events to update the layout.
     */
    setupResizeEvents() {
      // Splitter drag resize logic
      this.splitter.addEventListener('mousedown', () => {
        this.isDragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        this.iframe.style.pointerEvents = 'none'; // Prevent iframe swallowing mouse events
      });

      document.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;

        const wrapperRect = this.wrapper.getBoundingClientRect();
        const newWidth = wrapperRect.right - e.clientX;
        const percentage = newWidth / wrapperRect.width;

        // Restrict split width between 20% and 80%
        if (percentage > 0.2 && percentage < 0.8) {
          this.splitRatio = percentage;
          this.mainContainer.style.width = `${(1 - this.splitRatio) * 100}%`;
          this.panel.style.width = `${this.splitRatio * 100}%`;

          // Notify parent or callback of resizing
          if (typeof this.onResize === 'function') {
            this.onResize();
          }
        }
      });

      document.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          this.iframe.style.pointerEvents = 'auto';

          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.storage.local.set({ 'settings:split_ratio': this.splitRatio });
          }
        }
      });

      // Window resize handling
      window.addEventListener('resize', () => {
        if (this.panelOpen) {
          const navbar = document.querySelector('.navbar') || document.getElementById('header');
          const navbarHeight = navbar ? navbar.offsetHeight : 50;
          this.wrapper.style.top = `${navbarHeight}px`;

          if (typeof this.onResize === 'function') {
            this.onResize();
          }
        }
      });

      // Toggle button click
      this.toggleBtn.addEventListener('click', () => {
        this.panelOpen = !this.panelOpen;
        this.applyLayoutState();

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
          chrome.storage.local.set({ 'settings:panel_open': this.panelOpen });
        }

        // Delay resize notification slightly to allow DOM transitions to complete
        setTimeout(() => {
          if (typeof this.onResize === 'function') {
            this.onResize();
          }
        }, 50);
      });
    }

    /**
     * Checks if the layout panel is open.
     * @returns {boolean}
     */
    isOpen() {
      return this.panelOpen;
    }

    /**
     * Gets the iframe element.
     * @returns {HTMLIFrameElement|null}
     */
    getIframe() {
      return this.iframe;
    }
  }

  window.AtCoderWorkspace.Layout = new Layout();
})();
