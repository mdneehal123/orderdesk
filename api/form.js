// Order Desk — PUBLIC endpoint for the customer address form (/form).
// Saves each submission into an "inbox" that only you see inside the Order Desk.
// Has a spam trap and a per-device limit so it can't be flooded.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const INBOX = "od:inbox";

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
function send(res, code, obj) {
  res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
const clean = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method not allowed" });
  if (!URL_ || !TOKEN) return send(res, 503, { ok: false, error: "The form isn't connected yet. Please send your address on WhatsApp." });
  try {
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true }); // spam trap: bots fill hidden fields

    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "x").split(",")[0].trim();
    const rk = "od:rl:" + ip; const n = await redis(["INCR", rk]); if (n === 1) await redis(["EXPIRE", rk, 3600]);
    if (n > 15) return send(res, 429, { ok: false, error: "Too many submissions. Please try again in an hour, or message us on WhatsApp." });

    const phone = String(b.phone || "").replace(/\D/g, "").slice(-10);
    const alt = String(b.alt || "").replace(/\D/g, "").slice(-10);
    const pin = String(b.pin || "").replace(/\D/g, "");
    const f = {
      name: clean(b.name, 80), phone, alt: alt.length === 10 ? alt : "",
      house: clean(b.house, 160), area: clean(b.area, 200), landmark: clean(b.landmark, 120),
      pin, city: clean(b.city, 60), state: clean(b.state, 60),
      pay: "upi", // the public form takes prepaid orders only (COD goes via Delhivery from the Order Desk)
      note: clean(b.note, 300), wish: clean(b.wish, 300), utr: clean(b.utr, 24),
      loc: /^-?\d{1,3}\.\d+,-?\d{1,3}\.\d+$/.test(String(b.loc || "")) ? String(b.loc) : "",
      ref: b.ref && typeof b.ref === "object" ? {
        b: clean(b.ref.b, 20), bn: clean(b.ref.bn, 60), p: clean(b.ref.p, 4), t: Number(b.ref.t) || 0,
        i: Array.isArray(b.ref.i) ? b.ref.i.slice(0, 20).map(x => [clean(x[0], 30), clean(x[1], 120), Math.max(1, Math.min(99, Number(x[2]) || 1)), Number(x[3]) || 0]) : [],
      } : null,
    };
    const errs = [];
    if (f.name.length < 2) errs.push("name");
    if (!/^[6-9]\d{9}$/.test(phone)) errs.push("10-digit mobile number");
    if (f.house.length < 2 || f.area.length < 2) errs.push("full address");
    if (!/^[1-9]\d{5}$/.test(pin)) errs.push("6-digit pincode");
    if (errs.length) return send(res, 400, { ok: false, error: "Please check: " + errs.join(", ") + "." });

    const id = "F" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
    f.id = id; f.receivedAt = new Date().toISOString();
    await redis(["HSET", INBOX, id, JSON.stringify(f)]);
    return send(res, 200, { ok: true, id });
  } catch (e) {
    return send(res, 500, { ok: false, error: "Something went wrong. Please send your address on WhatsApp instead." });
  }
};
