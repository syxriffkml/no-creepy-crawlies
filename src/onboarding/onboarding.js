import '../styles/main.css';
import { saveApi } from '../utils/storage.js';
import { testApiKey } from '../utils/apiClients.js';

// ---------------------------------------------------------------------------
// Provider data
// ---------------------------------------------------------------------------

const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Gemini Flash',
    company: 'Google',
    accuracy: 5,
    cost: 1,
    recommended: true,
    pros: ['Smart & very affordable', 'Generous free tier'],
    cons: ['Requires Google account'],
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'Get a free key at Google AI Studio',
  },
  {
    id: 'claude',
    name: 'Claude Vision',
    company: 'Anthropic',
    accuracy: 5,
    cost: 3,
    pros: ['Most accurate', 'Best context understanding'],
    cons: ['No free tier', 'Higher cost'],
    keyUrl: 'https://console.anthropic.com/',
    keyHint: 'Create a key in the Anthropic Console',
  },
  {
    id: 'googleVision',
    name: 'Google Cloud Vision',
    company: 'Google',
    accuracy: 4,
    cost: 2,
    pros: ['Fast & reliable', 'Widely used'],
    cons: ['Less context-aware'],
    keyUrl: 'https://console.cloud.google.com/',
    keyHint: 'Enable the Vision API in Google Cloud Console',
  },
  {
    id: 'clarifai',
    name: 'Clarifai',
    company: 'Clarifai',
    accuracy: 3,
    cost: 2,
    pros: ['Dedicated animal recognition model'],
    cons: ['Less accurate overall'],
    keyUrl: 'https://clarifai.com/settings/security',
    keyHint: 'Create a Personal Access Token in Clarifai',
  },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  step: 1,
  providerId: null,
  apiKey: '',
  testResult: null, // { ok: boolean, error: string|null }
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

function goTo(step) {
  state.step = step;
  render();
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const builders = [null, buildStep1, buildStep2, buildStep3, buildStep4, buildStep5];
  app.appendChild(builders[state.step]());
}

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

function el(tag, classes, text) {
  const e = document.createElement(tag);
  if (classes) e.className = classes;
  if (text) e.textContent = text;
  return e;
}

function btn(label, classes, onClick) {
  const b = el('button', classes);
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function stepHeader(stepNum, total, title, subtitle) {
  const wrap = el('div', 'mb-6');
  wrap.appendChild(el('div', 'text-xs text-gray-500 mb-1 tracking-wide uppercase', `Step ${stepNum} of ${total}`));
  wrap.appendChild(el('h2', 'text-2xl font-bold text-white', title));
  if (subtitle) wrap.appendChild(el('p', 'text-gray-400 mt-1 text-sm', subtitle));
  return wrap;
}

function centered(...children) {
  const wrap = el('div', 'flex flex-col items-center justify-center min-h-screen text-center p-8 gap-4');
  children.forEach((c) => wrap.appendChild(c));
  return wrap;
}

// ---------------------------------------------------------------------------
// Step 1 — Welcome
// ---------------------------------------------------------------------------

function buildStep1() {
  const getStarted = btn(
    'Get Started →',
    'mt-2 px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors text-base',
    () => goTo(2),
  );

  const subtitle = el('p', 'text-gray-400 max-w-sm leading-relaxed text-sm');
  subtitle.innerHTML =
    'Automatically detects and blurs insect and bug images as you browse.<br/>' +
    'You bring the API key — your data never leaves your browser.';

  return centered(
    el('div', 'text-7xl', '🐛'),
    el('h1', 'text-3xl font-bold text-white', 'No Creepy Crawlies'),
    subtitle,
    getStarted,
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Choose API provider
// ---------------------------------------------------------------------------

function buildStep2() {
  const wrap = el('div', 'p-8 max-w-2xl mx-auto');
  wrap.appendChild(stepHeader(1, 4, 'Choose your AI provider', 'All options use your own API key — no data goes through our servers.'));

  const grid = el('div', 'grid grid-cols-2 gap-3 mb-6');
  PROVIDERS.forEach((p) => grid.appendChild(buildProviderCard(p)));
  wrap.appendChild(grid);

  const nextBtn = btn(
    'Continue →',
    'w-full py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
    () => goTo(3),
  );
  nextBtn.disabled = !state.providerId;
  wrap.appendChild(nextBtn);

  return wrap;
}

function buildProviderCard(p) {
  const selected = state.providerId === p.id;
  const card = el(
    'div',
    `relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
      selected
        ? 'border-green-500 bg-green-500/10'
        : 'border-gray-700 bg-gray-900 hover:border-gray-500'
    }`,
  );

  if (p.recommended) {
    const badge = el('div', 'absolute -top-2.5 right-2 bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full', '⭐ Recommended');
    card.appendChild(badge);
  }

  card.appendChild(el('div', 'font-semibold text-white text-sm', p.name));
  card.appendChild(el('div', 'text-xs text-gray-500 mb-2', p.company));

  const indicators = el('div', 'flex gap-3 text-xs mb-2');
  indicators.appendChild(el('span', 'text-yellow-400', '⭐'.repeat(p.accuracy)));
  indicators.appendChild(el('span', 'text-green-400', '💰'.repeat(p.cost)));
  card.appendChild(indicators);

  const pros = el('ul', 'text-xs text-green-400 space-y-0.5 mb-1');
  p.pros.forEach((t) => pros.appendChild(el('li', '', `+ ${t}`)));
  card.appendChild(pros);

  const cons = el('ul', 'text-xs text-red-400 space-y-0.5');
  p.cons.forEach((t) => cons.appendChild(el('li', '', `− ${t}`)));
  card.appendChild(cons);

  card.addEventListener('click', () => {
    state.providerId = p.id;
    render();
  });

  return card;
}

// ---------------------------------------------------------------------------
// Step 3 — Enter API key
// ---------------------------------------------------------------------------

function buildStep3() {
  const provider = PROVIDERS.find((p) => p.id === state.providerId);
  const wrap = el('div', 'flex flex-col justify-center min-h-screen p-8 max-w-lg mx-auto gap-4');

  wrap.appendChild(stepHeader(2, 4, `Enter your ${provider.name} key`, provider.keyHint));

  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'Paste your API key here';
  input.value = state.apiKey;
  input.className =
    'w-full px-4 py-3 bg-gray-900 border border-gray-700 text-white rounded-lg placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors';
  input.addEventListener('input', (e) => {
    state.apiKey = e.target.value.trim();
  });
  wrap.appendChild(input);

  const link = document.createElement('a');
  link.href = provider.keyUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'text-sm text-green-400 hover:text-green-300 underline self-start';
  link.textContent = `Get a ${provider.name} key →`;
  wrap.appendChild(link);

  const btnRow = el('div', 'flex gap-3 mt-2');
  btnRow.appendChild(
    btn('← Back', 'px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors', () => goTo(2)),
  );
  btnRow.appendChild(
    btn('Test Key →', 'flex-1 py-2 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors', () => {
      if (!state.apiKey) { input.focus(); return; }
      state.testResult = null;
      goTo(4);
    }),
  );
  wrap.appendChild(btnRow);

  return wrap;
}

// ---------------------------------------------------------------------------
// Step 4 — Test key
// ---------------------------------------------------------------------------

function buildStep4() {
  const provider = PROVIDERS.find((p) => p.id === state.providerId);

  if (!state.testResult) {
    // Kick off the test (async) and show loading UI
    runTest();
    const dots = el('div', 'flex gap-1.5 justify-center');
    [0, 150, 300].forEach((delay) => {
      const d = el('div', 'w-2 h-2 bg-green-500 rounded-full animate-bounce');
      d.style.animationDelay = `${delay}ms`;
      dots.appendChild(d);
    });
    return centered(
      el('div', 'text-5xl', '⏳'),
      el('h2', 'text-2xl font-bold text-white', 'Testing your key…'),
      el('p', 'text-gray-400 text-sm', `Sending a test image to ${provider.name}`),
      dots,
    );
  }

  if (state.testResult.ok) {
    const finishBtn = btn('Finish Setup →', 'mt-2 px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors', async () => {
      await saveApi(state.providerId, state.apiKey);
      goTo(5);
    });
    return centered(
      el('div', 'text-5xl', '✅'),
      el('h2', 'text-2xl font-bold text-white', 'Key works!'),
      el('p', 'text-gray-400 text-sm', 'Your API key is valid and ready to use.'),
      finishBtn,
    );
  }

  // Test failed
  const errorMsg = el('p', 'text-gray-400 text-sm max-w-sm');
  errorMsg.textContent = state.testResult.error ?? 'Could not connect to the API. Please check your key.';

  const fixBtn = btn('← Fix Key', 'px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors', () => {
    state.testResult = null;
    goTo(3);
  });

  return centered(
    el('div', 'text-5xl', '❌'),
    el('h2', 'text-2xl font-bold text-white', 'Key test failed'),
    errorMsg,
    fixBtn,
  );
}

async function runTest() {
  state.testResult = await testApiKey(state.providerId, state.apiKey);
  render();
}

// ---------------------------------------------------------------------------
// Step 5 — Done
// ---------------------------------------------------------------------------

function buildStep5() {
  const startBtn = btn('Start Browsing', 'mt-2 px-8 py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors', () => window.close());

  const desc = el('p', 'text-gray-400 max-w-sm leading-relaxed text-sm');
  desc.innerHTML =
    'No Creepy Crawlies is now active.<br/>' +
    'Bug images will be blurred automatically as you browse.';

  return centered(
    el('div', 'text-6xl', '🎉'),
    el('h2', 'text-2xl font-bold text-white', "You're all set!"),
    desc,
    startBtn,
  );
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

render();
