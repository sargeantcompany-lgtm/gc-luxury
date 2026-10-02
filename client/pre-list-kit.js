// Pre-List Kit flipbook. Page images are pre-rendered from the source PDF into
// /pre-list-kit/page-NN.jpg - re-render them if the kit changes.
const PAGE_COUNT = 24;
const pages = Array.from({ length: PAGE_COUNT }, (_, i) =>
  `/pre-list-kit/page-${String(i + 1).padStart(2, "0")}.jpg`
);

const counter = document.getElementById("flip-count");
const container = document.getElementById("flipbook");

// HTML mode rather than loadFromImages(): the canvas renderer paints the empty
// half beside the cover white, which looks wrong on the dark site.
const pageEls = pages.map((src, i) => {
  const page = document.createElement("div");
  page.className = "flipbook-page";
  if (i === 0 || i === pages.length - 1) page.dataset.density = "hard";
  page.innerHTML = `<img src="${src}" alt="Pre-List Kit page ${i + 1}" loading="${i < 4 ? "eager" : "lazy"}">`;
  container.appendChild(page);
  return page;
});

const book = new St.PageFlip(container, {
  // A4 portrait ratio (595 x 842)
  width: 595,
  height: 842,
  size: "stretch",
  // Below 2x minWidth the book switches to single-page mode (phones).
  minWidth: 280,
  maxWidth: 595,
  minHeight: 396,
  maxHeight: 842,
  showCover: true,
  maxShadowOpacity: 0.4,
  mobileScrollSupport: false,
});

book.loadFromHTML(pageEls);

function updateCount() {
  const current = book.getCurrentPageIndex() + 1;
  counter.textContent = `${current} / ${book.getPageCount()}`;
}

book.on("init", updateCount);
book.on("flip", updateCount);

document.getElementById("flip-prev").addEventListener("click", () => book.flipPrev());
document.getElementById("flip-next").addEventListener("click", () => book.flipNext());

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") book.flipPrev();
  if (e.key === "ArrowRight") book.flipNext();
});
