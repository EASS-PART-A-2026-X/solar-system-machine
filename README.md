# Solar System Machine

A product, the machine that builds it, and the mission control that steers the machine.

![The product: "The Sun's Company", a 3D solar system spread](product/screenshot.jpg)

- **The product** is a magazine-style 3D solar system, the kind of spread NYT Magazine or National
  Geographic would run.
- **The machine** is a crew of three AI agents that builds the product. They talk only through a
  shared [Plate.js](https://platejs.org) document, and every agent owns its own files.
- **Mission control** is where a human watches the machine and steers it: status, orders, STOP.

The repo holds all three, so you can read how the product was made, run the machine again, or
point it at a different product.

| Layer | Directory | What it is |
|---|---|---|
| Product | [`product/`](product/) | The spread: a three.js scene, an editorial overlay, NASA fact captions, and Night / Print / Nat Geo themes. |
| Machine | [`crew/`](crew/) | How the machine is built: the brief, the dependency graph, each agent's prompt, the lead's playbook, and the architecture diagram. |
| Machine | [`logbook/`](logbook/) | What the machine did: chat history, a ledger of every agent action, full agent logs, and a comic-book replay. |
| Mission control | [`mission-control/`](mission-control/) | The shared Plate.js chat the machine runs on (Yjs over a Hocuspocus server), and the human's control panel. |

## How it fits together

![Solar System Machine architecture](crew/architecture.svg)

Source: [`crew/architecture.excalidraw`](crew/architecture.excalidraw). Open it at
[excalidraw.com](https://excalidraw.com) to edit.

- **Mission control → machine:** orders go into the shared chat as
  `root: -> A|B|C|ALL: <order>`. They outrank everything else the agents are working on.
- **Inside the machine:** the lead launches three agents. A builds the 3D scene, B the
  typography, labels and copy, and C reviews and fact-checks without editing anything.
- **Machine → product:** A and B each write only their own files in `product/`. They hand off
  through named "tokens", never through each other's files. For example, A publishes
  `window.__labelAnchors` and B's labels follow it. [`crew/graph.md`](crew/graph.md) lays these
  hand-offs out as a dependency-injection graph.
- **Machine → mission control:** the logbook turns agent transcripts and the chat into the
  status feed the control panel shows.

## What it looks like

**Mission control.** Live status for each agent, an order box for one agent or all of them,
quick commands, STOP ALL, and a live preview of the product.

![Mission control](mission-control/screenshot.jpg)

**The comic replay.** The logbook turns the team chat into a comic, one panel per message, with
a short headline in each bubble and the full message on hover. Pick a style at the top of the
page or with `?style=`. The characters are original designs; each style is a homage, not a copy.

| Style | `?style=` | Inspired by |
|---|---|---|
| Spidey comic | `spidey` | Classic Spider-Man comic books |
| Springfield | `springfield` | The Simpsons |
| Sitcom café | `sitcom` | Friends |
| Secret lab | `lab` | Dexter's Laboratory |
| Snooker hall '75 | `snooker` | Hagiga B'Snuker (1975), with Hebrew captions |

| | |
|---|---|
| ![Spidey comic](logbook/comic-spidey.jpg) | ![Springfield](logbook/comic-springfield.jpg) |
| ![Sitcom café](logbook/comic-sitcom.jpg) | ![Secret lab](logbook/comic-lab.jpg) |
| ![Snooker hall '75](logbook/comic-snooker.jpg) | |

## Run it

You need Node 20+ and Python 3. Run each command in its own terminal, from the repo root:

```bash
npm --prefix mission-control install
```

```bash
npm --prefix mission-control run sync
```

```bash
npm --prefix mission-control run dev
```

```bash
python3 -m http.server 8790
```

| URL | What |
|---|---|
| http://localhost:8790/product/ | The product |
| http://localhost:5174/?name=root | Mission control: agent status, orders, STOP, live preview |
| http://localhost:5174/?name=A | A crew member's seat in the chat (A, B, C or lead) |
| http://localhost:8790/logbook/ | Chat history, ledger and agent logs |
| http://localhost:8790/logbook/comic.html | The run replayed as a comic book (add `?style=springfield`, `sitcom`, `lab` or `snooker`) |

The logbook pages are generated from the crew's transcripts. To keep them updated during a run:

```bash
python3 logbook/build_logs.py ~/.claude/projects/<project>/<session>/subagents
```

## Run the machine

The crew is Claude Code subagents run by a lead session. Follow [`crew/lead.md`](crew/lead.md):
start the servers, check that the chat syncs, then launch the three agents in parallel with
their prompts from [`crew/prompts/`](crew/prompts/). To build a different product, change the
brief, the prompts and `product/`. Mission control and the logbook stay the same.

## Steer it

From mission control, send an order to one agent or to all of them. Each agent replies `ack`
straight away and `done` when finished, and the panel shows every order as pending or acked.
Agents never stop on their own: **STOP ALL** ends the run.

## Known issues

- At some viewport sizes the Sun overlaps the fact captions (seen at 1440×1000, and in the
  mission-control preview). The art director's review checked fixed widths by eye and missed it.
- On narrow screens Neptune can touch the right edge, and labels hide when planets bunch up
  (about 6 of 9 shown on a phone).

## Data and credits

Planet facts are from NASA's Planetary Fact Sheet, in [`product/data.js`](product/data.js).
Sizes and distances are not to scale. The comic characters are original designs.
