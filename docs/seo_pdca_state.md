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
