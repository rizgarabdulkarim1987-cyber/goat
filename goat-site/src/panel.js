const STORE = "goat-panel-v1";

// the circles' pictures are changed from the backend admin page (Circles)
const IMAGES = [];

function load() {
  try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

export function mountPanel({ settings, onSpeed, onScrub, onColors, onImage }) {
  const saved = load();
  Object.assign(settings, saved.settings || {});

  const root = document.createElement("div");
  root.id = "panel";
  root.innerHTML = `
    <div class="body">
      <h4>Scroll</h4>
      <label>Scroll length <span data-v="speed"></span><input type="range" min="0.5" max="2.5" step="0.05" data-k="speed"></label>
      <label>Smoothing <span data-v="scrub"></span><input type="range" min="0" max="3" step="0.1" data-k="scrub"></label>
      <h4>Colours</h4>
      <label>Light background <input type="color" data-k="whiteBg"></label>
      <label>Dark background <input type="color" data-k="blackBg"></label>
      <label>Accent (red) <input type="color" data-k="red"></label>
      <h4>Images</h4>
      <div data-images></div>
      <button class="reset" type="button">Reset everything</button>
    </div>
    <button class="toggle" type="button" aria-expanded="false">Controls</button>`;
  document.body.appendChild(root);

  const toggle = root.querySelector(".toggle");
  toggle.addEventListener("click", () => {
    const open = root.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  root.querySelectorAll("[data-k]").forEach((input) => {
    const k = input.dataset.k;
    input.value = settings[k];
    const label = root.querySelector(`[data-v="${k}"]`);
    if (label) label.textContent = settings[k];
    input.addEventListener("input", () => {
      settings[k] = input.type === "range" ? Number(input.value) : input.value;
      if (label) label.textContent = settings[k];
      persist();
      if (k === "speed") onSpeed();
      else if (k === "scrub") onScrub();
      else onColors();
    });
  });

  const imgBox = root.querySelector("[data-images]");
  IMAGES.forEach(([key, label, src]) => {
    const row = document.createElement("div");
    row.className = "imgrow";
    const url = saved.images?.[key] || src;
    row.innerHTML = `<img alt="" src="${url}"><span>${label}</span><label class="btn">Replace<input type="file" accept="image/*"></label>`;
    row.querySelector("input").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        row.querySelector("img").src = reader.result;
        onImage(key, reader.result);
        const s = load(); s.images = { ...(s.images || {}), [key]: reader.result }; save(s);
      };
      reader.readAsDataURL(file);
    });
    imgBox.appendChild(row);
    if (saved.images?.[key]) onImage(key, saved.images[key]);
  });

  root.querySelector(".reset").addEventListener("click", () => {
    try { localStorage.removeItem(STORE); } catch { /* ignore */ }
    location.reload();
  });

  function persist() {
    const s = load(); s.settings = { speed: settings.speed, scrub: settings.scrub, whiteBg: settings.whiteBg, blackBg: settings.blackBg, red: settings.red }; save(s);
  }
  onColors();
  onSpeed(); // a saved scroll length must resize the spacer and rebind, same as dragging the slider
}
