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

  let onChangedListeners = [];

  beforeEach(() => {
    store = {};
    onChangedListeners = [];
    global.i18n = i18n;

    const jaMessages = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../_locales/ja/messages.json'), 'utf8'));
    const enMessages = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../_locales/en/messages.json'), 'utf8'));

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

    test('Custom Snippets CRUD list management works correctly', () => {
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
      snippetLangSelect.value = 'cpp';
      snippetDescInput.value = 'Range sum segment tree';
      snippetTagsInput.value = 'segtree, data-structure';
      snippetCodeInput.value = 'struct SegTree {};';
      saveSnippetBtn.dispatchEvent(new Event('click'));

      // Check storage save
      const savedSnippets = store['settings:custom_snippets'];
      expect(savedSnippets).toBeDefined();
      expect(savedSnippets.length).toBe(1);
      expect(savedSnippets[0].title).toBe('My Segment Tree');
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
      window.dispatchEvent(new MessageEvent('message', { data: configMsg }));

      // Editor should create with default C++ template (since local storage config is empty)
      expect(global.monaco.editor.create).toHaveBeenCalled();
      expect(global.monaco.editor.create.mock.calls[0][1].value).toContain(
        '#include <bits/stdc++.h>'
      );
      expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });

    test('fetches latest submission from AtCoder if local code history is empty', async () => {
      const parentPostMessageMock = jest
        .spyOn(window.parent, 'postMessage')
        .mockImplementation(() => {});

      const configMsg = {
        type: 'init-config',
        contestId: 'abc300',
        problemId: 'abc300_a',
        selectedLanguageId: '5001',
        languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
        isDark: true,
      };

      window.dispatchEvent(new MessageEvent('message', { data: configMsg }));

      expect(parentPostMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'fetch-latest-submission',
          languageId: '5001',
          mode: 'cpp',
        }),
        '*'
      );

      const submissionLoadedMsg = {
        type: 'latest-submission-loaded',
        code: '// previously submitted solution code',
        mode: 'cpp',
      };

      window.dispatchEvent(new MessageEvent('message', { data: submissionLoadedMsg }));

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

      parentPostMessageMock.mockRestore();
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
      window.dispatchEvent(new MessageEvent('message', { data: configMsg }));

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
      window.dispatchEvent(new MessageEvent('message', { data: configMsg }));

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
