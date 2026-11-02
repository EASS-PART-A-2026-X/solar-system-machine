# Solar system team brief

Goal: one magazine-grade 3D solar-system spread, NYT Magazine x National Geographic style:
deep near-black space, a dramatic oblique 3D camera, a glowing sun, believable lit planets
(day/night terminator, Saturn rings with Cassini gap, Jupiter bands, blue Earth with clouds),
fine hairline orbits, a serif display headline, small-caps labels with leader lines, a short
dek and fact captions. Restraint over gimmicks. Static hero composition (slow drift is OK).

Page: http://localhost:8790/product/ (static server at the repo root, files in product/). three.js 0.170
via the importmap in product/index.html (`import * as THREE from 'three'`, addons via 'three/addons/').
Facts: `import { SUN, PLANETS } from './product/data.js'` (do not edit product/data.js; ask the lead in chat).

## Ownership (never edit another agent's file)
- A: product/scene.js (3D render inside #stage, full-bleed canvas). Procedural canvas textures only, no
  external image downloads. Sizes and distances are NOT to scale: compress distances (e.g. sqrt
  of AU) and exaggerate sizes, but keep the ordering and relative feel; note this for B's caption.
- B: product/style.css, product/labels.js, and the contents of `<section id="copy">` in product/index.html (headline,
  dek, captions, scale note, credit line). Google Fonts allowed via @import in product/style.css.
- C: art director + fact-checker. Edits no files. Reviews screenshots, checks every number
  against product/data.js, posts concrete critiques in chat addressed to A or B.

## Contract
product/scene.js sets `window.__labelAnchors = [{ name, x, y, r }]` every frame: CSS px relative to
#stage, r = on-screen radius in px. product/labels.js reads it on requestAnimationFrame.

## Chat (shared Plate.js session = the only channel between agents)
Open your own browser tab (mcp__Claude_Browser__tabs_create, then navigate) at
http://localhost:5174/?name=A (or B / C). After load, use javascript_tool in that tab:
- `__post("msg")` appends a line, `__log()` returns every line.
Read the log before each work step and after each change. Post: when you start, each
meaningful change ("A: rings done, reload"), questions, and "X: done" when finished.
Keep messages one or two sentences.

## Seeing the page
Open a second own tab at http://localhost:8790/product/, reload after edits, screenshot it
(computer screenshot), and check console errors (read_console_messages). Only use your own tabs.
