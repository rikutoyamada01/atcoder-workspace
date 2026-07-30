/**
 * AtCoder Workspace Pages & Articles - Shared Components (components.js)
 * Automatically adapts paths whether called from /pages/ or /pages/article/
 */
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const isInsideArticle = currentPath.includes('/article/') || currentPath.endsWith('glossary.html') || currentPath.endsWith('complexity.html');
  
  // Base path prefix relative to current file
  const basePages = isInsideArticle ? '../' : './';
  const baseArticle = isInsideArticle ? './' : 'article/';

  // Determine Active Link
  const isActive = (pageName) => {
    if (pageName === 'article.html' && (currentPath.endsWith('article.html') || currentPath.endsWith('pages/') || currentPath.endsWith('pages/index.html'))) return 'active';
    if (pageName === 'glossary.html' && currentPath.endsWith('glossary.html')) return 'active';
    if (pageName === 'complexity.html' && currentPath.endsWith('complexity.html')) return 'active';
    if (pageName === 'presentation.html' && currentPath.endsWith('presentation.html')) return 'active';
    if (pageName === 'roadmap.html' && currentPath.endsWith('roadmap.html')) return 'active';
    return '';
  };

  // Header Component HTML
  const headerHTML = `
    <nav class="navbar">
      <a class="navbar-brand" href="${basePages}article.html">AtCoder Workspace</a>
      <div class="navbar-links">
        <a class="nav-link ${isActive('article.html')}" href="${basePages}article.html">記事一覧</a>
        <a class="nav-link ${isActive('glossary.html')}" href="${baseArticle}glossary.html">用語辞典</a>
        <a class="nav-link ${isActive('complexity.html')}" href="${baseArticle}complexity.html">計算量ツール</a>
        <a class="nav-link ${isActive('presentation.html')}" href="${basePages}presentation.html">製品紹介</a>
        <a class="nav-link ${isActive('roadmap.html')}" href="${basePages}roadmap.html">ロードマップ</a>
      </div>
    </nav>
  `;

  // Footer Component HTML
  const footerHTML = `
    <footer>
      <p>AtCoder Workspace - MIT License | <a href="${basePages}article.html">記事一覧</a> | <a href="${baseArticle}glossary.html">用語辞典</a> | <a href="${baseArticle}complexity.html">計算量ツール</a> | <a href="${basePages}presentation.html">製品紹介</a> | <a href="${basePages}roadmap.html">ロードマップ</a> | <a href="${basePages}privacy.html">プライバシー</a> | <a href="https://github.com/rikutoyamada01/atcoder-workspace" target="_blank">GitHub</a></p>
    </footer>
  `;

  // Inject Header
  const headerTarget = document.getElementById('site-header') || document.querySelector('nav.navbar');
  if (headerTarget) {
    headerTarget.outerHTML = headerHTML;
  } else {
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
  }

  // Inject Footer
  const footerTarget = document.getElementById('site-footer') || document.querySelector('footer');
  if (footerTarget) {
    footerTarget.outerHTML = footerHTML;
  } else {
    document.body.insertAdjacentHTML('beforeend', footerHTML);
  }

  // Auto-inject MathJax 3 for rendering LaTeX math formulas
  if (!window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']]
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      }
    };
    const script = document.createElement('script');
    script.id = 'MathJax-script';
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    document.head.appendChild(script);
  }
});
