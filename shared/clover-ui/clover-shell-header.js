const TEMPLATE = document.createElement('template');

TEMPLATE.innerHTML = `
<style>
  :host {
    display: block;
    width: 100%;
    --bg: #11141b;
    --surface: #171b25;
    --border: #303746;
    --text: #f5f6f8;
    --muted: #a5aab5;
    --gold: #ddb63a;
    --gold-soft: rgba(221, 182, 58, 0.10);
    --success: #63b783;
    --pending: #d8aa2f;
    --offline: #8b909a;
    --error: #e05b60;
    color-scheme: dark;
  }

  :host([theme="light"]) {
    --bg: #f5f6f8;
    --surface: #ffffff;
    --border: #d9dde5;
    --text: #171a20;
    --muted: #6f7682;
    --gold-soft: rgba(221, 182, 58, 0.12);
    color-scheme: light;
  }

  * { box-sizing: border-box; }

  .header {
    width: 100%;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding-top: env(safe-area-inset-top, 0px);
    color: var(--text);
  }

  .row {
    min-height: 76px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  button {
    font: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .control {
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--surface);
    color: var(--text);
  }

  .control:focus-visible,
  .home:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: 2px;
  }

  .control svg {
    width: 24px;
    height: 24px;
    display: block;
  }

  .menu {
    color: var(--muted);
  }

  .create {
    border-color: rgba(221, 182, 58, 0.60);
    background: var(--gold-soft);
    color: var(--gold);
  }

  .create:disabled {
    opacity: .45;
  }

  .identity {
    min-width: 0;
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .home {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--gold);
    display: grid;
    place-items: center;
  }

  .home svg {
    width: 30px;
    height: 30px;
    display: block;
  }

  .title {
    min-width: 0;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 21px;
    line-height: 1.05;
    font-weight: 760;
    letter-spacing: -0.02em;
    color: var(--text);
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
    word-break: normal;
    overflow-wrap: normal;
  }

  .actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sync {
    position: relative;
    color: var(--text);
  }

  .dot {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    border: 1.5px solid var(--surface);
    background: var(--offline);
  }

  .dot[data-state="synced"] { background: var(--success); }
  .dot[data-state="pending"] { background: var(--pending); }
  .dot[data-state="offline"] { background: var(--offline); }
  .dot[data-state="error"] { background: var(--error); }
  .dot[data-state="syncing"] { background: var(--pending); }

  .sync[data-state="syncing"] svg {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 380px) {
    .row {
      min-height: 72px;
      padding-left: 12px;
      padding-right: 12px;
      gap: 6px;
    }

    .control {
      width: 42px;
      height: 42px;
      flex-basis: 42px;
      border-radius: 13px;
    }

    .control svg {
      width: 23px;
      height: 23px;
    }

    .identity { gap: 8px; }

    .home,
    .home svg {
      width: 28px;
      height: 28px;
    }

    .home { flex-basis: 28px; }

    .title {
      font-size: 19px;
    }

    .actions { gap: 6px; }
  }
</style>

<header class="header">
  <div class="row">
    <button class="control menu" type="button" aria-label="Open Clover workspaces">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16"/>
      </svg>
    </button>

    <div class="identity">
      <button class="home" type="button" aria-label="Clover home">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#fff09a"/>
              <stop offset="38%" stop-color="#efcc58"/>
              <stop offset="100%" stop-color="#bd821c"/>
            </linearGradient>
          </defs>
          <g fill="url(#gold)">
            <path d="M50 49 30 30C18 18 23 5 35 5c7 0 12 4 15 10 3-6 8-10 15-10 12 0 17 13 5 25L50 49Z"/>
            <path d="M51 50 70 30c12-12 25-7 25 5 0 7-4 12-10 15 6 3 10 8 10 15 0 12-13 17-25 5L51 50Z"/>
            <path d="M50 51 70 70c12 12 7 25-5 25-7 0-12-4-15-10-3 6-8 10-15 10-12 0-17-13-5-25L50 51Z"/>
            <path d="M49 50 30 70C18 82 5 77 5 65c0-7 4-12 10-15-6-3-10-8-10-15C5 23 18 18 30 30L49 50Z"/>
          </g>
        </svg>
      </button>
      <h1 class="title"></h1>
    </div>

    <div class="actions">
      <button class="control create" type="button" aria-label="Create">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>

      <button class="control sync" type="button" aria-label="Sync" data-state="offline">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 7v5h-5"/>
          <path d="M4 17v-5h5"/>
          <path d="M6.3 8.2A7 7 0 0 1 18.4 6L20 7"/>
          <path d="M17.7 15.8A7 7 0 0 1 5.6 18L4 17"/>
        </svg>
        <span class="dot" data-state="offline" aria-hidden="true"></span>
      </button>

      <button class="control settings" type="button" aria-label="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2"/>
          <path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5 17 7M7 17l-1.5 1.5M18.5 18.5 17 17M7 7 5.5 5.5"/>
          <path d="M9.2 3.6 10 2h4l.8 1.6M20.4 9.2 22 10v4l-1.6.8M14.8 20.4 14 22h-4l-.8-1.6M3.6 14.8 2 14v-4l1.6-.8"/>
        </svg>
      </button>
    </div>
  </div>
</header>
`;

class CloverShellHeader extends HTMLElement {
  static get observedAttributes() {
    return ['workspace-name', 'sync-state', 'theme', 'create-disabled'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true));

    this.$title = this.shadowRoot.querySelector('.title');
    this.$sync = this.shadowRoot.querySelector('.sync');
    this.$dot = this.shadowRoot.querySelector('.dot');
    this.$create = this.shadowRoot.querySelector('.create');

    this.shadowRoot.querySelector('.menu').addEventListener('click', () => this.#emit('clover-menu'));
    this.shadowRoot.querySelector('.home').addEventListener('click', () => this.#emit('clover-home'));
    this.$create.addEventListener('click', () => this.#emit('clover-create'));
    this.$sync.addEventListener('click', () => this.#emit('clover-sync'));
    this.shadowRoot.querySelector('.settings').addEventListener('click', () => this.#emit('clover-settings'));
  }

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    this.#render();
  }

  #emit(name) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  #render() {
    if (!this.shadowRoot) return;

    const workspace = (this.getAttribute('workspace-name') || 'Clover').trim();
    this.$title.textContent = workspace;

    const allowedStates = new Set(['synced', 'syncing', 'pending', 'offline', 'error']);
    const state = allowedStates.has(this.getAttribute('sync-state'))
      ? this.getAttribute('sync-state')
      : 'offline';

    this.$sync.dataset.state = state;
    this.$dot.dataset.state = state;
    this.$sync.setAttribute('aria-label', `Sync status: ${state}`);

    this.$create.disabled = this.hasAttribute('create-disabled');
  }
}

if (!customElements.get('clover-shell-header')) {
  customElements.define('clover-shell-header', CloverShellHeader);
}
