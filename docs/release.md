# AtCoder Workspace リリース手順書

本ドキュメントは、本拡張機能（AtCoder Workspace）の管理者（ユーザー様）専用のリリース作業手順書です。新しいバージョンをリリースする際は、以下のステップに沿って作業を行ってください。

---

## 概要図
```mermaid
graph TD
    A[1. 準備ブランチ prepare-release の作成] --> B[2. バージョン情報のバンプ]
    B --> C[3. ローカルビルド & 動作検証]
    C --> D[4. master へマージ & プッシュ]
    D --> E[5. Gitタグ vX.Y.Z の付与 & プッシュ]
    E --> F[6. GitHub Actions による自動ビルド]
    F --> G[7. Chrome Web Store へZIPアップロード]
```

---

## リリース手順

### Step 1. リリース準備ブランチの作成
新しいバージョンを準備するための作業用ブランチを作成します。
```bash
git checkout master
git pull origin master
git checkout -b prepare-release
```

### Step 2. バージョンのバンプ（更新）
リリースする新しいバージョン番号を、以下の2つのファイルに反映します。
1. **`package.json`** (`"version"` フィールド)
2. **`manifest.json`** (`"version"` フィールド)

> [!NOTE]
> 例として、`1.3.0` から `1.4.0` にアップデートする場合は、両方のファイルを `1.4.0` に書き換えて保存します。

### Step 3. ローカルビルドと動作検証
1. 依存関係と Monaco Editor の静的ファイルをセットアップします（初回のみ、または依存変更時）。
   ```bash
   npm install
   npm run setup
   ```
2. リリースパッケージ（ZIP）をビルドします。
   ```bash
   npm run build
   ```
   ビルドが成功すると、`dist/` ディレクトリ配下に `atcoder-workspace-vX.Y.Z.zip` が生成されます。
3. **動作確認**:
   - `dist/atcoder-workspace-vX.Y.Z.zip` を一度解凍します。
   - Google Chrome で `chrome://extensions/` を開きます。
   - 「デベロッパーモード」をONにし、「パッケージ化されていない拡張機能を読み込む」から解凍したフォルダを選択します。
   - 実際に AtCoder の問題ページを開き、エディタや自動テスト、提出ポップアップ、アイコン表示などが正常に動作することを確認します。

### Step 4. master へのマージとプッシュ
検証が問題なければ、リリース準備ブランチの変更をコミットし、`master` ブランチへマージしてプッシュします。
```bash
git add .
git commit -m "chore: Prepare release vX.Y.Z"
git checkout master
git merge prepare-release
git push origin master
```
マージが終わったら、使い終わった `prepare-release` ブランチは削除して構いません。

### Step 5. バージョンタグの作成とプッシュ（CI/CDトリガー）
`master` にプッシュした後、Gitタグを付与してリモートにプッシュします。これにより、GitHub Actionsが自動的にトリガーされ、GitHub Release が生成されます。
```bash
# 例: v1.4.0 をリリースする場合
git tag v1.4.0
git push origin v1.4.0
```

- **自動で実行されること (GitHub Actions)**:
  - リモートへの `v*` タグプッシュを検知して、ワークフロー（`.github/workflows/release.yml`）が起動します。
  - 自動で依存関係のインストール、Monaco Editorのセットアップ、ZIP化ビルドが実行されます。
  - GitHub Releases に新しいリリースが下書きまたは公開状態で作成され、ビルドされたZIPファイルが自動でアタッチされます。

### Step 6. Chrome Web Store (CWS) への申請
1. [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole) にログインします。
2. 対象のアイテム（AtCoder Workspace）を選択するか、新規登録します。
3. GitHub Release からダウンロードした、あるいはローカルの `dist/` 配下にある最新の `atcoder-workspace-vX.Y.Z.zip` ファイルをデベロッパーコンソールにアップロードします。
4. ストアの掲載情報（説明文など）を更新する場合は、`docs/store-description.md` の記述をコピー＆ペーストして利用します。
5. 「審査に送信」をクリックします（審査には通常数日から1週間程度かかります）。
