// Shared by blog.html (all posts), post.html (one post) and index.html (latest
// posts teaser). Each page includes only the container element it needs.

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

// Post bodies are plain text: blank lines separate paragraphs, and a block
// starting with "## " is a subheading.
function renderBody(body) {
  return String(body || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) =>
      block.startsWith("## ")
        ? `<h2>${escapeHtml(block.slice(3))}</h2>`
        : `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

function postCard(post) {
  const link = `/post.html?slug=${encodeURIComponent(post.slug)}`;
  const cover = post.cover_image
    ? `<img src="${escapeHtml(post.cover_image)}" alt="" class="listing-card-photo" loading="lazy">`
    : `<div class="listing-card-photo listing-card-photo--empty"></div>`;
  const card = document.createElement("a");
  card.className = "listing-card blog-card";
  card.href = link;
  card.innerHTML = `
    ${cover}
    <div class="listing-card-body">
      <div class="listing-suburb">${formatDate(post.published_at)}</div>
      <h3 class="listing-title">${escapeHtml(post.title)}</h3>
      ${post.excerpt ? `<p class="listing-desc">${escapeHtml(post.excerpt)}</p>` : ""}
      <span class="blog-read-more">Read more &rarr;</span>
    </div>
  `;
  return card;
}

async function renderPostList(grid, limit) {
  const res = await fetch(`/api/gc-blog${limit ? `?limit=${limit}` : ""}`);
  const posts = await res.json();
  if (!Array.isArray(posts)) throw new Error("Bad response");
  posts.forEach((post) => grid.appendChild(postCard(post)));
  return posts.length;
}

async function initBlogIndex() {
  const grid = document.getElementById("blog-grid");
  const empty = document.getElementById("blog-empty");
  try {
    if (!(await renderPostList(grid))) empty.style.display = "block";
  } catch {
    empty.textContent = "Couldn't load articles right now — please try again shortly.";
    empty.style.display = "block";
  }
}

// Homepage teaser - shows a "coming soon" note when nothing is published yet.
async function initBlogTeaser() {
  const empty = document.getElementById("blog-teaser-empty");
  try {
    if (!(await renderPostList(document.getElementById("blog-teaser-grid"), 3))) empty.hidden = false;
  } catch {
    empty.hidden = false;
  }
}

async function initPost() {
  const article = document.getElementById("post");
  const slug = new URLSearchParams(location.search).get("slug");
  try {
    if (!slug) throw new Error("missing slug");
    const res = await fetch(`/api/gc-blog/${encodeURIComponent(slug)}`);
    if (!res.ok) throw new Error("not found");
    const post = await res.json();
    document.title = `${post.title} | GC Luxury`;
    article.innerHTML = `
      <div class="post-meta">${formatDate(post.published_at)}</div>
      <h1 class="post-title">${escapeHtml(post.title)}</h1>
      ${post.cover_image ? `<img src="${escapeHtml(post.cover_image)}" alt="" class="post-cover">` : ""}
      <div class="post-body">${renderBody(post.body)}</div>
    `;
  } catch {
    article.innerHTML = `<p class="listings-empty">This article couldn't be found. <a href="/blog.html">Back to the Blog</a></p>`;
  }
}

if (document.getElementById("blog-grid")) initBlogIndex();
if (document.getElementById("blog-teaser-grid")) initBlogTeaser();
if (document.getElementById("post")) initPost();
