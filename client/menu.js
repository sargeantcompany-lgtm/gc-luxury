// Site-wide right-hand menu (styles in /menu.css). Every public page loads
// this, so the menu is edited in one place.
(function () {
  const LINKS = [
    ["Home", "/"],
    ["About Adam", "/about.html"],
    ["Off-Market", "/#off-market"],
    ["Listings", "/listings.html"],
    ["Blog", "/blog.html"],
    ["Pre-List Kit", "/pre-list-kit.html"],
    ["Make an Offer", "/adam/offer"],
    ["GC Luxury Connector", "/connector"],
    ["Contact", "/contact.html"],
  ];

  const here = location.pathname === "/index.html" ? "/" : location.pathname;
  const isCurrent = (href) => {
    if (href.includes("#")) return false;
    if (href === "/blog.html" && here === "/post.html") return true;
    return href === here;
  };

  const menu = document.createElement("aside");
  menu.className = "side-menu";
  menu.id = "side-menu";
  menu.setAttribute("aria-label", "Site menu");
  menu.innerHTML = `
    <a class="side-brand" href="/">Adam Sargeant<small>GC Luxury &middot; Ray White</small></a>
    <nav class="side-links">
      ${LINKS.map(([label, href]) =>
        `<a href="${href}"${isCurrent(href) ? ' aria-current="page"' : ""}>${label}</a>`
      ).join("")}
    </nav>
    <div class="side-contact">
      <a href="tel:0407739919">0407 739 919</a>
      <a href="mailto:adam.sargeant@raywhite.com">adam.sargeant@raywhite.com</a>
    </div>
  `;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "side-toggle";
  toggle.textContent = "Menu";
  toggle.setAttribute("aria-controls", "side-menu");
  toggle.setAttribute("aria-expanded", "false");

  const scrim = document.createElement("div");
  scrim.className = "side-scrim";

  function setOpen(open) {
    document.body.classList.toggle("side-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
  }

  toggle.addEventListener("click", () => setOpen(!document.body.classList.contains("side-open")));
  scrim.addEventListener("click", () => setOpen(false));
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });

  document.body.classList.add("has-side-menu");
  document.body.append(menu, scrim, toggle);
})();
