(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.i18n = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUPPORTED_LANGS = ['ja', 'en'];

  class ChromeI18nLoader {
    async load() {
      // No-op for standard Chrome runtime i18n
    }
    getMessage(key, placeholders = []) {
      if (typeof chrome !== 'undefined' && chrome.i18n) {
        return chrome.i18n.getMessage(key, placeholders);
      }
      return null;
    }
  }

  class JsonI18nLoader {
    constructor(locale) {
      this.locale = locale;
      this.messages = {};
    }

    async load() {
      try {
        const url = chrome.runtime.getURL(`_locales/${this.locale}/messages.json`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        this.messages = await response.json();
      } catch (err) {
        console.warn(`[I18n] Failed to load messages for ${this.locale}, falling back to 'ja'`, err);
        if (this.locale !== 'ja') {
          this.locale = 'ja';
          await this.load();
        }
      }
    }

    getMessage(key, placeholders = []) {
      const item = this.messages[key];
      if (!item || !item.message) return null;

      let message = item.message;
      if (placeholders && placeholders.length > 0) {
        placeholders.forEach((val, idx) => {
          message = message.replace(new RegExp(`\\$${idx + 1}`, 'g'), val);
        });
      }
      return message;
    }
  }

  class I18nProvider {
    constructor() {
      this.locale = 'ja';
      this.mode = 'auto';
      this.loader = new ChromeI18nLoader();
    }

    async init() {
      // 1. Get setting from storage
      const res = await new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['settings:display_language'], resolve);
        } else {
          resolve({});
        }
      });

      this.mode = res['settings:display_language'] || 'auto';

      // 2. Resolve locale
      let targetLang = this.mode;
      if (targetLang === 'auto') {
        const uiLang = typeof chrome !== 'undefined' && chrome.i18n ? chrome.i18n.getUILanguage() : 'ja';
        targetLang = this.normalizeLanguage(uiLang);
      }
      this.locale = targetLang;

      // 3. Choose loader
      if (this.mode === 'auto' && typeof chrome !== 'undefined' && chrome.i18n) {
        this.loader = new ChromeI18nLoader();
      } else {
        this.loader = new JsonI18nLoader(this.locale);
      }

      await this.loader.load();
    }

    normalizeLanguage(lang) {
      if (!lang) return 'ja';
      const lower = lang.toLowerCase();
      for (const supported of SUPPORTED_LANGS) {
        if (lower.startsWith(supported)) {
          return supported;
        }
      }
      return 'ja'; // Default fallback
    }

    t(key, placeholders = []) {
      const msg = this.loader.getMessage(key, placeholders);
      return msg;
    }
  }

  function translateElement(elem, provider) {
    if (!elem) return;

    // 1. textContent
    if (elem.hasAttribute('data-i18n')) {
      const key = elem.getAttribute('data-i18n');
      const msg = provider.t(key);
      if (msg !== null) elem.textContent = msg;
    }
    // 2. placeholder
    if (elem.hasAttribute('data-i18n-placeholder')) {
      const key = elem.getAttribute('data-i18n-placeholder');
      const msg = provider.t(key);
      if (msg !== null) elem.setAttribute('placeholder', msg);
    }
    // 3. title
    if (elem.hasAttribute('data-i18n-title')) {
      const key = elem.getAttribute('data-i18n-title');
      const msg = provider.t(key);
      if (msg !== null) elem.setAttribute('title', msg);
    }
    // 4. alt
    if (elem.hasAttribute('data-i18n-alt')) {
      const key = elem.getAttribute('data-i18n-alt');
      const msg = provider.t(key);
      if (msg !== null) elem.setAttribute('alt', msg);
    }
    // 5. aria-label
    if (elem.hasAttribute('data-i18n-aria-label')) {
      const key = elem.getAttribute('data-i18n-aria-label');
      const msg = provider.t(key);
      if (msg !== null) elem.setAttribute('aria-label', msg);
    }
  }

  function translatePage(provider, root = document) {
    const selector = '[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-alt], [data-i18n-aria-label]';
    
    if (root !== document && root.matches && root.matches(selector)) {
      translateElement(root, provider);
    }
    
    const elements = root.querySelectorAll(selector);
    elements.forEach((elem) => {
      translateElement(elem, provider);
    });
  }

  return {
    SUPPORTED_LANGS,
    I18nProvider,
    ChromeI18nLoader,
    JsonI18nLoader,
    translatePage,
    translateElement
  };
}));
