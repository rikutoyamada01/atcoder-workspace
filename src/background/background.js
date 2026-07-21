/**
 * AtCoder Workspace - Background Service Worker
 * Handles extension lifecycle events and browser action triggers.
 */

'use strict';

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
