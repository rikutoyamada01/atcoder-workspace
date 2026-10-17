/** @jest-environment jsdom */
'use strict';

const fs = require('fs');
const path = require('path');
const optionsHtml = fs.readFileSync(path.join(__dirname, '../src/options/options.html'), 'utf8');
const optionsJs = fs.readFileSync(path.join(__dirname, '../src/options/options.js'), 'utf8');

let store;

async function openOptions() {
  document.body.innerHTML = optionsHtml;
  let initialize;
  const listener = jest.spyOn(document, 'addEventListener').mockImplementation((type, callback) => {
    if (type === 'DOMContentLoaded') initialize = callback;
  });
  new Function('chrome', 'i18n', optionsJs)(chrome, {
    I18nProvider: class {
      async init() {}
      t(key) {
        return key;
      }
    },
    translatePage: jest.fn(),
  });
  listener.mockRestore();
  await initialize();
}

beforeEach(() => {
  jest.useFakeTimers();
  store = {};
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => [] }));
  global.chrome = {
    runtime: { id: 'extension', getManifest: () => ({ version: '1.8.0' }) },
    storage: {
      onChanged: { addListener: jest.fn() },
      local: {
        get: jest.fn((keys, callback) =>
          callback(
            keys === null
              ? { ...store }
              : Object.fromEntries(
                  (Array.isArray(keys) ? keys : [keys]).map((key) => [key, store[key]])
                )
          )
        ),
        set: jest.fn((data, callback) => {
          Object.assign(store, data);
          if (callback) callback();
        }),
        clear: jest.fn((callback) => {
          store = {};
          callback();
        }),
        remove: jest.fn((key, callback) => {
          delete store[key];
          if (callback) callback();
        }),
      },
    },
  };
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  delete global.chrome;
  delete global.fetch;
  delete window.HTMLElement.prototype.scrollIntoView;
});

const snippet = (id) => ({
  id,
  title: 'Imported snippet',
  lang: 'cpp',
  desc: 'description',
  tags: ['math'],
  code: '// saved code',
});
const attack =
  '"><form id="injected" action="//example.invalid/"><input name="password"></form><span data-x="';

test('stored snippet IDs stay inert while edit and delete preserve their exact identity', async () => {
  store['settings:custom_snippets'] = [snippet(attack), snippet(123)];
  await openOptions();
  const edit = document.querySelector('.edit-btn');
  expect(document.getElementById('injected')).toBeNull();
  expect(edit.dataset.id).toBe(attack);
  expect(document.querySelectorAll('.edit-btn')[1].dataset.id).toBe('123');
  edit.click();
  expect(document.getElementById('snippet-code-input').value).toBe('// saved code');
  document.getElementById('snippet-title-input').value = 'Edited';
  document.getElementById('save-snippet-btn').click();
  expect(store['settings:custom_snippets'][0]).toEqual(
    expect.objectContaining({ id: attack, title: 'Edited' })
  );
  document.querySelector('.delete-btn').click();
  expect(store['settings:custom_snippets']).toEqual([snippet(123)]);
});

test.each(['stats:ac_problems', 'status', 'problem_notes'])(
  'problem keys from %s stay inert and status changes find the correct dot',
  async (source) => {
    const problemKey = `abc300:task${attack}`;
    if (source === 'stats:ac_problems') store[source] = [problemKey];
    else
      store[`${source}:${problemKey}`] =
        source === 'status' ? 'self_ac' : { note: 'saved', tags: [] };
    await openOptions();
    expect(document.getElementById('injected')).toBeNull();
    const dot = document.getElementById(`dot-${problemKey.replace(':', '-')}`);
    expect(dot).not.toBeNull();
    const select = document.querySelector('.status-select');
    expect(select.dataset.key).toBe(problemKey);
    for (const [status, dotClass] of [
      ['editorial_ac', 'dot-editorial'],
      ['self_ac', 'dot-self'],
      ['unsolved', 'dot-unsolved'],
    ]) {
      select.value = status;
      select.dispatchEvent(new Event('change'));
      expect(store[`status:${problemKey}`]).toBe(status === 'unsolved' ? undefined : status);
      expect(dot.className).toBe(`status-badge-dot ${dotClass}`);
    }
  }
);

test.each(['merge', 'overwrite'])(
  '%s backup restore renders identifiers as data and preserves normal data',
  async (mode) => {
    store['settings:template:python'] = '# existing';
    await openOptions();
    const problemKey = `abc300:task${attack}`;
    const backup = {
      'settings:custom_snippets': [snippet(attack)],
      [`status:${problemKey}`]: 'editorial_ac',
      'problem_notes:abc300:abc300_a': { note: 'normal note', tags: ['DP'] },
      'code:abc300:abc300_a:5001': '// restored source',
    };
    jest.spyOn(window, 'FileReader').mockImplementation(function () {
      this.readAsText = () => this.onload({ target: { result: JSON.stringify(backup) } });
    });
    const input = document.getElementById('import-file-input');
    Object.defineProperty(input, 'files', { value: [new File(['backup'], 'backup.json')] });
    document.getElementById('import-mode-select').value = mode;
    input.dispatchEvent(new Event('change'));
    expect(chrome.storage.local.clear).toHaveBeenCalledTimes(mode === 'overwrite' ? 1 : 0);
    expect(store['settings:template:python']).toBe(mode === 'merge' ? '# existing' : undefined);
    expect(store['code:abc300:abc300_a:5001']).toBe('// restored source');
    expect(store['problem_notes:abc300:abc300_a'].note).toBe('normal note');
    await openOptions();
    expect(document.getElementById('injected')).toBeNull();
    expect(document.querySelector('.edit-btn').dataset.id).toBe(attack);
    expect(document.getElementById(`dot-${problemKey.replace(':', '-')}`)).not.toBeNull();
  }
);

test('entity-looking identifiers decode only once', async () => {
  const id = '&quot;&lt;img src=x onerror=alert(1)&gt;';
  store['settings:custom_snippets'] = [snippet(id)];
  await openOptions();
  expect(document.querySelector('.edit-btn').dataset.id).toBe(id);
  expect(document.querySelector('#snippets-table-body img')).toBeNull();
});
