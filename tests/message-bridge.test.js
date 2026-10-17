/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"https://atcoder.jp/contests/abc300/tasks/abc300_a"}
 */
'use strict';

const fs = require('fs');
const path = require('path');
const backgroundJs = fs.readFileSync(
  path.join(__dirname, '../src/background/background.js'),
  'utf8'
);
const contentJs = fs.readFileSync(path.join(__dirname, '../src/content/content.js'), 'utf8');

function event() {
  const listeners = [];
  return {
    addListener: (listener) => listeners.push(listener),
    emit: (value) => listeners.forEach((listener) => listener(value)),
  };
}

function port(sender) {
  const connection = {
    name: 'workspace-editor',
    sender,
    onMessage: event(),
    onDisconnect: event(),
    postMessage: jest.fn(),
  };
  let disconnected = false;
  connection.disconnect = jest.fn(() => {
    if (disconnected) return;
    disconnected = true;
    connection.onDisconnect.emit();
  });
  return connection;
}

function chromeMock() {
  return {
    runtime: {
      id: 'extension',
      getURL: (file) => `chrome-extension://extension/${file}`,
      onConnect: event(),
      onInstalled: event(),
    },
    action: { onClicked: event() },
    tabs: { connect: jest.fn(() => port({ id: 'extension' })) },
    storage: { local: { get: jest.fn((keys, callback) => callback({})), set: jest.fn() } },
  };
}

const editorSender = (tabId = 1) => ({
  id: 'extension',
  frameId: 3,
  url: 'chrome-extension://extension/src/editor/editor.html',
  tab: { id: tabId, url: 'https://atcoder.jp/contests/abc300/tasks/abc300_a' },
});

test.each([
  { id: 'external' },
  { url: 'https://atcoder.jp/' },
  { frameId: 0 },
  { tab: { id: 1, url: 'https://atcoder.jp.attacker.invalid/contests/a/tasks/b' } },
  { tab: { id: 1, url: 'https://atcoder.jp/contests/a/tasks' } },
  { tab: undefined },
])('rejects unauthenticated editor endpoint %j', (override) => {
  const chrome = chromeMock();
  new Function('chrome', 'crypto', backgroundJs)(chrome, require('crypto'));
  const editor = port({ ...editorSender(), ...override });
  chrome.runtime.onConnect.emit(editor);
  expect(editor.disconnect).toHaveBeenCalledTimes(1);
  expect(chrome.tabs.connect).not.toHaveBeenCalled();
});

test('relays only within the originating tab and tears down both directions', () => {
  const chrome = chromeMock();
  new Function('chrome', 'crypto', backgroundJs)(chrome, require('crypto'));
  const first = port(editorSender(1));
  const second = port(editorSender(2));
  chrome.runtime.onConnect.emit(first);
  chrome.runtime.onConnect.emit(second);
  const [firstContent, secondContent] = chrome.tabs.connect.mock.results.map((r) => r.value);
  expect(chrome.tabs.connect).toHaveBeenNthCalledWith(1, 1, {
    name: 'workspace-editor',
    frameId: 0,
  });
  expect(chrome.tabs.connect).toHaveBeenNthCalledWith(2, 2, {
    name: 'workspace-editor',
    frameId: 0,
  });
  first.postMessage.mockClear();
  second.postMessage.mockClear();
  firstContent.postMessage.mockClear();
  secondContent.postMessage.mockClear();
  first.onMessage.emit({ type: 'run-tests' });
  expect(firstContent.postMessage).toHaveBeenCalledWith({ type: 'run-tests' });
  expect(secondContent.postMessage).not.toHaveBeenCalled();
  firstContent.onMessage.emit({ type: 'init-config' });
  expect(first.postMessage).toHaveBeenCalledWith({ type: 'init-config' });
  expect(second.postMessage).not.toHaveBeenCalled();
  first.disconnect();
  expect(firstContent.disconnect).toHaveBeenCalledTimes(1);
  firstContent.postMessage.mockClear();
  first.onMessage.emit({ type: 'submit-code' });
  expect(firstContent.postMessage).not.toHaveBeenCalled();
});

test('content handshake preserves ready queue, task context and reconnect behavior', () => {
  const chrome = chromeMock();
  document.body.innerHTML =
    '<select name="data.LanguageId"><option value="5001">C++</option></select>';
  window.matchMedia = jest.fn(() => ({ matches: false }));
  const managedWindow = {};
  const layout = {
    init: jest.fn((callback) => callback()),
    getIframe: () => ({ contentWindow: managedWindow }),
  };
  const addListener = jest.spyOn(window, 'addEventListener');
  const submit = jest.fn();
  window.AtCoderWorkspace = {
    Layout: layout,
    Scraper: { loadNavigationUrls: (contest, callback) => callback(null, null) },
    Runner: {},
    Submitter: { submit },
  };
  new Function('chrome', 'window', 'document', contentJs)(chrome, window, document);
  if (document.readyState === 'loading') document.dispatchEvent(new Event('DOMContentLoaded'));
  const identify = addListener.mock.calls.find(([type]) => type === 'message')[1];
  addListener.mockRestore();
  const identifyWindow = (bridgeId, source = managedWindow, isTrusted = true) =>
    identify({
      isTrusted,
      origin: 'chrome-extension://extension',
      source,
      data: { type: 'workspace-identify', bridgeId },
    });
  const foreign = port({ id: 'external' });
  chrome.runtime.onConnect.emit(foreign);
  expect(foreign.postMessage).not.toHaveBeenCalled();
  const first = port({ id: 'extension' });
  chrome.runtime.onConnect.emit(first);
  first.onMessage.emit({ type: 'workspace-identify', bridgeId: 'first' });
  expect(first.postMessage).not.toHaveBeenCalled();
  identifyWindow('first', managedWindow, false);
  identifyWindow('first', {});
  expect(first.postMessage).not.toHaveBeenCalled();
  identifyWindow('first');
  expect(first.postMessage).toHaveBeenCalledWith({ type: 'workspace-connected' });
  first.onMessage.emit({ type: 'editor-ready' });
  expect(first.postMessage.mock.calls.map(([message]) => message.type)).toEqual([
    'workspace-connected',
    'resize',
    'init-config',
  ]);
  expect(first.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'init-config',
      contestId: 'abc300',
      problemId: 'abc300_a',
      selectedLanguageId: '5001',
    })
  );
  first.onMessage.emit({ type: 'submit-code', code: 'legitimate', languageId: '5001' });
  expect(submit).toHaveBeenCalledWith(
    'abc300',
    'abc300_a',
    '5001',
    'legitimate',
    expect.any(Function)
  );
  const second = port({ id: 'extension' });
  chrome.runtime.onConnect.emit(second);
  second.onMessage.emit({ type: 'workspace-identify', bridgeId: 'second' });
  identifyWindow('second', {});
  second.onMessage.emit({ type: 'editor-ready' });
  expect(first.disconnect).not.toHaveBeenCalled();
  expect(second.postMessage).not.toHaveBeenCalled();
  // The managed iframe reconnects; bootstrap can arrive before the native port.
  identifyWindow('third');
  const third = port({ id: 'extension' });
  chrome.runtime.onConnect.emit(third);
  third.onMessage.emit({ type: 'workspace-identify', bridgeId: 'third' });
  expect(first.disconnect).toHaveBeenCalled();
  submit.mockClear();
  first.onMessage.emit({ type: 'submit-code', code: 'stale', languageId: '5001' });
  window.dispatchEvent(
    new MessageEvent('message', { data: { type: 'submit-code', code: 'page', languageId: '5001' } })
  );
  expect(submit).not.toHaveBeenCalled();
  third.onMessage.emit({ type: 'editor-ready' });
  expect(third.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'init-config' }));
});
