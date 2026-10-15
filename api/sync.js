// Order Desk — online storage on your own Vercel site.
// Uses the Upstash Redis database you connect in Vercel → Storage (free plan is enough).
// Set ORDER_DESK_PASSWORD in Vercel → Settings → Environment Variables.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
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

module.exports = async function handler(req, res) {
  try {
    if (!URL_ || !TOKEN) return send(res, 500, { ok: false, error: "Database not connected. In Vercel open Storage, create an Upstash Redis database and connect it to this project, then redeploy." });
    if (!PASSWORD) return send(res, 500, { ok: false, error: "Set ORDER_DESK_PASSWORD in Vercel → Settings → Environment Variables, then redeploy." });

    if (req.method === "GET") {
      const key = (req.query && req.query.key) || new URL(req.url, "http://x").searchParams.get("key");
      if (key !== PASSWORD) return send(res, 401, { ok: false, error: "wrong key" });
      const vals = (await redis(["HVALS", ORDERS])) || [];
      const orders = vals.map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
      const s = await redis(["GET", SETTINGS]);
      const inbox = ((await redis(["HVALS", INBOX])) || []).map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
      return send(res, 200, { ok: true, orders, settings: s ? JSON.parse(s) : null, inbox });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      if (body.key !== PASSWORD) return send(res, 401, { ok: false, error: "wrong key" });
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
