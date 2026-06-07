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

  // Helper to map AtCoder language names to Monaco Editor language IDs
  function getLanguageMode(langText) {
    if (!langText) return 'plaintext';
    const lower = langText.toLowerCase();
    
    if (lower.includes('c++') || lower.includes('gcc') || lower.includes('clang++') || lower.includes('g++')) return 'cpp';
    if (lower.includes('python') || lower.includes('pypy')) return 'python';
    if (lower.includes('rust')) return 'rust';
    if (lower.includes('java')) return 'java';
    if (lower.includes('go') || lower.includes('golang')) return 'go';
    if (lower.includes('haskell')) return 'haskell';
    if (lower.includes('javascript') || lower.includes('node') || lower.includes('js')) return 'javascript';
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

        // Load Monaco Editor
        initMonaco(e.data.isDark);
        break;

      case 'language-change':
        if (e.data.languageId && e.data.languageId !== currentLanguageId) {
          currentLanguageId = e.data.languageId;
          langSelect.value = currentLanguageId;
          onLanguageChanged();
        }
        break;

      case 'resize':
        if (editor) {
          editor.layout();
        }
        break;
    }
  });

  function updateNavigationButtons() {
    if (prevUrl) {
      prevBtn.disabled = false;
      prevBtn.onclick = () => {
        saveCodeSync();
        window.parent.postMessage({ type: 'navigate', url: prevUrl }, '*');
      };
    } else {
      prevBtn.disabled = true;
    }

    if (nextUrl) {
      nextBtn.disabled = false;
      nextBtn.onclick = () => {
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

    languages.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang.value;
      opt.textContent = lang.text;
      langSelect.appendChild(opt);
    });

    langSelect.value = selectedId || '';

    langSelect.onchange = () => {
      currentLanguageId = langSelect.value;
      // Notify parent AtCoder page
      window.parent.postMessage({ type: 'update-language', languageId: currentLanguageId }, '*');
      onLanguageChanged();
    };
  }

  function initMonaco(isDark) {
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
            horizontalScrollbarSize: 10
          },
          scrollBeyondLastLine: false,
          padding: {
            bottom: 100 // Adds a 100px padding (approx. 5 lines) at the bottom
          }
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

    // Save previous code first
    saveCodeSync();

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

})();
