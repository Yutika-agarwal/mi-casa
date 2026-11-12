import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  addDays, ageText, autoMilestones, byDue, cashFlow, closureDays, dailySeries, dateKey, dueStatus, isEveryDay,
  isMonthRoutine, loads, monthStart, monthsOld, nextPriority, parseDay, repeatingSeries, rollingWeek, shares,
  timeMins, tkStartYear, upcomingClosures, upcomingMilestones, usd,
} from "../logic.js";
import {
  DEFAULT_HOURS, DEFAULT_MENU, FINANCE, calendarRange, demoState, routine, sampleCalendar, sampleClosures,
} from "../data.js";

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

// ---- This week: two columns ----
test("time labels sort clock times by the minute and words at a sensible spot", () => {
  assert.equal(timeMins("6:30am"), 390);
  assert.equal(timeMins("12:00pm"), 720);
  assert.equal(timeMins("12:15am"), 15);
  assert.equal(timeMins("9pm"), 1260);
  assert.ok(timeMins("Morning") < timeMins("Afternoon"));
  assert.ok(timeMins("Evening") < timeMins("9:45pm"));
  assert.equal(timeMins("whenever"), timeMins("Anytime"));
});
test("a series on 5+ days of the week is daily; a weekly one is not", () => {
  const today = new Date(2026, 10, 11);
  const w = rollingWeek(today);
  const daily = dailySeries(calendarRange(today, w[0], addDays(w[6], 1)));
  assert.ok(daily.has("standup"));
  assert.ok(!daily.has("trash"));
});
test("every-day column takes daily cards and daily series, never closures", () => {
  const daily = new Set(["standup"]);
  assert.equal(isEveryDay({ daily: true }, daily), true);
  assert.equal(isEveryDay({ routine: true }, daily), false);
  assert.equal(isEveryDay({ cal: true, series: "standup" }, daily), true);
  assert.equal(isEveryDay({ cal: true, series: "trash" }, daily), false);
  assert.equal(isEveryDay({ cal: true }, daily), false);
  assert.equal(isEveryDay({ closure: true, daily: true }, daily), false);
});
test("breakfast cards carry the menu for that weekday, weekends included", () => {
  const w = rollingWeek(new Date(2026, 10, 9)); // Monday
  const menu = [...DEFAULT_MENU]; menu[1] = "Idli";
  const bf = routine(w, { menu }).filter((c) => c.title === "Kiara's breakfast");
  assert.equal(bf.length, 7);
  assert.equal(bf[0].brief, "Idli");
  assert.ok(bf.every((c) => c.daily));
});
test("no school meals on weekends or closed days", () => {
  const today = new Date(2026, 10, 9); // Monday
  const w = rollingWeek(today);
  const closures = [{ start: "2026-11-11", end: "2026-11-11", what: "Staff day" }];
  const days = routine(w, { closures }).filter((c) => c.title === "Kiara's meals at school").map((c) => c.date);
  assert.deepEqual(days, ["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13"]);
});
test("hidden cards still count in the load split", () => {
  const w = rollingWeek(new Date(2026, 10, 9));
  const hidden = routine(w).filter((c) => c.hidden && c.owner === "a");
  assert.ok(hidden.length > 0);
  const L = loads([], hidden.map((c) => ({ ...c, day: 0 })));
  assert.ok(L.a > 0);
});

// ---- This month ----
test("routine for the month: repeats within a month or routine words", () => {
  const ev = (series, y, m, d, title = "x") => ({ series, title, start: new Date(y, m, d) });
  const list = [ev("weekly", 2026, 10, 3), ev("weekly", 2026, 10, 10), ev("monthly", 2026, 10, 12), ev("monthly", 2026, 11, 12), ev("yearly", 2026, 10, 20)];
  const rep = repeatingSeries(list);
  assert.deepEqual([...rep], ["weekly"]);
  assert.equal(isMonthRoutine(list[0], rep), true);
  assert.equal(isMonthRoutine(list[2], rep), false);
  assert.equal(isMonthRoutine({ title: "Daily commute" }, rep), true);
  assert.equal(isMonthRoutine({ title: "Grandpa's birthday" }, rep), false);
});
test("month boundaries roll over the year", () => {
  assert.equal(dateKey(monthStart(new Date(2026, 10, 11))), "2026-11-01");
  assert.equal(dateKey(monthStart(new Date(2026, 10, 11), 2)), "2027-01-01");
});
test("sample calendar range stays inside the range asked for", () => {
  const today = new Date(2026, 10, 11);
  const from = monthStart(today), to = monthStart(today, 7);
  const list = calendarRange(today, from, to);
  assert.ok(list.length > 20);
  for (const ev of list) assert.ok(ev.start >= from && ev.start < to);
  assert.equal(new Set(list.map((e) => e.id)).size, list.length);
});

// ---- Closures ----
test("a closure covers every day from first to last", () => {
  assert.deepEqual(closureDays({ start: "2026-12-30", end: "2027-01-02" }), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.deepEqual(closureDays({ start: "2026-11-11" }), ["2026-11-11"]);
});
test("upcoming closures keep one still in progress and drop past ones", () => {
  const list = [{ start: "2026-11-01", end: "2026-11-02" }, { start: "2026-11-10", end: "2026-11-12" }, { start: "2026-12-01" }];
  assert.deepEqual(upcomingClosures(list, new Date(2026, 10, 11)).map((c) => c.start), ["2026-11-10", "2026-12-01"]);
});
test("sample closures are all in the future and start and end on weekdays", () => {
  for (let i = 0; i < 7; i++) {
    const today = new Date(2026, 10, 9 + i);
    const list = sampleClosures(today);
    assert.equal(upcomingClosures(list, today).length, list.length);
    for (const c of list) for (const k of [c.start, c.end]) assert.ok(![0, 6].includes(parseDay(k).getDay()), `${k} is a weekend`);
  }
});

// ---- Finances ----
test("cash flow adds up and the savings rate is income minus recurring", () => {
  const cf = cashFlow({ income: [["x", 10000]], spend: [["a", 3000, 500], ["b", 1000, 0]] });
  assert.deepEqual(cf, { inc: 10000, rec: 4000, one: 500, left: 6000, rate: 60 });
  assert.equal(cashFlow({ income: [], spend: [] }).rate, 0);
});
test("dollar formatting", () => {
  assert.equal(usd(9709), "$9,709");
  assert.equal(usd(9709, true), "$9.7k");
  assert.equal(usd(3000000, true), "$3M");
  assert.equal(usd(-1500, true), "−$1.5k");
});
test("sample finances leave a surplus", () => {
  assert.ok(cashFlow(FINANCE.snapshot).left > 0);
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
  const banned = [
    "Nimit", "Yutika", "Zoya", "Navya", "Lucciola", "Nigania", "@gmail.com", "Briseida", "Sequoia",
    // Real finance sources and figures from the private hub.
    "eBay", "Snap payroll", "Google payroll", "GEICO", "Air India", "Capital One", "docs.google.com",
    "38293", "38,293", "9709", "9,709", "300000", "3000000", "900000",
  ];
  for (const f of ["data.js", "app.js", "index.html", "logic.js", "styles.css"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const word of banned) assert.ok(!src.includes(word), `${f} mentions ${word}`);
  }
});
