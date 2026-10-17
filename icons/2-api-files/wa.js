// api/wa.js  (put this file in the "api" folder of your Vercel project, next to sync.js)
//
// The Order Desk calls this to send two approved WhatsApp messages. Your keys never go to the browser.
//   1. When you print a label:                      "Your order is getting ready"
//   2. When you press "Save & mark dispatched":     "Your order is on the way" + tracking number
//
// It can send in one of two ways, and picks by itself from what you put in Vercel:
//   A. Through Meta directly (WhatsApp Business Cloud API). Used when AISENSY_API_KEY is not there.
//   B. Through AiSensy (a WhatsApp Business partner).       Used when AISENSY_API_KEY is there.
//
// Vercel > your project > Settings > Environment Variables, then Redeploy:
//   ORDER_DESK_PASSWORD     already there. Same password the Order Desk uses. Only a signed-in Order Desk can use this file
//                           (it accepts the same sign-in as api/sync.js: the 180-day cookie, or the password).
//
//   For A (Meta):
//   WA_TOKEN                Meta permanent access token
//   WA_PHONE_ID             Meta "Phone number ID" (a long number, not the phone number)
//   WA_TEMPLATE             approved name of message 1. Default: order_getting_ready
//   WA_TEMPLATE_TRACK       approved name of message 2. Default: order_on_the_way
//   WA_LANG                 language code of both messages. Default: en
//
//   For B (AiSensy):
//   AISENSY_API_KEY         your AiSensy API key (AiSensy > Manage > API key)
//   AISENSY_CAMPAIGN        name of the AiSensy API campaign for message 1. Default: order_getting_ready
//   AISENSY_CAMPAIGN_TRACK  name of the AiSensy API campaign for message 2. Default: order_on_the_way
//
//   WA_PROVIDER             only if both A and B are filled in: "meta" or "aisensy" says which one to use.

const { createHmac, timingSafeEqual } = require("node:crypto");

// compares two secrets without leaking how many letters matched (both are hashed to the same length first)
const mac = v => createHmac("sha256", "order-desk-wa").update(String(v ?? "")).digest();
const same = (a, b) => timingSafeEqual(mac(a), mac(b));
// Meta and AiSensy refuse new lines, tabs and long runs of spaces inside the blanks of a template
const one = v => String(v ?? "").replace(/\s+/g, " ").trim();
// cuts at n characters without splitting an emoji in half (half an emoji is not valid text and WhatsApp may refuse it)
const cut = (v, n) => { const a = Array.from(v); return a.length > n ? a.slice(0, n).join("").trim() : v; };
const cfg = () => ({
  base: (process.env.WA_API_BASE || "https://graph.facebook.com").replace(/\/+$/, ""),
  version: process.env.WA_API_VERSION || "v22.0",
  password: (process.env.ORDER_DESK_PASSWORD || "").trim(),
  token: (process.env.WA_TOKEN || "").trim(),
  phoneId: (process.env.WA_PHONE_ID || "").trim(),
  template: (process.env.WA_TEMPLATE || "order_getting_ready").trim(),
  templateTrack: (process.env.WA_TEMPLATE_TRACK || "order_on_the_way").trim(),
  lang: (process.env.WA_LANG || "en").trim(),
  provider: (process.env.WA_PROVIDER || "").trim().toLowerCase(),
  asBase: (process.env.AISENSY_API_BASE || "https://backend.aisensy.com").replace(/\/+$/, ""),
  asKey: (process.env.AISENSY_API_KEY || "").trim(),
  asCampaign: (process.env.AISENSY_CAMPAIGN || "order_getting_ready").trim(),
  asCampaignTrack: (process.env.AISENSY_CAMPAIGN_TRACK || "order_on_the_way").trim(),
});

// Which way to send: AiSensy when its key is there (unless WA_PROVIDER says "meta"); WA_PROVIDER=aisensy forces it.
const useAisensy = c => c.provider === "aisensy" || (c.provider !== "meta" && !!c.asKey);
// Which way the owner seems to be setting up. Only used to word the "not set up yet" answer. "" = nothing is filled in yet.
const wayOf = c => useAisensy(c) ? "aisensy" : (c.provider === "meta" || c.token || c.phoneId) ? "meta" : "";
const NOT_SET_UP = {
  meta: "WhatsApp (Meta) is not set up on your site yet.",
  aisensy: "WhatsApp (AiSensy) is not set up on your site yet. Add AISENSY_API_KEY in Vercel (see the setup steps).",
  "": "WhatsApp is not set up on your site yet. Add your AiSensy key (AISENSY_API_KEY) or your Meta keys in Vercel (see the setup steps).",
};

const UNSURE = "Meta did not answer in time, so I can't tell if this message went. Check with the customer before sending it again.";
const UNSURE_AS = "AiSensy did not answer in time, so I can't tell if this message went. Check with the customer before sending it again.";

// ---------------------------------------------------------------------------------------------- Meta
// Meta's error numbers, in plain words.
//   fatal  = the same problem would hit every customer, so the app stops trying the rest.
//   unsure = Meta may have sent it anyway, so the app never sends it again by itself.
function explain(code, message, status, track) {
  const c = Number(code), m = one(message), fatal = error => ({ error, fatal: true });
  if ([190, 102, 463, 467].includes(c)) return fatal("Meta says the access token is wrong or has expired. Make a new permanent token and put it in WA_TOKEN on Vercel.");
  if ([3, 10, 200, 299].includes(c)) return fatal("The Meta token is not allowed to send WhatsApp messages. Make the token again and tick whatsapp_business_messaging.");
  if (c === 100 && /does not exist|unsupported (get|post) request|cannot be loaded/i.test(m)) return fatal("Meta could not find your WhatsApp number. Check that WA_PHONE_ID is the Phone number ID (not the phone number).");
  if (c === 132001) return fatal(track
    ? "Meta could not find the tracking message. In Meta, make a message named order_on_the_way (language English) and wait until it shows Approved. The setup steps show how. If you used another name or language, put it in WA_TEMPLATE_TRACK and WA_LANG on Vercel."
    : "Meta could not find the message template. Check WA_TEMPLATE (name) and WA_LANG (language), and that it shows Approved in Meta.");
  if ([132000, 132012, 132018].includes(c)) return fatal(track
    ? "The message does not match the approved tracking template. It must have exactly 6 blanks: name, order number, items, courier, tracking number, tracking link."
    : "The message does not match the approved template. The template must have exactly 3 blanks: name, order number, items.");
  if ([132007, 132015, 132016].includes(c)) return fatal("Meta has paused or rejected this message template. Open WhatsApp Manager > Message templates to see why.");
  if (c === 132005) return { error: "The message came out too long for Meta (the list of items is probably very long). Tap WhatsApp to send this one by hand." };
  if (c === 131042) return fatal("Meta needs a payment method on your WhatsApp Business account. Add one in WhatsApp Manager > Payment settings.");
  if (c === 131030) return fatal("This number is not on Meta's allowed list. Meta's free test number can only message 5 numbers that you add in Meta > API Setup. Connect your own WhatsApp Business number to message customers.");
  if (c === 131031) return fatal("Meta has locked your WhatsApp Business account. Open WhatsApp Manager to see why.");
  if (c === 133010) return fatal("This WhatsApp number is not registered with Meta yet. Finish adding the number in WhatsApp Manager.");
  if ([4, 17, 32, 613, 80007, 130429, 131048].includes(c)) return fatal("Meta says too many messages too fast. Wait a few minutes, then tap WhatsApp to send by hand.");
  if (c === 131056) return { error: "WhatsApp says too many messages went to this customer lately. Try again later, or tap WhatsApp to send by hand." };
  if (c === 131021) return { error: "You cannot send to the same number the messages come from. Use another phone for the test." };
  if (c === 131026) return { error: "WhatsApp could not deliver to this number. Is it on WhatsApp?" };
  if (c === 131049) return { error: "WhatsApp held this message back to protect the customer. Try again later." };
  if (status >= 500 || [1, 2].includes(c)) return { unsure: true, error: "Meta is not answering right now, so I can't tell if this message went. Check with the customer before sending it again." };
  return { error: "Meta did not send it" + (m ? ": " + m.slice(0, 160) : ".") };
}

async function check(c) { // is the key + phone ID good? Free call, sends nothing.
  try {
    const r = await fetch(`${c.base}/${c.version}/${encodeURIComponent(c.phoneId)}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${c.token}` }, signal: AbortSignal.timeout(6000) });
    const j = await r.json().catch(() => ({}));
    // track:true tells the Order Desk that this wa.js also knows the tracking message. An old wa.js does not say it,
    // so a new Order Desk page never sends a tracking number through an old wa.js (it would send the wrong message).
    if (r.ok && j.id) return { ok: true, ready: true, track: true, via: "meta", number: j.display_phone_number || "", name: j.verified_name || "" };
    const e = j.error || {};
    if ([190, 102, 463, 467].includes(Number(e.code)) || (Number(e.code) === 100 && /does not exist|unsupported get request/i.test(e.message || ""))) return { ok: false, via: "meta", ...explain(e.code, e.message, r.status) };
  } catch (e) { /* can't tell: don't block sending */ }
  return { ok: true, ready: true, track: true, via: "meta" };
}

// ------------------------------------------------------------------------------------------- AiSensy
// AiSensy does not publish the texts of its errors, so this reads what the answer says. A text it does not know is shown
// to the owner in AiSensy's own words ("AiSensy did not send it: ...").
//   fatal  = the same problem would hit every customer, so the app stops trying the rest.
//   tpl    = it only hurts this one message (the other message can still go).
//   unsure = AiSensy may have sent it anyway, so the app never sends it again by itself.
function explainAs(status, message, c, track) {
  const m = one(message), fatal = (error, tpl) => ({ error, fatal: true, ...(tpl ? { tpl: true } : {}) });
  const name = track ? c.asCampaignTrack : c.asCampaign, env = track ? "AISENSY_CAMPAIGN_TRACK" : "AISENSY_CAMPAIGN";
  if (status >= 500 || status === 408) return { unsure: true, error: "AiSensy is not answering right now, so I can't tell if this message went. Check with the customer before sending it again." };
  if (/\b(plan|subscription|upgrade|trial)\b/i.test(m)) return fatal("AiSensy says your plan does not allow sending by API (or your free trial has ended). Start the AiSensy free trial or pick the Basic plan or higher, then try again.");
  if (status === 401 || status === 403 || /api[\s_-]?key|unauthori[sz]ed|authenticat|invalid (key|token)|forbidden/i.test(m)) return fatal("AiSensy says the API key is wrong. In AiSensy open Manage > API key, make a new key, and put it in AISENSY_API_KEY on Vercel.");
  if (/\b(balance|credits?|wallet|recharge|insufficient|funds?)\b/i.test(m)) return fatal("AiSensy says there is not enough money in your wallet. Add money in AiSensy, then try again.");
  if (/(count|number|length|mismatch|expected|required|match).{0,40}(param|variable)|(param|variable).{0,40}(count|number|length|mismatch|expected|required|match)/i.test(m)) return fatal(track
    ? "The message does not match the AiSensy template. It must have exactly 6 blanks: name, order number, items, courier, tracking number, tracking link."
    : "The message does not match the AiSensy template. It must have exactly 3 blanks: name, order number, items.", true);
  if (/campaign|template/i.test(m) || status === 404) return fatal(`AiSensy could not use the API campaign “${name}”. In AiSensy open Campaigns, make an API campaign with exactly this name, pick the approved message, and set it Live. If you used another name, put it in ${env} on Vercel.`, true);
  if (status === 429 || /too many|rate.?limit|throttl/i.test(m)) return fatal("AiSensy says too many messages too fast. Wait a few minutes, then tap WhatsApp to send by hand.");
  if (/destination|phone|mobile|opt.?out|undeliver|not on whatsapp|invalid number|number is/i.test(m)) return { error: "AiSensy could not send to this number. Is it on WhatsApp?" + (m ? " (AiSensy said: " + m.slice(0, 120) + ")" : "") }; // AiSensy's own words stay, in case the reason is another one
  return { error: "AiSensy did not send it" + (m ? ": " + m.slice(0, 160) : " (answer " + (status || "?") + ").") };
}

async function sendAs(c, track, values, to) {
  const payload = { apiKey: c.asKey, campaignName: track ? c.asCampaignTrack : c.asCampaign, destination: "+91" + to, userName: values[0], templateParams: values };
  let r, text = "";
  try {
    r = await fetch(`${c.asBase}/campaign/t1/api/v2`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) });
    text = await r.text();
  } catch (e) {
    // no answer in time: the request may already have reached AiSensy. (If AiSensy had already said "OK" and only the end of its answer was lost, that is still a yes.)
    return r && r.ok ? { ok: true, id: "" } : { ok: false, unsure: true, error: UNSURE_AS };
  }
  let j = null; try { j = JSON.parse(text); } catch (e) { j = null; }
  const obj = j && typeof j === "object" && !Array.isArray(j) ? j : null;
  const page = !obj && /^\s*</.test(text); // a web page instead of an answer (wrong address, or something in between)
  if (r.ok && page) return { ok: false, unsure: true, error: UNSURE_AS };
  const said = obj ? (obj.message || obj.error || obj.msg || obj.detail || obj.reason || "") : (page ? "" : text); // a web page as the answer is not shown
  const msg = one(typeof said === "string" ? said : JSON.stringify(said)).slice(0, 300);
  const refused = !!obj && (obj.success === false || String(obj.success).toLowerCase() === "false" || (!!obj.error && !obj.submitted_message_id));
  if (r.ok && !refused) return { ok: true, id: obj ? String(obj.submitted_message_id || obj.messageId || obj.message_id || obj.id || "") : "" };
  return { ok: false, ...explainAs(r.ok ? 400 : r.status, msg, c, track), code: r.status };
}

// -------------------------------------------------------------------------------------------- handler
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}
// Reads the request whichever way Vercel hands it over (already read as an object or as text, or still to be read). Anything odd becomes {}.
async function readBody(req) {
  let b;
  try { b = req.body; } catch (e) { return {}; } // Vercel could not read it (broken JSON)
  if (b === undefined || b === null) {
    const chunks = []; let size = 0;
    try { for await (const ch of req) { size += ch.length; if (size > 100000) return {}; chunks.push(ch); } } catch (e) { return {}; }
    b = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { return {}; } }
  return b && typeof b === "object" && !Array.isArray(b) ? b : {};
}

// Who may use this: the same people as api/sync.js. A signed-in Order Desk (secure cookie, or the older browser login) or someone who sends the password.
function loginPass(req) { // the older browser login (Basic)
  const h = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  if (!h.startsWith("Basic ")) return "";
  try { const d = Buffer.from(h.slice(6).trim(), "base64").toString("utf8"); return d.slice(d.indexOf(":") + 1).trim(); } catch (e) { return ""; }
}
function sessionOk(req, password) { // signed in through the Order Desk login screen (the 180-day cookie)
  const m = String((req.headers && req.headers.cookie) || "").match(/(?:^|;\s*)od_session=([^;]+)/); if (!m) return false;
  let raw; try { raw = decodeURIComponent(m[1]); } catch (e) { return false; }
  const [exp, sig] = raw.split("."); if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const want = createHmac("sha256", password).update("od-session:" + exp).digest("hex");
  return want.length === sig.length && timingSafeEqual(Buffer.from(want), Buffer.from(sig));
}
const allowed = (req, key, password) => same(String(key ?? "").trim(), password) || same(loginPass(req), password) || sessionOk(req, password);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(res, 405, { ok: false, error: "Use POST." }); }
  const b = await readBody(req);

  const c = cfg();
  if (!c.password) return send(res, 500, { ok: false, error: "ORDER_DESK_PASSWORD is not set on your site." });
  if (!allowed(req, b.key, c.password)) { await new Promise(r => setTimeout(r, 400)); return send(res, 401, { ok: false, error: "wrong key" }); }
  const as = useAisensy(c), way = wayOf(c);
  if (as ? !c.asKey : (!c.token || !c.phoneId)) return send(res, 200, { ok: false, setup: true, ...(way ? { via: way } : {}), error: NOT_SET_UP[way] });

  // AiSensy has no free "is the key good?" call, so this only says the key is there. The Test buttons in Settings send a real message to the owner's own number.
  if (b.ping) return send(res, 200, as ? { ok: true, ready: true, track: true, via: "aisensy" } : await check(c));

  // kind "ready" (or nothing) = "your order is getting ready" (3 blanks). kind "track" = "your order is on the way" (6 blanks).
  const kind = b.kind === undefined || b.kind === "ready" ? "ready" : b.kind === "track" ? "track" : "";
  if (!kind) return send(res, 200, { ok: false, error: "The Order Desk asked for a message this wa.js does not know. Put the newest api/wa.js on your site." });
  const track = kind === "track";

  const to = String(b.to ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(to)) return send(res, 200, { ok: false, error: "That is not a valid Indian mobile number." });
  const order = one(b.order);
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(order)) return send(res, 200, { ok: false, error: "The order number is missing or has strange characters." });
  const name = cut(one(b.name), 40) || "there";
  const items = cut(one(b.items), track ? 250 : 500) || "your order";
  const values = [name, order, items];
  if (track) {
    const awb = one(b.awb);
    if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]{2,39}$/.test(awb)) return send(res, 200, { ok: false, error: "The tracking number is missing or has strange characters." });
    const link = one(b.link); // only a real web link goes in; otherwise the message says "the courier's website"
    values.push(cut(one(b.courier), 40) || "our courier partner", awb, /^https?:\/\/[^\s]{3,200}$/i.test(link) ? link : "the courier's website");
  }

  if (as) return send(res, 200, await sendAs(c, track, values, to));

  const payload = {
    messaging_product: "whatsapp", recipient_type: "individual", to: "91" + to, type: "template",
    template: {
      name: track ? c.templateTrack : c.template, language: { code: c.lang },
      components: [{ type: "body", parameters: values.map(text => ({ type: "text", text })) }],
    },
  };
  let r, j;
  try {
    r = await fetch(`${c.base}/${c.version}/${encodeURIComponent(c.phoneId)}/messages`, {
      method: "POST", headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
    });
    j = await r.json().catch(() => ({}));
  } catch (e) { return send(res, 200, { ok: false, unsure: true, error: UNSURE }); } // the request may already have reached Meta

  const id = j && j.messages && j.messages[0] && j.messages[0].id;
  if (r.ok && id) return send(res, 200, { ok: true, id });
  if (r.ok) return send(res, 200, { ok: false, unsure: true, error: UNSURE }); // Meta said OK but the answer was cut short
  const e = (j && j.error) || {};
  return send(res, 200, { ok: false, ...explain(e.code, e.message, r.status, track), code: e.code || r.status });
}
