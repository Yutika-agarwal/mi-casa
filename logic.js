// Pure functions behind the hub: dates, the fair-share score, kids' milestones.
// No DOM and no storage here, so everything can be unit tested in Node.

export const DAY_MS = 864e5;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d, n) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Local calendar key, YYYY-MM-DD. */
export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse YYYY-MM-DD (anything after the date is ignored) as a local date, or null. */
export function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

/** Seven days starting at `today`. */
export function rollingWeek(today) {
  const start = startOfDay(today);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Weekly load per person, in weighted hours.
 * rows:  fixed weekly commitments [{who, hrs, w}] (work, commute, kid coverage)
 * cards: this week's chores [{owner, hrs, day}] — owner "both" splits evenly,
 *        cards outside the week (day < 0) and other owners don't count.
 */
export function loads(rows, cards, people = ["a", "b"]) {
  const L = Object.fromEntries(people.map((p) => [p, 0]));
  for (const r of rows) {
    if (r.who in L) L[r.who] += (Number(r.hrs) || 0) * (Number(r.w) || 0);
  }
  for (const c of cards) {
    if (c.day !== undefined && c.day < 0) continue;
    const h = Number(c.hrs) || 0;
    if (c.owner === "both") people.forEach((p) => (L[p] += h / people.length));
    else if (c.owner in L) L[c.owner] += h;
  }
  return L;
}

/** Share of the combined load for two people, rounded so they add to 100. */
export function shares(L, band = 5) {
  const tot = L.a + L.b;
  const a = tot > 0 ? Math.round((L.a / tot) * 100) : 50;
  return { a, b: 100 - a, balanced: Math.abs(a - 50) <= band };
}

/** Whole months between birth and `today`. */
export function monthsOld(born, today) {
  const b = parseDay(born);
  if (!b) return null;
  const t = startOfDay(today);
  return (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth()) - (t.getDate() < b.getDate() ? 1 : 0);
}

export function ageText(born, today) {
  const b = parseDay(born);
  if (!b) return "";
  const months = monthsOld(born, today);
  if (months < 0) return "";
  if (months < 3) return `${Math.floor((startOfDay(today) - b) / (7 * DAY_MS))} weeks old`;
  if (months < 24) return `${months} months old`;
  const y = Math.floor(months / 12), m = months % 12;
  return m ? `${y} years, ${m} months` : `${y} years old`;
}

/**
 * First school year (its starting calendar year) a child can join California
 * transitional kindergarten: they must turn 4 on or before September 1.
 */
export function tkStartYear(born) {
  const b = parseDay(born);
  if (!b) return null;
  const turns4 = new Date(b.getFullYear() + 4, b.getMonth(), b.getDate());
  return turns4 <= new Date(b.getFullYear() + 4, 8, 1) ? b.getFullYear() + 4 : b.getFullYear() + 5;
}

export const CHECKUP_MONTHS = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60, 72];

export const BABY_MILESTONES = {
  2: "smiles at people, starts holding head up during tummy time",
  4: "holds head steady, coos, brings hands to mouth",
  6: "rolls from tummy to back, laughs, reaches for toys",
  9: "sits without support, responds to her name, babbles",
  12: "pulls to stand, waves bye-bye, may say a first word",
  15: "takes a few steps, points to ask for things",
  18: "walks on her own, says several single words",
  24: "kicks a ball, says two-word phrases",
};

/** Dated milestones from a birth date: well-child checkups, birthdays, TK and kindergarten. */
export function autoMilestones(born) {
  const b = parseDay(born);
  if (!b) return [];
  const out = [];
  for (const m of CHECKUP_MONTHS) {
    const tip = BABY_MILESTONES[m];
    out.push({
      date: addMonths(b, m),
      what: m >= 48 ? `${m / 12}-year checkup` : `${m}-month checkup`,
      sub: tip ? `Around now: ${tip}.${m <= 6 ? " Usually includes vaccines." : ""}` : "",
    });
  }
  for (let y = 1; y <= 6; y++) out.push({ date: new Date(b.getFullYear() + y, b.getMonth(), b.getDate()), what: `Turns ${y}`, sub: "" });
  const tk = tkStartYear(born);
  out.push({ date: new Date(tk, 7, 15), what: `Transitional kindergarten (${tk}–${String(tk + 1).slice(2)})`, sub: "California TK: turns 4 by Sept 1." });
  out.push({ date: new Date(tk + 1, 7, 15), what: `Kindergarten (${tk + 1}–${String(tk + 2).slice(2)})`, sub: "Turns 5 by Sept 1." });
  return out.sort((x, y) => x.date - y.date);
}

/** Milestones from a month ago to `months` ahead. */
export function upcomingMilestones(born, today, months = 30) {
  const from = addMonths(startOfDay(today), -1), to = addMonths(startOfDay(today), months);
  return autoMilestones(born).filter((m) => m.date >= from && m.date <= to);
}

/** "late", "soon" (within 14 days), "later", or "" when there's no due date or it's done. */
export function dueStatus(due, today, done = false) {
  const d = parseDay(due);
  if (!d || done) return "";
  const days = Math.round((d - startOfDay(today)) / DAY_MS);
  return days < 0 ? "late" : days <= 14 ? "soon" : "later";
}

/** Sort: open before done, then by due date (none last), then by creation. */
export function byDue(a, b) {
  const far = 8.64e15;
  return (a.done ? 1 : 0) - (b.done ? 1 : 0)
    || (parseDay(a.due) || far) - (parseDay(b.due) || far)
    || (a.createdAt || 0) - (b.createdAt || 0);
}

export const PRIORITIES = ["P0", "P1", "P2"];
export const nextPriority = (p) => PRIORITIES[(PRIORITIES.indexOf(p) + 1) % PRIORITIES.length];

// ---------- This week: two columns ----------

const TIME_WORDS = { "all day": -1, morning: 480, day: 720, anytime: 750, afternoon: 840, evening: 1080, night: 1260 };

/** Sort key for a card's time label: clock times by the minute, words at a sensible spot in the day. */
export function timeMins(t) {
  const s = String(t || "").trim();
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(s);
  if (m) return ((+m[1] % 12) + (/pm/i.test(m[3]) ? 12 : 0)) * 60 + (+m[2] || 0);
  return TIME_WORDS[s.toLowerCase()] ?? 750;
}

/** Calendar series that show up on 5 or more different days of the week shown (every day or every weekday). */
export function dailySeries(events) {
  const days = {};
  for (const ev of events) {
    if (!ev.series) continue;
    (days[ev.series] = days[ev.series] || new Set()).add(dateKey(ev.start));
  }
  return new Set(Object.keys(days).filter((k) => days[k].size >= 5));
}

/**
 * Does a card belong in the right-hand "Every day" column?
 * Generated cards say so themselves (daily: true). Calendar events count when their series is daily.
 * Closures are never routine.
 */
export function isEveryDay(card, daily) {
  if (card.closure) return false;
  if (card.cal) return !!(card.series && daily.has(card.series));
  return !!card.daily;
}

// ---------- This month: only the big things ----------

export const ROUTINE_WORDS = /\b(commute|breakfast|lunch|dinner|standup|stand-up|gym|workout|bedtime|nap|school run|drop[- ]?off|pick[- ]?up|focus time|working hours)\b/i;

/** Series that repeat 2 or more times inside any single calendar month. Yearly and monthly events don't. */
export function repeatingSeries(events) {
  const n = {};
  for (const ev of events) {
    if (!ev.series) continue;
    const k = ev.series + "|" + dateKey(ev.start).slice(0, 7);
    n[k] = (n[k] || 0) + 1;
  }
  return new Set(Object.keys(n).filter((k) => n[k] > 1).map((k) => k.split("|")[0]));
}

/** A calendar event is routine for the month view when its series repeats within a month or its title reads like routine. */
export function isMonthRoutine(ev, repeating) {
  return (ev.series && repeating.has(ev.series)) || ROUTINE_WORDS.test(ev.title || "");
}

/** First day of the month `n` months after the one `d` is in. */
export function monthStart(d, n = 0) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// ---------- Closures ----------

/** Every date (YYYY-MM-DD) a closure covers, first to last inclusive. */
export function closureDays(c) {
  const s = parseDay(c.start), e = parseDay(c.end || c.start);
  if (!s || !e || e < s) return s ? [dateKey(s)] : [];
  const out = [];
  for (let d = s; d <= e; d = addDays(d, 1)) out.push(dateKey(d));
  return out;
}

/** Closures that end on or after today, soonest first. */
export function upcomingClosures(list, today) {
  const t = startOfDay(today);
  return list.filter((c) => (parseDay(c.end || c.start) || 0) >= t)
    .sort((a, b) => parseDay(a.start) - parseDay(b.start));
}

// ---------- Finances ----------

/** Monthly cash-flow summary from a snapshot: income, recurring and one-time spend, what's left, savings rate. */
export function cashFlow(f) {
  const inc = f.income.reduce((t, [, v]) => t + v, 0);
  const rec = f.spend.reduce((t, r) => t + r[1], 0);
  const one = f.spend.reduce((t, r) => t + r[2], 0);
  const left = inc - rec;
  return { inc, rec, one, left, rate: inc ? Math.round((left / inc) * 1000) / 10 : 0 };
}

/** Dollars. short=true gives $9.7k / $1.2M. */
export function usd(n, short = false) {
  const a = Math.abs(n), sign = n < 0 ? "−" : "";
  if (short && a >= 1e6) return sign + "$" + (a / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (short && a >= 1e3) return sign + "$" + (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return sign + "$" + Math.round(a).toLocaleString("en-US");
}
