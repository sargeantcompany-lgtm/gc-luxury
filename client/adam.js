// Shared behaviour for the Adam-styled pages (index, about, contact):
// footer year, top bar turning solid on scroll, and fade-up on scroll.
(function () {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const nav = document.getElementById("nav");
  if (nav) {
    // Pages without the full-screen hero get a solid bar straight away.
    const hasHero = !!document.querySelector(".hero");
    const onScroll = () => nav.classList.toggle("scrolled", !hasHero || window.scrollY > window.innerHeight * 0.6);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("in"));
  }
})();
