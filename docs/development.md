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
   git clone https://github.com/yamadarikuto/atcoder-workspace.git
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
