// No Creepy Crawlies — Content Script

import { collectImages, observeMutations, observeViewport } from '../utils/imageScanner.js';
import { applyBlur, applyProvisionalBlur, removeProvisionalBlur, findElementsByUrl } from './blurReveal.js';

// url → Set<HTMLElement> — tracks every element associated with a scan request
// Storing element refs means we can blur them even if their src changes
// by the time the API responds (e.g. Google Images upgrading thumbnail quality)
const queued = new Map();

// url → result — avoids re-scanning when SPA re-renders the same image
const localCache = new Map();

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

function queueScan(url, element) {
  if (!url || url.startsWith('data:')) return;

  // Already have a cached result — apply to this element immediately
  if (localCache.has(url)) {
    applyToElements(localCache.get(url), element ? [element] : findElementsByUrl(url));
    return;
  }

  // Provisional blur immediately — don't wait for the API
  if (element) applyProvisionalBlur(element);

  // First time seeing this URL — send to background for scanning
  if (!queued.has(url)) {
    queued.set(url, new Set());
    chrome.runtime.sendMessage({ type: 'SCAN_IMAGE', url }, async (result) => {
      if (chrome.runtime.lastError) return;
      if (result) localCache.set(url, result);
      await applyResult(url, result);
    });
  }

  // Always track the element ref (API call may already be in flight)
  if (element) queued.get(url).add(element);
}

async function applyResult(url, result) {
  const stored = [...(queued.get(url) ?? [])].filter((el) => document.contains(el));
  const byUrl = findElementsByUrl(url);
  const elements = [...new Set([...stored, ...byUrl])];

  if (!result?.detected) {
    // Not an insect — remove provisional blurs
    for (const el of elements) removeProvisionalBlur(el);
    return;
  }

  const { confidenceThreshold = 0.9 } = await chrome.storage.local.get('confidenceThreshold');
  if (result.confidence < confidenceThreshold) {
    for (const el of elements) removeProvisionalBlur(el);
    return;
  }

  // Confirmed insect — upgrade provisional blur to full blur with overlay
  applyToElements(result, elements);
}

function applyToElements(result, elements) {
  if (!result?.detected) return;
  for (const el of elements) {
    applyBlur(el, result);
  }
}

function scanPage() {
  for (const { url, element } of collectImages()) {
    queueScan(url, element);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function init() {
  const { enabled = true, whitelistedDomains = [] } = await chrome.storage.local.get([
    'enabled',
    'whitelistedDomains',
  ]);
  if (!enabled) return;

  const hostname = window.location.hostname;
  const isWhitelisted = whitelistedDomains.some(
    (d) => hostname === d || hostname.endsWith(`.${d}`),
  );
  if (isWhitelisted) return;

  // 1. Scan whatever is already in the DOM with a real URL
  scanPage();

  // 2. Pre-scan images 400px before they enter the viewport
  observeViewport((url, el) => queueScan(url, el));

  // 3. Catch src/srcset changes + new elements (lazy loaders, infinite scroll)
  observeMutations((newImages) => {
    for (const { url, element } of newImages) {
      queueScan(url, element);
    }
  });

  // 4. Scan images the moment they finish loading — currentSrc is guaranteed to be set
  //    load doesn't bubble, so capture phase is required
  document.addEventListener(
    'load',
    (e) => {
      if (!(e.target instanceof HTMLImageElement)) return;
      const src = e.target.currentSrc || e.target.src;
      queueScan(src, e.target);
    },
    true,
  );

  // 5. Re-scan after page fully settles
  if (document.readyState !== 'complete') {
    window.addEventListener('load', scanPage, { once: true });
  }
  setTimeout(scanPage, 2000);
}

init();
