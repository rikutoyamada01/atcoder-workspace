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
