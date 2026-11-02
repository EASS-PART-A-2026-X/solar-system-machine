# Agent Mission Control

Three AI agents build a magazine-style 3D solar system together. They talk only through a shared
[Plate.js](https://platejs.org) document, and a human steers them from a mission-control panel.

The repo holds both halves: the **product** the crew builds, and the **system** that builds it.

| Directory | What it is |
|---|---|
| [`product/`](product/) | The deliverable: a three.js solar system in an NYT Magazine x National Geographic style. |
| [`mission-control/`](mission-control/) | The shared Plate.js chat (Yjs over a Hocuspocus server) and the human's control panel. |
| [`crew/`](crew/) | How the crew is organised: the brief, the dependency graph, each agent's prompt, the lead's playbook, and the architecture diagram. |
| [`logbook/`](logbook/) | What happened: chat history, a ledger of every agent action, full agent logs, and a comic-book replay. |

## How it fits together

![Agent Mission Control architecture](crew/architecture.svg)

Source: [`crew/architecture.excalidraw`](crew/architecture.excalidraw). Open it at
[excalidraw.com](https://excalidraw.com) to edit.

Every agent owns its own files and depends only on named hand-offs ("tokens"), never on another
agent's files. [`crew/graph.md`](crew/graph.md) defines them as a dependency-injection graph:
who provides each token, who consumes it, and the order the work runs in.

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
| http://localhost:8790/product/ | The solar system |
| http://localhost:5174/?name=root | Mission control: agent status, orders, STOP, live preview |
| http://localhost:5174/?name=A | A crew member's chat seat (A, B, C or lead) |
| http://localhost:8790/logbook/ | Chat history, ledger and agent logs |
| http://localhost:8790/logbook/comic.html | The run replayed as a comic book |

The logbook pages are generated from the crew's transcripts. To keep them updated during a run:

```bash
python3 logbook/build_logs.py ~/.claude/projects/<project>/<session>/subagents
```

## Launch a crew

The crew is Claude Code subagents run by a lead session. Follow [`crew/lead.md`](crew/lead.md):
start the servers, check that the chat syncs, then launch the three agents in parallel with
their prompts from [`crew/prompts/`](crew/prompts/).

## Steer it

From mission control, send an order to one agent or to all of them. Orders appear in the chat
as `root: -> A: <order>`. Each agent replies `ack` straight away and `done` when finished, and
the panel shows each order as pending or acked. Agents never stop on their own: **STOP ALL** ends
the run.

## Data and credits

Planet facts are from NASA's Planetary Fact Sheet, in [`product/data.js`](product/data.js).
Sizes and distances are not to scale. The comic characters are original designs.
