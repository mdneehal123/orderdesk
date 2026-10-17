/* Order Desk — multi-brand WhatsApp order manager with 4x6 thermal labels.
   Data lives in this browser (localStorage) and, once connected, in your Google Sheet. */
(function () {
"use strict";

/* ------------------------------------------------------------------ defaults */
const RETURN = { name: "Beauty Mart", line1: "Azad Nagar 4th Cross", line2: "", city: "Bhatkal", state: "Karnataka", pin: "581320", phone: "9980881230" };
const DEFAULT_BRANDS = [
  { id: "gx", name: "Glutanex", prefix: "GX", color: "#1D4E89", tagline: "Glutathione night cream", site: "", upi: "", gstin: "", from: { ...RETURN },
    products: [
      { id: "gx1", name: "GlutaNex Glutathione Night Cream 30g", price: 2499, weight: 0 } ] },
  { id: "fn", name: "Fair N Pink", prefix: "FP", color: "#DB2777", tagline: "", site: "", upi: "", gstin: "", from: { ...RETURN },
    products: [
      { id: "fn1", name: "Fair N Pink Moisturising Night Cream 30g", price: 1999, weight: 0 },
      { id: "fn2", name: "Fair N Pink Advanced Cream 10g", price: 999, weight: 0 } ] },
  { id: "yf", name: "Youth Face", prefix: "YF", color: "#C2410C", tagline: "Beauty cream", site: "youthfacebeauty.com", upi: "", gstin: "",
    from: { ...RETURN },
    products: [
      { id: "yf1", name: "Youth Face Beauty Cream 25g", price: 549, weight: 0 },
      { id: "yf2", name: "Beauty Cream Pack of 2", price: 999, weight: 0 },
      { id: "yf3", name: "Beauty Cream Pack of 3", price: 1444, weight: 0 },
      { id: "yf4", name: "Youth Face Body Lotion 40ml", price: 599, weight: 0 } ] },
  { id: "mg", name: "Mirc Glow", prefix: "MG", color: "#9C5468", tagline: "Korean-inspired skincare", site: "mircglow.com", upi: "", gstin: "",
    from: { ...RETURN },
    products: [
      { id: "mg1", name: "Avocado Korean Night Cream 25g", price: 649, weight: 0 },
      { id: "mg2", name: "Glutathione Cream 30g", price: 1499, weight: 0 },
      { id: "mg3", name: "Avocado Night Cream 30g", price: 649, weight: 0 },
      { id: "mg4", name: "Avocado Glow Cream 10g", price: 349, weight: 0 },
      { id: "mg5", name: "Day & Night Combo", price: 849, weight: 0 },
      { id: "mg6", name: "Night Cream Combo", price: 1799, weight: 0 },
      { id: "mg7", name: "Korean Glass Skin Kit", price: 1999, weight: 0 } ] },
];
// Brand order wanted on screens and on the customer form
const BRAND_ORDER = ["gx", "fn", "yf", "mg"];
const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry"];
const STATUS = [["new","New"],["paid","Paid"],["packed","Packed"],["shipped","Dispatched"],["transit","In transit"],["ofd","Out for delivery"],["cancelled","Cancelled"]];
const ONROAD = ["shipped", "transit", "ofd"];
const TOSHIP = ["new", "paid", "packed"];
const stName = k => (STATUS.find(s => s[0] === k) || [k, k])[1];
const SERVICES = ["", "Express", "Surface", "Priority", "Air"];
const COURIERS = ["DTDC", "Shree Maruti", "Delhivery"];
/* Courier tracking pages. {awb} is replaced with the tracking number. DTDC and Shree Maruti
   don't take the number in the link, so the customer types it on their page. Editable in Settings. */
const TRACK_PAGES = { "DTDC": "https://www.dtdc.com/track-your-shipment/", "Shree Maruti": "https://shreemaruti.com/track-shipment/", "Delhivery": "https://www.delhivery.com/track/package/{awb}" };
function trackPage(c) { return ((settings.trackPages || {})[c] || TRACK_PAGES[c] || ""); }
function trackLink(o) { if (o.trackUrl) return o.trackUrl; const t = trackPage(o.courier); return t && o.awb ? t.replace("{awb}", encodeURIComponent(o.awb)) : ""; }
function trackHasAwb(o) { return !!o.trackUrl || trackPage(o.courier).includes("{awb}"); }

/* ------------------------------------------------------------------ store */
const K = { orders: "od1.orders", settings: "od1.settings", device: "od1.device", inbox: "od1.inbox" };
function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function persist(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast("This browser's storage is full. Export a CSV and connect Google Sheet."); return false; } }

let settings = load(K.settings, null) || { brands: DEFAULT_BRANDS, courier: "", service: "", signoff: "With love, Team skinday.in 💛", refillDays: 30, nextNote: "", updatedAt: "" };
if (!settings.signoff) settings.signoff = "With love, Team skinday.in 💛";
(function migrateBrands() { // fill Glutanex / Fair N Pink if they were still empty, and put brands in the wanted order
  let changed = false;
  DEFAULT_BRANDS.forEach(d => { const b = settings.brands.find(x => x.id === d.id);
    if (!b) { settings.brands.push(JSON.parse(JSON.stringify(d))); changed = true; return; }
    if (d.id === "fn" && /^farines+s?$/i.test(b.name)) { b.name = d.name; b.prefix = d.prefix; b.color = d.color; changed = true; }
    if (!(b.products || []).length && d.products.length) { b.products = JSON.parse(JSON.stringify(d.products)); changed = true; } });
  const before = settings.brands.map(b => b.id).join();
  settings.brands.sort((a, b) => { const ia = BRAND_ORDER.indexOf(a.id), ib = BRAND_ORDER.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  if (changed || before !== settings.brands.map(b => b.id).join()) { settings.updatedAt = new Date().toISOString(); try { localStorage.setItem("od1.settings", JSON.stringify(settings)); } catch (e) {} }
})();
settings.brands.forEach(b => { b.products = b.products || []; b.from = b.from || { ...RETURN }; });
let device = load(K.device, { sheetUrl: "", sheetKey: "", pinHash: "", brand: "all", dirty: [] });
let orders = load(K.orders, {}); // id -> order
// Delivered and RTO are no longer used: older orders with those statuses count as dispatched / cancelled.
const OLDSTATUS = s => s === "delivered" ? "ofd" : s === "returned" ? "cancelled" : s;
Object.values(orders).forEach(o => { if (o && OLDSTATUS(o.status) !== o.status) o.status = OLDSTATUS(o.status); });
let inbox = load(K.inbox, []); // address-form submissions waiting to become orders
const ui = { filter: "open", q: "", sel: new Set(), open: new Set(), cq: "", month: new Date().toISOString().slice(0, 7), qty: {}, pay: null, editing: null, formBrand: null };

const saveOrders = () => persist(K.orders, orders);
const saveSettings = () => persist(K.settings, settings);
const saveDevice = () => persist(K.device, device);
const live = () => Object.values(orders).filter(o => !o.deleted);
const brandById = id => settings.brands.find(b => b.id === id) || settings.brands[0];
const inBrand = o => device.brand === "all" || o.brand === device.brand;

/* ------------------------------------------------------------------ helpers */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = n => "₹" + Math.round(n || 0).toLocaleString("en-IN");
const rs = n => "Rs " + Math.round(n || 0).toLocaleString("en-IN");
const today = () => localISO(new Date());
function localISO(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
const phone10 = p => { const d = String(p || "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; };
const fmtPhone = p => { const d = phone10(p); return d.length === 10 ? d.slice(0, 5) + " " + d.slice(5) : d; };
const dmy = iso => iso ? iso.slice(8, 10) + "-" + iso.slice(5, 7) + "-" + iso.slice(2, 4) : "";
const waLink = (p, t) => "https://wa.me/91" + phone10(p) + "?text=" + encodeURIComponent(t);
const uid = () => Math.random().toString(36).slice(2, 8);
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2800); }
function itemsText(o) { return (o.items || []).map(i => `${i.qty} x ${i.name}`).join(", "); }
function pcs(o) { return (o.items || []).reduce((a, i) => a + i.qty, 0); }
function weightKg(o) { const g = Number(o.weight) || (o.items || []).reduce((a, i) => a + (Number(i.weight) || 0) * i.qty, 0); return g ? (g / 1000).toFixed(g < 1000 ? 2 : 1) + " kg" : "—"; }
function nextId(brand) {
  const b = brandById(brand); const d = today().replace(/-/g, "").slice(2);
  const base = (b.prefix || "OD").toUpperCase() + d;
  let n = 1; Object.keys(orders).forEach(id => { if (id.startsWith(base)) { const k = parseInt(id.slice(base.length), 10); if (k >= n) n = k + 1; } });
  return base + String(n).padStart(3, "0") + (device.suffix || "");
}
async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }

/* ------------------------------------------------------------------ online sync (your site's /api/sync, or a Google Sheet) */
const online = () => !!device.sheetUrl && /\/api\/sync$/.test(device.sheetUrl);
let syncing = false;
// "this customer was already told" never goes backwards: if either copy of an order knows it, both do (an old copy on another phone must not make you send it again)
const TOLD = [["trackingSentAt", "trackingVia", "trackingMsgId", "trackingSentSig"], ["readySentAt", "readyVia", "readyMsgId", "readySkip"]];
function keepTold(a, b) { // copies the "told" marks from b into a when a does not have them; true if a changed
  let fixed = false;
  if (!a || !b) return false;
  TOLD.forEach(keys => { if (!a[keys[0]] && b[keys[0]]) { keys.forEach(k => { if (b[k] !== undefined) a[k] = b[k]; }); fixed = true; } });
  if (fixed) { if (a.trackingSentAt) a.trackingTry = ""; if (a.readySentAt) a.readyTry = ""; }
  return fixed;
}
function syncState(s, t) { $("#syncdot").className = "sd " + (s || ""); $("#synctxt").textContent = t; }
function markDirty(id) { if (!device.dirty.includes(id)) device.dirty.push(id); saveDevice(); }
async function syncNow(quiet) {
  if (!device.sheetUrl || !device.sheetKey) { syncState("", "Local only"); if (!quiet) location.hash = "#settings"; return; }
  if (syncing) return; syncing = true; syncState("busy", "Syncing…");
  try {
    const r = await fetch(device.sheetUrl + (device.sheetUrl.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(device.sheetKey));
    const j = await r.json();
    if (!j.ok) { if (j.error === "wrong key") { if (device.auto) { device.sheetUrl = ""; device.sheetKey = ""; device.auto = false; device.noAuto = true; saveDevice(); syncState("", "Local only"); syncing = false; return; } syncState("err", "Wrong password"); if (!quiet) toast("Wrong password. Check ORDER_DESK_PASSWORD in Vercel."); syncing = false; return; } throw new Error(j.error || "refused"); }
    let changed = false;
    (j.orders || []).forEach(o => { if (o) o.status = OLDSTATUS(o.status); const mine = orders[o.id];
      if (!mine || (o.updatedAt || "") > (mine.updatedAt || "")) { const fix = mine && keepTold(o, mine); orders[o.id] = o; changed = true; device.dirty = device.dirty.filter(x => x !== o.id); if (fix) markDirty(o.id); }
      else if (keepTold(mine, o)) { changed = true; markDirty(mine.id); } });
    if (j.settings && (j.settings.updatedAt || "") > (settings.updatedAt || "")) { settings = j.settings; saveSettings(); changed = true; }
    if (Array.isArray(j.inbox)) { const before = inbox.map(x => x.id).join(); inbox = j.inbox.sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")); persist(K.inbox, inbox); if (inbox.map(x => x.id).join() !== before) { changed = true; if (settings.autoForm === false && inbox.length > before.split(",").filter(Boolean).length) toast("📬 New address from the customer form"); } }
    if (settings.autoForm !== false && inbox.length) { const n = await autoImport(); if (n) changed = true; }
    // push what the sheet doesn't have or has older
    const remote = Object.fromEntries((j.orders || []).map(o => [o.id, o.updatedAt || ""]));
    const push = Object.values(orders).filter(o => !(o.id in remote) || (o.updatedAt || "") > remote[o.id] || device.dirty.includes(o.id));
    for (let i = 0; i < push.length; i += 40) await post({ orders: push.slice(i, i + 40) });
    if (!j.settings || (settings.updatedAt || "") > (j.settings.updatedAt || "")) await post({ settings });
    device.dirty = []; device.lastSync = new Date().toISOString(); saveDevice();
    if (changed) { saveOrders(); render(); }
    syncState("ok", "Synced " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    if (!quiet) toast("Synced ✓ Orders are saved online.");
  } catch (e) {
    syncState("err", "Sync failed"); if (!quiet) toast((e && e.message && e.message.length < 160 ? e.message + " " : "Couldn't reach online storage. ") + "Orders are safe on this device; tap Sync to retry.");
  } finally { syncing = false; }
}
async function post(body) {
  const r = await fetch(device.sheetUrl, { method: "POST", body: JSON.stringify({ key: device.sheetKey, ...body }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || "save failed");
}
let pushTimer = null;
function queuePush(id) {
  markDirty(id);
  if (!device.sheetUrl) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const ids = [...device.dirty]; if (!ids.length) return;
    syncState("busy", "Saving…");
    try { await post({ orders: ids.map(i => orders[i]).filter(Boolean) }); device.dirty = device.dirty.filter(x => !ids.includes(x)); saveDevice(); syncState("ok", "Saved online"); }
    catch (e) { syncState("err", "Not saved online"); }
  }, 900);
}

/* ------------------------------------------------------------------ order writes */
function putOrder(o) { o.updatedAt = new Date().toISOString(); orders[o.id] = o; saveOrders(); queuePush(o.id); }
function patch(id, p) { const o = orders[id]; if (!o) return; Object.assign(o, p); if (p.status) o.history = [...(o.history || []), { s: p.status, at: new Date().toISOString() }]; putOrder(o); }

/* ------------------------------------------------------------------ WhatsApp parser */
function parseMsg(t, brand) {
  const out = {}; const lines = t.split(/\r?\n/).map(s => s.trim());
  const ph = t.match(/(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})\b/); if (ph) out.phone = ph[1].replace(/\D/g, "");
  const nm = t.match(/(?:^|\n)\s*(?:customer\s*)?name\s*[:\-]\s*(.+)/i); if (nm) out.name = nm[1].trim();
  const am = t.match(/address[^:\n]*[:\-]\s*([\s\S]*?)(?:\n\s*(?:payment|pay|phone|mobile|contact|name|landmark)\b|$)/i);
  if (am && am[1].trim()) out.address = am[1].trim();
  const lm = t.match(/landmark\s*[:\-]\s*(.+)/i); if (lm) out.landmark = lm[1].trim();
  const pin = (out.address || t).match(/\b([1-9]\d{2}\s?\d{3})\b/); if (pin) out.pin = pin[1].replace(/\s/, "");
  const st = STATES.find(s => (out.address || t).toLowerCase().includes(s.toLowerCase())); if (st) out.state = st;
  if (out.address) {
    let a = out.address.replace(/\b[1-9]\d{2}\s?\d{3}\b/, "");
    if (st) a = a.replace(new RegExp(st, "i"), "");
    a = a.replace(/\b(pin(code)?|india)\b[:\s-]*/ig, "").replace(/,\s*,/g, ",").replace(/[,\s\-]+$/g, "").trim();
    const parts = a.split(/,|\n/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) { out.city = parts[parts.length - 1]; out.address = parts.slice(0, -1).join(", "); } else out.address = a;
  }
  out.pay = "upi"; // prepaid only
  const utr = t.match(/\b(\d{12})\b/); if (utr) out.utr = utr[1];
  if (/glow10/i.test(t)) out.code = "GLOW10";
  // products: match against this brand's product names by significant words
  const b = brandById(brand); const qty = {};
  const words = s => s.toLowerCase().replace(/[^a-z0-9& ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !["the","and","with","for","cream","pack"].includes(w));
  lines.forEach(l => {
    const L = l.toLowerCase(); if (!L || /^(name|address|payment|phone|landmark)/.test(L)) return;
    let best = null, score = 0;
    b.products.forEach(p => { const w = words(p.name); const hit = w.filter(x => L.includes(x)).length; const s = w.length ? hit / w.length : 0; if (hit && s > score) { score = s; best = p; } });
    if (best && score >= 0.5) { const q = L.match(/(\d+)\s*(?:x|×|pcs|nos|qty)\b/) || L.match(/(?:x|×|qty[:\s]*)\s*(\d+)\b/); qty[best.id] = (qty[best.id] || 0) + (q ? Number(q[1]) : 1); }
  });
  out.qty = qty; return out;
}

/* ------------------------------------------------------------------ pincode lookup */
const pinCache = {};
async function lookupPin(pin) {
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  if (pinCache[pin]) return pinCache[pin];
  try { const r = await fetch("https://api.postalpincode.in/pincode/" + pin); const j = await r.json();
    const po = j && j[0] && j[0].Status === "Success" && j[0].PostOffice && j[0].PostOffice[0];
    if (po) return (pinCache[pin] = { city: po.District, state: po.State, area: po.Name, ok: true });
    if (j && j[0] && j[0].Status === "Error") return (pinCache[pin] = { ok: false });
  } catch (e) {} return null;
}

/* ------------------------------------------------------------------ barcodes */
function barcodeSVG(text) {
  if (!window.JsBarcode || !text) return "";
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try { JsBarcode(s, text, { format: "CODE128", displayValue: false, margin: 0, height: 60, width: 2 }); } catch (e) { return ""; }
  s.setAttribute("preserveAspectRatio", "none"); return s.outerHTML;
}
function qrSVG(text, cell) {
  if (!window.qrcode || !text) return "";
  try { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell || 4, margin: 0, scalable: true }); } catch (e) { return ""; }
}
function upiURL(b, amt, note) { return b.upi ? `upi://pay?pa=${encodeURIComponent(b.upi)}&pn=${encodeURIComponent(b.name)}&am=${Number(amt).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}` : ""; }

/* ------------------------------------------------------------------ label + slip */
function labelHTML(o) {
  const b = brandById(o.brand);
  const addr = [o.address, o.landmark ? "Landmark: " + o.landmark : ""].filter(Boolean).join(", ");
  const items = (o.items || []).map(i => `<li>${i.qty} x ${esc(i.name)}</li>`).join("");
  return `<div class="label">
  <div class="l-top"><div class="l-brand"><b>${esc(b.name)}</b><span>${esc(b.site || b.tagline || "")}</span></div>
    ${o.courier ? `<div class="l-cour${o.courier.length > 6 ? " long" : ""}"><b>${esc(o.courier)}</b>${o.service ? `<span>${esc(o.service)}</span>` : ""}</div>` : ""}</div>
  <div class="l-pay pre"><b>PREPAID</b><span>Do not<br>collect cash</span></div>
  <div class="l-awb"><span class="k">${o.courier ? esc(o.courier) + " " : ""}AWB / Consignment no.</span>${o.awb ? `<span class="n big">${esc(o.awb)}</span>` : `<span class="blank"></span>`}</div>
  <div class="l-to"><span class="k">Deliver to</span><div class="l-name">${esc(o.name)}</div><div class="l-addr">${esc(addr)}</div><div class="l-ph">Ph ${esc(fmtPhone(o.phone))}${o.alt ? " / " + esc(fmtPhone(o.alt)) : ""}</div></div>
  <div class="l-pin"><div class="c"><b>${esc(o.city || "")}</b><span>${esc(o.state || "")}</span></div><div class="p"><small>PINCODE</small><b>${esc(o.pin)}</b></div></div>
  <div class="l-meta"><div><span class="k">Order</span><b>${esc(o.id)}</b></div><div><span class="k">Date</span><b>${dmy(o.date)}</b></div><div><span class="k">Weight</span><b>${weightKg(o)}</b></div><div><span class="k">Pcs</span><b>${pcs(o)}</b></div></div>
  <div class="l-bot"><div class="l-items"><span class="k">Contents</span><ul>${items}</ul></div></div>
  <div class="l-from"><span class="k">If undelivered, return to</span><br><b>${esc(b.from.name || b.name)}</b>, ${esc([b.from.line1, b.from.line2, b.from.city, b.from.state].filter(Boolean).join(", "))} - <b>${esc(b.from.pin)}</b> · Ph ${esc(fmtPhone(b.from.phone))}</div>
</div>`;
}
function slipHTML(o) {
  const b = brandById(o.brand);
  const rows = (o.items || []).map(i => `<tr><td>${esc(i.name)}</td><td class="n">${i.qty}</td></tr>`).join("");
  return `<div class="slip">
  <div class="sr"><div><h4>${esc(b.name)}</h4><div>${esc(b.site || "")}</div></div><div style="text-align:right"><b>PACKING SLIP</b><br>${esc(o.id)}<br>${dmy(o.date)}</div></div>
  <div class="sr"><div><b>Bill / ship to</b><br>${esc(o.name)}<br>${esc(o.address)}<br>${esc(o.city)} ${esc(o.state)} ${esc(o.pin)}<br>Ph ${esc(fmtPhone(o.phone))}</div></div>
  <table><thead><tr><th>Item</th><th class="n">Qty</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="sr"><span>Payment</span><b>Prepaid</b></div>
  ${b.gstin ? `<div>GSTIN: ${esc(b.gstin)}</div>` : ""}
  <div class="thanks"><b>Thank you, ${esc((o.name || "").split(" ")[0])}!</b><br>Patch test before first use. Questions? WhatsApp ${esc(fmtPhone(b.from.phone))}.${settings.nextNote ? "<br>" + esc(settings.nextNote) : ""}</div>
</div>`;
}
function printDocs(list, kind, bulk) { // only bulk printing takes labels out of the "new labels" list
  if (!list.length) return;
  const html = list.map(o => (kind !== "slip" ? labelHTML(o) : "") + (kind !== "label" ? slipHTML(o) : "")).join("");
  $("#print").innerHTML = html;
  setTimeout(() => { window.print(); if (bulk && kind !== "slip") { list.forEach(o => { if (!o.printedAt && orders[o.id]) patch(o.id, { printedAt: new Date().toISOString() }); }); if (route() === "dashboard") vDashboard(); offerReady(list.map(o => o.id)); } }, 150);
}

/* ------------------------------------------------------------------ label as image (for WhatsApp) */
const PX = 200; // dots per inch for the PNG
function wrapText(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/); const lines = []; let cur = "";
  words.forEach(w => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
  if (cur) lines.push(cur); return lines;
}
function fitText(ctx, text, maxW, size, weight, family) {
  let s = size; do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 14); return s + 2;
}
async function labelCanvas(o) {
  try { await Promise.all([document.fonts.load('900 40px Archivo'), document.fonts.load('700 30px Archivo'), document.fonts.load('800 40px "JetBrains Mono"')]); } catch (e) {}
  const b = brandById(o.brand); const W = 4 * PX, H = 6 * PX, P = 24, L = 5;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const UI = 'Archivo, Arial, sans-serif', MONO = '"JetBrains Mono", Consolas, monospace';
  const pt = n => Math.round(n * PX / 72);
  const line = y => { x.fillRect(0, y - L / 2, W, L); };
  const k = (t, X, Y, col) => { x.fillStyle = col || "#000"; x.font = `900 ${pt(7.5)}px ${UI}`; x.textBaseline = "top"; x.fillText(t.toUpperCase().split("").join(String.fromCharCode(8202)), X, Y); x.textBaseline = "alphabetic"; x.fillStyle = "#000"; };
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.fillStyle = "#000"; x.textBaseline = "alphabetic";
  let y = 0;
  // top
  const topH = .58 * PX; const courW = o.courier ? 1.35 * PX : 0;
  x.fillStyle = "#000"; const bs = fitText(x, b.name.toUpperCase(), W - courW - 2 * P, pt(17), 900, UI); x.fillText(b.name.toUpperCase(), P, topH * .55);
  x.font = `700 ${pt(7)}px ${UI}`; x.fillText((b.site || b.tagline || "").toUpperCase(), P, topH * .55 + pt(10));
  if (o.courier) { x.fillRect(W - courW, 0, courW, topH); x.fillStyle = "#fff"; x.textAlign = "center"; const name = o.courier.toUpperCase();
    if (name.length > 6) { const parts = name.split(" "); x.font = `900 ${pt(15)}px ${UI}`; parts.slice(0, 2).forEach((p, i) => x.fillText(p, W - courW / 2, topH / 2 + (i - (parts.length > 1 ? .5 : 0)) * pt(15) + pt(5))); }
    else { fitText(x, name, courW - 20, pt(21), 900, UI); x.fillText(name, W - courW / 2, topH / 2 + pt(o.service ? 4 : 7)); if (o.service) { x.font = `800 ${pt(7)}px ${UI}`; x.fillText(o.service.toUpperCase(), W - courW / 2, topH - pt(5)); } }
    x.textAlign = "left"; x.fillStyle = "#000"; }
  y = topH; line(y);
  // pay band
  const payH = .56 * PX;
  x.font = `900 ${pt(24)}px ${UI}`; x.fillText("PREPAID", P, y + payH / 2 + pt(8));
  x.textAlign = "right"; x.font = `900 ${pt(9)}px ${UI}`;
  x.fillText("DO NOT", W - P, y + payH / 2 - pt(1)); x.fillText("COLLECT CASH", W - P, y + payH / 2 + pt(10));
  x.textAlign = "left"; x.fillStyle = "#000"; y += payH; line(y);
  // awb
  const awbH = .62 * PX; k(((o.courier ? o.courier + " " : "") + "AWB / Consignment no."), P, y + 10);
  if (o.awb) { x.textAlign = "center"; fitText(x, o.awb, W - 2 * P, pt(22), 800, MONO); x.fillText(o.awb, W / 2, y + awbH - pt(8)); x.textAlign = "left"; }
  else { x.setLineDash([12, 8]); x.lineWidth = 4; x.beginPath(); x.moveTo(P, y + awbH - 14); x.lineTo(W - P, y + awbH - 14); x.stroke(); x.setLineDash([]); }
  y += awbH; line(y);
  // deliver to
  const pinH = .66 * PX, metaH = .4 * PX, botH = .8 * PX, fromH = .52 * PX;
  const toH = H - y - pinH - metaH - botH - fromH; const toTop = y;
  k("Deliver to", P, y + 12); let ty = y + 12 + pt(8);
  x.font = `900 ${pt(16)}px ${UI}`; wrapText(x, (o.name || "").toUpperCase(), W - 2 * P).slice(0, 2).forEach(l => { ty += pt(16); x.fillText(l, P, ty); });
  x.font = `700 ${pt(11.5)}px ${UI}`; const addr = [o.address, o.landmark ? "Landmark: " + o.landmark : ""].filter(Boolean).join(", ");
  const room = Math.max(1, Math.floor((toTop + toH - pt(20) - ty - 8) / pt(14))); wrapText(x, addr, W - 2 * P).slice(0, room).forEach(l => { ty += pt(14); x.fillText(l, P, ty); });
  x.font = `800 ${pt(11.5)}px ${MONO}`; x.fillText("Ph " + fmtPhone(o.phone) + (o.alt ? " / " + fmtPhone(o.alt) : ""), P, toTop + toH - 14);
  y = toTop + toH; line(y);
  // pin row
  const pinW = 1.7 * PX; x.fillRect(W - pinW, y, pinW, pinH); x.fillStyle = "#fff"; x.textAlign = "center";
  x.font = `900 ${pt(7)}px ${UI}`; x.fillText("P I N C O D E", W - pinW / 2, y + pt(12)); fitText(x, o.pin, pinW - 20, pt(27), 800, MONO); x.fillText(o.pin, W - pinW / 2, y + pinH - pt(7));
  x.textAlign = "left"; x.fillStyle = "#000"; fitText(x, (o.city || "").toUpperCase(), W - pinW - 2 * P, pt(13), 900, UI); x.fillText((o.city || "").toUpperCase(), P, y + pinH / 2 + pt(2));
  x.font = `800 ${pt(8.5)}px ${UI}`; x.fillText((o.state || "").toUpperCase(), P, y + pinH / 2 + pt(13));
  y += pinH; line(y);
  // meta
  const cols = [["Order", o.id, 1.5], ["Date", dmy(o.date), 1], ["Weight", weightKg(o), .8], ["Pcs", String(pcs(o)), .6]]; const tot = cols.reduce((a, c2) => a + c2[2], 0); let cx = 0;
  cols.forEach(([kk, v, wgt], i) => { const cw = W * wgt / tot; k(kk, cx + 12, y + 8); fitText(x, v, cw - 20, pt(9.5), 800, MONO); x.fillText(v, cx + 12, y + metaH - 12); cx += cw; if (i < 3) x.fillRect(cx - 1.5, y, 3, metaH); });
  y += metaH; line(y);
  // contents
  k("Contents", P, y + 10); x.font = `700 ${pt(8.5)}px ${UI}`; let iy = y + 10 + pt(8);
  (o.items || []).slice(0, 4).forEach(i => { iy += pt(11); x.fillText(`${i.qty} x ${i.name}`, P, iy); });
  y += botH; line(y);
  // from
  x.font = `900 ${pt(7.5)}px ${UI}`; const tag = "IF UNDELIVERED, RETURN TO"; const tw = x.measureText(tag).width + 16;
  x.fillRect(P, y + 10, tw, pt(11)); x.fillStyle = "#fff"; x.textBaseline = "middle"; x.fillText(tag, P + 8, y + 10 + pt(11) / 2 + 1); x.textBaseline = "alphabetic"; x.fillStyle = "#000";
  x.font = `700 ${pt(8)}px ${UI}`; const f = b.from || {};
  wrapText(x, `${f.name || b.name}, ${[f.line1, f.line2, f.city, f.state].filter(Boolean).join(", ")} - ${f.pin} · Ph ${fmtPhone(f.phone)}`, W - 2 * P).slice(0, 2).forEach((l, i) => x.fillText(l, P, y + 10 + pt(11) + pt(10) * (i + 1)));
  // outer border
  x.lineWidth = L * 1.2; x.strokeRect(L * .6, L * .6, W - L * 1.2, H - L * 1.2);
  return c;
}
const pngCache = {};
function labelBlob(o) {
  const key = o.id + "|" + o.updatedAt;
  if (!pngCache[key]) pngCache[key] = labelCanvas(o).then(c => new Promise(res => c.toBlob(res, "image/png")));
  return pngCache[key];
}
const isTouch = () => matchMedia("(pointer:coarse)").matches;
/* WhatsApp buttons are real links to wa.me/91<customer number>, so a tap always opens THAT customer's chat
   (WhatsApp app on phones, WhatsApp Web/Desktop on computers) with the message typed in. */
function waHref(o, kind) {
  if (phone10(o.phone).length !== 10) return "";
  const text = trackingMessage(o); // one message: with tracking if added, without if not
  return waLink(o.phone, text);
}
function waAnchor(o, cls, inner, kind, extra) {
  const href = waHref(o, kind);
  if (!href) return `<button type="button" class="${cls}" disabled title="No valid mobile number">${inner}</button>`;
  const lk = (kind === "track" || (kind !== "confirm" && o.awb)) && tkLocked(o.id); // this message is being sent by itself right now: no second one by hand
  return `<a class="${cls}${lk ? " locked" : ""}"${lk ? ' aria-disabled="true"' : ""} href="${esc(href)}" target="_blank" rel="noopener" data-wa="${esc(o.id)}" data-kind="${kind || ""}" ${extra || ""}>${inner}</a>`;
}
// A tracking button that is locked (its message is waiting to go, or going, by itself) does nothing when tapped.
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-wa]"); if (!a) return; const o = orders[a.dataset.wa]; if (!o) return;
  if ((a.dataset.kind === "track" || (a.dataset.kind !== "confirm" && o.awb)) && tkLocked(o.id)) { e.preventDefault(); e.stopPropagation(); toast("WhatsApp Auto is sending this one. Wait a moment, or press Stop first."); }
}, true);
// When a WhatsApp link is tapped: let the link open the chat, and also copy the label picture (if dispatched) and remember it was sent.
document.addEventListener("click", e => {
  const a = e.target.closest("a[data-wa]"); if (!a) return; const o = orders[a.dataset.wa]; if (!o) return;
  { // the label picture is copied every time, ready to paste in the chat
    try { if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) navigator.clipboard.write([new ClipboardItem({ "image/png": labelBlob(o) })]).then(() => toast(isTouch() ? "Label copied: long-press the message box → Paste to add it." : "Label copied: press Ctrl+V in the chat to add it."), () => {}); } catch (x) {}
    setTimeout(() => { if (o.awb) markSent(o); if (route() === "dashboard") vDashboard(); tkRefresh(); }, 400); // small in-place updates: on Dispatch the redraw used to wipe AWB numbers typed for the next parcels
  }
});
function markSent(o) { // remembers what was sent by hand: the first time, and again when the number was corrected after the customer got the old one
  const cur = orders[o.id]; if (!cur) return; const sig = trackSig(cur);
  if (!cur.trackingSentAt) patch(o.id, { trackingSentAt: new Date().toISOString(), trackingVia: "", trackingMsgId: "", trackingTry: "", trackingSentSig: sig });
  else if (cur.trackingSentSig !== sig) patch(o.id, { trackingSentAt: new Date().toISOString(), trackingVia: "", trackingMsgId: "", trackingSentSig: sig });
}
async function shareLabel(o) {
  const blob = await labelBlob(o); const file = new File([blob], `${o.id}-label.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Label " + o.id }); return; } /* sharing one label (e.g. to the customer) does not take it out of the bulk labels */ catch (e) { if (e && e.name === "AbortError") return; }
  }
  downloadLabelPNG(o); toast("Sharing isn't available on this device, so the label was downloaded instead.");
}
document.addEventListener("click", e => { const x = e.target.closest("[data-sharelbl]"); if (x) { const o = orders[x.dataset.sharelbl]; if (o) shareLabel(o); } });
const LABEL_BTNS = o => `<button type="button" class="btn sm" data-png="${esc(o.id)}">⬇ Download</button><button type="button" class="btn sm" data-sharelbl="${esc(o.id)}">↗ Share</button>`;
async function downloadLabelPNG(o) { const blob = await labelBlob(o); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${o.id}-label.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
/* Many labels at once → ONE PDF, one 4 × 6 inch label per page (10 orders = 10 pages).
   Built right here in the browser, no extra library needed. */
async function labelsPDF(list) {
  const enc = new TextEncoder(); const parts = []; let len = 0; const offs = [];
  const add = d => { const b = typeof d === "string" ? enc.encode(d) : d; parts.push(b); len += b.length; };
  const imgs = [];
  for (const o of list) {
    const c = await labelCanvas(o); const bin = atob(c.toDataURL("image/jpeg", 0.92).split(",")[1]);
    imgs.push({ w: c.width, h: c.height, data: Uint8Array.from(bin, ch => ch.charCodeAt(0)) });
  }
  const n = imgs.length, W = 288, H = 432; // 4 × 6 inches in PDF points
  // objects: 1 catalog, 2 pages, then for each label: page, content, image
  const obj = (id, body) => { offs[id] = len; add(`${id} 0 obj\n`); body(); add("\nendobj\n"); };
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, () => add("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => add(`<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`));
  imgs.forEach((im, i) => {
    const pg = 3 + i * 3, ct = pg + 1, ig = pg + 2; const draw = `q ${W} 0 0 ${H} 0 0 cm /L Do Q`;
    obj(pg, () => add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /L ${ig} 0 R >> >> /Contents ${ct} 0 R >>`));
    obj(ct, () => add(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    obj(ig, () => { add(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`); add(im.data); add("\nendstream"); });
  });
  const total = 3 + n * 3; const xref = len;
  add(`xref\n0 ${total}\n0000000000 65535 f \n` + Array.from({ length: total - 1 }, (_, i) => String(offs[i + 1]).padStart(10, "0") + " 00000 n \n").join(""));
  add(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: "application/pdf" });
}
const pdfName = list => `labels-${today()}-${list.length}.pdf`;
// A label counts as done once it is printed, downloaded or shared, so bulk PDFs only contain NEW labels.
function markLabelsDone(list) { const now = new Date().toISOString(); list.forEach(o => { if (orders[o.id] && !orders[o.id].printedAt) patch(o.id, { printedAt: now }); }); offerReady(list.map(o => o.id)); }
async function downloadLabels(list) {
  if (!list.length) return; toast("Making PDF of " + list.length + " label" + (list.length > 1 ? "s" : "") + "…");
  const blob = await labelsPDF(list); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = pdfName(list); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  markLabelsDone(list); toast(`Downloaded 1 PDF · ${list.length} page${list.length > 1 ? "s" : ""}`); if (route() === "dashboard") vDashboard();
}
async function shareLabels(list) {
  if (!list.length) return; toast("Making PDF of " + list.length + " label" + (list.length > 1 ? "s" : "") + "…");
  const file = new File([await labelsPDF(list)], pdfName(list), { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: list.length + " labels" }); markLabelsDone(list); if (route() === "dashboard") vDashboard(); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  await downloadLabels(list); toast("Sharing isn't available here, so the PDF was downloaded instead.");
}
const SEND_BTN = (o, cls) => waAnchor(o, `btn ${cls || "hi"} sendbtn`, `${WA_ICON} Send on WhatsApp`, "track");
const WA_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3Z"/></svg>';
document.addEventListener("click", e => { const d = e.target.closest("[data-png]"); if (d) { const o = orders[d.dataset.png]; if (o) downloadLabelPNG(o); } });

/* ------------------------------------------------------------------ WhatsApp templates */
const QUOTES = [
  "Glow is not a moment, it's a ritual.",
  "Small steps every night, a softer you every morning.",
  "Your skin remembers every kind thing you do for it.",
  "Good things come to those who glow.",
  "Self-care is not a luxury. It's a little love, every day.",
  "Beauty begins the moment you decide to care for yourself.",
  "Be gentle with your skin, and with yourself.",
  "Confidence looks good on you. Glow looks even better.",
  "Your glow-up is on its way. Literally!",
  "Calm routine, happy skin, beautiful you.",
  "Every jar is packed with care, just for you.",
  "Radiance is a habit, not a filter.",
];
function quoteFor(o) { let h = 0; for (const c of o.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return QUOTES[h % QUOTES.length]; }
function prodPhrase(o) {
  const n = [...new Set((o.items || []).map(i => i.name))];
  if (!n.length) return "order"; if (n.length === 1) return n[0];
  return n.slice(0, -1).join(", ") + " & " + n[n.length - 1];
}
const signoff = () => (settings.signoff || "With love, Team skinday.in 💛");
/* ONE WhatsApp message per order: with tracking details once an AWB is added, without them before. */
function trackingMessage(o) {
  const first = (o.name || "").split(" ")[0]; const p = prodPhrase(o); const many = pcs(o) > 1;
  if (!o.awb) return [
    `✨ *Your ${p} order is confirmed!* ✨`, "",
    `Hi ${first}, thank you for your order.`, "",
    `📦 Order: *${o.id}*`,
    ...(o.items || []).map(i => `   • ${i.qty} x ${i.name}`),
    `📍 Delivery to: ${[o.address, o.city, o.pin].filter(Boolean).join(", ")}`,
    `✅ Prepaid: nothing to pay at delivery`,
    `🚚 We'll pack it with love and share the tracking details once it's dispatched.`, "",
    `_"${quoteFor(o)}"_`, "",
    signoff(),
  ].join("\n");
  const lines = [
    `✨ *Your ${p} ${many ? "are" : "is"} on the way!* ✨`, "",
    `Hi ${first},`, `Your parcel has been packed with love and handed to the courier.`, "",
    `📦 Order: *${o.id}*`,
    ...(o.items || []).map(i => `   • ${i.qty} x ${i.name}`),
    o.courier ? `🚚 Courier: *${o.courier}*` : null,
    `🔢 Tracking no: *${o.awb}*`,
    trackLink(o) ? `🔗 Track: ${trackLink(o)}${trackHasAwb(o) ? "" : " (enter the tracking no. above)"}` : null,
    o.shippedAt ? `📅 Dispatched: ${dmy(o.shippedAt.slice(0, 10))}` : null,
    `⏱️ Delivery: usually 3–7 days`,
    `✅ Prepaid: nothing to pay at delivery`, "",
    `_"${quoteFor(o)}"_`, "",
    signoff(),
  ];
  return lines.filter(l => l !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}
function templates(o) {
  const b = brandById(o.brand); const first = (o.name || "").split(" ")[0]; const items = itemsText(o); const p = prodPhrase(o);
  const t = [[o.awb ? "Order + tracking" : "Order message", trackingMessage(o)]];
  t.push(["Getting ready", readyMessage(o)]);
  if (!o.paid) t.push(["Ask for payment", `Hi ${first}, your order for ${p} (${o.id}) is ready.\n\nPlease pay with Google Pay / any UPI app${b.upi ? " to " + b.upi : ""} and send the payment screenshot. We ship as soon as payment is received.`]);
  if (o.status === "ofd") t.push(["Out for delivery", `Hi ${first}, your ${p} ${pcs(o) > 1 ? "are" : "is"} out for delivery today${o.courier ? " with " + o.courier : ""}. Please keep your phone reachable.`]);
  t.push(["How to use", `Hi ${first}, we hope your ${p} reached you safely!\n\nQuick tips: patch test first, apply a small amount on clean skin, and use sunscreen in the day.\n\nAny questions, just reply here.`]);
  t.push(["Ask for review", `Hi ${first}, how are you finding your ${p}? A short honest reply (and a photo, if you like) really helps us. Thank you!`]);
  return t.map(([n, m]) => [n, m.includes(signoff()) ? m : m + "\n\n" + signoff()]);
}

/* ------------------------------------------------------------------ "your order is getting ready" (after printing labels) */
function readyMessage(o) {
  const first = (o.name || "").split(" ")[0];
  return [first ? `Hi ${first} 🌸` : "Hi 🌸", "",
    `*Your order is getting ready!* 📦`, "",
    `Order: *${o.id}*`,
    ...(o.items || []).map(i => `   • ${i.qty} x ${i.name}`), "",
    `We are packing it with care right now. As soon as the courier picks it up, we will send you the tracking number here.`, "",
    signoff()].join("\n");
}
// who still needs telling: parcel not dispatched yet, not told before, and a valid mobile number
function needsReady(o) { return !!o && !o.deleted && !o.readySentAt && !o.trackingSentAt && TOSHIP.includes(o.status) && phone10(o.phone).length === 10; }
// labels printed today whose customer has not been told yet
function readyDue() { const t = today(); return live().filter(o => needsReady(o) && o.printedAt && localISO(new Date(o.printedAt)) === t).sort((a, b) => a.printedAt.localeCompare(b.printedAt)); }
/* ---- automatic WhatsApp (through Meta or AiSensy). Your site's /api/wa sends the approved message; this page only asks it to. ---- */
const autoWaOn = () => online() && settings.autoWa !== false; // needs the Online storage login; can be switched off in Settings
const waUrl = () => device.sheetUrl.replace(/\/api\/sync$/, "/api/wa");
async function callWa(payload, ms) { // asks your site's /api/wa. Never waits for ever. e.unsure = "it may have gone through"
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 20000);
  const bad = (msg, unsure) => { const x = new Error(msg); x.unsure = unsure; return x; };
  try {
    let r;
    try { r = await fetch(waUrl(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: device.sheetKey, ...payload }), signal: c.signal }); }
    catch (e) { throw bad(c.signal.aborted ? "Your site did not answer in time." : "Could not reach your site.", true); }
    let j = null; try { j = await r.json(); } catch (e) { if (c.signal.aborted) throw bad("Your site did not answer in time.", true); }
    if (!j) throw bad(r.status === 404 ? "Automatic WhatsApp is not added to your site yet." : "Your site did not answer properly (" + r.status + ").", r.status !== 404);
    return j;
  } finally { clearTimeout(t); }
}
let waChk = { at: 0, ok: null, msg: "" };
// who sends the messages for this site: "aisensy" or "meta" ("" = not known yet). Only used to word the notes in plain language.
const waWho = () => waChk.via === "aisensy" ? "AiSensy" : waChk.via === "meta" ? "Meta" : "WhatsApp";
const waTo = () => waChk.via ? " to " + waWho() : ""; // "not connected" + this + " yet"
const waViaTag = () => waChk.via === "aisensy" ? "aisensy" : "meta"; // what an order remembers when WhatsApp Auto sent it
async function waReady(force) { // is WhatsApp connected on the site? Asks, without sending anything. (Each message has its own switch in Settings; this only needs the online login.)
  if (!online()) return false;
  if (!force && waChk.ok !== null && Date.now() - waChk.at < (waChk.ok ? 600000 : 20000)) return waChk.ok;
  // track = the site's api/wa.js is the newer one that also knows the tracking message. An older one does not say so, and then tracking is never sent through it.
  try { const j = await callWa({ ping: true }, 8000); waChk = { at: Date.now(), ok: !!(j.ok && j.ready), track: j.track === true, msg: j.ok ? "" : (j.error || ""), num: j.number || "", name: j.name || "", via: j.via === "aisensy" || j.via === "meta" ? j.via : "" }; }
  catch (e) { waChk = { at: Date.now(), ok: false, track: false, msg: e.message || "", via: waChk.via || "" }; }
  return waChk.ok;
}
// the three blanks in the approved message: first name, order number, items
const readyParts = o => { const c = s => String(s || "").replace(/\s+/g, " ").trim(); return { name: c((o.name || "").split(" ")[0]) || "there", order: o.id, items: c(itemsText(o)) || "your order" }; };
// readyTry = "a send was started and I never saw the answer". Such an order is never sent by itself again (it may already have reached the customer).
const needsAuto = o => needsReady(o) && !o.readyTry;

let ntTimer = null, ntClose = null, ntRunning = false, ntQueue = [];
const ntCount = () => (ui.nt || []).map(id => orders[id]).filter(o => o && needsAuto(o)).length;
const ntWaitHead = () => { const n = ntCount(); return `✓ Labels printed. WhatsApp goes to ${n} customer${n === 1 ? "" : "s"} in ${ui.ntLeft}…`; };
function startAuto(ids, wait) { // wait = a few seconds to press Stop first (used right after printing)
  if (ntRunning) { ntQueue = [...new Set([...ntQueue, ...ids])]; renderNt(); return; } // sending right now: these go next
  const keep = ui.ntAuto && ui.ntPhase === "wait" ? (ui.nt || []) : []; // a second print during the countdown joins the same round
  clearInterval(ntTimer); clearTimeout(ntClose);
  ui.nt = [...new Set([...keep, ...ids])].filter(id => needsReady(orders[id])); ui.ntAuto = true; ui.ntSt = {}; ui.ntErr = {}; ui.ntNote = "";
  if (!ui.nt.length) { renderNt(); return; }
  if (!wait || !ntCount()) { runAuto(ui.nt.slice()); return; }
  ui.ntPhase = "wait"; ui.ntLeft = 5; renderNt();
  ntTimer = setInterval(() => {
    ui.ntLeft--;
    if (ui.ntLeft <= 0) { clearInterval(ntTimer); runAuto(ui.nt.slice()); return; }
    const h = document.querySelector("#ntbar h2"); if (h) h.textContent = ntWaitHead(); // only the number changes, so the Stop button is never rebuilt under a finger
  }, 1000);
}
async function runAuto(ids) {
  if (ntRunning) return; ntRunning = true;
  ui.ntPhase = "run"; ui.ntLeft = 0; renderNt();
  let stopAll = "";
  try {
    for (const id of ids) {
      const o = orders[id]; if (!o || !needsReady(o)) continue;
      if (o.readyTry) { ui.ntSt[id] = "unsure"; continue; } // an earlier try may have gone through: that one is left to the owner
      if (stopAll) { ui.ntSt[id] = "fail"; ui.ntErr[id] = stopAll; continue; }
      ui.ntSt[id] = "sending"; renderNt();
      patch(id, { readyTry: new Date().toISOString() }); // written BEFORE sending: a closed tab or a lost reply can then never lead to a second automatic message
      let j, down = false;
      try { j = await callWa({ to: phone10(o.phone), ...readyParts(o) }, 20000); }
      catch (e) { down = true; j = { ok: false, unsure: !!e.unsure, error: e.message || "Could not reach your site." }; }
      if (j.ok) { patch(id, { readySentAt: new Date().toISOString(), readyVia: waViaTag(), readyMsgId: j.id || "", readyTry: "" }); ui.ntSt[id] = "ok"; }
      else {
        ui.ntSt[id] = j.unsure ? "unsure" : "fail"; ui.ntErr[id] = j.error || "Not sent.";
        if (!j.unsure) patch(id, { readyTry: "" }); // a clear "no": safe to try this one again later
        if (j.fatal || j.setup || j.unsure || down) { // the same trouble would hit everyone: don't keep trying the rest
          stopAll = j.fatal || j.setup || (down && !j.unsure) ? ui.ntErr[id] : down ? "Your site is not answering, so this one was not tried." : waWho() + " is not answering, so this one was not tried.";
          if (!j.tpl && !TEMPLATE_CODES.includes(Number(j.code))) waChk = { at: Date.now(), ok: false, track: waChk.track, via: waChk.via, msg: stopAll }; // a template problem only hurts that one message
        }
      }
      renderNt();
    }
  } catch (e) { /* never leave the box stuck */ }
  finally { ntRunning = false; ui.ntPhase = "done"; }
  renderNt();
  const q = ntQueue.filter(id => !ids.includes(id) && needsReady(orders[id])); ntQueue = [];
  if (!q.length && ids.every(id => !orders[id] || orders[id].readySentAt)) { clearTimeout(ntClose); ntClose = setTimeout(() => { if (ui.ntPhase === "done" && !ntRunning) { ui.nt = []; renderNt(); } }, 9000); }
  if (route() === "dashboard") vDashboard();
  if (q.length) startAuto(q, true); // labels printed while this round was sending
}
function showManual(ids) { // the one-tap way (used when automatic sending is off, not connected yet, or was stopped)
  if (ntRunning) return; // a round is sending right now; these stay on Today under "Tell N customers"
  const keep = ui.ntAuto && ui.ntPhase === "wait" ? (ui.nt || []) : [];
  clearInterval(ntTimer);
  ui.nt = [...new Set([...keep, ...ids])]; ui.ntAuto = false; ui.ntPhase = "";
  ui.ntNote = settings.autoWa === false ? "" : !online() ? "Automatic sending works from your own site (see Settings → Automatic WhatsApp)." : "Automatic WhatsApp is not connected" + waTo() + " yet.";
  renderNt();
}
async function offerReady(ids) { // called right after labels are printed
  const add = [...new Set(ids)].filter(id => needsReady(orders[id])); if (!add.length) return;
  if (autoWaOn() && await waReady()) startAuto(add, true); else showManual(add);
}
async function tellDue(ids) { if (autoWaOn() && await waReady()) startAuto(ids, false); else showManual(ids); }

function ntRow(o) {
  const st = (ui.ntSt || {})[o.id], err = (ui.ntErr || {})[o.id], done = !!o.readySentAt;
  const unsure = !done && (st === "unsure" || (!st && !!o.readyTry));
  const queued = ui.ntAuto && !done && !unsure && (ui.ntPhase === "wait" || (ui.ntPhase === "run" && !st));
  const act = done ? `<span class="tag t-upi">${o.readySkip ? "Skipped" : "Sent ✓"}</span>`
    : st === "sending" ? `<span class="wait">Sending…</span>`
    : queued ? `<span class="wait">Waiting…</span>`
    : `<button type="button" class="btn sm ghost" data-ntskip="${esc(o.id)}">Skip</button><a class="btn sm" href="${esc(waLink(o.phone, readyMessage(o)))}" target="_blank" rel="noopener" data-wr="${esc(o.id)}">${WA_ICON} WhatsApp</a>`;
  const note = done ? "" : unsure ? `<span class="err">Not sure: ${esc(err || "an earlier try may have gone through, so it is not sent again by itself.")}</span>` : err ? `<span class="err">Not sent: ${esc(err)}</span>` : "";
  return `<li class="nt-row${done ? " done" : ""}"><div style="min-width:0"><b>${esc(o.name)}</b><span class="meta">${esc(prodPhrase(o))} · <span class="mono">${esc(fmtPhone(o.phone))}</span></span>${note}</div>
    <div class="nt-act">${act}</div></li>`;
}
function renderNt() {
  const el = $("#ntbar"); if (!el) return;
  const list = (ui.nt || []).map(id => orders[id]).filter(o => o && (o.readySentAt || needsReady(o)));
  if (!list.length) { el.hidden = true; el.innerHTML = ""; return; }
  const todo = list.filter(o => !o.readySentAt), next = todo[0], n = list.length, sent = n - todo.length, s = k => k === 1 ? "" : "s";
  const stOf = o => (ui.ntSt || {})[o.id], nUnsure = todo.filter(o => stOf(o) === "unsure" || (!stOf(o) && o.readyTry)).length, nFail = todo.length - nUnsure;
  let head, hint = "", main = "";
  if (ui.ntAuto && ui.ntPhase === "wait") {
    head = ntWaitHead();
    hint = "Sent by itself through WhatsApp Business. Press Stop if you cancelled the print.";
    main = `<button type="button" class="btn hi sendbtn" data-ntstop>Stop, don't send</button>`;
  } else if (ui.ntAuto && ui.ntPhase === "run") {
    head = `Sending WhatsApp… ${sent} of ${n}`; hint = "Please keep this page open." + (ntQueue.length ? ` ${ntQueue.length} more will go after this.` : "");
  } else if (ui.ntAuto) {
    head = todo.length ? [`${sent} sent`, nFail ? `${nFail} not sent` : "", nUnsure ? `${nUnsure} not sure` : ""].filter(Boolean).join(", ") : `✓ WhatsApp sent to ${n} customer${s(n)}`;
    hint = todo.length ? "For these, tap WhatsApp to send by hand." + (nUnsure ? " “Not sure” means " + waWho() + " did not answer in time. It may have gone through, so only send by hand if the customer says it did not arrive." : "") : "";
  } else {
    head = "✓ Labels printed. Tell your customers";
    hint = (ui.ntNote ? ui.ntNote + " " : "") + "One tap opens WhatsApp with “your order is getting ready” already typed. Just press Send there.";
    main = next ? `<a class="btn hi sendbtn" href="${esc(waLink(next.phone, readyMessage(next)))}" target="_blank" rel="noopener" data-wr="${esc(next.id)}">${WA_ICON} Send to next: ${esc(next.name)} (${todo.length} left)</a>` : `<p class="nt-info" style="color:var(--ok)">✓ All customers told.</p>`;
  }
  const closeBtn = ui.ntAuto && ui.ntPhase === "run" ? "" : `<button type="button" class="btn sm ghost" data-ntclose>${ui.ntAuto && ui.ntPhase === "wait" ? "Cancel" : "Close"}</button>`;
  el.hidden = false;
  el.innerHTML = `<div class="nt-head"><div><h2>${head}</h2>${hint ? `<p class="hint" style="margin:3px 0 0">${esc(hint)}</p>` : ""}</div>${closeBtn}</div>
    ${main}<ul class="nt-list">${list.map(ntRow).join("")}</ul>`;
}
document.addEventListener("click", e => {
  const w = e.target.closest("a[data-wr]");
  if (w) { const id = w.dataset.wr; setTimeout(() => { if (orders[id] && !orders[id].readySentAt) patch(id, { readySentAt: new Date().toISOString(), readyTry: "" }); renderNt(); if (route() === "dashboard") vDashboard(); }, 400); return; }
  const s = e.target.closest("[data-ntskip]");
  if (s) { patch(s.dataset.ntskip, { readySentAt: new Date().toISOString(), readySkip: true, readyTry: "" }); renderNt(); if (route() === "dashboard") vDashboard(); return; }
  if (e.target.closest("[data-ntstop]")) { clearInterval(ntTimer); ui.ntAuto = false; ui.ntPhase = ""; ui.ntNote = "Stopped. Nothing was sent."; renderNt(); return; }
  if (e.target.closest("[data-ntclose]")) { if (ui.ntAuto && ui.ntPhase === "wait") { clearInterval(ntTimer); ui.ntAuto = false; ui.ntPhase = ""; toast("Cancelled. Nothing was sent."); } ui.nt = []; renderNt(); }
});

/* ------------------------------------------------------------------ "your order is on the way" (after "Save & mark dispatched") */
/* Same safety rules as the label message: the "tried" mark is written BEFORE sending, a send that may have gone through is never repeated
   by itself, trouble that would hit every customer stops the rest of the round, and there are a few seconds to press Stop first.
   Nothing here redraws the Orders or Dispatch page while it works (that would wipe tracking numbers typed for the next parcels):
   only small spots are updated in place (tkSync). */
// who still needs the tracking message: on the way, has a tracking number, not told yet, not skipped, valid mobile number
const needsTrack = o => !!o && !o.deleted && !!o.awb && ONROAD.includes(o.status) && !o.trackingSentAt && !o.trackingSkip && phone10(o.phone).length === 10;
// trackingTry = "a send was started and I never saw the answer". Such an order is never sent by itself again (it may already have reached the customer).
const needsTkAuto = o => needsTrack(o) && !o.trackingTry;
// tracking saved today and the customer not told yet (the "Send tracking to N" button on Today)
function trackDue() { const t = today(); return live().filter(o => needsTrack(o) && o.trackSavedAt && localISO(new Date(o.trackSavedAt)) === t).sort((a, b) => a.trackSavedAt.localeCompare(b.trackSavedAt)); }
const autoTrackOn = () => online() && settings.autoTrack !== false; // needs the Online storage login; has its own switch in Settings
// the six blanks of the approved message: first name, order number, items, courier, tracking number, tracking link
function trackParts(o) {
  const c = s => String(s || "").replace(/\s+/g, " ").trim();
  const awb = String(o.awb || "").replace(/\s+/g, ""); // the same spaceless number goes into the blank and into the link
  let link = c(trackLink({ ...o, awb }));
  if (link && !/^https?:\/\//i.test(link) && /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]|$)/i.test(link)) link = "https://" + link; // typed as www.… without https://
  return { kind: "track", name: c((o.name || "").split(" ")[0]) || "there", order: o.id, items: c(itemsText(o)) || "your order", courier: c(o.courier), awb, link };
}
// what the customer's message says about THIS parcel: courier, number and a link typed for this order (not the courier's page from Settings: changing that is not news for the customer)
const trackSig = o => [String(o.courier || "").replace(/\s+/g, " ").trim(), String(o.awb || "").replace(/\s+/g, ""), String(o.trackUrl || "").replace(/\s+/g, " ").trim()].join("|");
// Meta's "this message template is missing or does not match": that only hurts the tracking message, so the label message stays marked as working
const TEMPLATE_CODES = [132000, 132001, 132007, 132012, 132015, 132016, 132018];

let tkTimer = null, tkClose = null, tkRunning = false, tkQueue = [];
const tkRetry = new Set(); // saved again while the round runs, after this customer already got a clear "no": tried once more when the round is over
const tkHold = new Set(); // saved just now, still finding out whether it can go by itself: its hand-send button waits
function tkLocked(id) { // true while this order's tracking message is waiting to go, or going, by itself
  if (tkHold.has(id) || tkQueue.includes(id)) return true;
  if (tkRunning && ui.tkAuto && (ui.tkSt || {})[id] === "sending") return true; // its request is out right now (the "tried" mark is already written, so the check below no longer sees it)
  const o = orders[id]; if (!ui.tkAuto || !o || !needsTkAuto(o) || !(ui.tk || []).includes(id)) return false;
  return ui.tkPhase === "wait" || (ui.tkPhase === "run" && !(ui.tkSt || {})[id]);
}
const tkCount = () => (ui.tk || []).map(id => orders[id]).filter(o => o && needsTkAuto(o)).length;
const tkWaitHead = () => { const n = tkCount(); return `✓ Tracking saved. WhatsApp goes to ${n} customer${n === 1 ? "" : "s"} in ${ui.tkLeft}…`; };
const tkDay = iso => dmy(localISO(new Date(iso)));
// the little status line next to a tracking button (def = what it says when nothing has happened yet)
function tkText(o, def) {
  if (o.trackingSentAt) {
    const base = o.trackingVia ? `✓ Sent by WhatsApp Auto · ${tkDay(o.trackingSentAt)}` : `✓ Sent ${tkDay(o.trackingSentAt)}`;
    return o.trackingSentSig && o.trackingSentSig !== trackSig(o) ? base + ". The tracking changed after that. Tap Send on WhatsApp to send the new one." : base;
  }
  if (tkLocked(o.id)) return "WhatsApp Auto is sending this…";
  if (o.trackingTry) return "Not sure if it went through. Ask the customer before sending again.";
  return def || "";
}
const tkChip = (o, def) => `<span class="hint" data-tkst="${esc(o.id)}" data-def="${esc(def || "")}">${esc(tkText(o, def))}</span>`;
// the "Send to next" button under "Just dispatched" on the Dispatch page
function dispNext(done) {
  const unsent = done.filter(o => !o.trackingSentAt && phone10(o.phone).length === 10), free = unsent.filter(o => !tkLocked(o.id));
  if (!unsent.length) return `<span class="hint">✓ Tracking sent to everyone in this list.</span>`;
  if (!free.length) return `<span class="hint">WhatsApp Auto is sending the tracking…</span>`;
  return waAnchor(free[0], "btn primary", `${WA_ICON} Send to next: ${esc(free[0].name)} (${free.length} left)`, "track");
}
function tkSync() { // small in-place updates only: lock buttons, status lines and "Send to next". Never a redraw, so typed AWB numbers stay.
  document.querySelectorAll("a[data-wa]").forEach(a => {
    const o = orders[a.dataset.wa]; if (!o) return;
    const lk = (a.dataset.kind === "track" || (a.dataset.kind !== "confirm" && !!o.awb)) && tkLocked(o.id);
    a.classList.toggle("locked", lk); if (lk) a.setAttribute("aria-disabled", "true"); else a.removeAttribute("aria-disabled");
  });
  document.querySelectorAll("[data-tkst]").forEach(el => { const o = orders[el.dataset.tkst]; if (o) { const t = tkText(o, el.dataset.def); if (el.textContent !== t) el.textContent = t; } });
  const nx = document.querySelector("[data-tknext]"); if (nx) nx.innerHTML = dispNext(dispLists().done);
}
function tkRefresh() { tkSync(); if (!(ui.tkAuto && ui.tkPhase === "wait")) renderTk(); } // (not while counting down: the Stop button is never rebuilt under a finger)

function startTrack(ids, wait) { // wait = a few seconds to press Stop first (used right after saving)
  ids.forEach(id => tkHold.delete(id));
  if (tkRunning) { ids.forEach(id => { if ((ui.tkSt || {})[id] === "fail") tkRetry.add(id); }); tkQueue = [...new Set([...tkQueue, ...ids])]; renderTk(); tkSync(); return; } // sending right now: these go next
  const keep = ui.tkAuto && ui.tkPhase === "wait" ? (ui.tk || []) : []; // a second save during the countdown joins the same round
  clearInterval(tkTimer); clearTimeout(tkClose);
  ui.tk = [...new Set([...keep, ...ids])].filter(id => needsTrack(orders[id])); ui.tkAuto = true; ui.tkSt = {}; ui.tkErr = {}; ui.tkNote = "";
  if (!ui.tk.length) { renderTk(); tkSync(); return; }
  if (!wait || !tkCount()) { runTrack(ui.tk.slice()); return; }
  ui.tkPhase = "wait"; ui.tkLeft = 8; renderTk(); tkSync();
  tkTimer = setInterval(() => {
    ui.tkLeft--;
    if (ui.tkLeft <= 0) { clearInterval(tkTimer); runTrack(ui.tk.slice()); return; }
    const h = document.querySelector("#tkbar h2"); if (h) h.textContent = tkWaitHead(); // only the number changes, so the Stop button is never rebuilt under a finger
  }, 1000);
}
async function runTrack(ids) {
  if (tkRunning) return; tkRunning = true;
  ui.tkPhase = "run"; ui.tkLeft = 0; renderTk(); tkSync();
  let stopAll = "";
  try {
    for (const id of ids) {
      const o = orders[id]; if (!o || !needsTrack(o)) continue; // sent by hand, skipped, deleted or its tracking number removed meanwhile
      if (o.trackingTry) { ui.tkSt[id] = "unsure"; continue; } // an earlier try may have gone through: that one is left to the owner
      if (stopAll) { ui.tkSt[id] = "fail"; ui.tkErr[id] = stopAll; continue; }
      ui.tkSt[id] = "sending"; renderTk(); tkSync();
      const parts = trackParts(o), sig = trackSig(o); // read right now, so a number corrected during the countdown is the one sent
      patch(id, { trackingTry: new Date().toISOString() }); // written BEFORE sending: a closed tab or a lost reply can then never lead to a second automatic message
      let j, down = false;
      try { j = await callWa({ to: phone10(o.phone), ...parts }, 20000); }
      catch (e) { down = true; j = { ok: false, unsure: !!e.unsure, error: e.message || "Could not reach your site." }; }
      if (j.ok) {
        patch(id, { trackingSentAt: new Date().toISOString(), trackingVia: waViaTag(), trackingMsgId: j.id || "", trackingTry: "", trackingSentSig: sig }); ui.tkSt[id] = "ok";
        if (orders[id] && trackSig(orders[id]) !== sig) toast(`Tracking changed while sending. ${(o.name || "").split(" ")[0]} got the old one. Tap Send on WhatsApp to send the new one.`);
      }
      else {
        ui.tkSt[id] = j.unsure ? "unsure" : "fail"; ui.tkErr[id] = j.error || "Not sent.";
        if (!j.unsure) patch(id, { trackingTry: "" }); // a clear "no": safe to try this one again later
        if (j.fatal || j.setup || j.unsure || down) { // the same trouble would hit everyone: don't keep trying the rest
          stopAll = j.fatal || j.setup || (down && !j.unsure) ? ui.tkErr[id] : down ? "Your site is not answering, so this one was not tried." : waWho() + " is not answering, so this one was not tried.";
          if (!j.tpl && !TEMPLATE_CODES.includes(Number(j.code))) waChk = { at: Date.now(), ok: false, track: waChk.track, via: waChk.via, msg: stopAll };
        }
      }
      renderTk(); tkSync();
    }
  } catch (e) { /* never leave the box stuck */ }
  finally { tkRunning = false; ui.tkPhase = "done"; }
  renderTk();
  const q = tkQueue.filter(id => (!ids.includes(id) || tkRetry.has(id)) && needsTrack(orders[id])); tkQueue = []; tkRetry.clear(); tkSync();
  if (!q.length && ids.every(id => !orders[id] || orders[id].trackingSentAt)) { clearTimeout(tkClose); tkClose = setTimeout(() => { if (ui.tkPhase === "done" && !tkRunning) { ui.tk = []; renderTk(); } }, 9000); }
  if (route() === "dashboard") vDashboard();
  if (q.length) startTrack(q, true); // saved while this round was sending
}
function showManualTrack(ids, note) { // the one-tap way (used when automatic sending is off, not connected yet, was stopped, or the Today button is pressed)
  if (tkRunning) return; // a round is sending right now; these stay on Today under "Send tracking to N"
  const keep = ui.tkAuto && ui.tkPhase === "wait" ? (ui.tk || []) : [];
  clearInterval(tkTimer);
  ui.tk = [...new Set([...keep, ...ids])]; ui.tkAuto = false; ui.tkPhase = ""; ui.tkNote = note || ""; ui.tkSt = {}; ui.tkErr = {};
  renderTk(); tkSync();
}
async function offerTrack(ids) { // called right after tracking numbers are saved
  const add = [...new Set(ids)].filter(id => needsTrack(orders[id])); if (!add.length) return;
  if (!autoTrackOn()) return; // switched off, or no online storage: the hand-send buttons are right there
  add.forEach(id => tkHold.add(id)); tkSync();
  setTimeout(() => { let any = false; add.forEach(id => { if (tkHold.delete(id)) any = true; }); if (any) tkSync(); }, 12000); // never leave a button locked if the answer is lost
  let ready = false;
  try { ready = await waReady(); } catch (e) { ready = false; }
  if (ready && waChk.track) { startTrack(add, true); return; }
  add.forEach(id => tkHold.delete(id)); tkSync();
  toast(ready ? "Tracking by itself needs the newest api/wa.js on your site (see the setup steps). Tap Send on WhatsApp for now." // connected, but the site has the older file
    : "WhatsApp Auto is not connected right now, so nothing was sent by itself. Tap Send on WhatsApp for this one.");
}
async function tellTrackDue(ids) { // the "Send tracking to N" button on Today
  try { await Promise.race([syncNow(true), new Promise(r => setTimeout(r, 4000))]); } catch (e) { /* offline: go on with what this device knows */ } // another phone may have told them already
  ids = ids.filter(id => needsTrack(orders[id])); if (!ids.length) { if (route() === "dashboard") vDashboard(); return; }
  if (autoTrackOn() && (await waReady()) && waChk.track) { startTrack(ids, false); return; }
  showManualTrack(ids, settings.autoTrack === false ? "" : !online() ? "Automatic sending works from your own site (see Settings → Automatic WhatsApp)." : waChk.ok && !waChk.track ? "Tracking by itself needs the newest api/wa.js on your site." : "Automatic WhatsApp is not connected" + waTo() + " yet.");
}
function tkRow(o) {
  const st = (ui.tkSt || {})[o.id], err = (ui.tkErr || {})[o.id], sent = !!o.trackingSentAt, skipped = !sent && !!o.trackingSkip;
  const unsure = !sent && !skipped && (st === "unsure" || (!st && !!o.trackingTry));
  const queued = ui.tkAuto && !sent && !skipped && !unsure && (ui.tkPhase === "wait" || (ui.tkPhase === "run" && !st));
  const act = sent ? `<span class="tag t-upi">Sent ✓</span>` : skipped ? `<span class="tag t-upi">Skipped</span>`
    : st === "sending" ? `<span class="wait">Sending…</span>`
    : queued ? `<span class="wait">Waiting…</span>`
    : `<button type="button" class="btn sm ghost" data-tkskip="${esc(o.id)}">Skip</button>${waAnchor(o, "btn sm", `${WA_ICON} WhatsApp`, "track")}`;
  const note = sent || skipped ? "" : unsure ? `<span class="err">Not sure: ${esc(err || "an earlier try may have gone through, so it is not sent again by itself.")}</span>` : err ? `<span class="err">Not sent: ${esc(err)}</span>` : "";
  return `<li class="nt-row${sent || skipped ? " done" : ""}"><div style="min-width:0"><b>${esc(o.name)}</b><span class="meta">${esc(o.courier || "Courier")} <span class="mono">${esc(o.awb)}</span> · <span class="mono">${esc(fmtPhone(o.phone))}</span></span>${note}</div>
    <div class="nt-act">${act}</div></li>`;
}
function renderTk() {
  const el = $("#tkbar"); if (!el) return;
  const list = (ui.tk || []).map(id => orders[id]).filter(o => o && (o.trackingSentAt || o.trackingSkip || needsTrack(o)));
  if (!list.length) { el.hidden = true; el.innerHTML = ""; return; }
  const gone = o => !!o.trackingSentAt || !!o.trackingSkip;
  const todo = list.filter(o => !gone(o)), next = todo[0], n = list.length, sent = list.filter(o => o.trackingSentAt).length, s = k => k === 1 ? "" : "s";
  const stOf = o => (ui.tkSt || {})[o.id], nUnsure = todo.filter(o => stOf(o) === "unsure" || (!stOf(o) && o.trackingTry)).length, nFail = todo.length - nUnsure;
  let head, hint = "", main = "";
  if (ui.tkAuto && ui.tkPhase === "wait") {
    head = tkWaitHead();
    hint = "Sent by itself through WhatsApp Business. Press Stop if you typed a wrong tracking number.";
    main = `<button type="button" class="btn hi sendbtn" data-tkstop>Stop, don't send</button>`;
  } else if (ui.tkAuto && ui.tkPhase === "run") {
    head = `Sending WhatsApp… ${sent} of ${n}`; hint = "Please keep this page open." + (tkQueue.length ? ` ${tkQueue.length} more will go after this.` : "");
  } else if (ui.tkAuto) {
    head = todo.length ? [`${sent} sent`, nFail ? `${nFail} not sent` : "", nUnsure ? `${nUnsure} not sure` : ""].filter(Boolean).join(", ") : (sent ? `✓ Tracking sent to ${sent} customer${s(sent)}` : "Nothing more to send");
    hint = todo.length ? "For these, tap WhatsApp to send by hand." + (nUnsure ? " “Not sure” means " + waWho() + " did not answer in time. It may have gone through, so only send by hand if the customer says it did not arrive." : "") : "";
  } else {
    head = "Send the tracking number to your customers";
    hint = (ui.tkNote ? ui.tkNote + " " : "") + "One tap opens WhatsApp with the tracking message already typed. Just press Send there.";
    main = next ? waAnchor(next, "btn hi sendbtn", `${WA_ICON} Send to next: ${esc(next.name)} (${todo.length} left)`, "track") : `<p class="nt-info" style="color:var(--ok)">✓ All customers told.</p>`;
  }
  const closeBtn = ui.tkAuto && ui.tkPhase === "run" ? "" : `<button type="button" class="btn sm ghost" data-tkclose>${ui.tkAuto && ui.tkPhase === "wait" ? "Cancel" : "Close"}</button>`;
  el.hidden = false;
  el.innerHTML = `<div class="nt-head"><div><h2>${head}</h2>${hint ? `<p class="hint" style="margin:3px 0 0">${esc(hint)}</p>` : ""}</div>${closeBtn}</div>
    ${main}<ul class="nt-list">${list.map(tkRow).join("")}</ul>`;
}
document.addEventListener("click", e => {
  const s = e.target.closest("[data-tkskip]");
  if (s) { patch(s.dataset.tkskip, { trackingSkip: true, trackingTry: "" }); tkRefresh(); if (route() === "dashboard") vDashboard(); return; }
  if (e.target.closest("[data-tkstop]")) { clearInterval(tkTimer); ui.tkAuto = false; ui.tkPhase = ""; ui.tkNote = "Stopped. Nothing was sent."; renderTk(); tkSync(); return; }
  if (e.target.closest("[data-tkclose]")) { if (ui.tkAuto && ui.tkPhase === "wait") { clearInterval(tkTimer); ui.tkAuto = false; ui.tkPhase = ""; toast("Cancelled. Nothing was sent."); } ui.tk = []; renderTk(); tkSync(); return; }
  if (e.target.closest("#tkbar a[data-wa]")) setTimeout(tkRefresh, 450); // after the hand-send handler has marked it sent
});

/* ------------------------------------------------------------------ refill reminders */
function productDays(o) {
  // a product can have its own "lasts (days)"; otherwise the default from Settings (30)
  const b = brandById(o.brand); const def = Number(settings.refillDays) || 30;
  const ds = (o.items || []).map(i => { const p = b.products.find(x => x.id === i.pid || x.name === i.name); return Number(p && p.lasts) || def; });
  return ds.length ? Math.min(...ds) : def;
}
function receivedOn(o) {
  const base = o.shippedAt ? new Date(o.shippedAt) : new Date(o.createdAt);
  return new Date(base.getTime() + 5 * 864e5); // usual delivery time
}
function refillDue() {
  const now = Date.now(); const byPhone = {};
  live().filter(inBrand).forEach(o => { const k = phone10(o.phone); if (!byPhone[k] || o.createdAt > byPhone[k].createdAt) byPhone[k] = o; });
  return Object.values(byPhone).filter(o => {
    if (!ONROAD.includes(o.status)) return false;
    if (o.refillSkipUntil && o.refillSkipUntil > today()) return false;
    if (o.refillSentAt && now - new Date(o.refillSentAt) < 14 * 864e5) return false;
    return now - receivedOn(o) >= productDays(o) * 864e5;
  }).map(o => ({ o, days: Math.round((now - receivedOn(o)) / 864e5) })).sort((a, b) => b.days - a.days);
}
function refillMessage(o, days) {
  const first = (o.name || "").split(" ")[0]; const p = prodPhrase(o); const w = Math.max(1, Math.round(days / 7));
  return [`Hi ${first} 🌸`, "",
    `It's been about ${w} week${w > 1 ? "s" : ""} since your *${p}* reached you. By now your jar may be running low.`, "",
    `Order a fresh one here in 1 minute: ✨`, ORDER_LINK() + "?b=" + encodeURIComponent(o.brand), "",
    `_"${quoteFor({ id: o.id + "r" })}"_`, "", signoff()].join("\n");
}
function refillCard(list) {
  if (!list.length) return `<p class="hint">No refills due right now. Customers appear here about ${Number(settings.refillDays) || 30} days after their order arrives.</p>`;
  return `<ul class="lc">${list.slice(0, 15).map(({ o, days }) => { const b = brandById(o.brand);
    const ini = (o.name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    const href = phone10(o.phone).length === 10 ? waLink(o.phone, refillMessage(o, days)) : "";
    return `<li><span class="av" style="background:${b.color}">${esc(ini)}</span>
      <a class="lc-main" href="#orders?${encodeURIComponent(o.id)}"><b>${esc(o.name)}</b><span>${esc(prodPhrase(o))}</span></a>
      <span class="lc-meta"><span class="mono">${esc(fmtPhone(o.phone))}</span><small>Received ~${days} days ago</small></span>
      <span class="lc-tags"><button type="button" class="btn sm ghost" data-skip="${esc(o.id)}">Skip 2 weeks</button></span>
      ${href ? `<a class="wabtn" href="${esc(href)}" target="_blank" rel="noopener" data-refill="${esc(o.id)}" aria-label="Send refill reminder to ${esc(o.name)}" title="Refill reminder · ${esc(fmtPhone(o.phone))}">${WA_ICON}</a>` : `<span></span>`}</li>`; }).join("")}</ul>`;
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-refill]"); if (a) { const id = a.dataset.refill; setTimeout(() => { patch(id, { refillSentAt: new Date().toISOString() }); toast("Refill reminder sent ✓"); if (route() === "dashboard") vDashboard(); }, 400); return; }
  const s2 = e.target.closest("[data-skip]"); if (s2) { const d = new Date(Date.now() + 14 * 864e5); patch(s2.dataset.skip, { refillSkipUntil: localISO(d) }); toast("Skipped for 2 weeks"); vDashboard(); }
});

/* ------------------------------------------------------------------ customer address form */
const ORDER_LINK = () => location.origin + "/form/";
function b64url(obj) { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function formLink(o) {
  const b = o.b ? brandById(o.b) : null; const ref = {};
  if (b) { ref.b = b.id; ref.bn = b.name; ref.w = phone10(b.from && b.from.phone); }
  if (o.i && o.i.length) { ref.i = o.i; ref.t = o.t || 0; }
  if (o.p) ref.p = o.p; if (o.ph) ref.ph = o.ph; if (o.n) ref.n = o.n;
  if (!ref.i && !ref.p && !ref.ph && !ref.n) return location.origin + "/form/" + (b ? "?b=" + encodeURIComponent(b.id) : ""); // short link: customer picks products
  return location.origin + "/form/" + "?o=" + b64url(ref);
}
function copyText(t, msg) {
  const ok = () => toast(msg || "Copied");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, () => prompt("Copy this link:", t)); else prompt("Copy this link:", t);
}
function inboxList() {
  return `<ul class="lc">${inbox.map(f => { const ini = (f.name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    const what = f.ref && f.ref.i && f.ref.i.length ? f.ref.i.map(x => x[2] + " x " + x[1]).join(", ") : (f.wish || "Products not chosen yet");
    return `<li><span class="av" style="background:var(--ink)">${esc(ini)}</span>
      <div class="lc-main"><b>${esc(f.name)}</b><span>${esc(what)}</span></div>
      <span class="lc-meta"><span class="mono">${esc(fmtPhone(f.phone))}</span><small>${esc(f.city || "")} ${esc(f.pin)} · ${ago(f.receivedAt)}</small></span>
      <span class="lc-tags"><span class="tag t-upi">Prepaid</span>${f.loc ? ` <span class="tag t-transit">📍 Location</span>` : ""}<button type="button" class="btn sm ghost" data-ibdel="${esc(f.id)}">Delete</button></span>
      <button type="button" class="btn sm hi" data-ibuse="${esc(f.id)}">Create order</button></li>`; }).join("")}</ul>`;
}
function inboxToPrefill(f) {
  const bid = f.ref && f.ref.b && settings.brands.some(b => b.id === f.ref.b) ? f.ref.b : (device.brand !== "all" ? device.brand : settings.brands[0].id);
  const b = brandById(bid);
  const items = ((f.ref && f.ref.i) || []).map(x => { const p = b.products.find(pp => pp.id === x[0]) || b.products.find(pp => pp.name === x[1]); return p ? { pid: p.id, name: p.name, price: p.price, qty: x[2] } : null; }).filter(Boolean);
  const notes = [f.note, f.wish ? "Wants: " + f.wish : "", f.loc ? "Location: https://maps.google.com/?q=" + f.loc : ""].filter(Boolean).join(" · ");
  return { brand: bid, name: f.name, phone: f.phone, alt: f.alt, address: [f.house, f.area].filter(Boolean).join(", "), landmark: f.landmark, pin: f.pin, city: f.city, state: f.state,
    items, pay: "upi", notes, disc: 0, ship: 0, code: "", utr: f.utr || "", courier: "" };
}
/* Form orders go straight into Orders (no tap needed). The order number is made from the form entry,
   so two phones syncing at the same moment can never create the same order twice. */
async function autoImport() {
  let made = 0; const names = [];
  for (const f of [...inbox]) {
    const p = inboxToPrefill(f); // every form order goes straight in, so its label is ready; if no product came through, it's flagged in the notes
    if (!p.items.length) p.notes = ["⚠ Product not chosen on the form — please check with the customer", p.notes].filter(Boolean).join(" · ");
    const b = brandById(p.brand); const at = f.receivedAt || new Date().toISOString();
    const id = (b.prefix || "OD").toUpperCase() + localISO(new Date(at)).replace(/-/g, "").slice(2) + "F" + f.id.slice(-4);
    if (!orders[id]) {
      const sub = p.items.reduce((a, i) => a + i.price * i.qty, 0);
      orders[id] = { ...p, id, sub, disc: 0, ship: 0, total: sub, paid: false, courier: "", service: "", weight: 0, awb: "", status: "new", source: "form",
        createdAt: at, date: localISO(new Date(at)), history: [{ s: "new", at }], updatedAt: new Date().toISOString() };
      saveOrders(); markDirty(id); made++; names.push(p.name);
    }
    await inboxDone(f.id);
  }
  if (made) { if (device.sheetUrl) try { await post({ orders: made ? Object.values(orders).filter(o => device.dirty.includes(o.id)) : [] }); device.dirty = []; saveDevice(); } catch (e) {} toast(`📬 ${made} new order${made > 1 ? "s" : ""} from the form: ${names.join(", ")}`); }
  return made;
}
async function inboxDone(id) {
  inbox = inbox.filter(x => x.id !== id); persist(K.inbox, inbox);
  if (device.sheetUrl) { try { await post({ inboxDone: [id] }); } catch (e) { toast("Couldn't update online storage. It will retry on the next sync."); } }
}
document.addEventListener("click", e => {
  const u = e.target.closest("[data-ibuse]"); if (u) { const f = inbox.find(x => x.id === u.dataset.ibuse); if (!f) return; const p = inboxToPrefill(f); ui.editing = null; ui.formBrand = p.brand; ui.prefill = p; ui.fromInbox = f.id; location.hash = "#new"; return; }
  const d = e.target.closest("[data-ibdel]"); if (d) { if (d.dataset.c) { inboxDone(d.dataset.ibdel).then(() => { toast("Deleted"); vDashboard(); }); } else { d.dataset.c = 1; d.textContent = "Tap again"; setTimeout(() => { if (d.isConnected) { delete d.dataset.c; d.textContent = "Delete"; } }, 4000); } }
});

/* ------------------------------------------------------------------ courier ticks */
function courierTicks(name, current, inCard) {
  return `<div class="paytick sm" data-cour="${esc(name)}" role="group" aria-label="Courier">${COURIERS.map(c => `<label class="pt${current === c ? " on" : ""}"><input type="checkbox" name="${esc(name)}" value="${esc(c)}" ${inCard ? 'data-a="courier"' : ""} ${current === c ? "checked" : ""}><span class="box" aria-hidden="true"></span><span><b>${esc(c)}</b></span></label>`).join("")}</div>`;
}
function tickedCourier(name) { const x = document.querySelector(`[data-cour="${name}"] input:checked`); return x ? x.value : ""; }
function setCourierTick(name, v) { document.querySelectorAll(`[data-cour="${name}"] input`).forEach(i => { i.checked = i.value === v; i.closest(".pt").classList.toggle("on", i.checked); }); }
// only one courier can be ticked; tapping the ticked one clears it
document.addEventListener("change", e => { const g = e.target.closest("[data-cour]"); if (!g || e.target.type !== "checkbox") return;
  g.querySelectorAll("input").forEach(i => { if (i !== e.target) i.checked = false; i.closest(".pt").classList.toggle("on", i.checked); }); }, true);

/* ------------------------------------------------------------------ router */
const routes = { dashboard: vDashboard, new: vNew, orders: vOrders, dispatch: vDispatch, scan: vScan, customers: vCustomers, reports: vReports, settings: vSettings };
function route() { return (location.hash || "#dashboard").slice(1).split("?")[0]; }
/* iPhone app: "More" sheet and sign out */
function closeSheet() { const sh = $("#moreSheet"), bg = $("#sheetBg"), mb = $("#moreBtn"); if (sh) sh.hidden = true; if (bg) bg.hidden = true; if (mb) mb.setAttribute("aria-expanded", "false"); }
document.addEventListener("click", e => {
  if (e.target.closest("#moreBtn")) { const sh = $("#moreSheet"); const open = sh.hidden; sh.hidden = !open; $("#sheetBg").hidden = !open; $("#moreBtn").setAttribute("aria-expanded", String(open)); return; }
  if (e.target.closest("#sheetBg") || e.target.closest("#moreSheet a")) closeSheet();
  if (e.target.closest("#logoutBtn")) { if (!confirm("Sign out of Order Desk on this device?")) return; fetch("/api/logout", { method: "POST", credentials: "same-origin" }).finally(() => { location.replace("/login/"); }); }
});
function render() {
  const r = routes[route()] ? route() : "dashboard";
  document.querySelectorAll("#nav a, #tabbar a, #moreSheet a").forEach(a => { if (a.dataset.r === r) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  const mb = $("#moreBtn"); if (mb) { if (["scan", "customers", "reports", "settings"].includes(r)) mb.setAttribute("aria-current", "page"); else mb.removeAttribute("aria-current"); }
  closeSheet();
  renderBrandPick();
  if (r !== "scan") stopCam();
  routes[r]();
}
window.addEventListener("hashchange", () => { render(); $("#view").focus({ preventScroll: true }); window.scrollTo(0, 0); });
function renderBrandPick() {
  const s = $("#brandsel");
  s.innerHTML = `<option value="all">All brands</option>` + settings.brands.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("");
  s.value = device.brand; const b = device.brand === "all" ? null : brandById(device.brand);
  $("#branddot").style.background = b ? b.color : "#FFD43B";
  document.documentElement.style.setProperty("--brand", b ? b.color : "#121214");
}
$("#brandsel").addEventListener("change", e => { device.brand = e.target.value; saveDevice(); ui.formBrand = null; render(); });
$("#syncbtn").addEventListener("click", () => syncNow(false));
/* Refresh: get the newest orders, then reload so the app also picks up any update. Button at the top, or pull down on any page. */
let refreshing = false;
async function doRefresh() {
  if (refreshing) return; refreshing = true;
  document.body.classList.add("refreshing"); const p = $("#ptr"); if (p) { p.style.transform = ""; p.classList.add("on"); }
  try { if (device.sheetUrl) { let n = 0; while (syncing && n++ < 40) await new Promise(r => setTimeout(r, 250)); await syncNow(true); } } catch (e) {}
  location.reload();
}
$("#refreshbtn").addEventListener("click", doRefresh);
(function pullToRefresh() {
  const p = $("#ptr"); let y0 = null, dy = 0; const MAX = 90, GO = 70;
  const can = e => window.scrollY <= 0 && !refreshing && $("#moreSheet").hidden && !e.target.closest("input,textarea,select,video,.ord-scroll");
  document.addEventListener("touchstart", e => { y0 = can(e) && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  document.addEventListener("touchmove", e => { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy <= 0 || window.scrollY > 0) { p.classList.remove("show"); return; }
    const d = Math.min(MAX, dy * 0.5); p.classList.add("show"); p.classList.toggle("ready", d >= GO); p.style.transform = `translate(-50%, ${d}px) rotate(${d * 4}deg)`; }, { passive: true });
  document.addEventListener("touchend", () => { if (y0 === null) return; const go = p.classList.contains("ready"); y0 = null; p.classList.remove("ready");
    if (go) doRefresh(); else { p.classList.remove("show"); p.style.transform = ""; } }, { passive: true });
})();

/* ------------------------------------------------------------------ views */
/* Courier pickup closes at 6 pm. An order added before 6 pm must be dispatched the same day;
   an order added after 6 pm must be dispatched by 6 pm the next day. After that deadline it shows in red. */
const CUTOFF_HOUR = 18;
function dueTime(o) {
  const c = o.createdAt ? new Date(o.createdAt) : new Date((o.date || today()) + "T09:00:00");
  const d = new Date(c); d.setHours(CUTOFF_HOUR, 0, 0, 0);
  if (c >= d) d.setDate(d.getDate() + 1);
  return d;
}
function daysLate(o) { // 0 = not late; 1 = missed today's pickup; 2+ = days overdue
  if (!TOSHIP.includes(o.status)) return 0; const due = dueTime(o); const now = new Date();
  if (now < due) return 0; return 1 + Math.floor((now - due) / 864e5);
}
const lateText = n => n <= 1 ? "Missed pickup" : `${n - 1} day${n - 1 > 1 ? "s" : ""} late`;
function lateBox(list) {
  if (!list.length) return "";
  return `<section class="card late" role="alert" aria-labelledby="h-late"><div class="late-head"><div><h2 id="h-late">⚠ Dispatch now · ${list.length} order${list.length > 1 ? "s" : ""} not dispatched</h2><p>Not dispatched before the 6 pm courier pickup. Please ship ${list.length > 1 ? "these" : "this"} first thing.</p></div><a class="btn" href="#dispatch">Go to Dispatch</a></div>
  <ul class="late-list">${list.map(o => `<li><b>${esc(o.name)}</b><span>${esc(itemsText(o))}</span><span class="mono">${esc(o.id)}</span><span class="late-tag">${lateText(daysLate(o))}</span><a class="btn sm" href="#orders?${encodeURIComponent(o.id)}">Add tracking</a></li>`).join("")}</ul></section>`;
}
function vDashboard() {
  const L = live().filter(inBrand); const t = today();
  const tod = L.filter(o => o.date === t && o.status !== "cancelled");
  const toShip = L.filter(o => ["new", "paid", "packed"].includes(o.status));
  const unpaid = L.filter(o => o.pay === "upi" && !o.paid && o.status !== "cancelled");
  const wk = localISO(new Date(Date.now() - 6 * 864e5)); const onRoad = L.filter(o => ONROAD.includes(o.status) && o.shippedAt && o.shippedAt.slice(0, 10) >= wk);
  const unprinted = toShip.filter(o => !o.printedAt);
  const printedWaiting = toShip.filter(o => o.printedAt).sort((x, y) => (y.createdAt || "").localeCompare(x.createdAt || ""));
  const brandName = device.brand === "all" ? "All brands" : brandById(device.brand).name;
  const refills = refillDue(); const due = readyDue(); const tdue = trackDue();
  $("#view").innerHTML = `
  <div class="head"><div><h1>Today · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</h1><p class="sub">${esc(brandName)}</p></div>
    <div class="actions"><a class="btn hi" href="#new">+ New order</a>${unprinted.length ? `<button class="btn primary" id="printall">Print ${unprinted.length} new label${unprinted.length > 1 ? "s" : ""}</button>` : ""}${unprinted.length ? `<button class="btn" id="dlall" type="button" title="One PDF with only the ${unprinted.length} new label(s) not yet printed or downloaded">⬇ PDF · ${unprinted.length} new label${unprinted.length > 1 ? "s" : ""}</button><button class="btn" id="shareall" type="button" title="Share one PDF with the new labels">↗ Share PDF</button>` : ""}${due.length ? `<button class="btn" id="ntopen" type="button" title="WhatsApp: your order is getting ready">${WA_ICON} Tell ${due.length} customer${due.length > 1 ? "s" : ""}</button>` : ""}${tdue.length ? `<button class="btn" id="tkopen" type="button" title="WhatsApp: your order is on the way (tracking number)">${WA_ICON} Send tracking to ${tdue.length}</button>` : ""}</div></div>
  <div id="pushbanner"></div>
  ${printedWaiting.length ? `<section class="card reprint" aria-labelledby="h-reprint"><div class="reprint-head"><div><h2 id="h-reprint">Label already printed · not dispatched yet (${printedWaiting.length})</h2><p class="hint">These are not in the PDF above. Tap ＋ to put one back, or add them all.</p></div>${printedWaiting.length > 1 ? `<button class="btn sm" type="button" id="reprintall">Add all ${printedWaiting.length} back</button>` : ""}</div>
    <ul class="reprint-list">${printedWaiting.map(o => `<li><b>${esc(o.name)}</b><span>${esc(itemsText(o))}</span><button class="btn sm hi" type="button" data-reprint="${esc(o.id)}" aria-label="Add ${esc(o.name)} back to the PDF">＋ Add back</button></li>`).join("")}</ul></section>` : ""}
  ${lateBox(toShip.filter(o => daysLate(o) > 0).sort((x, y) => daysLate(y) - daysLate(x)))}
  <div class="grid g4">
    <div class="kpi"><span>Orders today</span><b>${tod.length}</b><small>${tod.reduce((a, o) => a + pcs(o), 0)} pcs</small></div>
    <div class="kpi ${toShip.length ? "hot" : ""}"><span>To pack &amp; ship</span><b>${toShip.length}</b><small>${unprinted.length} new label${unprinted.length === 1 ? "" : "s"} to print</small></div>
    <div class="kpi"><span>Waiting for UPI</span><b>${unpaid.length}</b><small>payment not received</small></div>
    <div class="kpi"><span>Dispatched</span><b>${onRoad.length}</b><small>in the last 7 days</small></div>
  </div>
  <section class="card olink" style="margin-top:14px"><div><span class="lbl">Your order form link · same for every customer</span><div class="olink-url mono">${esc(ORDER_LINK())}</div><p class="hint" style="margin:4px 0 0">Prepaid orders only. Customers choose products and fill their address; the order is added here automatically.</p></div>
    <div class="actions"><button class="btn primary" id="formcopy" type="button">Copy link</button><a class="btn" href="${esc("https://wa.me/?text=" + encodeURIComponent("🛍️ Order here: choose your products and fill your delivery address (takes 1 minute):\n" + ORDER_LINK()))}" target="_blank" rel="noopener">${WA_ICON} Share on WhatsApp</a></div></section>
  ${inbox.length ? `<section class="card latest inbox" style="margin-top:14px" aria-labelledby="h-inbox">
    <div class="head" style="margin:0 0 6px"><div><h2 id="h-inbox">From the address form <span class="tag t-ofd">${inbox.length} new</span></h2><p class="hint" style="margin:2px 0 0">${settings.autoForm !== false ? "These need a quick look (no products or payment chosen), so they weren't added automatically." : "Customers filled these in themselves. Check, then create the order."}</p></div></div>
    ${inboxList()}
  </section>` : ""}
  <section class="card latest" style="margin-top:14px" aria-labelledby="h-latest">
    <div class="head" style="margin:0 0 6px"><h2 id="h-latest">Latest customers</h2><a class="btn sm" href="#orders">See all</a></div>
    ${latestList(L.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10))}
  </section>
  <div class="grid g2" style="margin-top:14px">
    <div class="card stack"><div class="head" style="margin:0"><h2>Pack next</h2><a class="btn sm" href="#orders">All orders</a></div>${miniList(toShip.slice(0, 8), "Nothing to pack. New orders appear here.")}</div>
    <div class="card stack"><div class="head" style="margin:0"><h2>Needs a nudge</h2></div>${miniList(unpaid.slice(0, 8), "No unpaid UPI orders.")}</div>
  </div>
  <section class="card latest refill" style="margin-top:14px" aria-labelledby="h-refill">
    <div class="head" style="margin:0 0 6px"><div><h2 id="h-refill">Refill reminders ${refills.length ? `<span class="tag t-ofd">${refills.length} due</span>` : ""}</h2><p class="hint" style="margin:2px 0 0">Customers whose cream is likely running low. One tap opens their WhatsApp with a friendly reminder.</p></div></div>
    ${refillCard(refills)}
  </section>
  ${device.sheetUrl ? "" : `<div class="card" style="margin-top:14px;border-color:var(--hi);border-width:2px"><h2>Turn on online storage</h2><p class="hint" style="margin:6px 0 10px">Right now orders are saved only in this browser. Connect online storage so they're safe and shared between your phone and laptop.</p><a class="btn" href="#settings">Connect now</a></div>`}`;
  const pa = $("#printall"); if (pa) pa.onclick = () => printDocs(unprinted, "label", true);
  const dla = $("#dlall"); if (dla) dla.onclick = () => downloadLabels(unprinted);
  refreshPushUI();
  const rpa = $("#reprintall"); if (rpa) rpa.onclick = () => { printedWaiting.forEach(o => patch(o.id, { printedAt: "" })); toast(`${printedWaiting.length} labels added back to the PDF`); vDashboard(); };
  document.querySelectorAll("[data-reprint]").forEach(b => b.onclick = () => { const o = orders[b.dataset.reprint]; if (!o) return; patch(o.id, { printedAt: "" }); toast(o.name.split(" ")[0] + " added back to the PDF"); vDashboard(); });
  const sha2 = $("#shareall"); if (sha2) sha2.onclick = () => shareLabels(unprinted);
  const nto = $("#ntopen"); if (nto) nto.onclick = () => tellDue(due.map(o => o.id));
  const tko = $("#tkopen"); if (tko) tko.onclick = () => tellTrackDue(tdue.map(o => o.id));
  $("#formcopy").onclick = () => copyText(ORDER_LINK(), "Order form link copied ✓");
}
function ago(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 24) return h + " h ago";
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : d + " days ago";
}
function latestList(list) {
  if (!list.length) return `<div class="empty" style="padding:28px"><h2>No customers yet</h2><p>Your newest orders will appear here.</p><a class="btn hi" href="#new">+ New order</a></div>`;
  return `<ul class="lc">${list.map(o => { const b = brandById(o.brand); const st = STATUS.find(s2 => s2[0] === o.status) || STATUS[0];
    const ini = (o.name || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
    const what = o.awb ? "Send tracking" : "Send order confirmation";
    return `<li><span class="av" style="background:${b.color}">${esc(ini)}</span>
      <a class="lc-main" href="#orders?${encodeURIComponent(o.id)}"><b>${esc(o.name)}</b><span>${esc(prodPhrase(o))}</span></a>
      <span class="lc-meta"><span class="mono">${esc(fmtPhone(o.phone))}</span><small>${ago(o.createdAt)}</small></span>
      <span class="lc-tags">${payTag(o)} <span class="tag t-${st[0]}">${st[1]}</span>${o.trackingSentAt ? ` <span class="tag t-upi">Sent ✓</span>` : ""}${o.source === "form" ? ` <span class="tag t-transit">Form</span>` : ""}</span>
      ${waAnchor(o, "wabtn", WA_ICON, o.awb ? "track" : "confirm", `aria-label="${what} to ${esc(o.name)} on WhatsApp" title="${what} · ${esc(fmtPhone(o.phone))}"`)}</li>`; }).join("")}</ul>`;
}
function miniList(list, empty) {
  if (!list.length) return `<p class="hint">${empty}</p>`;
  return `<div class="tbl"><table><tbody>${list.map(o => { const b = brandById(o.brand); return `<tr><td><span class="tag t-brand" style="--bc:${b.color}">${esc(b.prefix)}</span></td><td><b>${esc(o.name)}</b><div class="hint">${esc(o.city)} ${esc(o.pin)}</div></td><td class="n">${payTag(o)}</td><td><a class="btn sm" href="#orders?${encodeURIComponent(o.id)}">Open</a></td></tr>`; }).join("")}</tbody></table></div>`;
}
function payTag(o) { return o.paid ? `<span class="tag t-upi">UPI paid</span>` : `<span class="tag t-unpaid">Prepaid · not received</span>`; }

/* ---- new / edit order ---- */
function vNew() {
  const editing = ui.editing && orders[ui.editing] ? orders[ui.editing] : null;
  const brandId = ui.formBrand || (editing ? editing.brand : (device.brand !== "all" ? device.brand : settings.brands[0].id));
  ui.formBrand = brandId; const b = brandById(brandId);
  $("#view").innerHTML = `
  <div class="head"><div><h1>${editing ? "Edit " + esc(editing.id) : "New order"}</h1><p class="sub">Fill in the customer, choose products, then save and print the label.</p></div></div>
  ${ui.lastSaved && orders[ui.lastSaved] ? readyPanel(orders[ui.lastSaved]) : ""}
  <div class="split">
    <div class="card stack">
      <div class="f"><label for="fb">Brand</label><select id="fb">${settings.brands.map(x => `<option value="${x.id}"${x.id === brandId ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
      <details class="pastebox"><summary>Customer sent details in a WhatsApp chat? <b>Paste it to fill automatically</b> (optional)</summary>
        <div class="f" style="margin-top:10px"><label for="paste">Paste the chat message</label><textarea id="paste" rows="4" placeholder="Paste the customer's message: name, address, pincode, phone, products, payment."></textarea>
        <div class="actions"><button class="btn sm primary" id="fill" type="button">Fill from message</button><span class="hint" id="fillnote"></span></div></div></details>
      <div class="row"><div class="f"><label for="fname">Name</label><input id="fname" autocomplete="off"></div>
        <div class="f"><label for="fphone">Phone</label><input id="fphone" inputmode="tel" autocomplete="off" placeholder="10-digit mobile"></div>
        <div class="f"><label for="falt">Alternate phone</label><input id="falt" inputmode="tel" autocomplete="off"></div></div>
      <div class="f"><label for="faddr">Address (house, street, area)</label><textarea id="faddr" rows="3"></textarea></div>
      <div class="f"><label for="fland">Landmark</label><input id="fland"></div>
      <div class="row"><div class="f"><label for="fpin">Pincode</label><input id="fpin" inputmode="numeric" maxlength="6"></div>
        <div class="f"><label for="fcity">City / district</label><input id="fcity"></div>
        <div class="f"><label for="fstate">State</label><input id="fstate" list="stl"><datalist id="stl">${STATES.map(s => `<option value="${s}">`).join("")}</datalist></div></div>
      <div class="hint" id="pinnote"></div>
      <div class="hint" id="repeat"></div>
    </div>
    <div class="card stack">
      <div class="lbl">Products · ${esc(b.name)}</div>
      <div class="items" id="items">${b.products.length ? "" : `<p class="hint">No products for ${esc(b.name)} yet. Add them in <a href="#settings">Settings</a>.</p>`}</div>
      <div class="lbl">Payment</div>
      <div class="paytick" id="payseg"><div class="pt on"><span class="box" aria-hidden="true"></span><span><b>Prepaid</b><small>Google Pay / UPI · every order</small></span></div></div>
      <div class="row" id="upirow"><div class="f"><label for="futr">UPI ref / UTR</label><input id="futr" inputmode="numeric" autocomplete="off"></div>
        <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="fpaid"> Payment received</label></div>
      <div class="row" hidden><div class="f"><label for="fcode">Coupon</label><input id="fcode" placeholder="e.g. GLOW10"></div>
        <div class="f"><label for="fdisc">Discount ₹</label><input id="fdisc" inputmode="numeric" value="0"></div>
        <div class="f"><label for="fship">Shipping ₹</label><input id="fship" inputmode="numeric" value="0"></div></div>
      <div class="lbl">Courier (shown on the label if ticked)</div>
      ${courierTicks("fcour", "")}
      <div class="row"><div class="f"><label for="fserv">Service</label><select id="fserv">${SERVICES.map(s => `<option value="${s}">${s || "—"}</option>`).join("")}</select></div>
        <div class="f"><label for="fwt">Weight (grams)</label><input id="fwt" inputmode="numeric" placeholder="auto"></div></div>
      <div class="f"><label for="fnotes">Notes</label><input id="fnotes" placeholder="Gift message, delivery time…"></div>
      <div class="sum" id="sum" hidden></div>
      <div class="qrpay" id="qrpay" hidden></div>
      <div class="actions"><button class="btn hi" id="savePrint" type="button">Save &amp; print label</button><button class="btn primary" id="save" type="button">Save</button><button class="btn ghost" id="reset" type="button">Clear</button></div>
      <div class="formsend"><div><b>Don't have the address yet?</b><p class="hint" style="margin:2px 0 0">Send the customer a form link. Their details come back here, ready to save.</p></div><button class="btn" id="sendform" type="button">${WA_ICON} Send address form</button></div>
      ${ui.fromInbox ? `<p class="hint">Filled from the customer's address form. Saving removes it from the inbox.</p>` : ""}
    </div>
  </div>`;
  if (editing) fillForm(editing); else if (ui.prefill) { fillForm(ui.prefill); ui.prefill = null; }
  renderItems(); setPay(ui.pay);
  $("#fb").onchange = e => { ui.formBrand = e.target.value; ui.qty = {}; const keep = readForm(true); vNew(); restoreForm(keep); };
  $("#items").onclick = e => { const x = e.target.closest("[data-k]"); if (!x) return; ui.qty[x.dataset.k] = Math.max(0, (ui.qty[x.dataset.k] || 0) + Number(x.dataset.d)); renderItems(); };
  ["fdisc", "fship", "fcode"].forEach(id => $("#" + id).oninput = renderSum);
  $("#fcode").onchange = () => { const c = $("#fcode").value.trim().toUpperCase(); const m = c.match(/(\d{1,2})$/); if (m && Number($("#fdisc").value) === 0) { $("#fdisc").value = Math.round(subtotal() * Number(m[1]) / 100); renderSum(); } };
  const pn = t => { const n = $("#pinnote"); if (n) n.innerHTML = t; };
  $("#fpin").oninput = async e => { const p = e.target.value.replace(/\D/g, ""); e.target.value = p; if (p.length !== 6) { pn(""); return; }
    pn("Checking pincode…"); const r = await lookupPin(p);
    if (!r) { pn("Couldn't check this pincode (offline?). Enter city and state."); return; }
    if (!r.ok) { pn(`<b style="color:var(--bad)">This pincode doesn't exist.</b> Ask the customer to check it.`); return; }
    if (!$("#fcity")) return; if (!$("#fcity").value) $("#fcity").value = r.city; if (!$("#fstate").value) $("#fstate").value = r.state;
    pn(`✓ ${r.area}, ${r.city}, ${r.state}`); };
  $("#fphone").oninput = repeatCheck;
  $("#fill").onclick = () => {
    const t = $("#paste").value.trim(); if (!t) { $("#fillnote").textContent = "Paste a message first."; return; }
    const r = parseMsg(t, ui.formBrand); const got = [];
    [["name", "fname"], ["phone", "fphone"], ["address", "faddr"], ["landmark", "fland"], ["city", "fcity"], ["state", "fstate"], ["pin", "fpin"], ["utr", "futr"], ["code", "fcode"]].forEach(([k, f]) => { if (r[k]) { $("#" + f).value = r[k]; got.push(k); } });
    if (Object.keys(r.qty).length) { ui.qty = r.qty; renderItems(); got.push("products"); }
    $("#fillnote").textContent = got.length ? "Filled: " + got.join(", ") + ". Check before saving." : "Couldn't read it. Type the details.";
    repeatCheck(); if (r.pin) $("#fpin").dispatchEvent(new Event("input")); if (r.code) $("#fcode").dispatchEvent(new Event("change"));
  };
  $("#sendform").onclick = () => {
    const b = brandById(ui.formBrand); const t = totals();
    const items = b.products.filter(p => ui.qty[p.id] > 0).map(p => [p.id, p.name, ui.qty[p.id], p.price]);
    const ph = phone10($("#fphone").value); const nm = $("#fname").value.trim();
    const link = formLink({ b: b.id, i: items, t: t.total, p: "upi", ph: ph.length === 10 ? ph : "", n: nm });
    if (!device.sheetUrl) toast("Tip: turn on online storage in Settings, or form replies can't reach you.");
    if (ph.length === 10) {
      const prod = items.length ? items.map(x => x[1]).join(" & ") : "order";
      const msg = `Hi${nm ? " " + nm.split(" ")[0] : ""}! 🌸\n\nTo deliver your ${prod} quickly, please fill in your delivery address here. It takes about 30 seconds:\n${link}\n\n${signoff()}`;
      window.open(waLink(ph, msg), "_blank");
    } else copyText(link, "Form link copied. Paste it in the customer's WhatsApp chat.");
  };
  $("#save").onclick = () => saveForm(false);
  $("#savePrint").onclick = () => saveForm(true);
  $("#reset").onclick = () => { ui.editing = null; ui.qty = {}; ui.fromInbox = null; vNew(); };
}
function readyPanel(o) {
  labelBlob(o); // prepare the picture now so Share opens instantly
  return `<section class="card ready"><div class="ready-l"><span class="lbl">✓ Saved · label ready</span><h2>${esc(o.name)} <span class="mono" style="font-size:.9rem;color:var(--muted)">${esc(o.id)}</span></h2>
    <p class="hint">${esc(itemsText(o))} · Prepaid</p>
    <div class="actions"><button type="button" class="btn hi" data-rprint="${esc(o.id)}">🖨 Print</button><button type="button" class="btn" data-png="${esc(o.id)}">⬇ Download</button><button type="button" class="btn primary" data-sharelbl="${esc(o.id)}">↗ Share</button><button type="button" class="btn ghost" data-rclose>Close</button></div></div>
    <div class="preview ready-p">${labelHTML(o)}</div></section>`;
}
document.addEventListener("click", e => { const p = e.target.closest("[data-rprint]"); if (p) { const o = orders[p.dataset.rprint]; if (o) printDocs([o], "label"); }
  if (e.target.closest("[data-rclose]")) { ui.lastSaved = null; const r = document.querySelector(".ready"); if (r) r.remove(); } });
function subtotal() { const b = brandById(ui.formBrand); return b.products.reduce((a, p) => a + (ui.qty[p.id] || 0) * p.price, 0); }
function renderItems() {
  const b = brandById(ui.formBrand); if (!b.products.length) return;
  $("#items").innerHTML = b.products.map(p => { const q = ui.qty[p.id] || 0; return `<div class="item${q ? " on" : ""}"><span>${esc(p.name)}</span><span class="qty"><button type="button" data-k="${p.id}" data-d="-1" aria-label="One less ${esc(p.name)}">−</button><span>${q}</span><button type="button" data-k="${p.id}" data-d="1" aria-label="One more ${esc(p.name)}">+</button></span></div>`; }).join("");
  renderSum();
}
function totals() { const sub = subtotal(); const disc = Math.max(0, Number($("#fdisc").value) || 0); const ship = Math.max(0, Number($("#fship").value) || 0); return { sub, disc, ship, total: Math.max(0, sub - disc + ship) }; }
function renderSum() {
  if (!$("#sum")) return; const t = totals();
  $("#sum").innerHTML = `<span>Subtotal</span><span>${inr(t.sub)}</span><span>Discount</span><span>− ${inr(t.disc)}</span><span>Shipping</span><span>${t.ship ? inr(t.ship) : "Free"}</span><span class="t">Total</span><span class="t">${inr(t.total)}</span>`;
  const b = brandById(ui.formBrand); const u = t.total > 0 ? upiURL(b, t.total, b.name + " order") : "";
  $("#qrpay").innerHTML = u ? `<div class="q">${qrSVG(u, 4)}</div><p class="hint" style="max-width:30ch">UPI QR for ${inr(t.total)} to ${esc(b.upi)}. Screenshot it and send on WhatsApp.</p>` : "";
}
function setPay() { ui.pay = "upi"; renderSum(); } // every order is prepaid
function repeatCheck() {
  const p = phone10($("#fphone").value); const el = $("#repeat"); if (p.length !== 10) { el.innerHTML = ""; return; }
  const prev = live().filter(o => phone10(o.phone) === p && o.id !== ui.editing).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!prev.length) { el.innerHTML = ""; return; }
  const last = prev[0]; const sameDay = prev.some(o => o.date === today());
  el.innerHTML = `${sameDay ? `<b style="color:var(--bad)">Already ordered today (${esc(prev.find(o => o.date === today()).id)}). Check it's not a duplicate.</b><br>` : ""}Returning customer · ${prev.length} order${prev.length > 1 ? "s" : ""} · last ${dmy(last.date)} (${esc(brandById(last.brand).name)}) <button class="btn sm" id="useaddr" type="button">Use saved address</button>`;
  $("#useaddr").onclick = () => { [["fname", "name"], ["faddr", "address"], ["fland", "landmark"], ["fcity", "city"], ["fstate", "state"], ["fpin", "pin"], ["falt", "alt"]].forEach(([f, k]) => { if (!$("#" + f).value) $("#" + f).value = last[k] || ""; }); };
}
function readForm(raw) {
  const v = id => $("#" + id) ? $("#" + id).value.trim() : "";
  const b = brandById(ui.formBrand); const t = totals();
  const items = b.products.filter(p => ui.qty[p.id] > 0).map(p => ({ pid: p.id, name: p.name, price: p.price, qty: ui.qty[p.id], weight: p.weight || 0 }));
  const f = { brand: ui.formBrand, name: v("fname"), phone: phone10(v("fphone")), alt: phone10(v("falt")), address: v("faddr"), landmark: v("fland"), pin: v("fpin"), city: v("fcity"), state: v("fstate"),
    items, sub: t.sub, disc: t.disc, ship: t.ship, total: t.total, code: v("fcode").toUpperCase(), pay: "upi", utr: v("futr"), paid: $("#fpaid").checked,
    courier: tickedCourier("fcour"), service: v("fserv"), weight: Number(v("fwt")) || 0, notes: v("fnotes") };
  if (raw) f.raw = { paste: v("paste") }; return f;
}
function restoreForm(f) { [["fname", "name"], ["fphone", "phone"], ["falt", "alt"], ["faddr", "address"], ["fland", "landmark"], ["fpin", "pin"], ["fcity", "city"], ["fstate", "state"], ["futr", "utr"], ["fnotes", "notes"]].forEach(([id, k]) => { if ($("#" + id)) $("#" + id).value = f[k] || ""; }); if (f.raw) $("#paste").value = f.raw.paste || ""; setPay(f.pay); }
function fillForm(o) {
  ui.qty = {}; (o.items || []).forEach(i => ui.qty[i.pid] = i.qty); ui.pay = "upi";
  [["fname", "name"], ["fphone", "phone"], ["falt", "alt"], ["faddr", "address"], ["fland", "landmark"], ["fpin", "pin"], ["fcity", "city"], ["fstate", "state"], ["futr", "utr"], ["fcode", "code"], ["fdisc", "disc"], ["fship", "ship"], ["fnotes", "notes"]].forEach(([id, k]) => $("#" + id).value = o[k] ?? "");
  setCourierTick("fcour", o.courier || ""); $("#fserv").value = o.service || ""; $("#fwt").value = o.weight || ""; $("#fpaid").checked = !!o.paid;
}
function saveForm(andPrint) {
  const f = readForm(); const miss = [];
  if (!f.name) miss.push("name"); if (f.phone.length !== 10) miss.push("10-digit phone"); if (!f.address) miss.push("address");
  if (!/^[1-9]\d{5}$/.test(f.pin)) miss.push("6-digit pincode"); if (!f.items.length) miss.push("a product");
  if (miss.length) { toast("Missing: " + miss.join(", ")); return; }
  let o;
  if (ui.editing && orders[ui.editing]) o = Object.assign(orders[ui.editing], f);
  else { const now = new Date().toISOString(); o = { ...f, id: nextId(f.brand), createdAt: now, date: today(), status: f.paid ? "paid" : "new", awb: "", history: [{ s: "new", at: now }] }; }
  putOrder(o); toast((ui.editing ? "Updated " : "Saved ") + o.id);
  if (ui.fromInbox) { inboxDone(ui.fromInbox); ui.fromInbox = null; }
  ui.editing = null; ui.qty = {};
  ui.lastSaved = o.id;
  if (andPrint) printDocs([o], settings.printSlip ? "both" : "label");
  vNew();
}

/* ---- orders list ---- */
const FILTERS = [["open", "To ship"], ["unpaid", "Payment not received"], ["cancelled", "Cancelled"], ["all", "All"]];
function passFilter(o, f) {
  if (f === "open") return ["new", "paid", "packed"].includes(o.status);
  if (f === "unpaid") return !o.paid && o.status !== "cancelled";
  if (f === "shipped") return ONROAD.includes(o.status);
  if (f === "all") return true; return o.status === f;
}
function vOrders() {
  const want = decodeURIComponent((location.hash.split("?")[1] || ""));
  if (want && orders[want]) { ui.q = want; ui.filter = "all"; ui.open.add(want); }
  const base = live().filter(inBrand).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const q = ui.q.trim().toLowerCase();
  const list = base.filter(o => (passFilter(o, ui.filter) || o.id === ui.justShipped) && (!q || [o.id, o.name, o.phone, o.pin, o.city, o.awb].some(v => String(v || "").toLowerCase().includes(q))));
  $("#view").innerHTML = `
  <div class="head"><div><h1>Orders</h1><p class="sub">${list.length} shown</p></div><div class="actions"><button class="btn" id="csv">Export CSV</button><a class="btn hi" href="#new">+ New order</a></div></div>
  <div class="toolbar"><input type="search" id="q" placeholder="Search name, phone, pincode, order or AWB" value="${esc(ui.q)}" aria-label="Search">
    <div class="chips">${FILTERS.map(([k, n]) => `<button class="chip" data-f="${k}" aria-pressed="${ui.filter === k}">${n} · ${base.filter(o => passFilter(o, k)).length}</button>`).join("")}</div></div>
  <div class="list" id="list">${list.length ? list.map(orderCard).join("") : `<div class="empty"><h2>${base.length ? "Nothing matches" : "No orders yet"}</h2><p>${base.length ? "Try another filter or search." : "Add your first WhatsApp order."}</p>${base.length ? "" : `<a class="btn hi" href="#new">+ New order</a>`}</div>`}</div>
  <div class="selbar" id="selbar" ${ui.sel.size ? "" : "hidden"}><b id="selc">${ui.sel.size} selected</b><div class="actions">
    <button class="btn sm hi" data-b="label">Print labels</button><button class="btn sm" data-b="dl">⬇ Labels PDF</button><button class="btn sm" data-b="share">↗ Share PDF</button><button class="btn sm" data-b="slip">Packing slips</button><button class="btn sm" data-b="both">Label + slip</button>
    <button class="btn sm" data-b="packed">Mark packed</button><a class="btn sm" href="#dispatch">Add tracking</a><button class="btn sm" data-b="none">Clear</button></div></div>`;
  $("#q").oninput = e => { ui.q = e.target.value; const pos = e.target.selectionStart; vOrders(); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
  document.querySelectorAll("[data-f]").forEach(c => c.onclick = () => { ui.filter = c.dataset.f; ui.justShipped = null; vOrders(); });
  $("#csv").onclick = exportCSV;
  $("#list").onclick = listClick; $("#list").onchange = listChange;
  $("#list").addEventListener("toggle", e => { if (e.target.tagName !== "DETAILS") return; const id = e.target.closest(".ord").dataset.id; if (e.target.open) { ui.open.add(id); const pv = e.target.querySelector(".preview"); if (pv && !pv.innerHTML.trim()) pv.innerHTML = labelHTML(orders[id]); } else ui.open.delete(id); }, true);
  $("#selbar").onclick = e => { const x = e.target.closest("[data-b]"); if (!x) return; const sel = [...ui.sel].map(i => orders[i]).filter(Boolean); const a = x.dataset.b;
    if (a === "none") { ui.sel.clear(); vOrders(); return; }
    if (["label", "slip", "both"].includes(a)) { printDocs(sel, a, true); return; }
    if (a === "dl") { downloadLabels(sel); return; }
    if (a === "share") { shareLabels(sel); return; }
    if (a === "shipped" && sel.some(o => !o.awb)) toast("Tip: add AWB numbers so customers get tracking.");
    sel.forEach(o => patch(o.id, { status: a })); ui.sel.clear(); toast(`Marked ${sel.length} as ${a}`); vOrders(); };
  if (want) history.replaceState(null, "", "#orders");
}
function orderCard(o) {
  const b = brandById(o.brand); const st = STATUS.find(s => s[0] === o.status) || STATUS[0];
  return `<article class="ord${ui.sel.has(o.id) ? " sel" : ""}" data-id="${esc(o.id)}" style="--bc:${b.color}">
  <input type="checkbox" data-a="sel" aria-label="Select ${esc(o.id)}" ${ui.sel.has(o.id) ? "checked" : ""}>
  <div class="who"><b>${esc(o.name)}</b><span class="meta"><span class="mono">${esc(o.id)}</span> · ${dmy(o.date)} · ${esc(o.city)} ${esc(o.pin)} · ${esc(fmtPhone(o.phone))}</span><span class="meta">${esc(itemsText(o))}</span>${o.awb ? `<span class="meta">${esc(o.courier || "")} AWB <span class="mono">${esc(o.awb)}</span></span>` : ""}${o.notes ? `<span class="meta">Note: ${esc(o.notes)}</span>` : ""}</div>
  <div class="rt"><div><span class="tag t-brand" style="--bc:${b.color}">${esc(b.prefix)}</span> ${payTag(o)} <span class="tag t-${st[0]}">${st[1]}</span></div>
    <div class="actions">${TOSHIP.includes(o.status) ? `<button class="btn sm primary" data-a="track">Add tracking</button>` : ""}<button class="btn sm hi" data-a="label">Print label</button>${LABEL_BTNS(o)}<button class="btn sm" data-a="slip">Slip</button></div>${o.printedAt ? `<span class="hint">Label printed ${dmy(localISO(new Date(o.printedAt)))}${TOSHIP.includes(o.status) ? ` <button type="button" class="btn sm ghost" data-a="unprint">Add back to bulk labels</button>` : ""}</span>` : ""}</div>
  <details${ui.open.has(o.id) ? " open" : ""}><summary>Update · WhatsApp · preview</summary><div class="more">
    ${trackBlock(o)}
    <div class="row"><div class="f"><label>Status</label><select data-a="status">${STATUS.map(([k, n]) => `<option value="${k}"${o.status === k ? " selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="f"><label>Weight (g)</label><input data-a="weight" inputmode="numeric" value="${esc(o.weight || "")}"></div></div>
    <div class="row"><div class="f"><label>UPI ref / UTR</label><input data-a="utr" value="${esc(o.utr || "")}"></div><label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" data-a="paid" ${o.paid ? "checked" : ""}> Payment received</label></div>
    <div class="lbl">WhatsApp ${esc((o.name || "").split(" ")[0])}</div>
    ${ui.justShipped === o.id ? `<div class="sendnow"><b>Tracking saved.</b> Send to ${esc((o.name || "").split(" ")[0])} (${esc(fmtPhone(o.phone))}) in one tap: ${SEND_BTN(o, "primary")} ${tkChip(o, "")}</div>` : ""}
    <div class="wa">${templates(o).map(([n, t]) => `<a href="${waLink(o.phone, t)}" target="_blank" rel="noopener"${n === "Getting ready" ? ` data-wr="${esc(o.id)}"` : ""}>${n}</a>`).join("")}</div>
    <div class="preview">${ui.open.has(o.id) ? labelHTML(o) : ""}</div>
    <div class="actions"><button class="btn sm" data-a="edit">Edit order</button><button class="btn sm" data-a="dup">Repeat order</button><button class="btn sm danger" data-a="del">Delete</button></div>
  </div></details></article>`;
}
function trackBlock(o) {
  const editing = ui.dispatch === o.id || (!o.awb && ui.dispatch === o.id);
  if (editing || (!o.awb && ui.dispatch === o.id)) return dispatchForm(o);
  if (!o.awb) return `<div class="track empty-t"><div><b>No tracking yet</b><p class="hint">Add the courier and AWB once the parcel is handed over.</p></div><button class="btn primary" data-a="track" type="button">Add tracking details</button></div>`;
  const steps = [["shipped", "Dispatched"], ["transit", "In transit"], ["ofd", "Out for delivery"]];
  const at = k => { const h = (o.history || []).filter(x => x.s === k).pop(); return h ? dmy(localISO(new Date(h.at))) : ""; };
  const idx = steps.findIndex(s => s[0] === o.status);
  return `<div class="track"><div class="trk-head"><div><span class="lbl">Tracking</span><div class="trk-awb"><span>${esc(o.courier || "Courier")}</span><b class="mono">${esc(o.awb)}</b></div>
      <span class="hint">Dispatched ${o.shippedAt ? dmy(o.shippedAt.slice(0, 10)) : "—"}</span></div>
      <div class="actions">${trackLink(o) ? `<a class="btn sm" href="${esc(trackLink(o))}" target="_blank" rel="noopener">Open tracking</a>` : ""}<button class="btn sm" data-a="copyawb" type="button">Copy AWB</button><button class="btn sm" data-png="${esc(o.id)}" type="button">Label image</button><button class="btn sm" data-a="track" type="button">Edit</button></div></div>
    <div class="sendrow">${SEND_BTN(o)}${tkChip(o, `Opens ${(o.name || "").split(" ")[0]}'s chat (${fmtPhone(o.phone)}) with the tracking message ready.`)}</div>
    <ol class="steps-t">${steps.map(([k, n], i) => `<li class="${i <= idx ? "done" : ""}"><button type="button" data-a="step" data-s="${k}">${n}</button><small>${at(k)}</small></li>`).join("")}</ol></div>`;
}
function dispatchForm(o) {
  return `<div class="track dform" data-dform="${esc(o.id)}"><h3>Tracking details</h3>
    <div class="f"><label>Courier</label>${courierTicks("dc-" + o.id, o.courier || "")}</div>
    <div class="row"><div class="f"><label>AWB / consignment no.</label><input class="mono" data-d="awb" value="${esc(o.awb || "")}" placeholder="Scan or type" autocomplete="off"></div>
      <div class="f"><label>Dispatch date</label><input type="date" data-d="date" value="${esc(o.shippedAt ? o.shippedAt.slice(0, 10) : today())}"></div>
      <div class="f"><label>Weight (g)</label><input data-d="weight" inputmode="numeric" value="${esc(o.weight || "")}"></div></div>
    <div class="f"><label>Tracking link (optional · made automatically from the courier)</label><input data-d="url" inputmode="url" value="${esc(o.trackUrl || "")}" placeholder="Leave empty to use the courier's own tracking page"></div>
    <div class="actions"><button class="btn hi" data-a="dsave" type="button">${o.awb ? "Save tracking" : "Save & mark dispatched"}</button><button class="btn ghost" data-a="dcancel" type="button">Cancel</button></div></div>`;
}
function saveDispatch(id, root) {
  const o = orders[id]; const g = k => root.querySelector(`[data-d="${k}"]`).value.trim();
  const awb = g("awb").toUpperCase(); if (!awb) { toast("Enter the AWB / consignment number."); return false; }
  const courier = tickedCourier("dc-" + id); const date = g("date") || today();
  const p = { awb, courier, trackUrl: g("url"), weight: Number(g("weight")) || o.weight || 0, shippedAt: date + "T" + new Date().toTimeString().slice(0, 8) };
  if (TOSHIP.includes(o.status)) p.status = "shipped";
  const before = trackSig(o), after = trackSig({ ...o, awb, courier, trackUrl: p.trackUrl});
  const changedAfterSent = !!o.trackingSentAt && !!o.awb && (o.trackingSentSig || before) !== after; // the customer already has the old number
  // Only a parcel dispatched NOW, an order that had no tracking number yet, or a fix to today's tracking that the customer has not got yet is offered to WhatsApp Auto.
  // Editing an older order (weight, a typo in its number) never re-stamps it, so old dispatched orders are never sent by itself.
  const stampedToday = !!o.trackSavedAt && localISO(new Date(o.trackSavedAt)) === today();
  const fresh = !ONROAD.includes(o.status) || !o.awb || (stampedToday && before !== after && !o.trackingSentAt); // (no number before: nothing could have been sent yet)
  if (fresh) { p.trackSavedAt = new Date().toISOString(); p.trackingSkip = false; } // a new number is a new decision: an earlier "Skip" no longer applies
  patch(id, p); return changedAfterSent ? "changed" : fresh ? "offer" : "saved";
}
function listClick(e) {
  const x = e.target.closest("[data-a]"); if (!x) return; const card = x.closest(".ord"); if (!card) return; const id = card.dataset.id; const o = orders[id]; const a = x.dataset.a;
  if (a === "sel") { x.checked ? ui.sel.add(id) : ui.sel.delete(id); card.classList.toggle("sel", x.checked); $("#selbar").hidden = !ui.sel.size; $("#selc").textContent = ui.sel.size + " selected"; }
  if (a === "label" || a === "slip") printDocs([o], a);
  if (a === "track") { ui.dispatch = id; ui.open.add(id); vOrders(); const f = document.querySelector(`[data-dform="${CSS.escape(id)}"] [data-d="awb"]`); if (f) f.focus(); return; }
  if (a === "dcancel") { ui.dispatch = null; vOrders(); return; }
  if (a === "dsave") { const wasNew = TOSHIP.includes(o.status); const r = saveDispatch(id, x.closest("[data-dform]")); if (r) { ui.dispatch = null; if (wasNew) { ui.dispHi = id; ui.dispAll = false; ui.dq = ""; toast(o.name.split(" ")[0] + " moved to Dispatch ✓"); location.hash = "#dispatch"; } else { toast(r === "changed" ? "Tracking changed. " + (o.name || "").split(" ")[0] + " already got the old one. Tap Send on WhatsApp to send the new one." : "Tracking updated for " + id); vOrders(); } if (r === "offer") offerTrack([id]); } return; } // newly dispatched orders leave Orders and go to Dispatch
  if (a === "step") { const s2 = x.dataset.s; if (o.status !== s2) { patch(id, { status: s2 }); toast(o.name.split(" ")[0] + ": " + stName(s2)); vOrders(); } return; }
  if (a === "unprint") { patch(id, { printedAt: "" }); toast(o.name.split(" ")[0] + " is back in the bulk labels"); vOrders(); return; }
  if (a === "copyawb") { navigator.clipboard && navigator.clipboard.writeText(o.awb).then(() => toast("AWB copied"), () => toast(o.awb)); return; }
  if (a === "edit") { ui.editing = id; ui.formBrand = o.brand; location.hash = "#new"; }
  if (a === "dup") { ui.editing = null; ui.formBrand = o.brand; ui.prefill = { ...o, utr: "", paid: false, disc: 0, code: "", notes: "" }; location.hash = "#new"; }
  if (a === "del") { if (x.dataset.c) { o.deleted = true; putOrder(o); ui.sel.delete(id); toast("Deleted " + id); vOrders(); } else { x.dataset.c = 1; x.textContent = "Tap again to delete"; setTimeout(() => { if (x.isConnected) { delete x.dataset.c; x.textContent = "Delete"; } }, 4000); } }
}
function listChange(e) {
  if (e.target.closest("[data-dform]")) return;
  const x = e.target.closest("[data-a]"); if (!x || x.dataset.a === "sel") return; const id = x.closest(".ord").dataset.id; const o = orders[id]; const a = x.dataset.a;
  if (a === "status") patch(id, { status: x.value });
  if (a === "weight") patch(id, { weight: Number(x.value) || 0 });
  if (a === "utr") patch(id, { utr: x.value.trim() });
  if (a === "paid") patch(id, x.checked && o.status === "new" ? { paid: true, status: "paid" } : { paid: x.checked });
  vOrders();
}
function csvCell(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportCSV() {
  const head = ["Order", "Brand", "Date", "Name", "Phone", "Alt phone", "Address", "Landmark", "City", "State", "Pincode", "Items", "Pcs", "Weight g", "Subtotal", "Discount", "Shipping", "Total", "Payment", "Paid", "UTR", "Status", "Courier", "Service", "AWB", "Dispatched", "Tracking link", "Notes"];
  const rows = live().filter(inBrand).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(o => [o.id, brandById(o.brand).name, o.date, o.name, o.phone, o.alt, o.address, o.landmark, o.city, o.state, o.pin, itemsText(o), pcs(o), o.weight, o.sub, o.disc, o.ship, o.total, "Prepaid (UPI)", o.paid ? "Yes" : "No", o.utr, o.status, o.courier, o.service, o.awb, o.shippedAt ? o.shippedAt.slice(0, 10) : "", trackLink(o), o.notes]);
  const csv = "﻿" + [head, ...rows].map(r => r.map(csvCell).join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `orders-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---- dispatch: add tracking for many parcels at once ---- */
// Every order with tracking added goes under "Dispatched" automatically (dispatched in the last 7 days, newest first),
// whether the AWB was added on the Dispatch page or on the order itself. One rule, used by the page and by the in-place refresh of its buttons.
function dispLists() {
  const wk = localISO(new Date(Date.now() - 6 * 864e5));
  const allDone = live().filter(inBrand).filter(o => ONROAD.includes(o.status) && o.awb)
    .sort((a, b) => (b.shippedAt || "").localeCompare(a.shippedAt || ""));
  const dq = (ui.dq || "").trim().toLowerCase();
  const done = allDone.filter(o => dq ? [o.id, o.name, o.phone, o.awb, o.pin].some(v => String(v || "").toLowerCase().includes(dq))
    : ui.dispAll || (o.shippedAt || o.updatedAt || "").slice(0, 10) >= wk);
  const older = allDone.length - allDone.filter(o => (o.shippedAt || o.updatedAt || "").slice(0, 10) >= wk).length;
  return { allDone, dq, done, older };
}
function vDispatch() {
  const list = live().filter(inBrand).filter(o => TOSHIP.includes(o.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest (most late) first
  const { allDone, dq, done, older } = dispLists();
  $("#view").innerHTML = `<div class="head"><div><h1>Dispatch</h1><p class="sub">Add courier and AWB for each parcel you hand over. Press Enter to jump to the next row (works with a barcode scanner).</p></div>
    <div class="f"><label>Courier for all rows</label><select id="allcour"><option value="">Choose…</option>${COURIERS.map(c => `<option>${esc(c)}</option>`).join("")}</select></div></div>
  ${list.length ? `<div class="tbl"><table class="dt"><thead><tr><th>Order</th><th>Customer</th><th>Pincode</th><th>Payment</th><th>Courier</th><th>AWB / consignment no.</th></tr></thead><tbody>${list.map(o => { const b = brandById(o.brand); return `<tr data-id="${esc(o.id)}"${daysLate(o) ? ' class="late-row"' : ""}><td><span class="tag t-brand" style="--bc:${b.color}">${esc(b.prefix)}</span> <span class="mono">${esc(o.id)}</span>${daysLate(o) ? `<div><span class="late-tag">${lateText(daysLate(o))}</span></div>` : ""}</td><td><b>${esc(o.name)}</b><div class="hint">${esc(itemsText(o))}</div></td><td class="mono">${esc(o.pin)}<div class="hint">${esc(o.city)}</div></td><td>${payTag(o)}</td>
    <td><select data-c><option value="">—</option>${COURIERS.map(c => `<option${o.courier === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></td><td><input class="mono" data-w autocomplete="off" placeholder="Scan or type" value="${esc(o.awb || "")}"></td></tr>`; }).join("")}</tbody></table></div>
    <div class="actions" style="margin-top:12px"><button class="btn hi" id="dsaveall">Save &amp; mark dispatched</button><span class="hint">Only rows with an AWB number are saved.</span></div>`
  : `<div class="empty"><h2>Nothing waiting to dispatch</h2><p>Orders that are new, paid or packed appear here.</p></div>`}
  ${allDone.length ? `<div class="card stack" style="margin-top:16px"><div class="head" style="margin:0"><div><h2>Dispatched · ${dq ? "search" : ui.dispAll ? "all" : "last 7 days"} <span class="tag t-transit">${done.length}</span></h2><p class="hint" style="margin:0">Orders move here automatically as soon as tracking is added, and stay here.</p></div>
    <input type="search" id="dq" placeholder="Search name, phone or AWB" value="${esc(ui.dq || "")}" aria-label="Search dispatched" style="max-width:260px"></div>
    ${!done.length ? `<p class="hint">Nothing matches.</p>` : ""}<div class="tbl"><table><tbody>${done.map(o => `<tr${ui.dispHi === o.id ? ' class="hi-row"' : ""}><td class="mono">${esc(o.id)}<div class="hint">${ui.dispHi === o.id ? "<b>Just now</b>" : o.shippedAt ? dmy(o.shippedAt.slice(0, 10)) : ""}</div></td><td><b>${esc(o.name)}</b><div class="hint">${esc(itemsText(o))}</div></td><td>${esc(o.courier || "")} <span class="mono">${esc(o.awb)}</span></td><td>${SEND_BTN(o, "sm hi")} ${tkChip(o, "")}</td></tr>`).join("")}</tbody></table></div><div class="actions"><span data-tknext>${dispNext(done)}</span>${!dq && older ? `<button class="btn sm" id="dall" type="button">${ui.dispAll ? "Show last 7 days only" : `Show all dispatched (${older} older)`}</button>` : ""}<a class="btn sm" href="#orders">See all orders</a></div></div>` : ""}`;
  const rows = [...document.querySelectorAll(".dt tbody tr")];
  rows.forEach((tr, i) => { const w = tr.querySelector("[data-w]"); w.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); const n = rows[i + 1]; if (n) n.querySelector("[data-w]").focus(); else $("#dsaveall").focus(); } }; });
  if ($("#allcour")) $("#allcour").onchange = e => rows.forEach(tr => { const s = tr.querySelector("[data-c]"); if (!s.value) s.value = e.target.value; });
  if ($("#dsaveall")) $("#dsaveall").onclick = () => {
    const saved = [];
    rows.forEach(tr => { const id = tr.dataset.id; const awb = tr.querySelector("[data-w]").value.trim().toUpperCase(); if (!awb) return;
      patch(id, { awb, courier: tr.querySelector("[data-c]").value, status: "shipped", shippedAt: today() + "T" + new Date().toTimeString().slice(0, 8), trackSavedAt: new Date().toISOString(), trackingSkip: false }); saved.push(id); });
    if (!saved.length) { toast("Type or scan at least one AWB number."); return; }
    ui.dispatched = [...new Set([...(ui.dispatched || []), ...saved])]; toast(`Dispatched ${saved.length} order${saved.length > 1 ? "s" : ""}`); vDispatch(); offerTrack(saved); };
  if ($("#dall")) $("#dall").onclick = () => { ui.dispAll = !ui.dispAll; vDispatch(); };
  if ($("#dq")) $("#dq").oninput = e => { ui.dq = e.target.value; const pos = e.target.selectionStart; vDispatch(); const n = $("#dq"); n.focus(); n.setSelectionRange(pos, pos); };
  const first = document.querySelector(".dt [data-w]"); if (first && !ui.dq) first.focus();
}

/* ---- scan ---- */
let stream = null, scanLoop = null;
function stopCam() { if (scanLoop) cancelAnimationFrame(scanLoop); scanLoop = null; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
function vScan() {
  $("#view").innerHTML = `
  <div class="head"><div><h1>Scan</h1><p class="sub">Scan the courier's AWB barcode with the camera or a USB / Bluetooth scanner, or type an order number.</p></div></div>
  <div class="split"><div class="card scanwrap">
    <div class="f"><label for="scanin">Order no. or AWB</label><input id="scanin" class="scanin" autocomplete="off" autofocus placeholder="Scan here"></div>
    <div class="row"><label class="check"><input type="radio" name="sm" value="look" checked> Just open the order</label><label class="check"><input type="radio" name="sm" value="packed"> Mark packed</label><label class="check"><input type="radio" name="sm" value="shipped"> Mark dispatched</label></div>
    <div class="actions"><button class="btn primary" id="cam" type="button">Use phone camera</button></div>
    <video id="vid" playsinline muted hidden></video><p class="hint" id="camnote"></p>
  </div><div class="card stack" id="scanres"><p class="hint">Scanned orders appear here.</p></div></div>`;
  const handle = code => {
    code = String(code).trim().split("|")[0].toUpperCase(); if (!code) return;
    const o = orders[code] || live().find(x => (x.awb || "").toUpperCase() === code);
    const mode = document.querySelector("[name=sm]:checked").value;
    if (!o) { $("#scanres").insertAdjacentHTML("afterbegin", `<p style="color:var(--bad);font-weight:800">Not found: ${esc(code)}</p>`); return; }
    if (mode !== "look" && o.status !== mode) patch(o.id, { status: mode });
    if (navigator.vibrate) navigator.vibrate(60);
    $("#scanres").insertAdjacentHTML("afterbegin", `<div class="ord" style="--bc:${brandById(o.brand).color}"><span></span><div class="who"><b>${esc(o.name)}</b><span class="meta mono">${esc(o.id)}</span><span class="meta">${esc(itemsText(o))}</span></div><div class="rt">${payTag(o)} <span class="tag t-${o.status}">${o.status}</span><a class="btn sm" href="#orders?${encodeURIComponent(o.id)}">Open</a></div></div>`);
  };
  $("#scanin").onkeydown = e => { if (e.key === "Enter") { handle(e.target.value); e.target.value = ""; } };
  $("#cam").onclick = async () => {
    if (!("BarcodeDetector" in window)) { $("#camnote").textContent = "This browser can't scan with the camera. Use Chrome on Android, or a USB scanner."; return; }
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); } catch (e) { $("#camnote").textContent = "Camera permission was refused."; return; }
    const v = $("#vid"); v.hidden = false; v.srcObject = stream; await v.play();
    const det = new BarcodeDetector({ formats: ["qr_code", "code_128"] }); let last = "", lastAt = 0;
    const tick = async () => { if (!stream) return; try { const r = await det.detect(v); if (r[0]) { const c = r[0].rawValue; if (c !== last || Date.now() - lastAt > 3000) { last = c; lastAt = Date.now(); handle(c); } } } catch (e) {} scanLoop = requestAnimationFrame(tick); };
    tick();
  };
}

/* ---- customers ---- */
function vCustomers() {
  const dueList = refillDue(); const dueMap = Object.fromEntries(dueList.map(d => [phone10(d.o.phone), d])); const dueSet = new Set(Object.keys(dueMap));
  const map = {};
  live().filter(inBrand).filter(o => o.status !== "cancelled").forEach(o => { const k = o.phone; const c = map[k] || (map[k] = { phone: k, name: o.name, city: o.city, n: 0, sum: 0, last: "", brands: new Set(), fav: {}, rto: 0, lastBrand: o.brand });
    c.n++; c.sum += o.total; c.brands.add(o.brand); if (o.date >= c.last) { c.last = o.date; c.name = o.name; c.city = o.city; c.lastBrand = o.brand; } (o.items || []).forEach(i => c.fav[i.name] = (c.fav[i.name] || 0) + i.qty); });
  let list = Object.values(map).sort((a, b) => b.sum - a.sum); const q = ui.cq.trim().toLowerCase();
  if (q) list = list.filter(c => [c.name, c.phone, c.city].some(v => String(v || "").toLowerCase().includes(q)));
  const now = Date.now();
  $("#view").innerHTML = `<div class="head"><div><h1>Customers</h1><p class="sub">${list.length} customers · ${list.filter(c => c.n > 1).length} repeat</p></div></div>
  <div class="toolbar"><input type="search" id="cq" placeholder="Search customers" value="${esc(ui.cq)}" aria-label="Search customers"></div>
  ${list.length ? `<div class="tbl"><table><thead><tr><th>Customer</th><th>Phone</th><th>City</th><th class="n">Orders</th><th>Last order</th><th>Usually buys</th><th></th></tr></thead><tbody>${list.map(c => {
    const days = Math.round((now - new Date(c.last)) / 864e5); const fav = Object.entries(c.fav).sort((a, b) => b[1] - a[1])[0]; const b = brandById(c.lastBrand);
    return `<tr><td><b>${esc(c.name)}</b> ${c.n > 1 ? `<span class="tag t-upi">Repeat</span>` : ""}<div>${[...c.brands].map(id => `<span class="tag t-brand" style="--bc:${brandById(id).color}">${esc(brandById(id).prefix)}</span>`).join(" ")}</div></td><td class="mono">${esc(fmtPhone(c.phone))}</td><td>${esc(c.city)}</td><td class="n">${c.n}</td><td>${dmy(c.last)}<div class="hint">${days} days ago</div></td><td>${fav ? esc(fav[0]) : ""}</td><td><div class="wa">${dueSet.has(phone10(c.phone)) ? `<a href="${waLink(c.phone, refillMessage(dueMap[phone10(c.phone)].o, dueMap[phone10(c.phone)].days))}" target="_blank" rel="noopener" data-refill="${esc(dueMap[phone10(c.phone)].o.id)}">Refill reminder</a>` : ""}</div></td></tr>`; }).join("")}</tbody></table></div>`
    : `<div class="empty"><h2>No customers yet</h2><p>They appear after their first order.</p></div>`}`;
  $("#cq").oninput = e => { ui.cq = e.target.value; const p = e.target.selectionStart; vCustomers(); const n = $("#cq"); n.focus(); n.setSelectionRange(p, p); };
}

/* ---- reports ---- */
function vReports() {
  const m = ui.month; const L = live().filter(inBrand).filter(o => (o.date || "").startsWith(m));
  const ok = L.filter(o => o.status !== "cancelled");
  const sales = ok.reduce((a, o) => a + o.total, 0);
  const sent = ok.filter(o => ONROAD.includes(o.status)); const toship = ok.filter(o => TOSHIP.includes(o.status));
  const byBrand = settings.brands.map(b => { const x = ok.filter(o => o.brand === b.id); return { b, n: x.length, s: x.reduce((a, o) => a + o.total, 0) }; }).filter(r => r.n);
  const prod = {}; ok.forEach(o => (o.items || []).forEach(i => { const k = o.brand + "|" + i.name; prod[k] = prod[k] || { b: o.brand, n: i.name, q: 0, s: 0 }; prod[k].q += i.qty; prod[k].s += i.qty * i.price; }));
  const top = Object.values(prod).sort((a, b) => b.s - a.s); const maxS = Math.max(1, ...top.map(t => t.s));
  const months = [...new Set(live().map(o => (o.date || "").slice(0, 7)).filter(Boolean).concat([new Date().toISOString().slice(0, 7)]))].sort().reverse();
  $("#view").innerHTML = `<div class="head"><div><h1>Reports</h1><p class="sub">Cancelled orders are not counted.</p></div><div class="f"><label for="mon">Month</label><select id="mon">${months.map(x => `<option${x === m ? " selected" : ""}>${x}</option>`).join("")}</select></div></div>
  <div class="grid g4"><div class="kpi"><span>Orders</span><b>${ok.length}</b></div><div class="kpi"><span>Sales</span><b>${inr(sales)}</b><small>Avg ${inr(ok.length ? sales / ok.length : 0)} / order</small></div>
    <div class="kpi"><span>Dispatched</span><b>${sent.length}</b></div>
    <div class="kpi"><span>Still to ship</span><b>${toship.length}</b></div></div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card stack"><h2>By brand</h2>${byBrand.length ? `<div class="tbl"><table><thead><tr><th>Brand</th><th class="n">Orders</th><th class="n">Sales</th></tr></thead><tbody>${byBrand.map(r => `<tr><td><span class="tag t-brand" style="--bc:${r.b.color}">${esc(r.b.prefix)}</span> ${esc(r.b.name)}</td><td class="n">${r.n}</td><td class="n">${inr(r.s)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">No orders this month.</p>`}</div>
    <div class="card stack"><h2>Best sellers</h2>${top.length ? `<div class="tbl"><table><tbody>${top.slice(0, 10).map(t => `<tr><td>${esc(t.n)}<div class="bar-h"><i style="width:${Math.round(t.s * 100 / maxS)}%;background:${brandById(t.b).color}"></i></div></td><td class="n">${t.q} pcs</td><td class="n">${inr(t.s)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">No sales this month.</p>`}</div>
  </div>`;
  $("#mon").onchange = e => { ui.month = e.target.value; vReports(); };
}

/* ---- settings ---- */
function vSettings() {
  $("#view").innerHTML = `<div class="head"><div><h1>Settings</h1><p class="sub">Brands, products, return addresses, Google Sheet and PIN.</p></div></div>
  <div class="card stack" id="pushcard" style="margin-bottom:14px"></div>
  <div class="stack" id="brands">${settings.brands.map(brandCard).join("")}</div>
  <div class="actions" style="margin:12px 0 18px"><button class="btn" id="addbrand">+ Add brand</button></div>
  <div class="grid g2">
    <div class="card stack"><h2>Labels</h2>
      <p class="hint">Couriers: ${COURIERS.join(" and ")}. Tick one on an order and it prints on that label; leave both unticked and the label shows no courier.</p>
      <label class="check"><input type="checkbox" id="sslip" ${settings.printSlip ? "checked" : ""}> Also print a packing slip with each label</label>
      <label class="check"><input type="checkbox" id="sauto" ${settings.autoForm !== false ? "checked" : ""}> Add orders from the customer form automatically</label>
      <div class="f"><label for="srefill">Refill reminder after (days)</label><input id="srefill" inputmode="numeric" value="${Number(settings.refillDays) || 30}"></div>
      <div class="lbl" style="margin-top:6px">Courier tracking pages</div>
      <p class="hint" style="margin:0">Used in the tracking message. Put {awb} where the tracking number goes, if the courier's page allows it.</p>
      ${COURIERS.map(c => `<div class="f"><label>${esc(c)}</label><input data-tp="${esc(c)}" inputmode="url" value="${esc(trackPage(c))}"></div>`).join("")}
      <div class="f"><label for="ssign">WhatsApp message sign-off</label><input id="ssign" value="${esc(signoff())}"></div>
      <div class="f"><label for="snote">Line on every packing slip</label><input id="snote" value="${esc(settings.nextNote || "")}" placeholder="e.g. Share a photo review on WhatsApp for 10% off your next order"></div>
      <p class="hint">Printer: set paper size to 4 × 6 in (100 × 150 mm), margins None, scale 100%.</p>
      <div class="preview">${labelHTML(sampleOrder())}</div></div>
    <div class="card stack"><h2>Online storage</h2>
      <p class="hint">${online() ? "✓ Connected. Orders are saved online on your site and shared by every phone and laptop that logs in." : "Orders are saved online on your own site (Vercel). Enter the password you set as ORDER_DESK_PASSWORD in Vercel."}</p>
      <div class="f"><label for="opw">Password</label><input id="opw" type="password" autocomplete="current-password" value="${online() ? esc(device.sheetKey) : ""}"></div>
      <div class="actions"><button class="btn primary" id="oconn">${online() ? "Save &amp; sync now" : "Connect"}</button>${online() ? `<button class="btn ghost" id="odisc" type="button">Disconnect this device</button>` : ""}<span class="hint">${device.lastSync ? "Last sync " + new Date(device.lastSync).toLocaleString("en-IN") : ""}</span></div>
      <details><summary class="hint" style="cursor:pointer">Use a Google Sheet instead (optional)</summary><div class="stack" style="margin-top:10px">
      <div class="f"><label for="surl">Apps Script web app URL</label><input id="surl" value="${online() ? "" : esc(device.sheetUrl)}" placeholder="https://script.google.com/macros/s/…/exec"></div>
      <div class="f"><label for="skey">Secret key</label><input id="skey" value="${online() ? "" : esc(device.sheetKey)}" placeholder="Same as SECRET in the script"></div>
      <div class="actions"><button class="btn" id="ssync">Use Google Sheet</button></div></div></details>
      <h2 style="margin-top:10px">PIN lock</h2>
      <div class="row"><div class="f"><label for="spin">New PIN (4–8 digits)</label><input id="spin" type="password" inputmode="numeric" maxlength="8"></div></div>
      <div class="actions"><button class="btn" id="setpin">${device.pinHash ? "Change PIN" : "Set PIN"}</button>${device.pinHash ? `<button class="btn danger" id="rmpin">Remove PIN</button>` : ""}</div>
      <p class="hint">The PIN locks this device's screen. It is a simple lock, not encryption.</p>
      <h2 style="margin-top:10px">Backup file</h2>
      <div class="actions"><button class="btn" id="bk">Download backup (.json)</button><label class="btn">Restore backup<input type="file" id="rs" accept=".json" hidden></label></div></div>
    <div class="card stack"><h2>Automatic WhatsApp</h2>
      <p class="hint" id="wast">${online() ? "Checking…" : "Works from your own site only. Connect it under Online storage first."}</p>
      <label class="check"><input type="checkbox" id="sauwa" ${settings.autoWa !== false ? "checked" : ""}> Send “your order is getting ready” by itself when I print a label</label>
      <label class="check"><input type="checkbox" id="sautk" ${settings.autoTrack !== false ? "checked" : ""}> Send the tracking number by itself when I press “Save &amp; mark dispatched”</label>
      <div class="f"><label for="watest">Test: send to my own number</label><input id="watest" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number"></div>
      <div class="actions"><button class="btn" id="watestgo" type="button"${online() ? "" : " disabled"}>Test “getting ready”</button><button class="btn" id="watesttk" type="button"${online() ? "" : " disabled"}>Test tracking</button></div>
      <p class="hint">Goes through the official WhatsApp Business: Meta directly, or a partner such as AiSensy. It needs a one-time setup on your site (see the setup steps): two approved messages, “getting ready” and “on the way”.</p></div>
  </div>`;
  const B = $("#brands");
  B.oninput = B.onchange = e => {
    const card = e.target.closest("[data-b]"); if (!card) return; const b = brandById(card.dataset.b); const k = e.target.dataset.k; if (!k) return;
    const v = e.target.value;
    if (k.startsWith("from.")) b.from[k.slice(5)] = v;
    else if (k.startsWith("p.")) { const [, idx, f] = k.split("."); b.products[idx][f] = f === "name" ? v : Number(v) || 0; }
    else b[k] = k === "prefix" ? v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) : v;
    settings.updatedAt = new Date().toISOString(); saveSettings(); if (k === "color" || k === "name") renderBrandPick();
    clearTimeout(vSettings.t); vSettings.t = setTimeout(() => { if (device.sheetUrl) post({ settings }).catch(() => {}); }, 1500);
  };
  B.onclick = e => {
    const x = e.target.closest("[data-x]"); if (!x) return; const b = brandById(x.closest("[data-b]").dataset.b);
    if (x.dataset.x === "addp") b.products.push({ id: b.id + uid(), name: "", price: 0, weight: 0 });
    if (x.dataset.x === "rmp") b.products.splice(Number(x.dataset.i), 1);
    if (x.dataset.x === "rmb") { if (live().some(o => o.brand === b.id)) { toast("This brand has orders, so it can't be removed."); return; } settings.brands = settings.brands.filter(y => y !== b); }
    settings.updatedAt = new Date().toISOString(); saveSettings(); vSettings();
  };
  refreshPushUI();
  $("#addbrand").onclick = () => { const id = "b" + uid(); settings.brands.push({ id, name: "New brand", prefix: "NB", color: "#444444", tagline: "", site: "", upi: "", gstin: "", from: { ...RETURN }, products: [] }); settings.updatedAt = new Date().toISOString(); saveSettings(); vSettings(); };
  $("#sauto").onchange = e => { settings.autoForm = e.target.checked; settings.updatedAt = new Date().toISOString(); saveSettings(); toast(e.target.checked ? "Form orders will be added automatically" : "Form orders will wait on Today for you to tap Create order"); };
  const waShow = (ok, m) => { const el = $("#wast"); if (el) el.innerHTML = (ok ? "✓ " : "✗ ") + esc(m); };
  $("#sauwa").onchange = e => { settings.autoWa = e.target.checked; settings.updatedAt = new Date().toISOString(); saveSettings(); toast(e.target.checked ? "Automatic WhatsApp is on" : "Automatic WhatsApp is off. You will tap to send."); };
  $("#sautk").onchange = e => { settings.autoTrack = e.target.checked; settings.updatedAt = new Date().toISOString(); saveSettings(); toast(e.target.checked ? "Tracking will go by itself" : "Tracking will not go by itself. You will tap to send."); };
  if (online()) waReady(true).then(ok => waShow(ok, ok ? (waChk.via === "aisensy" ? "AiSensy is set up on your site. Messages go from your AiSensy WhatsApp number. Press a Test button below to check that it works." : "Connected to Meta" + (waChk.name ? " as " + waChk.name : "") + (waChk.num ? " (" + waChk.num + ")" : "") + ". Messages go from this WhatsApp number." + (waChk.track ? "" : " But your site has the older api/wa.js, so the tracking number cannot go by itself yet. Put the newest api/wa.js on your site (see the setup steps).")) : "Not connected" + waTo() + " yet. " + (waChk.msg || "")));
  $("#watestgo").onclick = async () => {
    const to = phone10($("#watest").value); if (to.length !== 10) { toast("Enter your own 10-digit mobile number."); return; }
    const b = $("#watestgo"); b.disabled = true; b.textContent = "Sending…";
    try { const j = await callWa({ to, name: "Test", order: "TEST" + today().replace(/-/g, "").slice(2), items: "1 x Sample cream 30g" }); waShow(!!j.ok, j.ok ? "Test sent to " + fmtPhone(to) + ". Check WhatsApp on that phone." : (j.unsure ? "Not sure if the test went through. " : "") + (j.error || "Not sent.")); }
    catch (e) { waShow(false, e.message || "Could not reach your site."); }
    b.disabled = false; b.textContent = "Test “getting ready”";
  };
  $("#watesttk").onclick = async () => {
    const to = phone10($("#watest").value); if (to.length !== 10) { toast("Enter your own 10-digit mobile number."); return; }
    const b = $("#watesttk"); b.disabled = true; b.textContent = "Sending…";
    try {
      if (!(await waReady(true))) waShow(false, "Not connected" + waTo() + " yet. " + (waChk.msg || ""));
      else if (!waChk.track) waShow(false, "Your site has the older api/wa.js, which cannot send the tracking message. Put the newest api/wa.js on your site (see the setup steps).");
      else { const j = await callWa({ kind: "track", to, name: "Test", order: "TEST" + today().replace(/-/g, "").slice(2), items: "1 x Sample cream 30g", courier: "DTDC", awb: "D12345678", link: trackPage("DTDC") }); waShow(!!j.ok, j.ok ? "Test tracking sent to " + fmtPhone(to) + ". Check WhatsApp on that phone." : (j.unsure ? "Not sure if the test went through. " : "") + (j.error || "Not sent.")); }
    } catch (e) { waShow(false, e.message || "Could not reach your site."); }
    b.disabled = false; b.textContent = "Test tracking";
  };
  $("#srefill").onchange = () => { settings.refillDays = Math.max(7, Number($("#srefill").value) || 30); settings.updatedAt = new Date().toISOString(); saveSettings(); toast("Saved"); };
  $("#ssign").onchange = () => { settings.signoff = $("#ssign").value.trim() || "With love, Team skinday.in 💛"; settings.updatedAt = new Date().toISOString(); saveSettings(); toast("Sign-off saved"); };
  document.querySelectorAll("[data-tp]").forEach(i => i.onchange = () => { settings.trackPages = { ...(settings.trackPages || {}), [i.dataset.tp]: i.value.trim() || TRACK_PAGES[i.dataset.tp] }; settings.updatedAt = new Date().toISOString(); saveSettings(); toast(i.dataset.tp + " tracking page saved"); });
  $("#snote").onchange = () => { settings.nextNote = $("#snote").value.trim(); settings.updatedAt = new Date().toISOString(); saveSettings(); toast("Saved"); };
  $("#sslip").onchange = e => { settings.printSlip = e.target.checked; settings.updatedAt = new Date().toISOString(); saveSettings(); };
  $("#oconn").onclick = () => { const pw = $("#opw").value.trim(); if (!pw) { toast("Enter the password."); return; } device.sheetUrl = location.origin + "/api/sync"; device.sheetKey = pw; device.auto = false; device.noAuto = false; saveDevice(); syncNow(false).then(() => vSettings()); };
  if ($("#odisc")) $("#odisc").onclick = () => { device.noAuto = true; device.auto = false; device.sheetUrl = ""; device.sheetKey = ""; saveDevice(); syncState("", "Local only"); vSettings(); };
  $("#ssync").onclick = () => { device.sheetUrl = $("#surl").value.trim(); device.sheetKey = $("#skey").value.trim(); saveDevice(); syncNow(false); };
  $("#setpin").onclick = async () => { const p = $("#spin").value; if (!/^\d{4,8}$/.test(p)) { toast("PIN must be 4–8 digits."); return; } device.pinHash = await sha("od:" + p); saveDevice(); toast("PIN set"); vSettings(); };
  if ($("#rmpin")) $("#rmpin").onclick = () => { device.pinHash = ""; saveDevice(); toast("PIN removed"); vSettings(); };
  $("#bk").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ settings, orders }, null, 1)], { type: "application/json" })); a.download = `order-desk-backup-${today()}.json`; a.click(); };
  $("#rs").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (!j.orders || !j.settings) throw 0;
    Object.values(j.orders).forEach(o => { const m = orders[o.id]; if (!m || (o.updatedAt || "") > (m.updatedAt || "")) { orders[o.id] = o; markDirty(o.id); } }); settings = j.settings; saveSettings(); saveOrders(); toast("Backup restored"); render(); } catch (x) { toast("That file isn't an Order Desk backup."); } };
}
function brandCard(b) {
  const f = b.from || {};
  return `<details class="card" data-b="${b.id}"><summary style="cursor:pointer;display:flex;align-items:center;gap:10px"><span class="tag t-brand" style="--bc:${b.color}">${esc(b.prefix)}</span><h2 style="display:inline">${esc(b.name)}</h2><span class="hint">${b.products.length} products</span></summary>
  <div class="stack" style="margin-top:14px">
    <div class="row"><div class="f"><label>Brand name</label><input data-k="name" value="${esc(b.name)}"></div><div class="f"><label>Order prefix</label><input data-k="prefix" value="${esc(b.prefix)}" maxlength="4"></div><div class="f"><label>Colour</label><input type="color" data-k="color" value="${esc(b.color)}" style="height:44px;padding:4px"></div><div class="f"><label>Website (on label)</label><input data-k="site" value="${esc(b.site || "")}"></div></div>
    <div class="row"><div class="f"><label>UPI ID</label><input data-k="upi" value="${esc(b.upi || "")}" placeholder="name@okhdfcbank"></div><div class="f"><label>GSTIN (optional)</label><input data-k="gstin" value="${esc(b.gstin || "")}"></div></div>
    <div class="lbl">Return address (printed on label)</div>
    <div class="row"><div class="f"><label>Name</label><input data-k="from.name" value="${esc(f.name || "")}"></div><div class="f"><label>Address line 1</label><input data-k="from.line1" value="${esc(f.line1 || "")}"></div><div class="f"><label>Address line 2</label><input data-k="from.line2" value="${esc(f.line2 || "")}"></div></div>
    <div class="row"><div class="f"><label>City</label><input data-k="from.city" value="${esc(f.city || "")}"></div><div class="f"><label>State</label><input data-k="from.state" value="${esc(f.state || "")}"></div><div class="f"><label>Pincode</label><input data-k="from.pin" value="${esc(f.pin || "")}"></div><div class="f"><label>Phone</label><input data-k="from.phone" value="${esc(f.phone || "")}"></div></div>
    <div class="lbl">Products</div>
    <div class="tbl"><table><thead><tr><th>Name (as on label)</th><th class="n">Price ₹</th><th class="n">Weight g</th><th class="n">Lasts (days)</th><th></th></tr></thead><tbody>${b.products.map((p, i) => `<tr><td><input data-k="p.${i}.name" value="${esc(p.name)}"></td><td><input data-k="p.${i}.price" inputmode="numeric" value="${p.price}" style="text-align:right"></td><td><input data-k="p.${i}.weight" inputmode="numeric" value="${p.weight || ""}" style="text-align:right" placeholder="g"></td><td><input data-k="p.${i}.lasts" inputmode="numeric" value="${p.lasts || ""}" style="text-align:right" placeholder="${Number(settings.refillDays) || 30}"></td><td><button class="btn sm danger" data-x="rmp" data-i="${i}" type="button">Remove</button></td></tr>`).join("")}</tbody></table></div>
    <div class="actions"><button class="btn sm" data-x="addp" type="button">+ Add product</button><span style="flex:1"></span><button class="btn sm danger" data-x="rmb" type="button">Remove brand</button></div>
  </div></details>`;
}
function sampleOrder() {
  const b = device.brand !== "all" ? brandById(device.brand) : settings.brands[0]; const p = b.products[0] || { name: "Sample product", price: 499 };
  return { id: (b.prefix || "OD") + "261015001", brand: b.id, date: today(), name: "Priya Sharma", phone: "9876543210", address: "Flat 4B, Lotus Apartments, 2nd Cross, Andheri West", landmark: "Near Infiniti Mall", city: "Mumbai", state: "Maharashtra", pin: "400053",
    items: [{ name: p.name, price: p.price, qty: 2 }], sub: p.price * 2, disc: 0, ship: 0, total: p.price * 2, pay: "upi", paid: true, courier: "DTDC", service: "Express", awb: "D12345678", weight: 250 };
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  if (device.pinHash) {
    $("#lock").hidden = false; $("#app").hidden = true; $("#lockpin").focus();
    $("#lockform").onsubmit = async e => { e.preventDefault(); if (await sha("od:" + $("#lockpin").value) === device.pinHash) { $("#lock").hidden = true; $("#app").hidden = false; start(); } else { $("#lockerr").hidden = false; $("#lockpin").value = ""; } };
  } else start();
}
// Logged in on the real site but this browser isn't connected yet: connect automatically using the login,
// so every device shows all saved orders without typing the password again.
function autoConnect() {
  if (device.sheetUrl || device.noAuto || !/^https?:$/.test(location.protocol) || /claude|usercontent|localhost|127\.0\.0\.1/.test(location.hostname)) return;
  device.sheetUrl = location.origin + "/api/sync"; device.sheetKey = "login"; device.auto = true; saveDevice();
}
/* ------------------------------------------------------------------ phone alerts (new orders + 6 pm summary) */
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const isInstalled = () => !!(navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches));
const pushOK = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
async function pushState() {
  if (!pushOK()) return isIOS && !isInstalled() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try { const reg = await navigator.serviceWorker.getRegistration("/"); const sub = reg && await reg.pushManager.getSubscription(); return sub ? "on" : "off"; } catch (e) { return "off"; }
}
const b64ToBytes = s => { const b = atob((s + "===".slice((s.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
async function pushApi(body) { const r = await fetch("/api/push", { method: body ? "POST" : "GET", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return r.json(); }
async function enablePush() {
  try {
    const perm = await Notification.requestPermission(); // must run straight from the tap
    if (perm !== "granted") { toast(perm === "denied" ? "Alerts are blocked. Turn them on in iPhone Settings → Notifications → Order Desk." : "Alerts not turned on"); return refreshPushUI(); }
    const reg = await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready;
    const k = await pushApi(); if (!k.ok) throw new Error(k.error || "no key");
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k.key) });
    const label = (isIOS ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Computer") + " · " + new Date().toLocaleDateString("en-IN");
    const s2 = await pushApi({ action: "subscribe", sub: sub.toJSON(), label }); if (!s2.ok) throw new Error(s2.error);
    toast("🔔 Alerts are on for this phone"); pushApi({ action: "test" }).catch(() => {});
  } catch (e) { toast("Couldn't turn on alerts: " + (e && e.message || "please try again")); }
  refreshPushUI();
}
async function disablePush() {
  try { const reg = await navigator.serviceWorker.getRegistration("/"); const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await pushApi({ action: "unsubscribe", endpoint: sub.endpoint }); await sub.unsubscribe(); } toast("Alerts turned off on this phone"); } catch (e) { toast("Couldn't turn off alerts"); }
  refreshPushUI();
}
const PUSH_TEXT = {
  install: "To get alerts on iPhone, open Order Desk from its icon on your Home Screen (not from Safari), then turn alerts on there.",
  unsupported: "This browser can't show alerts. On iPhone, use the Order Desk app on your Home Screen.",
  denied: "Alerts are blocked for this app. Turn them on in iPhone Settings → Notifications → Order Desk, then come back.",
};
async function refreshPushUI() {
  const st = await pushState();
  const ban = $("#pushbanner");
  if (ban) { let hide = false; try { hide = localStorage.getItem("od1.pushHide") === "1"; } catch (e) {}
    ban.innerHTML = (st === "off" || st === "install") && !hide ? `<section class="card pushban"><span class="pb-ic" aria-hidden="true">🔔</span><div><b>Get a pop-up for every new order</b><p>${st === "install" ? esc(PUSH_TEXT.install) : "Plus a summary after the 6 pm pickup, with any orders not dispatched."}</p></div>
      <div class="pb-act">${st === "off" ? `<button class="btn hi sm" type="button" data-push="on">Turn on alerts</button>` : ""}<button class="btn ghost sm" type="button" data-push="hide">Not now</button></div></section>` : ""; }
  const card = $("#pushcard");
  if (card) card.innerHTML = `<h2>Phone alerts</h2>
    <p class="hint">A pop-up for every new order from the form, and a summary after the 6 pm pickup (orders today, dispatched, and who is still pending).</p>
    ${st === "on" ? `<p><span class="tag t-del">On for this phone</span></p><div class="actions"><button class="btn sm" type="button" data-push="test">Send a test alert</button><button class="btn sm" type="button" data-push="summary">Send today's summary now</button><button class="btn sm ghost" type="button" data-push="off">Turn off on this phone</button></div>`
    : st === "off" ? `<div class="actions"><button class="btn hi" type="button" data-push="on">🔔 Turn on alerts on this phone</button></div>`
    : `<p class="hint"><b>${esc(PUSH_TEXT[st])}</b></p>`}
    <p class="hint">Each phone turns alerts on once. Staff phones can do the same after signing in.</p>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-push]"); if (!b) return; const a = b.dataset.push;
  if (a === "on") enablePush();
  if (a === "off") disablePush();
  if (a === "hide") { try { localStorage.setItem("od1.pushHide", "1"); } catch (x) {} refreshPushUI(); }
  if (a === "test" || a === "summary") { b.disabled = true; pushApi({ action: a }).then(r => toast(r.ok ? (r.sent ? (a === "test" ? "Test alert sent" : "Summary sent") + " to " + r.sent + " phone" + (r.sent > 1 ? "s" : "") : "No phone received it. Turn alerts off and on again.") : "Couldn't send")).catch(() => toast("Couldn't send")).finally(() => { b.disabled = false; }); }
});
function start() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  if (navigator.clearAppBadge) { navigator.clearAppBadge().catch(() => {}); document.addEventListener("visibilitychange", () => { if (!document.hidden) navigator.clearAppBadge().catch(() => {}); }); }
  autoConnect();
  if (settings.autoForm !== false && inbox.length) autoImport().then(n => { if (n) render(); });
  render(); syncState("", device.sheetUrl ? "Not synced" : "Local only");
  if (device.sheetUrl) syncNow(true);
  window.addEventListener("online", () => device.sheetUrl && syncNow(true));
  setInterval(() => { if (device.sheetUrl && !document.hidden) syncNow(true); }, 60000); // picks up new address-form replies every minute
  document.addEventListener("visibilitychange", () => { if (!document.hidden && device.sheetUrl) syncNow(true); });
}
// libraries load with defer; re-render once they're ready so barcodes appear
window.addEventListener("load", () => { if (!$("#app").hidden) render(); });
let lateSeen = -1; setInterval(() => { if ($("#app").hidden) return; const n = live().filter(o => daysLate(o) > 0).length; if (lateSeen !== -1 && n !== lateSeen && ["dashboard", "dispatch"].includes(route())) render(); lateSeen = n; }, 60000);
boot();
})();
