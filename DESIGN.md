---
version: 1.1.0
name: AtCoder Native UI System & UX Principles
colors:
  navbar_bg: "#222222"
  body_bg: "#ffffff"
  text_main: "#333333"
  text_muted: "#777777"
  border: "#dddddd"
  panel_header_bg: "#f5f5f5"
  btn_primary: "#337ab7"
  btn_primary_hover: "#286090"
  btn_success: "#5cb85c"
  btn_success_hover: "#449d44"
  btn_default: "#ffffff"
  btn_default_border: "#ccc"
  atcoder_rating:
    gray: "#808080"
    brown: "#804000"
    green: "#008000"
    cyan: "#00C0C0"
    blue: "#0000FF"
    yellow: "#C0C000"
    orange: "#FF8000"
    red: "#FF0000"
typography:
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
  monospace: 'Monaco, Menlo, Consolas, "Courier New", monospace'
---

# DESIGN.md - AtCoder Native UI デザイン & UX 仕様書

## 1. デザイン & UX 理念

本プロジェクトのコアバリューは、**「ユーザーの認知負荷と操作摩擦を最小化すること」**です。
そのため、UIデザインとUX設計には細心の注意を払い、以下の2原則を徹底します。

### ❶ AtCoderの視覚的要素と同調（Style Matching）
AtCoder公式のスタイル（Bootstrap 3風のフラットな構造、枠線、ボタン色、タイポグラフィ）に準拠し、ユーザーに「見慣れた環境」を提供することで、新たなデザインへの適応負荷をゼロにします。

### ❷ 不要な「タブ切り替え」や「階層移動」の排除（No Useless Tabs）
本拡張機能は「エディタと問題画面の往復（タブ・ウィンドウ切替）」をなくすために開発されます。この哲学に基づき、説明資料やダッシュボードも**「情報をタブの裏に隠さず、1つのページで上から下へスクロールするだけで理解できる」シームレスな1カラム/2カラムレイアウト**を徹底します。

---

## 2. 禁止事項 (Anti-Patterns)
- **AI生成風デザインの禁止**: 近未来風のネオンカラー（サイアン、パープル）、グラスモルフィズム、背景のぼかしやグラデーション。
- **無駄なタブ・アコーディオンの禁止**: ユーザーに「クリックして中身を開かせる」操作を強制しない。
- **視認性の低いフォントの禁止**: AtCoderで使用されている標準的なサンセリフ体（Meiryo, Helvetica等）を使用。
- **過剰な装飾の禁止**: 丸すぎる角丸（`border-radius` は原則 `4px`）、立体的な影（`box-shadow` は原則使用しないか、ごく軽微なものに限定）。

---

## 3. カラーパレット & コンポーネント定義

### 3.1 カラー定義
- **メイン背景**: `#ffffff` (カードやコンテンツの背景も原則白)
- **サブ背景**: `#f5f5f5` (テーブルヘッダー、パネルヘッダー)
- **枠線 (Border)**: `1px solid #dddddd` (フラット、角丸 `4px`)
- **テキスト**: `#333333` (メイン)、`#777777` (補足説明やプレースホルダー)

### 3.2 ボタン (Buttons)
- **Primary Button (主要アクション)**
  - 背景色: `#337ab7` | ホバー時: `#286090` | 文字色: `#ffffff`
- **Success Button (テスト実行・提出等)**
  - 背景色: `#5cb85c` | ホバー時: `#449d44` | 文字色: `#ffffff`
- **Default Button (戻る・汎用アクション)**
  - 背景色: `#ffffff` | 枠線: `#cccccc` | ホバー時: `#e6e6e6` | 文字色: `#333333`
