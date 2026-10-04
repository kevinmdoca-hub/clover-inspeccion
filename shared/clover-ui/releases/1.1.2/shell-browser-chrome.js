/* Clover MI browser-chrome adapter 1.1.2. No authentication or data writes. */
(() => {
  'use strict';
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const initialMeta = meta?.content || '#050608';
  let queued = false;
  function sync() {
    queued = false;
    const header = document.querySelector('#shell clover-shell-header');
    const active = header && !header.hidden && !document.body.classList.contains('auth-active');
    if (!active) {
      root.removeAttribute('data-clover-browser-theme');
      if (meta && meta.content !== initialMeta) meta.content = initialMeta;
      return;
    }
    const theme = header.getAttribute('theme') === 'light' ? 'light' : 'dark';
    // These are the unchanged 1.1.x shared-header surface tokens, not page-content colors.
    const color = theme === 'light' ? '#f5f6f8' : '#11141b';
    if (root.dataset.cloverBrowserTheme !== theme) root.dataset.cloverBrowserTheme = theme;
    if (meta && meta.content !== color) meta.content = color;
  }
  function schedule() {
    if (!queued) { queued = true; queueMicrotask(sync); }
  }
  const shell = document.getElementById('shell');
  if (shell) new MutationObserver(schedule).observe(shell, {
    childList:true, subtree:true, attributes:true, attributeFilter:['theme','hidden']
  });
  new MutationObserver(schedule).observe(document.body, {
    attributes:true, attributeFilter:['class']
  });
  new MutationObserver(schedule).observe(root, {
    attributes:true, attributeFilter:['data-theme']
  });
  window.addEventListener('pageshow', schedule);
  sync();
})();
