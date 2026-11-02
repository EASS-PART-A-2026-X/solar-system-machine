# Execution graph (dependency-injection view)

Each node is a provider. It declares what it PROVIDES (its token) and what it INJECTS.
A node may run as soon as every injected token resolves. Nothing reaches into another
node's files: it only consumes the provided token.

## Tokens
| Token            | Type                                  | Provided by |
|------------------|---------------------------------------|-------------|
| `Sync`           | ws://localhost:1234 (Hocuspocus)      | lead        |
| `Chat`           | Plate doc `solar-team-chat` (__post/__log) | lead (needs Sync) |
| `Root`           | human orders in Chat (`root:` lines)  | user        |
| `Facts`          | product/data.js `{SUN, PLANETS}`      | lead        |
| `Shell`          | product/index.html: #stage, #labels, #copy, importmap | lead |
| `Brief`          | brief.md + this file                  | lead        |
| `Anchors`        | `window.__labelAnchors [{name,x,y,r}]` per frame | A |
| `Scene`          | scene.js render in #stage             | A           |
| `Editorial`      | style.css + labels.js + #copy         | B           |
| `Review(n)`      | critiques round n, posted in Chat     | C           |
| `Approval`       | "C: APPROVED" or final verdict        | C           |
| `Release`        | verified page + screenshots + chat log | lead       |

## Providers
```
lead.setup  : ()                              -> Sync, Chat, Facts, Shell, Brief
A.scene     : (Shell, Facts, Brief, Chat, Root?, Review*)  -> Scene, Anchors
B.editorial : (Shell, Facts, Brief, Chat, Root?, Review*, Anchors?) -> Editorial
C.review    : (Scene, Editorial, Facts, Chat, Root?)       -> Review(n), Approval
lead.verify : (Approval, A.done, B.done, Chat)             -> Release
```
`?` = optional injection (node works without it; B renders no labels until Anchors exists).
`*` = re-injected each round (feedback edge).

## Graph
```
            user ──Root──────────────┐ (overrides every node)
                                      ▼
lead.setup ─┬─ Sync ─► Chat ◄──────────────► all nodes (the only bus)
            ├─ Facts ─────┬──────────┬──────────┐
            ├─ Shell ─────┤          │          │
            └─ Brief ─────┤          │          │
                          ▼          ▼          ▼
                      A.scene ──Anchors──► B.editorial
                          │                     │
                        Scene               Editorial
                          └────────┬────────────┘
                                   ▼
                               C.review ──Review(n)──┐  (cycle, n ≥ 2, ~15 min cap)
                                   │                 └──► A.scene, B.editorial
                                Approval
                                   ▼
                              lead.verify ──► Release
```

## Execution phases
1. Resolve roots: lead.setup (sequential, done).
2. Fan out: A, B, C start in parallel; C blocks on Scene + Editorial (polls Chat for "v1 up").
3. Feedback cycle: Review(n) is injected back into A and B; they re-provide Scene/Editorial.
   Exit when Approval resolves (or the time cap forces a final verdict).
4. Fan in: lead.verify needs Approval + A.done + B.done, re-checks independently, emits Release.

## Rules (the DI contract)
- Depend on tokens, never on another node's internals or files.
- A node that changes its provided token announces it in Chat ("A: Anchors shape changed").
- Root is the highest-priority injection: any node that sees a root line handles it first.
- Optional deps must degrade gracefully (missing Anchors = no labels, no crash).
