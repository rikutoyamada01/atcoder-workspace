// Navigation and footer are static HTML so links are available without JavaScript.
document.addEventListener('DOMContentLoaded', () => {
  // Auto-inject MathJax 3 for rendering LaTeX math formulas
  if (document.querySelector('[data-math]') && !window.MathJax) {
    window.MathJax = {
      tex: {
        inlineMath: [
          ['$', '$'],
          ['\\(', '\\)'],
        ],
        displayMath: [
          ['$$', '$$'],
          ['\\[', '\\]'],
        ],
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      },
    };
    const script = document.createElement('script');
    script.id = 'MathJax-script';
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    document.head.appendChild(script);
  }
});
