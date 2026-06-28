(function () {
  'use strict';

  // Parse contest ID from pathname
  const pathMatch = window.location.pathname.match(/\/contests\/([^/]+)\/tasks/);
  if (!pathMatch) return;

  const contestId = pathMatch[1];

  function init() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

    // Get all status keys for this contest
    chrome.storage.local.get(null, (allData) => {
      const data = allData || {};
      const editorialProblems = [];
      const prefix = `status:${contestId}:`;

      Object.keys(data).forEach((key) => {
        if (key.startsWith(prefix) && data[key] === 'editorial_ac') {
          const problemId = key.substring(prefix.length);
          editorialProblems.push(problemId);
        }
      });

      if (editorialProblems.length === 0) return;

      // Find all links to problems in the second column (problem names) of the tasks table
      const links = document.querySelectorAll('table tbody tr td:nth-child(2) a');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Match /contests/<contest_id>/tasks/<problem_id> (exclude submissions, editorial pages etc.)
        const match = href.match(new RegExp(`^\\/contests\\/${contestId}\\/tasks\\/([^/?#]+)$`));
        if (match) {
          const problemId = match[1];
          if (editorialProblems.includes(problemId)) {
            // Avoid duplicate badges if script runs multiple times
            const parent = link.parentNode;
            if (parent.querySelector('.ac-editorial-badge')) return;

            // Inject 🔄 mark next to the link
            const badge = document.createElement('span');
            badge.className = 'ac-editorial-badge';
            badge.textContent = '🔄';
            badge.style.marginLeft = '6px';
            badge.style.fontSize = '0.95em';
            badge.style.display = 'inline-block';
            badge.style.verticalAlign = 'middle';

            // Insert after the link element
            link.parentNode.insertBefore(badge, link.nextSibling);
          }
        }
      });
    });
  }

  // Run on page load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
