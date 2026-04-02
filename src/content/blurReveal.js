// No Creepy Crawlies — Blur & reveal UI
// Wraps detected images in a container, applies blur, and shows a warning card on click.

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Blur an element and attach the click-to-reveal overlay.
 * Safe to call multiple times on the same element (idempotent).
 */
export function applyBlur(el, result) {
  if (el.closest('.ncc-wrapper')) return; // already processed

  const wrapper = wrapElement(el);
  el.classList.add('ncc-blurred');

  const overlay = buildOverlay(result.type);
  wrapper.appendChild(overlay);

  overlay.addEventListener('click', () => showWarningCard(wrapper, el, result));
}

/**
 * Find all <img> and <video> elements on the page that match a given URL.
 * Used to blur every instance of the same image if it appears multiple times.
 */
export function findElementsByUrl(url) {
  const els = [];
  for (const img of document.querySelectorAll('img')) {
    if ((img.currentSrc || img.src) === url) els.push(img);
  }
  for (const video of document.querySelectorAll('video[poster]')) {
    if (video.poster === url) els.push(video);
  }
  return els;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function wrapElement(el) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ncc-wrapper';
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
  return wrapper;
}

function buildOverlay(bugType) {
  const overlay = document.createElement('div');
  overlay.className = 'ncc-overlay';

  const label = document.createElement('div');
  label.className = 'ncc-overlay-label';
  label.textContent = `🐛 Blocked`;
  overlay.appendChild(label);

  return overlay;
}

function showWarningCard(wrapper, el, result) {
  wrapper.querySelector('.ncc-overlay')?.remove();

  const card = document.createElement('div');
  card.className = 'ncc-warning-card';

  const title = document.createElement('strong');
  title.textContent = `⚠️ ${result.type ?? 'Bug'} detected`;

  const desc = document.createElement('p');
  desc.textContent = 'This image may contain an insect or bug.';

  const btnRow = document.createElement('div');
  btnRow.className = 'ncc-btn-row';

  const revealBtn = document.createElement('button');
  revealBtn.className = 'ncc-btn ncc-btn-reveal';
  revealBtn.textContent = 'Reveal Image';

  const keepBtn = document.createElement('button');
  keepBtn.className = 'ncc-btn ncc-btn-keep';
  keepBtn.textContent = 'Keep Blurred';

  btnRow.appendChild(revealBtn);
  btnRow.appendChild(keepBtn);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(btnRow);
  wrapper.appendChild(card);

  revealBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    revealImage(wrapper, el);
  });

  keepBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    card.remove();
    const overlay = buildOverlay(result.type);
    wrapper.appendChild(overlay);
    overlay.addEventListener('click', () => showWarningCard(wrapper, el, result));
  });
}

function revealImage(wrapper, el) {
  el.classList.remove('ncc-blurred');
  wrapper.querySelector('.ncc-warning-card')?.remove();
  wrapper.querySelector('.ncc-overlay')?.remove();
  // Unwrap — restore element to its original position
  wrapper.parentNode.insertBefore(el, wrapper);
  wrapper.remove();
}
