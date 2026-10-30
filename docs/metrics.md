# Mi Casa: metrics

The demo collects no analytics. This is the plan for measuring the product if it were offered to other households.

## North star

**Weeks in which both parents opened the hub at least three times.** One parent using it alone means the shared board isn't shared.

## Input metrics

| Metric | Why it matters | Target |
|---|---|---|
| Cards reassigned or moved per active week | The board is being kept true to reality | 3 or more |
| P0 todos closed within 3 days | "Needs attention now" means it | 80% |
| Kid milestones converted to todos before their due date | The kid timeline is acted on, not just read | 90% |
| Share of cards with an owner (not "Unassigned") | Nothing falls through the cracks | 95% |

## Guardrails

| Guardrail | Signal |
|---|---|
| Persistent imbalance | Split outside 45–55% for three weeks running, with no change to cards or hours |
| Score disputes | More than two edits to the Fairness hours in a week |
| Abandonment after setup | Household active in week 1 but not in week 4 |

## Event schema

| Event | Fields |
|---|---|
| `card_moved` | `card_type` (routine, calendar), `from_owner`, `to_owner`, `days_shifted` |
| `todo_changed` | `priority`, `action` (added, done, reprioritized, deleted), `has_due`, `kid_linked` |
| `split_viewed` | `share_a`, `balanced` |
| `hours_edited` | `row_type` (work, commute, coverage, planning), `delta_hours` |

No event carries names, free text or dates of birth.
