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

  // Template Settings Elements
  const templateLangSelect = document.getElementById('template-lang-select');
  const templateCodeArea = document.getElementById('template-code-area');
  const resetTemplateBtn = document.getElementById('reset-template-btn');
  const saveTemplateBtn = document.getElementById('save-template-btn');

  // Custom Snippets Elements
  const snippetsTableBody = document.getElementById('snippets-table-body');
  const noSnippetsMessage = document.getElementById('no-snippets-message');
  const addSnippetBtn = document.getElementById('add-snippet-btn');
  const snippetFormContainer = document.getElementById('snippet-form-container');
  const formTitle = document.getElementById('form-title');
  const snippetTitleInput = document.getElementById('snippet-title-input');
  const snippetLangSelect = document.getElementById('snippet-lang-select');
  const snippetDescInput = document.getElementById('snippet-desc-input');
  const snippetTagsInput = document.getElementById('snippet-tags-input');
  const snippetCodeInput = document.getElementById('snippet-code-input');
  const cancelSnippetBtn = document.getElementById('cancel-snippet-btn');
  const saveSnippetBtn = document.getElementById('save-snippet-btn');

  // State Variables
  let customSnippets = [];
  let editingSnippetId = null;

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

      // Load AC statistics
      chrome.storage.local.get(['stats:ac_problems'], (res) => {
        const acProblems = res['stats:ac_problems'] || [];
        const supportAcCountEl = document.getElementById('support-ac-count');
        if (supportAcCountEl) {
          supportAcCountEl.textContent = acProblems.length;
        }
      });

      // Calculate cache stats
      calculateCacheStats();
      // Load active language template
      loadActiveTemplate();
      // Load custom snippets
      loadCustomSnippets();
      // Check hash scroll redirect
      checkHashRedirect();
    } else {
      // Mock data for local testing
      updateRatioText(0.5);
      loadActiveTemplate();
      loadCustomSnippets();
      checkHashRedirect();
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

  // Default templates configuration
  const DEFAULT_TEMPLATES = {
    cpp: `#include <bits/stdc++.h>
using namespace std;
using ll = long long;
#define rep(i, n) for (int i = 0; i < (int)(n); i++)

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    
    return 0;
}`,
    python: `import sys

def main():
    input = sys.stdin.read
    # write code here
    pass

if __name__ == '__main__':
    main()`,
    rust: `use proconio::input;

fn main() {
    input! {
        // input variables
    }
}`,
    java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // write code here
    }
}`,
    go: `package main

import (
	"bufio"
	"fmt"
	"os"
)

func main() {
	reader := bufio.NewReader(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)
	defer writer.Flush()
	// write code here
}`,
  };

  // Load template code for selected language
  const loadActiveTemplate = () => {
    const lang = templateLangSelect.value;
    const key = `settings:template:${lang}`;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([key], (res) => {
        templateCodeArea.value = res[key] !== undefined ? res[key] : DEFAULT_TEMPLATES[lang] || '';
      });
    } else {
      templateCodeArea.value = DEFAULT_TEMPLATES[lang] || '';
    }
  };

  // Template Settings Event Listeners
  if (templateLangSelect) {
    templateLangSelect.addEventListener('change', loadActiveTemplate);
  }

  if (saveTemplateBtn) {
    saveTemplateBtn.addEventListener('click', () => {
      const lang = templateLangSelect.value;
      const key = `settings:template:${lang}`;
      const code = templateCodeArea.value;
      saveSetting(key, code, 'テンプレートを保存しました');
    });
  }

  if (resetTemplateBtn) {
    resetTemplateBtn.addEventListener('click', () => {
      const lang = templateLangSelect.value;
      templateCodeArea.value = DEFAULT_TEMPLATES[lang] || '';
      showToast('デフォルトをロードしました（保存ボタンを押すと確定します）');
    });
  }

  // --- Custom Snippets Logic ---

  // Load custom snippets from storage
  const loadCustomSnippets = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings:custom_snippets'], (res) => {
        customSnippets = res['settings:custom_snippets'] || [];
        renderCustomSnippets();
      });
    } else {
      // Mock data for local testing
      customSnippets = [
        {
          id: 'snippet_1',
          title: 'GCD (Greatest Common Divisor)',
          lang: 'cpp',
          desc: '最大公約数を求める再帰関数',
          tags: ['math'],
          code: 'long long gcd(long long a, long long b) {\n    return b ? gcd(b, a % b) : a;\n}',
        },
      ];
      renderCustomSnippets();
    }
  };

  // Render the custom snippets table list
  const renderCustomSnippets = () => {
    if (!snippetsTableBody) return;
    snippetsTableBody.innerHTML = '';

    if (customSnippets.length === 0) {
      noSnippetsMessage.style.display = 'block';
      snippetsTableBody.parentElement.style.display = 'none';
      return;
    }

    noSnippetsMessage.style.display = 'none';
    snippetsTableBody.parentElement.style.display = 'table';

    customSnippets.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight: 600;">${escapeHtml(item.title)}</td>
        <td><span class="badge" style="margin: 0; background-color: var(--secondary-color); color: var(--text-color);">${escapeHtml(item.lang.toUpperCase())}</span></td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${item.tags.map((t) => `<span style="font-size: 10px; background: var(--secondary-color); padding: 2px 6px; border-radius: 4px;">${escapeHtml(t)}</span>`).join('')}
          </div>
        </td>
        <td class="col-actions">
          <button class="btn btn-secondary btn-xs edit-btn" data-id="${item.id}" style="margin-right: 4px;">編集</button>
          <button class="btn btn-danger btn-xs delete-btn" data-id="${item.id}">削除</button>
        </td>
      `;

      // Event handlers
      row.querySelector('.edit-btn').addEventListener('click', () => {
        openSnippetForm(item.id);
      });
      row.querySelector('.delete-btn').addEventListener('click', () => {
        deleteSnippet(item.id);
      });

      snippetsTableBody.appendChild(row);
    });
  };

  // Toggle snippet form visibility
  const openSnippetForm = (id = null) => {
    editingSnippetId = id;
    if (id) {
      // Edit mode
      const item = customSnippets.find((s) => s.id === id);
      if (!item) return;
      formTitle.textContent = 'スニペットを編集';
      snippetTitleInput.value = item.title;
      snippetLangSelect.value = item.lang;
      snippetDescInput.value = item.desc;
      snippetTagsInput.value = item.tags.join(', ');
      snippetCodeInput.value = item.code;
    } else {
      // Add mode
      formTitle.textContent = '新規スニペット追加';
      snippetTitleInput.value = '';
      snippetLangSelect.value = 'cpp';
      snippetDescInput.value = '';
      snippetTagsInput.value = '';
      snippetCodeInput.value = '';
    }
    snippetFormContainer.style.display = 'flex';
    snippetFormContainer.scrollIntoView({ behavior: 'smooth' });
  };

  const closeSnippetForm = () => {
    snippetFormContainer.style.display = 'none';
    editingSnippetId = null;
  };

  // Save snippet (Add or Update)
  const saveSnippet = () => {
    const title = snippetTitleInput.value.trim();
    const lang = snippetLangSelect.value;
    const desc = snippetDescInput.value.trim();
    const tagsRaw = snippetTagsInput.value;
    const code = snippetCodeInput.value;

    if (!title || !code) {
      showToast('タイトルとソースコードは必須項目です');
      return;
    }

    const tags = tagsRaw
      ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

    if (editingSnippetId) {
      // Update
      const index = customSnippets.findIndex((s) => s.id === editingSnippetId);
      if (index !== -1) {
        customSnippets[index] = {
          ...customSnippets[index],
          title,
          lang,
          desc,
          tags,
          code,
        };
      }
    } else {
      // Add
      const newSnippet = {
        id: 'snippet_' + Date.now(),
        title,
        lang,
        desc,
        tags,
        code,
      };
      customSnippets.push(newSnippet);
    }

    // Save to storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 'settings:custom_snippets': customSnippets }, () => {
        showToast(editingSnippetId ? 'スニペットを更新しました' : 'スニペットを追加しました');
        closeSnippetForm();
        renderCustomSnippets();
      });
    } else {
      // Offline fallback
      showToast(
        editingSnippetId
          ? 'スニペットを更新しました（ローカルテスト）'
          : 'スニペットを追加しました（ローカルテスト）'
      );
      closeSnippetForm();
      renderCustomSnippets();
    }
  };

  // Delete snippet
  const deleteSnippet = (id) => {
    const item = customSnippets.find((s) => s.id === id);
    if (!item) return;

    if (confirm(`スニペット「${item.title}」を削除してもよろしいですか？`)) {
      customSnippets = customSnippets.filter((s) => s.id !== id);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ 'settings:custom_snippets': customSnippets }, () => {
          showToast('スニペットを削除しました');
          renderCustomSnippets();
        });
      } else {
        showToast('スニペットを削除しました（ローカルテスト）');
        renderCustomSnippets();
      }
    }
  };

  // Check hash redirect for scroll
  const checkHashRedirect = () => {
    if (window.location.hash === '#custom-snippets-section') {
      setTimeout(() => {
        const section = document.getElementById('custom-snippets-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  };

  // HTML Escape helper
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event Listeners for Custom Snippets
  if (addSnippetBtn) {
    addSnippetBtn.addEventListener('click', () => openSnippetForm());
  }

  if (cancelSnippetBtn) {
    cancelSnippetBtn.addEventListener('click', closeSnippetForm);
  }

  if (saveSnippetBtn) {
    saveSnippetBtn.addEventListener('click', saveSnippet);
  }

  // Init
  loadSettings();
});
