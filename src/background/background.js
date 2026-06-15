/**
 * AtCoder Workspace - Background Service Worker
 * Handles extension lifecycle events and browser action triggers.
 */

'use strict';

// Open the options page when the user clicks the extension icon in the toolbar
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
