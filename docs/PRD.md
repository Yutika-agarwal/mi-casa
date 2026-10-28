# Mi Casa: product requirements

## Problem

Two parents with full-time jobs, a preschooler and a newborn run the household from memory, group chats and a shared calendar. Three things go wrong:

1. Nobody has one view of who is covering what this week, so handoffs get dropped.
2. Each person quietly feels they carry more. Chore apps make it worse by counting tasks and ignoring paid work, commute and hours spent alone with a kid.
3. Kid milestones (checkups, school applications, enrollment forms) surface only when they're already late.

## Users

- **Primary:** two parents sharing one household, using phones in the morning and evening and a laptop on weekends.
- **Secondary:** grandparents and house help, who appear as owners of cards but don't log in.

## Goals

- One screen that answers "what's happening this week, and who has it?" in under ten seconds.
- A load split both parents accept as fair, because it counts the things that really take their time.
- No kid milestone missed: each one becomes a todo with a due date well before it matters.

## Non-goals

- Payment, budgeting or expense splitting.
- Medical, legal or financial advice.
- Accounts for children or extended family.

## Requirements

| # | Requirement | Priority |
|---|---|---|
| 1 | Rolling seven-day view, today first, with a coverage band for long duties and cards for chores and events | Must |
| 2 | Reassign a card or move it to another day in two taps; changes persist | Must |
| 3 | Load split badge in the header; full breakdown with editable hours in its own tab | Must |
| 4 | Todos with P0, P1 and P2; P0s also show on the week view | Must |
| 5 | Per-kid tab with age, school and a dated milestone timeline generated from the birth date | Must |
| 6 | Kid milestones become P2 todos with due dates, linked to the kid | Must |
| 7 | Development notes per kid: physical, emotional, mental/educational | Should |
| 8 | Live calendar events for both parents (private version) | Should |
| 9 | Works at phone width, in light and dark mode, without horizontal scrolling | Must |
| 10 | Public demo with invented data that never touches the real household's data | Must |

## Decisions

- **Hours, not points.** The score is each parent's share of total weekly hours: work, commute, kid coverage at full or half weight, and owned chores.
- **Balanced band of 45–55%.** Weeks are lumpy; a tighter band would flag normal variation.
- **Badge, not headline.** The split is visible but quiet. In the first version a big score read like a scoreboard.
- **California TK rule.** A child can start transitional kindergarten in the fall if they turn 4 on or before Sept 1. Kindergarten follows a year later.

## Open questions

- Should recurring chores be editable from the screen, or is a short setup flow enough?
- Is a weekly summary (notification or email) wanted, or does it become noise?
