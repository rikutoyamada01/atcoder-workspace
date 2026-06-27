/**
 * @jest-environment jsdom
 */

'use strict';

const i18n = require('../src/lib/i18n');

describe('i18n Library Tests', () => {
  let store = {};

  beforeEach(() => {
    store = {};

    // Mock chrome APIs
    global.chrome = {
      runtime: {
        getURL: jest.fn((path) => `chrome-extension://dummy/${path}`),
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const res = {};
            const keysArray = Array.isArray(keys) ? keys : [keys];
            keysArray.forEach((k) => {
              res[k] = store[k];
            });
            if (callback) callback(res);
            return Promise.resolve(res);
          }),
          set: jest.fn((data, callback) => {
            Object.assign(store, data);
            if (callback) callback();
            return Promise.resolve();
          }),
        },
      },
      i18n: {
        getMessage: jest.fn((key, _placeholders) => {
          if (key === 'test_key') return 'Chrome Value';
          return null;
        }),
        getUILanguage: jest.fn(() => 'ja-JP'),
      },
    };

    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.chrome;
    delete global.fetch;
  });

  describe('normalizeLanguage', () => {
    const provider = new i18n.I18nProvider();

    test('should normalize supported languages', () => {
      expect(provider.normalizeLanguage('ja')).toBe('ja');
      expect(provider.normalizeLanguage('ja-JP')).toBe('ja');
      expect(provider.normalizeLanguage('en')).toBe('en');
      expect(provider.normalizeLanguage('en-US')).toBe('en');
      expect(provider.normalizeLanguage('EN-GB')).toBe('en');
    });

    test('should fallback to ja for unsupported languages or null values', () => {
      expect(provider.normalizeLanguage('fr')).toBe('ja');
      expect(provider.normalizeLanguage('es-ES')).toBe('ja');
      expect(provider.normalizeLanguage(null)).toBe('ja');
      expect(provider.normalizeLanguage(undefined)).toBe('ja');
    });
  });

  describe('JsonI18nLoader', () => {
    test('should load locale messages and translate keys', async () => {
      const messages = {
        settings_title: { message: 'AtCoder Workspace Settings' },
        button_save: { message: 'Save $1' },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => messages,
      });

      const loader = new i18n.JsonI18nLoader('en');
      await loader.load();

      expect(global.fetch).toHaveBeenCalledWith(
        'chrome-extension://dummy/_locales/en/messages.json'
      );
      expect(loader.getMessage('settings_title')).toBe('AtCoder Workspace Settings');
      expect(loader.getMessage('button_save', ['Template'])).toBe('Save Template');
      expect(loader.getMessage('non_existent')).toBeNull();
    });

    test('should fallback to ja on fetch error', async () => {
      // en fetch fails
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      // ja fetch succeeds
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          settings_title: { message: '設定画面' },
        }),
      });

      const loader = new i18n.JsonI18nLoader('en');
      await loader.load();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(loader.locale).toBe('ja');
      expect(loader.getMessage('settings_title')).toBe('設定画面');
    });
  });

  describe('ChromeI18nLoader', () => {
    test('should delegate to chrome.i18n.getMessage', () => {
      const loader = new i18n.ChromeI18nLoader();
      const msg = loader.getMessage('test_key');
      expect(global.chrome.i18n.getMessage).toHaveBeenCalledWith('test_key', []);
      expect(msg).toBe('Chrome Value');
    });

    test('should return null if chrome.i18n is not available', () => {
      delete global.chrome.i18n;
      const loader = new i18n.ChromeI18nLoader();
      expect(loader.getMessage('test_key')).toBeNull();
    });
  });

  describe('I18nProvider', () => {
    test('should initialize with default auto mode and chrome loader if system locale matches', async () => {
      const provider = new i18n.I18nProvider();
      await provider.init();

      expect(provider.mode).toBe('auto');
      expect(provider.locale).toBe('ja');
      expect(provider.loader).toBeInstanceOf(i18n.ChromeI18nLoader);
    });

    test('should use JsonI18nLoader if mode is set to a manual language', async () => {
      store['settings:display_language'] = 'en';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          test_key: { message: 'English Content' },
        }),
      });

      const provider = new i18n.I18nProvider();
      await provider.init();

      expect(provider.mode).toBe('en');
      expect(provider.locale).toBe('en');
      expect(provider.loader).toBeInstanceOf(i18n.JsonI18nLoader);
      expect(provider.t('test_key')).toBe('English Content');
    });
  });

  describe('DOM translation', () => {
    test('should translate elements with various data-i18n-* attributes', () => {
      // Setup mock provider
      const provider = new i18n.I18nProvider();
      provider.loader = {
        getMessage: jest.fn((key) => {
          const dict = {
            title: 'Page Title',
            placeholder: 'Enter text...',
            tooltip: 'More info',
            image_alt: 'Logo',
            aria: 'Close button',
          };
          return dict[key] || null;
        }),
      };

      document.body.innerHTML = `
        <div id="test-text" data-i18n="title">Original Text</div>
        <input id="test-input" data-i18n-placeholder="placeholder" placeholder="Original Placeholder" />
        <button id="test-button" data-i18n-title="tooltip" title="Original Title">Btn</button>
        <img id="test-img" data-i18n-alt="image_alt" alt="Original Alt" />
        <a id="test-aria" data-i18n-aria-label="aria" aria-label="Original Aria">Link</a>
      `;

      i18n.translatePage(provider);

      expect(document.getElementById('test-text').textContent).toBe('Page Title');
      expect(document.getElementById('test-input').getAttribute('placeholder')).toBe(
        'Enter text...'
      );
      expect(document.getElementById('test-button').getAttribute('title')).toBe('More info');
      expect(document.getElementById('test-img').getAttribute('alt')).toBe('Logo');
      expect(document.getElementById('test-aria').getAttribute('aria-label')).toBe('Close button');
    });
  });
});
