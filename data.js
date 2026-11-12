// Demo household. Every person, school and event here is invented.
// Dates are relative to today so the demo always looks current.
import { addDays, addMonths, closureDays, dateKey, startOfDay } from "./logic.js";

export const PEOPLE = {
  a: { name: "Arjun", cls: "who-a" },
  b: { name: "Meera", cls: "who-b" },
  both: { name: "Both", cls: "who-both" },
  grandma: { name: "Grandma", cls: "who-f" },
  help: { name: "House help", cls: "who-f" },
  school: { name: "School", cls: "who-f" },
  open: { name: "Unassigned", cls: "who-o" },
};

/** Short labels for the compact "Every day" rows. */
export const SHORT = { a: "A", b: "M", both: "Both", grandma: "Gma", help: "Help", school: "School", open: "?" };

export const KIDS = { k1: "Kiara", k2: "Anaya" };

/** Long, overlapping duties shown as a band at the top of each day. */
export function coverFor(d) {
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  if (weekend) return [
    { who: "a", what: "With Kiara", when: "most of the day" },
    { who: "b", what: "With Anaya", when: "most of the day" },
  ];
  return [
    { who: "a", what: "Anaya, early morning", when: "5:00–6:30am" },
    { who: "a", what: "Kiara, evening and bedtime", when: "5:30–9:30pm" },
    { who: "b", what: "Anaya, all day", when: "with grandparents, while working from home" },
  ];
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Home breakfast menu, indexed by getDay() (0 = Sunday). Editable on Kiara's tab. */
export const DEFAULT_MENU = ["Anything goes", "Oats", "Scrambled eggs", "Toast with almond butter", "Yogurt and fruit", "Scrambled eggs", "Pancakes"];

/** What the (invented) preschool serves, by weekday. The private version reads the real monthly menu. */
export const SCHOOL_MENU = {
  1: { am: "Banana bread", lunch: "Bean and cheese quesadilla", pm: "Apple slices" },
  2: { am: "Oatmeal with raisins", lunch: "Pasta with tomato sauce and peas", pm: "Crackers and cheese" },
  3: { am: "Whole-wheat toast", lunch: "Vegetable fried rice", pm: "Orange wedges" },
  4: { am: "Cereal and milk", lunch: "Lentil soup with bread", pm: "Yogurt" },
  5: { am: "Mini muffins", lunch: "Veggie pizza", pm: "Pear slices" },
};
export const SCHOOL_NAME = "Little Oaks Preschool";

/** Days the preschool is closed, relative to today so the demo always has some coming up. */
export function sampleClosures(today) {
  const t = startOfDay(today);
  // Start on the first weekday on or after `n` days from now; a break of `len` school days runs Mon–Fri style.
  const weekday = (n) => { let d = addDays(t, n); while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1); return d; };
  const span = (n, len, what) => {
    const s = weekday(n);
    let e = s;
    for (let left = len - 1; left > 0;) { e = addDays(e, 1); if (e.getDay() !== 0 && e.getDay() !== 6) left--; }
    return { start: dateKey(s), end: dateKey(e), what };
  };
  return [
    span(3, 1, "Staff planning day"),
    span(19, 2, "Fall break"),
    span(44, 5, "Winter break"),
    span(96, 1, "Parent conference day"),
  ];
}

/** Household changes worth a heads-up. */
export function houseDates(today) {
  return [{ date: dateKey(addDays(startOfDay(today), 18)), what: "Grandma's last day cooking", sub: "Meera takes over meals from here." }];
}

/**
 * Recurring cards for the given days. Ids are stable per date so moves can be saved.
 * daily: true  → shown in the right-hand "Every day" column.
 * hidden: true → too obvious to show, but still counts in the load split.
 */
export function routine(days, { menu = DEFAULT_MENU, closures = [] } = {}) {
  const closed = new Set(closures.flatMap(closureDays));
  const out = [];
  const add = (d, time, title, owner, hrs, extra = {}) =>
    out.push({ id: `${dateKey(d)}~${slug(title)}`, date: dateKey(d), time, title, owner, hrs, routine: true, ...extra });
  for (const d of days) {
    const wd = d.getDay();
    const meal = menu[wd] || DEFAULT_MENU[wd];
    if (wd !== 0 && wd !== 6) {
      add(d, "6:30am", "Kiara's breakfast", "a", 0.5, { daily: true, brief: meal, note: `${meal}, then leaves for work` });
      add(d, "7:00am", "Commute to office", "a", 0, { fixed: true, daily: true, note: "40 min each way" });
      if (!closed.has(dateKey(d)) && SCHOOL_MENU[wd]) {
        const m = SCHOOL_MENU[wd];
        add(d, "9:00am", "Kiara's meals at school", "school", 0, { fixed: true, daily: true, brief: `${m.am} · ${m.lunch}`, note: `Breakfast: ${m.am}. Lunch: ${m.lunch}.` });
      }
      add(d, "Day", "Lunch and dinner", "grandma", 0, { daily: true, hidden: true, note: "Grandma cooks, Meera plans with her" });
      add(d, "9:45pm", "Chores or work catch-up", "a", 0.5, { daily: true, hidden: true });
    } else {
      add(d, "Morning", "Kiara's breakfast", "a", 0, { daily: true, brief: meal, note: meal });
      add(d, "Day", "Meals", "grandma", 0, { daily: true, hidden: true, note: "Grandma cooks, Meera plans with her" });
    }
    if (wd === 2 || wd === 5) add(d, "9:00pm", "Run the robot vacuum", "a", 0.5);
    if (wd === 3) add(d, "Anytime", "Weekly laundry", "b", 2);
    if (wd === 1) add(d, "10:00am", "Check in with house help", "b", 1, { note: "what needs doing this week" });
    if (wd === 4) add(d, "Anytime", "Plan meetups and gifts for friends", "b", 1.5);
    if (wd === 6) {
      add(d, "Morning", "Change bedsheets, general upkeep", "b", 2);
      add(d, "10:00am", "Take Kiara to swim class", "open", 1.5, { note: "Who's taking her this week?" });
      add(d, "Afternoon", "Home maintenance jobs", "a", 1.5);
    }
    if (wd === 0) {
      add(d, "Morning", "Bills, money and planning", "a", 2, { note: "taxes, bills, budgets" });
      add(d, "Evening", "Call family", "b", 2);
    }
  }
  return out;
}

/** Sample calendar events, standing in for the live Google Calendar feed of the private version. */
export function sampleCalendar(today) {
  const t = startOfDay(today);
  const at = (days, h, m) => { const d = addDays(t, days); d.setHours(h, m); return d; };
  return [
    { id: "ev1", title: "Parent–teacher meeting", start: at(2, 16, 30), end: at(2, 17, 15), owners: ["a", "b"] },
    { id: "ev2", title: "Kiara: dentist", start: at(4, 9, 0), end: at(4, 10, 0), owners: ["b"] },
    { id: "ev3", title: "Dinner with the Shahs", start: at(5, 19, 0), end: at(5, 21, 0), owners: ["a", "b"] },
    { id: "ev4", title: "Car service", start: at(1, 8, 0), end: at(1, 9, 0), owners: ["a"] },
  ];
}

/**
 * Sample calendar between `from` and `to`: this week's one-offs, a few further out,
 * and some repeating series (daily standup, weekly trash night, monthly book club).
 */
export function calendarRange(today, from, to) {
  const t = startOfDay(today);
  const at = (d, h, m) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  const later = [
    { id: "ev5", title: "Grandpa's birthday", day: 23, h: 0, allDay: true, owners: ["a", "b"] },
    { id: "ev6", title: "Kiara: school photo day", day: 30, h: 9, owners: ["b"] },
    { id: "ev7", title: "Anniversary dinner", day: 61, h: 19, owners: ["a", "b"] },
    { id: "ev8", title: "Weekend trip to the coast", day: 88, h: 0, allDay: true, days: 3, owners: ["a", "b"] },
    { id: "ev9", title: "Meera: work offsite", day: 126, h: 9, owners: ["b"] },
    { id: "ev10", title: "Anaya: first swim lesson", day: 150, h: 10, owners: ["a"] },
  ].map((e) => {
    const d = addDays(t, e.day);
    const start = at(d, e.h, 0);
    const end = e.allDay ? addDays(startOfDay(d), e.days || 1) : at(d, e.h + 1, 0);
    return { id: e.id, title: e.title, start, end, allDay: !!e.allDay, owners: e.owners };
  });
  const series = [];
  for (let d = startOfDay(from); d < to; d = addDays(d, 1)) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) series.push({ id: "standup~" + dateKey(d), series: "standup", title: "Team standup", start: at(d, 9, 30), end: at(d, 9, 45), owners: ["b"] });
    if (wd === 2) series.push({ id: "trash~" + dateKey(d), series: "trash", title: "Trash and recycling night", start: at(d, 20, 0), end: at(d, 20, 15), owners: ["a"] });
    if (d.getDate() === 12) series.push({ id: "book~" + dateKey(d), series: "book", title: "Book club", start: at(d, 19, 30), end: at(d, 21, 0), owners: ["b"] });
  }
  return sampleCalendar(today).concat(later, series).filter((e) => e.start >= from && e.start < to);
}

/** Finances: every figure here is a made-up sample. The private version reads a real cash-flow sheet. */
export const FINANCE = {
  snapshot: {
    period: "Last two months", months: 2,
    income: [["Arjun's salary, after tax", 9800], ["Meera's salary, after tax", 7400], ["Stock vesting, after tax (averaged)", 2300]],
    // [category, recurring per month, one-time per month (period total / months)]
    spend: [
      ["Housing: mortgage", 3600, 0], ["Childcare and preschool", 1450, 0], ["Groceries", 1100, 0], ["Car loan", 520, 0],
      ["Travel", 0, 640], ["Insurance", 180, 410], ["Dining out", 420, 0], ["Household and shopping", 260, 150],
      ["Utilities and phone", 310, 0], ["Health", 90, 220], ["Kids' activities", 160, 0], ["Subscriptions", 70, 0],
    ],
    oneTime: [["Car insurance (6 months)", 820], ["Flights home for the holidays", 1280], ["New stroller and car seat", 600]],
  },
  assets: { items: [["Cash", 65000], ["Investments", 210000], ["Retirement, both of you", 320000]] },
  goals: [
    { title: "Keep everyday spending under $9k a month", note: "Recurring spending is about $8.2k a month. Hold it there as Grandma's cooking ends and Anaya starts preschool." },
    { title: "Put the monthly surplus to work", note: "About $11k a month is left over. Split it between college savings for both girls, retirement, and a 6-month cash cushion." },
  ],
};

export const DEFAULT_HOURS = [
  { who: "a", item: "Paid work (office, 5 days)", hrs: 42, w: 1 },
  { who: "a", item: "Commute, 40 min each way", hrs: 6.5, w: 1 },
  { who: "a", item: "Anaya, 5:00–6:30am weekdays", hrs: 7.5, w: 0.5 },
  { who: "a", item: "Kiara, 5:30–9:30pm weekdays", hrs: 20, w: 1 },
  { who: "a", item: "Kiara, weekends", hrs: 18, w: 1 },
  { who: "b", item: "Paid work (from home)", hrs: 36, w: 1 },
  { who: "b", item: "Anaya, weekday daytime with grandparents", hrs: 40, w: 0.5 },
  { who: "b", item: "Anaya, weekday evenings", hrs: 17.5, w: 1 },
  { who: "b", item: "Anaya, weekends", hrs: 18, w: 1 },
  { who: "b", item: "Planning meals with Grandma", hrs: 3.5, w: 1 },
];

/** The whole starting state of the demo. */
export function demoState(today) {
  const t = startOfDay(today);
  const iso = (d) => dateKey(d);
  const k1Born = addDays(addMonths(t, -43), -6);   // about 3½
  const k2Born = addDays(t, -57);                  // about 8 weeks
  let n = 0;
  const todo = (pri, title, owner, extra = {}) => ({ id: `t${++n}`, pri, title, owner, done: false, createdAt: n, ...extra });
  return {
    version: 2,
    hours: DEFAULT_HOURS,
    menu: [...DEFAULT_MENU],
    goals: FINANCE.goals.map((g) => ({ ...g })),
    moves: {},
    todos: [
      todo("P0", "Book Anaya's 2-month checkup", "b", { kid: "k2", due: iso(addDays(k2Born, 61)), note: "Usually includes vaccines." }),
      todo("P1", "Pick up Anaya's birth certificate", "a", { kid: "k2", note: "County records office, bring photo ID." }),
      todo("P1", "Who takes Kiara to swim on Saturdays?", "open", { kid: "k1" }),
      todo("P1", "Fix the leaking bathroom tap", "a", { due: iso(addDays(t, 5)) }),
      todo("P2", "Shortlist and tour schools for Kiara", "both", { kid: "k1", due: iso(addDays(t, 45)) }),
      todo("P2", "Finalize Kiara's school and submit applications", "both", { kid: "k1", due: iso(addDays(t, 72)), note: "Applications usually close Jan–Feb." }),
      todo("P2", "Book Anaya's 4-month checkup", "b", { kid: "k2", due: iso(addDays(addMonths(k2Born, 4), -14)) }),
      todo("P2", "Plan meals for when Grandma goes home", "b"),
      todo("P2", "Kitchen renovation", "both", { note: "scope, budget, contractors" }),
    ],
    kids: {
      k1: {
        name: "Kiara", born: iso(k1Born), school: "Little Oaks Preschool", classroom: "Redwood room", teacher: "Ms. Lopez",
        now: ["Exploring letters through play and recognizes the K in her name.", "Working on confidence with positive self-talk at school."],
      },
      k2: {
        name: "Anaya", born: iso(k2Born), school: "Little Oaks Preschool", starts: "Next August, at about 11 months",
        now: ["Home with Meera and her grandparents."],
      },
    },
    dev: {
      k1: {
        physical: { now: "Loves climbing and running. Sleeps about 11 hours.", help: "An hour of outdoor play a day; try a balance bike; keep swim lessons going." },
        emotional: { now: "Building confidence with positive self-talk. Adjusting to a new baby sister.", help: "Use the same phrases at home as school. One-on-one time with each parent every week." },
        mental: { now: "Recognizes letters in her name, counts to 20.", help: "Read together every day. Letter games on walks. Practice writing her name before TK." },
      },
      k2: {
        physical: { now: "8 weeks old. Feeding well, gaining weight.", help: "Daily tummy time in short sessions; always on her back to sleep." },
        emotional: { now: "Starting to smile at faces.", help: "Respond quickly when she cries; lots of face-to-face time." },
        mental: { now: "", help: "Talk and sing through the day; high-contrast picture books." },
      },
    },
  };
}
