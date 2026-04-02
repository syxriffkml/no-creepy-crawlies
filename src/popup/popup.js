import '../styles/main.css';
import { getSetting, setSetting, getActiveApi, getStats } from '../utils/storage.js';
import { getUsageSummary, PROVIDER_NAMES } from '../utils/usageTracker.js';

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadData() {
  const [enabled, activeApi, stats] = await Promise.all([
    getSetting('enabled'),
    getActiveApi(),
    getStats(),
  ]);

  let usage = null;
  if (activeApi) usage = await getUsageSummary(activeApi.provider);
  return { enabled, activeApi, usage, stats };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function render() {
  const data = await loadData();
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(buildPopup(data));
}

function buildPopup({ enabled, activeApi, usage, stats }) {
  const root = document.createDocumentFragment();

  root.appendChild(buildHeader(enabled));
  root.appendChild(buildDivider());
  root.appendChild(buildBody(enabled, activeApi, usage, stats));
  root.appendChild(buildDivider());
  root.appendChild(buildFooter());

  return root;
}

// ---------------------------------------------------------------------------
// Header — logo + name + toggle
// ---------------------------------------------------------------------------

function buildHeader(enabled) {
  const header = el('div', 'flex items-center justify-between px-4 py-3');

  const left = el('div', 'flex items-center gap-2');
  left.appendChild(el('span', 'text-xl', '🐛'));
  left.appendChild(el('span', 'font-semibold text-sm text-white', 'No Creepy Crawlies'));
  header.appendChild(left);

  header.appendChild(buildToggle(enabled));
  return header;
}

function buildToggle(enabled) {
  const track = el(
    'div',
    `relative w-10 h-6 rounded-full cursor-pointer transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-600'}`,
  );
  const thumb = el(
    'div',
    `absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'}`,
  );
  track.appendChild(thumb);
  track.title = enabled ? 'Disable extension' : 'Enable extension';
  track.addEventListener('click', async () => {
    await setSetting('enabled', !enabled);
    render();
  });
  return track;
}

// ---------------------------------------------------------------------------
// Body — API status + usage + blocked count
// ---------------------------------------------------------------------------

function buildBody(enabled, activeApi, usage, stats) {
  const body = el('div', `px-4 py-3 flex flex-col gap-3 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`);

  if (!activeApi) {
    body.appendChild(buildNoApiState());
    return body;
  }

  body.appendChild(buildApiStatus(activeApi, usage));
  if (usage) body.appendChild(buildUsageBar(usage));
  body.appendChild(buildBlockedCount(stats.blockedToday));

  return body;
}

function buildNoApiState() {
  const wrap = el('div', 'flex flex-col items-center text-center gap-2 py-2');
  wrap.appendChild(el('div', 'text-2xl', '⚠️'));
  wrap.appendChild(el('p', 'text-sm text-gray-400', 'No API key configured.'));

  const link = document.createElement('button');
  link.className = 'text-xs text-green-400 hover:text-green-300 underline';
  link.textContent = 'Set up now →';
  link.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
    window.close();
  });
  wrap.appendChild(link);
  return wrap;
}

function buildApiStatus(activeApi, usage) {
  const pct = usage?.pct ?? 0;
  const dotColor =
    pct >= 0.9 ? 'bg-red-500' :
    pct >= 0.8 ? 'bg-yellow-400' :
                 'bg-green-500';

  const row = el('div', 'flex items-center justify-between');

  const left = el('div', 'flex items-center gap-2');
  left.appendChild(el('div', `w-2 h-2 rounded-full ${dotColor}`));
  left.appendChild(el('span', 'text-sm text-white', PROVIDER_NAMES[activeApi.provider] ?? activeApi.provider));
  row.appendChild(left);

  const status = el('span', 'text-xs text-gray-500',
    pct >= 0.9 ? '⚠️ Near limit' :
    pct >= 0.8 ? '⚠️ High usage' :
                 'Active',
  );
  row.appendChild(status);
  return row;
}

function buildUsageBar(usage) {
  const wrap = el('div', 'flex flex-col gap-1');

  const label = el('div', 'flex justify-between text-xs text-gray-500');
  const used = usage.monthlyCount.toLocaleString();
  const limit = usage.limit ? usage.limit.toLocaleString() : '—';
  label.appendChild(el('span', '', `${used} / ${limit} calls this month`));

  const pct = Math.min(usage.pct ?? 0, 1);
  const barColor =
    pct >= 0.9 ? 'bg-red-500' :
    pct >= 0.8 ? 'bg-yellow-400' :
                 'bg-green-500';

  const track = el('div', 'h-1.5 bg-gray-800 rounded-full overflow-hidden');
  const fill = el('div', `h-full ${barColor} rounded-full transition-all`);
  fill.style.width = `${(pct * 100).toFixed(1)}%`;
  track.appendChild(fill);

  wrap.appendChild(label);
  wrap.appendChild(track);
  return wrap;
}

function buildBlockedCount(count) {
  const row = el('div', 'flex items-center gap-2 text-sm');
  row.appendChild(el('span', 'text-base', '🐛'));
  row.appendChild(
    el('span', 'text-gray-300',
      count === 0
        ? 'No images blocked today'
        : `${count} image${count === 1 ? '' : 's'} blocked today`,
    ),
  );
  return row;
}

// ---------------------------------------------------------------------------
// Footer — settings link
// ---------------------------------------------------------------------------

function buildFooter() {
  const footer = el('div', 'px-4 py-2');

  const link = el('button', 'flex items-center justify-between w-full text-sm text-gray-400 hover:text-white transition-colors');
  const left = el('div', 'flex items-center gap-2');
  left.appendChild(el('span', '', '⚙️'));
  left.appendChild(el('span', '', 'Settings'));
  link.appendChild(left);
  link.appendChild(el('span', 'text-gray-600', '→'));
  link.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  footer.appendChild(link);
  return footer;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(tag, classes, text) {
  const e = document.createElement(tag);
  if (classes) e.className = classes;
  if (text != null) e.textContent = text;
  return e;
}

function buildDivider() {
  return el('div', 'border-t border-gray-800');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

render();
