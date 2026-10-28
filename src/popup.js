const api = globalThis.browser ?? globalThis.chrome;
const $ = (id) => document.getElementById(id);
const DEFAULT_LIST_URL = 'https://raw.githubusercontent.com/fanchlegal/cache-ton-facho/main/liste.txt';
const BUILTIN_ORIGINS = ['https://raw.githubusercontent.com'];

const DEFAULTS = {
  accounts: [], keywords: [], color: '#2b2b33',
  labelMode: 'reason', labelText: 'Post masqué',
  allowReveal: true, showButton: true,
  useRemote: false, remoteUrls: [DEFAULT_LIST_URL], remoteData: {}, exceptions: []
};
const PRESETS = ['#2b2b33', '#6b7280', '#e5223a', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed', '#f5f5f4'];

const lines = (v) => v.split('\n').map((t) => t.trim()).filter(Boolean);
const cleanUser = (s) => (s || '').trim()
  .replace(/^https?:\/\/(www\.)?threads\.(com|net)\//i, '')
  .replace(/^@/, '').replace(/[/?#].*$/, '').toLowerCase();

function textColorFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150 ? '#111111' : '#ffffff';
}

function updateCount() {
  const n = new Set(lines($('accounts').value).map(cleanUser).filter(Boolean)).size;
  $('accCount').textContent = n ? `(${n})` : '';
}

function updatePreview() {
  const color = $('color').value;
  const mode = $('labelMode').value;
  const base = $('labelText').value.trim();
  const p = $('preview');
  p.style.background = color;
  p.style.color = textColorFor(color);
  let label = '';
  if (mode === 'text') label = base;
  else if (mode === 'reason') label = base ? `${base} · @exemple` : '@exemple';
  $('previewLabel').textContent = label;
  $('previewHint').textContent = $('allowReveal').checked && mode !== 'none' ? 'Cliquer pour afficher' : '';
  $('labelTextRow').style.display = mode === 'none' ? 'none' : '';
  document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s.dataset.color === color));
}

function buildSwatches() {
  const box = $('swatches');
  for (const c of PRESETS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.color = c;
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => { $('color').value = c; updatePreview(); });
    box.insertBefore(b, $('color'));
  }
}

function ago(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

function renderRemote(remoteData) {
  const on = $('useRemote').checked;
  $('remoteBox').style.display = on ? '' : 'none';
  if (!on) return;
  const lists = Object.values(remoteData || {});
  const total = new Set(lists.flatMap((l) => l.accounts || [])).size;
  const last = Math.max(0, ...lists.map((l) => l.fetchedAt || 0));
  const errors = lists.filter((l) => l.error).map((l) => l.error);
  let txt = lists.length ? `${total} compte(s)` : 'Pas encore récupérée';
  if (last) txt += ` · mise à jour ${ago(last)}`;
  if (errors.length) txt += ` · ⚠ ${errors[0]}`;
  $('remoteStatus').textContent = txt;
}

async function refreshRemote() {
  $('remoteStatus').textContent = 'Mise à jour…';
  try {
    const data = await api.runtime.sendMessage({ type: 'refresh-lists' });
    renderRemote(data);
  } catch (e) {
    $('remoteStatus').textContent = `⚠ ${e.message || e}`;
  }
}

async function init() {
  buildSwatches();
  const s = { ...DEFAULTS, ...(await api.storage.local.get(DEFAULTS)) };
  $('accounts').value = s.accounts.join('\n');
  $('keywords').value = s.keywords.join('\n');
  $('color').value = s.color;
  $('labelMode').value = s.labelMode;
  $('labelText').value = s.labelText;
  $('allowReveal').checked = s.allowReveal;
  $('showButton').checked = s.showButton;
  $('useRemote').checked = s.useRemote;
  $('exceptions').value = s.exceptions.join('\n');
  $('remoteUrls').value = s.remoteUrls.join('\n');
  renderRemote(s.remoteData);
  updateCount();
  updatePreview();
}

for (const id of ['color', 'labelMode', 'labelText', 'allowReveal']) {
  $(id).addEventListener('input', updatePreview);
  $(id).addEventListener('change', updatePreview);
}
$('accounts').addEventListener('input', updateCount);
$('useRemote').addEventListener('change', async () => {
  await api.storage.local.set({ useRemote: $('useRemote').checked });
  renderRemote({});
  if ($('useRemote').checked) await refreshRemote();
});
$('refresh').addEventListener('click', refreshRemote);

$('save').addEventListener('click', async () => {
  const accounts = [...new Set(lines($('accounts').value).map(cleanUser).filter(Boolean))];
  const keywords = [...new Set(lines($('keywords').value))];
  const exceptions = [...new Set(lines($('exceptions').value).map(cleanUser).filter(Boolean))];
  let remoteUrls = [...new Set(lines($('remoteUrls').value).filter((u) => /^https:\/\//i.test(u)))];
  if (!remoteUrls.length) remoteUrls = [DEFAULT_LIST_URL];
  // Les adresses hors GitHub demandent une autorisation d'accès
  const extra = [...new Set(remoteUrls.map((u) => new URL(u).origin))].filter((o) => !BUILTIN_ORIGINS.includes(o));
  if (extra.length) {
    const ok = await api.permissions.request({ origins: extra.map((o) => `${o}/*`) }).catch(() => false);
    if (!ok) remoteUrls = remoteUrls.filter((u) => BUILTIN_ORIGINS.includes(new URL(u).origin));
  }
  await api.storage.local.set({
    exceptions,
    remoteUrls,
    useRemote: $('useRemote').checked,
    accounts,
    keywords,
    color: $('color').value,
    labelMode: $('labelMode').value,
    labelText: $('labelText').value.trim(),
    allowReveal: $('allowReveal').checked,
    showButton: $('showButton').checked
  });
  $('accounts').value = accounts.join('\n');
  $('keywords').value = keywords.join('\n');
  $('exceptions').value = exceptions.join('\n');
  $('remoteUrls').value = remoteUrls.join('\n');
  updateCount();
  if ($('useRemote').checked) refreshRemote();
  $('saved').style.opacity = 1;
  setTimeout(() => ($('saved').style.opacity = 0), 1500);
});

$('export').addEventListener('click', () => {
  const accounts = [...new Set(lines($('accounts').value).map(cleanUser).filter(Boolean))];
  const blob = new Blob([accounts.join('\n') + '\n'], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cache-ton-facho-comptes.txt';
  a.click();
});

$('import').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const added = lines(await file.text()).map(cleanUser).filter(Boolean);
  const merged = [...new Set([...lines($('accounts').value).map(cleanUser), ...added])];
  $('accounts').value = merged.join('\n');
  updateCount();
  e.target.value = '';
  $('saved').textContent = `${added.length} compte(s) importé(s) — clique sur Enregistrer`;
  $('saved').style.opacity = 1;
  setTimeout(() => { $('saved').style.opacity = 0; $('saved').textContent = '✓ Enregistré'; }, 3000);
});

init();
