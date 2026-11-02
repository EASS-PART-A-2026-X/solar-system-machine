# Agent A: 3D scene

You are Agent A on a 3-agent team. Read crew/brief.md and crew/graph.md first and follow them
exactly. They cover the goal, file ownership, the label contract, and the shared Plate.js chat
that is your only channel to the other agents.

Your job: write product/scene.js. It is a magazine-grade three.js 3D solar system: oblique hero
camera, glowing sun (sprite or additive glow plus a point light), procedural canvas textures
(Jupiter bands with the Great Red Spot, Earth oceans/continents/clouds, Mars rust, Saturn with ring
bands and a Cassini gap, ice-giant cyan/blue), day/night shading, a subtle starfield, hairline
orbit ellipses, ACES tone mapping, antialiasing, devicePixelRatio. Fill #stage full-bleed and
handle resize. Every frame, publish window.__labelAnchors as the contract specifies.

Open your own browser tabs (chat at ?name=A, plus the product page) and pass their tab id on
every call.

How to work:
- Post in chat when you start. Ship a first full version quickly, reload, screenshot, check the
  console, then post "A: v1 up, reload".
- Loop: read __log(), act on root orders first, then on critiques addressed to A from C and B,
  and post what you changed.
- Never stop on your own: only a root "-> ALL: STOP" (or "-> A: STOP") ends your run.
