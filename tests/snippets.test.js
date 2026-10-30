/**
 * @jest-environment jsdom
 */

'use strict';

const fs = require('fs');
const path = require('path');
const i18n = require('../src/lib/i18n.js');

const optionsHtml = fs.readFileSync(path.resolve(__dirname, '../src/options/options.html'), 'utf8');
const optionsJs = fs.readFileSync(path.resolve(__dirname, '../src/options/options.js'), 'utf8');

const editorHtml = fs.readFileSync(path.resolve(__dirname, '../src/editor/editor.html'), 'utf8');
const editorJs = fs.readFileSync(path.resolve(__dirname, '../src/editor/editor.js'), 'utf8');

describe('Templates and Custom Snippets Integration Tests', () => {
  let store = {};
  let editorPort;

  let onChangedListeners = [];

  beforeEach(() => {
    store = {};
    localStorage.clear();
    sessionStorage.clear();
    const listeners = [];
    editorPort = {
      postMessage: jest.fn(),
      onMessage: { addListener: (listener) => listeners.push(listener) },
      onDisconnect: { addListener: jest.fn() },
      receiveEvent: (event) => listeners.forEach((listener) => listener(event.data)),
    };
    onChangedListeners = [];
    global.i18n = i18n;

    const jaMessages = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../_locales/ja/messages.json'), 'utf8')
    );
    const enMessages = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../_locales/en/messages.json'), 'utf8')
    );

    global.fetch = jest.fn((url) => {
      let data = {};
      if (url.includes('/en/') || url.includes('_locales/en/')) {
        data = enMessages;
      } else {
        data = jaMessages;
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data),
      });
    });

    global.chrome = {
      runtime: {
        id: 'dummy-extension-id',
        connect: jest.fn(() => editorPort),
        getURL: jest.fn((p) => p),
        openOptionsPage: jest.fn(),
      },
      i18n: {
        getMessage: jest.fn((key, placeholders) => {
          const entry = jaMessages[key];
          if (!entry || !entry.message) return '';
          let msg = entry.message;
          if (placeholders) {
            const arr = Array.isArray(placeholders) ? placeholders : [placeholders];
            arr.forEach((val, idx) => {
              msg = msg.replace(new RegExp(`\\$${idx + 1}`, 'g'), val);
            });
          }
          return msg;
        }),
        getUILanguage: jest.fn(() => 'ja'),
      },
      storage: {
        onChanged: {
          addListener: jest.fn((listener) => {
            onChangedListeners.push(listener);
          }),
          removeListener: jest.fn((listener) => {
            onChangedListeners = onChangedListeners.filter((l) => l !== listener);
          }),
        },
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach((k) => {
              result[k] = store[k];
            });
            callback(result);
          }),
          set: jest.fn((data, callback) => {
            Object.assign(store, data);
            if (callback) callback();
          }),
          remove: jest.fn((keys, callback) => {
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach((k) => {
              delete store[k];
            });
            if (callback) callback();
          }),
        },
      },
    };

    // Mock scrollTo
    window.scrollTo = jest.fn();
    window.open = jest.fn();
  });

  afterEach(() => {
    delete global.chrome;
    delete global.i18n;
    delete global.fetch;
    delete window.scrollTo;
    delete window.open;
  });

  describe('Options Page: Custom Templates & Custom Snippets CRUD', () => {
    let mockScrollIntoView;

    beforeEach(() => {
      // Mock element scrollIntoView
      mockScrollIntoView = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;

      // Set up options DOM
      document.body.innerHTML = optionsHtml;

      // Load and evaluate options.js script
      const script = document.createElement('script');
      script.textContent = optionsJs;
      document.body.appendChild(script);

      // Trigger DOMContentLoaded
      document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    afterEach(() => {
      delete window.HTMLElement.prototype.scrollIntoView;
    });

    test('Custom Template load, update, and reset works correctly', () => {
      const templateLangSelect = document.getElementById('template-lang-select');
      const templateCodeArea = document.getElementById('template-code-area');
      const saveTemplateBtn = document.getElementById('save-template-btn');
      const resetTemplateBtn = document.getElementById('reset-template-btn');

      // 1. Initial default template load for cpp
      expect(templateLangSelect.value).toBe('cpp');
      expect(templateCodeArea.value).toContain('#include <bits/stdc++.h>');

      // 2. Switch to python and verify default Python template
      templateLangSelect.value = 'python';
      templateLangSelect.dispatchEvent(new Event('change'));
      expect(templateCodeArea.value).toContain('def main():');

      // 3. Edit python template and save
      const customPythonCode = '# custom python code';
      templateCodeArea.value = customPythonCode;
      saveTemplateBtn.dispatchEvent(new Event('click'));

      expect(store['settings:template:python']).toBe(customPythonCode);

      // 4. Reset to default python template
      resetTemplateBtn.dispatchEvent(new Event('click'));
      expect(templateCodeArea.value).toContain('def main():');
    });

    test('Codon template has a default and is saved independently from Python', () => {
      const languageSelect = document.getElementById('template-lang-select');
      const codeArea = document.getElementById('template-code-area');
      const saveButton = document.getElementById('save-template-btn');

      languageSelect.value = 'codon';
      languageSelect.dispatchEvent(new Event('change'));
      expect(codeArea.value).toContain('def main():');
      codeArea.value = '# Codon template';
      saveButton.click();

      languageSelect.value = 'python';
      languageSelect.dispatchEvent(new Event('change'));
      codeArea.value = '# Python template';
      saveButton.click();

      languageSelect.value = 'codon';
      languageSelect.dispatchEvent(new Event('change'));
      expect(codeArea.value).toBe('# Codon template');
      codeArea.value = '# updated Codon template';
      saveButton.click();

      languageSelect.value = 'python';
      languageSelect.dispatchEvent(new Event('change'));
      expect(codeArea.value).toBe('# Python template');
      expect(store['settings:template:codon']).toBe('# updated Codon template');
      expect(store['settings:template:python']).toBe('# Python template');
    });

    test.each(['cpp', 'codon'])('Custom Snippets CRUD works for %s', (language) => {
      const addSnippetBtn = document.getElementById('add-snippet-btn');
      const snippetFormContainer = document.getElementById('snippet-form-container');
      const snippetTitleInput = document.getElementById('snippet-title-input');
      const snippetLangSelect = document.getElementById('snippet-lang-select');
      const snippetDescInput = document.getElementById('snippet-desc-input');
      const snippetTagsInput = document.getElementById('snippet-tags-input');
      const snippetCodeInput = document.getElementById('snippet-code-input');
      const saveSnippetBtn = document.getElementById('save-snippet-btn');
      const snippetsTableBody = document.getElementById('snippets-table-body');
      const noSnippetsMessage = document.getElementById('no-snippets-message');

      // 1. Initially lists should be empty since mock storage settings:custom_snippets is empty
      expect(snippetsTableBody.children.length).toBe(0);
      expect(noSnippetsMessage.style.display).toBe('block');

      // 2. Open Add Form
      addSnippetBtn.dispatchEvent(new Event('click'));
      expect(snippetFormContainer.style.display).toBe('flex');
      expect(mockScrollIntoView).toHaveBeenCalled();

      // 3. Fill details and Save Custom Snippet
      snippetTitleInput.value = 'My Segment Tree';
      snippetLangSelect.value = language;
      snippetDescInput.value = 'Range sum segment tree';
      snippetTagsInput.value = 'segtree, data-structure';
      snippetCodeInput.value = 'struct SegTree {};';
      saveSnippetBtn.dispatchEvent(new Event('click'));

      // Check storage save
      const savedSnippets = store['settings:custom_snippets'];
      expect(savedSnippets).toBeDefined();
      expect(savedSnippets.length).toBe(1);
      expect(savedSnippets[0].title).toBe('My Segment Tree');
      expect(savedSnippets[0].lang).toBe(language);
      expect(savedSnippets[0].tags).toEqual(['segtree', 'data-structure']);

      // Form closed and list refreshed
      expect(snippetFormContainer.style.display).toBe('none');
      expect(snippetsTableBody.innerHTML).toContain('My Segment Tree');

      // 4. Edit Custom Snippet
      const editBtn = snippetsTableBody.querySelector('.edit-btn');
      editBtn.dispatchEvent(new Event('click'));
      expect(snippetFormContainer.style.display).toBe('flex');
      expect(snippetTitleInput.value).toBe('My Segment Tree');

      // Modify and update
      snippetTitleInput.value = 'Updated SegTree';
      saveSnippetBtn.dispatchEvent(new Event('click'));
      expect(store['settings:custom_snippets'][0].title).toBe('Updated SegTree');
      expect(snippetsTableBody.innerHTML).toContain('Updated SegTree');

      // 5. Delete Snippet
      window.confirm = () => true; // Auto-confirm deletions
      const deleteBtn = snippetsTableBody.querySelector('.delete-btn');
      deleteBtn.dispatchEvent(new Event('click'));

      expect(store['settings:custom_snippets'].length).toBe(0); // Deleted
      expect(snippetsTableBody.innerHTML).not.toContain('Updated SegTree');
    });

    test('Scrolls to custom snippets section if page hash is present', async () => {
      // 1. Initialize fake timers first
      jest.useFakeTimers();

      // 2. Set hash location on window.location
      window.location.hash = '#custom-snippets-section';

      // 3. Intercept scrollIntoView of the section element
      const section = document.getElementById('custom-snippets-section');
      const sectionMockScroll = jest.fn();
      section.scrollIntoView = sectionMockScroll;

      // 4. Re-dispatch event to run loadSettings again
      document.dispatchEvent(new Event('DOMContentLoaded'));

      // Flush microtasks to allow async DOMContentLoaded listener to progress
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      // 5. Fast-forward timer past 300ms
      jest.advanceTimersByTime(350);

      // 6. Assert
      expect(sectionMockScroll).toHaveBeenCalled();

      // Clean up
      window.location.hash = '';
      jest.useRealTimers();
    });

    test('All recognized languages are available in template and snippet selects', () => {
      const templateLangSelect = document.getElementById('template-lang-select');
      const snippetLangSelect = document.getElementById('snippet-lang-select');

      const expectedLanguages = [
        'cpp',
        'c',
        'python',
        'codon',
        'rust',
        'java',
        'go',
        'nim',
        'zig',
        'd',
        'julia',
        'dart',
        'lua',
        'javascript',
        'typescript',
        'csharp',
        'fsharp',
        'kotlin',
        'swift',
        'ruby',
        'crystal',
        'php',
        'scala',
        'elixir',
        'clojure',
        'haskell',
        'ocaml',
        'perl',
        'r',
        'scheme',
        'pascal',
        'fortran',
        'shell',
      ];

      const templateOptions = Array.from(templateLangSelect.options).map((o) => o.value);
      const snippetOptions = Array.from(snippetLangSelect.options).map((o) => o.value);

      expectedLanguages.forEach((lang) => {
        expect(templateOptions).toContain(lang);
        expect(snippetOptions).toContain(lang);
      });
    });

    test('Custom template and snippet can be saved for non-default languages (e.g. Kotlin, JavaScript)', () => {
      const templateLangSelect = document.getElementById('template-lang-select');
      const templateCodeArea = document.getElementById('template-code-area');
      const saveTemplateBtn = document.getElementById('save-template-btn');

      // Test Kotlin template
      templateLangSelect.value = 'kotlin';
      templateLangSelect.dispatchEvent(new Event('change'));
      expect(templateCodeArea.value).toBe(''); // Initially empty

      const kotlinTemplate = 'fun main() {\n    println("Hello Kotlin")\n}';
      templateCodeArea.value = kotlinTemplate;
      saveTemplateBtn.dispatchEvent(new Event('click'));
      expect(store['settings:template:kotlin']).toBe(kotlinTemplate);

      // Test custom snippet for Kotlin
      const addSnippetBtn = document.getElementById('add-snippet-btn');
      const snippetTitleInput = document.getElementById('snippet-title-input');
      const snippetLangSelect = document.getElementById('snippet-lang-select');
      const snippetDescInput = document.getElementById('snippet-desc-input');
      const snippetTagsInput = document.getElementById('snippet-tags-input');
      const snippetCodeInput = document.getElementById('snippet-code-input');
      const saveSnippetBtn = document.getElementById('save-snippet-btn');

      addSnippetBtn.dispatchEvent(new Event('click'));
      snippetTitleInput.value = 'Kotlin Fast I/O';
      snippetLangSelect.value = 'kotlin';
      snippetDescInput.value = 'Fast input for Kotlin';
      snippetTagsInput.value = 'io, template';
      snippetCodeInput.value = 'import java.util.Scanner';
      saveSnippetBtn.dispatchEvent(new Event('click'));

      const savedSnippets = store['settings:custom_snippets'];
      expect(savedSnippets.some((s) => s.lang === 'kotlin' && s.title === 'Kotlin Fast I/O')).toBe(
        true
      );
    });
  });

  describe('Editor Page: Auto Template & Snippets Drawer Insertion', () => {
    let mockEditor;
    let mockSnippetController;

    beforeEach(() => {
      // Mock require and monaco loader
      global.require = jest.fn((deps, callback) => {
        callback();
      });
      global.require.config = jest.fn();

      mockSnippetController = {
        insert: jest.fn(),
      };

      let editorValue = '';

      mockEditor = {
        getValue: jest.fn(() => editorValue),
        setValue: jest.fn((val) => {
          editorValue = val;
        }),
        getModel: jest.fn(() => ({
          dispose: jest.fn(),
        })),
        setModel: jest.fn((model) => {
          if (model && model._value !== undefined) {
            editorValue = model._value;
          }
        }),
        updateOptions: jest.fn(),
        addCommand: jest.fn(),
        layout: jest.fn(),
        focus: jest.fn(),
        getSelection: jest.fn(() => ({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        })),
        executeEdits: jest.fn(),
        getContribution: jest.fn((id) => {
          if (id === 'snippetController2') {
            return mockSnippetController;
          }
          return null;
        }),
        onDidChangeModelContent: jest.fn((_callback) => {
          return { dispose: jest.fn() };
        }),
      };

      global.monaco = {
        editor: {
          create: jest.fn((container, options) => {
            if (options && options.value !== undefined) {
              editorValue = options.value;
            }
            return mockEditor;
          }),
          createModel: jest.fn((val) => ({
            dispose: jest.fn(),
            _value: val,
          })),
        },
        KeyMod: {
          CtrlCmd: 2048,
        },
        KeyCode: {
          KeyJ: 40,
        },
        Range: function (sl, sc, el, ec) {
          this.startLineNumber = sl;
          this.startColumn = sc;
          this.endLineNumber = el;
          this.endColumn = ec;
        },
      };

      // Set up editor DOM
      document.body.innerHTML = editorHtml;

      // Load editor.js
      const script = document.createElement('script');
      script.textContent = editorJs;
      document.body.appendChild(script);
    });

    afterEach(() => {
      delete global.require;
      delete global.monaco;
    });

    test('page and sourceless messages cannot change drafts or submission history', () => {
      editorPort.receiveEvent({
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_a',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++' }],
        },
      });
      const snapshot = JSON.stringify(store);
      const payloads = [
        {
          type: 'init-config',
          contestId: 'other',
          problemId: 'other_a',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++' }],
        },
        { type: 'latest-submission-loaded', mode: 'cpp', code: 'attacker replacement' },
        { type: 'language-change', languageId: '5002' },
        {
          type: 'pending-submit-complete',
          status: 'WA',
          submissionId: 'fake',
          contestId: 'other',
          problemId: 'other_a',
          code: 'attacker',
        },
      ];
      for (const data of payloads) {
        window.dispatchEvent(
          new MessageEvent('message', { data, source: window.parent, origin: 'https://atcoder.jp' })
        );
        window.dispatchEvent(new MessageEvent('message', { data }));
      }
      expect(JSON.stringify(store)).toBe(snapshot);
      expect(mockEditor.setModel).not.toHaveBeenCalled();
    });

    test('reconnects after disconnect and ignores messages from the obsolete port', () => {
      jest.useFakeTimers();
      const oldPort = editorPort;
      const config = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5001',
        languages: [{ value: '5001', text: 'C++' }],
      };
      oldPort.receiveEvent({ data: config });
      mockEditor.setValue('// unsaved draft');
      const currentModel = mockEditor.getModel();
      oldPort.onDisconnect.addListener.mock.calls[0][0]();
      editorPort = {
        ...oldPort,
        postMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        onDisconnect: { addListener: jest.fn() },
      };
      jest.advanceTimersByTime(500);
      expect(chrome.runtime.connect).toHaveBeenCalledTimes(2);
      const snapshot = JSON.stringify(store);
      oldPort.receiveEvent({ data: { type: 'language-change', languageId: 'forged' } });
      expect(JSON.stringify(store)).toBe(snapshot);
      const receive = editorPort.onMessage.addListener.mock.calls[0][0];
      receive({ type: 'workspace-connected' });
      expect(editorPort.postMessage).toHaveBeenCalledWith({ type: 'editor-ready' });
      receive(config);
      expect(monaco.editor.create).toHaveBeenCalledTimes(1);
      expect(mockEditor.setModel).not.toHaveBeenCalled();
      expect(currentModel.dispose).not.toHaveBeenCalled();
      expect(mockEditor.getValue()).toBe('// unsaved draft');
      document.getElementById('test-btn').click();
      expect(editorPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'run-tests',
          code: '// unsaved draft',
          languageId: '5001',
        })
      );
      jest.useRealTimers();
    });

    test('Auto Template inserts if code history is empty', () => {
      // Simulate init-config payload with no language code history
      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5001', // C++
        languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
        isDark: true,
      };

      // Trigger message listener
      editorPort.receiveEvent(new MessageEvent('message', { data: configMsg }));

      // Editor should create with default C++ template (since local storage config is empty)
      expect(global.monaco.editor.create).toHaveBeenCalled();
      expect(global.monaco.editor.create.mock.calls[0][1].value).toContain(
        '#include <bits/stdc++.h>'
      );
      expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });

    test('fetches latest submission from AtCoder if local code history is empty', async () => {
      const parentPostMessageMock = editorPort.postMessage;

      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5001',
        languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
        isDark: true,
      };

      editorPort.receiveEvent(new MessageEvent('message', { data: configMsg }));

      expect(parentPostMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fetch-latest-submission',
          languageId: '5001',
          mode: 'cpp',
        })
      );

      const submissionLoadedMsg = {
        type: 'latest-submission-loaded',
        code: '// previously submitted solution code',
        mode: 'cpp',
      };

      editorPort.receiveEvent(new MessageEvent('message', { data: submissionLoadedMsg }));

      expect(global.monaco.editor.createModel).toHaveBeenCalledWith(
        '// previously submitted solution code',
        'cpp'
      );
      expect(mockEditor.setModel).toHaveBeenCalled();

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'code:abc300:abc300_a:5001': '// previously submitted solution code',
        })
      );
    });

    test('Snippets Drawer lists custom snippets alongside presets and search filters them', () => {
      jest.useFakeTimers();

      // Seed custom snippets in storage mock
      store['settings:custom_snippets'] = [
        {
          id: 'cust_1',
          title: 'My Custom Dijkstra',
          lang: 'cpp',
          desc: 'Fast Dijkstra implementation',
          tags: ['graph', 'custom-algo'],
          code: 'void my_dijkstra() {}',
        },
        {
          id: 'cust_2',
          title: 'My Python SegTree',
          lang: 'python',
          desc: 'Python segment tree',
          tags: ['data-structure'],
          code: 'class SegTree:',
        },
      ];

      // Simulate init-config
      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5001',
        languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
        isDark: false,
      };
      editorPort.receiveEvent(new MessageEvent('message', { data: configMsg }));

      const snippetsBtn = document.getElementById('snippets-btn');
      const snippetsDrawer = document.getElementById('snippets-drawer');
      const snippetList = document.getElementById('snippet-list');
      const snippetSearch = document.getElementById('snippet-search');

      // Drawer is initially hidden
      expect(snippetsDrawer.style.display).toBe('none');

      // Click to open drawer
      snippetsBtn.dispatchEvent(new Event('click'));
      jest.advanceTimersByTime(10); // Advance timer to let toggleDrawer setTimeout(..., 0) execute

      expect(snippetsDrawer.style.display).toBe('flex');
      expect(mockEditor.layout).toHaveBeenCalled();

      // Verify custom snippet + preset snippets are loaded (cpp lang)
      expect(snippetList.innerHTML).toContain('My Custom Dijkstra');
      expect(snippetList.innerHTML).toContain('自作'); // "自作" badge for custom snippet
      expect(snippetList.innerHTML).toContain('Union-Find (素集合データ構造)'); // Preset snippet
      expect(snippetList.innerHTML).not.toContain('My Python SegTree'); // Only cpp loaded

      // Search filtering
      snippetSearch.value = 'Dijkstra';
      snippetSearch.dispatchEvent(new Event('input'));

      expect(snippetList.innerHTML).toContain('My Custom Dijkstra');
      expect(snippetList.innerHTML).not.toContain('Union-Find');

      // Insert custom snippet
      const card = snippetList.querySelector('.snippet-card');
      const cardHeader = card.querySelector('.snippet-card-header');
      const cardBody = card.querySelector('.snippet-card-body');

      // Expand card body
      cardHeader.dispatchEvent(new Event('click'));
      expect(cardBody.style.display).toBe('flex');

      // Click insert button
      const insertBtn = cardBody.querySelector('.btn-insert');
      insertBtn.dispatchEvent(new Event('click'));

      expect(mockEditor.focus).toHaveBeenCalled();
      expect(mockSnippetController.insert).toHaveBeenCalledWith(
        'void my_dijkstra() {}',
        0,
        0,
        false,
        false
      );

      jest.useRealTimers();
    });

    test('live language synchronization updates translations dynamically', async () => {
      // 1. Simulate init-config to load the page
      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5001',
        languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
        isDark: false,
      };
      editorPort.receiveEvent(new MessageEvent('message', { data: configMsg }));

      // 2. Verify initial translation is loaded
      const snippetsBtn = document.getElementById('snippets-btn');
      expect(snippetsBtn.textContent).toBe('📝 スニペット');

      // 3. Trigger onChanged listener representing display language change to English
      expect(onChangedListeners.length).toBeGreaterThan(0);

      // Update mocked storage display language setting
      store['settings:display_language'] = 'en';

      // Call onChanged listeners
      for (const listener of onChangedListeners) {
        await listener(
          { 'settings:display_language': { newValue: 'en', oldValue: 'ja' } },
          'local'
        );
      }

      // Flush microtasks
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      // 4. Verify text content has been dynamically updated to English
      expect(snippetsBtn.textContent).toBe('📝 Snippets');
    });

    test('Non-default language (Kotlin) applies custom template and displays custom snippets in drawer', () => {
      jest.useFakeTimers();

      store['settings:template:kotlin'] = '// my kotlin template';
      store['settings:custom_snippets'] = [
        {
          id: 'snip_kt',
          title: 'Kotlin Fast I/O',
          lang: 'kotlin',
          desc: 'Fast scanner',
          tags: ['io'],
          code: 'class FastScanner {}',
        },
        {
          id: 'snip_cpp',
          title: 'CPP Snippet',
          lang: 'cpp',
          desc: 'C++ only',
          tags: ['cpp'],
          code: '// cpp',
        },
      ];

      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5040',
        languages: [{ value: '5040', text: 'Kotlin (1.8.20)' }],
        isDark: false,
      };

      editorPort.receiveEvent(new MessageEvent('message', { data: configMsg }));

      expect(global.monaco.editor.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          value: '// my kotlin template',
          language: 'kotlin',
        })
      );

      // Open Snippets Drawer
      const snippetsBtn = document.getElementById('snippets-btn');
      const snippetList = document.getElementById('snippet-list');
      snippetsBtn.dispatchEvent(new Event('click'));

      expect(snippetList.innerHTML).toContain('Kotlin Fast I/O');
      expect(snippetList.innerHTML).not.toContain('CPP Snippet');

      jest.useRealTimers();
    });

    test.each([
      ['Python (Codon 0.19.3)', 'codon', '# Codon template'],
      ['Python (CPython 3.11.4)', 'python', '# Python template'],
      ['Python (PyPy 3.10-v7.3.12)', 'python', '# Python template'],
    ])('%s uses its own template with Python highlighting', (language, mode, expectedCode) => {
      store['settings:template:python'] = '# Python template';
      store['settings:template:codon'] = '# Codon template';
      editorPort.receiveEvent({
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_a',
          selectedLanguageId: '9999',
          languages: [{ value: '9999', text: language }],
          isDark: false,
        },
      });

      expect(global.monaco.editor.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ value: expectedCode, language: 'python' })
      );
      expect(editorPort.postMessage).toHaveBeenCalledWith({
        type: 'fetch-latest-submission',
        languageId: '9999',
        mode,
      });
    });

    test('Codon uses its default when only a custom Python template exists', () => {
      store['settings:template:python'] = '# Python-only template';
      editorPort.receiveEvent({
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_a',
          selectedLanguageId: '9999',
          languages: [{ value: '9999', text: 'Python (Codon 0.19.3)' }],
          isDark: false,
        },
      });

      expect(global.monaco.editor.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          value: expect.stringContaining('def main():'),
          language: 'python',
        })
      );
      expect(store['settings:template:python']).toBe('# Python-only template');
    });

    test('Codon drawer lists and inserts Codon snippets without Python snippets', () => {
      store['settings:custom_snippets'] = [
        { id: 'codon', lang: 'codon', title: 'Codon snippet', tags: [], code: '# Codon snippet' },
        {
          id: 'python',
          lang: 'python',
          title: 'Python snippet',
          tags: [],
          code: '# Python snippet',
        },
      ];
      editorPort.receiveEvent({
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_a',
          selectedLanguageId: '9999',
          languages: [{ value: '9999', text: 'Python (Codon 0.19.3)' }],
          isDark: false,
        },
      });
      document.getElementById('snippets-btn').click();
      const snippetList = document.getElementById('snippet-list');
      expect(snippetList.textContent).toContain('Codon snippet');
      expect(snippetList.textContent).not.toContain('Python snippet');
      snippetList.querySelector('.btn-insert').click();
      expect(mockSnippetController.insert).toHaveBeenCalledWith(
        '# Codon snippet',
        0,
        0,
        false,
        false
      );
    });

    test('Codon rejects Python submission replies and restores Codon with Python highlighting', () => {
      editorPort.receiveEvent({
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_a',
          selectedLanguageId: '9999',
          languages: [{ value: '9999', text: 'Python (Codon 0.19.3)' }],
          isDark: false,
        },
      });
      editorPort.receiveEvent({
        data: { type: 'latest-submission-loaded', mode: 'python', code: '# Python submission' },
      });
      expect(global.monaco.editor.createModel).not.toHaveBeenCalled();

      editorPort.receiveEvent({
        data: { type: 'latest-submission-loaded', mode: 'codon', code: '# Codon submission' },
      });
      expect(global.monaco.editor.createModel).toHaveBeenCalledWith('# Codon submission', 'python');
      expect(mockEditor.getValue()).toBe('# Codon submission');
      expect(store['code:abc300:abc300_a:9999']).toBe('# Codon submission');
    });

    test('switching between Python and Codon keeps templates and drafts separate', () => {
      store['settings:template:python'] = '# Python template';
      store['settings:template:codon'] = '# Codon template';
      editorPort.receiveEvent({
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_a',
          selectedLanguageId: '9998',
          languages: [
            { value: '9998', text: 'Python (CPython 3.11.4)' },
            { value: '9999', text: 'Python (Codon 0.19.3)' },
          ],
          isDark: false,
        },
      });

      mockEditor.setValue('# Python draft');
      const languageSelect = document.getElementById('language-select');
      languageSelect.value = '9999';
      languageSelect.dispatchEvent(new Event('change'));
      expect(mockEditor.getValue()).toBe('# Codon template');
      expect(global.monaco.editor.createModel).toHaveBeenLastCalledWith(
        '# Codon template',
        'python'
      );

      mockEditor.setValue('# Codon draft');
      languageSelect.value = '9998';
      languageSelect.dispatchEvent(new Event('change'));
      expect(mockEditor.getValue()).toBe('# Python draft');
      expect(store['code:abc300:abc300_a:9999']).toBe('# Codon draft');
    });

    test('C language uses default C template and Monaco cpp highlighting', () => {
      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5002',
        languages: [{ value: '5002', text: 'C (GCC 12.2.0)' }],
        isDark: false,
      };

      editorPort.receiveEvent(new MessageEvent('message', { data: configMsg }));

      expect(global.monaco.editor.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          value: expect.stringContaining('#include <stdio.h>'),
          language: 'cpp',
        })
      );
    });

    test.each([
      ['Nim (Nim 1.6.14)', 'python'],
      ['Zig (Zig 0.10.1)', 'rust'],
      ['Julia (Julia 1.9.2)', 'julia'],
      ['Dart (Dart 3.0.5)', 'dart'],
      ['Lua (Lua 5.4.6)', 'lua'],
      ['D (DMD 2.104.0)', 'cpp'],
    ])('%s initializes editor with %s syntax highlighter', (langText, expectedMonacoLang) => {
      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '9999',
        languages: [{ value: '9999', text: langText }],
        isDark: false,
      };

      editorPort.receiveEvent(new MessageEvent('message', { data: configMsg }));

      expect(global.monaco.editor.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          language: expectedMonacoLang,
        })
      );
    });

    test('Redirection button inside drawer works correctly', () => {
      const snippetsBtn = document.getElementById('snippets-btn');
      const manageSnippetsBtn = document.getElementById('manage-snippets-btn');

      // Open drawer
      snippetsBtn.dispatchEvent(new Event('click'));

      // Click Manage button
      manageSnippetsBtn.dispatchEvent(new Event('click'));

      // Verify opens window URL pointing to settings anchor hash
      expect(window.open).toHaveBeenCalledWith('src/options/options.html#custom-snippets-section');
    });
  });
});
