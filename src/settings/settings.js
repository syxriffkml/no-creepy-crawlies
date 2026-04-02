import '../styles/main.css';
import { getAllSettings, setSetting, saveApi, removeApi, setApiPriority } from '../utils/storage.js';
import { testApiKey } from '../utils/apiClients.js';
import { getUsageSummary, PROVIDER_NAMES, resetUsage } from '../utils/usageTracker.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_KEY_URLS = {
  claude:       'https://console.anthropic.com/',
  gemini:       'https://aistudio.google.com/app/apikey',
  googleVision: 'https://console.cloud.google.com/',
  clarifai:     'https://clarifai.com/settings/security',
};

const ALL_PROVIDERS = ['claude', 'gemini', 'googleVision', 'clarifai'];

const BUG_TYPES = [
  { id: 'spider',      label: 'Spiders',                  emoji: '🕷️' },
  { id: 'cockroach',   label: 'Cockroaches',               emoji: '🪳' },
  { id: 'ant',         label: 'Ants',                      emoji: '🐜' },
  { id: 'beetle',      label: 'Beetles',                   emoji: '🪲' },
  { id: 'centipede',   label: 'Centipedes & Millipedes',   emoji: '🐛' },
  { id: 'grasshopper', label: 'Grasshoppers & Crickets',   emoji: '🦗' },
  { id: 'mosquito',    label: 'Mosquitoes & Flies',        emoji: '🦟' },
  { id: 'wasp',        label: 'Wasps, Bees & Hornets',     emoji: '🐝' },
  { id: 'caterpillar', label: 'Caterpillars & Larvae',     emoji: '🐌' },
  { id: 'butterfly',   label: 'Butterflies & Moths',       emoji: '🦋' },
];

// Local UI state (not persisted)
const ui = {
  addProvider: '',
  addKey: '',
  addStatus: null, // null | 'testing' | { ok, error }
  newDomain: '',
  apiTestStatus: {}, // { [provider]: null | 'testing' | { ok, error } }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, classes = '', text = '') {
  const e = document.createElement(tag);
  if (classes) e.className = classes;
  if (text) e.textContent = text;
  return e;
}

function section(title, ...children) {
  const wrap = el('div', 'mb-8');
  wrap.appendChild(el('h2', 'text-base font-semibold text-gray-300 mb-3 uppercase tracking-wide text-xs', title));
  const card = el('div', 'bg-gray-900 rounded-xl divide-y divide-gray-800');
  children.forEach((c) => { if (c) card.appendChild(c); });
  wrap.appendChild(card);
  return wrap;
}

function row(...children) {
  const r = el('div', 'flex items-center justify-between gap-3 px-4 py-3');
  children.forEach((c) => r.appendChild(c));
  return r;
}

function toggle(value, onChange) {
  const track = el('div', `relative w-9 h-5 rounded-full cursor-pointer flex-shrink-0 transition-colors ${value ? 'bg-green-500' : 'bg-gray-600'}`);
  const thumb = el('div', `absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`);
  track.appendChild(thumb);
  track.addEventListener('click', () => onChange(!value));
  return track;
}

function dangerBtn(label, onClick) {
  const b = el('button', 'text-xs px-2 py-1 rounded bg-red-900/40 text-red-400 hover:bg-red-900/70 transition-colors', label);
  b.addEventListener('click', onClick);
  return b;
}

function ghostBtn(label, onClick, extra = '') {
  const b = el('button', `text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors ${extra}`, label);
  b.addEventListener('click', onClick);
  return b;
}

function primaryBtn(label, onClick, extra = '') {
  const b = el('button', `text-xs px-3 py-1.5 rounded bg-green-500 hover:bg-green-400 text-white font-medium transition-colors ${extra}`, label);
  b.addEventListener('click', onClick);
  return b;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function render() {
  const settings = await getAllSettings();
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(await buildPage(settings));
}

async function buildPage(s) {
  const wrap = el('div', 'max-w-2xl mx-auto p-8 pb-16');

  // Header
  const header = el('div', 'flex items-center gap-3 mb-8');
  header.appendChild(el('span', 'text-3xl', '🐛'));
  const headerText = el('div');
  headerText.appendChild(el('h1', 'text-xl font-bold text-white', 'No Creepy Crawlies'));
  headerText.appendChild(el('p', 'text-xs text-gray-500', 'Settings'));
  header.appendChild(headerText);
  wrap.appendChild(header);

  wrap.appendChild(buildApiSection(s));
  wrap.appendChild(buildConfidenceSection(s));
  wrap.appendChild(await buildUsageSection(s));
  wrap.appendChild(buildWhitelistSection(s));
  wrap.appendChild(buildBugTypesSection(s));
  wrap.appendChild(buildThemeSection(s));
  wrap.appendChild(buildAboutSection());

  return wrap;
}

// ---------------------------------------------------------------------------
// Section: API Management
// ---------------------------------------------------------------------------

function buildApiSection(s) {
  const sorted = [...s.apis].sort((a, b) => a.priority - b.priority);
  const rows = [];

  sorted.forEach((api, idx) => {
    rows.push(buildApiRow(api, idx, sorted.length, s));
  });

  rows.push(buildAddApiRow(s));
  return section('API Management', ...rows);
}

function buildApiRow(api, idx, total, s) {
  const r = el('div', 'px-4 py-3 flex flex-col gap-2');

  const top = el('div', 'flex items-center justify-between gap-2');

  const nameGroup = el('div', 'flex items-center gap-2 min-w-0');
  nameGroup.appendChild(el('span', 'text-sm font-medium text-white truncate', PROVIDER_NAMES[api.provider] ?? api.provider));
  nameGroup.appendChild(el('span', 'text-xs text-gray-600 font-mono truncate', maskKey(api.key)));
  top.appendChild(nameGroup);

  const actions = el('div', 'flex items-center gap-1.5 flex-shrink-0');

  // ↑ / ↓ priority buttons
  const upBtn = ghostBtn('↑', async () => {
    const providers = s.apis.sort((a, b) => a.priority - b.priority).map((a) => a.provider);
    [providers[idx - 1], providers[idx]] = [providers[idx], providers[idx - 1]];
    await setApiPriority(providers);
    render();
  });
  upBtn.disabled = idx === 0;
  upBtn.className += idx === 0 ? ' opacity-30 cursor-not-allowed' : '';

  const downBtn = ghostBtn('↓', async () => {
    const providers = s.apis.sort((a, b) => a.priority - b.priority).map((a) => a.provider);
    [providers[idx], providers[idx + 1]] = [providers[idx + 1], providers[idx]];
    await setApiPriority(providers);
    render();
  });
  downBtn.disabled = idx === total - 1;
  downBtn.className += idx === total - 1 ? ' opacity-30 cursor-not-allowed' : '';

  actions.appendChild(upBtn);
  actions.appendChild(downBtn);

  // Test button
  const testStatus = ui.apiTestStatus[api.provider];
  if (testStatus === 'testing') {
    actions.appendChild(el('span', 'text-xs text-gray-400', 'Testing…'));
  } else if (testStatus?.ok === true) {
    actions.appendChild(el('span', 'text-xs text-green-400', '✓ OK'));
  } else if (testStatus?.ok === false) {
    actions.appendChild(el('span', 'text-xs text-red-400', '✗ Failed'));
  } else {
    actions.appendChild(ghostBtn('Test', async () => {
      ui.apiTestStatus[api.provider] = 'testing';
      render();
      ui.apiTestStatus[api.provider] = await testApiKey(api.provider, api.key);
      render();
    }));
  }

  actions.appendChild(dangerBtn('Remove', async () => {
    await removeApi(api.provider);
    delete ui.apiTestStatus[api.provider];
    render();
  }));

  top.appendChild(actions);
  r.appendChild(top);

  // Error message if test failed
  if (testStatus?.ok === false) {
    r.appendChild(el('p', 'text-xs text-red-400', testStatus.error ?? 'Could not reach API'));
  }

  return r;
}

function buildAddApiRow(s) {
  const configuredIds = s.apis.map((a) => a.provider);
  const available = ALL_PROVIDERS.filter((p) => !configuredIds.includes(p));

  if (available.length === 0) {
    return el('div', 'px-4 py-3 text-xs text-gray-600', 'All supported providers are configured.');
  }

  const wrap = el('div', 'px-4 py-3 flex flex-col gap-3');
  wrap.appendChild(el('p', 'text-xs font-medium text-gray-400', 'Add another API key'));

  const inputs = el('div', 'flex gap-2');

  const select = document.createElement('select');
  select.className = 'flex-shrink-0 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-green-500';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose provider';
  select.appendChild(placeholder);
  available.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = PROVIDER_NAMES[p] ?? p;
    if (p === ui.addProvider) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', (e) => { ui.addProvider = e.target.value; ui.addStatus = null; });
  inputs.appendChild(select);

  const keyInput = document.createElement('input');
  keyInput.type = 'password';
  keyInput.placeholder = 'API key';
  keyInput.value = ui.addKey;
  keyInput.className = 'flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1.5 placeholder-gray-600 focus:outline-none focus:border-green-500';
  keyInput.addEventListener('input', (e) => { ui.addKey = e.target.value.trim(); ui.addStatus = null; });
  inputs.appendChild(keyInput);

  wrap.appendChild(inputs);

  const footer = el('div', 'flex items-center gap-3');

  if (ui.addStatus === 'testing') {
    footer.appendChild(el('span', 'text-xs text-gray-400', 'Testing key…'));
  } else {
    const addBtn = primaryBtn('Test & Add', async () => {
      if (!ui.addProvider || !ui.addKey) return;
      ui.addStatus = 'testing';
      render();
      const result = await testApiKey(ui.addProvider, ui.addKey);
      if (result.ok) {
        await saveApi(ui.addProvider, ui.addKey);
        ui.addProvider = '';
        ui.addKey = '';
        ui.addStatus = null;
      } else {
        ui.addStatus = result;
      }
      render();
    });
    footer.appendChild(addBtn);

    if (ui.addProvider) {
      const link = document.createElement('a');
      link.href = PROVIDER_KEY_URLS[ui.addProvider] ?? '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'text-xs text-green-400 hover:text-green-300 underline';
      link.textContent = 'Get key →';
      footer.appendChild(link);
    }
  }

  if (ui.addStatus?.ok === false) {
    footer.appendChild(el('span', 'text-xs text-red-400', ui.addStatus.error ?? 'Key test failed'));
  }

  wrap.appendChild(footer);
  return wrap;
}

function maskKey(key) {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 6) + '••••••••';
}

// ---------------------------------------------------------------------------
// Section: Confidence Threshold
// ---------------------------------------------------------------------------

function buildConfidenceSection(s) {
  const pct = Math.round(s.confidenceThreshold * 100);

  const wrap = el('div', 'px-4 py-3 flex flex-col gap-2');

  const labelRow = el('div', 'flex justify-between items-center');
  labelRow.appendChild(el('span', 'text-sm text-white', 'Minimum confidence to blur'));
  const valueDisplay = el('span', 'text-sm font-mono font-semibold text-green-400', `${pct}%`);
  labelRow.appendChild(valueDisplay);
  wrap.appendChild(labelRow);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '50';
  slider.max = '99';
  slider.value = String(pct);
  slider.className = 'w-full accent-green-500';
  slider.addEventListener('input', (e) => {
    valueDisplay.textContent = `${e.target.value}%`;
  });
  slider.addEventListener('change', async (e) => {
    await setSetting('confidenceThreshold', Number(e.target.value) / 100);
  });
  wrap.appendChild(slider);

  wrap.appendChild(el('p', 'text-xs text-gray-500', 'Higher = fewer false positives. Lower = catches more bugs but may blur unrelated images.'));

  return section('Confidence Threshold', wrap);
}

// ---------------------------------------------------------------------------
// Section: Usage & Notifications
// ---------------------------------------------------------------------------

async function buildUsageSection(s) {
  const rows = [];

  // Notifications toggle
  const notifRow = row(
    el('span', 'text-sm text-white', 'Usage warning notifications'),
    toggle(s.notificationsEnabled, async (val) => {
      await setSetting('notificationsEnabled', val);
      render();
    }),
  );
  rows.push(notifRow);

  // Per-API usage
  for (const api of s.apis.sort((a, b) => a.priority - b.priority)) {
    const usage = await getUsageSummary(api.provider);
    rows.push(buildUsageRow(api.provider, usage));
  }

  if (s.apis.length === 0) {
    const empty = el('div', 'px-4 py-3 text-xs text-gray-600', 'No APIs configured yet.');
    rows.push(empty);
  }

  return section('Usage & Notifications', ...rows);
}

function buildUsageRow(provider, usage) {
  const pct = usage.pct ?? 0;
  const barColor = pct >= 0.9 ? 'bg-red-500' : pct >= 0.8 ? 'bg-yellow-400' : 'bg-green-500';

  const wrap = el('div', 'px-4 py-3 flex flex-col gap-1.5');

  const top = el('div', 'flex items-center justify-between');
  top.appendChild(el('span', 'text-sm text-white', PROVIDER_NAMES[provider] ?? provider));

  const right = el('div', 'flex items-center gap-2');
  right.appendChild(el('span', 'text-xs text-gray-400', `${usage.monthlyCount.toLocaleString()} / ${usage.limit?.toLocaleString() ?? '—'}`));
  right.appendChild(dangerBtn('Reset', async () => {
    await resetUsage(provider);
    render();
  }));
  top.appendChild(right);
  wrap.appendChild(top);

  const track = el('div', 'h-1 bg-gray-800 rounded-full overflow-hidden');
  const fill = el('div', `h-full ${barColor} rounded-full`);
  fill.style.width = `${Math.min(pct * 100, 100).toFixed(1)}%`;
  track.appendChild(fill);
  wrap.appendChild(track);

  return wrap;
}

// ---------------------------------------------------------------------------
// Section: Whitelisted Sites
// ---------------------------------------------------------------------------

function buildWhitelistSection(s) {
  const rows = [];

  // Existing domains
  s.whitelistedDomains.forEach((domain) => {
    const r = row(
      el('span', 'text-sm text-white font-mono', domain),
      dangerBtn('Remove', async () => {
        await setSetting('whitelistedDomains', s.whitelistedDomains.filter((d) => d !== domain));
        render();
      }),
    );
    rows.push(r);
  });

  // Add domain input
  const addRow = el('div', 'px-4 py-3 flex gap-2');

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'example.com';
  input.value = ui.newDomain;
  input.className = 'flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-1.5 placeholder-gray-600 focus:outline-none focus:border-green-500';
  input.addEventListener('input', (e) => { ui.newDomain = e.target.value.trim(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addDomain(s); });
  addRow.appendChild(input);
  addRow.appendChild(primaryBtn('Add', () => addDomain(s)));

  rows.push(addRow);

  if (s.whitelistedDomains.length === 0) {
    const empty = el('div', 'px-4 pt-3 text-xs text-gray-600', 'No whitelisted sites. Extension runs on all pages.');
    rows.unshift(empty);
  }

  return section('Whitelisted Sites', ...rows);
}

async function addDomain(s) {
  const domain = ui.newDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain || s.whitelistedDomains.includes(domain)) return;
  await setSetting('whitelistedDomains', [...s.whitelistedDomains, domain]);
  ui.newDomain = '';
  render();
}

// ---------------------------------------------------------------------------
// Section: Bug Types
// ---------------------------------------------------------------------------

function buildBugTypesSection(s) {
  const wrap = el('div', 'px-4 py-3');
  wrap.appendChild(el('p', 'text-xs text-gray-500 mb-3', 'Toggling a type OFF means those images will NOT be blurred.'));

  const grid = el('div', 'grid grid-cols-2 gap-2');

  BUG_TYPES.forEach(({ id, label, emoji }) => {
    const isWhitelisted = s.whitelistedBugTypes.includes(id);
    const chip = el('div', `flex items-center justify-between px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
      isWhitelisted ? 'border-gray-700 bg-gray-800/50 opacity-60' : 'border-gray-700 bg-gray-800'
    }`);

    const left = el('div', 'flex items-center gap-2');
    left.appendChild(el('span', 'text-base', emoji));
    left.appendChild(el('span', 'text-sm text-white', label));
    chip.appendChild(left);
    chip.appendChild(toggle(!isWhitelisted, async (blocked) => {
      const updated = blocked
        ? s.whitelistedBugTypes.filter((t) => t !== id)
        : [...s.whitelistedBugTypes, id];
      await setSetting('whitelistedBugTypes', updated);
      render();
    }));

    grid.appendChild(chip);
  });

  wrap.appendChild(grid);
  return section('Bug Types', wrap);
}

// ---------------------------------------------------------------------------
// Section: Theme
// ---------------------------------------------------------------------------

function buildThemeSection(s) {
  const options = [
    { value: 'system', label: '🖥 System' },
    { value: 'light',  label: '☀️ Light' },
    { value: 'dark',   label: '🌙 Dark' },
  ];

  const wrap = el('div', 'px-4 py-3 flex gap-2');
  options.forEach(({ value, label }) => {
    const btn = el('button',
      `flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
        s.theme === value
          ? 'bg-green-500 text-white'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`,
      label,
    );
    btn.addEventListener('click', async () => {
      await setSetting('theme', value);
      render();
    });
    wrap.appendChild(btn);
  });

  return section('Theme', wrap);
}

// ---------------------------------------------------------------------------
// Section: About
// ---------------------------------------------------------------------------

function buildAboutSection() {
  const rows = [];

  const versionRow = row(
    el('span', 'text-sm text-gray-400', 'Version'),
    el('span', 'text-sm text-white font-mono', '1.0.0'),
  );
  rows.push(versionRow);

  const githubRow = el('div', 'px-4 py-3');
  const link = document.createElement('a');
  link.href = 'https://github.com/vexr7/no-creepy-crawlies';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'text-sm text-green-400 hover:text-green-300 underline';
  link.textContent = 'GitHub Repository →';
  githubRow.appendChild(link);
  rows.push(githubRow);

  return section('About', ...rows);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

render();
