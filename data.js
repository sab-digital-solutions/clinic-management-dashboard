/* ===== CONFIG ===== */
const CONFIG = { websiteUrl: "https://deeppink-moose-390461.hostingersite.com/" };

const iso = off => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/* ===== SAMPLE DATA (prices in ILS ₪) ===== */
const DOCTORS = [
  { name: "Dr. Sarah Khalil", role: "Aesthetic Specialist", phone: "0599 101 201", email: "sarah.khalil@judeclinic.com", days: "Sun, Tue, Thu", hours: "10:00 – 18:00", bio: "Injectables and facial harmony with a natural, refined approach." },
  { name: "Dr. Lina Ahmad", role: "Dermatology Specialist", phone: "0568 202 302", email: "lina.ahmad@judeclinic.com", days: "Sat, Mon, Wed, Thu", hours: "09:00 – 17:00", bio: "Skin health, hydration and medical-grade facial care." },
  { name: "Dr. Maya Hassan", role: "Aesthetic Medicine", phone: "0597 303 403", email: "maya.hassan@judeclinic.com", days: "Sun, Mon, Wed", hours: "11:00 – 19:00", bio: "Advanced rejuvenation and facial contouring." }
];

// doc = index of the specialist in DOCTORS
const TREATMENTS = [
  { name: "Botox", price: 900, mins: 30, doc: 0 },
  { name: "Dermal Fillers", price: 1400, mins: 45, doc: 0 },
  { name: "Skin Boosters", price: 800, mins: 40, doc: 1 },
  { name: "Facial Treatments", price: 350, mins: 60, doc: 1 },
  { name: "Skin Rejuvenation", price: 650, mins: 50, doc: 2 },
  { name: "Facial Contouring", price: 1800, mins: 75, doc: 2 }
];

const PATIENTS = [
  { name: "Rana Odeh", phone: "0599 214 385", email: "rana.odeh@mail.com", dob: "1992-04-12", gender: "Female", joined: iso(-400), notes: "Prefers morning appointments." },
  { name: "Dana Nasser", phone: "0568 771 902", email: "dana.nasser@mail.com", dob: "1997-08-03", gender: "Female", joined: iso(-330), notes: "Sensitive skin." },
  { name: "Yasmin Barghouti", phone: "0597 330 148", email: "yasmin.b@mail.com", dob: "1985-01-22", gender: "Female", joined: iso(-520), notes: "Regular Botox client." },
  { name: "Lama Qassem", phone: "0592 645 210", email: "lama.q@mail.com", dob: "2000-11-30", gender: "Female", joined: iso(-150), notes: "Interested in lip fillers." },
  { name: "Hiba Salah", phone: "0569 118 764", email: "hiba.salah@mail.com", dob: "1989-06-17", gender: "Female", joined: iso(-260), notes: "" },
  { name: "Noor Daraghmeh", phone: "0598 402 557", email: "noor.d@mail.com", dob: "1994-02-09", gender: "Female", joined: iso(-90), notes: "Allergic to latex." },
  { name: "Shatha Jaber", phone: "0595 883 026", email: "shatha.j@mail.com", dob: "1981-09-25", gender: "Female", joined: iso(-600), notes: "VIP client." },
  { name: "Reem Tamimi", phone: "0567 250 419", email: "reem.t@mail.com", dob: "1995-12-05", gender: "Female", joined: iso(-12), notes: "" },
  { name: "Aya Kanaan", phone: "0594 731 862", email: "aya.k@mail.com", dob: "1998-03-14", gender: "Female", joined: iso(-20), notes: "Prefers WhatsApp contact." },
  { name: "Omar Sabbagh", phone: "0599 660 771", email: "omar.s@mail.com", dob: "1990-07-21", gender: "Male", joined: iso(-8), notes: "Interested in Skin Boosters." }
];

// [patient, treatmentIndex, dayOffset, time, status] – the doctor is always the treatment's specialist
const APPTS_RAW = [
  ["Rana Odeh", 0, -12, "10:30", "Completed"], ["Yasmin Barghouti", 0, -9, "11:00", "Completed"],
  ["Shatha Jaber", 5, -8, "13:00", "Completed"], ["Dana Nasser", 3, -6, "09:30", "Completed"],
  ["Hiba Salah", 4, -5, "12:00", "Completed"], ["Noor Daraghmeh", 1, -4, "15:30", "Cancelled"],
  ["Reem Tamimi", 2, -3, "14:00", "Completed"], ["Lama Qassem", 3, -2, "10:00", "Completed"],
  ["Aya Kanaan", 2, -1, "16:00", "Completed"], ["Omar Sabbagh", 2, -1, "11:30", "No-show"],
  ["Maram", 1, 0, "10:00", "Completed"], ["Yasmin Barghouti", 4, 0, "11:30", "Completed"],
  ["Rana Odeh", 5, 0, "14:00", "Pending"], ["Shatha Jaber", 0, 0, "16:30", "Confirmed"],
  ["Dana Nasser", 2, 1, "09:30", "Confirmed"], ["Lama Qassem", 1, 1, "13:30", "Pending"],
  ["Hiba Salah", 3, 2, "12:00", "Confirmed"], ["Noor Daraghmeh", 4, 3, "15:00", "Pending"],
  ["Reem Tamimi", 0, 4, "11:00", "Confirmed"], ["Aya Kanaan", 1, 5, "10:30", "Pending"],
  ["Omar Sabbagh", 2, 6, "17:00", "Confirmed"]
].map(a => a[0] === "Maram" ? ["Lama Qassem", ...a.slice(1)] : a);

// Deterministic booking history for the previous 60 days (skips Fridays – clinic closed)
(() => {
  let s = 11; const R = () => (s = s * 16807 % 2147483647) / 2147483647;
  const W = [26, 22, 17, 14, 12, 9], T = ["09:30", "10:00", "11:00", "12:00", "13:30", "15:00", "16:30"];
  for (let d = -60; d <= -13; d++) {
    const dt = new Date(); dt.setDate(dt.getDate() + d); if (dt.getDay() === 5) continue;
    const n = 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      let r = R() * 100, tr = 0; while (r > W[tr]) { r -= W[tr]; tr++; }
      const p = PATIENTS.slice(0, 7)[Math.floor(R() * 7)], x = R();
      APPTS_RAW.push([p.name, tr, d, T[Math.floor(R() * T.length)], x < .85 ? "Completed" : x < .93 ? "Cancelled" : "No-show"]);
    }
  }
})();

const MESSAGES_RAW = [
  { from: "Lama Qassem", subject: "Question about Dermal Fillers", when: "10 min ago", unread: true, body: "Hello, I'm interested in lip fillers and would like to know how long the results last and whether there is any downtime. Thank you!" },
  { from: "Sara Awad", subject: "Consultation availability", when: "1 hour ago", unread: true, body: "Hi, do you have any free consultation slots this Thursday afternoon? I'm considering skin rejuvenation." },
  { from: "Yasmin Barghouti", subject: "Reschedule my appointment", when: "Yesterday", unread: true, body: "Good morning, I need to move my next appointment by one day. Is that possible?" },
  { from: "Dana Nasser", subject: "Thank you", when: "Yesterday", unread: false, body: "I just wanted to thank Dr. Lina and the team. My skin feels wonderful after the facial!" },
  { from: "Rima Saleh", subject: "Pricing for Skin Boosters", when: "2 days ago", unread: false, body: "Could you please send me the price and number of sessions recommended for skin boosters?" },
  { from: "Aya Kanaan", subject: "Aftercare instructions", when: "3 days ago", unread: false, body: "Can you remind me what I should avoid in the 24 hours after my skin booster session?" }
];

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DEFAULT_SETTINGS = {
  clinic: "JUDE Beauty Clinic", phone: "+970 9 234 5678", email: "info@judebeautyclinic.com", location: "Nablus, Palestine",
  desc: "JUDE Beauty Clinic provides professional aesthetic and skincare treatments in a calm and welcoming environment.",
  hours: Object.fromEntries(DAYS.map(d => [d, { on: d !== "Friday", from: "09:00", to: d === "Saturday" ? "15:00" : "19:00" }])),
  approval: true, online: true, cancelReq: true, duration: "45", buffer: "10",
  nNew: true, nRemind: true, nMsg: true,
  admin: "Nour Haddad", role: "Clinic Manager", aemail: "nour@judebeautyclinic.com", aphone: "0599 555 010",
  currency: "₪", compact: false, calm: false
};
