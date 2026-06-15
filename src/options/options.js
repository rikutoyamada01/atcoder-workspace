/**
 * AtCoder Workspace - Options Page Logic
 * Manages extension configurations and storage management.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const splitRatioInput = document.getElementById('split-ratio');
  const splitRatioValue = document.getElementById('split-ratio-value');
  const resetRatioBtn = document.getElementById('reset-ratio-btn');
  const panelOpenInput = document.getElementById('panel-open');
  const cacheCountEl = document.getElementById('cache-count');
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  const extensionVersionEl = document.getElementById('extension-version');
  const toast = document.getElementById('toast');
  const backBtn = document.getElementById('back-btn');

  // Load extension version from manifest
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
    extensionVersionEl.textContent = chrome.runtime.getManifest().version;
  }

  // Helper: Show toast notification
  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  };

  // Helper: Update split ratio text
  const updateRatioText = (val) => {
    const percentage = Math.round(parseFloat(val) * 100);
    splitRatioValue.textContent = `${percentage}%`;
  };

  // Load Settings from chrome.storage
  const loadSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings:split_ratio', 'settings:panel_open'], (res) => {
        // Load split ratio (default 0.5)
        const ratio = res['settings:split_ratio'] !== undefined ? res['settings:split_ratio'] : 0.5;
        splitRatioInput.value = ratio;
        updateRatioText(ratio);

        // Load default panel state (default true)
        const panelOpen =
          res['settings:panel_open'] !== undefined ? res['settings:panel_open'] : true;
        panelOpenInput.checked = panelOpen;
      });

      // Calculate cache stats
      calculateCacheStats();
    } else {
      // Mock data for local testing
      updateRatioText(0.5);
    }
  };

  // Save Settings to chrome.storage
  const saveSetting = (key, value, toastMessage) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [key]: value }, () => {
        if (toastMessage) {
          showToast(toastMessage);
        }
      });
    }
  };

  // Calculate Cache Stats
  const calculateCacheStats = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        const keys = Object.keys(items);
        // Saved codes starts with "code:"
        const codeKeys = keys.filter((key) => key.startsWith('code:'));
        cacheCountEl.textContent = `${codeKeys.length} 件`;
      });
    }
  };

  // Event Listeners
  // 0. Back button functionality
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    });
  }

  // 1. Split Ratio Slider
  splitRatioInput.addEventListener('input', (e) => {
    updateRatioText(e.target.value);
  });

  splitRatioInput.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    saveSetting('settings:split_ratio', val, '分割比率を保存しました');
  });

  // 2. Reset Split Ratio
  resetRatioBtn.addEventListener('click', () => {
    splitRatioInput.value = 0.5;
    updateRatioText(0.5);
    saveSetting('settings:split_ratio', 0.5, '分割比率をリセットしました');
  });

  // 3. Panel Open Default State
  panelOpenInput.addEventListener('change', (e) => {
    saveSetting('settings:panel_open', e.target.checked, 'サイドパネルの初期状態を更新しました');
  });

  // 4. Clear Cache Button
  clearCacheBtn.addEventListener('click', () => {
    if (
      confirm(
        '保存されているすべてのソースコード履歴を消去します。よろしいですか？\n(この操作は取り消せません)'
      )
    ) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(null, (items) => {
          const keys = Object.keys(items);
          const codeKeys = keys.filter((key) => key.startsWith('code:'));

          if (codeKeys.length === 0) {
            showToast('削除するキャッシュデータはありません');
            return;
          }

          chrome.storage.local.remove(codeKeys, () => {
            calculateCacheStats();
            showToast('キャッシュデータをすべて削除しました');
          });
        });
      }
    }
  });

  // Init
  loadSettings();
});
