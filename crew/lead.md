# Lead playbook

The lead (the main Claude Code session) sets the stage, launches the crew, relays the human's
orders, and checks the result. It never edits a crew member's files.

## 1. Set up (resolves the root tokens in graph.md)
1. Start the three servers (see the repo README): sync, mission control, static.
2. Check that the shared chat syncs: open `?name=lead` and `?name=A` in two tabs, post from one,
   read it in the other with `__log()`.
3. Post the kickoff in chat: goal, owners, and the `window.__labelAnchors` contract.

## 2. Fan out
Launch the three crew agents in parallel as background subagents, each with its prompt from
`crew/prompts/`. They share nothing but the chat, `product/data.js`, and the page shell.

## 3. Steer
- The human steers from mission control at `?name=root`. Orders land in chat as
  `root: -> A|B|C|ALL: <order>`; agents reply `X: ack <gist>`, then `X: done <gist>`.
- Root lines outrank the brief and C's critiques.
- Crew agents never stop on their own. Only `root: -> ALL: STOP` ends the run.

## 4. Fan in
The run is ready when C has approved, A and B have posted done, and the lead has checked it
independently: reload the page, screenshot desktop and phone, read console errors, read the
whole chat, and compare it with the agents' reports.

## Lessons from the first run
- Post as the lead from a `?name=lead` tab. A lead post from the root tab reads as a human order.
- A chat tab opened without `?name=` posts as `human`, which the crew treats as advice, not orders.
- Restarting the sync server is safe: open tabs hold the whole document and resync on reconnect.
