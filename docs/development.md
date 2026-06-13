# 開発者ガイド ＆ 技術仕様

リポジトリの開発環境構築、技術スタック、およびロードマップ更新スクリプトの使用方法についての開発者向けドキュメントです。

---

## 技術スタック

* **コア**: HTML5, JavaScript (ES6)
* **スタイル**: CSS3
* **エディタ**: Monaco Editor (非同期ロード対応)
* **データ保存**: Chrome Extension Storage API (chrome.storage.local)

---

## 開発環境の構築（Chromeへの読み込み）

1. 本リポジトリをクローンします。
   ```bash
   git clone https://github.com/rikutoyamada01/atcoder-workspace.git
   cd atcoder-workspace
   ```
2. Google Chromeで `chrome://extensions/` を開きます。
3. 右上の「デベロッパー モード」を有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、本リポジトリのルートディレクトリを選択します。

---

## ロードマップの進捗更新（手動スクリプト）

実装の完了や設計変更に伴うロードマップ（[roadmap.html](../roadmap.html)）の進捗更新は、CLIスクリプトを介して手動で安全に行います。

機能の実装が完了（または未完了にロールバック）した際に、以下のコマンドを実行します。

```bash
# Monacoエディタ機能の進捗ステータスを切り替える場合
node scripts/toggle-feature.js monaco
```

* **指定可能な機能ID一覧**:
  `monaco`, `template`, `test`, `notes`, `submit`, `dashboard`, `library`, `error`, `export`, `queue`, `safety`, `autopush`
* **スクリプトの動作仕様**:
  - 指定した機能IDが「未実装」の場合 ➔ **「実装済」**に切り替わります（HTMLの表示ロックが解除され、獲得スコアやAtCoderレーティングカラーが自動計算されます）。
  - 指定した機能IDがすでに「実装済」の場合 ➔ **「未実装（ロック状態）」**にロールバックされます。

---

## 💡 推奨される機能開発ワークフロー

1. **機能実装 ＆ テスト**: 対象機能のコーディングと検証を終えます。
2. **ロードマップ更新**: ローカル環境で `node scripts/toggle-feature.js [機能ID]` を実行し、`roadmap.html` を更新します。
3. **まとめてコミット**: 機能の実装コードと、更新された `roadmap.html` を同じコミットに含めて、Git にコミット ＆ プッシュします。

---

## 🛠️ AtCoder コードテスト (Custom Test) API 仕様

自動テスト機能を安全かつ堅牢に稼働させるための、AtCoder 内部コードテスト API の仕様情報です。

### 1. コードテスト実行の登録 (POST)
* **エンドポイント**: `/contests/{contestId}/custom_test/submit/json`
* **パラメータ (Form Data)**:
  - `csrf_token`: セッション内の有効な CSRF トークン
  - `sourceCode`: 実行するソースコード文字列
  - `data.LanguageId`: プログラミング言語の識別数値ID
  - `input`: プログラムへの標準入力 (stdin) 文字列
* **レスポンス**:
  - 成功時: ステータス `200 OK`、ボディは空 (0バイト)
  - 競合時（実行中の別プロセスがある場合等）: `前回のカスタムテストの実行が終了していません。` というプレーンテキストが返却されます。

### 2. 実行結果・進捗取得 (GET)
* **エンドポイント**: `/contests/{contestId}/custom_test/json?_={timestamp}`
* **レスポンス JSON の構造**:
  ```json
  {
    "Result": {
      "Id": 12345678,
      "SourceCode": "...", // Base64 エンコードされたソースコード
      "Input": "...",      // Base64 エンコードされた入力値
      "Output": "...",     // Base64 エンコードされた出力値 (Status 3 のみ)
      "Error": "",         // Base64 エンコードされた stderr (Status 3 のみ)
      "TimeConsumption": "1 ms",      // 実行時間 (文字列、例: "1 ms")
      "MemoryConsumption": "3608 KiB", // メモリ使用量 (文字列、例: "3608 KiB")
      "ExitCode": 0,       // 終了コード (数値)
      "Status": 3          // 実行状態ステータス (数値)
    },
    "Stderr": "",  // プレーンテキストの標準エラー出力
    "Stdout": "5\n" // プレーンテキストの標準出力
  }
  ```

### 3. ステータスコードの意味と遷移
`Result.Status` の値によって、テストの実行ステージが管理されます。
* **`0`**: 待機中 (Queued)
* **`1`**: コンパイル中 (Compiling)
* **`2`**: 実行中 (Running / Executing)
* **`3`**: 完了 (Completed)

> [!IMPORTANT]
> **ポーリング完了判定の注意点**:
> - `Status` が `0`, `1`, `2` の状態はまだ実行中です。この時に結果取得を終了（resolve）してしまうと、空の出力を取得してしまい `WA` になる原因になります。必ず `status === 3`（またはその他の完了状態）になるまでポーリングを継続してください。
> - プログラムが実行中（`Status` が `0`, `1`, `2`）の時に新しいカスタムテストを POST すると、サーバーから `LockError`（競合エラー）が返されます。連続してテストケースを実行する場合は、前の実行状態が確実に `3` になったことを確認してから次のケースを送信してください。

---

## 📤 AtCoder コード提出 (Submit) API 仕様

エディタからのコード提出機能を実装するための、AtCoder 提出エンドポイントの仕様情報です。

### 1. コード提出 (POST)
* **エンドポイント**: `/contests/{contestId}/submit`
* **パラメータ (Form Data)**:
  - `csrf_token`: セッション内の有効な CSRF トークン
  - `data.TaskScreenName`: 問題のスクリーン名（例: `abc460_a`）
  - `data.LanguageId`: プログラミング言語の識別数値ID（例: C++ (GCC 12.2) = `6017`）
  - `sourceCode`: 提出するソースコード文字列
  - `cf-turnstile-response`: Cloudflare Turnstile の検証トークン（**後述の「Turnstile」セクション参照**）
* **レスポンス**:
  - 成功時: ステータス `302 Found` → `/contests/{contestId}/submissions/me` へリダイレクト
  - 失敗時: ステータス `200 OK`、HTML 内に `<div class="alert alert-danger">` でエラーメッセージが含まれる

### 2. 提出結果の取得 (GET)
* **エンドポイント**: `/contests/{contestId}/submissions/me?_={timestamp}`
* **レスポンス**: HTML ページ内に提出履歴テーブルが含まれる
* **テーブル構造**:
  - `<thead>` の `<th>` で列名を取得（`提出時間`, `問題`, `ユーザ`, `言語`, `結果`, `実行時間`, `メモリ`）
  - `<tbody>` の各 `<tr>` が1件の提出に対応
  - 提出IDは `<a href="/contests/{contestId}/submissions/{submissionId}">` のリンクから抽出
  - ジャッジ結果は `<span class="label">` のテキストから取得（`WJ`, `1/15`, `AC`, `WA` 等）

### 3. ジャッジステータスの遷移
提出後、ジャッジ結果は以下のように遷移します：
* **`WJ`**: ジャッジ待ち (Waiting for Judge)
* **`n/m`**: ジャッジ進行中（例: `5/12` = 12ケース中5ケース完了）
* **最終結果**: `AC`, `WA`, `TLE`, `MLE`, `RE`, `CE` 等

> [!IMPORTANT]
> **ポーリング完了判定**: `WJ` および `数字/数字` パターンは中間ステータスです。これら以外のステータスが返却されたらジャッジ完了と判定してポーリングを停止します。

### 4. よくあるエラーメッセージ

| エラーメッセージ | 原因 |
|---|---|
| `エラーが発生しました。` | CSRFトークン不一致、Turnstileトークン不正、またはセッション切れ |
| `前回の提出から30秒間は提出できません。` | 連続提出の制限（30秒間隔） |
| `ソースコードが短すぎます。` | ソースコードが空または極端に短い |

---

## 🔐 Cloudflare Turnstile の統合に関する知見

> [!CAUTION]
> **この知見は Phase 1.3 開発中に数日間のデバッグを経て得られた重要な教訓です。将来の開発者は必ず一読してください。**

### 背景

AtCoder は 2024年頃から Cloudflare Turnstile（CAPTCHA の後継となるボット検出サービス）をコード提出フォームに導入しました。Turnstile は提出時に `cf-turnstile-response` という隠しフィールドに検証トークンを埋め込み、サーバー側でリクエストの正当性を検証します。

### 問題の症状

コード提出時に以下のエラーが返される：
```
エラーが発生しました。（セッション切れ、コンテストの未登録、
またはCSRFトークン不一致の可能性があります。
一度ページをリロードしてからお試しください。）
```

CSRF トークンが正しくても、Turnstile トークンが不正だとこのエラーが返されます。
エラーメッセージには Turnstile について一切言及されていないため、**原因の特定が非常に困難**です。

### ❌ 失敗したアプローチ

#### 1. `fetch` で submit ページを GET → HTML パース → CSRF 取得 → 手動 POST
```javascript
// ❌ これではTurnstileトークンを取得できない
fetch('/contests/{contestId}/submit')
  .then(res => res.text())
  .then(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const csrf = doc.querySelector('input[name="csrf_token"]').value;
    // Turnstile ウィジェットは JS で動作するため、
    // fetch で取得した静的 HTML からはトークンを取れない
  });
```

**失敗理由**: Turnstile トークンは Cloudflare の JavaScript ウィジェットがページ上で実行されて初めて生成されます。`fetch` で取得した HTML を `DOMParser` でパースしても、JS は実行されないため Turnstile トークンは得られません。

#### 2. `FormData` を手動構築して Turnstile なしで POST
```javascript
// ❌ Turnstileトークンが含まれないため拒否される
const formData = new FormData();
formData.append('csrf_token', token);
formData.append('data.TaskScreenName', problemId);
formData.append('data.LanguageId', languageId);
formData.append('sourceCode', code);
// cf-turnstile-response が含まれていない → エラー
```

**失敗理由**: AtCoder のサーバーは `cf-turnstile-response` の値を Cloudflare API で検証しています。このフィールドがないか無効な値だと、CSRF トークンが正しくてもリクエストが拒否されます。

#### 3. DOM のネイティブフォームから `FormData` を構築するが Turnstile の待機が不十分
```javascript
// ❌ Turnstileが生成完了する前に送信してしまう
const form = document.querySelector('form[action*="/submit"]');
const formData = new FormData(form);
// cf-turnstile-response の value が空文字のまま送信される
```

**失敗理由**: Turnstile ウィジェットはページロード後にバックグラウンドで非同期的にチャレンジを実行し、完了後に `<input name="cf-turnstile-response">` の `value` を更新します。ウィジェットの完了前に `FormData` を構築すると、空のトークンが送信されます。

### ✅ 正しいアプローチ

```javascript
submit(contestId, problemId, languageId, code, callback) {
  // 1. タスクページ上のネイティブ提出フォームを探す
  //    （content script は /tasks/ ページで動作しており、
  //     このページには提出フォームが存在する）
  const nativeForm = document.querySelector('form[action*="/submit"]');

  // 2. テキストエリアにコードをセット
  const textarea = nativeForm.querySelector('textarea[name="sourceCode"]');
  textarea.value = code;

  // 3. Turnstile ウィジェットがトークンを生成するまで待機
  const turnstileInput = nativeForm.querySelector('input[name="cf-turnstile-response"]');
  this.waitForTurnstile(turnstileInput).then(() => {
    // 4. ネイティブフォームから FormData を構築
    //    → CSRF, Turnstile, その他の隠しフィールドが全て含まれる
    const formData = new FormData(nativeForm);

    // 5. fetch で POST（credentials: 'include' でCookieを送信）
    return fetch(nativeForm.action, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
  });
}

waitForTurnstile(input) {
  if (!input) return Promise.resolve();
  // トークンは300文字以上の長い文字列
  if (input.value && input.value.length > 20) return Promise.resolve();

  return new Promise((resolve) => {
    const check = () => {
      if (input.value && input.value.length > 20) {
        resolve(); // トークン取得完了
      } else if (/* タイムアウト */) {
        resolve(); // タイムアウト時もとりあえず送信を試行
      } else {
        setTimeout(check, 300); // 300ms ごとにポーリング
      }
    };
    check();
  });
}
```

### アーキテクチャの要点

```
┌─────────────────────────────────────────────────────────┐
│  AtCoder タスクページ (/contests/{id}/tasks/{task_id})  │
│                                                         │
│  ┌─────────────────────────────────────┐                │
│  │  ネイティブ提出フォーム              │                │
│  │  ├─ csrf_token (hidden)             │                │
│  │  ├─ data.TaskScreenName (hidden)    │                │
│  │  ├─ data.LanguageId (select)        │                │
│  │  ├─ sourceCode (textarea)           │  ← コード注入  │
│  │  ├─ cf-turnstile-response (hidden)  │  ← Turnstile  │
│  │  └─ file (input[type=file])         │    が自動設定   │
│  └─────────────────────────────────────┘                │
│                                                         │
│  ┌──────────────────────┐                               │
│  │  Content Script       │                              │
│  │  (content.js)         │  ← iframe 内エディタから     │
│  │  ├─ submitter.js ─────┤     メッセージ受信           │
│  │  │  1. フォーム発見    │                              │
│  │  │  2. コード注入      │                              │
│  │  │  3. Turnstile待機   │  ← 最大45秒                 │
│  │  │  4. FormData構築    │  ← ネイティブフォームから    │
│  │  │  5. fetch POST      │                             │
│  │  │  6. 結果ポーリング  │                              │
│  │  └────────────────────┘                              │
│  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

> [!WARNING]
> **`fetch` で取得した HTML からは Turnstile トークンを得ることは原理的に不可能です。** Turnstile は JavaScript ウィジェットであり、ブラウザが実際にレンダリングしたページ上でのみ動作します。必ずライブ DOM（レンダリング済みのページ上の要素）からトークンを取得してください。

### ⚠️ レイアウト再構成による Lazy Load ＆ DOM移動（Reparenting）による iframe 破損の問題

**現象**:
1. **Lazy Load による未起動**: 拡張機能がページのレイアウトを固定（`position: fixed` やスプリットパネル）に再構成すると、実際の提出フォーム（Turnstileコンテナである `.cf-challenge` を含む）がスクロール可能な `#main-container` の下部（初期表示のビューポート外）に配置されることになります。Cloudflare Turnstile は内部で `IntersectionObserver` を利用してレイアウト上の可視性を判定し、ビューポート内に要素が入るまでレンダリングを遅延させる（Lazy Load）仕様になっているため、フォームがビューポートから遠く離れた位置にあると、いつまで待っても Turnstile が起動せず、トークンが生成されずタイムアウトします。
2. **DOM移動（Reparenting）による iframe 破損（真っ白化）**: ブラウザのセキュリティおよび仕様上、**すでにレンダリングされた `iframe` を含む親要素をDOMツリー内で別の位置に移動（再親化 / Reparenting）させると、中の `iframe` は切断され、中身が真っ白に初期化された「破損状態」**になります。AtCoder標準の自動ロード、あるいは拡張機能のレイアウト完成前に描画された Turnstile ウィジェットは、拡張機能がレイアウトを構成する際に `#main-container` を `#atcoder-workspace-wrapper` の下に移動させるため、この瞬間にすべて真っ白な破損状態になり、クリックしても無反応になります。

**解決策**:
`manifest.json` において、`"world": "MAIN"` (MAIN world) で動作する独立したスクリプト `src/content/turnstile-kick.js` を `document_start` のタイミングで注入し、以下の2つの制御を行います：
1. **レイアウト構築完了まで待機**: 拡張機能がレイアウト構築を終え、`#atcoder-workspace-wrapper` が作成されるまでは、Turnstile のレンダリングを保留（待機）します。これにより、レンダリング直後に DOM が移動されて破損するのを防ぎます。
2. **自動描画された破損 iframe のリセットと再生成**: 万が一、レイアウト構築前にすでに implicit（暗黙的）に Turnstile が描画され、DOMの移動によって iframe が真っ白に破損した場合は、`window.turnstile.reset(container)` を呼び出して破損した iframe をクリアし、新しいDOM構造の元で明示的に再描画を実行します。

また、Cloudflare Turnstile の `api.js` スクリプトが `async` や `defer` 属性付きで読み込まれている場合、`window.turnstile.ready()` を呼び出すと `TurnstileError`（`Remove async/defer ...`）が投げられます。このエラーを回避するため、`ready()` は使用せず、`typeof window.turnstile.render === 'function'` が真になったことをポーリングで確認した上で、直接 `render()` を実行するように設計されています。

これにより、Turnstile の Lazy Load と DOM 移動による破損の双方を完全に解決しています。

### ⚠️ 開発・デバッグ時の注意点

#### 1. 拡張機能リロード時の「コンテキスト無効化（Invalidated context）」
拡張機能をリロード（またはソースコード変更による自動更新）した直後は、すでに開いていたブラウザのタブ上で動作するスクリプト（Content Script）が Chrome の仕様により無効化されます。
* **現象**: `chrome.storage` へのアクセスや iframe エディタとのメッセージ通信がすべてエラーになり、保存されたコードが消えたり言語が「未選択（言語情報なし）」になります。
* **対策**: 拡張機能を更新した後は、**必ず AtCoder の対象タブを F5 等でリロード**してください。

#### 2. 非同期 DOM 生成による言語選択肢のレースコンディション
AtCoder のページ読み込みタイミングによっては、言語セレクトボックス自体は存在しても、中の `<option>` 選択肢がまだ非同期的にレンダリングされていない場合があります。
* **現象**: 言語リストが空（`[]`）の状態でエディタが初期化されてしまい、正しいコードが読み込めなくなります。
* **対策**: `content.js` の初期化メッセージ送信（`editor-ready` 時）では、単に言語要素があるかだけではなく、**「セレクトボックスの値が存在し、かつ `<option>` の選択肢が 1 件以上読み込まれていること」**をチェックし、ロードが完了するまで最大1秒間リトライするロジック（`sendConfigWithRetry`）を組むことで安全に動作させています。

