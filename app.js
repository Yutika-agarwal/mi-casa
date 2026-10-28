// Mi Casa demo: the household hub UI. State lives in this browser only.
import {
  addMonths, ageText, byDue, dateKey, dueStatus, loads, nextPriority, parseDay,
  rollingWeek, shares, startOfDay, upcomingMilestones,
} from "./logic.js";
import { KIDS, PEOPLE, coverFor, demoState, routine, sampleCalendar } from "./data.js";

const STORE_KEY = "mi-casa-demo-v1";
const TODAY = startOfDay(new Date());
const DAYS = rollingWeek(TODAY);
const PRI = { P0: "Needs attention now", P1: "Within a week or so", P2: "Long term and planned" };
const DAY_TAGS = { "10-31": "Halloween", "12-25": "Christmas", "01-01": "New Year's Day" };

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
    if (raw) { const s = JSON.parse(raw); if (s && s.version === 1) return s; }
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
function calendarCards() {
  return sampleCalendar(TODAY).map((ev) => ({
    id: "cal~" + ev.id, cal: true, date: dateKey(ev.start), title: ev.title,
    time: ev.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(" ", "").toLowerCase(),
    hrs: Math.min(3, Math.round(((ev.end - ev.start) / 36e5) * 4) / 4),
    owner: ev.owners.length > 1 ? "both" : ev.owners[0],
    note: ev.owners.length > 1 ? "On both your calendars" : "",
  }));
}
function allCards() {
  return routine(DAYS).concat(calendarCards()).map((c) => {
    const mv = S.moves[c.id];
    const out = { ...c, ...(mv || {}) };
    out.day = DAYS.findIndex((d) => dateKey(d) === out.date);
    return out;
  });
}
const findCard = (id) => allCards().find((c) => c.id === id);
const split = () => { const L = loads(S.hours, allCards()); return { L, ...shares(L) }; };

// ---------- Rendering ----------
let tab = "week", devKid = "k1";
const TABS = [["week", "This week"], ["todos", "Todos"], ["k1", KIDS.k1], ["k2", KIDS.k2], ["dev", "Development"], ["fair", "Fairness"]];

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

function renderWeek() {
  const p0 = S.todos.filter((t) => t.pri === "P0" && !t.done);
  const cards = allCards();
  const html = [demoBanner()];
  if (p0.length) html.push(`<div class="p0box">
      <div class="head"><p class="label" style="margin:0">Needs attention now</p><button class="linkbtn" data-tab="todos">All todos</button></div>
      ${p0.map(todoHTML).join("")}
    </div>`);
  const coming = ["k1", "k2"].map((id) => {
    const k = S.kids[id];
    const next = upcomingMilestones(k.born, TODAY).find((m) => m.date >= TODAY);
    return next ? `<div class="ev"><b>${esc(k.name)} · ${fmtShort(next.date)}</b>${esc(next.what)}</div>` : "";
  }).join("");
  html.push(`<p class="label">Coming up</p><div class="coming">${coming}</div>`);
  DAYS.forEach((d, i) => {
    const tag = DAY_TAGS[dateKey(d).slice(5)];
    html.push(`<section class="day" aria-label="${dfull(d)}">
      <div class="dayhead"><h2>${dfull(d)}</h2>${i === 0 ? `<span class="today">TODAY</span>` : ""}${tag ? `<span class="tag">${tag}</span>` : ""}</div>
      <div class="cover">${coverFor(d).map((c) => `<div class="lane ${PEOPLE[c.who].cls}"><span class="who">${PEOPLE[c.who].name}</span><span class="what">${c.what} <span>· ${c.when}</span></span></div>`).join("")}</div>
      <div class="tasks">${cards.filter((c) => c.day === i).map(cardHTML).join("")}</div>
    </section>`);
  });
  html.push(`<p class="note">Tap any card to hand it to the other person or move it to another day. The badge in the top corner is this week's load split; tap it to see how it's worked out.</p>`);
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
    </div>`;
}

// ---------- Development ----------
const AREAS = [["physical", "Physical", "Growth, movement, sleep, eating, health"], ["emotional", "Emotional", "Feelings, confidence, relationships"], ["mental", "Mental and educational", "Language, thinking, learning, school"]];
function renderDev() {
  const k = S.kids[devKid], d = S.dev[devKid] || {};
  return demoBanner() + `<div class="opts">${["k1", "k2"].map((id) => `<button class="opt" data-devkid="${id}" aria-pressed="${devKid === id}">${KIDS[id]}</button>`).join("")}</div>
    <p class="fine" style="margin:-4px 0 14px">${esc(k.name)} · ${esc(ageText(k.born, TODAY))}</p>` +
    AREAS.map(([a, label, hint]) => {
      const v = d[a] || {};
      return `<div class="panel dev">
        <h2>${label}</h2><p class="fine" style="margin-top:-2px">${hint}</p>
        <label class="label" for="dev-${devKid}-${a}-now">Where she is</label>
        <textarea id="dev-${devKid}-${a}-now" data-dev="${a}" data-field="now" rows="3" placeholder="What you're seeing right now">${esc(v.now)}</textarea>
        <label class="label" for="dev-${devKid}-${a}-help">What would help</label>
        <textarea id="dev-${devKid}-${a}-help" data-dev="${a}" data-field="help" rows="3" placeholder="Things to try or keep doing">${esc(v.help)}</textarea>
      </div>`;
    }).join("") + `<p class="note">Notes save when you click away. General ideas for each age, not medical advice.</p>`;
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
  m.innerHTML = tab === "week" ? renderWeek() : tab === "todos" ? renderTodos() : tab === "dev" ? renderDev()
    : tab === "fair" ? renderFair() : renderKid(tab);
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
      <p class="label">Move to</p>
      <div class="opts">${DAYS.map((d) => `<button class="opt" data-date="${dateKey(d)}" aria-pressed="${open.date === dateKey(d)}">${dname(d)} ${d.getDate()}</button>`).join("")}</div>
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
  if ((el = q("[data-devkid]"))) { devKid = el.dataset.devkid; render(); return; }
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
  const dv = e.target.closest("[data-dev]");
  if (dv) {
    const d = (S.dev[devKid] = S.dev[devKid] || {});
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
