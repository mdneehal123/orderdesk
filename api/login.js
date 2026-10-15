// Order Desk — sign in. Checks the password and sets a secure cookie that keeps you signed in for 180 days.
const crypto = require("crypto");

const envFind = (ends) => { const e = process.env; for (const k of ends) if (e[k]) return e[k];
  const hit = Object.keys(e).find(k => ends.some(s => k.endsWith("_" + s)) && !/READ_ONLY/.test(k)); return hit ? e[hit] : ""; };
const URL_ = envFind(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]);
const TOKEN = envFind(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);
const PASSWORD = (process.env.ORDER_DESK_PASSWORD || "").trim();
const DAYS = 180;

async function redis(cmd) {
  if (!URL_ || !TOKEN) return null;
  try { const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) }); return (await r.json()).result; } catch (e) { return null; }
}
function send(res, code, obj, extra) {
  res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store");
  if (extra) for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}
const sessionToken = (exp) => exp + "." + crypto.createHmac("sha256", PASSWORD).update("od-session:" + exp).digest("hex");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method not allowed" });
  if (!PASSWORD) return send(res, 500, { ok: false, error: "Set ORDER_DESK_PASSWORD in Vercel, then redeploy." });

  // Slow down guessing: at most 10 wrong tries per hour from one connection.
  const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket?.remoteAddress || "x").trim();
  const rk = "od:login:" + ip;
  const tries = Number(await redis(["GET", rk])) || 0;
  if (tries >= 10) return send(res, 429, { ok: false, error: "Too many tries. Please wait an hour and try again." });

  const body = await readBody(req);
  const given = String(body.password || "").trim();
  const a = Buffer.from(given), b = Buffer.from(PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) { await redis(["INCR", rk]); await redis(["EXPIRE", rk, 3600]); return send(res, 401, { ok: false, error: "Wrong password" }); }

  await redis(["DEL", rk]);
  const exp = Date.now() + DAYS * 864e5;
  const cookie = `od_session=${encodeURIComponent(sessionToken(exp))}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
  return send(res, 200, { ok: true }, { "Set-Cookie": cookie });
};
