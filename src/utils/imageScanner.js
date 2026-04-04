// No Creepy Crawlies — DOM image scanner utilities

const MIN_SIZE = 50; // px — ignore icons / tiny decorative images
const MUTATION_DEBOUNCE_MS = 500; // batch rapid DOM mutations before scanning

// ---------------------------------------------------------------------------
// Image collection
// ---------------------------------------------------------------------------

/**
 * Collect all scannable images from the page.
 * Returns [{ url, element, type: 'img'|'video'|'background' }], viewport-first.
 */
export function collectImages(doc = document) {
  const seen = new Set();
  const items = [];

  function add(url, element, type) {
    if (!url || url.startsWith('data:') || seen.has(url)) return;
    if (isTooSmall(element)) return;
    seen.add(url);
    items.push({ url, element, type });
  }

  // <img> tags — use currentSrc to get the actual loaded source (handles srcset)
  for (const img of doc.querySelectorAll('img')) {
    const src = img.currentSrc || img.src;
    if (src) add(src, img, 'img');
  }

  // <video> poster frames
  for (const video of doc.querySelectorAll('video[poster]')) {
    add(video.poster, video, 'video');
  }

  // Inline CSS background images (stylesheet backgrounds skipped — too expensive to compute)
  for (const el of doc.querySelectorAll('[style*="background"]')) {
    const url = extractBgUrl(el);
    if (url) add(url, el, 'background');
  }

  // Viewport images first so above-the-fold content is checked before the user scrolls
  return items.sort((a, b) => {
    const aVp = isInViewport(a.element);
    const bVp = isInViewport(b.element);
    return aVp === bVp ? 0 : aVp ? -1 : 1;
  });
}

// ---------------------------------------------------------------------------
// Size + viewport helpers
// ---------------------------------------------------------------------------

/**
 * True if the element is below the minimum scan size.
 * Skips icons, favicons, and tiny decorative images.
 */
export function isTooSmall(el) {
  if (el instanceof HTMLImageElement) {
    const w = el.naturalWidth || el.width;
    const h = el.naturalHeight || el.height;
    if (w > 0 && h > 0) return w < MIN_SIZE || h < MIN_SIZE;
  }
  const rect = el.getBoundingClientRect();
  return rect.width < MIN_SIZE || rect.height < MIN_SIZE;
}

function isInViewport(el) {
  const r = el.getBoundingClientRect();
  return (
    r.top < window.innerHeight &&
    r.bottom > 0 &&
    r.left < window.innerWidth &&
    r.right > 0
  );
}

function extractBgUrl(el) {
  const bg = getComputedStyle(el).backgroundImage;
  const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// MutationObserver
// ---------------------------------------------------------------------------

/**
 * Watch for new images added to the DOM (handles infinite scroll, SPAs, lazy load).
 * Calls onNewImages([{ url, element, type }]) after a debounce period.
 * Returns the observer — call .disconnect() to stop.
 */
export function observeMutations(onNewImages) {
  const pending = new Map(); // url → { element, type }
  let timer = null;

  function flush() {
    if (!pending.size) return;
    const images = [...pending.entries()].map(([url, meta]) => ({ url, ...meta }));
    pending.clear();
    onNewImages(images);
  }

  function enqueue(url, element, type) {
    if (!url || url.startsWith('data:') || pending.has(url)) return;
    if (isTooSmall(element)) return;
    pending.set(url, { element, type });
    clearTimeout(timer);
    timer = setTimeout(flush, MUTATION_DEBOUNCE_MS);
  }

  function processNode(node) {
    if (!(node instanceof Element)) return;

    if (node.tagName === 'IMG') {
      const src = node.currentSrc || node.src;
      if (src) enqueue(src, node, 'img');
    } else if (node.tagName === 'VIDEO' && node.poster) {
      enqueue(node.poster, node, 'video');
    }

    // Scan descendants of newly added container nodes
    for (const img of node.querySelectorAll('img')) {
      const src = img.currentSrc || img.src;
      if (src) enqueue(src, img, 'img');
    }
    for (const video of node.querySelectorAll('video[poster]')) {
      enqueue(video.poster, video, 'video');
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Newly inserted nodes
      for (const node of mutation.addedNodes) processNode(node);

      // src swapped on an existing <img> (e.g. lazy loader revealing real src)
      if (
        mutation.type === 'attributes' &&
        mutation.target instanceof HTMLImageElement
      ) {
        const src = mutation.target.currentSrc || mutation.target.src;
        if (src) enqueue(src, mutation.target, 'img');
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'poster'],
  });

  return observer;
}

// ---------------------------------------------------------------------------
// Viewport observer
// ---------------------------------------------------------------------------

/**
 * Watch all current <img> and <video poster> elements and call onImage(url, el)
 * as they approach the viewport (400px before visible).
 * This proactively triggers scans on lazy-loaded sites without requiring a scroll.
 */
export function observeViewport(onImage) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const url =
          el instanceof HTMLImageElement
            ? el.currentSrc || el.src
            : el instanceof HTMLVideoElement
              ? el.poster
              : null;
        if (url && !url.startsWith('data:') && !isTooSmall(el)) {
          onImage(url, el);
        }
        io.unobserve(el); // one scan per element is enough
      }
    },
    { rootMargin: '400px 0px' }, // fire 400px before the image enters view
  );

  for (const el of document.querySelectorAll('img, video[poster]')) {
    io.observe(el);
  }

  return io;
}
