// Order Desk — PUBLIC product list for the customer address form.
// Shares only brand names, product names and prices from your Settings. Nothing else.

// Finds the database keys Vercel adds when you connect Upstash Redis, even if they were given a prefix
// (for example STORAGE_KV_REST_API_URL). Read-only tokens are skipped.
const envFind = (ends) => { const e = process.env; for (const k of ends) if (e[k]) return e[k];
  const hit = Object.keys(e).find(k => ends.some(s => k.endsWith("_" + s)) && !/READ_ONLY/.test(k)); return hit ? e[hit] : ""; };
const URL_ = envFind(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]);
const TOKEN = envFind(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);

// Built-in list, used until your Settings are saved online (same as the desk's defaults).
const PH = "9980881230";
const DEFAULTS = [
  { id: "gx", name: "Glutanex", color: "#1D4E89", w: PH, products: [{ id: "gx1", name: "GlutaNex Glutathione Night Cream 30g", price: 2499 }] },
  { id: "fn", name: "Fair N Pink", color: "#DB2777", w: PH, products: [{ id: "fn1", name: "Fair N Pink Moisturising Night Cream 30g", price: 1999 }, { id: "fn2", name: "Fair N Pink Advanced Cream 10g", price: 999 }] },
  { id: "yf", name: "Youth Face", color: "#C2410C", w: PH, products: [{ id: "yf1", name: "Youth Face Beauty Cream 25g", price: 549 }, { id: "yf2", name: "Beauty Cream Pack of 2", price: 999 }, { id: "yf3", name: "Beauty Cream Pack of 3", price: 1444 }, { id: "yf4", name: "Youth Face Body Lotion 40ml", price: 599 }] },
  { id: "mg", name: "Mirc Glow", color: "#9C5468", w: PH, products: [{ id: "mg1", name: "Avocado Korean Night Cream 25g", price: 649 }, { id: "mg2", name: "Glutathione Cream 30g", price: 1499 }, { id: "mg3", name: "Avocado Night Cream 30g", price: 649 }, { id: "mg4", name: "Avocado Glow Cream 10g", price: 349 }, { id: "mg5", name: "Day & Night Combo", price: 849 }, { id: "mg6", name: "Night Cream Combo", price: 1799 }, { id: "mg7", name: "Korean Glass Skin Kit", price: 1999 }] },
];

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60");
  try {
    const want = (req.query && req.query.b) || new URL(req.url, "http://x").searchParams.get("b") || "";
    let s = null;
    if (URL_ && TOKEN) {
      try { const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(["GET", "od:settings"]) });
        const j = await r.json(); s = j.result ? JSON.parse(j.result) : null; } catch (e) { s = null; }
    }
    const list = s && s.brands && s.brands.length ? s.brands : null;
    if (!list) { res.statusCode = 200; return res.end(JSON.stringify({ ok: true, brands: DEFAULTS.filter(b => !want || b.id === want) })); }
    const brands = list
      .filter(b => !want || b.id === want)
      .map(b => ({ id: b.id, name: b.name, color: b.color, w: String((b.from && b.from.phone) || "").replace(/\D/g, "").slice(-10),
        products: (b.products || []).filter(p => p.name && Number(p.price) > 0).map(p => ({ id: p.id, name: p.name, price: Number(p.price) })) }))
      .filter(b => b.products.length);
    res.statusCode = 200; res.end(JSON.stringify({ ok: true, brands }));
  } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ ok: false })); }
};
