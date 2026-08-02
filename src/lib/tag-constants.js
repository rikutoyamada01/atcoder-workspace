(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.TagConstants = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LEGACY_TAG_MAP = {
    '二分探索': 'tag_name_binary_search',
    'DP': 'tag_name_dp',
    '累積和': 'tag_name_prefix_sum',
    'BFS/DFS': 'tag_name_bfs_dfs',
    '尺取り法': 'tag_name_two_pointers',
    'UnionFind': 'tag_name_union_find',
    '貪欲法': 'tag_name_greedy',
    '数学・考察': 'tag_name_math',
    '全探索': 'tag_name_full_search',
    'グラフ': 'tag_name_graph',
    'コーナーケース': 'tag_name_corner_case',
    'オーバーフロー': 'tag_name_overflow',
    '型キャスト・精度': 'tag_name_cast_precision',
    'TLE(計算量)': 'tag_name_tle',
    '配列外参照/RE': 'tag_name_re',
    '初期化忘れ': 'tag_name_uninitialized',
    '実装重め': 'tag_name_heavy_impl',
    'バグ埋め込み': 'tag_name_bug_typo',
  };

  const PRESET_METHOD_TAGS = [
    { id: 'tag_name_binary_search', descKey: 'tag_desc_binary_search' },
    { id: 'tag_name_dp', descKey: 'tag_desc_dp' },
    { id: 'tag_name_prefix_sum', descKey: 'tag_desc_prefix_sum' },
    { id: 'tag_name_bfs_dfs', descKey: 'tag_desc_bfs_dfs' },
    { id: 'tag_name_two_pointers', descKey: 'tag_desc_two_pointers' },
    { id: 'tag_name_union_find', descKey: 'tag_desc_union_find' },
    { id: 'tag_name_greedy', descKey: 'tag_desc_greedy' },
    { id: 'tag_name_math', descKey: 'tag_desc_math' },
    { id: 'tag_name_full_search', descKey: 'tag_desc_full_search' },
    { id: 'tag_name_graph', descKey: 'tag_desc_graph' },
  ];

  const PRESET_CAUSE_TAGS = [
    { id: 'tag_name_corner_case', descKey: 'tag_desc_corner_case' },
    { id: 'tag_name_overflow', descKey: 'tag_desc_overflow' },
    { id: 'tag_name_cast_precision', descKey: 'tag_desc_cast_precision' },
    { id: 'tag_name_tle', descKey: 'tag_desc_tle' },
    { id: 'tag_name_re', descKey: 'tag_desc_re' },
    { id: 'tag_name_uninitialized', descKey: 'tag_desc_uninitialized' },
    { id: 'tag_name_heavy_impl', descKey: 'tag_desc_heavy_impl' },
    { id: 'tag_name_bug_typo', descKey: 'tag_desc_bug_typo' },
  ];

  function getTagDisplayName(tagName, i18nProvider) {
    if (!tagName) return '';
    if (i18nProvider && typeof i18nProvider.t === 'function') {
      const translated = i18nProvider.t(tagName);
      if (translated && translated !== tagName) return translated;
    }
    return tagName;
  }

  return {
    LEGACY_TAG_MAP,
    PRESET_METHOD_TAGS,
    PRESET_CAUSE_TAGS,
    getTagDisplayName,
  };
}));
