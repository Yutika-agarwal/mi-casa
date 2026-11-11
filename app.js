// Mi Casa demo: the household hub UI. State lives in this browser only.
import {
  addDays, ageText, autoMilestones, byDue, cashFlow, closureDays, dailySeries, dateKey, dueStatus, isEveryDay,
  isMonthRoutine, loads, monthStart, nextPriority, parseDay, repeatingSeries, rollingWeek, shares, startOfDay,
  timeMins, upcomingClosures, upcomingMilestones, usd,
} from "./logic.js";
import {
  DEFAULT_MENU, FINANCE, KIDS, PEOPLE, SCHOOL_MENU, SCHOOL_NAME, SHORT, WEEKDAYS, calendarRange, coverFor,
  demoState, houseDates, routine, sampleClosures,
} from "./data.js";

const STORE_KEY = "mi-casa-demo-v1";
const STATE_VERSION = 2;
const TODAY = startOfDay(new Date());
const DAYS = rollingWeek(TODAY);
const PRI = { P0: "Needs attention now", P1: "Within a week or so", P2: "Long term and planned" };
const DAY_TAGS = { "10-31": "Halloween", "11-26": "Thanksgiving", "12-25": "Christmas", "01-01": "New Year's Day", "02-14": "Valentine's Day" };
const CLOSURES = sampleClosures(TODAY);
const CLOSED = new Map(CLOSURES.flatMap((c) => closureDays(c).map((k) => [k, c])));
const HOUSE = houseDates(TODAY);
const AHEAD = 6; // months shown after this one on This month
const MONTH0 = monthStart(TODAY), MONTH1 = monthStart(TODAY, 1), RANGE_END = monthStart(TODAY, 1 + AHEAD);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dname = (d) => d.toLocaleDateString("en-US", { weekday: "short" });
const dfull = (d) => d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" });
const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== TODAY.getFullYear() ? "numeric" : undefined });
const person = (k) => PEOPLE[k] || PEOPLE.open;

// ---------- State (local to this browser) ----------
let canStore = true;
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.version === STATE_VERSION) return s; }
  } catch { canStore = false; }
  return demoState(TODAY);
}
let S = load();
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { canStore = false; }
}
function resetDemo() {
  S = demoState(TODAY);
  try { localStorage.removeItem(STORE_KEY); } catch {}
  render(); toast("Demo reset");
}

// ---------- Cards for the week ----------
const WEEK_EVENTS = calendarRange(TODAY, DAYS[0], addDays(DAYS[6], 1));
const MONTH_EVENTS = calendarRange(TODAY, MONTH0, RANGE_END);
function calendarCards() {
  return WEEK_EVENTS.map((ev) => ({
    id: "cal~" + ev.id, cal: true, series: ev.series, date: dateKey(ev.start), title: ev.title,
    time: ev.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase(),
    hrs: Math.min(3, Math.round(((ev.end - ev.start) / 36e5) * 4) / 4),
    owner: ev.owners.length > 1 ? "both" : ev.owners[0],
    note: ev.owners.length > 1 ? "On both your calendars" : "",
  }));
}
function closureCards() {
  return DAYS.filter((d) => CLOSED.has(dateKey(d))).map((d) => {
    const c = CLOSED.get(dateKey(d));
    return { id: "closed~" + dateKey(d), closure: true, date: dateKey(d), time: "All day", title: `${SCHOOL_NAME} closed`, owner: "open", hrs: 0, note: `${c.what}. Who has Kiara?` };
  });
}
function allCards() {
  return routine(DAYS, { menu: S.menu, closures: CLOSURES }).concat(calendarCards(), closureCards()).map((c) => {
    const mv = S.moves[c.id];
    const out = { ...c, ...(mv || {}) };
    out.day = DAYS.findIndex((d) => dateKey(d) === out.date);
    return out;
  });
}
const findCard = (id) => allCards().find((c) => c.id === id);
const split = () => { const L = loads(S.hours, allCards()); return { L, ...shares(L) }; };

// ---------- Rendering ----------
let tab = "week";
const TABS = [["week", "This week"], ["month", "This month"], ["todos", "Todos"], ["k1", KIDS.k1], ["k2", KIDS.k2], ["fin", "Finances"], ["fair", "Fairness"]];

function renderHeader() {
  document.getElementById("range").textContent = `${fmtShort(DAYS[0])} – ${fmtShort(DAYS[6])}`;
  const s = split();
  const load = document.getElementById("load");
  load.innerHTML = `
    <span class="dot ${s.balanced ? "ok" : "warn"}" aria-hidden="true"></span>
    <span class="a">${PEOPLE.a.name[0]} ${s.a}</span>
    <span class="mini" aria-hidden="true"><i style="width:${s.a}%;background:var(--pa)"></i><i style="width:${s.b}%;background:var(--pb)"></i></span>
    <span class="b">${s.b} ${PEOPLE.b.name[0]}</span>`;
  load.setAttribute("aria-label", `Load split: ${PEOPLE.a.name} ${s.a}%, ${PEOPLE.b.name} ${s.b}%. Open Fairness.`);
  document.getElementById("tabs").innerHTML = TABS.map(([k, l]) =>
    `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${esc(l)}</button>`).join("");
}

function demoBanner() {
  return `<div class="demo"><span><b>Demo household.</b> Everyone here is invented. ${canStore ? "Your changes save in this browser only." : "Changes won't be kept after you leave."}</span><button data-reset>Reset demo</button></div>`;
}

function cardHTML(c) {
  const p = person(c.owner);
  return `<button class="task ${c.owner === "open" ? "unassigned" : ""}" data-card="${esc(c.id)}" id="card-${esc(c.id)}">
    <span class="t">${esc(c.time)}</span>
    <span class="ttl">${esc(c.title)}${c.note || c.cal ? `<small>${c.cal ? `<span class="cal">Calendar</span>` : ""}${esc(c.note || "")}</small>` : ""}</span>
    <span class="chip ${p.cls}">${esc(p.name)}</span>
  </button>`;
}

// Left column, "Just this day": one-offs, closures, weekly chores, weekly events, todos due, milestones.
// Right column, "Every day": kid coverage, daily cards (breakfast, commute, school meals) and daily calendar series.
function impHTML(c) {
  const p = person(c.owner);
  const label = c.closure ? `<span class="k closure">Closed</span>` : c.cal ? `<span class="k event">${c.series ? "Repeats" : "Calendar"}</span>` : c.routine ? `<span class="k">Chore</span>` : "";
  return `<button class="task imp ${p.cls} ${c.owner === "open" ? "unassigned" : ""}" data-card="${esc(c.id)}" id="card-${esc(c.id)}">
    <span class="top"><span class="t">${label} ${esc(c.time)}</span><span class="chip ${p.cls}">${esc(p.name)}</span></span>
    <span class="ttl">${esc(c.title)}${c.note ? `<small>${esc(c.note)}</small>` : ""}</span>
  </button>`;
}
function rtHTML(c) {
  const p = person(c.owner);
  return `<button class="task rt ${p.cls}" data-card="${esc(c.id)}" id="card-${esc(c.id)}" title="${esc([c.time, c.title, c.note].filter(Boolean).join(" · "))}">
    <span class="ttl"><span class="t">${esc(c.time)}</span>${esc(c.title)}${c.brief ? ` <span class="b">· ${esc(c.brief)}</span>` : ""}</span>
    <span class="ini ${p.cls}" aria-label="${esc(p.name)}">${esc(SHORT[c.owner] || "?")}</span>
  </button>`;
}
function dayExtras(d) {
  const k = dateKey(d), out = [];
  S.todos.filter((t) => !t.done && t.due === k).forEach((t) => out.push({ kind: "todo", label: "Due", what: t.title, sub: t.pri, owner: t.owner, tab: "todos" }));
  ["k1", "k2"].forEach((id) => autoMilestones(S.kids[id].born).filter((m) => dateKey(m.date) === k)
    .forEach((m) => out.push({ kind: "kid", label: S.kids[id].name, what: m.what, sub: m.sub, tab: id })));
  HOUSE.filter((h) => h.date === k).forEach((h) => out.push({ kind: "home", label: "Home", what: h.what, sub: h.sub, tab: "month" }));
  return out;
}
function extraHTML(x) {
  const p = x.owner ? person(x.owner) : null;
  return `<button class="task imp ${p ? p.cls : "who-b"}" data-tab="${x.tab}">
    <span class="top"><span class="t"><span class="k ${x.kind}">${esc(x.label)}</span></span>${p ? `<span class="chip ${p.cls}">${esc(p.name)}</span>` : ""}</span>
    <span class="ttl">${esc(x.what)}${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</span>
  </button>`;
}

function renderWeek() {
  const p0 = S.todos.filter((t) => t.pri === "P0" && !t.done);
  const cards = allCards();
  const html = [demoBanner()];
  if (p0.length) html.push(`<div class="p0box">
      <div class="head"><p class="label" style="margin:0">Needs attention now</p><button class="linkbtn" data-tab="todos">All todos</button></div>
      ${p0.map(todoHTML).join("")}
    </div>`);
  const coming = HOUSE.filter((h) => parseDay(h.date) >= TODAY).map((h) => `<div class="ev"><b>${fmtShort(parseDay(h.date))}</b>${esc(h.what)}. ${esc(h.sub)}</div>`)
    .concat(["k1", "k2"].map((id) => {
      const k = S.kids[id];
      const next = upcomingMilestones(k.born, TODAY).find((m) => m.date >= TODAY);
      return next ? `<div class="ev"><b>${esc(k.name)} · ${fmtShort(next.date)}</b>${esc(next.what)}</div>` : "";
    }))
    .concat(upcomingClosures(CLOSURES, TODAY).slice(0, 2).map((c) => `<div class="ev"><b>${closureWhen(c)}</b>${SCHOOL_NAME} closed: ${esc(c.what)}. Plan Kiara's day.</div>`))
    .join("");
  html.push(`<p class="label">Coming up</p><div class="coming">${coming}</div>`);
  const daily = dailySeries(WEEK_EVENTS);
  const byTime = (x, y) => timeMins(x.time) - timeMins(y.time);
  DAYS.forEach((d, i) => {
    const tag = DAY_TAGS[dateKey(d).slice(5)];
    const mine = cards.filter((c) => c.day === i && !c.hidden);
    const imp = mine.filter((c) => !isEveryDay(c, daily)).sort(byTime);
    const rt = mine.filter((c) => isEveryDay(c, daily)).sort(byTime);
    const left = imp.map(impHTML).join("") + dayExtras(d).map(extraHTML).join("");
    const cover = coverFor(d).map((c) => `<div class="lane cv ${PEOPLE[c.who].cls}"><b>${SHORT[c.who]}</b> ${esc(c.what)} <span>· ${esc(c.when)}</span></div>`).join("");
    html.push(`<section class="day" aria-label="${dfull(d)}">
      <div class="dayhead"><h2>${dfull(d)}</h2>${i === 0 ? `<span class="today">TODAY</span>` : ""}${tag ? `<span class="tag">${tag}</span>` : ""}</div>
      <div class="split">
        <div class="col imp" aria-label="Just this day">${i === 0 ? `<p class="colhead">Just this day</p>` : ""}${left || `<p class="nothing">Nothing extra today.</p>`}</div>
        <div class="col rt" aria-label="Every day"><p class="colhead">Every day</p>${cover}${rt.map(rtHTML).join("")}</div>
      </div>
    </section>`);
  });
  html.push(`<p class="note">Each day has two columns. The right one is what happens every day: kid coverage, Kiara's breakfast and school meals, the commute, and calendar events that repeat daily. Obvious ones like Grandma's cooking and the nightly catch-up aren't shown, but still count in the load split. Everything else goes on the left: weekly chores, weekly events like trash night, appointments, school closures, todos due that day and milestones. Tap any card to hand it to the other person or move it to another day. The badge in the top corner is this week's load split.</p>`);
  return html.join("");
}
function closureWhen(c) {
  const s = parseDay(c.start), e = parseDay(c.end);
  return c.end && c.end !== c.start ? `${fmtShort(s)} – ${fmtShort(e)}` : fmtShort(s);
}

// ---------- This month: only the big things ----------
function monthItems() {
  const items = [];
  let hidden = 0;
  const inRange = (d) => d && d >= MONTH0 && d < RANGE_END;
  const push = (date, kind, label, what, extra = {}) => { if (inRange(date)) items.push({ date: startOfDay(date), kind, label, what, ...extra }); };
  const repeating = repeatingSeries(MONTH_EVENTS);
  MONTH_EVENTS.forEach((ev) => {
    if (isMonthRoutine(ev, repeating)) { hidden++; return; }
    const sub = ev.allDay
      ? (ev.end - ev.start > 864e5 ? `until ${fmtShort(addDays(ev.end, -1))}` : "")
      : ev.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase();
    push(ev.start, "event", /birthday/i.test(ev.title) ? "Birthday" : "Event", ev.title, { sub, owner: ev.owners.length > 1 ? "both" : ev.owners[0] });
  });
  CLOSURES.forEach((c) => push(parseDay(c.start), "closure", "Closed", `${SCHOOL_NAME}: ${c.what}`,
    { sub: c.end !== c.start ? `through ${fmtShort(parseDay(c.end))}. Plan Kiara's days.` : "Plan Kiara's day." }));
  S.todos.filter((t) => !t.done && parseDay(t.due)).forEach((t) => push(parseDay(t.due), "todo", "Due", t.title, { sub: t.pri + (t.note ? " · " + t.note : ""), owner: t.owner }));
  ["k1", "k2"].forEach((id) => autoMilestones(S.kids[id].born).forEach((m) => push(m.date, "kid", S.kids[id].name, m.what, { sub: m.sub })));
  [0, 1].forEach((dy) => Object.entries(DAY_TAGS).forEach(([md, name]) => push(new Date(MONTH0.getFullYear() + dy, +md.slice(0, 2) - 1, +md.slice(3)), "home", "Holiday", name)));
  HOUSE.forEach((h) => push(parseDay(h.date), "home", "Home", h.what, { sub: h.sub }));
  const rank = { closure: 0, todo: 1, kid: 2, event: 3, home: 4 };
  items.sort((x, y) => x.date - y.date || rank[x.kind] - rank[y.kind]);
  return { items, hidden };
}
function mitemHTML(it) {
  const p = it.owner ? person(it.owner) : null;
  return `<div class="mitem"><span class="k ${it.kind}">${esc(it.label)}</span>
    <span class="w">${esc(it.what)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span>
    ${p ? `<span class="chip ${p.cls}">${esc(p.name)}</span>` : ""}</div>`;
}
function mdaysHTML(list) {
  const groups = [];
  list.forEach((it) => { const k = dateKey(it.date); const g = groups[groups.length - 1]; if (g && g.k === k) g.items.push(it); else groups.push({ k, date: it.date, items: [it] }); });
  return groups.map((g) => {
    const isToday = g.k === dateKey(TODAY);
    return `<div class="mday ${isToday ? "today" : g.date < TODAY ? "past" : ""}"><div class="d"><b>${g.date.getDate()}</b><span>${isToday ? "Today" : dname(g.date)}</span></div>
      <div class="mitems">${g.items.map(mitemHTML).join("")}</div></div>`;
  }).join("");
}
function renderMonth() {
  const { items, hidden } = monthItems();
  const inMonth = (d) => d && d >= MONTH0 && d < MONTH1;
  const open = S.todos.filter((t) => !t.done && (t.pri === "P0" || t.pri === "P1") && !inMonth(parseDay(t.due)))
    .sort((x, y) => (x.pri === y.pri ? 0 : x.pri === "P0" ? -1 : 1) || byDue(x, y));
  const past = items.filter((it) => inMonth(it.date) && it.date < TODAY), ahead = items.filter((it) => inMonth(it.date) && it.date >= TODAY);
  const html = [demoBanner()];
  html.push(`<div class="mhead"><h2>${MONTH0.toLocaleDateString("en-US", { month: "long" })}</h2><p class="fine">${ahead.length} coming up</p></div>`);
  if (open.length) html.push(`<div class="p0box">
      <div class="head"><p class="label" style="margin:0">Still open this month</p><button class="linkbtn" data-tab="todos">All todos</button></div>
      ${open.map(todoHTML).join("")}
    </div>`);
  html.push(`<div class="panel">
      ${ahead.length ? mdaysHTML(ahead) : `<p>Nothing big left this month.</p>`}
      ${past.length ? `<details class="earlier"><summary>Earlier this month (${past.length})</summary>${mdaysHTML(past)}</details>` : ""}
    </div>`);
  html.push(`<p class="label" style="margin-top:24px">Next ${AHEAD} months</p>`);
  for (let i = 1; i <= AHEAD; i++) {
    const m0 = monthStart(TODAY, i), m1 = monthStart(TODAY, i + 1);
    const list = items.filter((it) => it.date >= m0 && it.date < m1);
    html.push(`<div class="panel"><div class="mhead" style="margin-bottom:4px"><h2 style="font-size:20px">${m0.toLocaleDateString("en-US", { month: "long", year: m0.getFullYear() !== TODAY.getFullYear() ? "numeric" : undefined })}</h2><p class="fine">${list.length ? `${list.length} big ${list.length === 1 ? "thing" : "things"}` : ""}</p></div>
      ${list.length ? mdaysHTML(list) : `<p>Nothing on the radar yet.</p>`}</div>`);
  }
  html.push(`<p class="note">Only the big things: school closures, one-off events and birthdays, todos with a due date, open P0 and P1 todos, milestones, holidays and household changes. Everyday routine is left out (meals, commute, kid coverage, weekly chores${hidden ? `, and ${hidden} repeating calendar event${hidden > 1 ? "s" : ""}` : ""}). An event counts as routine when it repeats more than once in a month, so yearly and monthly ones still show.</p>`);
  return html.join("");
}

// ---------- Todos ----------
function dueHTML(t) {
  const d = parseDay(t.due);
  if (!d) return "";
  const st = dueStatus(t.due, TODAY, t.done);
  return `<span class="due ${st === "late" ? "late" : st === "soon" ? "soon" : ""}">${st === "late" ? "Overdue · " : "Due "}${fmtShort(d)}</span>`;
}
function todoHTML(t) {
  const p = person(t.owner);
  return `<div class="todo ${t.done ? "done" : ""}">
    <input type="checkbox" id="todo-${esc(t.id)}" data-todo-done="${esc(t.id)}" ${t.done ? "checked" : ""} aria-label="Mark done">
    <button class="pri ${t.pri}" data-todo-pri="${esc(t.id)}" title="Tap to change priority">${t.pri}</button>
    <label class="ttl" for="todo-${esc(t.id)}">${esc(t.title)}${t.note || t.due ? `<small>${dueHTML(t)}${esc(t.note || "")}</small>` : ""}</label>
    <button class="chip ${p.cls}" data-todo-owner="${esc(t.id)}" title="Tap to change who owns it">${esc(p.name)}</button>
    ${tab === "todos" ? `<button class="x" data-todo-del="${esc(t.id)}" aria-label="Delete todo">×</button>` : ""}
  </div>`;
}
function renderTodos() {
  const owners = ["a", "b", "both", "open"];
  return demoBanner() + `<div class="panel">
      <form class="addform" id="addTodo">
        <input type="text" id="todoTitle" placeholder="Add a todo" aria-label="Todo" required>
        <select id="todoPri" aria-label="Priority">${Object.keys(PRI).map((k) => `<option value="${k}" ${k === "P1" ? "selected" : ""}>${k} · ${PRI[k]}</option>`).join("")}</select>
        <select id="todoOwner" aria-label="Owner">${owners.map((k) => `<option value="${k}">${PEOPLE[k].name}</option>`).join("")}</select>
        <input type="date" id="todoDue" aria-label="Due date (optional)" title="Due date (optional)">
        <button type="submit">Add</button>
      </form>
    </div>` + Object.keys(PRI).map((k) => {
      const list = S.todos.filter((t) => t.pri === k).sort(byDue);
      return `<div class="panel"><h2>${k} · ${PRI[k]}</h2>${list.length ? list.map(todoHTML).join("") : `<p>Nothing here yet.</p>`}</div>`;
    }).join("") + `<p class="note">P0 todos also show at the top of This week. Tap the priority or the name to change them.</p>`;
}

// ---------- Kids ----------
function renderKid(id) {
  const k = S.kids[id];
  const tl = upcomingMilestones(k.born, TODAY).slice(0, 10);
  const firstNext = tl.findIndex((m) => m.date >= TODAY);
  const facts = [["School", k.school], ["Classroom", k.classroom], ["Teacher", k.teacher], ["Starts", k.starts]].filter((f) => f[1]);
  const todos = S.todos.filter((t) => t.kid === id && !t.done).sort(byDue);
  const re = new RegExp(`\\b${k.name}\\b`, "i");
  const cal = calendarCards().filter((c) => re.test(c.title));
  return demoBanner() + `<div class="panel">
      <div class="kidhead"><h2>${esc(k.name)}</h2><span class="age">${esc(ageText(k.born, TODAY))}</span></div>
      ${facts.length ? `<dl class="facts">${facts.map((f) => `<dt>${f[0]}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>` : ""}
      ${k.now?.length ? `<h3>Where she is now</h3><ul>${k.now.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    </div>
    <div class="panel">
      <h2>Next milestones</h2>
      <div class="timeline">${tl.map((m, i) => `<div class="ms ${i === firstNext ? "next" : ""}"><span class="when">${fmtShort(m.date)}</span><span>${esc(m.what)}${m.sub ? `<small>${esc(m.sub)}</small>` : ""}</span></div>`).join("")}</div>
      <p class="fine" style="margin-top:12px">Checkup and milestone timings follow the usual US pediatric schedule. Every child moves at her own pace.</p>
    </div>
    <div class="panel">
      <h2>To do for ${esc(k.name)}</h2>
      ${todos.length ? todos.map(todoHTML).join("") : `<p>Nothing open.</p>`}
    </div>
    <div class="panel">
      <h2>This week</h2>
      ${cal.length ? `<div class="timeline">${cal.map((c) => `<div class="ms"><span class="when">${fmtShort(parseDay(c.date))}</span><span>${esc(c.title)}</span></div>`).join("")}</div>` : `<p>Nothing on the calendar with "${esc(k.name)}" in the title this week.</p>`}
    </div>
    ${id === "k1" ? closuresPanel() + schoolMenuPanel() + menuPanel() : ""}
    ${devPanels(id)}`;
}

function closuresPanel() {
  const list = upcomingClosures(CLOSURES, TODAY);
  return `<div class="panel">
      <h2>School closed days</h2>
      ${list.length ? `<div class="timeline">${list.map((c) => `<div class="ms"><span class="when">${closureWhen(c)}</span><span>${esc(c.what)}</span></div>`).join("")}</div>` : `<p>No closures coming up.</p>`}
      <p class="fine" style="margin-top:10px">These also show on This week and This month so you can plan who has Kiara.</p>
    </div>`;
}
function schoolMenuPanel() {
  const rows = DAYS.filter((d) => SCHOOL_MENU[d.getDay()] && !CLOSED.has(dateKey(d)));
  return `<div class="panel smenu">
      <h2>School meals this week</h2>
      <p class="fine" style="margin-top:-2px">What the school serves on school days. Breakfast and lunch also show on each day in This week.</p>
      ${rows.length ? rows.map((d) => { const m = SCHOOL_MENU[d.getDay()]; return `<div class="row ${dateKey(d) === dateKey(TODAY) ? "today" : ""}"><span class="d">${d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}</span>
        <span class="m"><b>Breakfast</b> ${esc(m.am)}<br><b>Lunch</b> ${esc(m.lunch)}<br><b>PM</b> ${esc(m.pm)}</span></div>`; }).join("") : `<p>No school days this week.</p>`}
    </div>`;
}
function menuPanel() {
  const order = [1, 2, 3, 4, 5, 6, 0], wd = TODAY.getDay();
  return `<div class="panel">
      <h2>Home breakfast menu</h2>
      <p class="fine" style="margin-top:-2px">${PEOPLE.a.name} makes it before school, and on weekends and closed days. Each day's meal shows on that day's breakfast card in This week.</p>
      <div class="menugrid">${order.map((i) => `<label for="meal-${i}" class="${i === wd ? "today" : ""}">${WEEKDAYS[i].slice(0, 3)}</label><input id="meal-${i}" data-meal="${i}" maxlength="60" value="${esc(S.menu[i] ?? DEFAULT_MENU[i])}" placeholder="Anything">`).join("")}</div>
      <p class="fine" style="margin-top:10px">Edits save when you click away.</p>
    </div>`;
}

// ---------- Development ----------
const AREAS = [["physical", "Physical", "Growth, movement, sleep, eating, health"], ["emotional", "Emotional", "Feelings, confidence, relationships"], ["mental", "Mental and educational", "Language, thinking, learning, school"]];
function devPanels(id) {
  const d = S.dev[id] || {};
  return `<h2 class="sect">Development</h2>` + AREAS.map(([a, label, hint]) => {
    const v = d[a] || {};
    return `<div class="panel dev">
        <h2>${label}</h2><p class="fine" style="margin-top:-2px">${hint}</p>
        <label class="label" for="dev-${id}-${a}-now">Where she is</label>
        <textarea id="dev-${id}-${a}-now" data-kid="${id}" data-dev="${a}" data-field="now" rows="3" placeholder="What you're seeing right now">${esc(v.now)}</textarea>
        <label class="label" for="dev-${id}-${a}-help">What would help</label>
        <textarea id="dev-${id}-${a}-help" data-kid="${id}" data-dev="${a}" data-field="help" rows="3" placeholder="Things to try or keep doing">${esc(v.help)}</textarea>
      </div>`;
  }).join("") + `<p class="note">Notes save when you click away. General ideas for each age, not medical advice.</p>`;
}

// ---------- Finances (sample numbers) ----------
function renderFinance() {
  const f = FINANCE.snapshot, a = FINANCE.assets;
  const cf = cashFlow(f);
  const spend = [...f.spend].sort((x, y) => (y[1] + y[2]) - (x[1] + x[2]));
  const max = Math.max(...spend.map((r) => r[1] + r[2]));
  const atot = a.items.reduce((t, [, v]) => t + v, 0);
  const acol = ["var(--s1)", "var(--s2)", "var(--s3)"];
  const goals = S.goals.slice(0, 2);
  while (goals.length < 2) goals.push({ title: "", note: "" });
  return demoBanner() + `<div class="fin">
  <div class="panel">
    <h2>Goals</h2>
    <p>One or two big ones. Edit them here; they save when you click away.</p>
    ${goals.map((x, i) => `<div class="goal"><span class="n" aria-hidden="true">${i + 1}</span><div>
      <input data-goal="${i}" data-field="title" value="${esc(x.title)}" placeholder="Goal ${i + 1}" aria-label="Goal ${i + 1}">
      <textarea data-goal="${i}" data-field="note" rows="2" placeholder="Why it matters, how you'll know" aria-label="Goal ${i + 1} details">${esc(x.note)}</textarea>
    </div></div>`).join("")}
  </div>
  <div class="panel">
    <h2>Spending and income</h2>
    <p class="period">${esc(f.period)} · monthly averages · sample numbers</p>
    <div class="tiles">
      <div class="tile"><p class="lbl">Income / month</p><p class="v">${usd(cf.inc, true)}</p><p class="s">after tax</p></div>
      <div class="tile"><p class="lbl">Recurring spend / month</p><p class="v">${usd(cf.rec, true)}</p><p class="s">plus ${usd(cf.one, true)}/mo one-time</p></div>
      <div class="tile"><p class="lbl">Left over / month</p><p class="v">${usd(cf.left, true)}</p><p class="s">income minus recurring</p></div>
      <div class="tile"><p class="lbl">Savings rate</p><p class="v">${cf.rate}%</p><p class="s">of income</p></div>
    </div>
    <div class="split">
      <div>
        <h3>Income, after tax</h3>
        <table class="inc"><tbody>
          ${f.income.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${usd(v)}</td></tr>`).join("")}
          <tr class="total"><td>Per month</td><td class="num">${usd(cf.inc)}</td></tr>
        </tbody></table>
      </div>
      <div>
        <h3>Where it goes, per month</h3>
        <div class="legend"><span><i style="background:var(--s1)"></i>Recurring</span><span><i style="background:var(--s2)"></i>One-time (spread over the period)</span></div>
        <div class="bars" role="list">
          ${spend.map(([k, r, o]) => `<div class="row" role="listitem" title="${esc(k)}: ${usd(r + o)} a month${o ? ` (${usd(r)} recurring, ${usd(o)} one-time)` : ""}">
              <span class="cat">${esc(k)}</span>
              <span class="track">${r ? `<span class="seg" style="width:${(r / max) * 100}%;background:var(--s1)"></span>` : ""}${o ? `<span class="seg" style="width:${(o / max) * 100}%;background:var(--s2)"></span>` : ""}</span>
              <span class="val">${usd(r + o)}</span></div>`).join("")}
        </div>
      </div>
    </div>
    <h3>Biggest one-time costs</h3>
    <table class="inc"><tbody>${f.oneTime.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${usd(v)}</td></tr>`).join("")}</tbody></table>
  </div>
  <div class="panel">
    <h2>Assets</h2>
    <div class="tiles">
      <div class="tile"><p class="lbl">Total</p><p class="v">${usd(atot, true)}</p></div>
      ${a.items.map(([k, v], i) => `<div class="tile"><p class="lbl"><i class="sw" style="background:${acol[i % 3]}"></i>${esc(k)}</p><p class="v">${usd(v, true)}</p><p class="s">${Math.round((v / atot) * 100)}% of total</p></div>`).join("")}
    </div>
    <div class="stack" role="img" aria-label="${esc(a.items.map(([k, v]) => `${k} ${Math.round((v / atot) * 100)}%`).join(", "))}">
      ${a.items.map(([, v], i) => `<span style="width:${(v / atot) * 100}%;background:${acol[i % 3]}"></span>`).join("")}
    </div>
  </div>
  <p class="note">Every figure on this tab is invented for the demo. In the private version it's a snapshot of the household's cash-flow sheet, refreshed only when they ask.</p>
  </div>`;
}

// ---------- Fairness ----------
function renderFair() {
  const s = split();
  const grouped = {};
  allCards().filter((c) => c.day >= 0 && c.hrs && ["a", "b", "both"].includes(c.owner)).forEach((c) => {
    (c.owner === "both" ? ["a", "b"] : [c.owner]).forEach((w) => {
      const k = w + "|" + c.title;
      grouped[k] = grouped[k] || { who: w, item: c.title, hrs: 0, n: 0 };
      grouped[k].hrs += c.owner === "both" ? c.hrs / 2 : c.hrs; grouped[k].n++;
    });
  });
  const table = (who) => `<div class="tblwrap"><table>
      <thead><tr><th>${PEOPLE[who].name}</th><th class="num">Hours / week</th><th class="num">Weight</th><th class="num">Counts</th></tr></thead>
      <tbody>
      ${S.hours.map((r, i) => r.who !== who ? "" : `<tr><td>${esc(r.item)}</td>
        <td class="num"><input type="number" min="0" max="168" step="0.25" id="hrs-${i}" data-hrs="${i}" value="${+r.hrs}" aria-label="${esc(r.item)} hours"></td>
        <td class="num">${r.w}</td><td class="num">${(r.hrs * r.w).toFixed(1)}</td></tr>`).join("")}
      ${Object.values(grouped).filter((g) => g.who === who).map((g) => `<tr><td>${esc(g.item)}${g.n > 1 ? ` (×${g.n})` : ""}</td><td class="num">${+g.hrs.toFixed(2)}</td><td class="num">1</td><td class="num">${g.hrs.toFixed(1)}</td></tr>`).join("")}
      <tr class="total"><td>Total weekly load</td><td></td><td></td><td class="num">${s.L[who].toFixed(1)}</td></tr></tbody>
    </table></div>`;
  return demoBanner() + `<div class="panel">
      <h2>How the score is worked out</h2>
      <div class="bigscore"><span><b style="color:var(--pa)">${s.a}%</b> ${PEOPLE.a.name}</span><span><b style="color:var(--pb)">${s.b}%</b> ${PEOPLE.b.name}</span><span class="fine">${s.balanced ? "Balanced (within 45–55%)" : "Outside 45–55%"}</span></div>
      <p>Each person's weekly load is paid work, commute, time covering the kids, and the chores on this week's cards, all in hours. Shared or light-touch time (the baby while grandparents are also there) counts at half. Cards owned by "Both" split evenly. Work done by Grandma or the house help isn't counted for either parent, but planning it is.</p>
      <p>Edit any hours below and the score updates.</p>
    </div>
    <div class="panel">${table("a")}</div>
    <div class="panel">${table("b")}</div>`;
}

function render() {
  renderHeader();
  const m = document.getElementById("main");
  m.innerHTML = tab === "week" ? renderWeek() : tab === "month" ? renderMonth() : tab === "todos" ? renderTodos()
    : tab === "fin" ? renderFinance() : tab === "fair" ? renderFair() : renderKid(tab);
}

// ---------- Card sheet ----------
let open = null;
function drawSheet() {
  const root = document.getElementById("sheetRoot");
  if (!open) { root.innerHTML = ""; return; }
  const c = findCard(open.id);
  const owners = c.fixed ? [] : ["a", "b", "both", "grandma", "help", "open"];
  root.innerHTML = `<div class="sheet-bg" data-close></div>
    <div class="sheet" role="dialog" aria-label="Edit ${esc(c.title)}"><div class="wrap">
      <h3>${esc(c.title)}</h3><p class="sub">${esc(c.time)}${c.hrs ? ` · about ${c.hrs}h` : ""}</p>
      ${owners.length ? `<p class="label">Who's doing it</p><div class="opts">${owners.map((k) => `<button class="opt ${PEOPLE[k].cls}" data-owner="${k}" aria-pressed="${open.owner === k}">${PEOPLE[k].name}</button>`).join("")}</div>` : ""}
      ${c.closure ? "" : `<p class="label">Move to</p>
      <div class="opts">${DAYS.map((d) => `<button class="opt" data-date="${dateKey(d)}" aria-pressed="${open.date === dateKey(d)}">${dname(d)} ${d.getDate()}</button>`).join("")}</div>`}
      <button class="done" data-done>Done</button>
    </div></div>`;
}
function closeSheet(keep) {
  const o = open; open = null; drawSheet();
  if (!keep || !o) return;
  const msgs = [];
  if (o.owner !== o.origOwner) msgs.push(`${PEOPLE[o.owner].name} has it`);
  if (o.date !== o.origDate) msgs.push(`moved to ${dname(parseDay(o.date))}`);
  if (!msgs.length) return;
  S.moves[o.id] = { owner: o.owner, date: o.date };
  persist(); render();
  const el = document.getElementById("card-" + o.id);
  if (el) { el.classList.add("moved"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
  const msg = msgs.join(", ");
  toast(msg[0].toUpperCase() + msg.slice(1));
}

let toastT;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 2400);
}

// ---------- Events ----------
const todo = (id) => S.todos.find((t) => t.id === id);
document.addEventListener("click", (e) => {
  const q = (sel) => e.target.closest(sel);
  let el;
  if ((el = q("[data-tab]"))) { tab = el.dataset.tab; render(); window.scrollTo(0, 0); return; }
  if (q("[data-reset]")) { resetDemo(); return; }
  if ((el = q("[data-card]"))) { const c = findCard(el.dataset.card); open = { id: c.id, owner: c.owner, date: c.date, origOwner: c.owner, origDate: c.date }; drawSheet(); return; }
  if ((el = q("[data-owner]")) && open) { open.owner = el.dataset.owner; drawSheet(); return; }
  if ((el = q("[data-date]")) && open) { open.date = el.dataset.date; drawSheet(); return; }
  if (q("[data-done]")) { closeSheet(true); return; }
  if (q("[data-close]")) { closeSheet(false); return; }
  if ((el = q("[data-todo-done]"))) { const t = todo(el.dataset.todoDone); t.done = el.checked; persist(); render(); if (t.done) toast("Done: " + t.title); return; }
  if ((el = q("[data-todo-owner]"))) { const t = todo(el.dataset.todoOwner); const o = ["a", "b", "both", "open"]; t.owner = o[(o.indexOf(t.owner) + 1) % o.length]; persist(); render(); return; }
  if ((el = q("[data-todo-pri]"))) { const t = todo(el.dataset.todoPri); t.pri = nextPriority(t.pri); persist(); render(); toast(t.pri === "P0" ? "Now P0. It shows on This week too" : "Now " + t.pri); return; }
  if ((el = q("[data-todo-del]"))) {
    if (el.dataset.confirm !== "1") { el.dataset.confirm = "1"; el.textContent = "Delete?"; el.style.fontSize = "12px"; return; }
    S.todos = S.todos.filter((t) => t.id !== el.dataset.todoDel); persist(); render(); toast("Deleted");
  }
});
document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.id !== "addTodo") return;
  const title = document.getElementById("todoTitle").value.trim();
  if (!title) return;
  const pri = document.getElementById("todoPri").value, due = document.getElementById("todoDue").value;
  S.todos.push({ id: "t" + Date.now(), pri, title, owner: document.getElementById("todoOwner").value, done: false, createdAt: Date.now(), ...(due ? { due } : {}) });
  persist(); render(); toast(pri === "P0" ? "Added. It also shows on This week" : "Added to " + pri);
});
document.addEventListener("change", (e) => {
  const meal = e.target.closest("[data-meal]");
  if (meal) { S.menu[+meal.dataset.meal] = meal.value.trim(); persist(); toast("Menu saved"); return; }
  const goal = e.target.closest("[data-goal]");
  if (goal) { S.goals[+goal.dataset.goal] = { ...(S.goals[+goal.dataset.goal] || {}), [goal.dataset.field]: goal.value.trim() }; persist(); toast("Goal saved"); return; }
  const dv = e.target.closest("[data-dev]");
  if (dv) {
    const d = (S.dev[dv.dataset.kid] = S.dev[dv.dataset.kid] || {});
    d[dv.dataset.dev] = { ...(d[dv.dataset.dev] || {}), [dv.dataset.field]: dv.value.trim() };
    persist(); toast("Saved"); return;
  }
  const h = e.target.closest("[data-hrs]");
  if (h) {
    S.hours[+h.dataset.hrs].hrs = Math.max(0, Math.min(168, +h.value || 0));
    persist(); render();
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) closeSheet(false); });

render();
