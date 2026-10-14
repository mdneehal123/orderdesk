/**
 * Order Desk — Google Sheet backend.
 * Paste this into Extensions → Apps Script of a new Google Sheet.
 * 1. Change SECRET below to your own long password (letters and numbers).
 * 2. Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone → Deploy.
 * 3. Copy the Web app URL into Order Desk → Settings, with the same SECRET.
 */
const SECRET = "CHANGE-ME-to-a-long-secret-1234";

const HEAD = ["Order", "Brand", "Date", "Status", "Name", "Phone", "Pincode", "City", "State", "Items",
  "Total", "Payment", "Paid", "Courier", "AWB", "COD received", "Updated", "Data (do not edit)"];

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (!e || !e.parameter || e.parameter.key !== SECRET) return out_({ ok: false, error: "wrong key" });
  const sh = sheet_("Orders", HEAD);
  const last = sh.getLastRow();
  const orders = [];
  if (last > 1) {
    sh.getRange(2, HEAD.length, last - 1, 1).getValues().forEach(function (r) {
      try { if (r[0]) orders.push(JSON.parse(r[0])); } catch (x) {}
    });
  }
  const st = sheet_("Settings", ["Data (do not edit)", "Updated"]);
  const sv = st.getLastRow() > 1 ? st.getRange(2, 1).getValue() : "";
  return out_({ ok: true, orders: orders, settings: sv ? JSON.parse(sv) : null });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: "bad body" }); }
  if (body.key !== SECRET) return out_({ ok: false, error: "wrong key" });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (body.orders && body.orders.length) {
      const sh = sheet_("Orders", HEAD);
      const last = sh.getLastRow();
      const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
      body.orders.forEach(function (o) {
        const items = (o.items || []).map(function (i) { return i.qty + " x " + i.name; }).join(", ");
        const row = [o.id, o.brand, o.date, o.deleted ? "deleted" : o.status, o.name, "'" + (o.phone || ""), "'" + (o.pin || ""),
          o.city || "", o.state || "", items, o.total || 0, o.pay === "cod" ? "COD" : "UPI", o.pay === "cod" ? "" : (o.paid ? "yes" : "no"),
          o.courier || "", o.awb ? "'" + o.awb : "", o.pay === "cod" ? (o.codSettled ? "yes" : "no") : "", o.updatedAt || "", JSON.stringify(o)];
        const i = ids.indexOf(String(o.id));
        if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
        else { sh.appendRow(row); ids.push(String(o.id)); }
      });
    }
    if (body.settings) {
      const st = sheet_("Settings", ["Data (do not edit)", "Updated"]);
      st.getRange(2, 1, 1, 2).setValues([[JSON.stringify(body.settings), body.settings.updatedAt || ""]]);
    }
    return out_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
