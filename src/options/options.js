/**
 * AtCoder Workspace - Options Page Logic
 * Manages extension configurations and storage management.
 */

'use strict';

/* global i18n */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const displayLanguageSelect = document.getElementById('display-language');
  const splitRatioInput = document.getElementById('split-ratio');
  const splitRatioValue = document.getElementById('split-ratio-value');
  const resetRatioBtn = document.getElementById('reset-ratio-btn');
  const panelOpenInput = document.getElementById('panel-open');
  const cacheCountEl = document.getElementById('cache-count');
  const clearCacheBtn = document.getElementById('clear-cache-btn');
  const cacheListBody = document.getElementById('cache-list-body');
  const importModeSelect = document.getElementById('import-mode-select');
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
  const importVSCodeBtn = document.getElementById('import-vscode-btn');
  const exportVSCodeBtn = document.getElementById('export-vscode-btn');
  const importVSCodeFile = document.getElementById('import-vscode-file');

  // State Variables
  let customSnippets = [];
  let editingSnippetId = null;

  // Initialize i18n
  const i18nProvider = new i18n.I18nProvider();
  await i18nProvider.init();

  // Function to apply translation
  const applyTranslations = () => {
    i18n.translatePage(i18nProvider);
    document.title = `${i18nProvider.t('settings_title')} - ${i18nProvider.t('settings_badge')}`;

    if (displayLanguageSelect) {
      displayLanguageSelect.value = i18nProvider.mode;
    }
  };

  applyTranslations();

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
        const ratio =
          res && res['settings:split_ratio'] !== undefined ? res['settings:split_ratio'] : 0.5;
        splitRatioInput.value = ratio;
        updateRatioText(ratio);

        // Load default panel state (default true)
        const panelOpen =
          res && res['settings:panel_open'] !== undefined ? res['settings:panel_open'] : true;
        panelOpenInput.checked = panelOpen;
      });

      // Load AC statistics
      chrome.storage.local.get(['stats:ac_problems'], (res) => {
        const acProblems = (res && res['stats:ac_problems']) || [];
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
        const keys = items ? Object.keys(items) : [];
        // Saved codes starts with "code:"
        const codeKeys = keys.filter((key) => key.startsWith('code:'));
        const countUnit = i18nProvider.locale === 'ja' ? ' 件' : ' items';
        cacheCountEl.textContent = `${codeKeys.length}${countUnit}`;

        // Render granular cache details
        if (cacheListBody) {
          cacheListBody.innerHTML = '';
          if (codeKeys.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
              <td colspan="2" style="text-align: center; color: #999; padding: 12px;">
                ${escapeHtml(i18nProvider.t('settings_storage_cache_empty') || '保存された履歴はありません。')}
              </td>
            `;
            cacheListBody.appendChild(emptyRow);
          } else {
            // Sort codeKeys for user convenience
            codeKeys.sort();
            codeKeys.forEach((key) => {
              // Parse display name (e.g. code:abc300:abc300_a -> abc300_a)
              const parts = key.split(':');
              const displayId = parts.length >= 3 ? parts[2] : parts.length >= 2 ? parts[1] : key;
              const formattedProblemId = displayId.toUpperCase();

              const row = document.createElement('tr');
              row.innerHTML = `
                <td style="font-family: monospace; font-weight: 600; padding: 8px 12px;">${escapeHtml(formattedProblemId)}</td>
                <td style="text-align: center; padding: 8px 12px;">
                  <button type="button" class="btn btn-danger btn-xs btn-delete-cache" data-key="${escapeHtml(key)}" style="padding: 2px 8px; font-size: 11px;">
                    ${escapeHtml(i18nProvider.t('settings_storage_cache_btn_delete') || '削除')}
                  </button>
                </td>
              `;

              const deleteBtn = row.querySelector('.btn-delete-cache');
              deleteBtn.addEventListener('click', () => {
                const targetKey = deleteBtn.getAttribute('data-key');
                const confirmText =
                  i18nProvider.locale === 'ja'
                    ? `${formattedProblemId} の保存コード履歴を削除しますか？`
                    : `Are you sure you want to delete the saved code for ${formattedProblemId}?`;
                if (confirm(confirmText)) {
                  chrome.storage.local.remove(targetKey, () => {
                    calculateCacheStats();
                    showToast(i18nProvider.t('settings_storage_cache_success') || '削除しました');
                  });
                }
              });

              cacheListBody.appendChild(row);
            });
          }
        }
      });
    } else {
      // Mock data for local testing
      const mockCodeKeys = ['code:abc300:abc300_a', 'code:abc300:abc300_b'];
      const countUnit = i18nProvider.locale === 'ja' ? ' 件' : ' items';
      cacheCountEl.textContent = `${mockCodeKeys.length}${countUnit}`;
      if (cacheListBody) {
        cacheListBody.innerHTML = '';
        mockCodeKeys.forEach((key) => {
          const parts = key.split(':');
          const displayId = parts.length >= 3 ? parts[2] : key;
          const formattedProblemId = displayId.toUpperCase();
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="font-family: monospace; font-weight: 600; padding: 8px 12px;">${escapeHtml(formattedProblemId)}</td>
            <td style="text-align: center; padding: 8px 12px;">
              <button type="button" class="btn btn-danger btn-xs btn-delete-cache" data-key="${escapeHtml(key)}" style="padding: 2px 8px; font-size: 11px;">
                ${escapeHtml(i18nProvider.t('settings_storage_cache_btn_delete') || '削除')}
              </button>
            </td>
          `;
          const deleteBtn = row.querySelector('.btn-delete-cache');
          deleteBtn.addEventListener('click', () => {
            showToast(`[Mock] Deleted ${formattedProblemId}`);
          });
          cacheListBody.appendChild(row);
        });
      }
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

  // Language selector
  if (displayLanguageSelect) {
    displayLanguageSelect.addEventListener('change', async (e) => {
      const mode = e.target.value;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await new Promise((resolve) => {
          chrome.storage.local.set({ 'settings:display_language': mode }, resolve);
        });
      }
      await i18nProvider.init();
      applyTranslations();
      renderCustomSnippets();
      calculateCacheStats();
      loadProblemStatuses();
    });
  }

  // 1. Split Ratio Slider
  splitRatioInput.addEventListener('input', (e) => {
    updateRatioText(e.target.value);
  });

  splitRatioInput.addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    saveSetting('settings:split_ratio', val, i18nProvider.t('settings_toast_ratioSaved'));
  });

  // 2. Reset Split Ratio
  resetRatioBtn.addEventListener('click', () => {
    splitRatioInput.value = 0.5;
    updateRatioText(0.5);
    saveSetting('settings:split_ratio', 0.5, i18nProvider.t('settings_toast_ratioReset'));
  });

  // 3. Panel Open Default State
  panelOpenInput.addEventListener('change', (e) => {
    saveSetting(
      'settings:panel_open',
      e.target.checked,
      i18nProvider.t('settings_toast_panelState')
    );
  });

  // 4. Clear Cache Button
  clearCacheBtn.addEventListener('click', () => {
    if (confirm(i18nProvider.t('settings_storage_cache_confirm'))) {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(null, (items) => {
          const keys = items ? Object.keys(items) : [];
          const codeKeys = keys.filter((key) => key.startsWith('code:'));

          if (codeKeys.length === 0) {
            showToast(i18nProvider.t('settings_storage_cache_empty'));
            return;
          }

          chrome.storage.local.remove(codeKeys, () => {
            calculateCacheStats();
            showToast(i18nProvider.t('settings_storage_cache_success'));
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
        templateCodeArea.value =
          res && res[key] !== undefined ? res[key] : DEFAULT_TEMPLATES[lang] || '';
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
      saveSetting(key, code, i18nProvider.t('settings_template_toast_saved'));
    });
  }

  if (resetTemplateBtn) {
    resetTemplateBtn.addEventListener('click', () => {
      const lang = templateLangSelect.value;
      templateCodeArea.value = DEFAULT_TEMPLATES[lang] || '';
      showToast(i18nProvider.t('settings_template_toast_reset'));
    });
  }

  // --- Custom Snippets Logic ---

  // Load custom snippets from storage
  const loadCustomSnippets = () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings:custom_snippets'], (res) => {
        customSnippets = (res && res['settings:custom_snippets']) || [];
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
          <button class="btn btn-secondary btn-xs edit-btn" data-id="${item.id}" style="margin-right: 4px;">${escapeHtml(i18nProvider.t('settings_snippets_table_edit'))}</button>
          <button class="btn btn-danger btn-xs delete-btn" data-id="${item.id}">${escapeHtml(i18nProvider.t('settings_snippets_table_delete'))}</button>
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
      formTitle.textContent = i18nProvider.t('settings_snippets_form_editTitle');
      snippetTitleInput.value = item.title;
      snippetLangSelect.value = item.lang;
      snippetDescInput.value = item.desc;
      snippetTagsInput.value = item.tags.join(', ');
      snippetCodeInput.value = item.code;
    } else {
      // Add mode
      formTitle.textContent = i18nProvider.t('settings_snippets_form_addTitle');
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
      showToast(i18nProvider.t('settings_snippets_form_toast_required'));
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
        showToast(
          editingSnippetId
            ? i18nProvider.t('settings_snippets_form_toast_updated')
            : i18nProvider.t('settings_snippets_form_toast_added')
        );
        closeSnippetForm();
        renderCustomSnippets();
      });
    } else {
      // Offline fallback
      showToast(
        editingSnippetId
          ? i18nProvider.t('settings_snippets_form_toast_updated')
          : i18nProvider.t('settings_snippets_form_toast_added')
      );
      closeSnippetForm();
      renderCustomSnippets();
    }
  };

  // Delete snippet
  const deleteSnippet = (id) => {
    const item = customSnippets.find((s) => s.id === id);
    if (!item) return;

    if (confirm(i18nProvider.t('settings_snippets_form_confirmDelete', [item.title]))) {
      customSnippets = customSnippets.filter((s) => s.id !== id);

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ 'settings:custom_snippets': customSnippets }, () => {
          showToast(i18nProvider.t('settings_snippets_form_toast_deleted'));
          renderCustomSnippets();
        });
      } else {
        showToast(i18nProvider.t('settings_snippets_form_toast_deleted'));
        renderCustomSnippets();
      }
    }
  };

  // Import VS Code snippets
  const importVSCodeSnippets = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedJson = JSON.parse(event.target.result);
        if (typeof importedJson !== 'object' || importedJson === null) {
          showToast(i18nProvider.t('settings_snippets_import_no_snippets'));
          return;
        }

        let targetLangDefault = 'cpp';
        const fileName = file.name.toLowerCase();
        if (fileName.includes('cpp') || fileName.includes('c++')) targetLangDefault = 'cpp';
        else if (fileName.includes('python') || fileName.includes('py')) targetLangDefault = 'python';
        else if (fileName.includes('rust') || fileName.includes('rs')) targetLangDefault = 'rust';
        else if (fileName.includes('java')) targetLangDefault = 'java';
        else if (fileName.includes('go')) targetLangDefault = 'go';

        let promptNeeded = true;
        const importedSnippets = [];

        for (const [key, value] of Object.entries(importedJson)) {
          if (!value || typeof value !== 'object') continue;

          const title = key;
          const code = Array.isArray(value.body) ? value.body.join('\n') : (value.body || '');
          const desc = value.description || '';
          const tags = value.prefix ? value.prefix.split(',').map(t => t.trim()).filter(Boolean) : [];

          // 言語の決定
          let snippetLangs = [];
          if (value.scope) {
            snippetLangs = value.scope.split(',')
              .map(s => s.trim().toLowerCase())
              .map(s => {
                if (s === 'c++') return 'cpp';
                if (s === 'py') return 'python';
                if (s === 'rs') return 'rust';
                if (['cpp', 'python', 'rust', 'java', 'go'].includes(s)) return s;
                return null;
              })
              .filter(Boolean);
          }

          if (snippetLangs.length === 0) {
            if (promptNeeded) {
              const promptMsg = i18nProvider.t('settings_snippets_import_lang_prompt');
              const userLang = prompt(promptMsg, targetLangDefault);
              if (userLang === null) return; // キャンセル
              const normalized = userLang.toLowerCase().trim();
              if (['cpp', 'python', 'rust', 'java', 'go'].includes(normalized)) {
                targetLangDefault = normalized;
              }
              promptNeeded = false;
            }
            snippetLangs = [targetLangDefault];
          }

          snippetLangs.forEach(lang => {
            importedSnippets.push({
              id: 'snippet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
              title,
              lang,
              desc,
              tags,
              code
            });
          });
        }

        if (importedSnippets.length === 0) {
          showToast(i18nProvider.t('settings_snippets_import_no_snippets'));
          return;
        }

        customSnippets = [...customSnippets, ...importedSnippets];

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ 'settings:custom_snippets': customSnippets }, () => {
            showToast(i18nProvider.t('settings_snippets_import_success', [importedSnippets.length]));
            renderCustomSnippets();
          });
        } else {
          showToast(i18nProvider.t('settings_snippets_import_success', [importedSnippets.length]));
          renderCustomSnippets();
        }
      } catch (err) {
        showToast(i18nProvider.t('settings_snippets_import_error'));
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // リセット
  };

  // Export snippets to VS Code format
  const exportVSCodeSnippets = () => {
    if (customSnippets.length === 0) {
      showToast(i18nProvider.t('settings_snippets_table_empty'));
      return;
    }

    const exportObj = {};
    customSnippets.forEach(item => {
      let keyName = item.title;
      if (exportObj[keyName]) {
        keyName = `${item.title} (${item.lang.toUpperCase()})`;
      }

      const scope = item.lang === 'cpp' ? 'cpp,c++' : item.lang;

      exportObj[keyName] = {
        scope: scope,
        prefix: item.tags.length > 0 ? item.tags.join(', ') : item.title.toLowerCase().replace(/\s+/g, '-'),
        body: item.code.split('\n'),
        description: item.desc
      };
    });

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atcoder-workspace-snippets.code-snippets';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(i18nProvider.t('settings_snippets_export_success'));
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

  // --- Problem Statuses Logic ---
  const statusTableBody = document.getElementById('status-table-body');
  const noStatusMessage = document.getElementById('no-status-message');
  const statusSearchInput = document.getElementById('status-search-input');
  const statusSearchBtn = document.getElementById('status-search-btn');
  const statusFilterSelect = document.getElementById('status-filter-select');

  // Memory cache for fetched contest problems
  let temporaryProblems = [];

  // Pagination states
  let currentPage = 1;
  const itemsPerPage = 10;
  let totalPages = 1;

  const btnPrevPage = document.getElementById('btn-prev-page');
  const btnNextPage = document.getElementById('btn-next-page');
  const pageInfo = document.getElementById('page-info');
  const statusPagination = document.getElementById('status-pagination');

  const loadProblemStatuses = () => {
    if (!statusTableBody) return;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(null, (items) => {
        const data = items || {};
        const acProblems = data['stats:ac_problems'] || [];

        // Extract all problems that have manually configured status keys
        const configuredProblems = [];
        Object.keys(data).forEach((key) => {
          if (key.startsWith('status:')) {
            const parts = key.split(':');
            if (parts.length === 3) {
              configuredProblems.push(`${parts[1]}:${parts[2]}`);
            }
          }
        });

        // Merge AC problems, configured problems, and memory temporary problems
        const allProblems = Array.from(
          new Set([...acProblems, ...configuredProblems, ...temporaryProblems])
        );
        renderProblemStatuses(allProblems, data);
      });
    } else {
      // Mock data for local testing
      const mockAc = ['abc300:abc300_a', 'abc300:abc300_b', 'abc301:abc301_a'];
      const mockStatuses = {
        'stats:ac_problems': mockAc,
        'status:abc300:abc300_a': 'self_ac',
        'status:abc300:abc300_b': 'editorial_ac',
      };
      const allProblems = Array.from(
        new Set([...mockAc, 'abc300:abc300_a', 'abc300:abc300_b', ...temporaryProblems])
      );
      renderProblemStatuses(allProblems, mockStatuses);
    }
  };

  const renderProblemStatuses = (allProblems, statuses) => {
    if (!statusTableBody) return;

    const query = statusSearchInput ? statusSearchInput.value.trim().toLowerCase() : '';
    const filter = statusFilterSelect ? statusFilterSelect.value : 'all';
    let filteredProblems = [...allProblems];

    // Apply normalized filter query (ignores spaces and underscores for smooth "abc 300 a" match on abc300_a)
    if (query) {
      filteredProblems = filteredProblems.filter((p) => {
        const cleanP = p.toLowerCase().replace(/[\s_]/g, '');
        const cleanQuery = query.toLowerCase().replace(/[\s_]/g, '');
        return cleanP.includes(cleanQuery);
      });
    }

    // Resolve statuses map for filtering
    const problemStatusesMap = {};
    filteredProblems.forEach((problemKey) => {
      const parts = problemKey.split(':');
      if (parts.length < 2) return;
      const contestId = parts[0];
      const problemId = parts[1];
      const statusKey = `status:${contestId}:${problemId}`;
      let currentStatus = 'unsolved';
      if (statuses[statusKey]) {
        currentStatus = statuses[statusKey];
      } else {
        const acProblems = statuses['stats:ac_problems'] || [];
        if (acProblems.includes(problemKey)) {
          currentStatus = 'self_ac';
        }
      }
      problemStatusesMap[problemKey] = currentStatus;
    });

    if (filter !== 'all') {
      filteredProblems = filteredProblems.filter((p) => {
        return problemStatusesMap[p] === filter;
      });
    }

    if (filteredProblems.length === 0) {
      noStatusMessage.style.display = 'block';
      statusTableBody.parentElement.style.display = 'none';
      if (statusPagination) statusPagination.style.display = 'none';
      return;
    }

    statusTableBody.innerHTML = '';
    noStatusMessage.style.display = 'none';
    statusTableBody.parentElement.style.display = 'table';

    // Recalculate pagination
    totalPages = Math.ceil(filteredProblems.length / itemsPerPage) || 1;
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }

    // Toggle pagination UI visibility
    if (statusPagination) {
      statusPagination.style.display = totalPages > 1 ? 'flex' : 'none';
      if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;
      if (btnPrevPage) btnPrevPage.disabled = currentPage === 1;
      if (btnNextPage) btnNextPage.disabled = currentPage === totalPages;
    }

    // Sort and slice current page items
    filteredProblems.sort();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const pageProblems = filteredProblems.slice(startIndex, startIndex + itemsPerPage);

    pageProblems.forEach((problemKey) => {
      const parts = problemKey.split(':');
      if (parts.length < 2) return;
      const contestId = parts[0];
      const problemId = parts[1];

      const statusKey = `status:${contestId}:${problemId}`;

      // Resolve status:
      // 1. Explicitly saved status key
      // 2. 'self_ac' if solved (present in stats:ac_problems) but no key saved
      // 3. 'unsolved' if not solved and no key saved
      let currentStatus = 'unsolved';
      if (statuses[statusKey]) {
        currentStatus = statuses[statusKey];
      } else {
        const acProblems = statuses['stats:ac_problems'] || [];
        if (acProblems.includes(problemKey)) {
          currentStatus = 'self_ac';
        }
      }

      const formattedProblem = problemId.toUpperCase().replace(contestId.toUpperCase() + '_', '');
      const formattedContest = contestId.toUpperCase();
      const contestUrl = `https://atcoder.jp/contests/${contestId}`;
      const problemUrl = `https://atcoder.jp/contests/${contestId}/tasks/${problemId}`;

      const row = document.createElement('tr');

      let dotClass = 'dot-unsolved';
      if (currentStatus === 'self_ac') dotClass = 'dot-self';
      if (currentStatus === 'editorial_ac') dotClass = 'dot-editorial';

      row.innerHTML = `
        <td style="font-weight: 600;"><a href="${contestUrl}" target="_blank" class="status-table-link">${escapeHtml(formattedContest)}</a></td>
        <td><a href="${problemUrl}" target="_blank" class="status-table-link">${escapeHtml(formattedProblem)}</a></td>
        <td class="status-select-cell">
          <div style="display: flex; align-items: center;">
            <span class="status-badge-dot ${dotClass}" id="dot-${problemKey.replace(':', '-')}"></span>
            <select class="form-control status-select" data-contest="${escapeHtml(contestId)}" data-problem="${escapeHtml(problemId)}" data-key="${escapeHtml(problemKey)}">
              <option value="unsolved" ${currentStatus === 'unsolved' ? 'selected' : ''}>${escapeHtml(i18nProvider.t('options_status_option_unsolved'))}</option>
              <option value="self_ac" ${currentStatus === 'self_ac' ? 'selected' : ''}>${escapeHtml(i18nProvider.t('options_status_option_self'))}</option>
              <option value="editorial_ac" ${currentStatus === 'editorial_ac' ? 'selected' : ''}>${escapeHtml(i18nProvider.t('options_status_option_editorial'))}</option>
            </select>
          </div>
        </td>
      `;

      const select = row.querySelector('.status-select');
      select.addEventListener('change', (e) => {
        const newStatus = e.target.value;
        const cId = e.target.getAttribute('data-contest');
        const pId = e.target.getAttribute('data-problem');
        const pKey = e.target.getAttribute('data-key');
        const targetStatusKey = `status:${cId}:${pId}`;

        if (newStatus === 'unsolved') {
          // Remove status key for unsolved state to save storage
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(targetStatusKey, () => {
              showToast(i18nProvider.t('options_status_toast_saved'));
              // Update badge dot color
              const dot = document.getElementById(`dot-${pKey.replace(':', '-')}`);
              if (dot) {
                dot.className = 'status-badge-dot dot-unsolved';
              }
            });
          } else {
            showToast(i18nProvider.t('options_status_toast_saved'));
            const dot = document.getElementById(`dot-${pKey.replace(':', '-')}`);
            if (dot) {
              dot.className = 'status-badge-dot dot-unsolved';
            }
          }
        } else {
          saveSetting(targetStatusKey, newStatus, i18nProvider.t('options_status_toast_saved'));

          // Update badge dot color
          const dot = document.getElementById(`dot-${pKey.replace(':', '-')}`);
          if (dot) {
            dot.className = 'status-badge-dot';
            if (newStatus === 'self_ac') dot.classList.add('dot-self');
            if (newStatus === 'editorial_ac') dot.classList.add('dot-editorial');
          }
        }
      });

      statusTableBody.appendChild(row);
    });
  };

  const triggerContestSearch = () => {
    const rawQuery = statusSearchInput ? statusSearchInput.value.trim().toLowerCase() : '';
    if (!rawQuery) {
      temporaryProblems = [];
      loadProblemStatuses();
      return;
    }

    // Strip all spaces for contest ID extraction and fetch matching
    const query = rawQuery.replace(/\s/g, '');

    // Extract contestId in case user typed problem ID like "abc300a" or "typical90a"
    let contestId = query;
    const abcMatch = query.match(/^(abc[0-9]{3}|arc[0-9]{3}|agc[0-9]{3}|ahc[0-9]{3})([a-h]|ex)$/);
    if (abcMatch) {
      contestId = abcMatch[1];
    } else {
      const generalMatch = query.match(/^([a-z0-9_-]{3,})([a-h])$/);
      // Avoid splitting year numbers like keyence2020
      if (generalMatch && !generalMatch[1].match(/^[a-z0-9-]+20[1-2]$/)) {
        contestId = generalMatch[1];
      }
    }

    // Only attempt live fetch if contestId matches standard contest ID pattern
    if (contestId.match(/^[a-z0-9_-]{3,}$/)) {
      // Check if we already have some loaded temporary problems for this contestId to avoid double fetching
      const alreadyHas = temporaryProblems.some((p) => p.startsWith(`${contestId}:`));
      if (alreadyHas) {
        loadProblemStatuses();
        return;
      }

      showToast(
        typeof chrome !== 'undefined' && chrome.i18n
          ? chrome.i18n.getMessage('editor_loading') || 'Loading...'
          : 'Loading...',
        2000
      );

      const url = `https://atcoder.jp/contests/${contestId}/tasks`;
      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Contest tasks page not found');
          }
          return response.text();
        })
        .then((html) => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const links = doc.querySelectorAll('table tbody tr td:first-child a');
          const fetchedKeys = [];

          links.forEach((link) => {
            const href = link.getAttribute('href');
            if (!href) return;
            const match = href.match(
              new RegExp(`^\\/contests\\/${contestId}\\/tasks\\/([^/?#]+)$`)
            );
            if (match) {
              const problemId = match[1];
              fetchedKeys.push(`${contestId}:${problemId}`);
            }
          });

          if (fetchedKeys.length > 0) {
            // Merge into memory temporaryProblems
            fetchedKeys.forEach((key) => {
              if (!temporaryProblems.includes(key)) {
                temporaryProblems.push(key);
              }
            });
            loadProblemStatuses();
          }
        })
        .catch((err) => {
          console.error('[AtCoder Workspace] Auto-fetch error:', err);
          const errMsg =
            typeof chrome !== 'undefined' && chrome.i18n
              ? chrome.i18n.getMessage('options_status_fetch_error') ||
                'Contest not found or fetch failed'
              : 'Contest not found or fetch failed';
          showToast(errMsg, 3000);
          loadProblemStatuses();
        });
    } else {
      loadProblemStatuses();
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

  if (importVSCodeBtn && importVSCodeFile) {
    importVSCodeBtn.addEventListener('click', () => {
      importVSCodeFile.click();
    });
    importVSCodeFile.addEventListener('change', importVSCodeSnippets);
  }

  if (exportVSCodeBtn) {
    exportVSCodeBtn.addEventListener('click', exportVSCodeSnippets);
  }

  if (statusSearchInput) {
    statusSearchInput.addEventListener('input', () => {
      // Reset to page 1 on input
      currentPage = 1;
      // If cleared, reset temporary memory
      if (!statusSearchInput.value.trim()) {
        temporaryProblems = [];
      }
      loadProblemStatuses();
    });

    statusSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Reset to page 1 on new search trigger
        currentPage = 1;
        triggerContestSearch();
      }
    });
  }

  if (statusSearchBtn) {
    statusSearchBtn.addEventListener('click', () => {
      // Reset to page 1 on new search trigger
      currentPage = 1;
      triggerContestSearch();
    });
  }

  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', () => {
      currentPage = 1;
      loadProblemStatuses();
    });
  }

  // Pagination click handlers
  if (btnPrevPage) {
    btnPrevPage.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadProblemStatuses();
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        loadProblemStatuses();
      }
    });
  }

  // Backup and Restore handlers
  const btnExportBackup = document.getElementById('btn-export-backup');
  const btnImportBackup = document.getElementById('btn-import-backup');
  const importFileInput = document.getElementById('import-file-input');

  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(null, (data) => {
          const jsonString = JSON.stringify(data || {}, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);

          const date = new Date();
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          const filename = `atcoder-workspace-backup-${yyyy}${mm}${dd}.json`;

          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToast(i18nProvider.t('options_backup_toast_exported'));
        });
      }
    });
  }

  if (btnImportBackup && importFileInput) {
    btnImportBackup.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsedData = JSON.parse(event.target.result);

          if (typeof parsedData !== 'object' || parsedData === null || Array.isArray(parsedData)) {
            throw new Error('Invalid JSON format');
          }

          const importMode = importModeSelect ? importModeSelect.value : 'merge';
          const confirmMsg =
            importMode === 'overwrite'
              ? i18nProvider.t('options_backup_confirm_import') ||
                'Are you sure you want to restore? Current settings, snippets, and problem statuses will be overwritten.'
              : i18nProvider.t('options_backup_confirm_merge') ||
                'Are you sure you want to restore by merging the backup into your current data?';
          if (confirm(confirmMsg)) {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              if (importMode === 'overwrite') {
                chrome.storage.local.clear(() => {
                  chrome.storage.local.set(parsedData, () => {
                    showToast(i18nProvider.t('options_backup_toast_imported'));
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                  });
                });
              } else {
                // Merge mode: set data directly without clearing current storage
                chrome.storage.local.set(parsedData, () => {
                  showToast(i18nProvider.t('options_backup_toast_imported'));
                  setTimeout(() => {
                    window.location.reload();
                  }, 1000);
                });
              }
            } else {
              showToast(i18nProvider.t('options_backup_toast_imported'));
            }
          }
        } catch (err) {
          console.error('[AtCoder Workspace] Backup import error:', err);
          const errorMsg =
            i18nProvider.t('options_backup_error_invalid') || 'Error: Invalid backup file';
          showToast(errorMsg, 4000);
        }
        importFileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  // Init
  loadSettings();
  loadProblemStatuses();
});
