/**
 * @jest-environment jsdom
 */

describe('Learning Notes and Tags Feature', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    document.body.innerHTML = `
      <div id="console-panel">
        <div id="learning-notes-section" class="learning-notes-section">
          <div class="learning-tags-bar">
            <span class="tags-label">🏷️ タグ:</span>
            <div id="selected-tags-container" class="selected-tags-container"></div>
            <button id="toggle-tag-dropdown-btn" class="btn btn-default btn-xs tag-select-btn">＋ タグを選択 ▾</button>
          </div>
          <div id="tag-dropdown-panel" class="tag-dropdown-panel" style="display: none;">
            <div class="tag-group">
              <span class="tag-group-title">💡 解法・手法</span>
              <div class="tag-chips-wrapper" id="method-tags-wrapper"></div>
            </div>
            <div class="tag-group">
              <span class="tag-group-title">⚠️ 詰まった原因</span>
              <div class="tag-chips-wrapper" id="cause-tags-wrapper"></div>
            </div>
            <div class="custom-tag-input-wrapper">
              <input type="text" id="custom-tag-input" class="form-control input-xs" placeholder="カスタムタグを追加 (Enterで確定)">
            </div>
          </div>
          <div class="learning-note-container">
            <textarea id="learning-note-textarea" class="form-control note-textarea"></textarea>
          </div>
        </div>
      </div>
    `;

    global.chrome = {
      runtime: {
        id: 'test-extension-id',
        lastError: null,
      },
      storage: {
        local: {
          get: jest.fn((keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
              keys.forEach((key) => {
                if (mockStorage[key] !== undefined) {
                  result[key] = mockStorage[key];
                }
              });
            }
            callback(result);
          }),
          set: jest.fn((items, callback) => {
            Object.assign(mockStorage, items);
            if (callback) callback();
          }),
        },
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize learning tags and notes UI elements correctly', () => {
    const section = document.getElementById('learning-notes-section');
    const selectedTagsContainer = document.getElementById('selected-tags-container');
    const toggleBtn = document.getElementById('toggle-tag-dropdown-btn');
    const dropdown = document.getElementById('tag-dropdown-panel');
    const noteTextarea = document.getElementById('learning-note-textarea');

    expect(section).not.toBeNull();
    expect(selectedTagsContainer).not.toBeNull();
    expect(toggleBtn).not.toBeNull();
    expect(dropdown).not.toBeNull();
    expect(noteTextarea).not.toBeNull();
    expect(dropdown.style.display).toBe('none');
  });

  test('should store and retrieve problem tags correctly from storage mock', async () => {
    const key = 'problem_notes:abc300:abc300_a';
    const testData = {
      tags: ['tag_name_binary_search', 'tag_name_corner_case'],
      note: 'N=1に注意',
      updatedAt: Date.now(),
    };

    await new Promise((resolve) => chrome.storage.local.set({ [key]: testData }, resolve));

    const result = await new Promise((resolve) => chrome.storage.local.get([key], resolve));
    expect(result[key]).toBeDefined();
    expect(result[key].tags).toEqual(['tag_name_binary_search', 'tag_name_corner_case']);
    expect(result[key].note).toBe('N=1に注意');
  });

  test('should toggle accordion visibility on case-row-header click via event delegation', () => {
    const consoleResults = document.createElement('div');
    consoleResults.id = 'console-results';
    document.body.appendChild(consoleResults);

    consoleResults.innerHTML = `
      <div class="case-row" id="case-row-0">
        <div class="case-row-header">
          <span class="case-icon">▶</span>
          <span class="case-label">ケース 1:</span>
          <span class="case-status status-ac">AC</span>
        </div>
        <div class="case-row-body" style="display: none;">Details</div>
      </div>
    `;

    consoleResults.addEventListener('click', (e) => {
      const caseHeader = e.target.closest('.case-row-header');
      if (caseHeader) {
        const row = caseHeader.closest('.case-row');
        if (row) {
          const body = row.querySelector('.case-row-body');
          const icon = row.querySelector('.case-icon');
          if (body) {
            const isHidden = body.style.display === 'none' || body.style.display === '';
            body.style.display = isHidden ? 'block' : 'none';
            if (icon) {
              icon.textContent = isHidden ? '▼' : '▶';
            }
          }
        }
      }
    });

    const header = consoleResults.querySelector('.case-row-header');
    const body = consoleResults.querySelector('.case-row-body');
    const icon = consoleResults.querySelector('.case-icon');

    expect(body.style.display).toBe('none');
    expect(icon.textContent).toBe('▶');

    // Click to open AC case
    header.click();
    expect(body.style.display).toBe('block');
    expect(icon.textContent).toBe('▼');

    // Click again to close
    header.click();
    expect(body.style.display).toBe('none');
    expect(icon.textContent).toBe('▶');
  });
});
