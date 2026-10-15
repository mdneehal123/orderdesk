// Order Desk — turn phone alerts on/off and send test alerts. Private: needs you to be signed in.
const P = require("./_push");

function send(res, code, obj) { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(obj)); }
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch (e) { return {}; }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const k = await P.vapidKeys(); if (!k) return send(res, 500, { ok: false, error: "Database not connected" });
      return send(res, 200, { ok: true, key: k.pub, phones: await P.countSubs() });
    }
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method not allowed" });
    const b = await readBody(req);
    if (b.action === "subscribe") { if (!(await P.saveSub(b.sub, b.label))) return send(res, 400, { ok: false, error: "Bad subscription" }); return send(res, 200, { ok: true, phones: await P.countSubs() }); }
    if (b.action === "unsubscribe") { await P.removeSub(b.endpoint); return send(res, 200, { ok: true }); }
    if (b.action === "test") { const r = await P.notifyAll({ title: "🔔 Alerts are on", body: "You'll get a pop-up for every new order, and a summary after the 6 pm pickup.", url: "/#dashboard", tag: "test" }); return send(res, 200, { ok: true, ...r }); }
    if (b.action === "summary") { const r = await P.notifyAll(await P.buildSummary()); return send(res, 200, { ok: true, ...r }); }
    return send(res, 400, { ok: false, error: "Unknown action" });
  } catch (e) { return send(res, 500, { ok: false, error: "Something went wrong" }); }
};
