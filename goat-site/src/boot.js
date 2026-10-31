// Phones and narrow tablets get the home page as a normal scrolling page; wider windows get the scrolling film.
// (The two imports sit in separate statements so the bundler lists each one's own scripts and styles to preload.)
const NARROW = matchMedia("(max-width: 820px)");
// turning the device across the breakpoint swaps to the other version
NARROW.addEventListener("change", () => location.reload());
if (NARROW.matches) {
  await import("./pages/home.js");
} else {
  await import("./main.js");
}
