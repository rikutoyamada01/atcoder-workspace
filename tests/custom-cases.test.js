/**
 * @jest-environment jsdom
 */

'use strict';

const fs = require('fs');
const path = require('path');
const i18n = require('../src/lib/i18n.js');

const editorHtml = fs.readFileSync(path.resolve(__dirname, '../src/editor/editor.html'), 'utf8');
const editorJs = fs.readFileSync(path.resolve(__dirname, '../src/editor/editor.js'), 'utf8');

describe('Custom Test Cases Module Tests', () => {
  let store = {};
  let postMessageMock;
  let monacoMock;
  let eventListeners = [];
  const originalAddEventListener = window.addEventListener.bind(window);

  beforeEach(() => {
    store = {};
    eventListeners = [];
    global.i18n = i18n;

    const jaMessages = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../_locales/ja/messages.json'), 'utf8')
    );

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(jaMessages),
      })
    );

    postMessageMock = jest.fn();
    window.parent.postMessage = postMessageMock;

    global.require = jest.fn((deps, cb) => cb());
    global.require.config = jest.fn();

    monacoMock = {
      editor: {
        create: jest.fn(() => ({
          getValue: jest.fn(() => 'print("hello")'),
          setValue: jest.fn(),
          getModel: jest.fn(() => ({ dispose: jest.fn() })),
          setModel: jest.fn(),
          layout: jest.fn(),
          updateOptions: jest.fn(),
          addCommand: jest.fn(),
          onDidChangeModelContent: jest.fn(() => ({ dispose: jest.fn() })),
          dispose: jest.fn(),
        })),
        createModel: jest.fn(),
        setTheme: jest.fn(),
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
    global.monaco = monacoMock;

    global.chrome = {
      runtime: {
        id: 'dummy-extension-id',
        getURL: jest.fn((p) => p),
      },
      i18n: {
        getMessage: jest.fn((key) => {
          const entry = jaMessages[key];
          return entry ? entry.message : '';
        }),
        getUILanguage: jest.fn(() => 'ja'),
      },
      storage: {
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach((k) => {
              if (store[k] !== undefined) {
                result[k] = store[k];
              }
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

    window.addEventListener = (event, handler, options) => {
      eventListeners.push({ event, handler, options });
      return originalAddEventListener(event, handler, options);
    };

    // Load editor DOM
    const parser = new DOMParser();
    const doc = parser.parseFromString(editorHtml, 'text/html');
    document.body.innerHTML = doc.body.innerHTML;

    // Load editor.js
    const script = document.createElement('script');
    script.textContent = editorJs;
    document.body.appendChild(script);
  });

  afterEach(() => {
    delete global.require;
    eventListeners.forEach(({ event, handler, options }) => {
      window.removeEventListener(event, handler, options);
    });
    eventListeners = [];
    window.addEventListener = originalAddEventListener;
    jest.clearAllMocks();
  });

  test('renders custom test cases section and empty placeholder initially', () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_p1',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
          isDark: false,
        },
      })
    );

    const section = document.getElementById('custom-cases-section');
    expect(section).not.toBeNull();

    const emptyEl = document.querySelector('.custom-cases-empty');
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.textContent).toContain('カスタムテストケース');
  });

  test('toggles add custom case form and creates a new custom case', () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_p2',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
          isDark: false,
        },
      })
    );

    const addBtn = document.getElementById('add-custom-case-btn');
    const form = document.getElementById('custom-case-form');
    const nameInput = document.getElementById('custom-case-name');
    const inputArea = document.getElementById('custom-case-input');
    const expectedArea = document.getElementById('custom-case-expected');
    const saveBtn = document.getElementById('save-custom-case-btn');

    expect(form.style.display).toBe('none');

    // Click Add button
    addBtn.click();
    expect(form.style.display).toBe('flex');

    // Fill form
    nameInput.value = 'N=1 Corner Case';
    inputArea.value = '1\n';
    expectedArea.value = '0\n';

    // Click Save
    saveBtn.click();

    expect(form.style.display).toBe('none');

    const key = 'custom_test_cases:abc300:abc300_p2';
    expect(store[key]).toBeDefined();
    expect(store[key].length).toBe(1);
    expect(store[key][0].name).toBe('N=1 Corner Case');
    expect(store[key][0].input).toBe('1\n');
    expect(store[key][0].expected).toBe('0\n');

    // Verify rendered card
    const cards = document.querySelectorAll('.custom-case-card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('N=1 Corner Case');
    expect(cards[0].textContent).toContain('1\n');
    expect(cards[0].textContent).toContain('0\n');
  });

  test('validates required input stdin before saving', () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_p3',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
          isDark: false,
        },
      })
    );
    window.alert = jest.fn();

    const addBtn = document.getElementById('add-custom-case-btn');
    const form = document.getElementById('custom-case-form');
    const inputArea = document.getElementById('custom-case-input');
    const saveBtn = document.getElementById('save-custom-case-btn');

    addBtn.click();
    inputArea.value = '   '; // only whitespace

    saveBtn.click();

    expect(window.alert).toHaveBeenCalled();
    expect(form.style.display).toBe('flex'); // Still open
  });

  test('edits an existing custom test case', () => {
    const key = 'custom_test_cases:abc300:abc300_p4';
    store[key] = [
      {
        id: 'custom_test_1',
        name: 'Initial Case',
        input: '10\n',
        expected: '20\n',
        createdAt: Date.now(),
      },
    ];

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_p4',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
          isDark: false,
        },
      })
    );

    const editBtn = document.querySelector('.btn-edit-custom-case');
    expect(editBtn).not.toBeNull();

    editBtn.click();

    const form = document.getElementById('custom-case-form');
    const nameInput = document.getElementById('custom-case-name');
    const inputArea = document.getElementById('custom-case-input');
    const expectedArea = document.getElementById('custom-case-expected');
    const saveBtn = document.getElementById('save-custom-case-btn');

    expect(form.style.display).toBe('flex');
    expect(nameInput.value).toBe('Initial Case');
    expect(inputArea.value).toBe('10\n');
    expect(expectedArea.value).toBe('20\n');

    // Update fields
    nameInput.value = 'Updated Case Name';
    expectedArea.value = '30\n';

    saveBtn.click();

    expect(global.chrome.storage.local.set).toHaveBeenCalled();
    expect(store[key][0].name).toBe('Updated Case Name');
    expect(store[key][0].expected).toBe('30\n');
  });

  test('deletes a custom test case when confirmed', () => {
    window.confirm = jest.fn(() => true);

    const key = 'custom_test_cases:abc300:abc300_p5';
    store[key] = [
      {
        id: 'custom_test_1',
        name: 'Case To Delete',
        input: '10\n',
        expected: '20\n',
        createdAt: Date.now(),
      },
    ];

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_p5',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
          isDark: false,
        },
      })
    );

    const deleteBtn = document.querySelector('.btn-delete-custom-case');
    expect(deleteBtn).not.toBeNull();

    deleteBtn.click();

    expect(window.confirm).toHaveBeenCalled();
    expect(store[key].length).toBe(0);

    const emptyEl = document.querySelector('.custom-cases-empty');
    expect(emptyEl).not.toBeNull();
  });

  test('sends customCases in run-tests message when test button is clicked', () => {
    const key = 'custom_test_cases:abc300:abc300_p6';
    store[key] = [
      {
        id: 'custom_test_1',
        name: 'Max Constraints',
        input: '100000\n',
        expected: '',
        createdAt: Date.now(),
      },
    ];

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_p6',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
          isDark: false,
        },
      })
    );

    const testBtn = document.getElementById('test-btn');
    testBtn.click();

    expect(postMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'run-tests',
        code: 'print("hello")',
        languageId: '5001',
        customCases: [
          {
            id: 'custom_test_1',
            name: 'Max Constraints',
            input: '100000\n',
            expected: '',
          },
        ],
      }),
      '*'
    );
  });

  test('should display reload banner when extension context is invalidated', () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'init-config',
          contestId: 'abc300',
          problemId: 'abc300_p7',
          selectedLanguageId: '5001',
          languages: [{ value: '5001', text: 'C++ (GCC 12.2)' }],
          isDark: false,
        },
      })
    );

    const banner = document.getElementById('context-invalidated-banner');
    expect(banner).not.toBeNull();
    expect(banner.style.display).toBe('none');

    // Invalidate chrome.runtime
    delete global.chrome.runtime.id;

    // Trigger saveCode on beforeunload or interval
    window.dispatchEvent(new Event('beforeunload'));

    expect(banner.style.display).toBe('flex');
    const reloadBtn = document.getElementById('context-reload-btn');
    expect(reloadBtn).not.toBeNull();
  });
});
