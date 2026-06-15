(function () {
  'use strict';

  function tryRender() {
    if (!window.turnstile) return false;

    // Wait for the layout restructuring to complete if main-container exists
    const mainContainer = document.getElementById('main-container');
    const wrapper = document.getElementById('atcoder-workspace-wrapper');
    if (mainContainer && !wrapper) return false;

    const container = document.querySelector(
      '.cf-challenge[data-sitekey], .cf-turnstile[data-sitekey]'
    );
    if (!container) return false;

    // If it already has an iframe, check if it was implicitly rendered before reparenting
    if (container.querySelector('iframe')) {
      if (
        container.dataset.turnstileStatus === 'force-rendered' ||
        container.dataset.turnstileStatus === 'auto-rendered'
      ) {
        return true; // Already successfully rendered and marked by us
      }

      // If an iframe is present but no status is marked, it was implicitly rendered
      // before DOM restructuring. Moving the container inside the wrapper makes
      // the iframe turn blank/white. We must reset and re-render it.
      try {
        if (window.turnstile.reset) {
          window.turnstile.reset(container);
          console.log('[AtCoder Workspace] Turnstile reset due to DOM reparenting');
        }
        const iframe = container.querySelector('iframe');
        if (iframe) {
          iframe.remove();
        }
      } catch (e) {
        console.warn('[AtCoder Workspace] Turnstile reset failed:', e);
      }
    }

    try {
      const sitekey = container.getAttribute('data-sitekey');
      // If turnstile.render function is fully loaded, call it directly.
      // Do NOT use turnstile.ready() as it throws TurnstileError when api.js is loaded with async/defer.
      if (typeof window.turnstile.render === 'function') {
        window.turnstile.render(container, { sitekey: sitekey });
        container.dataset.turnstileStatus = 'force-rendered';
        console.log('[AtCoder Workspace] Turnstile render triggered via MAIN world injection');
        return true;
      }
      return false; // Not fully initialized yet, poll again
    } catch (e) {
      console.warn('[AtCoder Workspace] Turnstile render error:', e);
      return false;
    }
  }

  // Poll regularly until Turnstile is rendered successfully
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds
  const interval = setInterval(() => {
    attempts++;
    if (tryRender()) {
      clearInterval(interval);
    }
    if (attempts >= maxAttempts) {
      clearInterval(interval);
    }
  }, 500);
})();
