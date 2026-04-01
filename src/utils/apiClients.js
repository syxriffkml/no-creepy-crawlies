// No Creepy Crawlies — API client wrappers
// All clients return: { detected: boolean, type: string|null, confidence: number }
// They throw on failure — callers handle errors gracefully (leave image as-is).

// ---------------------------------------------------------------------------
// Shared prompt (Claude + Gemini)
// ---------------------------------------------------------------------------

const SCAN_PROMPT =
  'Does this image contain any insects, bugs, spiders, or other creepy crawlies? ' +
  'Reply with ONLY a JSON object, no markdown, no explanation: ' +
  '{"detected": true or false, "type": "name of the bug, or null if none", "confidence": 0.0 to 1.0}';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a JSON object from an LLM response string.
 * Handles markdown code fences and leading/trailing text.
 */
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON found in response: ${text}`);
  return JSON.parse(match[0]);
}

/**
 * Sanitise a parsed result into the canonical shape.
 */
function normalize(raw) {
  return {
    detected: Boolean(raw.detected),
    type: raw.type ?? null,
    confidence:
      typeof raw.confidence === 'number'
        ? Math.min(1, Math.max(0, raw.confidence))
        : raw.detected
          ? 0.9
          : 0,
  };
}

/**
 * Check whether a label string matches any known insect keyword.
 * Used by Google Cloud Vision and Clarifai (label-based APIs).
 */
function isInsectLabel(label) {
  const lower = label.toLowerCase();
  return INSECT_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
}

const INSECT_KEYWORDS = [
  'insect', 'bug', 'spider', 'arachnid', 'cockroach', 'roach',
  'ant', 'beetle', 'centipede', 'millipede', 'grasshopper', 'cricket',
  'mosquito', 'fly', 'flies', 'wasp', 'bee', 'hornet', 'caterpillar',
  'larva', 'larvae', 'maggot', 'grub', 'worm', 'tick', 'mite',
  'louse', 'lice', 'flea', 'moth', 'dragonfly', 'termite', 'pest',
  'arthropod', 'invertebrate', 'butterfly',
];

// ---------------------------------------------------------------------------
// Claude Vision
// ---------------------------------------------------------------------------

export async function callClaude(apiKey, imageBase64, mimeType = 'image/jpeg') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 },
            },
            { type: 'text', text: SCAN_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude ${res.status}: ${body}`);
  }

  const data = await res.json();
  return normalize(extractJson(data.content[0].text));
}

// ---------------------------------------------------------------------------
// Gemini Flash
// ---------------------------------------------------------------------------

export async function callGemini(apiKey, imageBase64, mimeType = 'image/jpeg') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: SCAN_PROMPT },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 100, temperature: 0 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response');
  return normalize(extractJson(text));
}

// ---------------------------------------------------------------------------
// Google Cloud Vision
// ---------------------------------------------------------------------------

export async function callGoogleVision(apiKey, imageBase64) {
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 20 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Cloud Vision ${res.status}: ${body}`);
  }

  const data = await res.json();
  const response = data.responses?.[0];
  if (!response) throw new Error('Google Cloud Vision returned no response');

  // Merge label + object annotations into one list
  const labels = [
    ...(response.labelAnnotations ?? []).map((l) => ({
      name: l.description,
      score: l.score,
    })),
    ...(response.localizedObjectAnnotations ?? []).map((o) => ({
      name: o.name,
      score: o.score,
    })),
  ];

  // Find the highest-confidence insect match
  const insectLabels = labels.filter((l) => isInsectLabel(l.name));
  if (!insectLabels.length) return { detected: false, type: null, confidence: 0 };

  const best = insectLabels.reduce((a, b) => (b.score > a.score ? b : a));
  return normalize({ detected: true, type: best.name, confidence: best.score });
}

// ---------------------------------------------------------------------------
// Clarifai
// ---------------------------------------------------------------------------

export async function callClarifai(apiKey, imageBase64) {
  const url =
    'https://api.clarifai.com/v2/users/clarifai/apps/main/models/general-image-recognition/outputs';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: [{ data: { image: { base64: imageBase64 } } }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clarifai ${res.status}: ${body}`);
  }

  const data = await res.json();
  const concepts = data.outputs?.[0]?.data?.concepts ?? [];

  const insectConcepts = concepts.filter((c) => isInsectLabel(c.name));
  if (!insectConcepts.length) return { detected: false, type: null, confidence: 0 };

  const best = insectConcepts.reduce((a, b) => (b.value > a.value ? b : a));
  return normalize({ detected: true, type: best.name, confidence: best.value });
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Scan an image with a given provider.
 * @param {string} provider  'claude' | 'gemini' | 'googleVision' | 'clarifai'
 * @param {string} apiKey
 * @param {string} imageBase64  base64-encoded image data (no data URI prefix)
 * @param {string} mimeType     e.g. 'image/jpeg' — ignored by label-based APIs
 * @returns {{ detected: boolean, type: string|null, confidence: number }}
 */
export async function scanImage(provider, apiKey, imageBase64, mimeType = 'image/jpeg') {
  switch (provider) {
    case 'claude':       return callClaude(apiKey, imageBase64, mimeType);
    case 'gemini':       return callGemini(apiKey, imageBase64, mimeType);
    case 'googleVision': return callGoogleVision(apiKey, imageBase64);
    case 'clarifai':     return callClarifai(apiKey, imageBase64);
    default:             throw new Error(`Unknown provider: ${provider}`);
  }
}

// ---------------------------------------------------------------------------
// Key tester  (used in onboarding step 4 + settings)
// ---------------------------------------------------------------------------

// Minimal valid 1×1 grey PNG — just enough to send a real request to each API
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Verify that an API key is valid by sending a tiny test image.
 * Returns { ok: boolean, error: string|null }
 */
export async function testApiKey(provider, apiKey) {
  try {
    await scanImage(provider, apiKey, TEST_IMAGE_BASE64, 'image/png');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
