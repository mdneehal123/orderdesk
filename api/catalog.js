// Order Desk — PUBLIC product list for the customer address form.
// Shares only brand names, product names and prices from your Settings. Nothing else.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  try {
    if (!URL_ || !TOKEN) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false })); }
    const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(["GET", "od:settings"]) });
    const j = await r.json(); const s = j.result ? JSON.parse(j.result) : null;
    const want = (req.query && req.query.b) || new URL(req.url, "http://x").searchParams.get("b") || "";
    const brands = ((s && s.brands) || [])
      .filter(b => !want || b.id === want)
      .map(b => ({ id: b.id, name: b.name, color: b.color, w: String((b.from && b.from.phone) || "").replace(/\D/g, "").slice(-10),
        products: (b.products || []).filter(p => p.name && Number(p.price) > 0).map(p => ({ id: p.id, name: p.name, price: Number(p.price) })) }))
      .filter(b => b.products.length);
    res.statusCode = 200; res.end(JSON.stringify({ ok: true, brands }));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ ok: false })); }
};
