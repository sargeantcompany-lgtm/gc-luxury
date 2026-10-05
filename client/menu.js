// Site-wide menu (styles in /menu.css), always shown open: a panel on the
// right on wider screens, a scrollable bar across the top on phones. Every
// public page loads this, so the menu is edited in one place.
(function () {
  const LINKS = [
    ["Home", "/"],
    ["Bio", "/about.html"],
    ["Blog", "/blog.html"],
    ["Off-Market", "/off-market.html"],
    ["Going to the Market", "/going-to-the-market.html"],
    ["Make an Offer", "/adam/offer"],
    ["Enquiry", "/contact.html"],
  ];

  const here = location.pathname === "/index.html" ? "/" : location.pathname;
  const isCurrent = (href) => {
    if (href.includes("#")) return false;
    if (href === "/blog.html" && here === "/post.html") return true;
    return href === here;
  };

  const menu = document.createElement("aside");
  menu.className = "side-menu";
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

  document.body.classList.add("has-side-menu");
  document.body.prepend(menu);

  // On the phone bar, scroll the current page's link into view.
  const current = menu.querySelector('[aria-current="page"]');
  if (current) current.scrollIntoView({ block: "nearest", inline: "center" });
})();
