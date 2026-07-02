// Detailed node database
const skillsDb = {
  monaco: {
    title: "Monaco エディタ埋込",
    phase: 1,
    prereqs: "前提条件: なし (Phase 1 の基礎機能)",
    desc: "AtCoderの問題文ページを左右2分割し、右側にVS Codeと同じ高性能エディタ「Monaco Editor」をシームレスに埋め込みます。使い慣れたショートカットや操作感で、画面を行き来することなく即座にコーディングを開始できます。",
    key_features: [
      "ドラッグによる境界線の調整が可能な左右分割レイアウト",
      "主要言語（C++, Python, Rust, Java, Go）のシンタックスハイライト対応",
      "自動インデント、対応する括弧の自動補完、Prettierによる自動コード整形",
      "エディタテーマの切り替え（ダークテーマ / ライトテーマ）",
      "一時的な入力内容の1.5秒停止時自動ローカルセーブ機能"
    ],
    technical_specs: [
      "Monaco Editor Core API",
      "Chrome Content Scripts Injection",
      "chrome.storage.local (コード一時保存)",
      "CSS Resizable Columns Layout"
    ],
    user_impact: "エディタ起動とAtCoder上の問題文の配置にかかる時間を100%削減。ブラウザの1タブ内で快適にコードを書き始められます。",
    verification: "任意のAtCoderの問題ページを開き、右半分にMonaco Editorが出現すること、ドラッグで幅を調節できること、コード整形が動作することを確認します。",
    pts: 200
  },
  template: {
    title: "テンプレート＆スニペット",
    phase: 2,
    prereqs: "前提条件: [Monaco エディタ埋込] の実装完了後",
    desc: "問題を開いた際、選択しているプログラミング言語に応じた入出力テンプレートや、よく使うコードスニペットを自動的にエディタへ挿入する機能です。同じボイラープレートを何度も書く手間を完全に省きます。",
    key_features: [
      "言語切り替え時のテンプレート（高速入出力、REPマクロ等）自動インジェクション",
      "サイドパネルから自作アルゴリズム（Union Find, Dijkstra等）をワンクリック挿入",
      "テンプレートコードのユーザーカスタム設定UI of 提供",
      "よく使う関数のスニペットキーによるインテリセンス補完"
    ],
    technical_specs: [
      "Monaco SnippetController Integration",
      "chrome.storage.sync (テンプレート同期)",
      "Snippet Manager UI (Side Drawer)"
    ],
    user_impact: "初期コードのコピペ時間を毎回10〜15秒削減。アルゴリズム記述時のタイピングミスやバグの混入を未然に防ぎます。",
    verification: "エディタの言語を切り替えた際に、自動的に設定したテンプレートコードが初期化ロードされること、スニペットドロワーからコードが挿入できることを確認します。",
    pts: 200
  },
  test: {
    title: "自動テスト実行",
    phase: 1,
    prereqs: "前提条件: [Monaco エディタ埋込] の実装完了後",
    desc: "AtCoderの問題文からサンプル入出力（入力例・出力例）を自動的にスクレイピングし、AtCoderのコードテストAPIを叩いてバックグラウンドで実行・判定します。",
    key_features: [
      "問題文HTMLからのサンプル入出力データ自動抽出（スクレイピング）",
      "AtCoderコードテストAPIとの非同期バックグラウンド連携",
      "テスト結果（AC / WA / RE / TLE）の判定結果一括表示",
      "期待される出力と実際の出力のテキスト差分（Diffビューア）表示"
    ],
    technical_specs: [
      "DOMParser scraping engine",
      "AtCoder Custom Test API integration",
      "Diff-match-patch algorithm"
    ],
    user_impact: "テストケースのコピペやコンパイル、出力の目視比較の手間をすべて排除し、デバッグを加速させます。",
    verification: "テスト実行ボタンをクリックし、自動でサンプルケースが実行され、結果がDiff付きで表示されることを確認します。",
    pts: 200
  },
  customtest: {
    title: "カスタムテストケース追加",
    phase: 2,
    prereqs: "前提条件: [自動テスト実行] の実装完了後",
    desc: "サンプルケース以外に、ユーザー自身で任意の入力・出力値を設定し、テストケースとして追加して一括テストできる機能です。境界値やコーナーケースの検証に威力を発揮します。",
    key_features: [
      "任意の入力値・期待値の追加・編集インターフェース",
      "追加したカスタムテストケースのローカル保存・永続化",
      "サンプルケースとカスタムケースの一括自動テスト実行",
      "ケースごとの有効・無効化の切り替え機能"
    ],
    technical_specs: [
      "IndexedDB / chrome.storage.local for cases",
      "Dynamic UI forms & list editing",
      "Unified test runner harness"
    ],
    user_impact: "問題特有のコーナーケースやエッジケースをごく短時間で検証可能になり、提出時の無駄なWAを防ぎます。",
    verification: "カスタムケースを追加し、サンプルケースと一緒にテスト実行され、期待した結果になることを確認します。",
    pts: 100
  },
  notes: {
    title: "問題別学習メモ (Note)",
    phase: 2,
    prereqs: "前提条件: [Monaco エディタ埋込] の実装完了後",
    desc: "問題を解きながら、エディタと同一画面の別タブで「学習メモ」を入力できる機能です。つまずいた点や計算量の考察をMarkdown形式でその場に書き残し、後から振り返ることができます。",
    key_features: [
      "マークダウン対応のメモエディタ（リアルタイムプレビュー対応）",
      "問題ID、難易度、コンテスト名とメモの完全な自動紐づけ保存",
      "コードの特定行へのピン留めや、参照アンカーリンクの作成",
      "解法パターンのメモテンプレート呼び出し機能"
    ],
    technical_specs: [
      "marked.js parser",
      "Dexie.js (IndexedDB wrapper for large storage)",
      "Auto-save input debounce (800ms)"
    ],
    user_impact: "外部のメモアプリやノートブックに切り替える手間を省き、解いている瞬間の「生の思考プロセス」を効率的に言語化・蓄積できます。",
    verification: "メモタブを開き、テキストを記述した際にIndexedDBへ自動保存されること、Markdownのプレビュー表示が正常に描画されることを確認します。",
    pts: 100
  },
  submit: {
    title: "自動提出 ＆ 提出結果ログ",
    phase: 1,
    prereqs: "前提条件: [カスタムテスト＆自動実行] の実装完了後",
    desc: "エディタ内の提出ボタンからバックグラウンドで解答コードをAtCoderに直接送信し、判定結果（AC, WA 等）をリアルタイムにエディタ内でインライン通知します。結果待機中に別ページに強制遷移されません。",
    key_features: [
      "AtCoderサーバーへのバックグラウンド非同期提出（fetch）",
      "ページ遷移を伴わない、提出ステータスのリアルタイムインライン表示",
      "ジャッジ判定（WJ -> AC/WA）完了時のデスクトップ通知・サウンド通知",
      "提出コード、判定、実行時間、メモリ使用量をローカル履歴データベースに記録"
    ],
    technical_specs: [
      "CSRF token extraction",
      "Background service worker message passing",
      "AtCoder submission long-polling",
      "IndexedDB submission history schema"
    ],
    user_impact: "提出ボタンを押した後の「ページロード待ち」や「問題文に戻るためのブラウザバック」の無駄を完全に無くします。",
    verification: "エディタの提出ボタンを押し、別ページへ移動することなく結果判定の更新アニメーションが表示され、AC時に完了ポップアップが出ることを確認します。",
    pts: 100
  },
  dashboard: {
    title: "学習ダッシュボード＆エラー傾向",
    phase: 2,
    prereqs: "前提条件: [自動提出 ＆ 提出結果ログ] の実装完了後",
    desc: "蓄積された提出履歴データを集計し、モチベーションを高める学習グラフや、自分が犯しがちなエラーの傾向分析をダッシュボードとしてビジュアル化します。",
    key_features: [
      "毎日のコミット数を表すACカレンダー（草生やし機能）の描画",
      "エラー原因（WA, TLE, RE等）の発生比率円グラフ表示",
      "難易度別（AtCoderレーティングカラー別）のAC数統計",
      "週次・月次の正解問題数および解答速度推移チャート"
    ],
    technical_specs: [
      "Chart.js lightweight visualization library",
      "IndexedDB history aggregation query",
      "SVG Github-style heatmap generator"
    ],
    user_impact: "自身の進捗が視覚的にわかり成長が実感しやすくなるとともに、WAやTLEといったバグの傾向を可視化して弱点の克服に繋げられます。",
    verification: "拡張機能のダッシュボードページを開き、自身の過去データに基づいたカレンダーやグラフが崩れることなくロードされることを確認します。",
    pts: 100
  },
  library: {
    title: "解法ライブラリ",
    phase: 3,
    prereqs: "前提条件: [問題別学習メモ (Note)] の実装完了後",
    desc: "過去に自分がACしたコードや書き残した学習メモを、アルゴリズムのカテゴリ（DP、グラフ、二分探索など）や検索キーワードで高速に探せる、自分専用の解法ライブラリ機能です。",
    key_features: [
      "アルゴリズムタグ（DP, グラフ, 数学等）の自動・手動分類管理",
      "ソースコードおよび学習メモの全文インデックスによる超高速検索",
      "ライブラリに保存したコードを現在のMonacoエディタにワンクリックで即座にインポート",
      "お気に入りコードやライブラリ参照用のコードスニペットのワンクリック作成"
    ],
    technical_specs: [
      "FlexSearch.js (In-browser full-text search engine)",
      "IndexedDB tag relations schema",
      "Code injection script hooks"
    ],
    user_impact: "「過去に解いたあの問題のDPの遷移式」や「ライブラリのバグ修正」などを一瞬で検索して再利用できるようになり、典型問題の実装力を高めます。",
    verification: "解法ライブラリの検索窓にキーワードを入力し、100ms未満で関連する問題コードとメモがリストアップされ、エディタにコードを反映できることを確認します。",
    pts: 100
  },
  error: {
    title: "エラー解析＆コンパイル",
    phase: 3,
    prereqs: "前提条件: [学習ダッシュボード＆エラー] の実装完了後",
    desc: "C++などのコンパイルエラー出力や、実行時エラー（RE）のメッセージを構文解析し、バグの原因やデバッグのヒントをローカルでわかりやすく親切に表示します。",
    key_features: [
      "GCC / Clangなどのエラー出力の構文解析（行番号、エラー箇所のピンポイント特定）",
      "未定義動作、ゼロ除算、配列外参照（RE）の典型パターンとのマッチングと対処法の提示",
      "AIに頼らない、完全ローカルで動作するルールベース of ヒントエンジン（コンテスト中も安心）",
      "エラーの発生したコード行をMonacoエディタ上で赤くハイライト"
    ],
    technical_specs: [
      "Compiler log parser RegExp engine",
      "Offline Diagnostics rule database",
      "Monaco Decorator & Squiggly lines integration"
    ],
    user_impact: "難解なコンパイラのエラーログを読み解く時間を削減し、特に初心者がコンパイルエラーで挫折するのを防ぎます。",
    verification: "エディタにコンパイルエラーになるコード（セミコロン抜けなど）を入力し、テスト実行した際にエラー箇所が赤波線で示され、日本語の解説が表示されることを確認します。",
    pts: 100
  },
  export: {
    title: "Markdown一括エクスポート",
    phase: 3,
    prereqs: "前提条件: [学習ダッシュボード＆エラー] の実装完了後",
    desc: "これまでに書き溜めたソースコードと学習メモを、ObsidianやNotionといったドキュメントツールでそのまま扱えるMarkdownファイル（YAMLメタデータ付き）として一括エクスポートします。",
    key_features: [
      "YAMLフロントマター（問題ID、スコア、難易度、解答日時、言語）の自動付与",
      "言語別・コンテスト種別（ABC/ARC等）のフォルダ自動構造化",
      "全ファイルおよびフォルダ階層をまとめたZIPアーカイブのクライアントサイド生成",
      "メタデータを含むCSVおよびJSONフォーマット of データ出力対応"
    ],
    technical_specs: [
      "JSZip client library",
      "FileSaver.js integration",
      "Markdown serializer formatter"
    ],
    user_impact: "学習ログを拡張機能の中に閉じ込めず、自分のローカル環境や個人Wikiに移行・バックアップして生涯の知識資産として所有できます。",
    verification: "エクスポートを実行し、生成されたZIPファイルを解凍して、Obsidian等で正常にマークダウンとして認識されリンクが機能することを確認します。",
    pts: 100
  },
  queue: {
    title: "復習キュー (Review Queue)",
    phase: 3,
    prereqs: "前提条件: [解法ライブラリ] の実装完了後",
    desc: "忘却曲線理論（スペースド・レペティション）に基づき、過去に誤答した問題や、復習マークをつけた問題を最適な記憶定着のタイミングで自動的に再出題リストへ登録します。",
    key_features: [
      "提出結果（何回のWAの後にACしたか、または未解決か）に基づいた復習スケジュールの自動計算",
      "Anki等で採用される間隔学習アルゴリズム（SM-2改良版）の実装",
      "復習推奨問題のダッシュボード通知と「今日の復習キュー」表示",
      "手動での『復習間隔の調整（簡単・普通・難しい）』ボタンの提供"
    ],
    technical_specs: [
      "SM-2 Spaced Repetition Algorithm",
      "DateTime logic based scheduler database fields",
      "Dashboard indicator badge"
    ],
    user_impact: "「一度解いて理解したつもり」で終わるのを防ぎ、適切なタイミングでの反復練習により解法パターンを長期記憶に定着させます。",
    verification: "復習対象に指定した問題が、設定されたスケジュール（例: 翌日）に正確に「復習予定リスト」に出現し、再ACによって期間が延びることを確認します。",
    pts: 100
  },
  safety: {
    title: "コンテストセーフティロック",
    phase: 4,
    prereqs: "前提条件: [Markdown一括エクスポート] の実装完了後",
    desc: "リアルタイムで進行中の公式コンテスト（ABC等）の最中に、ルール違反になりうる外部プッシュや共有、過去コードの誤参照を自動的にブロックし、不正行為を未然に防止します。",
    key_features: [
      "AtCoder上の公式コンテストのスケジュール検知（現在進行中コンテストの判定）",
      "コンテスト時間中のGitHubへの自動プッシュの強制保留・キューイング",
      "コンテスト中に過去解法ライブラリや他人のコード参照機能を自動で無効化",
      "コンテスト終了後に保留されていた自動処理（プッシュ等）の安全な自動再開"
    ],
    technical_specs: [
      "AtCoder contest scheduler API scraper",
      "System timer check & feature flag blocking",
      "Queued tasks storage"
    ],
    user_impact: "意図しないルール違反や、GitHubへの即時コード公開による失格・アカウントBANリスクからあなたの努力を100%守ります。",
    verification: "コンテスト進行中の模擬時間帯に設定し、GitHubプッシュが「保留（Queue中）」ステータスになり、終了後に自動実行されることを確認します。",
    pts: 100
  },
  autopush: {
    title: "GitHub Autopush",
    phase: 4,
    prereqs: "前提条件: [コンテストセーフティロック] の実装完了後",
    desc: "AtCoderでAC（正解）したコードを、バックグラウンドで自身のGitHubリポジトリへ自動的にコミット＆プッシュし、プログラミング活動の「芝生（Contributes）」を全自動で記録し続けます。",
    key_features: [
      "提出結果がACになったことをフックしたバックグラウンドGitプッシュ",
      "コミットメッセージの自動生成（例: 『[AC] ABC300-A N-choice question (C++)』）",
      "GitHub of プライベートリポジトリおよびパブリックリポジトリ双方への同期対応",
      "本番コンテスト中はセーフティロックにより保留され、終了後にバッチ処理で一括プッシュする機能"
    ],
    technical_specs: [
      "GitHub REST API Octokit integration",
      "Chrome Identity OAuth2 token management",
      "Secure encrypted storage for tokens"
    ],
    user_impact: "毎回のGit操作の手間を一切無くし、競技プログラミングの努力の成果を美しくGitHubポートフォリオとしてアピールできます。",
    verification: "AtCoderでACを取得した後、自身のGitHubリポジトリに十数秒以内に対象コードがコミットされ、緑の草が反映されることを確認します。",
    pts: 100
  },
  ac_distinction: {
    title: "自力・解説AC分類",
    phase: 2,
    prereqs: "前提条件: [Monaco エディタ埋込] の実装完了後",
    desc: "解いた問題が「自力AC」か「解説AC」かを記録し、エディタ上で区別できるようにします。提出結果やエディタ画面のセレクトボックスからいつでもステータス（自力AC / 解説AC / 未学習）を設定でき、問題一覧ページにもマークが反映されます。",
    key_features: [
      "提出がACになった際の、自力AC（デフォルト）の自動ステータス割り当て",
      "コンソール画面上の「解説ACに変更 🔄」ボタンによる簡単ステータス切り替え",
      "AtCoderのコンテスト問題一覧（Task List）での解説AC問題の横に 🔄 マークを自動表示",
      "chrome.storage.localを用いた問題ごとの解答ステータス保存"
    ],
    technical_specs: [
      "chrome.storage.local (ステータス保存)",
      "Status Switcher UI",
      "Task List DOM Injection script"
    ],
    user_impact: "自分が本当に自力で解けた問題と、解説を参考にした問題を明確に整理して、実力を客観的に把握できます。",
    verification: "エディタ画面でステータスを切り替えた際に保存されること、問題一覧ページで解説AC問題の横にマークが表示されることを確認します。",
    pts: 100
  }
};

// 実装済みの機能IDリスト (開発の進捗に合わせてここへIDを追加するだけで、進捗率やスコアボード、各カードの鍵マークが自動更新されます)
const completedSkills = ["monaco", "submit", "test", "template", "ac_distinction"];

function updateRoadmapProgress() {
  const totalFeatures = Object.keys(skillsDb).length;
  const totalPts = Object.values(skillsDb).reduce((sum, s) => sum + s.pts, 0);
  const earnedPts = completedSkills.reduce((sum, id) => sum + (skillsDb[id] ? skillsDb[id].pts : 0), 0);
  const pct = totalFeatures > 0 ? Math.round((completedSkills.length / totalFeatures) * 100) : 0;

  document.getElementById('scoreCompleted').textContent = completedSkills.length;
  document.getElementById('scorePoints').textContent = earnedPts + ' pts';
  document.getElementById('progressBar').style.width = pct + '%';

  // Update each node card
  Object.keys(skillsDb).forEach(id => {
    const el = document.getElementById('node-' + id);
    if (!el) return;
    const statusEl = el.querySelector('.node-status');
    if (completedSkills.includes(id)) {
      el.classList.remove('locked');
      el.classList.add('completed');
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#5cb85c">✓</span> 実装済';
        statusEl.classList.remove('status-locked');
        statusEl.classList.add('status-completed');
      }
    } else {
      el.classList.remove('completed');
      el.classList.add('locked');
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#999">🔒</span> 未実装';
        statusEl.classList.remove('status-completed');
        statusEl.classList.add('status-locked');
      }
    }
  });
}

// Connections definition: [from_node_id, to_node_id]
const connections = [
  ['node-monaco', 'node-template'],
  ['node-monaco', 'node-notes'],
  ['node-monaco', 'node-test'],
  ['node-test', 'node-submit'],
  ['node-test', 'node-customtest'],
  ['node-submit', 'node-dashboard'],
  ['node-submit', 'node-ac_distinction'],
  ['node-dashboard', 'node-error'],
  ['node-dashboard', 'node-export'],
  ['node-notes', 'node-library'],
  ['node-library', 'node-queue'],
  ['node-export', 'node-safety'],
  ['node-safety', 'node-autopush']
];

function drawConnections() {
  // Clear existing lines
  const svg = document.getElementById('treeSvg');
  const existingLines = svg.querySelectorAll('line, path');
  existingLines.forEach(el => el.remove());

  const wrapper = document.querySelector('.tree-wrapper');
  const wrapperRect = wrapper.getBoundingClientRect();
  const columns = Array.from(document.querySelectorAll('.tree-column'));

  connections.forEach(([fromId, toId]) => {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    if (!fromEl || !toEl) return;

    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const fromCol = columns.findIndex(col => col.contains(fromEl));
    const toCol = columns.findIndex(col => col.contains(toEl));

    // Soft colored stroke lines matching the source node phase in light mode
    let strokeColor = '#ccc';
    if (fromId === 'node-monaco' || fromId === 'node-test' || fromId === 'node-submit') {
      strokeColor = '#91d5ff'; // Phase 1: Soft Blue-Cyan
    } else if (fromId === 'node-notes' || fromId === 'node-template' || fromId === 'node-dashboard' || fromId === 'node-customtest') {
      strokeColor = '#b7eb8f'; // Phase 2: Soft Green
    } else if (fromId === 'node-library' || fromId === 'node-queue' || fromId === 'node-error' || fromId === 'node-export') {
      strokeColor = '#ffe58f'; // Phase 3: Soft Amber
    } else if (fromId === 'node-safety' || fromId === 'node-autopush') {
      strokeColor = '#d3adf7'; // Phase 4: Soft Purple
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    if (fromCol === toCol) {
      // Connections within the same column
      const colCards = Array.from(columns[fromCol].querySelectorAll('.skill-node'));
      const fromIndex = colCards.indexOf(fromEl);
      const toIndex = colCards.indexOf(toEl);

      if (Math.abs(fromIndex - toIndex) === 1) {
        // Adjacent vertical connection -> straight line from bottom of top card to top of bottom card
        const topEl = fromIndex < toIndex ? fromEl : toEl;
        const bottomEl = fromIndex < toIndex ? toEl : fromEl;
        const topRect = topEl.getBoundingClientRect();
        const bottomRect = bottomEl.getBoundingClientRect();

        const cx1 = topRect.left + topRect.width / 2 - wrapperRect.left;
        const cy1 = topRect.bottom - wrapperRect.top;
        const cx2 = bottomRect.left + bottomRect.width / 2 - wrapperRect.left;
        const cy2 = bottomRect.top - wrapperRect.top;

        path.setAttribute('d', `M ${cx1} ${cy1} L ${cx2} ${cy2}`);
      } else {
        // Non-adjacent vertical connection (e.g. monaco -> test) -> left-side rounded orthogonal C-bypass loop
        // Exits left horizontally, goes down in the padded margin, and enters left horizontally.
        const topEl = fromIndex < toIndex ? fromEl : toEl;
        const bottomEl = fromIndex < toIndex ? toEl : fromEl;
        const topRect = topEl.getBoundingClientRect();
        const bottomRect = bottomEl.getBoundingClientRect();

        const x1 = topRect.left - wrapperRect.left;
        const y1 = topRect.top + topRect.height / 2 - wrapperRect.top;
        const x2 = bottomRect.left - wrapperRect.left;
        const y2 = bottomRect.top + bottomRect.height / 2 - wrapperRect.top;
        
        const offset = 12;
        const r = 6;
        
        const x_arc1 = x1 - offset + r;
        const y_arc1 = y1 + r;
        const x_arc2 = x2 - offset + r;
        const y_arc2 = y2 - r;
        
        // Sweep: 0 for counter-clockwise curves (curving left-and-down, then down-and-right)
        const pathData = `M ${x1} ${y1} ` +
                         `L ${x_arc1} ${y1} ` +
                         `A ${r} ${r} 0 0 0 ${x1 - offset} ${y_arc1} ` +
                         `L ${x1 - offset} ${y_arc2} ` +
                         `A ${r} ${r} 0 0 0 ${x_arc2} ${y2} ` +
                         `L ${x2} ${y2}`;
        path.setAttribute('d', pathData);
      }
    } else {
      // Connections between different columns -> Rounded orthogonal path
      // This ensures that the line enters the destination card perfectly horizontally,
      // so the arrowhead and dashed line align flawlessly without any diagonal distortions.
      const x1 = fromRect.right - wrapperRect.left;
      const y1 = fromRect.top + fromRect.height / 2 - wrapperRect.top;
      const x2 = toRect.left - wrapperRect.left;
      const y2 = toRect.top + toRect.height / 2 - wrapperRect.top;

      const xm = (x1 + x2) / 2;
      const signY = Math.sign(y2 - y1);
      const r = Math.min(10, Math.abs(y2 - y1) / 2); // Corner radius, max 10px

      if (signY === 0) {
        // Straight horizontal line
        path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
      } else {
        const x_arc1 = xm - r;
        const y_arc1 = y1 + r * signY;
        const x_arc2 = xm + r;
        const y_arc2 = y2 - r * signY;
        
        // Sweep flags: 1 for clockwise, 0 for counter-clockwise
        const sweep1 = signY > 0 ? 1 : 0;
        const sweep2 = signY > 0 ? 0 : 1;
        
        const pathData = `M ${x1} ${y1} ` +
                         `L ${x_arc1} ${y1} ` +
                         `A ${r} ${r} 0 0 ${sweep1} ${xm} ${y_arc1} ` +
                         `L ${xm} ${y_arc2} ` +
                         `A ${r} ${r} 0 0 ${sweep2} ${x_arc2} ${y2} ` +
                         `L ${x2} ${y2}`;
        path.setAttribute('d', pathData);
      }
    }

    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '4,3');
    path.setAttribute('marker-end', 'url(#arrowhead)');
    svg.appendChild(path);
  });
}

function getPhaseName(phase) {
  switch (phase) {
    case 1: return 'Phase 1: 基本コーディング';
    case 2: return 'Phase 2: 提出・データ蓄積';
    case 3: return 'Phase 3: 分析・管理・出力';
    case 4: return 'Phase 4: 外部連携・セーフティ';
    default: return 'Phase ' + phase;
  }
}

// Modal Peek
function openPeek(id) {
  const data = skillsDb[id];
  if (!data) return;

  const isCompleted = completedSkills.includes(id);

  document.getElementById('peekTitle').textContent = data.title;
  document.getElementById('peekPrereqs').textContent = data.prereqs;
  document.getElementById('peekDesc').textContent = data.desc;

  // Update badges
  const phaseName = getPhaseName(data.phase);
  const phaseBadge = `<span class="badge badge-phase">${phaseName}</span>`;
  const ptsBadge = `<span class="badge badge-pts">${data.pts} PTS</span>`;
  const statusBadgeClass = isCompleted ? 'badge-status completed' : 'badge-status';
  const statusText = isCompleted ? '✓ 実装済' : '🔒 未実装';
  const statusBadge = `<span class="${statusBadgeClass}">${statusText}</span>`;
  document.getElementById('peekMetaRow').innerHTML = phaseBadge + ptsBadge + statusBadge;

  // Features checklist
  const featuresList = document.getElementById('peekFeatures');
  featuresList.innerHTML = '';
  data.key_features.forEach(f => {
    const li = document.createElement('li');
    li.textContent = f;
    featuresList.appendChild(li);
  });

  // Tech specs pills
  const techList = document.getElementById('peekTech');
  techList.innerHTML = '';
  data.technical_specs.forEach(t => {
    const span = document.createElement('span');
    span.className = 'tech-pill';
    span.textContent = t;
    techList.appendChild(span);
  });

  // User impact & metrics
  document.getElementById('peekImpact').textContent = data.user_impact;

  // Verification steps
  document.getElementById('peekVerification').textContent = data.verification;

  document.getElementById('overlay').style.display = 'block';
  document.getElementById('peekModal').style.display = 'block';
}

function closePeek() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('peekModal').style.display = 'none';
}

// Initialize
window.addEventListener('load', () => {
  updateRoadmapProgress();
  drawConnections();
});
window.addEventListener('resize', drawConnections);
