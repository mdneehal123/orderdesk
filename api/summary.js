// Order Desk — the evening summary alert. Vercel runs this once a day (see "crons" in vercel.json).
// It only ever sends to your own phones, at most once per day, and never returns any order details.
const P = require("./_push");

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store");
  const secret = process.env.CRON_SECRET; // optional: if set in Vercel, only Vercel's scheduler can run this
  if (secret && req.headers.authorization !== "Bearer " + secret) { res.statusCode = 401; return res.end('{"ok":false}'); }
  const istHour = new Date(Date.now() + 330 * 60000).getUTCHours();
  if (istHour < 18) { res.statusCode = 200; return res.end('{"ok":true,"skipped":"before 6 pm"}'); }
  const first = await P.redis(["SET", "od:summary:" + P.istToday(), "1", "NX", "EX", 172800]); // once per day
  if (first !== "OK") { res.statusCode = 200; return res.end('{"ok":true,"skipped":"already sent"}'); }
  const r = await P.notifyAll(await P.buildSummary());
  res.statusCode = 200; res.end(JSON.stringify({ ok: true, sent: r.sent }));
};
