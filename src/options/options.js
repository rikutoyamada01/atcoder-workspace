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

        // Merge them and remove duplicates
        const allProblems = Array.from(new Set([...acProblems, ...configuredProblems]));
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
      const allProblems = Array.from(new Set([...mockAc, 'abc300:abc300_a', 'abc300:abc300_b']));
      renderProblemStatuses(allProblems, mockStatuses);
    }
  };

  const renderProblemStatuses = (allProblems, statuses) => {
    if (!statusTableBody) return;

    const query = statusSearchInput ? statusSearchInput.value.trim().toLowerCase() : '';
    let filteredProblems = [...allProblems];

    // If query is an alphanumeric string of at least 3 chars (e.g., "abc300"),
    // dynamically generate unsolved problems (A-H) for it to allow pre-configuration.
    if (query.match(/^[a-z0-9_-]{3,}$/)) {
      const suffix = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      suffix.forEach((s) => {
        const tempKey = `${query}:${query}_${s}`;
        if (!filteredProblems.includes(tempKey)) {
          filteredProblems.push(tempKey);
        }
      });
    }

    // Apply filter query
    if (query) {
      filteredProblems = filteredProblems.filter((p) => p.toLowerCase().includes(query));
    }

    if (filteredProblems.length === 0) {
      noStatusMessage.style.display = 'block';
      statusTableBody.parentElement.style.display = 'none';
      return;
    }

    statusTableBody.innerHTML = '';
    noStatusMessage.style.display = 'none';
    statusTableBody.parentElement.style.display = 'table';

    // Sort by contest ID, then problem ID
    filteredProblems.sort();

    filteredProblems.forEach((problemKey) => {
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

      const row = document.createElement('tr');

      let dotClass = 'dot-unsolved';
      if (currentStatus === 'self_ac') dotClass = 'dot-self';
      if (currentStatus === 'editorial_ac') dotClass = 'dot-editorial';

      row.innerHTML = `
        <td style="font-weight: 600;">${escapeHtml(formattedContest)}</td>
        <td>${escapeHtml(formattedProblem)}</td>
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

  if (statusSearchInput) {
    statusSearchInput.addEventListener('input', () => {
      loadProblemStatuses();
    });
  }

  // Init
  loadSettings();
  loadProblemStatuses();
});
