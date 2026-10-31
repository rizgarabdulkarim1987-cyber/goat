// Phones and narrow tablets get the home page as a normal scrolling page; wider windows get the scrolling film.
const NARROW = matchMedia("(max-width: 820px)");
const narrow = NARROW.matches;
// turning the device across the breakpoint swaps to the other version
NARROW.addEventListener("change", () => location.reload());
if (narrow) import("./pages/home.js"); else import("./main.js");
