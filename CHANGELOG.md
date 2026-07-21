# Changelog

All notable changes to the AtCoder Workspace extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
