// Order Desk — makes the WHOLE site private.
// Every page and the order data ask for a login first (except the customer address form at /form).
// Username: anything (e.g. "admin"). Password: ORDER_DESK_PASSWORD from Vercel → Settings → Environment Variables.
export const config = { matcher: "/:path*" };

export default function middleware(request) {
  // The customer address form is the ONLY public part.
  const path = new URL(request.url).pathname;
  if (path === "/form" || path.startsWith("/form/") || path === "/api/form" || path === "/api/catalog") return;

  const password = (process.env.ORDER_DESK_PASSWORD || "").trim();
  const auth = request.headers.get("authorization") || "";
  if (password && auth.startsWith("Basic ")) {
    try {
      const bin = atob(auth.slice(6).trim());
      const decoded = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); // works with any characters
      const given = decoded.slice(decoded.indexOf(":") + 1).trim();
      if (given === password) return; // allowed: continue to the site
    } catch (e) { /* fall through to the login prompt */ }
  }
  return new Response(password ? "Login required. Username: anything. Password: your ORDER_DESK_PASSWORD." : "No password found. Add ORDER_DESK_PASSWORD in Vercel (Settings → Environment Variables), then Redeploy.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Order Desk (private)", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
