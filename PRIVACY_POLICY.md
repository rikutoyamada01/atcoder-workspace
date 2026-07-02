# プライバシーポリシー / Privacy Policy

本リポジトリで提供される拡張機能「AtCoder Workspace」に関するプライバシーポリシーです。
This is the privacy policy for the "AtCoder Workspace" Chrome extension.

- 日本語版は[こちら](#japanese)
- English Version is [here](#english)

---

## <a name="japanese"></a> プライバシーポリシー (日本語)

### 概要
本拡張機能は、利用者の個人情報を収集、送信、蓄積することは一切ありません。完全なローカル設計で動作します。

### 1. 情報の収集と利用目的
本拡張機能は、ユーザーのソースコードや設定、AtCoderのログイン情報などの個人データを外部のサーバーに送信または収集することはありません。
- **ソースコードと設定データ**: 記述されたプログラムコードやエディタのレイアウト（分割比率など）は、ブラウザのローカル領域 (`chrome.storage.local`) のみに保存され、第三者に共有されることはありません。
- **コードの実行と提出**: サンプルケースのローカルテストおよびコードの提出処理は、利用者のアクティブなブラウザセッションを通じてAtCoder公式ウェブサイト (`https://atcoder.jp`) と直接通信され、バックグラウンドで安全に実行されます。

### 2. 使用する権限とその必要性
本拡張機能は、動作に必要な最低限の権限のみを要求します。
- `storage` (ストレージ): 記述中のコードの自動保存およびエディタ設定の保存に利用します。
- `unlimitedStorage` (無制限ストレージ): ソースコード、学習メモ、提出結果の履歴データの保存容量制限を解除するために利用します。
- `notifications` (通知): コードのテスト実行が完了した際や、提出結果の更新をデスクトップ通知でお知らせする際に利用します。
- `https://atcoder.jp/*` (ホスト許可): AtCoderの問題ページ上にコードエディタ、テスト環境、および提出ボタンを正しく埋め込み動作させるために必要となります。

### 3. 外部モジュール・アクセス解析
本拡張機能には、Google Analyticsなどのアクセス解析やトラッキングツール、外部広告モジュールは一切含まれていません。

### 4. お問い合わせ
ご質問やご報告がございましたら、GitHubのIssueよりご連絡ください。

---

## <a name="english"></a> Privacy Policy (English)

### Overview
"AtCoder Workspace" does NOT collect, store, or transmit any user personal data. It operates fully locally within your browser.

### 1. Information Collection and Use
This extension does not transmit or gather your source code, configuration details, or AtCoder login credentials to any external servers.
- **Source Code & Layout Data**: Any written code and editor layouts (such as split ratio) are stored strictly inside your browser's local storage (`chrome.storage.local`) and are never shared.
- **Code Run & Submission**: The running of local tests and submissions are processed directly through your browser's active session to the official AtCoder website (`https://atcoder.jp`) in a secure background context.

### 2. Permissions Required & Justifications
This extension requests only the minimum set of permissions necessary for its features:
- `storage`: Used to auto-save code drafts and persist editor layouts.
- `unlimitedStorage`: Used to remove storage quota limits for saving user source codes, learning notes, and submission history.
- `notifications`: Used to show desktop alerts when code testing completes or submission status updates.
- `https://atcoder.jp/*`: Required to inject the code editor pane, testing module, and submit buttons directly into AtCoder contest task pages.

### 3. Third-Party Services & Analytics
This extension does not contain any analytics tools, tracking libraries, or external advertisement modules. It is an open-source, local-first utility.

### 4. Support and Feedback
If you have any questions or reports regarding privacy, please create an issue on our GitHub repository.
