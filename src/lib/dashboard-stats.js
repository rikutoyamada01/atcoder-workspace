(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./tag-constants'], factory);
  } else if (typeof module === 'object' && module.exports) {
    const TagConstants = require('./tag-constants');
    module.exports = factory(TagConstants);
  } else {
    root.DashboardStats = factory(root.TagConstants);
  }
}(typeof self !== 'undefined' ? self : this, function (TagConstants) {
  'use strict';

  const CAUSE_HINTS = {
    tag_name_corner_case: 'dashboard_hint_corner_case',
    tag_name_overflow: 'dashboard_hint_overflow',
    tag_name_cast_precision: 'dashboard_hint_cast_precision',
    tag_name_tle: 'dashboard_hint_tle',
    tag_name_re: 'dashboard_hint_re',
    tag_name_uninitialized: 'dashboard_hint_uninitialized',
    tag_name_heavy_impl: 'dashboard_hint_heavy_impl',
    tag_name_bug_typo: 'dashboard_hint_bug_typo',
  };

  /**
   * Determine contest category from contest ID string.
   */
  function getContestType(contestId) {
    if (!contestId) return 'other';
    const lower = contestId.toLowerCase();
    if (lower.startsWith('abc')) return 'abc';
    if (lower.startsWith('arc')) return 'arc';
    if (lower.startsWith('agc')) return 'agc';
    if (lower.startsWith('ahc')) return 'ahc';
    return 'other';
  }

  /**
   * Pure aggregation function for learning dashboard statistics.
   * @param {Object} storageData - raw data from chrome.storage.local
   * @returns {Object} Calculated stats
   */
  function calculateDashboardStats(storageData) {
    const data = storageData || {};
    const acProblems = Array.isArray(data['stats:ac_problems']) ? data['stats:ac_problems'] : [];
    const legacyMap = (TagConstants && TagConstants.LEGACY_TAG_MAP) || {};
    const methodPresets = (TagConstants && TagConstants.PRESET_METHOD_TAGS) || [];
    const causePresets = (TagConstants && TagConstants.PRESET_CAUSE_TAGS) || [];

    const methodSet = new Set(methodPresets.map((p) => p.id));
    const causeSet = new Set(causePresets.map((p) => p.id));

    // 1. Collect all unique problem keys
    const problemKeySet = new Set();
    acProblems.forEach((p) => {
      if (typeof p === 'string' && p.includes(':')) problemKeySet.add(p);
    });

    Object.keys(data).forEach((key) => {
      if (key.startsWith('status:')) {
        const parts = key.split(':');
        if (parts.length === 3) {
          problemKeySet.add(`${parts[1]}:${parts[2]}`);
        }
      } else if (key.startsWith('problem_notes:')) {
        const parts = key.split(':');
        if (parts.length === 3 && parts[1] !== 'global') {
          problemKeySet.add(`${parts[1]}:${parts[2]}`);
        }
      }
    });

    const allProblems = Array.from(problemKeySet);
    let selfAcCount = 0;
    let editorialAcCount = 0;
    let unsolvedCount = 0;
    let noteProblemCount = 0;

    const methodTagCounts = {};
    const causeTagCounts = {};
    let totalMethodTags = 0;
    let totalCauseTags = 0;

    const contestTypeMap = {
      abc: { total: 0, ac: 0, selfAc: 0, editorialAc: 0 },
      arc: { total: 0, ac: 0, selfAc: 0, editorialAc: 0 },
      agc: { total: 0, ac: 0, selfAc: 0, editorialAc: 0 },
      ahc: { total: 0, ac: 0, selfAc: 0, editorialAc: 0 },
      other: { total: 0, ac: 0, selfAc: 0, editorialAc: 0 },
    };

    allProblems.forEach((problemKey) => {
      const parts = problemKey.split(':');
      if (parts.length < 2) return;
      const contestId = parts[0];
      const problemId = parts[1];
      const cType = getContestType(contestId);

      contestTypeMap[cType].total += 1;

      // Status resolution
      const statusKey = `status:${contestId}:${problemId}`;
      let status = data[statusKey];
      if (!status) {
        status = acProblems.includes(problemKey) ? 'self_ac' : 'unsolved';
      }

      const isAc = status === 'self_ac' || status === 'editorial_ac';
      if (isAc) {
        contestTypeMap[cType].ac += 1;
      }

      if (status === 'self_ac') {
        selfAcCount += 1;
        contestTypeMap[cType].selfAc += 1;
      } else if (status === 'editorial_ac') {
        editorialAcCount += 1;
        contestTypeMap[cType].editorialAc += 1;
      } else {
        unsolvedCount += 1;
      }

      // Note & Tag resolution
      const noteKey = `problem_notes:${contestId}:${problemId}`;
      const noteData = data[noteKey];
      let hasNoteOrTag = false;

      if (noteData) {
        if (typeof noteData.note === 'string' && noteData.note.trim().length > 0) {
          hasNoteOrTag = true;
        }

        if (Array.isArray(noteData.tags) && noteData.tags.length > 0) {
          hasNoteOrTag = true;
          noteData.tags.forEach((rawTag) => {
            const tag = legacyMap[rawTag] || rawTag;
            if (!tag) return;

            if (causeSet.has(tag)) {
              causeTagCounts[tag] = (causeTagCounts[tag] || 0) + 1;
              totalCauseTags += 1;
            } else if (methodSet.has(tag)) {
              methodTagCounts[tag] = (methodTagCounts[tag] || 0) + 1;
              totalMethodTags += 1;
            } else {
              // Custom / unclassified tags default to method category
              methodTagCounts[tag] = (methodTagCounts[tag] || 0) + 1;
              totalMethodTags += 1;
            }
          });
        }
      }

      if (hasNoteOrTag) {
        noteProblemCount += 1;
      }
    });

    const totalTracked = allProblems.length;
    const totalAc = selfAcCount + editorialAcCount;
    const selfAcRate = totalAc > 0 ? Math.round((selfAcCount / totalAc) * 100) : 0;
    const editorialAcRate = totalAc > 0 ? Math.round((editorialAcCount / totalAc) * 100) : 0;

    // Convert method tags to sorted list
    const methodBreakdown = Object.keys(methodTagCounts)
      .map((tagId) => ({
        tagId,
        count: methodTagCounts[tagId],
        percentage: totalMethodTags > 0 ? Math.round((methodTagCounts[tagId] / totalMethodTags) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Convert cause tags to sorted list with hints
    const causeBreakdown = Object.keys(causeTagCounts)
      .map((tagId) => ({
        tagId,
        count: causeTagCounts[tagId],
        percentage: totalCauseTags > 0 ? Math.round((causeTagCounts[tagId] / totalCauseTags) * 100) : 0,
        hintKey: CAUSE_HINTS[tagId] || null,
      }))
      .sort((a, b) => b.count - a.count);

    const contestDistribution = [
      { type: 'abc', label: 'ABC', total: contestTypeMap.abc.total, ac: contestTypeMap.abc.ac, selfAc: contestTypeMap.abc.selfAc, editorialAc: contestTypeMap.abc.editorialAc },
      { type: 'arc', label: 'ARC', total: contestTypeMap.arc.total, ac: contestTypeMap.arc.ac, selfAc: contestTypeMap.arc.selfAc, editorialAc: contestTypeMap.arc.editorialAc },
      { type: 'agc', label: 'AGC', total: contestTypeMap.agc.total, ac: contestTypeMap.agc.ac, selfAc: contestTypeMap.agc.selfAc, editorialAc: contestTypeMap.agc.editorialAc },
      { type: 'ahc', label: 'AHC', total: contestTypeMap.ahc.total, ac: contestTypeMap.ahc.ac, selfAc: contestTypeMap.ahc.selfAc, editorialAc: contestTypeMap.ahc.editorialAc },
      { type: 'other', label: 'Others', total: contestTypeMap.other.total, ac: contestTypeMap.other.ac, selfAc: contestTypeMap.other.selfAc, editorialAc: contestTypeMap.other.editorialAc },
    ];

    return {
      summary: {
        totalTracked,
        totalAc,
        selfAcCount,
        selfAcRate,
        editorialAcCount,
        editorialAcRate,
        unsolvedCount,
        noteProblemCount,
      },
      methodBreakdown,
      causeBreakdown,
      contestDistribution,
      totalMethodTags,
      totalCauseTags,
    };
  }

  return {
    CAUSE_HINTS,
    getContestType,
    calculateDashboardStats,
  };
}));
