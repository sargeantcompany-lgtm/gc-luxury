function extractMeta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match) return decodeHtmlEntities(match[1]);
  }
  return null;
}

function extractAllMeta(html, property) {
  const re = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "gi");
  const results = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    results.push(decodeHtmlEntities(match[1]));
  }
  return results;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      blocks.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return blocks;
}

function findPriceInText(html) {
  const match = html.match(/\$[\d,]+(?:\.\d+)?\s*(?:M|million|k)?/i);
  return match ? match[0] : null;
}

async function fetchListingPreview(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let html;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  const jsonLd = extractJsonLd(html);
  let ldPrice = null;
  for (const block of jsonLd) {
    const offers = block.offers || block.Offers;
    if (offers?.price) ldPrice = `$${offers.price}`;
    if (block.price) ldPrice = `$${block.price}`;
  }

  const title = extractMeta(html, "og:title");
  const description = extractMeta(html, "og:description");
  const images = extractAllMeta(html, "og:image");
  const price = ldPrice || findPriceInText(html);

  return {
    address: title || null,
    price_guide: price || null,
    description: description || null,
    photos: images,
    fetched_ok: Boolean(title || description || images.length),
  };
}

module.exports = { fetchListingPreview };
