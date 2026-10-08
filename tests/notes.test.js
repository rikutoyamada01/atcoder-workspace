/**
 * @jest-environment jsdom
 */

const TagConstants = require('../src/lib/tag-constants');

describe('Learning Notes and Tags Module & Constants', () => {
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
            } else if (keys === null) {
              Object.assign(result, mockStorage);
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

  test('TagConstants legacyMap correctly maps Japanese tag names to unique i18n keys', () => {
    expect(TagConstants.LEGACY_TAG_MAP['二分探索']).toBe('tag_name_binary_search');
    expect(TagConstants.LEGACY_TAG_MAP['DP']).toBe('tag_name_dp');
    expect(TagConstants.LEGACY_TAG_MAP['コーナーケース']).toBe('tag_name_corner_case');
    expect(TagConstants.LEGACY_TAG_MAP['型キャスト・精度']).toBe('tag_name_cast_precision');
    expect(TagConstants.LEGACY_TAG_MAP['バグ埋め込み']).toBe('tag_name_bug_typo');
  });

  test('TagConstants preset tags are valid arrays with required id and descKey properties', () => {
    expect(Array.isArray(TagConstants.PRESET_METHOD_TAGS)).toBe(true);
    expect(Array.isArray(TagConstants.PRESET_CAUSE_TAGS)).toBe(true);
    expect(TagConstants.PRESET_METHOD_TAGS.length).toBeGreaterThan(0);
    expect(TagConstants.PRESET_CAUSE_TAGS.length).toBeGreaterThan(0);

    TagConstants.PRESET_METHOD_TAGS.forEach((tag) => {
      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('descKey');
      expect(tag.id).toMatch(/^tag_name_/);
      expect(tag.descKey).toMatch(/^tag_desc_/);
    });

    TagConstants.PRESET_CAUSE_TAGS.forEach((tag) => {
      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('descKey');
      expect(tag.id).toMatch(/^tag_name_/);
      expect(tag.descKey).toMatch(/^tag_desc_/);
    });
  });

  test('migrateTags logic seamlessly converts legacy tags array to clean i18n keys', () => {
    const rawTags = ['二分探索', 'DP', 'custom_tag_1'];
    const cleanTags = rawTags.map((t) => TagConstants.LEGACY_TAG_MAP[t] || t);

    expect(cleanTags).toEqual(['tag_name_binary_search', 'tag_name_dp', 'custom_tag_1']);
  });

  test('should store and retrieve problem notes and tags correctly from chrome.storage', async () => {
    const key = 'problem_notes:abc300:abc300_a';
    const testData = {
      tags: ['tag_name_binary_search', 'tag_name_corner_case'],
      note: 'N=1の例外処理に注意',
      updatedAt: Date.now(),
    };

    await new Promise((resolve) => chrome.storage.local.set({ [key]: testData }, resolve));
    const result = await new Promise((resolve) => chrome.storage.local.get([key], resolve));

    expect(result[key]).toBeDefined();
    expect(result[key].tags).toEqual(['tag_name_binary_search', 'tag_name_corner_case']);
    expect(result[key].note).toBe('N=1の例外処理に注意');
  });

  test('Preset method and cause tags contain non-empty lists matching expectations', () => {
    expect(TagConstants.PRESET_METHOD_TAGS.length).toBeGreaterThan(5);
    expect(TagConstants.PRESET_CAUSE_TAGS.length).toBeGreaterThan(5);
  });
});
