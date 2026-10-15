# AtCoder Workspace — SEO & AEO Automated PDCA State Ledger

このファイルは、Antigravity Scheduled Automation（`AtCoder Workspace Weekly SEO & AEO PDCA`）が毎週月曜 9:00 JST に自動参照・更新する継続的改善の記録台帳です。

## Google Search Console (GSC) API 連携ステータス
- **認証ファイルパス**: `.gsc-credentials.json`（`.gitignore` 登録済み）または環境変数 `GSC_CREDENTIALS_PATH`
- **対象プロパティ**: `https://rikutoyamada01.github.io/atcoder-workspace/`
- **監査コマンド**: `node scripts/seo-pdca-audit.js --write`

---

## 実行履歴 (PDCA Log)

### Cycle #1 — 2026-10-12 (Initial Baseline & Setup)
- **Check (計測・監査)**:
  - `scripts/seo-pdca-audit.js` を新設し、`pages/` 配下の全9ページのSEO/AEO初期監査を実施（初期警告数: 30件）。
  - `sitemap.xml`, `robots.txt`, `llms.txt` が未設置であることを検出。
  - 全HTMLで `<link rel="canonical">`, `og:image`, `JSON-LD` が未設定であることを検出。
- **Plan (計画)**:
  1. `pages/sitemap.xml`, `pages/robots.txt`, `pages/llms.txt` の自動生成パイプラインを確立。
  2. ランディングページである `pages/presentation.html` に `canonical`, `og:image`, および `SoftwareApplication` + `FAQPage` の JSON-LD 構造化データを先行実装。
- **Do (実装)**:
  - `node scripts/seo-pdca-audit.js --write` により `sitemap.xml`, `robots.txt`, `llms.txt` を生成。
  - `pages/presentation.html` に JSON-LD およびメタタグを追加し、警告数を 30件 → 24件 に削減。
- **Act / Next Cycle Backlog (次回以降の改善ターゲット)**:
  - [ ] `pages/article.html` および `pages/article/*.html`（4記事）への `canonical`, `og:image`, `TechArticle` / `BreadcrumbList` JSON-LD の追加
  - [ ] `pages/index.html` の `<meta http-equiv="refresh">` リダイレクト構造の解消または正規化
  - [ ] `.gsc-credentials.json` 配置後の実測クエリ（高表示・低CTRクエリ、順位5〜20位クエリ）に基づく `<title>` / `description` と記事見出しの最適化

### Cycle #2 — 2026-10-15（分析に基づく修正、公開前）

- GSC読み取り専用APIで9月15日〜10月12日の確定データを確認。4表示・0クリック。URL検査はトップのみ登録済み、他8 URLは未認識。サイトマップは送信済み・処理待ち。
- 製品ページとREADMEにChrome Web Storeへの導入リンク・操作手順を追加。FAQと日英プライバシーポリシーで、ブラウザ内保存とAtCoderでの実行・提出を区別。
- 8ページのナビ・フッターを静的HTMLへ変更。4記事に関連記事、著者・実際の更新日、ArticleとBreadcrumbListを追加。全公開本文ページにcanonicalと配信対象のOGP画像を設定。
- Pythonの除算、整数化の成立条件、計算量の分類と速度保証の表現を訂正。計算量ツールは仮定に基づく概算表示とし、不正な入力も処理する。
- 製品URLは既存のpresentation.htmlを維持。トップの即時転送にcanonicalを明記。サイトマップから作業端末のmtimeによる更新日を除去。
- 監査に配信対象のリンク・画像の存在確認、`--local-only`と`--check`を追加。GSC集計は28日・サイト合計とページ別を独立取得。llms.txtや全ページのJSON-LDを必須扱いする警告を廃止。
- 検証: 全107テスト、ESLint、バージョン整合性チェック、GSC取得とローカル監査を確認。ローカル監査は0警告。旧監査の24警告とは基準が変わっており、順位向上を示す点数ではない。
- 公開後の確認事項: OGP画像のHTTP 200、重要ページのライブテスト、再クロール後のGoogle選択canonical、サイトマップ取得状態。インデックス数や順位への反映は未確認。
