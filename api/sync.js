// Order Desk — online storage on your own Vercel site.
// Uses the Upstash Redis database you connect in Vercel → Storage (free plan is enough).
// Set ORDER_DESK_PASSWORD in Vercel → Settings → Environment Variables.

// Finds the database keys Vercel adds when you connect Upstash Redis, even if they were given a prefix
// (for example STORAGE_KV_REST_API_URL). Read-only tokens are skipped.
const envFind = (ends) => { const e = process.env; for (const k of ends) if (e[k]) return e[k];
  const hit = Object.keys(e).find(k => ends.some(s => k.endsWith("_" + s)) && !/READ_ONLY/.test(k)); return hit ? e[hit] : ""; };
const URL_ = envFind(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]);
const TOKEN = envFind(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);
const PASSWORD = (process.env.ORDER_DESK_PASSWORD || "").trim();
const ORDERS = "od:orders", SETTINGS = "od:settings", INBOX = "od:inbox";

async function redis(cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

// Allowed if the password is sent as "key", OR the browser is already logged in to the site
// (the login box sends the same password with every request as Basic auth).
function loginPass(req) {
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  if (!h.startsWith("Basic ")) return "";
  try { const d = Buffer.from(h.slice(6).trim(), "base64").toString("utf8"); return d.slice(d.indexOf(":") + 1).trim(); } catch (e) { return ""; }
}
// Signed in through the app's login screen (secure 180-day cookie).
function sessionOk(req) {
  const m = String((req.headers && req.headers.cookie) || "").match(/(?:^|;\s*)od_session=([^;]+)/); if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split("."); if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const want = require("crypto").createHmac("sha256", PASSWORD).update("od-session:" + exp).digest("hex");
  return want.length === sig.length && require("crypto").timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
const allowed = (req, key) => String(key || "").trim() === PASSWORD || loginPass(req) === PASSWORD || sessionOk(req);

module.exports = async function handler(req, res) {
  try {
    if (!URL_ || !TOKEN) return send(res, 500, { ok: false, error: "Database not connected. In Vercel open Storage, create an Upstash Redis database and connect it to this project, then redeploy." });
    if (!PASSWORD) return send(res, 500, { ok: false, error: "Set ORDER_DESK_PASSWORD in Vercel → Settings → Environment Variables, then redeploy." });

    if (req.method === "GET") {
      const key = (req.query && req.query.key) || new URL(req.url, "http://x").searchParams.get("key");
      if (!allowed(req, key)) return send(res, 401, { ok: false, error: "wrong key" });
      const vals = (await redis(["HVALS", ORDERS])) || [];
      const orders = vals.map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
      const s = await redis(["GET", SETTINGS]);
      const inbox = ((await redis(["HVALS", INBOX])) || []).map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
      return send(res, 200, { ok: true, orders, settings: s ? JSON.parse(s) : null, inbox });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      if (!allowed(req, body.key)) return send(res, 401, { ok: false, error: "wrong key" });
      if (Array.isArray(body.orders) && body.orders.length) {
        const cmd = ["HSET", ORDERS];
        body.orders.slice(0, 200).forEach(o => { if (o && o.id) cmd.push(String(o.id), JSON.stringify(o)); });
        if (cmd.length > 2) await redis(cmd);
      }
      if (Array.isArray(body.inboxDone) && body.inboxDone.length) await redis(["HDEL", INBOX, ...body.inboxDone.slice(0, 100).map(String)]);
      if (body.settings && typeof body.settings === "object") await redis(["SET", SETTINGS, JSON.stringify(body.settings)]);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { ok: false, error: "Method not allowed" });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e.message || e) });
  }
};
