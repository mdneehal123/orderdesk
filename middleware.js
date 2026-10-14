// Order Desk — makes the WHOLE site private.
// Every page and the order data ask for a login first (except the customer address form at /form).
// Username: anything (e.g. "admin"). Password: ORDER_DESK_PASSWORD from Vercel → Settings → Environment Variables.
export const config = { matcher: "/:path*" };

export default function middleware(request) {
  // The customer address form is the ONLY public part.
  const path = new URL(request.url).pathname;
  if (path === "/form" || path.startsWith("/form/") || path === "/api/form" || path === "/api/catalog") return;

  const password = process.env.ORDER_DESK_PASSWORD;
  const auth = request.headers.get("authorization") || "";
  if (password && auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return; // allowed: continue to the site
    } catch (e) { /* fall through to the login prompt */ }
  }
  return new Response(password ? "Login required" : "Set ORDER_DESK_PASSWORD in Vercel to open this site.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Order Desk (private)", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
