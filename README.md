# goat

Two parts, two terminals:

| part | folder | port | start |
| --- | --- | --- | --- |
| site (Vite, GSAP, Lenis) | `goat-site` | **5190** | `npx vite --port 5190 --strictPort` |
| backend (Node + Express) | `backend` | **4100** | `npm start` |

```bash
# terminal 1: backend (first time: npm install)
cd backend
npm install
npm start            # http://localhost:4100

# terminal 2: site
cd goat-site
npm install
npx vite --port 5190 --strictPort    # http://localhost:5190
```

The site finds the backend at `http://<same host>:4100`. To point it somewhere else, set `VITE_API_URL`
(for example `VITE_API_URL=https://api.example.com npx vite ...`). The backend allows any origin by default;
set `CORS_ORIGINS=http://localhost:5190,https://goat.example.com` to restrict it, `PORT` to change the port.

If the backend is down the home page still works: it falls back to the static sprite sheets in
`goat-site/public/seq` and the end counters show 24. The other pages show a "backend is not answering" message
with a retry button.

## What the backend serves

| endpoint | what |
| --- | --- |
| `GET /api/clips` , `GET /api/clips/:name` | the circle clips `leapA`, `cheer`, `leapB`, `plant`, `eye`: the same metadata `src/seq.js` holds (`t0 t1 fps n cols rows w h cell keys round`) plus `frames`, one JPEG url per frame |
| `GET /frames/<clip>/0000.jpg` | the frame images (static, cached) |
| `GET /api/counters` | `{ Prject, client, staff, years }`, the four numbers the end reels roll to |
| `PUT /api/counters` | edit them (admin key, below) |
| `GET /api/work`, `/api/work/:slug` | work items (`?category=` filters) |
| `GET /api/blog`, `/api/blog/:slug` | blog posts (the list has no bodies) |
| `GET /api/about`, `/api/music`, `/api/social` | page content |
| `GET /api/search?q=` | searches work, blog and about |
| `POST /api/contact` | stores a contact message (`name`, `email`, `message`, optional `topic`) in `backend/data/messages.json` |
| `GET /api/messages` | read stored messages (admin key) |
| `GET /api/health` | `{ ok: true }` |
| `GET /api/content` | every word of the home page and the menu / buttons / form of the other pages (`texts`), and the loose pictures (`images`), in `?lang=` |
| `PUT /api/content?lang=` | change words, `{ "texts": { "creative": "new", "ideas": null } }`; `null` puts the original back (admin key) |
| `GET /api/media`, `PUT /api/media/:key` | the loose pictures (`logoCircle`, `logoText`) and the sprite sheets (`hero1 hero2 goat hillrise`); upload a picture as multipart field `file` (admin key) |
| `PUT /api/clips/:name` | a circle's timing: `t0 t1 fps keys` (admin key) |
| `POST /api/clips/:name/video` | replace a circle with a **video**: cut at the clip's fps, centre-cropped square, scaled to the clip's size (multipart `file`; `?from=` start second; `?fit=1` moves the clip's end to the end of the footage) |
| `POST /api/clips/:name/frames` | replace a circle with a **set of pictures** (multipart `files`, taken in file-name order, same crop and scale) |
| `GET /admin` | the admin page (below) |

Every page endpoint (`about work blog music social search`), `content` and `contact` take `?lang=en|ar|ckb`.

### Admin page

Open **http://localhost:4100/admin** and sign in with the admin key (`goat-admin` by default). Tabs:

- **Words**: every word of the home page plus the menu, headings, buttons and form messages of the other pages, in English, عربي or کوردی (pick the language at the top; the English is shown under each id as the thing being translated). Save, then reload the site. Small words that move on their own (`wTo`, `hw.of`, ...) can be left empty if a language does not need them.
- **Numbers**: the four end counters.
- **Pictures**: replace the logo and the four baked sprite sheets. Pictures for round places (a raster `logoCircle`) are cut to a centred square with a round edge on upload; an SVG logo is kept as it is. Circle clips uploaded as video or frames are centre-cropped square the same way. Sprite sheets (a sheet keeps its grid: same columns, rows and cell size).
- **Circles**: for `plant`, `eye`, `leapA`, `cheer`, `leapB` and the four circles of the work scene, `can1` to `can4` (can1 crosses the page, can2 is the big centre one, can3 the small blurred one on the left, can4 comes in last; each can be one picture, a set of frames or a video that loops between its t0 and t1; their movement is fixed): upload a video or a set of pictures, change when the circle appears and leaves (`t0`, `t1`), its fps. "Move the end to fit" sets `t1` to the end of the new footage; otherwise the timeline is left alone.
- **Messages**: what came in through the contact page.

Video and picture uploads use ffmpeg (the `ffmpeg-static` package, or set `FFMPEG_PATH`); at most 720 frames. What is **not** editable text: the marquee word on the home page and the big `goat` / `dream` headline words baked into the `hero1` / `hero2` sheets (replace those as pictures).

### Languages

The site speaks English, Arabic and Sorani Kurdish. The switch (`EN عربي کوردی`) sits top right of the fixed column on every page; the choice is kept in the browser (`?lang=ar` also sets it). Arabic and Kurdish pages read right to left (the nav column stays on the left); the home page keeps its composition and only the words change. `?lang=` on the API falls back to English for anything a language does not have.

- Words: `data/content.json` (English), `content.ar.json`, `content.ckb.json`; the originals ("original" button) are `content.defaults*.json`.
- Pages: `about.json`, `work.json`, `blog.json`, `music.json` have `about.ar.json`, `about.ckb.json` and so on next to them (same slugs; `social.json` is shared). Edit those files directly; no restart needed.
- Arabic and Kurdish text uses a system font (Noto Sans Arabic if installed, else Tahoma / Segoe UI), so everything works offline. The whole project needs the internet only for `npm install`.

### Editing content

Everything lives in `backend/data/*.json` and is read on every request, so edit a file and reload; no restart.

- **Counters**: edit `data/counters.json`, or from a shell:

  ```bash
  curl -X PUT http://localhost:4100/api/counters -H "Content-Type: application/json" -H "x-admin-key: goat-admin" -d '{"Prject": 31, "client": 7}'
  ```

  Whole numbers from 0 to 999. Omitted keys stay as they are. The reels on the home page roll to whatever the
  backend holds when the page loads (the default is 24 each, as in the reference video).
- **Admin key**: `goat-admin` unless you set `ADMIN_KEY` before starting. Change it before the backend is reachable by anyone else.
- **Messages**: `curl -H "x-admin-key: goat-admin" http://localhost:4100/api/messages` or open `data/messages.json`.
- **Work, blog, about, music, social**: `data/work.json`, `blog.json`, `about.json`, `music.json`, `social.json` (and their `.ar` / `.ckb` versions).

### Re-baking the frames

The frames are extracted from the reference video with the same crops and fps as the sprite sheets
(`goat-site/bake.py` shares one tile function for both). They use the tracked paths stored in `src/seq.js`,
so a frame is the picture its sheet cell holds. To rebuild them:

```bash
cd goat-site
python -I bake.py frames            # all five circle clips
python -I bake.py frames plant eye  # just these
```

This rewrites `backend/data/frames/<clip>/` and `backend/data/clips.json`. The headline, hill and walking-goat
clips (`hero1`, `hero2`, `hillrise`, `goat`) stay sprite sheets (kind `sheet` in `clips.json`, served from `data/media/seq`); they are not circles and are replaced as pictures. The plant and eye frames have their burnt-in headline text painted out: the words are page text that rises behind/over the circle.

## Deploying (one Node server)

The repository root is one Node app: `npm run build` builds the site (`goat-site/dist`), `npm start` runs `backend/src/server.js`, which serves the built pages **and** the API from the same address (so the site finds the API without any setting). Root `package.json` carries the dependencies of both parts; `goat-site` and `backend` keep their own for local work.

Environment variables on the host:

| variable | what |
| --- | --- |
| `NODE_ENV=production` | listens even when started through a process manager, and **disables the default admin key** |
| `ADMIN_KEY` | the admin password (required: without it nobody can sign in to `/admin`) |
| `DATA_DIR` | a folder **outside** the deployed one, for example `/home/<user>/goat-data`. Everything edited in the admin (words, pictures, circles, messages) lives there, so a new deploy never overwrites it. The first start copies the bundled `backend/data` into it |
| `PORT` | set by the host |

To publish edits made on the live site back to the repository, copy the files from `DATA_DIR` over `backend/data` (not `messages.json`, which is never committed).

## Pages

`index.html` is the scrolling home page. Its fixed nav links to `about.html`, `work.html`, `contact.html`,
`blog.html` (`?post=<slug>` for one post), `music.html`, `search.html` and `social.html`. Every page links
back home from the logo, the `home` item and a "back to home" link at the bottom. `vite build` builds all of them.

Each page has its own look taken from a scene of the home page (the body carries `data-page`, the styles are at the end of `src/pages.css`): about is the plant scene with a big circle under a centred headline, work the white "latest works" scene with a row of can circles, contact the red "hire goat?" scene, blog an editorial page with a small circle in concentric rings, music a circle with pulsing rings and wave lines, search a big lens holding the goat's eye, social the red page with black rings. All share the home page's circle with a ring and orbiting dot, a ghost word, hairlines that draw themselves, and words that rise in as you scroll (all off when the system asks for reduced motion).

## Checks

```bash
cd backend && npm test                                   # API tests
cd goat-site
python -I compare.py 0.5 34 42 chk     # plant scene   -> cmp/chk_*.png
python -I compare.py 0.5 8 24 chk2     # runner scenes -> cmp/chk2_*.png
```

Run the compare scripts with both servers up: the plant and runner circles are drawn from the backend's frames.

### Shipping better pictures with a deploy

`backend/data/release.json` is `{ "version": N, "replace": [clip names] }`. When a server's data folder (`DATA_DIR`) has an older version, the next start replaces just those clips (frames, sheets, timing) from the deployed copy and leaves everything else edited in the admin page alone. Raise `version` and list the clips whenever you re-bake pictures with `goat-site/bake.py`.
