const grid = document.getElementById("listings-grid");
const empty = document.getElementById("listings-empty");

function statusLabel(status) {
  if (status === "under_offer") return "Under Offer";
  if (status === "sold") return "Sold";
  return "Available";
}

function listingCard(listing) {
  const photo = Array.isArray(listing.photos) && listing.photos[0] ? listing.photos[0] : null;
  const card = document.createElement("article");
  card.className = "listing-card";
  card.innerHTML = `
    ${photo ? `<img src="${photo}" alt="${listing.title}" class="listing-card-photo">` : `<div class="listing-card-photo listing-card-photo--empty"></div>`}
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
