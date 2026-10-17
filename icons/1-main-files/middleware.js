// Order Desk — makes the WHOLE site private.
// You sign in once on the /login screen; the app remembers you for 180 days (secure cookie).
// Public (no login): the customer order form (/form), its two APIs, the login screen, the app icons and /api/wa-hook (Meta's WhatsApp webhook check; it stores and sends nothing).
// Password: ORDER_DESK_PASSWORD from Vercel → Settings → Environment Variables.
export const config = { matcher: "/:path*" };

const PUBLIC = [/^\/form(\/.*)?$/, /^\/api\/form$/, /^\/api\/catalog$/, /^\/login(\/.*)?$/, /^\/api\/login$/,
  /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/api\/summary$/, /^\/api\/wa-hook$/, /^\/icons\/.*$/, /^\/robots\.txt$/, /^\/favicon\.ico$/];

async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
async function validSession(token, password) {
  const [exp, sig] = String(token || "").split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const want = await hmacHex(password, "od-session:" + exp);
  if (want.length !== sig.length) return false;
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
function cookie(request, name) {
  const m = (request.headers.get("cookie") || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : "";
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (PUBLIC.some(r => r.test(path))) return;

  const password = (process.env.ORDER_DESK_PASSWORD || "").trim();
  if (!password) return new Response("No password found. Add ORDER_DESK_PASSWORD in Vercel (Settings → Environment Variables), then Redeploy.", { status: 503 });

  if (await validSession(cookie(request, "od_session"), password)) return; // signed in

  // Older browser logins (Basic auth) still work, so nobody is locked out during the switch.
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const bin = atob(auth.slice(6).trim());
      const decoded = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
      if (decoded.slice(decoded.indexOf(":") + 1).trim() === password) return;
    } catch (e) { /* ignore */ }
  }

  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (path.startsWith("/api/")) return new Response(JSON.stringify({ ok: false, error: "login required" }), { status: 401, headers: { ...headers, "Content-Type": "application/json" } });
  const next = path + url.search;
  return new Response(null, { status: 302, headers: { ...headers, Location: "/login/?next=" + encodeURIComponent(next) } });
}
