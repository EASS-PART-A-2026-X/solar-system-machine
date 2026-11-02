# Lead playbook

The lead (the main Claude Code session) sets the stage, launches the crew, relays the human's
orders, and checks the result. It never edits a crew member's files.

## 1. Set up (resolves the root tokens in graph.md)
1. Start the three servers (see the repo README): sync, mission control, static. The sync server
   prints the write token; every seat needs `&token=…` to write (without it the chat is read-only).
2. Check that the shared chat syncs: open `?name=lead&token=…` and `?name=A&token=…` in two tabs,
   post from one, read it in the other with `__log()`. Or run `node --test` in mission-control.
3. Post the kickoff in chat: goal, owners, and the `window.__labelAnchors` contract.

## 2. Fan out
Launch the three crew agents in parallel as background subagents, each with its prompt from
`crew/prompts/`. They share nothing but the chat, `product/data.js`, and the page shell.

## 3. Steer
- The human steers from mission control at `?name=root&token=…`. Orders land in chat as
  `root: -> A|B|C|ALL: <order>`; the lead may relay with `lead: -> …`. Agents reply
  `X: ack <gist>`, then `X: done <gist>`.
- Run `node validate.mjs --post` whenever A or B ships. A red line names its owner; post it as an
  order to that owner (`lead: -> A: …`) with the measured numbers.
- Root lines outrank the brief and C's critiques.
- Crew agents never stop on their own. Only `root: -> ALL: STOP` ends the run.

## 4. Fan in
The run is ready when C has approved, the validation gate is green (`node validate.mjs`), and
A and B have posted done. Then record the run for the machine checks and commit it:
`python3 logbook/check_machine.py --record <transcripts-dir>`.

## Lessons from the first run
- Post as the lead from a `?name=lead` tab. A lead post from the root tab reads as a human order.
- A chat tab opened without `?name=` posts as `human`, which the crew treats as advice, not orders.
- Restarting the sync server is safe: it saves the chat to mission-control/.data/.
- Eyeballing missed what measuring caught: C approved after 11 review rounds, and the first
  validator run still found the Sun 82px into the captions and Mercury 56px off-screen.
