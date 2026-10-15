// Order Desk — sign out on this device.
module.exports = async function handler(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", "od_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax");
  res.end(JSON.stringify({ ok: true }));
};
