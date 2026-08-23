const DashboardStats = require('../src/lib/dashboard-stats');

describe('DashboardStats Module', () => {
  describe('getContestType', () => {
    test('classifies standard contest prefixes correctly', () => {
      expect(DashboardStats.getContestType('abc300')).toBe('abc');
      expect(DashboardStats.getContestType('ABC123')).toBe('abc');
      expect(DashboardStats.getContestType('arc100')).toBe('arc');
      expect(DashboardStats.getContestType('agc050')).toBe('agc');
      expect(DashboardStats.getContestType('ahc001')).toBe('ahc');
      expect(DashboardStats.getContestType('typical90')).toBe('other');
      expect(DashboardStats.getContestType('dp')).toBe('other');
      expect(DashboardStats.getContestType('')).toBe('other');
      expect(DashboardStats.getContestType(null)).toBe('other');
    });
  });

  describe('calculateDashboardStats', () => {
    test('handles empty or null storage data safely', () => {
      const stats = DashboardStats.calculateDashboardStats(null);
      expect(stats.summary.totalTracked).toBe(0);
      expect(stats.summary.totalAc).toBe(0);
      expect(stats.summary.selfAcCount).toBe(0);
      expect(stats.summary.selfAcRate).toBe(0);
      expect(stats.summary.editorialAcCount).toBe(0);
      expect(stats.summary.editorialAcRate).toBe(0);
      expect(stats.summary.unsolvedCount).toBe(0);
      expect(stats.summary.noteProblemCount).toBe(0);
      expect(stats.methodBreakdown).toEqual([]);
      expect(stats.causeBreakdown).toEqual([]);
      expect(stats.contestDistribution).toHaveLength(5);
    });

    test('calculates summary KPIs with mixed AC and unsolved problems', () => {
      const mockData = {
        'stats:ac_problems': ['abc300:abc300_a', 'abc300:abc300_b', 'arc100:arc100_a'],
        'status:abc300:abc300_a': 'self_ac',
        'status:abc300:abc300_b': 'editorial_ac',
        'status:arc100:arc100_a': 'self_ac',
        'status:agc001:agc001_a': 'unsolved',
      };

      const stats = DashboardStats.calculateDashboardStats(mockData);

      expect(stats.summary.totalTracked).toBe(4);
      expect(stats.summary.totalAc).toBe(3);
      expect(stats.summary.selfAcCount).toBe(2);
      expect(stats.summary.selfAcRate).toBe(67); // 2/3 ≈ 67%
      expect(stats.summary.editorialAcCount).toBe(1);
      expect(stats.summary.editorialAcRate).toBe(33); // 1/3 ≈ 33%
      expect(stats.summary.unsolvedCount).toBe(1);
    });

    test('classifies method and cause tags correctly and sorts descending by count', () => {
      const mockData = {
        'stats:ac_problems': ['abc300:abc300_a', 'abc300:abc300_b', 'abc300:abc300_c'],
        'problem_notes:abc300:abc300_a': {
          note: 'DP state formulation',
          tags: ['tag_name_dp', 'tag_name_corner_case'],
        },
        'problem_notes:abc300:abc300_b': {
          note: 'Binary search over answers',
          tags: ['tag_name_binary_search', 'tag_name_dp', 'tag_name_corner_case'],
        },
        'problem_notes:abc300:abc300_c': {
          note: 'Overflow issue with 64bit int',
          tags: ['tag_name_overflow', 'tag_name_dp'],
        },
      };

      const stats = DashboardStats.calculateDashboardStats(mockData);

      expect(stats.summary.noteProblemCount).toBe(3);
      expect(stats.totalMethodTags).toBe(4); // 3 DP + 1 Binary Search
      expect(stats.totalCauseTags).toBe(3); // 2 Corner Case + 1 Overflow

      // Method ranking: DP (3, 75%), Binary Search (1, 25%)
      expect(stats.methodBreakdown[0]).toEqual({
        tagId: 'tag_name_dp',
        count: 3,
        percentage: 75,
      });
      expect(stats.methodBreakdown[1]).toEqual({
        tagId: 'tag_name_binary_search',
        count: 1,
        percentage: 25,
      });

      // Cause ranking: Corner Case (2, 67%), Overflow (1, 33%)
      expect(stats.causeBreakdown[0]).toEqual({
        tagId: 'tag_name_corner_case',
        count: 2,
        percentage: 67,
        hintKey: 'dashboard_hint_corner_case',
      });
      expect(stats.causeBreakdown[1]).toEqual({
        tagId: 'tag_name_overflow',
        count: 1,
        percentage: 33,
        hintKey: 'dashboard_hint_overflow',
      });
    });

    test('supports legacy Japanese tag migration during statistics calculation', () => {
      const mockData = {
        'stats:ac_problems': ['abc300:abc300_a'],
        'problem_notes:abc300:abc300_a': {
          tags: ['二分探索', 'コーナーケース'],
        },
      };

      const stats = DashboardStats.calculateDashboardStats(mockData);
      expect(stats.methodBreakdown[0].tagId).toBe('tag_name_binary_search');
      expect(stats.causeBreakdown[0].tagId).toBe('tag_name_corner_case');
    });

    test('accurately aggregates contest distribution', () => {
      const mockData = {
        'stats:ac_problems': [
          'abc300:abc300_a',
          'abc300:abc300_b',
          'arc100:arc100_a',
          'agc001:agc001_a',
          'ahc001:ahc001_a',
          'past2020:past_a',
        ],
        'status:abc300:abc300_a': 'self_ac',
        'status:abc300:abc300_b': 'editorial_ac',
        'status:arc100:arc100_a': 'self_ac',
        'status:agc001:agc001_a': 'self_ac',
        'status:ahc001:ahc001_a': 'self_ac',
        'status:past2020:past_a': 'self_ac',
      };

      const stats = DashboardStats.calculateDashboardStats(mockData);
      const abc = stats.contestDistribution.find((c) => c.type === 'abc');
      const arc = stats.contestDistribution.find((c) => c.type === 'arc');
      const agc = stats.contestDistribution.find((c) => c.type === 'agc');
      const ahc = stats.contestDistribution.find((c) => c.type === 'ahc');
      const other = stats.contestDistribution.find((c) => c.type === 'other');

      expect(abc).toEqual({ type: 'abc', label: 'ABC', total: 2, ac: 2, selfAc: 1, editorialAc: 1 });
      expect(arc).toEqual({ type: 'arc', label: 'ARC', total: 1, ac: 1, selfAc: 1, editorialAc: 0 });
      expect(agc).toEqual({ type: 'agc', label: 'AGC', total: 1, ac: 1, selfAc: 1, editorialAc: 0 });
      expect(ahc).toEqual({ type: 'ahc', label: 'AHC', total: 1, ac: 1, selfAc: 1, editorialAc: 0 });
      expect(other).toEqual({ type: 'other', label: 'Others', total: 1, ac: 1, selfAc: 1, editorialAc: 0 });
    });
  });
});
