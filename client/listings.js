const grid = document.getElementById("listings-grid");
const empty = document.getElementById("listings-empty");

function statusLabel(status) {
  if (status === "under_offer") return "Under Offer";
  if (status === "sold") return "Sold";
  return "Available";
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
  if (listing.video_url) {
    const embedUrl = videoEmbedUrl(listing.video_url);
    if (embedUrl) {
      return `<iframe class="listing-card-video" src="${embedUrl}" title="${listing.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    }
    return `<video class="listing-card-video" src="${listing.video_url}" controls></video>`;
  }
  const photo = Array.isArray(listing.photos) && listing.photos[0] ? listing.photos[0] : null;
  if (photo) return `<img src="${photo}" alt="${listing.title}" class="listing-card-photo">`;
  return `<div class="listing-card-photo listing-card-photo--empty"></div>`;
}

function listingCard(listing) {
  const card = document.createElement("article");
  card.className = "listing-card";
  card.innerHTML = `
    ${listingMedia(listing)}
    <div class="listing-card-body">
      <span class="listing-status listing-status--${listing.status}">${statusLabel(listing.status)}</span>
      <div class="listing-suburb">${listing.suburb || "Gold Coast"}</div>
      <h3 class="listing-title">${listing.title}</h3>
      <div class="listing-price">${listing.price_guide || "Price on application"}</div>
      ${listing.description ? `<p class="listing-desc">${listing.description}</p>` : ""}
    </div>
  `;
  return card;
}

async function init() {
  try {
    const res = await fetch("/api/gc-listings?status=active");
    const listings = await res.json();
    if (!Array.isArray(listings) || !listings.length) {
      empty.style.display = "block";
      return;
    }
    listings.forEach((listing) => grid.appendChild(listingCard(listing)));
  } catch (err) {
    empty.textContent = "Couldn't load listings right now — please try again shortly.";
    empty.style.display = "block";
  }
}

init();
