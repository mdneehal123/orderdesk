// Order Desk — phone alerts (Web Push). Shared helper, not a page (files starting with "_" are private in Vercel).
// No extra packages: uses Node's built-in crypto for the VAPID signature and the aes128gcm encryption (RFC 8291 / 8292).
// The alert keys are created once and kept in your database, so there is nothing to set up in Vercel.
const crypto = require("crypto");

const envFind = (ends) => { const e = process.env; for (const k of ends) if (e[k]) return e[k];
  const hit = Object.keys(e).find(k => ends.some(s => k.endsWith("_" + s)) && !/READ_ONLY/.test(k)); return hit ? e[hit] : ""; };
const URL_ = envFind(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]);
const TOKEN = envFind(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);
const SUBS = "od:push", VAPID = "od:vapid";

async function redis(cmd) {
  if (!URL_ || !TOKEN) return null;
  try { const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) }); return (await r.json()).result; } catch (e) { return null; }
}
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Buffer.from(String(s).replace(/-/g, "+").replace(/_/g, "/"), "base64");

let cachedKeys = null;
async function vapidKeys() {
  if (cachedKeys) return cachedKeys;
  let raw = await redis(["GET", VAPID]);
  if (!raw) {
    const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = privateKey.export({ format: "jwk" });
    await redis(["SET", VAPID, JSON.stringify(jwk), "NX"]); // if two requests race, the first one wins
    raw = await redis(["GET", VAPID]);
    if (!raw) return null;
  }
  const jwk = JSON.parse(raw);
  const pub = b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)]));
  cachedKeys = { jwk, pub, key: crypto.createPrivateKey({ key: jwk, format: "jwk" }) };
  return cachedKeys;
}

function vapidAuth(endpoint, keys) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:orders@skinday.shop" }));
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key: keys.key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.pub}`;
}

function encrypt(sub, payload) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys(); const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPub);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", secret, auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub]), 32));
  const salt = crypto.randomBytes(16);
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}

async function sendOne(sub, msg, keys) {
  const r = await fetch(sub.endpoint, { method: "POST", headers: {
    Authorization: vapidAuth(sub.endpoint, keys), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high",
  }, body: encrypt(sub, JSON.stringify(msg)) });
  return r.status;
}

// Sends one alert to every phone that turned alerts on. Phones that switched alerts off are removed.
async function notifyAll(msg) {
  const keys = await vapidKeys(); if (!keys) return { sent: 0, phones: 0 };
  const all = (await redis(["HGETALL", SUBS])) || [];
  const subs = []; for (let i = 0; i < all.length; i += 2) { try { subs.push([all[i], JSON.parse(all[i + 1]).sub]); } catch (e) {} }
  let sent = 0;
  await Promise.all(subs.map(async ([id, sub]) => {
    try { const s = await sendOne(sub, msg, keys); if (s >= 200 && s < 300) sent++; else if (s === 404 || s === 410) await redis(["HDEL", SUBS, id]); } catch (e) {}
  }));
  return { sent, phones: subs.length };
}
// Waits for the alert at most a few seconds, so a slow phone service never slows down the customer's form.
const notifyQuick = (msg, ms = 4000) => Promise.race([notifyAll(msg).catch(() => null), new Promise(r => setTimeout(r, ms))]);

const subId = (endpoint) => crypto.createHash("sha256").update(String(endpoint)).digest("hex").slice(0, 32);
async function saveSub(sub, label) {
  if (!sub || !/^https:\/\//.test(sub.endpoint || "") || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return false;
  await redis(["HSET", SUBS, subId(sub.endpoint), JSON.stringify({ sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, label: String(label || "").slice(0, 60), at: new Date().toISOString() })]);
  return true;
}
const removeSub = (endpoint) => redis(["HDEL", SUBS, subId(endpoint)]);
const countSubs = async () => Number(await redis(["HLEN", SUBS])) || 0;

// ---- the 6 pm summary ----
const istToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const TOSHIP = ["new", "paid", "packed"];
async function buildSummary() {
  const t = istToday();
  const orders = ((await redis(["HVALS", "od:orders"])) || []).map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(o => o && !o.deleted && o.status !== "cancelled");
  const inbox = ((await redis(["HVALS", "od:inbox"])) || []).map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
  const todays = orders.filter(o => o.date === t).length + inbox.filter(f => (f.receivedAt ? new Date(Date.parse(f.receivedAt) + 330 * 60000).toISOString().slice(0, 10) : "") === t).length;
  const shipped = orders.filter(o => String(o.shippedAt || "").slice(0, 10) === t).length;
  const pending = orders.filter(o => TOSHIP.includes(o.status)).map(o => o.name).concat(inbox.map(f => f.name)).filter(Boolean);
  const first = n => String(n).trim().split(/\s+/)[0];
  const names = pending.slice(0, 6).map(first).join(", ") + (pending.length > 6 ? ` +${pending.length - 6} more` : "");
  return {
    title: pending.length ? `⚠ ${pending.length} order${pending.length > 1 ? "s" : ""} not dispatched` : "✅ All orders dispatched",
    body: `Today: ${todays} order${todays === 1 ? "" : "s"} · ${shipped} dispatched` + (pending.length ? `\nNot dispatched: ${names}` : "\nNothing pending. Great work!"),
    url: pending.length ? "/#dispatch" : "/#dashboard", tag: "summary-" + t,
  };
}

module.exports = { redis, vapidKeys, notifyAll, notifyQuick, saveSub, removeSub, countSubs, buildSummary, istToday, _encrypt: encrypt, _vapidAuth: vapidAuth };
