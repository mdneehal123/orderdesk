// api/wa-hook.js  (put this file in the "api" folder of your Vercel project, next to wa.js)
//
// This is the "webhook" address that Meta asks for when you set up WhatsApp. Meta uses it for two things:
//   1. A one-time check that the address really belongs to you. This file answers that check.
//   2. Later, news about your messages (sent, delivered, read, failed) and customer replies.
//      This file says "OK" to the news and throws it away. It stores nothing and sends nothing.
// The Order Desk sends its messages without any of this, so the webhook is optional.
//
// In Meta you type:
//   Callback URL   https://YOUR-ORDER-DESK-ADDRESS/api/wa-hook
//   Verify token   orderdesk
// To use your own word instead of "orderdesk": add WA_VERIFY in Vercel with that word, Redeploy, and type the same word in Meta.
//
// Meta cannot sign in to your Order Desk, so middleware.js lets this one address through without the login.
// That is safe: the file only answers Meta's check, and anything else gets "OK" or "Forbidden".

const { createHmac, timingSafeEqual } = require("node:crypto");

// compares two words without leaking how many letters matched (both are hashed to the same length first)
const mac = v => createHmac("sha256", "order-desk-wa").update(String(v ?? "")).digest();
const same = (a, b) => timingSafeEqual(mac(a), mac(b));

function send(res, code, body, type) {
  res.statusCode = code;
  res.setHeader("Content-Type", type || "text/plain; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(body);
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Meta's check: GET ...?hub.mode=subscribe&hub.verify_token=<your word>&hub.challenge=<a number>
  // Answer with the number, as plain text, only when the word is right.
  if (req.method === "GET") {
    let q;
    try { q = new URL(req.url || "/", "http://x").searchParams; } catch (e) { q = new URLSearchParams(); }
    const word = (process.env.WA_VERIFY || "").trim() || "orderdesk";
    const given = q.get("hub.verify_token");
    const challenge = q.get("hub.challenge");
    if (q.get("hub.mode") === "subscribe" && given && challenge && same(given, word)) return send(res, 200, challenge);
    return send(res, 403, "Forbidden");
  }

  // News from Meta: say OK straight away (Meta asks again if it does not hear back in a few seconds) and do nothing else.
  if (req.method === "POST") return send(res, 200, '{"ok":true}', "application/json");

  res.setHeader("Allow", "GET, POST");
  return send(res, 405, "Use GET or POST.");
};
