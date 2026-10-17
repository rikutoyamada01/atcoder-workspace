/**
 * AtCoder Workspace - Background Service Worker
 * Handles extension lifecycle events and browser action triggers.
 */

'use strict';

// Only an extension editor inside an AtCoder task tab may open this bridge.
chrome.runtime.onConnect.addListener((editorPort) => {
  const sender = editorPort.sender;
  if (
    editorPort.name !== 'workspace-editor' ||
    sender?.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL('src/editor/editor.html') ||
    !Number.isInteger(sender.tab?.id) ||
    !(sender.frameId > 0) ||
    !/^https:\/\/atcoder\.jp\/contests\/[^/?#]+\/tasks\/[^/?#]+\/?(?:[?#]|$)/.test(
      sender.tab.url || ''
    )
  ) {
    editorPort.disconnect();
    return;
  }

  // Chrome targets the top-level content script in this same tab, never the page.
  const contentPort = chrome.tabs.connect(sender.tab.id, {
    name: 'workspace-editor',
    frameId: 0,
  });
  const bridgeId = crypto.randomUUID();
  let disconnected = false;
  const disconnect = () => {
    void chrome.runtime.lastError;
    if (disconnected) return;
    disconnected = true;
    editorPort.disconnect();
    contentPort.disconnect();
  };
  const forward = (port, message) => {
    if (!disconnected && message && typeof message === 'object') port.postMessage(message);
  };
  editorPort.onMessage.addListener((message) => forward(contentPort, message));
  contentPort.onMessage.addListener((message) => forward(editorPort, message));
  editorPort.onDisconnect.addListener(disconnect);
  contentPort.onDisconnect.addListener(disconnect);
  editorPort.postMessage({ type: 'workspace-identify', bridgeId });
  contentPort.postMessage({ type: 'workspace-identify', bridgeId });
});

// Open the options page when the user clicks the extension icon in the toolbar
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

const UNINSTALL_SURVEY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfj0RgZEhpAUQoHxyZvvq8ylMpbiutusKMN4ak_qOKa-UigAw/viewform';

// Set uninstall URL and handle update notifications
chrome.runtime.onInstalled.addListener((details) => {
  chrome.runtime.setUninstallURL(UNINSTALL_SURVEY_URL, () => {
    if (chrome.runtime.lastError) {
      console.error('Failed to set uninstall URL:', chrome.runtime.lastError.message);
    } else {
      console.log('Uninstall URL set successfully:', UNINSTALL_SURVEY_URL);
    }
  });

  if (details.reason === 'update' || details.reason === 'install') {
    const currentVersion = chrome.runtime.getManifest().version;
    chrome.storage.local.set({
      whats_new_unread: true,
      last_updated_version: currentVersion,
    });
    chrome.runtime.openOptionsPage();
  }
});
