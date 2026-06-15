// 1. ロスタイム計算機のロジック
const inputProblems = document.getElementById('calc-problems');
const inputTests = document.getElementById('calc-tests');
const valCopypaste = document.getElementById('calc-val-copypaste');
const valTime = document.getElementById('calc-val-time');

function calculateSavedTime() {
  const problems = parseInt(inputProblems.value) || 0;
  const tests = parseInt(inputTests.value) || 0;
  
  // 計算モデル:
  // 年間想定コンテスト数: 50回
  const annualContests = 50;
  const totalProblems = problems * annualContests;
  
  // コピペ削減数: 
  // 1回のテストにつき平均3ケースのサンプルコピペが発生 (3 * tests)
  // コードのコピー(1回)、提出フォームへの貼り付け(1回)、計2回
  const copypastesSaved = totalProblems * (tests * 3 + 2);
  
  // 削減ロスタイム:
  // 手動テストコピペと目視判定にかかる往復コスト: 1回あたり25秒
  // コード提出タブ切り替えと待機にかかるコスト: 1回あたり15秒
  const secondsSaved = totalProblems * (tests * 25 + 15);
  const minutesSaved = Math.round(secondsSaved / 60);
  const hoursSaved = (minutesSaved / 60).toFixed(1);
  
  valCopypaste.textContent = copypastesSaved.toLocaleString() + ' 回';
  valTime.textContent = `${minutesSaved.toLocaleString()} 分 (約 ${hoursSaved} 時間)`;
}

if (inputProblems && inputTests) {
  inputProblems.addEventListener('input', calculateSavedTime);
  inputTests.addEventListener('input', calculateSavedTime);
  calculateSavedTime();
}

// 2. 機能説明カードと静的UIモックの連動強調表示 (Highlight Sync)
const cards = document.querySelectorAll('.feature-card');
const mockAtcoder = document.getElementById('mockAtcoderSide');
const mockEditor = document.getElementById('mockEditorArea');
const mockTestBtn = document.getElementById('mockTestBtn');
const mockConsole = document.getElementById('mockConsolePanel');

cards.forEach(card => {
  card.addEventListener('mouseenter', () => {
    const target = card.getAttribute('data-target');
    if (target === 'split') {
      mockAtcoder.classList.add('highlight-border-editor');
      mockEditor.classList.add('highlight-border-editor');
    } else if (target === 'test') {
      mockTestBtn.classList.add('highlight-border-test');
    } else if (target === 'console') {
      mockConsole.classList.add('highlight-border-console');
    }
  });
  card.addEventListener('mouseleave', () => {
    mockAtcoder.classList.remove('highlight-border-editor');
    mockEditor.classList.remove('highlight-border-editor');
    mockTestBtn.classList.remove('highlight-border-test');
    mockConsole.classList.remove('highlight-border-console');
  });
});
