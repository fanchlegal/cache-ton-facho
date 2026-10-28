(() => {
  'use strict';

  // Chrome expose l'API « chrome », Firefox « browser » (les deux renvoient des promesses en MV3)
  const api = globalThis.browser ?? globalThis.chrome;

  const DEFAULTS = {
    accounts: [],          // pseudos à cacher (sans @, en minuscules)
    keywords: [],          // mots, hashtags, emojis
    color: '#2b2b33',      // couleur du carré
    labelMode: 'reason',   // 'none' | 'text' | 'reason' (texte + raison)
    labelText: 'Post masqué',
    allowReveal: true,     // clic sur le carré pour afficher le post
    showButton: true,      // bouton 🙈 sur chaque post
    useRemote: false,      // utiliser les listes partagées
    remoteData: {},        // { url: { accounts: [...] } }, rempli par background.js
    exceptions: []         // comptes des listes partagées que l'utilisateur ne veut pas cacher
  };

  let settings = { ...DEFAULTS };
  let accountSet = new Set();
  let remoteSet = new Set();
  let matchers = [];
  const revealed = new WeakSet(); // posts affichés à la demande (jusqu'au rechargement)

  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cleanUser = (s) => (s || '').trim()
    .replace(/^https?:\/\/(www\.)?threads\.(com|net)\//i, '')
    .replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();

  // ---------- Réglages ----------

  function compile() {
    accountSet = new Set((settings.accounts || []).map(cleanUser).filter(Boolean));
    const exceptions = new Set((settings.exceptions || []).map(cleanUser));
    remoteSet = new Set();
    if (settings.useRemote) {
      for (const list of Object.values(settings.remoteData || {})) {
        for (const u of list.accounts || []) if (!exceptions.has(u) && !accountSet.has(u)) remoteSet.add(u);
      }
    }
    matchers = (settings.keywords || [])
      .map((k) => k.trim())
      .filter(Boolean)
      .map((raw) => {
        const k = norm(raw);
        // Mots "normaux" : mot entier ; emojis / symboles / hashtags : simple présence
        if (/^[\p{L}\p{N}_ '-]+$/u.test(k)) {
          return { raw, re: new RegExp(`(^|[^\\p{L}\\p{N}_])${escapeRe(k)}(?=$|[^\\p{L}\\p{N}_])`, 'u') };
        }
        return { raw, sub: k };
      });
  }

  async function load() {
    settings = { ...DEFAULTS, ...(await api.storage.local.get(DEFAULTS)) };
    compile();
  }

  api.storage.onChanged.addListener(async (_changes, area) => {
    if (area !== 'local') return;
    await load();
    scan();
  });

  async function addException(u) {
    settings.exceptions = [...new Set([...(settings.exceptions || []), cleanUser(u)])];
    await api.storage.local.set({ exceptions: settings.exceptions });
  }

  async function setAccounts(list) {
    settings.accounts = [...new Set(list.map(cleanUser).filter(Boolean))];
    await api.storage.local.set({ accounts: settings.accounts });
  }

  // ---------- Détection ----------

  // Auteur du post : le pseudo sur la ligne de l'heure (sur un repost, le premier lien
  // est celui qui a republié, pas l'auteur)
  function usernameFromPost(post) {
    const t = post.querySelector('time');
    if (t) {
      let x = t.parentElement;
      for (let i = 0; i < 8 && x && x !== post.parentElement; i++, x = x.parentElement) {
        for (const a of x.querySelectorAll('a[href*="/@"]')) {
          if (a.closest('.cth-ui')) continue;
          const m = (a.getAttribute('href') || '').match(/\/@([\w.]+)\/?$/);
          if (m && a.textContent.trim()) return m[1];
        }
      }
    }
    return firstUser(post);
  }

  // Premier compte cité dans le post (sur un repost : celui qui a republié)
  function firstUser(post) {
    for (const a of post.querySelectorAll('a[href*="/@"]')) {
      if (a.closest('.cth-ui')) continue;
      const m = (a.getAttribute('href') || '').match(/\/@([\w.]+)/);
      if (m) return m[1];
    }
    return null;
  }

  // Ton propre compte (lien « Profil » du menu de gauche), pour ne pas mettre de boutons sur tes posts
  let ownUserCache = null;
  function ownUser() {
    if (ownUserCache) return ownUserCache;
    for (const a of document.querySelectorAll('nav a[href^="/@"], [role="navigation"] a[href^="/@"]')) {
      const m = (a.getAttribute('href') || '').match(/^\/@([\w.]+)\/?$/);
      if (m) return (ownUserCache = m[1]);
    }
    return null;
  }


  // Texte du post sans nos propres éléments (sinon le libellé du carré s'auto-détecterait)
  function textOf(post) {
    let out = '';
    const walker = document.createTreeWalker(post, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest('.cth-ui') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    while (walker.nextNode()) out += walker.currentNode.nodeValue + ' ';
    for (const img of post.querySelectorAll('img[alt]')) out += img.alt + ' ';
    return out;
  }

  const listedWhere = (u) => {
    const k = u.toLowerCase();
    return accountSet.has(k) ? 'mine' : remoteSet.has(k) ? 'remote' : null;
  };

  function reasonFor(post, u) {
    const reposter = firstUser(post);
    for (const who of [u, reposter !== u ? reposter : null]) {
      if (!who) continue;
      const where = listedWhere(who);
      if (where === 'mine') return `@${who}`;
      if (where === 'remote') return `@${who} (liste partagée)`;
    }
    if (!matchers.length) return null;
    const t = norm(textOf(post));
    for (const m of matchers) {
      if (m.re ? m.re.test(t) : t.includes(m.sub)) return `« ${m.raw} »`;
    }
    return null;
  }

  // ---------- Carré de masquage ----------

  function textColorFor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#ffffff';
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111111' : '#ffffff';
  }

  function makeCover(post) {
    const cover = document.createElement('div');
    cover.className = 'cth-ui cth-cover';
    cover.innerHTML = '<span class="cth-label"></span><span class="cth-hint"></span>';
    const stop = (e) => { e.stopPropagation(); e.preventDefault(); };
    cover.addEventListener('pointerdown', stop);
    cover.addEventListener('mousedown', stop);
    cover.addEventListener('click', (e) => {
      stop(e);
      if (!settings.allowReveal) return;
      revealed.add(post);
      processPost(post);
    });
    return cover;
  }

  function updateCover(cover, reason) {
    const fg = textColorFor(settings.color);
    cover.style.setProperty('--cth-bg', settings.color);
    cover.style.setProperty('--cth-fg', fg);
    cover.classList.toggle('cth-revealable', !!settings.allowReveal);

    const base = (settings.labelText || '').trim();
    let label = '';
    if (settings.labelMode === 'text') label = base;
    else if (settings.labelMode === 'reason') label = base ? `${base} · ${reason}` : reason;
    const labelEl = cover.querySelector('.cth-label');
    if (labelEl.textContent !== label) labelEl.textContent = label;

    const hint = settings.allowReveal && settings.labelMode !== 'none' ? 'Cliquer pour afficher' : '';
    const hintEl = cover.querySelector('.cth-hint');
    if (hintEl.textContent !== hint) hintEl.textContent = hint;
  }

  // ---------- Bouton 🙈 sur chaque post ----------

  function makeButton(post) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cth-ui cth-btn';
    const stop = (e) => e.stopPropagation();
    btn.addEventListener('pointerdown', stop);
    btn.addEventListener('mousedown', stop);
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const u = btn.dataset.user;
      if (!u) return;
      const action = btn.dataset.action;
      if (action === 'rehide') {
        revealed.delete(post);
        processPost(post);
      } else if (action === 'unlist') {
        await setAccounts(settings.accounts.filter((a) => a !== u.toLowerCase()));
        toast(`Les posts de @${u} ne sont plus cachés`);
      } else if (action === 'except') {
        await addException(u);
        toast(`@${u} ne sera plus caché chez toi (exception à la liste partagée)`);
      } else {
        await setAccounts([...settings.accounts, u]);
        toast(`Les posts de @${u} sont maintenant cachés`);
      }
    });
    return btn;
  }

  function updateButton(post, u, reason) {
    let btn = post.querySelector('.cth-btn');
    if (!settings.showButton || (ownUser() && u.toLowerCase() === ownUser().toLowerCase())) { btn?.remove(); return; }
    if (!btn) {
      const time = post.querySelector('time');
      const anchor = time ? (time.closest('a') || time) : null;
      if (!anchor || anchor.closest('.cth-ui')) return;
      btn = makeButton(post);
      anchor.insertAdjacentElement('afterend', btn);
    }
    const where = listedWhere(u);
    let action, icon, title;
    if (reason && revealed.has(post)) {
      action = 'rehide'; icon = '🙈'; title = 'Cacher à nouveau ce post';
    } else if (where === 'mine') {
      action = 'unlist'; icon = '👁'; title = `Ne plus cacher les posts de @${u}`;
    } else if (where === 'remote') {
      action = 'except'; icon = '👁'; title = `@${u} est dans la liste partagée : ne plus le cacher chez moi`;
    } else {
      action = 'add'; icon = '🙈'; title = `Cacher les posts de @${u}`;
    }
    if (btn.dataset.user !== u) btn.dataset.user = u;
    if (btn.dataset.action !== action) btn.dataset.action = action;
    if (btn.textContent !== icon) btn.textContent = icon;
    if (btn.title !== title) btn.title = title;
  }

  // ---------- Traitement des posts ----------

  function processPost(post) {
    const u = usernameFromPost(post);
    if (!u) return;
    const reason = reasonFor(post, u);
    let cover = post.querySelector(':scope > .cth-cover');

    if (reason && !revealed.has(post)) {
      if (!cover) {
        cover = makeCover(post);
        post.appendChild(cover);
      }
      post.classList.add('cth-hidden');
      updateCover(cover, reason);
    } else {
      cover?.remove();
      post.classList.remove('cth-hidden');
    }
    updateButton(post, u, reason);
  }

  function scan() {
    document.querySelectorAll('[data-pressable-container]').forEach(processPost);
  }

  let toastTimer;
  function toast(msg) {
    let el = document.querySelector('.cth-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cth-ui cth-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('cth-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('cth-show'), 3000);
  }

  // ---------- Démarrage ----------

  load().then(() => {
    scan();
    let t;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(scan, 200);
    }).observe(document.body, { childList: true, subtree: true });
  });
})();
