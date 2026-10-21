/* JUDE Beauty Clinic – Admin Dashboard (front-end demo) */
const $ = (s, e = document) => e.querySelector(s);
const STATUSES = ["Confirmed", "Pending", "Completed", "Cancelled", "No-show"];
const ICONS = { overview: "◫", appointments: "◷", patients: "☺", treatments: "✦", doctors: "✚", messages: "✉", reports: "▤", settings: "⚙" };
const PAL = ["#17263C", "#B88B72", "#E2C8B8", "#657080", "#D9A98F", "#8E99A8", "#3B6B4A", "#9A6A2F"];
const SCOL = { Completed: "#3B6B4A", Confirmed: "#2C4A73", Pending: "#C9A05A", Cancelled: "#A24A44", "No-show": "#8E99A8" };
const TODAY = iso(0);

/* ---------- State ---------- */
let NID = 0;
const S = {
  appts: APPTS_RAW.map(a => ({ id: ++NID, patient: a[0], tr: a[1], doc: TREATMENTS[a[1]].doc, date: iso(a[2]), time: a[3], status: a[4], notes: "" })),
  msgs: MESSAGES_RAW.map((m, i) => ({ ...m, id: i })),
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  aview: "upcoming", rep: "revenue", range: "month", from: iso(-30), to: TODAY, sel: null, csv: []
};
try { Object.assign(S.settings, JSON.parse(localStorage.getItem("jude-admin-v2") || "{}")); } catch (e) {}

/* ---------- Helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = n => S.settings.currency + Math.round(S.settings.currency === "$" ? n / 3.7 : n).toLocaleString();
const fdate = d => !d ? "—" : d === TODAY ? "Today" : new Date(d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const initials = n => n.replace("Dr. ", "").split(" ").map(w => w[0]).slice(0, 2).join("");
const age = dob => dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) : "—";
const badge = s => `<span class="badge ${s.toLowerCase().replace("-", "")}">${s}</span>`;
const rev = a => a.status === "Completed" ? TREATMENTS[a.tr].price : 0;
const sum = a => a.reduce((x, y) => x + y, 0);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const byDate = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);
const dstr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const docOpts = () => DOCTORS.map((d, i) => [i, d.name]);
const isUp = a => a.date >= TODAY && !["Cancelled", "Completed", "No-show"].includes(a.status);
const patAppts = n => S.appts.filter(a => a.patient === n);
const lastVisit = p => p.lastVisit || patAppts(p.name).filter(a => a.status === "Completed").sort(byDate).map(a => a.date).pop() || "";
const toast = msg => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400); };
const statusSelect = a => `<select class="st" data-status="${a.id}">${STATUSES.map(s => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select>`;
const sc = (l, v, s, c) => `<div class="card stat"><span class="ic ${c || ""}">${{ c1: "₪", c2: "◷", c3: "▲", c4: "Ø" }[c] || "•"}</span><p>${l}</p><h3>${v}</h3><small>${s}</small></div>`;

/* ---------- Charts (pure HTML/SVG/CSS) ---------- */
function chart(labels, vals, fmt, hi) {
  const max = Math.max(...vals, 1) * 1.05, k = Math.ceil(labels.length / 10);
  return `<div class="chart">${labels.map((l, i) => `<div class="col ${i === hi ? "hi" : ""}"><div class="track" style="--h:${vals[i] / max * 100}%"><span class="val">${fmt(vals[i])}</span><div class="bar"></div></div><em>${i % k ? "" : l}</em></div>`).join("")}</div>`;
}
function line(labels, vals) {
  const n = vals.length, max = Math.max(...vals, 1), X = i => n > 1 ? 10 + i / (n - 1) * 580 : 300, Y = v => 180 - v / max * 160;
  const pts = vals.map((v, i) => `${X(i)},${Y(v)}`).join(" ");
  return `<svg class="line" viewBox="0 0 600 200" preserveAspectRatio="none"><polygon points="${X(0)},180 ${pts} ${X(n - 1)},180" fill="rgba(184,139,114,.16)"/><polyline points="${pts}" fill="none" stroke="#B88B72" stroke-width="2.5" vector-effect="non-scaling-stroke"/><line x1="0" x2="600" y1="180" y2="180" stroke="#E8DDD7"/></svg><div class="lx"><span>${labels[0]}</span><span>Peak: ${money(max)}</span><span>${labels[n - 1]}</span></div>`;
}
function hbars(items, fmt) {
  const max = Math.max(...items.map(i => i.v), 1);
  return items.map(i => `<div class="hb"><div class="hl"><span>${i.l}</span><b>${fmt(i.v)}</b></div><div class="meter"><i style="width:${i.v / max * 100}%"></i></div></div>`).join("");
}
function donut(items, center) {
  const tot = sum(items.map(i => i.v)) || 1; let acc = 0;
  const g = items.map((i, x) => { const a = acc / tot * 100; acc += i.v; return `${PAL[x % PAL.length]} ${a}% ${acc / tot * 100}%`; }).join(",");
  return `<div class="dwrap"><div class="donut" style="background:conic-gradient(${g})"><div><b>${sum(items.map(i => i.v))}</b><small>${center}</small></div></div><div class="legend">${items.map((i, x) => `<div><i style="background:${PAL[x % PAL.length]}"></i>${i.l}<b>${pct(i.v, tot)}%</b></div>`).join("")}</div></div>`;
}
function trend(L, f, t, fn) {
  if (f === t) { const ks = ["09", "10", "11", "12", "13", "14", "15", "16", "17", "18"]; return { labels: ks.map(k => k + ":00"), vals: ks.map(k => fn(L.filter(a => a.time.slice(0, 2) === k))) }; }
  const days = []; for (const d = new Date(f + "T00:00"); dstr(d) <= t; d.setDate(d.getDate() + 1)) days.push(dstr(d));
  return { labels: days.map(d => d.slice(5).replace("-", "/")), vals: days.map(d => fn(L.filter(a => a.date === d))) };
}

/* ---------- Modal & generic form ---------- */
const modal = html => { $("#modalBody").innerHTML = html; $("#modal").classList.add("open"); };
const closeModal = () => $("#modal").classList.remove("open");
$("#modalX").onclick = closeModal;
$("#modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeNav(); } });

function formModal(title, label, fields, vals, onSave, after) {
  const inp = f => {
    const v = vals[f.id] ?? "", id = `id="f_${f.id}"`;
    const c = f.type === "select" ? `<select ${id}>${f.opts.map(o => `<option value="${esc(o[0])}" ${o[0] == v ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`
      : f.type === "textarea" ? `<textarea ${id} rows="3">${esc(v)}</textarea>`
      : `<input ${id} type="${f.type || "text"}" value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ""}>`;
    return `<div class="field ${f.full ? "full" : ""}"><label>${f.label}${f.req ? " *" : ""}</label>${c}</div>`;
  };
  modal(`<p class="section-label">${label}</p><h2>${title}</h2><div class="fgrid">${fields.map(inp).join("")}</div><div class="actions"><button class="btn ghost" id="fCancel">Cancel</button><button class="btn" id="fSave">Save</button></div>`);
  $("#fCancel").onclick = closeModal;
  $("#fSave").onclick = () => {
    const out = {};
    for (const f of fields) {
      const el = $("#f_" + f.id), v = el.value.trim().replace(/[<>"&]/g, "");
      if (f.req && !v) { el.focus(); el.style.borderColor = "#A24A44"; return toast("Please fill in: " + f.label); }
      out[f.id] = f.type === "number" ? +v : v;
    }
    if (onSave(out) === false) return;
    closeModal(); go();
  };
  after && after();
}

/* ---------- Forms ---------- */
function trForm(i) {
  const t = i != null ? TREATMENTS[i] : { name: "", price: "", mins: "", doc: 0 };
  formModal(i != null ? "Edit Treatment" : "Add Treatment", i != null ? "TREATMENT CATALOG" : "NEW TREATMENT", [
    { id: "name", label: "Treatment Name", req: 1, full: 1 }, { id: "price", label: "Price (₪)", type: "number", req: 1, min: 0 },
    { id: "mins", label: "Duration (minutes)", type: "number", req: 1, min: 5 }, { id: "doc", label: "Specialized Doctor", type: "select", opts: docOpts(), full: 1 }],
    t, v => { v.doc = +v.doc; if (i != null) Object.assign(t, v); else TREATMENTS.push(v); toast(i != null ? "Treatment updated" : "Treatment added"); });
}
function docForm() {
  formModal("Add Doctor", "NEW DOCTOR", [
    { id: "name", label: "Doctor Name", req: 1 }, { id: "role", label: "Specialty", req: 1 }, { id: "phone", label: "Phone" }, { id: "email", label: "Email", type: "email" },
    { id: "days", label: "Working Days", req: 1 }, { id: "hours", label: "Working Hours", req: 1 }, { id: "bio", label: "Short Bio", type: "textarea", full: 1 }],
    { days: "Sun, Mon, Tue", hours: "10:00 – 18:00" }, v => { if (!/^Dr\./i.test(v.name)) v.name = "Dr. " + v.name; DOCTORS.push(v); toast(v.name + " added"); });
}
function patForm() {
  formModal("Add Patient", "NEW PATIENT", [
    { id: "name", label: "Full Name", req: 1, full: 1 }, { id: "phone", label: "Phone", req: 1 }, { id: "email", label: "Email", type: "email" },
    { id: "dob", label: "Date of Birth", type: "date" }, { id: "gender", label: "Gender", type: "select", opts: [["Female", "Female"], ["Male", "Male"]] },
    { id: "lastVisit", label: "Last Visit", type: "date", full: 1 }, { id: "notes", label: "Notes", type: "textarea", full: 1 }],
    { gender: "Female" }, v => { PATIENTS.push({ ...v, joined: TODAY }); toast(v.name + " added to patients"); });
}
function apptForm(id, pat) {
  const a = id ? S.appts.find(x => x.id === id) : { patient: pat || PATIENTS[0].name, tr: 0, doc: TREATMENTS[0].doc, date: TODAY, time: "10:00", status: "Pending", notes: "" };
  formModal(id ? "Edit Appointment" : "New Appointment", id ? "APPOINTMENT #" + (1000 + id) : "SCHEDULING", [
    { id: "patient", label: "Patient", type: "select", opts: PATIENTS.map(p => [p.name, p.name]), full: 1 },
    { id: "tr", label: "Treatment", type: "select", opts: TREATMENTS.map((t, i) => [i, t.name]) }, { id: "doc", label: "Doctor", type: "select", opts: docOpts() },
    { id: "date", label: "Date", type: "date", req: 1 }, { id: "time", label: "Time", type: "time", req: 1 },
    { id: "status", label: "Status", type: "select", opts: STATUSES.map(s => [s, s]), full: 1 }, { id: "notes", label: "Notes", type: "textarea", full: 1 }],
    a, v => { v.tr = +v.tr; v.doc = +v.doc; if (id) Object.assign(a, v); else S.appts.push({ id: ++NID, ...v }); toast(id ? "Appointment updated" : "Appointment added"); },
    () => { $("#f_tr").onchange = e => $("#f_doc").value = TREATMENTS[e.target.value].doc; });
}
function pwForm() {
  formModal("Change Password", "SECURITY", [{ id: "cur", label: "Current Password", type: "password", req: 1, full: 1 }, { id: "n1", label: "New Password", type: "password", req: 1 }, { id: "n2", label: "Confirm New Password", type: "password", req: 1 }], {},
    v => { if (v.n1.length < 6) { toast("Use at least 6 characters"); return false; } if (v.n1 !== v.n2) { toast("Passwords do not match"); return false; } toast("Password updated (demo)"); });
}

/* ---------- Detail modals ---------- */
function apptModal(id) {
  const a = S.appts.find(x => x.id === id), t = TREATMENTS[a.tr];
  modal(`<p class="section-label">APPOINTMENT #${1000 + a.id}</p><h2>${a.patient}</h2>
  <div class="kv"><span>Treatment</span><b>${t.name} (${t.mins} min)</b><span>Doctor</span><b>${DOCTORS[a.doc].name}</b><span>Date & time</span><b>${fdate(a.date)} · ${a.time}</b><span>Price</span><b>${money(t.price)}</b><span>Notes</span><b>${esc(a.notes) || "—"}</b><span>Status</span><div>${statusSelect(a)}</div></div>
  <div class="actions" style="justify-content:flex-start"><button class="btn sm" data-do="editAppt" data-arg="${a.id}">Edit</button><button class="btn ghost sm" data-do="viewPat" data-arg="${esc(a.patient)}">Patient profile</button><button class="btn ghost sm danger" data-do="delAppt" data-arg="${a.id}">Delete</button></div>`);
}
function patientModal(name) {
  const p = PATIENTS.find(x => x.name === name), h = patAppts(name).sort((a, b) => byDate(b, a));
  modal(`<p class="section-label">PATIENT PROFILE</p><h2>${p.name}</h2>
  <div class="kv"><span>Phone</span><b>${p.phone}</b><span>Email</span><b>${p.email || "—"}</b><span>Age / Gender</span><b>${age(p.dob)} · ${p.gender}</b><span>Patient since</span><b>${fdate(p.joined)}</b><span>Last visit</span><b>${fdate(lastVisit(p))}</b><span>Notes</span><b>${p.notes || "—"}</b></div>
  <h3 style="margin-bottom:6px">Treatment history <small style="font-family:'DM Sans';font-size:13px;color:var(--muted)">(${h.length} appointments)</small></h3><div class="list hist">${h.map(a => `<div class="row"><div class="grow"><b>${TREATMENTS[a.tr].name}</b><small>${fdate(a.date)} · ${a.time} · ${DOCTORS[a.doc].name}</small></div>${badge(a.status)}</div>`).join("") || '<p class="empty">No appointments yet.</p>'}</div>
  <div class="actions" style="justify-content:flex-start"><button class="btn sm" data-do="bookFor" data-arg="${esc(p.name)}">+ Book appointment</button></div>`);
}

/* ---------- Reports ---------- */
const rng = () => S.range === "today" ? [TODAY, TODAY] : S.range === "week" ? [iso(-6), TODAY] : S.range === "month" ? [TODAY.slice(0, 8) + "01", TODAY] : S.from <= S.to ? [S.from, S.to] : [S.to, S.from];
const REPS = { revenue: "Revenue", appointments: "Appointments", treatments: "Treatments", doctors: "Doctors", patients: "Patients" };
const REP = {
  revenue(L, f, t) {
    const done = L.filter(a => a.status === "Completed"), tot = sum(done.map(rev)), rr = (x, y) => sum(S.appts.filter(a => a.date >= x && a.date <= y).map(rev));
    const byT = TREATMENTS.map((x, i) => ({ l: x.name, v: sum(done.filter(a => a.tr === i).map(rev)) })).sort((a, b) => b.v - a.v);
    const byD = DOCTORS.map((x, i) => ({ l: x.name, v: sum(done.filter(a => a.doc === i).map(rev)) })).sort((a, b) => b.v - a.v);
    const tr = trend(L, f, t, l => sum(l.map(rev))), mS = TODAY.slice(0, 8) + "01";
    return { html: `<div class="grid g4">${sc("Total revenue (range)", money(tot), "All time: " + money(rr("2000-01-01", TODAY)), "c1")}${sc("Revenue this month", money(rr(mS, TODAY)), "Since " + fdate(mS), "c2")}${sc("Revenue this week", money(rr(iso(-6), TODAY)), "Last 7 days", "c3")}${sc("Avg. per visit", money(done.length ? tot / done.length : 0), done.length + " completed visits", "c4")}</div>
    <div class="grid g2" style="margin-top:22px"><div class="card"><h2>Revenue trend</h2><p class="sub">${f === t ? "Hourly" : "Daily"} revenue in the selected range</p>${line(tr.labels, tr.vals)}</div><div class="card"><h2>Revenue by doctor</h2><p class="sub">Completed visits only</p>${hbars(byD, money)}</div></div>
    <div class="card" style="margin-top:22px"><h2>Revenue by treatment</h2><p class="sub">Which services earn the most</p>${hbars(byT, money)}</div>`,
      csv: [["Summary", "Revenue in range", tot], ...byT.map(x => ["By treatment", x.l, x.v]), ...byD.map(x => ["By doctor", x.l, x.v]), ...tr.labels.map((l, i) => ["Trend", l, tr.vals[i]])] };
  },
  appointments(L, f, t) {
    const c = s => L.filter(a => a.status === s).length, tr = trend(L, f, t, l => l.length);
    const byD = DOCTORS.map((d, i) => ({ d, x: L.filter(a => a.doc === i) }));
    const byT = TREATMENTS.map((x, i) => ({ l: x.name, v: L.filter(a => a.tr === i).length })).sort((a, b) => b.v - a.v);
    const stat = (s, col) => `<div class="card stat mini" style="border-top:3px solid ${col}"><p>${s}</p><h3>${s === "Total" ? L.length : c(s)}</h3></div>`;
    return { html: `<div class="cards5">${stat("Total", "#17263C")}${["Completed", "Pending", "Cancelled", "No-show"].map(s => stat(s, SCOL[s])).join("")}</div>
    <div class="grid g2" style="margin-top:22px"><div class="card"><h2>Appointment trend</h2><p class="sub">Bookings per ${f === t ? "hour" : "day"}</p>${chart(tr.labels, tr.vals, v => v)}</div>
    <div class="card"><h2>Status breakdown</h2><p class="sub">Outcome of all appointments in range</p><div class="stack">${["Completed", "Confirmed", "Pending", "Cancelled", "No-show"].map(s => `<i style="width:${pct(c(s), L.length)}%;background:${SCOL[s]}" title="${s}: ${c(s)}"></i>`).join("")}</div><div class="legend">${["Completed", "Confirmed", "Pending", "Cancelled", "No-show"].map(s => `<div><i style="background:${SCOL[s]}"></i>${s}<b>${c(s)}</b></div>`).join("")}</div><p class="sub" style="margin-top:14px">Completion rate: <b>${pct(c("Completed"), L.length)}%</b> · No-show rate: <b>${pct(c("No-show"), L.length)}%</b></p></div></div>
    <div class="grid g2" style="margin-top:22px"><div class="card"><h2>By doctor</h2><p class="sub">Workload and outcomes</p><div class="tbl flat"><table><thead><tr><th>DOCTOR</th><th>TOTAL</th><th>DONE</th><th>CANC.</th><th>NO-SHOW</th></tr></thead><tbody>${byD.map(({ d, x }) => `<tr><td><b>${d.name}</b></td><td>${x.length}</td><td>${x.filter(a => a.status === "Completed").length}</td><td>${x.filter(a => a.status === "Cancelled").length}</td><td>${x.filter(a => a.status === "No-show").length}</td></tr>`).join("")}</tbody></table></div></div>
    <div class="card"><h2>By treatment</h2><p class="sub">Number of appointments</p>${hbars(byT, v => v)}</div></div>`,
      csv: [...["Completed", "Pending", "Confirmed", "Cancelled", "No-show"].map(s => ["Status", s, c(s)]), ...byD.map(({ d, x }) => ["By doctor", d.name, x.length]), ...byT.map(x => ["By treatment", x.l, x.v]), ...tr.labels.map((l, i) => ["Trend", l, tr.vals[i]])] };
  },
  treatments(L) {
    const B = L.filter(a => a.status !== "Cancelled"), rows = TREATMENTS.map((x, i) => { const b = B.filter(a => a.tr === i); return { x, n: b.length, r: sum(b.map(rev)) }; }).sort((a, b) => b.n - a.n), top = rows[0];
    return { html: `<div class="grid g2"><div class="card"><h2>Treatment distribution</h2><p class="sub">Share of bookings (cancelled excluded)</p>${donut(rows.map(r => ({ l: r.x.name, v: r.n })), "bookings")}</div>
    <div class="card feature"><p class="section-label">MOST REQUESTED</p><h2 style="font-size:30px;margin:8px 0">${top.n ? top.x.name : "—"}</h2><p class="sub">${top.n} bookings · ${pct(top.n, B.length)}% of demand · Specialist: ${DOCTORS[top.x.doc].name}</p><p class="sub">Highest revenue: <b>${[...rows].sort((a, b) => b.r - a.r)[0].x.name}</b></p></div></div>
    <div class="tbl" style="margin-top:22px"><table><thead><tr><th>TREATMENT</th><th>SPECIALIST</th><th>BOOKINGS</th><th>REVENUE</th><th>POPULARITY</th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${r.x.name}</b><small>${r.x.mins} min · ${money(r.x.price)}</small></td><td>${DOCTORS[r.x.doc].name}</td><td>${r.n}</td><td>${money(r.r)}</td><td style="min-width:160px"><div class="meter"><i style="width:${pct(r.n, top.n)}%"></i></div></td></tr>`).join("")}</tbody></table></div>`,
      csv: rows.map(r => ["Treatment", r.x.name + " (bookings)", r.n]).concat(rows.map(r => ["Treatment", r.x.name + " (revenue)", r.r])) };
  },
  doctors(L) {
    const D = DOCTORS.map((d, i) => {
      const x = L.filter(a => a.doc === i), tc = TREATMENTS.map((t, k) => ({ l: t.name, v: x.filter(a => a.tr === k && a.status !== "Cancelled").length })).filter(o => o.v).sort((a, b) => b.v - a.v);
      return { d, n: x.length, done: x.filter(a => a.status === "Completed").length, up: S.appts.filter(a => a.doc === i && isUp(a)).length, tc };
    });
    return { html: `<div class="grid g3">${D.map(o => `<div class="card"><div class="dhead"><i class="av">${initials(o.d.name)}</i><div><h3>${o.d.name}</h3><small>${o.d.role}</small></div></div>
    ${hbars([{ l: "Appointments (range)", v: o.n }, { l: "Completed", v: o.done }, { l: "Upcoming (all dates)", v: o.up }], v => v)}
    <p class="section-label" style="margin:18px 0 6px">MOST REQUESTED</p>${o.tc.slice(0, 3).map(x => `<span class="tag">${x.l} · ${x.v}</span>`).join("") || '<small class="sub">No bookings in range</small>'}</div>`).join("")}</div>
    <div class="tbl" style="margin-top:22px"><table><thead><tr><th>DOCTOR</th><th>APPOINTMENTS</th><th>COMPLETED</th><th>UPCOMING</th><th>COMPLETION RATE</th></tr></thead><tbody>${D.map(o => `<tr><td><b>${o.d.name}</b></td><td>${o.n}</td><td>${o.done}</td><td>${o.up}</td><td>${pct(o.done, o.n)}%</td></tr>`).join("")}</tbody></table></div>`,
      csv: D.map(o => ["Doctor", o.d.name, `appointments ${o.n}; completed ${o.done}; upcoming ${o.up}`]) };
  },
  patients(L, f, t) {
    const active = new Set(L.map(a => a.patient)), nw = PATIENTS.filter(p => p.joined >= f && p.joined <= t), ret = [...active].filter(n => PATIENTS.find(p => p.name === n && p.joined < f));
    const vis = PATIENTS.map(p => patAppts(p.name).filter(a => a.status === "Completed").length), B = [["0–3", 0, 3], ["4–6", 4, 6], ["7–9", 7, 9], ["10+", 10, 999]].map(([l, a, b]) => ({ l, v: vis.filter(v => v >= a && v <= b).length }));
    const recent = S.appts.filter(a => a.status === "Completed").sort((a, b) => byDate(b, a)).slice(0, 6);
    return { html: `<div class="grid g4">${sc("Total patients", PATIENTS.length, "Registered in the clinic", "c1")}${sc("New patients", nw.length, "Joined in this range", "c2")}${sc("Returning patients", ret.length, "Visited again in range", "c3")}${sc("Active patients", active.size, "Had an appointment in range", "c4")}</div>
    <div class="grid g2" style="margin-top:22px"><div class="card"><h2>Patients by visit frequency</h2><p class="sub">Completed visits per patient (all time)</p>${chart(B.map(b => b.l + " visits"), B.map(b => b.v), v => v + " patients")}</div>
    <div class="card"><h2>Recent patient activity</h2><p class="sub">Latest completed visits</p><div class="list">${recent.map(a => `<div class="row"><i class="av">${initials(a.patient)}</i><div class="grow"><b>${a.patient}</b><small>${TREATMENTS[a.tr].name}</small></div><small>${fdate(a.date)}</small></div>`).join("")}</div></div></div>`,
      csv: [["Summary", "Total patients", PATIENTS.length], ["Summary", "New patients", nw.length], ["Summary", "Returning patients", ret.length], ...B.map(b => ["Visit frequency", b.l, b.v]), ...recent.map(a => ["Recent visit", a.patient, TREATMENTS[a.tr].name + " " + a.date])] };
  }
};
function exportCsv() {
  const q = c => `"${String(c).replace(/"/g, '""')}"`, txt = S.csv.map(r => r.map(q).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + txt], { type: "text/csv" }));
  a.download = `jude-${S.rep}-report-${TODAY}.csv`; document.body.appendChild(a); a.click(); a.remove(); toast("Report exported as CSV");
}

/* ---------- Views ---------- */
const AVIEWS = [["upcoming", "Upcoming"], ["today", "Today"], ["Pending", "Pending"], ["Confirmed", "Confirmed"], ["Completed", "Completed"], ["Cancelled", "Cancelled"], ["No-show", "No-show"], ["all", "All appointments"]];
const amatch = (a, v) => v === "all" || (v === "today" ? a.date === TODAY && a.status !== "Cancelled" : v === "upcoming" ? a.date > TODAY && a.status !== "Cancelled" : a.status === v);
const sw = (id, l, d, on) => `<div class="switch"><span>${l}<small>${d}</small></span><input type="checkbox" class="tg" id="${id}" ${on ? "checked" : ""}></div>`;

const VIEWS = {
  overview: { title: "Overview", render() {
    const today = S.appts.filter(a => a.date === TODAY && a.status !== "Cancelled"), mS = TODAY.slice(0, 8) + "01";
    const up = S.appts.filter(isUp).sort(byDate).slice(0, 5);
    const days = [-3, -2, -1, 0, 1, 2, 3].map(o => ({ l: new Date(iso(o) + "T00:00").toLocaleDateString("en-GB", { weekday: "short" }), n: S.appts.filter(a => a.date === iso(o) && a.status !== "Cancelled").length }));
    return `<div class="grid g4">${sc("Total appointments", S.appts.length, "All time in this demo", "c2")}${sc("Today's appointments", today.length, today.filter(a => a.status === "Completed").length + " completed so far", "c3")}${sc("Total patients", PATIENTS.length, PATIENTS.filter(p => p.joined >= iso(-30)).length + " new in 30 days", "c4")}${sc("Revenue this month", money(sum(S.appts.filter(a => a.date >= mS).map(rev))), "Completed visits", "c1")}</div>
    <div class="grid g2" style="margin-top:22px"><div class="card"><h2>Appointments this week</h2><p class="sub">Daily bookings around today (highlighted)</p>${chart(days.map(d => d.l), days.map(d => d.n), v => v, 3)}</div>
    <div class="card"><h2>Upcoming Appointments</h2><p class="sub">Next scheduled visits</p><div class="list">${up.map(a => `<div class="row" data-do="viewAppt" data-arg="${a.id}" style="cursor:pointer"><div class="time">${a.time}</div><div class="grow"><b>${a.patient}</b><small>${TREATMENTS[a.tr].name} · ${DOCTORS[a.doc].name}</small></div><small>${fdate(a.date)}</small></div>`).join("")}</div></div></div>`;
  } },

  appointments: { title: "Appointments", render() {
    const A = S.appts, n = { today: A.filter(a => amatch(a, "today")).length, upcoming: A.filter(a => amatch(a, "upcoming")).length, Pending: A.filter(a => a.status === "Pending").length, Cancelled: A.filter(a => a.status === "Cancelled").length };
    const card = (k, l, ic, sub) => `<div class="card stat click k-${k} ${S.aview === k ? "on" : ""}" data-do="aview" data-arg="${k}"><span class="ic">${ic}</span><p class="section-label">${l}</p><h3>${n[k]}</h3><small>${sub}</small></div>`;
    return `<div class="head"><div><h2>Manage Appointments</h2><p class="sub" style="margin:0">Review, confirm and manage upcoming patient appointments.</p></div><button class="btn" data-do="addAppt">+ New Appointment</button></div>
    <div class="grid g4" style="margin-bottom:24px">${card("today", "TODAY", "◷", "Scheduled today")}${card("upcoming", "UPCOMING", "➜", "After today")}${card("Pending", "PENDING", "⏳", "Awaiting confirmation")}${card("Cancelled", "CANCELLED", "✕", "Cancelled bookings")}</div>
    <div class="toolbar"><input id="q" placeholder="Search patient, doctor or treatment…"><select id="av">${AVIEWS.map(v => `<option value="${v[0]}" ${v[0] === S.aview ? "selected" : ""}>${v[1]}</option>`).join("")}</select><select id="fd"><option value="">All doctors</option>${docOpts().map(d => `<option value="${d[0]}">${d[1]}</option>`).join("")}</select></div>
    <div class="tbl"><table style="min-width:900px"><thead><tr><th>PATIENT</th><th>DOCTOR</th><th>TREATMENT</th><th>DATE</th><th>TIME</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody id="tb"></tbody></table></div><p class="sub" id="cnt" style="margin-top:12px"></p>`;
  }, bind() {
    const draw = () => {
      const q = $("#q").value.toLowerCase(), v = $("#av").value, fd = $("#fd").value; S.aview = v;
      const asc = ["today", "upcoming", "Pending", "Confirmed"].includes(v);
      const rows = S.appts.filter(a => amatch(a, v) && (fd === "" || a.doc == fd) && (a.patient + DOCTORS[a.doc].name + TREATMENTS[a.tr].name).toLowerCase().includes(q)).sort((a, b) => asc ? byDate(a, b) : byDate(b, a));
      $("#tb").innerHTML = rows.map(a => `<tr><td><b>${a.patient}</b></td><td>${DOCTORS[a.doc].name}</td><td>${TREATMENTS[a.tr].name}</td><td>${fdate(a.date)}</td><td>${a.time}</td><td>${badge(a.status)}</td><td class="acts"><button class="lnk" data-do="viewAppt" data-arg="${a.id}">View</button><button class="lnk" data-do="editAppt" data-arg="${a.id}">Edit</button>${a.status === "Pending" ? `<button class="lnk ok" data-do="confirm" data-arg="${a.id}">Confirm</button>` : ""}${["Pending", "Confirmed"].includes(a.status) ? `<button class="lnk bad" data-do="cancel" data-arg="${a.id}">Cancel</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="empty">No appointments match your filters.</td></tr>`;
      $("#cnt").textContent = `Showing ${rows.length} appointment${rows.length === 1 ? "" : "s"}`;
    };
    ["q", "av", "fd"].forEach(id => $("#" + id).addEventListener("input", draw)); draw();
  } },

  patients: { title: "Patients", render() {
    return `<div class="head"><div><h2>Patient Records</h2><p class="sub" style="margin:0">Contact details, visit history and treatment notes.</p></div><button class="btn" data-do="addPat">+ Add Patient</button></div>
    <div class="toolbar"><input id="q" placeholder="Search by name, phone or email…"><select id="gf"><option value="">All genders</option><option>Female</option><option>Male</option></select></div><div class="grid g3" id="pg"></div>`;
  }, bind() {
    const draw = () => {
      const q = $("#q").value.toLowerCase(), g = $("#gf").value;
      $("#pg").innerHTML = PATIENTS.filter(p => (!g || p.gender === g) && (p.name + p.phone + p.email).toLowerCase().includes(q)).map(p => {
        const h = patAppts(p.name), tr = [...new Set(h.filter(a => a.status === "Completed").map(a => TREATMENTS[a.tr].name))].slice(0, 3);
        return `<div class="card pcard stat" data-do="viewPat" data-arg="${esc(p.name)}"><div class="phead"><i class="av">${initials(p.name)}</i><div><h3>${p.name}</h3><small>${age(p.dob)} yrs · ${p.gender}</small></div></div><div class="pmeta"><span>☎ ${p.phone}</span><span>✉ ${p.email || "—"}</span></div><div class="pnum"><div><b>${h.length}</b><small>Appointments</small></div><div><b>${fdate(lastVisit(p))}</b><small>Last visit</small></div></div><div>${tr.map(t => `<span class="tag">${t}</span>`).join("") || '<small class="sub">No treatments yet</small>'}</div></div>`;
      }).join("") || `<p class="empty">No patients found.</p>`;
    };
    ["q", "gf"].forEach(id => $("#" + id).addEventListener("input", draw)); draw();
  } },

  treatments: { title: "Treatments", render: () => `<div class="head"><div><h2>Treatment Catalog</h2><p class="sub" style="margin:0">Prices, durations and the specialist for each service.</p></div><button class="btn" data-do="addTr">+ Add Treatment</button></div>
    <div class="grid g3">${TREATMENTS.map((t, i) => `<div class="card tcard stat"><div style="display:flex;justify-content:space-between;align-items:flex-start"><p class="section-label">⏱ ${t.mins} MIN</p><button class="btn ghost sm" data-do="editTr" data-arg="${i}">Edit</button></div><h2 style="margin-top:8px">${t.name}</h2><div class="price">${money(t.price)}</div><p class="spec">Specialist: ${DOCTORS[t.doc].name}</p></div>`).join("")}</div>` },

  doctors: { title: "Doctors", render() {
    return `<div class="head"><div><h2>Clinic Doctors</h2><p class="sub" style="margin:0">Profiles, weekly availability and upcoming schedules.</p></div><button class="btn" data-do="addDoc">+ Add Doctor</button></div>
    <div class="list-cards">${DOCTORS.map((d, i) => {
      const mine = S.appts.filter(a => a.doc === i), up = mine.filter(isUp).sort(byDate).slice(0, 3), specs = TREATMENTS.filter(t => t.doc === i);
      return `<div class="card dcard"><div class="dprof"><i class="av lg">${initials(d.name)}</i><div><h3>${d.name}</h3><p class="role">${d.role}</p><p class="sub" style="margin:8px 0">${esc(d.bio) || ""}</p><small>☎ ${d.phone || "—"}<br>✉ ${d.email || "—"}</small></div></div>
      <div class="davail"><p class="section-label">WEEKLY AVAILABILITY</p><div class="week">${DAYS.map(x => `<span class="dy ${d.days.toLowerCase().includes(x.slice(0, 3).toLowerCase()) ? "on" : ""}">${x.slice(0, 3)}</span>`).join("")}</div><small>🕒 ${d.hours}</small>
      <p class="section-label" style="margin-top:16px">SPECIALIZES IN</p>${specs.map(t => `<span class="tag">${t.name}</span>`).join("") || '<small class="sub">No treatments assigned yet</small>'}<div class="pnum"><div><b>${mine.filter(a => a.status === "Completed").length}</b><small>Completed</small></div><div><b>${mine.filter(isUp).length}</b><small>Upcoming</small></div></div></div>
      <div><p class="section-label">NEXT APPOINTMENTS</p>${up.map(a => `<div class="row" data-do="viewAppt" data-arg="${a.id}" style="cursor:pointer;padding:10px 0"><div class="time">${a.time}</div><div class="grow"><b style="font-size:14px">${a.patient}</b><small>${TREATMENTS[a.tr].name}</small></div><small>${fdate(a.date)}</small></div>`).join("") || '<p class="sub">No upcoming appointments.</p>'}</div></div>`;
    }).join("")}</div>`;
  } },

  messages: { title: "Messages", render() {
    const m = S.msgs.find(x => x.id === S.sel);
    return `<div class="inbox"><div class="msgs">${S.msgs.map(x => `<div class="msg ${x.unread ? "unread" : ""} ${x.id === S.sel ? "sel" : ""}" data-msg="${x.id}"><small>${x.when}</small><b>${x.from}</b><p>${x.subject}</p></div>`).join("")}</div>
    <div class="reader">${m ? `<p class="section-label">${m.unread ? "UNREAD" : "READ"}</p><h2>${m.subject}</h2><small style="color:var(--muted)">From ${m.from} · ${m.when}</small><div class="body">${m.body}</div><button class="btn sm" data-do="msgToggle" data-arg="${m.id}">${m.unread ? "Mark as read" : "Mark as unread"}</button> <button class="btn ghost sm" data-do="reply">Reply</button>` : `<div class="empty">Select a message to read it.</div>`}</div></div>`;
  } },

  reports: { title: "Reports", render() {
    const [f, t] = rng(), L = S.appts.filter(a => a.date >= f && a.date <= t), r = REP[S.rep](L, f, t);
    S.csv = [["Report", REPS[S.rep], "Range " + f + " to " + t], ...r.csv];
    return `<div class="head"><div><h2>Reports & Analytics</h2><p class="sub" style="margin:0">Showing ${REPS[S.rep].toLowerCase()} data for ${f === t ? fdate(f) : fdate(f) + " – " + fdate(t)}.</p></div><button class="btn" data-do="export">⤓ Export Report</button></div>
    <div class="toolbar"><div class="seg">${[["today", "Today"], ["week", "This Week"], ["month", "This Month"], ["custom", "Custom Range"]].map(o => `<button data-do="range" data-arg="${o[0]}" class="${S.range === o[0] ? "on" : ""}">${o[1]}</button>`).join("")}</div>${S.range === "custom" ? `<input type="date" id="rf" value="${S.from}" style="flex:none;min-width:0"><input type="date" id="rt" value="${S.to}" style="flex:none;min-width:0">` : ""}</div>
    <div class="tabs">${Object.keys(REPS).map(k => `<button data-do="rep" data-arg="${k}" class="${S.rep === k ? "on" : ""}">${REPS[k]}</button>`).join("")}</div><div class="rep">${r.html}</div>`;
  }, bind() { ["rf", "rt"].forEach(id => { const e = $("#" + id); if (e) e.onchange = () => { S[id === "rf" ? "from" : "to"] = e.value; go(); }; }); } },

  settings: { title: "Settings", render() {
    const s = S.settings, f = (id, l, type, full) => `<div class="field ${full ? "full" : ""}"><label>${l}</label><input id="s_${id}" type="${type || "text"}" value="${esc(s[id])}"></div>`;
    const sel = (id, l, opts) => `<div class="field"><label>${l}</label><select id="s_${id}">${opts.map(o => `<option value="${o[0]}" ${o[0] == s[id] ? "selected" : ""}>${o[1]}</option>`).join("")}</select></div>`;
    return `<div class="head"><div><h2>Settings</h2><p class="sub" style="margin:0">Manage your clinic information, appointments and system preferences.</p></div><div style="display:flex;gap:10px"><button class="btn ghost" data-do="resetChanges">Reset Changes</button><button class="btn" data-do="save">Save Changes</button></div></div>
    <div class="grid g2s"><div class="stackcol">
      <div class="card"><h2>Clinic Information</h2><p class="sub">Basic information displayed across the clinic website.</p><div class="fgrid">${f("clinic", "Clinic Name")}${f("phone", "Phone Number")}${f("email", "Email Address", "email")}${f("location", "Location")}<div class="field full"><label>Clinic Description</label><textarea id="s_desc" rows="3">${esc(s.desc)}</textarea></div></div></div>
      <div class="card"><h2>Working Hours</h2><p class="sub">Manage the clinic's weekly availability.</p>${DAYS.map(d => { const h = s.hours[d]; return `<div class="hrow"><b>${d}</b><label class="lab"><input type="checkbox" class="tg hon" id="h_${d}_on" ${h.on ? "checked" : ""}><span>${h.on ? "Open" : "Closed"}</span></label><input type="time" id="h_${d}_f" value="${h.from}" ${h.on ? "" : "disabled"}><input type="time" id="h_${d}_t" value="${h.to}" ${h.on ? "" : "disabled"}></div>`; }).join("")}</div>
      <div class="card"><h2>Admin Profile</h2><p class="sub">Your account details.</p><div class="fgrid">${f("admin", "Full Name")}${f("role", "Role")}${f("aemail", "Email", "email")}${f("aphone", "Phone")}</div></div></div>
    <div class="stackcol">
      <div class="card"><h2>Appointment Settings</h2><p class="sub">Control how bookings are handled.</p>${sw("s_approval", "Appointment Approval", "Require admin approval before confirming new appointments.", s.approval)}${sw("s_online", "Allow Online Booking", "Allow patients to request appointments through the website.", s.online)}${sw("s_cancelReq", "Cancellation Requests", "Allow patients to request cancellation of upcoming appointments.", s.cancelReq)}<div class="fgrid" style="margin-top:18px">${sel("duration", "Default Appointment Duration", [[30, "30 minutes"], [45, "45 minutes"], [60, "60 minutes"], [90, "90 minutes"]])}${sel("buffer", "Booking Buffer", [[0, "No buffer"], [10, "10 minutes"], [15, "15 minutes"], [30, "30 minutes"]])}</div></div>
      <div class="card"><h2>Notifications</h2><p class="sub">Choose what you get alerted about.</p>${sw("s_nNew", "New Appointment", "Get notified when a new booking request is received.", s.nNew)}${sw("s_nRemind", "Appointment Reminder", "Send reminders before scheduled appointments.", s.nRemind)}${sw("s_nMsg", "New Message", "Notify the admin when a patient sends a message.", s.nMsg)}</div>
      <div class="card"><h2>Interface Preferences</h2><p class="sub">Adjust how the dashboard looks.</p>${sel("currency", "Currency", [["₪", "₪ Shekel"], ["$", "$ US Dollar"]])}${sw("s_compact", "Compact tables", "Tighter row spacing.", s.compact)}${sw("s_calm", "Reduce animations", "Turn off motion effects.", s.calm)}</div>
      <div class="card"><h2>Security</h2><p class="sub">Keep your account safe.</p><div class="switch"><span>Password<small>Last changed more than 30 days ago.</small></span><button class="btn ghost sm" data-do="pw">Change Password</button></div></div>
    </div></div>
    <div class="savebar"><button class="btn ghost" data-do="resetChanges">Reset Changes</button><button class="btn" data-do="save">Save Changes</button></div>`;
  } }
};

/* ---------- Actions ---------- */
function saveSettings() {
  const s = S.settings, v = id => $("#s_" + id);
  ["clinic", "phone", "email", "location", "desc", "admin", "role", "aemail", "aphone", "duration", "buffer", "currency"].forEach(k => s[k] = v(k).value.trim());
  ["approval", "online", "cancelReq", "nNew", "nRemind", "nMsg", "compact", "calm"].forEach(k => s[k] = v(k).checked);
  DAYS.forEach(d => s.hours[d] = { on: $(`#h_${d}_on`).checked, from: $(`#h_${d}_f`).value, to: $(`#h_${d}_t`).value });
  try { localStorage.setItem("jude-admin-v2", JSON.stringify(s)); } catch (e) {}
  applySettings(); toast("Settings saved"); go();
}
const setStatus = (id, st, msg) => { S.appts.find(a => a.id == id).status = st; toast(msg); go(); };
const ACT = {
  addTr: () => trForm(), editTr: i => trForm(+i), addDoc: docForm, addPat: patForm, addAppt: () => apptForm(), editAppt: i => apptForm(+i), bookFor: n => apptForm(null, n),
  viewAppt: i => apptModal(+i), viewPat: patientModal, pw: pwForm, export: exportCsv, save: saveSettings,
  confirm: i => setStatus(i, "Confirmed", "Appointment confirmed"), cancel: i => setStatus(i, "Cancelled", "Appointment cancelled"),
  delAppt: i => { if (confirm("Delete this appointment?")) { S.appts = S.appts.filter(a => a.id != i); closeModal(); toast("Appointment deleted"); go(); } },
  aview: v => { S.aview = v; go(); }, range: r => { S.range = r; go(); }, rep: r => { S.rep = r; go(); },
  msgToggle: i => { const m = S.msgs.find(x => x.id == i); m.unread = !m.unread; toast(m.unread ? "Marked as unread" : "Marked as read"); go(); },
  reply: () => toast("Reply sent (demo)"), resetChanges: () => { go(); toast("Changes reset"); }
};

/* ---------- Router & chrome ---------- */
const unread = () => S.msgs.filter(m => m.unread).length;
function renderNav(cur) {
  $("#nav").innerHTML = Object.keys(VIEWS).map(k => `<a href="#${k}" class="${k === cur ? "active" : ""}"><i>${ICONS[k]}</i>${VIEWS[k].title}${k === "messages" && unread() ? `<span class="count">${unread()}</span>` : ""}</a>`).join("");
}
function go() {
  const key = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "overview", v = VIEWS[key], y = window.scrollY;
  $("#view").innerHTML = v.render(); $("#pageTitle").textContent = v.title; document.title = `${v.title} | ${S.settings.clinic}`;
  renderNav(key); v.bind && v.bind(); closeNav(); window.scrollTo(0, y);
}
function applySettings() {
  document.body.classList.toggle("compact", S.settings.compact); document.body.classList.toggle("calm", S.settings.calm);
  $("#meName").textContent = S.settings.admin; $("#meAv").textContent = initials(S.settings.admin);
}
const closeNav = () => { $("#sidebar").classList.remove("open"); $("#overlay").classList.remove("open"); };
$("#burger").onclick = () => { $("#sidebar").classList.add("open"); $("#overlay").classList.add("open"); };
$("#overlay").onclick = closeNav;

document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.status) { S.appts.find(a => a.id == t.dataset.status).status = t.value; toast("Status updated to " + t.value); closeModal(); go(); }
  if (t.classList.contains("hon")) { t.parentElement.parentElement.querySelectorAll("input[type=time]").forEach(i => i.disabled = !t.checked); t.nextElementSibling.textContent = t.checked ? "Open" : "Closed"; }
});
document.addEventListener("click", e => {
  const el = e.target.closest("[data-do]");
  if (el && !e.target.closest("select")) { e.stopPropagation(); return ACT[el.dataset.do](el.dataset.arg); }
  const m = e.target.closest("[data-msg]"); if (m) { S.sel = +m.dataset.msg; go(); }
});

/* ---------- Init ---------- */
["siteLink", "siteLinkSide"].forEach(id => { const a = $("#" + id); a.href = CONFIG.websiteUrl; a.target = "_blank"; a.rel = "noopener noreferrer"; });
$("#todayLabel").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
window.addEventListener("hashchange", go);
applySettings(); go();
