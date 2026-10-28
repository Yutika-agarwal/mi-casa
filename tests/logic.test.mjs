import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addDays, ageText, autoMilestones, byDue, dateKey, dueStatus, loads, monthsOld,
  nextPriority, parseDay, rollingWeek, shares, tkStartYear, upcomingMilestones,
} from "../logic.js";
import { DEFAULT_HOURS, demoState, routine, sampleCalendar } from "../data.js";

const D = (s) => parseDay(s);

// ---- Dates ----
test("parseDay reads a local date and ignores a time suffix", () => {
  assert.equal(dateKey(D("2026-10-28")), "2026-10-28");
  assert.equal(dateKey(D("2026-10-28T00:00:00Z")), "2026-10-28");
});
test("parseDay rejects junk and impossible dates", () => {
  assert.equal(parseDay(""), null);
  assert.equal(parseDay("next week"), null);
  assert.equal(parseDay("2026-02-30"), null);
});
test("rollingWeek is 7 consecutive days starting today", () => {
  const w = rollingWeek(new Date(2026, 9, 28, 15, 30));
  assert.equal(w.length, 7);
  assert.equal(dateKey(w[0]), "2026-10-28");
  assert.equal(dateKey(w[6]), "2026-11-03");
});
test("rollingWeek crosses a daylight-saving change without skipping a day", () => {
  // US clocks change on Nov 1 2026 and Mar 14 2027 (tests run in America/Los_Angeles).
  const fall = rollingWeek(new Date(2026, 9, 29));
  const spring = rollingWeek(new Date(2027, 2, 12));
  assert.deepEqual(spring.map(dateKey), ["2027-03-12", "2027-03-13", "2027-03-14", "2027-03-15", "2027-03-16", "2027-03-17", "2027-03-18"]);
  assert.deepEqual(fall.map(dateKey), ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
});

// ---- Fair share ----
test("loads weights fixed hours and adds chore cards", () => {
  const L = loads([{ who: "a", hrs: 40, w: 1 }, { who: "b", hrs: 10, w: 0.5 }], [{ owner: "b", hrs: 2, day: 0 }]);
  assert.deepEqual(L, { a: 40, b: 7 });
});
test("cards owned by both split evenly", () => {
  assert.deepEqual(loads([], [{ owner: "both", hrs: 3, day: 1 }]), { a: 1.5, b: 1.5 });
});
test("cards moved outside the week don't count", () => {
  assert.deepEqual(loads([], [{ owner: "a", hrs: 5, day: -1 }]), { a: 0, b: 0 });
});
test("grandma, house help and unassigned cards don't count for either parent", () => {
  const L = loads([], ["grandma", "help", "open"].map((owner) => ({ owner, hrs: 4, day: 0 })));
  assert.deepEqual(L, { a: 0, b: 0 });
});
test("shares always add to 100", () => {
  for (const [a, b] of [[1, 2], [33.3, 66.7], [100, 1], [7, 7]]) {
    const s = shares({ a, b });
    assert.equal(s.a + s.b, 100);
  }
});
test("balanced means within 45-55", () => {
  assert.equal(shares({ a: 55, b: 45 }).balanced, true);
  assert.equal(shares({ a: 56, b: 44 }).balanced, false);
});
test("shares with no hours at all is an even split, not NaN", () => {
  assert.deepEqual(shares({ a: 0, b: 0 }), { a: 50, b: 50, balanced: true });
});
test("demo household starts balanced", () => {
  const today = new Date(2026, 9, 28);
  const s = shares(loads(DEFAULT_HOURS, routine(rollingWeek(today))));
  assert.equal(s.balanced, true);
});

// ---- Kids ----
test("age reads in weeks, then months, then years", () => {
  const today = new Date(2026, 9, 28);
  assert.equal(ageText("2026-09-01", today), "8 weeks old");
  assert.equal(ageText("2025-12-01", today), "10 months old");
  assert.equal(ageText("2023-04-24", today), "3 years, 6 months");
});
test("monthsOld doesn't count a month until the day is reached", () => {
  assert.equal(monthsOld("2026-09-29", new Date(2026, 9, 28)), 0);
  assert.equal(monthsOld("2026-09-28", new Date(2026, 9, 28)), 1);
});
test("TK: turning 4 on or before Sept 1 starts that fall", () => {
  assert.equal(tkStartYear("2023-04-24"), 2027);
  assert.equal(tkStartYear("2023-09-01"), 2027);
});
test("TK: turning 4 after Sept 1 waits a year", () => {
  assert.equal(tkStartYear("2023-09-02"), 2028);
  assert.equal(tkStartYear("2026-09-01"), 2030);
});
test("milestones include checkups, TK and kindergarten in date order", () => {
  const m = autoMilestones("2023-04-24");
  const whats = m.map((x) => x.what);
  assert.ok(whats.includes("4-year checkup"));
  assert.ok(whats.includes("Transitional kindergarten (2027–28)"));
  assert.ok(whats.includes("Kindergarten (2028–29)"));
  for (let i = 1; i < m.length; i++) assert.ok(m[i - 1].date <= m[i].date);
});
test("a 2-month checkup is dated 2 months after birth", () => {
  const two = autoMilestones("2026-09-01").find((x) => x.what === "2-month checkup");
  assert.equal(dateKey(two.date), "2026-11-01");
});
test("upcoming milestones skip the distant past", () => {
  const up = upcomingMilestones("2023-04-24", new Date(2026, 9, 28));
  assert.ok(up.every((x) => x.date >= new Date(2026, 8, 28)));
  assert.equal(up[0].what, "4-year checkup");
});
test("milestones need a valid birth date", () => {
  assert.deepEqual(autoMilestones(null), []);
  assert.equal(ageText("", new Date()), "");
});

// ---- Todos ----
test("due status: late, soon, later, none", () => {
  const t = new Date(2026, 9, 28);
  assert.equal(dueStatus("2026-10-27", t), "late");
  assert.equal(dueStatus("2026-11-11", t), "soon");
  assert.equal(dueStatus("2026-11-12", t), "later");
  assert.equal(dueStatus(undefined, t), "");
  assert.equal(dueStatus("2026-10-01", t, true), "");
});
test("sort puts open todos first, then by due date, undated last", () => {
  const list = [
    { id: 1, due: "2027-01-08" }, { id: 2 }, { id: 3, due: "2026-12-01" }, { id: 4, due: "2026-01-01", done: true },
  ].sort(byDue);
  assert.deepEqual(list.map((x) => x.id), [3, 1, 2, 4]);
});
test("priority cycles P0 → P1 → P2 → P0", () => {
  assert.equal(nextPriority("P0"), "P1");
  assert.equal(nextPriority("P2"), "P0");
});

// ---- Demo data and privacy ----
test("routine card ids are unique and stable for the same day", () => {
  const w = rollingWeek(new Date(2026, 9, 28));
  const ids = routine(w).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(routine(w).map((c) => c.id), ids);
});
test("sample calendar events fall inside the week", () => {
  const today = new Date(2026, 9, 28);
  const last = addDays(today, 7);
  for (const ev of sampleCalendar(today)) assert.ok(ev.start >= today && ev.start < last);
});
test("demo state is self-consistent", () => {
  const s = demoState(new Date(2026, 9, 28));
  assert.equal(new Set(s.todos.map((t) => t.id)).size, s.todos.length);
  for (const t of s.todos) {
    assert.ok(["P0", "P1", "P2"].includes(t.pri));
    if (t.kid) assert.ok(t.kid in s.kids);
  }
});
test("no real family details ship in the public demo", () => {
  const banned = ["Nimit", "Yutika", "Zoya", "Navya", "Lucciola", "Nigania", "@gmail.com"];
  for (const f of ["data.js", "app.js", "index.html", "logic.js"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const word of banned) assert.ok(!src.includes(word), `${f} mentions ${word}`);
  }
});
