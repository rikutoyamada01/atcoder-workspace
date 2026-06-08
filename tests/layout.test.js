/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

const layoutCode = fs.readFileSync(
  path.resolve(__dirname, '../src/content/layout.js'),
  'utf8'
);

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
        getURL: (p) => p
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            callback({
              'settings:split_ratio': 0.4,
              'settings:panel_open': true
            });
          }),
          set: jest.fn()
        }
      }
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

  test('Layout.init sets up workspace elements and classes', () => {
    layout.init(jest.fn());

    // Verify elements are created and structured correctly
    const wrapper = document.getElementById('atcoder-workspace-wrapper');
    const splitter = document.getElementById('atcoder-workspace-splitter');
    const panel = document.getElementById('atcoder-workspace-panel');
    const iframe = document.getElementById('atcoder-workspace-iframe');
    const toggleBtn = document.getElementById('atcoder-workspace-toggle-btn');

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
    expect(document.getElementById('main-container').style.width).toBe('60%');
  });

  test('Layout toggleBtn click toggles open state and saves setting', () => {
    layout.init(jest.fn());

    const toggleBtn = document.getElementById('atcoder-workspace-toggle-btn');
    expect(layout.isOpen()).toBe(true);

    // Click to close
    toggleBtn.dispatchEvent(new Event('click'));

    expect(layout.isOpen()).toBe(false);
    expect(document.body.classList.contains('atcoder-workspace-active')).toBe(false);
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ 'settings:panel_open': false });

    // Click to open again
    toggleBtn.dispatchEvent(new Event('click'));

    expect(layout.isOpen()).toBe(true);
    expect(document.body.classList.contains('atcoder-workspace-active')).toBe(true);
    expect(global.chrome.storage.local.set).toHaveBeenCalledWith({ 'settings:panel_open': true });
  });
});
