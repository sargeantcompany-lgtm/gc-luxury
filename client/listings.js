// Renders GC Luxury listings into any element with data-listing-type
// ("listing" or "off_market"), on both the homepage and listings.html.
// Optional attributes on that element:
//   data-limit="6"          show at most N
//   data-empty="#some-id"   element to reveal when there are none
//   data-section="#some-id" element to reveal only when there ARE some

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLabel(listing) {
  if (listing.status === "under_offer") return "Under Offer";
  if (listing.status === "sold") return "Sold";
  return listing.listing_type === "off_market" ? "Off-Market" : "Available";
}

function videoEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null; // not a known embed host - treated as a direct video file instead
}

function listingMedia(listing) {
  const title = escapeHtml(listing.title);
  if (listing.video_url) {
    const embedUrl = videoEmbedUrl(listing.video_url);
    if (embedUrl) {
      return `<iframe class="listing-card-video" src="${escapeHtml(embedUrl)}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    return `<video class="listing-card-video" src="${escapeHtml(listing.video_url)}" controls></video>`;
  }
  const photo = Array.isArray(listing.photos) && listing.photos[0] ? listing.photos[0] : null;
  if (photo) return `<img src="${escapeHtml(photo)}" alt="${title}" class="listing-card-photo" loading="lazy">`;
  return `<div class="listing-card-photo listing-card-photo--empty"></div>`;
}

function listingCard(listing) {
  const card = document.createElement("article");
  card.className = "listing-card";
  const enquireText = listing.listing_type === "off_market" ? "Enquire privately" : "Enquire";
  card.innerHTML = `
    ${listingMedia(listing)}
    <div class="listing-card-body">
      <span class="listing-status listing-status--${escapeHtml(listing.status)}">${statusLabel(listing)}</span>
      <div class="listing-suburb">${escapeHtml(listing.suburb || "Gold Coast")}</div>
      <h3 class="listing-title">${escapeHtml(listing.title)}</h3>
      <div class="listing-price">${escapeHtml(listing.price_guide || "Price on application")}</div>
      ${listing.description ? `<p class="listing-desc">${escapeHtml(listing.description)}</p>` : ""}
      ${listing.status !== "sold" ? `<a class="listing-enquire" href="/contact.html">${enquireText} &rarr;</a>` : ""}
    </div>
  `;
  return card;
}

function reveal(selector) {
  const el = selector && document.querySelector(selector);
  if (el) {
    el.hidden = false;
    el.style.display = "";
  }
}

async function renderListings(grid) {
  const type = grid.dataset.listingType;
  const limit = parseInt(grid.dataset.limit, 10) || 0;
  try {
    const res = await fetch(`/api/gc-listings?status=active&type=${encodeURIComponent(type)}`);
    const listings = await res.json();
    if (!Array.isArray(listings)) throw new Error("Bad response");
    const shown = limit ? listings.slice(0, limit) : listings;
    shown.forEach((listing) => grid.appendChild(listingCard(listing)));
    reveal(shown.length ? grid.dataset.section : grid.dataset.empty);
  } catch {
    const empty = grid.dataset.empty && document.querySelector(grid.dataset.empty);
    if (empty) {
      empty.textContent = "Couldn't load properties right now — please try again shortly.";
      reveal(grid.dataset.empty);
    }
  }
}

document.querySelectorAll("[data-listing-type]").forEach(renderListings);
