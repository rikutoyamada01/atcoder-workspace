/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const layoutCode = fs.readFileSync(path.resolve(__dirname, '../src/content/layout.js'), 'utf8');

describe('Layout Module Tests', () => {
  let layout;

  beforeEach(() => {
    // Reset document state
    document.documentElement.className = '';
    document.body.className = '';
    document.body.innerHTML = `
      <div id="main-container">
        <div>Content</div>
      </div>
      <footer>Footer</footer>
    `;

    window.AtCoderWorkspace = {};
    window.scrollTo = jest.fn(); // Mock scrollTo which is missing in jsdom

    // Mock chrome extension APIs with runtime.id for check context validation
    global.chrome = {
      runtime: {
        id: 'dummy-extension-id',
        getURL: (p) => p,
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            callback({
              'settings:split_ratio': 0.4,
              'settings:panel_open': true,
            });
          }),
          set: jest.fn(),
        },
      },
    };

    const script = document.createElement('script');
    script.textContent = layoutCode;
    document.body.appendChild(script);

    layout = window.AtCoderWorkspace.Layout;
  });

  afterEach(() => {
    delete global.chrome;
    delete window.scrollTo;
  });

  test('Layout module is defined', () => {
    expect(layout).toBeDefined();
  });

  test('Layout.init sets up workspace elements and classes when initially open', () => {
    layout.init(jest.fn());

    // Verify elements are created and structured correctly
    const wrapper = document.getElementById('atcoder-workspace-wrapper');
    const splitter = document.getElementById('atcoder-workspace-splitter');
    const panel = document.getElementById('atcoder-workspace-panel');
    const iframe = document.getElementById('atcoder-workspace-iframe');
    const toggleBtn = document.getElementById('atcoder-workspace-toggle-btn');
    const mainContainer = document.getElementById('main-container');

    expect(wrapper).not.toBeNull();
    expect(splitter).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(iframe).not.toBeNull();
    expect(toggleBtn).not.toBeNull();

    // Verify classes added to body and documentElement
    expect(document.body.classList.contains('atcoder-workspace-active')).toBe(true);
    expect(document.documentElement.classList.contains('atcoder-workspace-active')).toBe(true);

    // Verify correct width is set according to loaded split_ratio (0.4)
    expect(panel.style.width).toBe('40%');
    expect(mainContainer.style.width).toBe('60%');
  });

  test('Layout.init sets up closed layout when storage panel_open is false', () => {
    // Reconfigure storage mock to return closed state
    global.chrome.storage.local.get = jest.fn((keys, callback) => {
      callback({
        'settings:split_ratio': 0.4,
        'settings:panel_open': false,
      });
    });

    layout.init(jest.fn());

    const wrapper = document.getElementById('atcoder-workspace-wrapper');
    const panel = document.getElementById('atcoder-workspace-panel');
    const mainContainer = document.getElementById('main-container');

    expect(layout.isOpen()).toBe(false);
    expect(document.body.classList.contains('atcoder-workspace-active')).toBe(false);
    expect(document.documentElement.classList.contains('atcoder-workspace-active')).toBe(false);

    // Verify inline widths and tops are clean
    expect(panel.style.width).toBe('');
    expect(mainContainer.style.width).toBe('');
    expect(wrapper.style.top).toBe('');
  });

  test('Layout toggleBtn click toggles open/closed state and resets styles completely', () => {
    layout.init(jest.fn());

    const toggleBtn = document.getElementById('atcoder-workspace-toggle-btn');
    const wrapper = document.getElementById('atcoder-workspace-wrapper');
    const panel = document.getElementById('atcoder-workspace-panel');
    const mainContainer = document.getElementById('main-container');

    expect(layout.isOpen()).toBe(true);

    // 1. Click to close
    toggleBtn.dispatchEvent(new Event('click'));

    expect(layout.isOpen()).toBe(false);
    // Classes must be removed from both body and documentElement
    expect(document.body.classList.contains('atcoder-workspace-active')).toBe(false);
    expect(document.documentElement.classList.contains('atcoder-workspace-active')).toBe(false);
    // Inline widths and tops must be completely cleared
    expect(mainContainer.style.width).toBe('');
    expect(panel.style.width).toBe('');
    expect(wrapper.style.top).toBe('');
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ 'settings:panel_open': false });

    // 2. Click to open again
    toggleBtn.dispatchEvent(new Event('click'));

    expect(layout.isOpen()).toBe(true);
    expect(document.body.classList.contains('atcoder-workspace-active')).toBe(true);
    expect(document.documentElement.classList.contains('atcoder-workspace-active')).toBe(true);
    expect(mainContainer.style.width).toBe('60%');
    expect(panel.style.width).toBe('40%');
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ 'settings:panel_open': true });
  });
});
