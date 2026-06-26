(function () {
  'use strict';

  let editor = null;
  let contestId = null;
  let problemId = null;
  let currentLanguageId = null;

  let prevUrl = null;
  let nextUrl = null;
  let saveTimeout = null;

  // DOM Elements
  const langSelect = document.getElementById('language-select');
  const saveStatus = document.getElementById('save-status');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const testBtn = document.getElementById('test-btn');
  const submitBtn = document.getElementById('submit-btn');
  const consoleToggleBtn = document.getElementById('console-slider-btn');
  const testSummary = document.getElementById('test-summary');
  const consolePanel = document.getElementById('console-panel');
  const consoleResults = document.getElementById('console-results');
  const settingsBtn = document.getElementById('settings-btn');

  // Snippets Drawer Elements
  const snippetsBtn = document.getElementById('snippets-btn');
  const snippetsDrawer = document.getElementById('snippets-drawer');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const snippetSearch = document.getElementById('snippet-search');
  const snippetList = document.getElementById('snippet-list');
  const manageSnippetsBtn = document.getElementById('manage-snippets-btn');

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

  // Preset snippets database
  const PRESET_SNIPPETS = {
    cpp: [
      {
        title: 'Union-Find (Disjoint Set Union)',
        tags: ['dsu', 'tree', 'graph'],
        desc: '素集合データ構造。グループの併合と判定をほぼ定数時間で行います。',
        code: `struct UnionFind {
    vector<int> par, siz;
    UnionFind(int n) : par(n, -1), siz(n, 1) { }
    int root(int x) {
        if (par[x] == -1) return x;
        return par[x] = root(par[x]);
    }
    bool issame(int x, int y) {
        return root(x) == root(y);
    }
    bool unite(int x, int y) {
        int rx = root(x), ry = root(y);
        if (rx == ry) return false;
        if (siz[rx] < siz[ry]) swap(rx, ry);
        par[ry] = rx;
        siz[rx] += siz[ry];
        return true;
    }
    int size(int x) {
        return siz[root(x)];
    }
};`,
      },
      {
        title: 'Dijkstra (単一始点最短経路)',
        tags: ['graph', 'shortest-path'],
        desc: '負の辺がないグラフにおける単一始点最短経路アルゴリズム。O(E log V) で動作します。',
        code: `struct Edge {
    int to;
    long long cost;
};
using Graph = vector<vector<Edge>>;
const long long INF = 1LL << 60;

vector<long long> dijkstra(const Graph &G, int s) {
    vector<long long> dist(G.size(), INF);
    dist[s] = 0;
    using P = pair<long long, int>; // {cost, vertex}
    priority_queue<P, vector<P>, greater<P>> que;
    que.push({0, s});
    while (!que.empty()) {
        auto [d, v] = que.top();
        que.pop();
        if (dist[v] < d) continue;
        for (auto e : G[v]) {
            if (dist[e.to] > dist[v] + e.cost) {
                dist[e.to] = dist[v] + e.cost;
                que.push({dist[e.to], e.to});
            }
        }
    }
    return dist;
}`,
      },
      {
        title: '二分探索 (Binary Search)',
        tags: ['search', 'binary-search'],
        desc: '条件を満たす境界値を O(log N) で見つけます。',
        code: `auto solve_binary_search = [&](long long ok, long long ng) {
    auto is_ok = [&](long long mid) {
        // 条件を満たすかどうかを返す
        return \${1:true};
    };
    while (abs(ok - ng) > 1) {
        long long mid = (ok + ng) / 2;
        if (is_ok(mid)) ok = mid;
        else ng = mid;
    }
    return ok;
};`,
      },
    ],
    python: [
      {
        title: 'Union-Find (Disjoint Set Union)',
        tags: ['dsu', 'tree', 'graph'],
        desc: '素集合データ構造。グループの併合と判定をほぼ定数時間で行います。',
        code: `class UnionFind:
    def __init__(self, n):
        self.n = n
        self.parents = [-1] * n

    def find(self, x):
        if self.parents[x] < 0:
            return x
        else:
            self.parents[x] = self.find(self.parents[x])
            return self.parents[x]

    def union(self, x, y):
        x = self.find(x)
        y = self.find(y)
        if x == y:
            return False
        if self.parents[x] > self.parents[y]:
            x, y = y, x
        self.parents[x] += self.parents[y]
        self.parents[y] = x
        return True

    def size(self, x):
        return -self.parents[self.find(x)]

    def same(self, x, y):
        return self.find(x) == self.find(y)`,
      },
      {
        title: 'Dijkstra (単一始点最短経路)',
        tags: ['graph', 'shortest-path'],
        desc: '負の辺がないグラフにおける単一始点最短経路アルゴリズム。',
        code: `import heapq

def dijkstra(G, start):
    INF = float('inf')
    dist = [INF] * len(G)
    dist[start] = 0
    que = [(0, start)] # (cost, vertex)
    while que:
        d, v = heapq.heappop(que)
        if dist[v] < d:
            continue
        for to, cost in G[v]:
            if dist[to] > dist[v] + cost:
                dist[to] = dist[v] + cost
                heapq.heappush(que, (dist[to], to))
    return dist`,
      },
      {
        title: '二分探索 (Binary Search)',
        tags: ['search', 'binary-search'],
        desc: '条件を満たす境界値を O(log N) で見つけます。',
        code: `def solve_binary_search(ok, ng):
    def is_ok(mid):
        # 条件を満たすかどうかを返す
        return \${1:True}
    
    while abs(ok - ng) > 1:
        mid = (ok + ng) // 2
        if is_ok(mid):
            ok = mid
        else:
            ng = mid
    return ok`,
      },
    ],
    rust: [
      {
        title: 'Union-Find (Disjoint Set Union)',
        tags: ['dsu', 'tree', 'graph'],
        desc: '素集合データ構造。グループの併合と判定をほぼ定数時間で行います。',
        code: `struct UnionFind {
    parent: Vec<isize>,
}

impl UnionFind {
    fn new(n: usize) -> Self {
        UnionFind { parent: vec![-1; n] }
    }
    fn root(&mut self, x: usize) -> usize {
        if self.parent[x] < 0 {
            x
        } else {
            self.parent[x] = self.root(self.parent[x] as usize) as isize;
            self.parent[x] as usize
        }
    }
    fn issame(&mut self, x: usize, y: usize) -> bool {
        self.root(x) == self.root(y)
    }
    fn unite(&mut self, x: usize, y: usize) -> bool {
        let mut rx = self.root(x);
        let mut ry = self.root(y);
        if rx == ry {
            return false;
        }
        if self.parent[rx] > self.parent[ry] {
            std::mem::swap(&mut rx, &mut ry);
        }
        self.parent[rx] += self.parent[ry];
        self.parent[ry] = rx as isize;
        true
    }
    fn size(&mut self, x: usize) -> usize {
        let r = self.root(x);
        (-self.parent[r]) as usize
    }
}`,
      },
    ],
  };

  let isTesting = false;
  let isSubmitting = false;
  let isSubmitPhase1 = false;
  let resultsCount = 0;
  let acCount = 0;
  let totalCount = 0;
  let caseStatuses = [];

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setButtonsDisabled(disabled) {
    // Block navigation during Phase 1 submission or sample testing
    prevBtn.disabled = isSubmitPhase1 || isTesting ? true : !prevUrl;
    nextBtn.disabled = isSubmitPhase1 || isTesting ? true : !nextUrl;
    if (!currentLanguageId) {
      testBtn.disabled = true;
      submitBtn.disabled = true;
    } else {
      testBtn.disabled = disabled;
      submitBtn.disabled = disabled;
    }
    langSelect.disabled = disabled;
  }

  function toggleConsole(forceState) {
    const isVisible = consolePanel.style.display === 'flex';
    const nextState = forceState !== undefined ? forceState : !isVisible;

    if (nextState) {
      consolePanel.style.display = 'flex';
      consoleToggleBtn.textContent = '▼';
      consoleToggleBtn.classList.add('active');
    } else {
      consolePanel.style.display = 'none';
      consoleToggleBtn.textContent = '▲';
      consoleToggleBtn.classList.remove('active');
    }

    // Defer editor layout to let DOM updates reflect first
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
    }, 0);
  }

  // IndexedDB constants and helper functions
  const DB_NAME = 'AtCoderWorkspaceDB';
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject(e.target.error);
      request.onsuccess = (e) => resolve(e.target.result);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('submissions')) {
          db.createObjectStore('submissions', { keyPath: 'id' });
        }
      };
    });
  }

  function saveSubmissionToDB(submission) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['submission_history'], (res) => {
          let history = res.submission_history || [];
          // IDの重複があれば削除して最新のものに更新
          history = history.filter((item) => item.id !== submission.id);
          history.push(submission);
          // 履歴数が多すぎるとストレージ容量を圧迫するため最大100件に制限
          if (history.length > 100) {
            history.shift();
          }
          chrome.storage.local.set({ submission_history: history }, () => {
            resolve();
          });
        });
      }).catch((err) => {
        console.error('[AtCoder Workspace] Storage error:', err);
      });
    }

    return openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction('submissions', 'readwrite');
          const store = tx.objectStore('submissions');
          const request = store.put(submission);
          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e.target.error);
        });
      })
      .catch((err) => {
        console.error('[AtCoder Workspace] IndexedDB error:', err);
      });
  }

  /**
   * 過去の提出履歴を読み込む関数 (Phase 2 用)
   * @param {Function} callback - 取得した提出履歴配列を受け取るコールバック
   */
  // eslint-disable-next-line no-unused-vars
  function loadSubmissionsFromDB(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['submission_history'], (res) => {
        callback(res.submission_history || []);
      });
      return;
    }

    openDB()
      .then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction('submissions', 'readonly');
          const store = tx.objectStore('submissions');
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = (e) => reject(e.target.error);
        });
      })
      .then((list) => callback(list))
      .catch((err) => {
        console.error('[AtCoder Workspace] IndexedDB load error:', err);
        callback([]);
      });
  }

  // Web Audio API synthesized sounds
  function playChimeAC() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const noteDuration = 0.15; // 150ms per note
      const volume = 0.1;

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * noteDuration);

        gainNode.gain.setValueAtTime(0, ctx.currentTime + index * noteDuration);
        gainNode.gain.linearRampToValueAtTime(
          volume,
          ctx.currentTime + index * noteDuration + 0.02
        );
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + (index + 1.5) * noteDuration
        );

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime + index * noteDuration);
        osc.stop(ctx.currentTime + (index + 2) * noteDuration);
      });
    } catch (err) {
      console.error('Audio playback failed:', err);
    }
  }

  function playBeepWA() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const freq = 220.0; // A3
      const beepDuration = 0.15;
      const gap = 0.1;
      const volume = 0.15;

      [0, beepDuration + gap].forEach((startTimeOffset) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTimeOffset);

        gainNode.gain.setValueAtTime(0, ctx.currentTime + startTimeOffset);
        gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + startTimeOffset + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + startTimeOffset + beepDuration
        );

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(ctx.currentTime + startTimeOffset);
        osc.stop(ctx.currentTime + startTimeOffset + beepDuration);
      });
    } catch (err) {
      console.error('Audio playback failed:', err);
    }
  }

  testBtn.onclick = () => {
    if (isTesting || isSubmitting || !editor) return;
    saveCodeSync();

    // Open console drawer
    toggleConsole(true);
    consoleResults.innerHTML = '<div style="font-size: 12px; color: #777;">準備中...</div>';

    console.log('[AtCoder Workspace] Editor: Sending run-tests message to parent', {
      languageId: currentLanguageId,
      codeLength: editor.getValue().length,
    });

    window.parent.postMessage(
      {
        type: 'run-tests',
        code: editor.getValue(),
        languageId: currentLanguageId,
      },
      '*'
    );
  };

  submitBtn.onclick = () => {
    if (isTesting || isSubmitting || !editor) return;
    saveCodeSync();

    // Open console drawer
    toggleConsole(true);
    consoleResults.innerHTML = '<div style="font-size: 12px; color: #777;">提出準備中...</div>';

    console.log('[AtCoder Workspace] Editor: Sending submit-code message to parent', {
      languageId: currentLanguageId,
      codeLength: editor.getValue().length,
    });

    window.parent.postMessage(
      {
        type: 'submit-code',
        code: editor.getValue(),
        languageId: currentLanguageId,
      },
      '*'
    );
  };

  if (settingsBtn) {
    settingsBtn.onclick = () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        alert('設定画面は拡張機能として実行されている場合のみ利用可能です。');
      }
    };
  }

  consoleToggleBtn.onclick = () => {
    toggleConsole();
  };

  // Helper to map AtCoder language names to Monaco Editor language IDs
  function getLanguageMode(langText) {
    if (!langText) return 'plaintext';
    const lower = langText.toLowerCase();

    if (
      lower.includes('c++') ||
      lower.includes('gcc') ||
      lower.includes('clang++') ||
      lower.includes('g++')
    )
      return 'cpp';
    if (lower.includes('python') || lower.includes('pypy')) return 'python';
    if (lower.includes('rust')) return 'rust';
    if (lower.includes('java')) return 'java';
    if (lower.includes('go') || lower.includes('golang')) return 'go';
    if (lower.includes('haskell')) return 'haskell';
    if (lower.includes('javascript') || lower.includes('node') || lower.includes('js'))
      return 'javascript';
    if (lower.includes('typescript') || lower.includes('ts')) return 'typescript';
    if (lower.includes('ruby')) return 'ruby';
    if (lower.includes('c#') || lower.includes('mono')) return 'csharp';
    if (lower.includes('php')) return 'php';
    if (lower.includes('kotlin')) return 'kotlin';
    if (lower.includes('swift')) return 'swift';
    if (lower.includes('scala')) return 'scala';
    if (lower.includes('bash') || lower.includes('shell')) return 'shell';

    return 'plaintext';
  }

  // Notify parent content script that editor is ready
  window.parent.postMessage({ type: 'editor-ready' }, '*');

  // Listen for messages from parent content script
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;

    console.log('[AtCoder Workspace] Editor: Received message from parent', e.data.type, e.data);

    switch (e.data.type) {
      case 'init-config': {
        contestId = e.data.contestId;
        problemId = e.data.problemId;
        currentLanguageId = e.data.selectedLanguageId;
        prevUrl = e.data.prevUrl;
        nextUrl = e.data.nextUrl;

        // Configure Navigation Buttons
        updateNavigationButtons();

        // Populate Languages
        populateLanguageSelect(e.data.languages, e.data.selectedLanguageId);

        // Save the last selected language
        if (currentLanguageId && isContextValid()) {
          chrome.storage.local.set({ 'settings:last_selected_language': currentLanguageId });
        }

        // Check if user is logged in (languages list would be empty if not logged in)
        const loginWarning = document.getElementById('login-warning');
        const editorContainer = document.getElementById('editor-container');
        if (!e.data.languages || e.data.languages.length === 0) {
          if (loginWarning) {
            loginWarning.style.display = 'flex';
          }
          if (editorContainer) {
            editorContainer.style.display = 'none';
          }
          setButtonsDisabled(true);
          saveStatus.textContent = '未ログイン';
        } else {
          if (loginWarning) {
            loginWarning.style.display = 'none';
          }
          if (editorContainer) {
            editorContainer.style.display = 'block';
          }
          setButtonsDisabled(false);
          // Load Monaco Editor
          initMonaco(e.data.isDark);
          // Update language warning overlay state
          updateEditorLanguageState();
        }
        break;
      }

      case 'language-change':
        if (e.data.languageId && e.data.languageId !== currentLanguageId) {
          // Save code under the OLD language ID before switching
          saveCodeSync();
          currentLanguageId = e.data.languageId;
          langSelect.value = currentLanguageId;
          onLanguageChanged();

          // Save the last selected language
          if (currentLanguageId && isContextValid()) {
            chrome.storage.local.set({ 'settings:last_selected_language': currentLanguageId });
          }
        }
        break;

      case 'resize':
        if (editor) {
          editor.layout();
        }
        break;

      case 'toggle-console':
        toggleConsole();
        break;

      case 'submit-start':
        isSubmitting = true;
        isSubmitPhase1 = true;
        setButtonsDisabled(true);
        toggleConsole(true);

        testSummary.textContent = '提出中...';
        testSummary.className = 'summary-running';

        consoleResults.innerHTML =
          '<div style="font-size: 12px; color: #777;">提出処理を開始しました...</div>';
        break;

      case 'submit-captcha-waiting':
        testSummary.textContent = 'ボット認証の待機中...';
        testSummary.className = 'summary-running';

        consoleResults.innerHTML = `
          <div style="font-size: 12px; color: #333;">
            <div style="margin-bottom: 8px; color: #ff8c00; font-weight: bold;">⚠️ ${escapeHtml(e.data.message)}</div>
            <div style="line-height: 1.6;">
              ボット判定（Cloudflare Turnstile）の認証完了を待機しています。<br>
              画面の左下に表示されたチェックボックス（私は人間です）を手動でクリックして認証を完了させてください。<br>
              （認証完了後、自動的に提出処理が再開されます）
            </div>
          </div>
        `;
        break;

      case 'submit-status': {
        isSubmitPhase1 = false;
        setButtonsDisabled(true); // Re-enable navigation if available because Phase 1 is done

        const turnstileMap = {
          'force-rendered': '強制レンダリング起動',
          'auto-rendered': '自動レンダリング検出',
          token_already_present: '既存トークン再利用',
          no_container: '認証不要',
          implicit: '暗黙的ロード',
        };
        const turnstileText =
          turnstileMap[e.data.turnstileDebug] || e.data.turnstileDebug || '不明';

        // Update Console Results
        consoleResults.innerHTML = `
          <div style="font-size: 12px; color: #333;">
            <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-running">${escapeHtml(e.data.status)}</span></div>
            <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
            <div style="margin-bottom: 4px;">メモリ: ${escapeHtml(e.data.memory)}</div>
            <div style="margin-bottom: 8px; color: #888; font-size: 11px;">[Debug] Turnstile: ${escapeHtml(turnstileText)}</div>
            <div>
              <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
            </div>
          </div>
        `;
        consoleResults.scrollTop = consoleResults.scrollHeight;

        testSummary.textContent = `ジャッジ中... (${e.data.status})`;
        testSummary.className = 'summary-running';
        break;
      }

      case 'submit-complete': {
        isSubmitting = false;
        isSubmitPhase1 = false;
        setButtonsDisabled(false);

        const isAC = e.data.status === 'AC';
        if (isAC) {
          testSummary.textContent = `ジャッジ完了: ${e.data.status}`;
          testSummary.className = 'summary-ac';
          playChimeAC();
        } else {
          testSummary.textContent = `ジャッジ完了: ${e.data.status}`;
          testSummary.className = 'summary-wa';
          playBeepWA();
        }

        const turnstileMap = {
          'force-rendered': '強制レンダリング起動',
          'auto-rendered': '自動レンダリング検出',
          token_already_present: '既存トークン再利用',
          no_container: '認証不要',
          implicit: '暗黙的ロード',
        };
        const turnstileText =
          turnstileMap[e.data.turnstileDebug] || e.data.turnstileDebug || '不明';

        // Update Console Results
        const updateConsole = (celebrationHTML = '') => {
          consoleResults.innerHTML = `
            <div style="font-size: 12px; color: #333;">
              <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-${e.data.status.toLowerCase()}">${escapeHtml(e.data.status)}</span></div>
              <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
              <div style="margin-bottom: 4px;">メモリ: ${escapeHtml(e.data.memory)}</div>
              <div style="margin-bottom: 8px; color: #888; font-size: 11px;">[Debug] Turnstile: ${escapeHtml(turnstileText)}</div>
              <div>
                <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
              </div>
              ${celebrationHTML}
            </div>
          `;
          consoleResults.scrollTop = consoleResults.scrollHeight;
        };

        if (isAC) {
          handleACStats(contestId, problemId, (acCount) => {
            const celebrationHTML = generateACCelebrationHTML(
              contestId,
              problemId,
              e.data.isContestActive,
              acCount
            );
            updateConsole(celebrationHTML);
          });
        } else {
          updateConsole();
        }

        // Trigger Notification
        if (typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl:
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            title: `ジャッジ完了 (${problemId})`,
            message: `結果: ${e.data.status} | 実行時間: ${e.data.time} | メモリ: ${e.data.memory}`,
            priority: 1,
          });
        }

        // Save to IndexedDB
        if (editor) {
          saveSubmissionToDB({
            id: e.data.submissionId,
            contestId: contestId,
            problemId: problemId,
            languageId: currentLanguageId,
            code: editor.getValue(),
            status: e.data.status,
            time: e.data.time,
            memory: e.data.memory,
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'submit-error':
        isSubmitting = false;
        isSubmitPhase1 = false;
        setButtonsDisabled(false);

        testSummary.textContent = `エラー: ${e.data.message}`;
        testSummary.className = 'summary-wa';

        consoleResults.innerHTML = `
          <div class="case-error-block">
            <div class="case-io-label">エラー:</div>
            <pre class="case-error-content">${escapeHtml(e.data.message)}</pre>
          </div>
        `;
        consoleResults.scrollTop = consoleResults.scrollHeight;
        break;

      case 'pending-submit-status':
        if (e.data.problemId === problemId) {
          isSubmitting = true;
          isSubmitPhase1 = false;
          setButtonsDisabled(true);
          toggleConsole(true);

          testSummary.textContent = `ジャッジ中... (${e.data.status})`;
          testSummary.className = 'summary-running';

          consoleResults.innerHTML = `
            <div style="font-size: 12px; color: #333;">
              <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-running">${escapeHtml(e.data.status)}</span></div>
              <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
              <div style="margin-bottom: 8px;">メモリ: ${escapeHtml(e.data.memory)}</div>
              <div>
                <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
              </div>
            </div>
          `;
          consoleResults.scrollTop = consoleResults.scrollHeight;
        }
        break;

      case 'pending-submit-complete': {
        const isAC = e.data.status === 'AC';
        if (isAC) {
          playChimeAC();
        } else {
          playBeepWA();
        }

        // Trigger Notification
        if (typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl:
              'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            title: `ジャッジ完了 (${e.data.problemId})`,
            message: `結果: ${e.data.status} | 実行時間: ${e.data.time} | メモリ: ${e.data.memory}`,
            priority: 1,
          });
        }

        // Save to IndexedDB
        saveSubmissionToDB({
          id: e.data.submissionId,
          contestId: e.data.contestId,
          problemId: e.data.problemId,
          languageId: e.data.languageId,
          code: e.data.code,
          status: e.data.status,
          time: e.data.time,
          memory: e.data.memory,
          timestamp: Date.now(),
        });

        if (e.data.problemId === problemId) {
          isSubmitting = false;
          isSubmitPhase1 = false;
          setButtonsDisabled(false);

          testSummary.textContent = `ジャッジ完了: ${e.data.status}`;
          testSummary.className = isAC ? 'summary-ac' : 'summary-wa';

          const updateConsole = (celebrationHTML = '') => {
            consoleResults.innerHTML = `
              <div style="font-size: 12px; color: #333;">
                <div style="margin-bottom: 8px;">ステータス: <span class="case-status status-${e.data.status.toLowerCase()}">${escapeHtml(e.data.status)}</span></div>
                <div style="margin-bottom: 4px;">実行時間: ${escapeHtml(e.data.time)}</div>
                <div style="margin-bottom: 8px;">メモリ: ${escapeHtml(e.data.memory)}</div>
                <div>
                  <a href="https://atcoder.jp/contests/${contestId}/submissions/${e.data.submissionId}" target="_blank" style="color: #337ab7; text-decoration: underline;">提出詳細ページを開く (ID: ${e.data.submissionId})</a>
                </div>
                ${celebrationHTML}
              </div>
            `;
            consoleResults.scrollTop = consoleResults.scrollHeight;
          };

          if (isAC) {
            handleACStats(contestId, problemId, (acCount) => {
              const celebrationHTML = generateACCelebrationHTML(
                contestId,
                problemId,
                e.data.isContestActive,
                acCount
              );
              updateConsole(celebrationHTML);
            });
          } else {
            updateConsole();
          }
        }
        break;
      }

      case 'latest-submission-loaded': {
        const selectedOption = langSelect.options[langSelect.selectedIndex];
        const langText = selectedOption ? selectedOption.textContent : '';
        const mode = getLanguageMode(langText);

        if (e.data.mode === mode && editor) {
          const code = e.data.code;
          if (code) {
            // Apply the fetched submission code
            const oldModel = editor.getModel();
            const newModel = monaco.editor.createModel(code, mode);
            editor.setModel(newModel);
            if (oldModel) oldModel.dispose();
            saveCodeSync();
          } else {
            // No past submission found, save the template code (which is currently in the editor) to storage
            saveCodeSync();
          }
        }
        break;
      }

      case 'test-start':
        isTesting = true;
        setButtonsDisabled(true);
        toggleConsole(true);

        resultsCount = 0;
        acCount = 0;
        totalCount = e.data.total;
        caseStatuses = [];

        testSummary.textContent = `実行中... (0/${totalCount})`;
        testSummary.className = 'summary-running';

        consoleResults.innerHTML = '';
        consoleResults.scrollTop = 0; // Reset scroll to top
        for (let i = 0; i < totalCount; i++) {
          const row = document.createElement('div');
          row.className = 'case-row';
          row.id = `case-row-${i}`;
          row.innerHTML = `
            <div class="case-row-header">
              <span class="case-icon">▶</span>
              <span class="case-label">ケース ${i + 1}:</span>
              <span class="case-status status-running">実行中</span>
            </div>
            <div class="case-row-body" style="display: none;"></div>
          `;
          consoleResults.appendChild(row);
        }
        break;

      case 'test-case-result': {
        if (!isTesting) return;
        resultsCount++;

        const row = document.getElementById(`case-row-${e.data.index}`);
        if (row) {
          const status = e.data.status;
          caseStatuses[e.data.index] = status;
          if (status === 'AC') {
            acCount++;
          }

          const statusBadge = row.querySelector('.case-status');
          statusBadge.textContent = status;
          statusBadge.className = `case-status status-${status.toLowerCase()}`;

          // Add metadata (Time / Memory)
          let metaStr = '';
          if (e.data.time !== undefined) {
            const timeVal = typeof e.data.time === 'number' ? `${e.data.time} ms` : e.data.time;
            const memoryVal =
              typeof e.data.memory === 'number'
                ? `${Math.round(e.data.memory / 1024)} MB`
                : e.data.memory;
            metaStr = `<span class="case-meta">(${timeVal} / ${memoryVal})</span>`;
            row.querySelector('.case-row-header').insertAdjacentHTML('beforeend', metaStr);
          }

          const body = row.querySelector('.case-row-body');
          const icon = row.querySelector('.case-icon');
          let bodyHtml = '';
          if (status === 'AC' || status === 'WA') {
            body.style.display = status === 'AC' ? 'none' : 'block';
            icon.textContent = status === 'AC' ? '▶' : '▼';
            bodyHtml = `
              <div class="case-io-grid">
                <div class="case-io-block">
                  <div class="case-io-label">期待される出力:</div>
                  <pre class="case-io-content">${escapeHtml(e.data.expected)}</pre>
                </div>
                <div class="case-io-block">
                  <div class="case-io-label">実際の出力:</div>
                  <pre class="case-io-content">${escapeHtml(e.data.output)}</pre>
                </div>
              </div>
            `;
          } else if (status === 'RE' || status === 'ERR' || status === 'TLE' || status === 'MLE') {
            body.style.display = 'block';
            icon.textContent = '▼';
            const labelText =
              status === 'TLE'
                ? 'タイムアウト検出 (TLE):'
                : status === 'MLE'
                  ? 'メモリ制限超過 (MLE):'
                  : 'エラー詳細 (stderr):';
            const errMsg =
              e.data.stderr ||
              e.data.message ||
              (status === 'TLE'
                ? '実行制限時間（TLE）を超過しました。'
                : status === 'MLE'
                  ? 'メモリ制限（MLE）を超過しました。'
                  : 'エラーが発生しました。');
            bodyHtml = `
              <div class="case-error-block">
                <div class="case-io-label">${escapeHtml(labelText)}</div>
                <pre class="case-error-content">${escapeHtml(errMsg)}</pre>
              </div>
            `;
          }
          body.innerHTML = bodyHtml;

          // Add click listener on header to toggle body visibility & icon
          const header = row.querySelector('.case-row-header');
          header.onclick = () => {
            const isVisible = body.style.display === 'block';
            body.style.display = isVisible ? 'none' : 'block';
            icon.textContent = isVisible ? '▶' : '▼';
          };
        }

        testSummary.textContent = `実行中... (${resultsCount}/${totalCount})`;

        // Auto-scroll to the bottom of the console results
        consoleResults.scrollTop = consoleResults.scrollHeight;
        break;
      }

      case 'test-complete':
        isTesting = false;
        setButtonsDisabled(false);

        if (acCount === totalCount) {
          testSummary.textContent = `すべてAC (${acCount}/${totalCount})`;
          testSummary.className = 'summary-ac';
        } else {
          // Priority of statuses to display in the overall summary
          const uniqueNonAcStatuses = [...new Set(caseStatuses)].filter((s) => s !== 'AC');
          let displayStatus = 'WA';
          if (uniqueNonAcStatuses.includes('TLE')) {
            displayStatus = 'TLE';
          } else if (uniqueNonAcStatuses.includes('MLE')) {
            displayStatus = 'MLE';
          } else if (uniqueNonAcStatuses.includes('RE')) {
            displayStatus = 'RE';
          } else if (uniqueNonAcStatuses.includes('WA')) {
            displayStatus = 'WA';
          } else if (uniqueNonAcStatuses.includes('ERR')) {
            displayStatus = 'ERR';
          } else if (uniqueNonAcStatuses.length > 0) {
            displayStatus = uniqueNonAcStatuses[0];
          }

          testSummary.textContent = `${displayStatus}あり (${acCount}/${totalCount} AC)`;
          testSummary.className = 'summary-wa';
        }
        break;

      case 'test-error':
        isTesting = false;
        setButtonsDisabled(false);

        testSummary.textContent = `エラー: ${e.data.message}`;
        testSummary.className = 'summary-wa';

        consoleResults.innerHTML = `
          <div class="case-error-block">
            <div class="case-io-label">エラー:</div>
            <pre class="case-error-content">${escapeHtml(e.data.message)}</pre>
          </div>
        `;

        // Auto-scroll to the bottom of the console results
        consoleResults.scrollTop = consoleResults.scrollHeight;
        break;
    }
  });

  function updateNavigationButtons() {
    if (prevUrl) {
      prevBtn.disabled = isSubmitPhase1 || isTesting ? true : false;
      prevBtn.onclick = () => {
        if (isTesting) {
          if (
            !confirm('テスト実行中にページ遷移すると、テスト結果が失われます。本当に遷移しますか？')
          ) {
            return;
          }
        }
        saveCodeSync();
        window.parent.postMessage({ type: 'navigate', url: prevUrl }, '*');
      };
    } else {
      prevBtn.disabled = true;
    }

    if (nextUrl) {
      nextBtn.disabled = isSubmitPhase1 || isTesting ? true : false;
      nextBtn.onclick = () => {
        if (isTesting) {
          if (
            !confirm('テスト実行中にページ遷移すると、テスト結果が失われます。本当に遷移しますか？')
          ) {
            return;
          }
        }
        saveCodeSync();
        window.parent.postMessage({ type: 'navigate', url: nextUrl }, '*');
      };
    } else {
      nextBtn.disabled = true;
    }
  }

  function populateLanguageSelect(languages, selectedId) {
    langSelect.innerHTML = '';
    if (!languages || languages.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '言語情報なし';
      langSelect.appendChild(opt);
      return;
    }

    languages.forEach((lang) => {
      const opt = document.createElement('option');
      opt.value = lang.value;
      opt.textContent = lang.text;
      langSelect.appendChild(opt);
    });

    langSelect.value = selectedId || '';

    langSelect.onchange = () => {
      // Save code under the OLD language ID before switching
      saveCodeSync();
      currentLanguageId = langSelect.value;

      // Save the last selected language
      if (currentLanguageId && isContextValid()) {
        chrome.storage.local.set({ 'settings:last_selected_language': currentLanguageId });
      }

      // Notify parent AtCoder page
      window.parent.postMessage({ type: 'update-language', languageId: currentLanguageId }, '*');
      onLanguageChanged();
    };
  }

  function updateEditorLanguageState() {
    const loginWarning = document.getElementById('login-warning');
    const languageWarning = document.getElementById('language-warning');

    // If not logged in, hide language warning
    if (loginWarning && loginWarning.style.display === 'flex') {
      if (languageWarning) languageWarning.style.display = 'none';
      return;
    }

    if (!currentLanguageId) {
      if (languageWarning) {
        languageWarning.style.display = 'flex';
      }
      testBtn.disabled = true;
      submitBtn.disabled = true;
      if (editor) {
        editor.updateOptions({ readOnly: true });
      }
      saveStatus.textContent = '言語未選択';
    } else {
      if (languageWarning) {
        languageWarning.style.display = 'none';
      }
      if (!isTesting && !isSubmitting) {
        testBtn.disabled = false;
        submitBtn.disabled = false;
      }
      if (editor) {
        editor.updateOptions({ readOnly: false });
      }
    }
  }

  function initMonaco(isDark) {
    // Set theme class on body to prevent styling overrides
    document.body.className = isDark ? 'vs-dark-theme' : 'vs-theme';

    // Configure Monaco Loader
    require.config({ paths: { vs: '../../lib/monaco/vs' } });

    require(['vs/editor/editor.main'], () => {
      const selectedOption = langSelect.options[langSelect.selectedIndex];
      const langText = selectedOption ? selectedOption.textContent : '';
      const mode = getLanguageMode(langText);

      // Load initial code from storage (only if currentLanguageId is valid)
      const storageKey = currentLanguageId
        ? `code:${contestId}:${problemId}:${currentLanguageId}`
        : null;
      const getInitialCode = (callback) => {
        if (!storageKey) {
          callback('');
          return;
        }
        chrome.storage.local.get([storageKey], (res) => {
          callback(res[storageKey] || '');
        });
      };

      getInitialCode((initialCode) => {
        // Helper: Create Monaco Editor and initialize it
        const createEditorWithCode = (codeValue) => {
          editor = monaco.editor.create(document.getElementById('editor-container'), {
            value: codeValue,
            language: mode,
            theme: isDark ? 'vs-dark' : 'vs',
            readOnly: !currentLanguageId, // Read-only if no language selected
            automaticLayout: false, // We control it via message events

            // F-2 requirements: Disable AI & Intellisense / Auto-suggestions
            quickSuggestions: false,
            parameterHints: { enabled: false },
            suggestOnTriggerCharacters: false,
            snippetSuggestions: 'none',
            wordBasedSuggestions: false,
            minimap: { enabled: false }, // Keep interface clean

            // Coding assist features (still enabled)
            tabSize: 4,
            insertSpaces: true,
            autoIndent: 'brackets',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            formatOnType: true,
            formatOnPaste: true,
            fontSize: 14,
            lineHeight: 20,

            // Scrolling configuration
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            scrollBeyondLastLine: false,
            padding: {
              bottom: 100, // Adds a 100px padding (approx. 5 lines) at the bottom
            },
          });

          // Add Monaco shortcut key for toggling console (Ctrl+J)
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
            toggleConsole();
          });

          // Trigger layout asynchronously to ensure correct size on load
          setTimeout(() => {
            if (editor) editor.layout();
          }, 100);

          saveStatus.textContent = '保存済';

          // Set up change listener for Auto-Save (F-3)
          editor.onDidChangeModelContent(() => {
            saveStatus.textContent = '変更中...';
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
              saveCode();
            }, 1500);
          });
        };

        // Apply Template if empty
        if (!initialCode && currentLanguageId) {
          const templateKey = `settings:template:${mode}`;
          chrome.storage.local.get([templateKey], (tplRes) => {
            const templateCode =
              tplRes[templateKey] !== undefined
                ? tplRes[templateKey]
                : DEFAULT_TEMPLATES[mode] || '';
            createEditorWithCode(templateCode);
            // Request latest submission from AtCoder (instead of saving template immediately)
            window.parent.postMessage(
              {
                type: 'fetch-latest-submission',
                languageId: currentLanguageId,
                mode: mode,
              },
              '*'
            );
          });
        } else {
          createEditorWithCode(initialCode);
        }
      });
    });
  }

  /**
   * Records Accepted problems and tracks stats to trigger review prompt.
   * @param {string} contestId
   * @param {string} problemId
   * @param {function} callback
   */
  function handleACStats(contestId, problemId, callback) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      callback(0);
      return;
    }
    chrome.storage.local.get(['stats:ac_problems'], (res) => {
      const acProblems = res['stats:ac_problems'] || [];
      const problemKey = `${contestId}:${problemId}`;
      if (!acProblems.includes(problemKey)) {
        acProblems.push(problemKey);
        chrome.storage.local.set({ 'stats:ac_problems': acProblems }, () => {
          callback(acProblems.length);
        });
      } else {
        callback(acProblems.length);
      }
    });
  }

  /**
   * Generates celebration HTML with social sharing and review prompt.
   * @param {string} contestId
   * @param {string} problemId
   * @param {boolean} isContestActive
   * @param {number} acCount
   * @returns {string}
   */
  function generateACCelebrationHTML(contestId, problemId, isContestActive, acCount) {
    const tweetText = `AtCoderで AC しました！\n問題: ${contestId.toUpperCase()} - ${problemId.toUpperCase()}\n#AtCoderWorkspace #AtCoder\n`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent('https://chromewebstore.google.com/detail/atcoder-workspace/apoklhnhpoljcmnhcglejgjopfolhaeh?hl=ja')}`;
    const showReviewButton = acCount >= 5 && !isContestActive;
    const reviewUrl =
      'https://chromewebstore.google.com/detail/atcoder-workspace/apoklhnhpoljcmnhcglejgjopfolhaeh/reviews?hl=ja';

    return `
      <div class="ac-celebration-container">
        <div class="ac-action-buttons">
          <a href="${shareUrl}" target="_blank" class="ac-btn ac-btn-share-x" title="結果をX (Twitter) でシェア">
            <svg class="ac-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            結果をXでシェア
          </a>
          ${
            showReviewButton
              ? `
          <a href="${reviewUrl}" target="_blank" class="ac-btn ac-btn-review" title="Chrome Web Store で評価する">
             ストアで評価する
          </a>
          `
              : ''
          }
        </div>
      </div>
    `;
  }

  function onLanguageChanged() {
    if (!editor) return;

    const selectedOption = langSelect.options[langSelect.selectedIndex];
    const langText = selectedOption ? selectedOption.textContent : '';
    const mode = getLanguageMode(langText);

    // If no language selected, empty the editor, make readOnly, and return
    if (!currentLanguageId) {
      editor.setValue('');
      editor.updateOptions({ readOnly: true });
      updateEditorLanguageState();
      return;
    }

    // Helper: Set model with code value and bind listener
    const applyModelWithCode = (codeValue) => {
      const oldModel = editor.getModel();
      const newModel = monaco.editor.createModel(codeValue, mode);
      editor.setModel(newModel);
      if (oldModel) oldModel.dispose();

      // Trigger layout again to adapt size
      setTimeout(() => {
        if (editor) editor.layout();
      }, 50);

      saveStatus.textContent = '保存済';

      // Re-setup change listener for new model
      editor.onDidChangeModelContent(() => {
        saveStatus.textContent = '変更中...';
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          saveCode();
        }, 1500);
      });

      updateEditorLanguageState();

      // Update snippets list if drawer is open
      if (snippetsDrawer && snippetsDrawer.style.display !== 'none') {
        renderSnippets();
      }
    };

    // Load new code
    const storageKey = `code:${contestId}:${problemId}:${currentLanguageId}`;
    chrome.storage.local.get([storageKey], (res) => {
      const code = res[storageKey] || '';

      if (!code) {
        // Apply Template if empty
        const templateKey = `settings:template:${mode}`;
        chrome.storage.local.get([templateKey], (tplRes) => {
          const templateCode =
            tplRes[templateKey] !== undefined ? tplRes[templateKey] : DEFAULT_TEMPLATES[mode] || '';
          applyModelWithCode(templateCode);
          // Request latest submission from AtCoder (instead of saving template immediately)
          window.parent.postMessage(
            {
              type: 'fetch-latest-submission',
              languageId: currentLanguageId,
              mode: mode,
            },
            '*'
          );
        });
      } else {
        applyModelWithCode(code);
      }
    });
  }

  function isContextValid() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }

  function saveCode() {
    if (!isContextValid()) return;
    if (!editor || !contestId || !problemId || !currentLanguageId) return;
    const code = editor.getValue();
    const storageKey = `code:${contestId}:${problemId}:${currentLanguageId}`;

    chrome.storage.local.set({ [storageKey]: code }, () => {
      saveStatus.textContent = '保存済';
    });
  }

  function saveCodeSync() {
    if (!isContextValid()) return;
    if (!editor || !contestId || !problemId || !currentLanguageId) return;
    clearTimeout(saveTimeout);
    const code = editor.getValue();
    const storageKey = `code:${contestId}:${problemId}:${currentLanguageId}`;

    chrome.storage.local.set({ [storageKey]: code });
    saveStatus.textContent = '保存済';
  }

  // Handle auto-save on tab close / switch / visibility change
  window.addEventListener('beforeunload', saveCodeSync);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveCodeSync();
    }
  });

  // --- Snippets Drawer Logic ---

  function toggleDrawer(forceState) {
    if (!snippetsDrawer) return;
    const isVisible = snippetsDrawer.style.display !== 'none';
    const nextState = forceState !== undefined ? forceState : !isVisible;

    if (nextState) {
      snippetsDrawer.style.display = 'flex';
      if (snippetsBtn) snippetsBtn.classList.add('active');
      renderSnippets();
    } else {
      snippetsDrawer.style.display = 'none';
      if (snippetsBtn) snippetsBtn.classList.remove('active');
    }

    // Force editor layout refresh to adjust size to the drawer
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
    }, 0);
  }

  function insertSnippet(snippetText) {
    if (!editor) return;
    editor.focus();

    // Try using snippetController2 first for placeholder support
    const contribution = editor.getContribution('snippetController2');
    if (contribution && typeof contribution.insert === 'function') {
      contribution.insert(snippetText, 0, 0, false, false);
    } else {
      // Fallback to simple edit
      const selection = editor.getSelection();
      const range = new monaco.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn
      );
      const id = { major: 1, minor: 1 };
      const textEdit = { identifier: id, range: range, text: snippetText, forceMoveMarkers: true };
      editor.executeEdits('snippets-drawer', [textEdit]);
    }
  }

  function renderSnippets() {
    if (!snippetList) return;
    snippetList.innerHTML = '';

    if (!langSelect) return;
    const selectedOption = langSelect.options[langSelect.selectedIndex];
    const langText = selectedOption ? selectedOption.textContent : '';
    const mode = getLanguageMode(langText);

    // Get preset snippets
    const presets = PRESET_SNIPPETS[mode] || [];

    // Helper to draw snippets list
    const drawSnippets = (list) => {
      const query = snippetSearch ? snippetSearch.value.toLowerCase().trim() : '';

      const filtered = list.filter((item) => {
        if (!query) return true;
        const titleMatch = item.title.toLowerCase().includes(query);
        const descMatch = item.desc.toLowerCase().includes(query);
        const tagMatch = item.tags.some((tag) => tag.toLowerCase().includes(query));
        return titleMatch || descMatch || tagMatch;
      });

      if (filtered.length === 0) {
        snippetList.innerHTML = `<div style="text-align: center; color: #888; font-size: 11px; padding: 20px 0;">スニペットが見つかりません</div>`;
        return;
      }

      filtered.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'snippet-card';
        card.innerHTML = `
          <div class="snippet-card-header" data-index="${index}">
            <div class="snippet-header-left">
              <span>${escapeHtml(item.title)}</span>
              <div class="snippet-tags">
                ${item.isCustom ? '<span class="snippet-tag snippet-tag-custom">自作</span>' : ''}
                ${item.tags.map((t) => `<span class="snippet-tag">${escapeHtml(t)}</span>`).join('')}
              </div>
            </div>
            <span class="chevron">▼</span>
          </div>
          <div class="snippet-card-body" style="display: none;">
            <div class="snippet-desc">${escapeHtml(item.desc)}</div>
            <pre class="snippet-preview">${escapeHtml(item.code)}</pre>
            <div class="snippet-actions">
              <button class="btn-insert" data-index="${index}">挿入</button>
            </div>
          </div>
        `;

        const header = card.querySelector('.snippet-card-header');
        const body = card.querySelector('.snippet-card-body');
        const chevron = card.querySelector('.chevron');
        const insertBtn = card.querySelector('.btn-insert');

        header.onclick = () => {
          const isVisible = body.style.display !== 'none';
          body.style.display = isVisible ? 'none' : 'flex';
          chevron.textContent = isVisible ? '▼' : '▲';
        };

        insertBtn.onclick = (e) => {
          e.stopPropagation();
          insertSnippet(item.code);
        };

        snippetList.appendChild(card);
      });
    };

    // Load custom snippets and merge
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['settings:custom_snippets'], (res) => {
        const custom = res['settings:custom_snippets'] || [];
        const customFiltered = custom.filter((s) => s.lang === mode);

        const mergedList = [
          ...customFiltered.map((s) => ({ ...s, isCustom: true })),
          ...presets.map((s) => ({ ...s, isCustom: false })),
        ];
        drawSnippets(mergedList);
      });
    } else {
      // Mock / Offline fallback
      const mergedList = presets.map((s) => ({ ...s, isCustom: false }));
      drawSnippets(mergedList);
    }
  }

  // Setup Event Listeners for snippets drawer
  if (snippetsBtn) {
    snippetsBtn.onclick = () => toggleDrawer();
  }

  if (closeDrawerBtn) {
    closeDrawerBtn.onclick = () => toggleDrawer(false);
  }

  if (snippetSearch) {
    snippetSearch.oninput = () => renderSnippets();
  }

  if (manageSnippetsBtn) {
    manageSnippetsBtn.onclick = () => {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const url = chrome.runtime.getURL('src/options/options.html#custom-snippets-section');
        window.open(url);
      } else {
        alert('設定画面は拡張機能として実行されている場合のみ利用可能です。');
      }
    };
  }

  // Global keyboard shortcut for the editor iframe itself (Ctrl+J)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
      e.preventDefault();
      toggleConsole();
    }
  });
})();
