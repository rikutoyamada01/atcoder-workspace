# Changelog

All notable changes to the AtCoder Workspace extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-07-31

### Added
- **📝 学習ノート & 🏷️ タグ機能**: コンソール領域で問題ごとの解法メモやタグ（`二分探索`, `DP`, `コーナーケース` 等）をローカル保存・管理できる機能を追加
- **↕️ ターミナルパネルのドラッグリサイズ機能**: コンソールヘッダー（「テスト結果」領域）を上下にドラッグすることでターミナルの高さを自在に調整・サイズを自動保存可能に改善
- **📐 補足メモテキストエリアの高さ自動伸縮**: 補足メモの入力内容・行数に応じてテキストエリアの高さを自動で最適なサイズへ伸縮する機能を追加
- **🏷️ タグのハイパーリンク機能**: `🏷️ タグ:` ラベルホバー時に下線が表示され、クリックで直感的に『競プロ用語解説ガイド』が開く連携を追加
- **🏷️ 新規プリセット原因タグ `#型キャスト・精度`**: 整数除算の切り捨てや double 型の精度誤差用のプリセット原因タグを追加
- **🚀 GitHub Actions 自動デプロイ**: master ブランチへのプッシュで `pages/` を自動デプロイする CI/CD パイプラインを統合

### Fixed
- **⚡ AtCoder テストランナーの HTTP 429 (Rate Limit) エラー回避**: リクエスト間隔の最適化、`Retry-After` ヘッダー対応および指数バックオフ付き自動再試行機能（最大3回）を導入し、テスト実行時のアクセス制限エラーを防止
- **📜 コンソールの自動スクロール制御の改善**: サンプルテスト判定時（AC/WA）にコンソール領域が毎回最下部へ強制自動スクロールされる挙動を解除し、選択中のスクロール位置を維持可能に修正
- **🌐 学習ノート領域の多言語 (i18n) サポート修正**: 動的 DOM 生成時のタグ名・説明キーの不一致を修正し、多言語表示を適正化

### Changed
- Web サイトの階層構造を `pages/` ディレクトリ配下に完全整理・一元化
- MathJax v3 を組み込み、数式 (LaTeX) の描画品質を向上

### 📚 New Articles & Guides (新着記事)
- 🔢 [「小数で解くな、整数で解け！」競プロにおける浮動小数点数・切り捨て罠の完全回避ガイド](https://rikutoyamada01.github.io/atcoder-workspace/article/integerization-tips.html)
- 🎯 [灰レーティング脱出！茶色になるまでに絶対に押さえるべき解法 & 実践Tips](https://rikutoyamada01.github.io/atcoder-workspace/article/gray-to-brown-tips.html)
- 📖 [競プロ初心者向け アルゴリズム & 用語解説ガイド](https://rikutoyamada01.github.io/atcoder-workspace/article/glossary.html)
- 🧮 [計算量・TLEシミュレーター & 10⁸の壁突破ガイド](https://rikutoyamada01.github.io/atcoder-workspace/article/complexity.html)

## [1.6.4] - 2026-07-21

### Changed
- Editor（問題ページ内ワークスペース）から不要な通知バナーおよび What's New ボタンを撤去して UI を本来のシンプルさに還元
- 拡張機能の設定画面（Options ページ）へ未読通知バナーを統合し、アップデート時に自動で設定画面が開き目立つバナーからリリースノートを確認できる仕様に変更

## [1.6.3] - 2026-07-21

### Fixed
- リリースノート切り出し用スクリプト (`scripts/get-release-notes.js`) および `CHANGELOG.md` がリポジトリ追跡対象に含まれていなかった不具合を修正

## [1.6.2] - 2026-07-21

### Added
- リリースノート表示機能（AtCoder Workspace ページおよび設定画面から最新情報と過去のバージョン履歴を閲覧可能）
- `CHANGELOG.md` から GitHub Release 本文を自動生成する CI パイプラインを統合

### Fixed
- CI のコードフォーマット（Prettier）不整合を修正

## [1.6.1] - 2026-07-21

### Fixed
- ページ遷移後に正しい問題に対して AC ステータスが割り当てられない不具合を修正
- 再提出時に解説 AC などのステータスが自己 AC で上書きされないよう保護を強化
- ページ遷移時にもコンソールのジャッジ結果が維持されるよう sessionStorage 保持機能を追加
- 高コントラストモードでのカーソル視認性向上と Monaco エディタ用カーソルセレクタの調整
- X (旧Twitter) 共有リンクの遷移先を Chrome ストアではなく提出詳細ページへ変更

### Added
- オプションページでの問題ステータスフィルタリング（すべて、Self AC、Editorial AC）機能
- ホバー時に下線が表示されるコンテスト/問題リンクのスタイル調整

## [1.6.0] - 2026-07-12

### Added
- AC ステータス管理機能（Self AC / Editorial AC の識別・記録機能）
- オプションページでの問題解決ステータスのリアルタイム同期と一覧表示
- 機能概要およびロードマップ/プレゼンテーション資料のアップデート

## [1.5.0] - 2026-06-27

### Added
- 言語別カスタムテンプレート＆コードスニペットのライブラリ機能
- テンプレート自動展開と設定同期処理の向上

## [1.4.3] - 2026-06-27

### Added
- Monaco エディタの多言語動的サポートおよびリアルタイム設定同期機能

## [1.4.0] - 2026-06-20

### Added
- Cloudflare Turnstile 判定回避機能と浮動 UI 連携
- テストランナー機能とサンプルケース並列実行の安定化
