// Demo household. Every person, school and event here is invented.
// Dates are relative to today so the demo always looks current.
import { addDays, addMonths, dateKey, startOfDay } from "./logic.js";

export const PEOPLE = {
  a: { name: "Arjun", cls: "who-a" },
  b: { name: "Meera", cls: "who-b" },
  both: { name: "Both", cls: "who-both" },
  grandma: { name: "Grandma", cls: "who-f" },
  help: { name: "House help", cls: "who-f" },
  open: { name: "Unassigned", cls: "who-o" },
};

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

/** Recurring chores for the given days. Ids are stable per date so moves can be saved. */
export function routine(days) {
  const out = [];
  const add = (d, time, title, owner, hrs, extra = {}) =>
    out.push({ id: `${dateKey(d)}~${slug(title)}`, date: dateKey(d), time, title, owner, hrs, ...extra });
  for (const d of days) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) {
      add(d, "6:30am", "Kiara's breakfast", "a", 0.5, { note: "then leaves for work" });
      add(d, "7:00am", "Commute to office", "a", 0, { fixed: true, note: "40 min each way" });
      add(d, "Day", "Lunch and dinner", "grandma", 0, { note: "Grandma cooks, Meera plans with her" });
      add(d, "9:45pm", "Chores or work catch-up", "a", 0.5);
    } else {
      add(d, "Day", "Meals", "grandma", 0, { note: "Grandma cooks, Meera plans with her" });
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
    version: 1,
    hours: DEFAULT_HOURS,
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
