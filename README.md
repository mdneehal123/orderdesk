# Order Desk

This is your private order desk for WhatsApp orders across **Glutanex, Fair N Pink, Youth Face and Mirc Glow**. It saves each order, prints a bold 4 × 6 inch thermal label (DTDC, Shree Maruti or Delhivery), and tracks payments and shipping. **Every order is prepaid (Google Pay / UPI); there is no Cash on Delivery.**

## 1. Put it online on Vercel (10 minutes)

1. On GitHub, create a **private** repository, for example `order-desk`, and upload every file in this folder.
2. On Vercel, choose Add New → Project → Import that repository. Set Framework to **Other**, then Deploy.
3. Optional: in Vercel → Settings → Domains, add `orders.mircglow.com`. Then add the CNAME record Vercel shows you at your domain registrar.

**The site is private.** `middleware.js` makes every page ask for a login before anything loads:
- **Username:** anything (for example `admin`).
- **Password:** the `ORDER_DESK_PASSWORD` you set in step 2 below.

Without the password, nobody sees even the first page, and the order data is password-protected too. Search engines are also told not to list it. Keep the GitHub repository **private** as well.

## 2. Turn on online storage on your site (5 minutes)

Orders are saved online on your own Vercel site, so every phone and laptop sees the same orders. No Google account is needed.

1. In Vercel, open your project → **Storage** → **Create Database** → choose **Upstash for Redis** → Free plan → **Connect** to this project. This adds the database keys automatically.
2. Open **Settings → Environment Variables** and add:
   - Name: `ORDER_DESK_PASSWORD`
   - Value: your own strong password
3. Open **Deployments** and click **Redeploy** on the latest one.
4. Open your Order Desk at **https://skinday.shop** and log in (username: anything, password: the one above). The desk connects to online storage by itself and shows all saved orders. (If it ever doesn't, go to **Settings → Online storage**, type the same password and tap **Connect**.)

**Your links:** desk https://skinday.shop · customer form https://skinday.shop/form/ (the old orderdesk-chi.vercel.app links still work).
5. Do step 4 once on each phone or laptop.

The top bar shows the status: a green dot means saved online, and "Wrong password" means the password doesn't match the one in Vercel. Every device also keeps its own copy, so it keeps working offline and catches up when it's back online.

*Optional:* you can use a Google Sheet instead. Open Settings → Online storage → "Use a Google Sheet instead" and follow the steps in `google-apps-script.gs`.

## Customer order form (public link)

This is the only public page: `yoursite/form/`. Customers:
1. **Choose products:** tap a brand (Mirc Glow, Youth Face and so on), then **+ Add** and − / + for quantity. The total updates as they go.
2. **Fill in delivery details:** name, mobile, house, street or area, landmark and pincode (city and state fill in automatically), and map location if they want. The form takes **Prepaid orders only**.

Each submission is **added to your Orders automatically**: status *New*, a **Form** tag, and an alert such as "📬 1 new order from the form". It also shows at the top of **Latest customers**, so you can confirm on WhatsApp, print the label and dispatch as usual. To review form orders before they're added, untick *Settings → Add orders from the customer form automatically*. They then wait on Today until you tap **Create order**.

**One link for everyone:** your order form link (`yoursite/form/`) is shown at the top of the **Today** page, with **Copy link** and **Share on WhatsApp** buttons. Put it in your WhatsApp status, Instagram bio and broadcasts, and send it to anyone who asks to order. Customers pick the brand and products, fill in their address, and the order is **Prepaid only** (the form has no Cash on Delivery option).

The product list comes from **Settings → Products** (names and prices only; nothing else is public). Products with no price are hidden. The form needs online storage (step 2) to be turned on, and it has spam protection.

## 3. Thermal printer setup (4 × 6 in)

- Install the printer's driver and create a paper size of **4 × 6 in (101.6 × 152.4 mm)**.
- In the print dialog, set paper size to 4 × 6, margins to **None**, scale to **100%**, and turn **Headers and footers** off.
- Chrome on a laptop gives the most reliable results. On Android, use the printer's own app or Mopria as the print service.

## Daily routine

1. **New order:** paste the WhatsApp chat, tap *Fill from message*, check the details, then tap *Save & print label*.
2. **Before shipping:** if payment hasn't come in yet, send "Ask for payment" (the UPI QR code is on the order screen) and tick "Payment received" once it arrives.
3. **Pack:** in Orders → To ship, tick the orders and tap *Print labels*. You can also print a packing slip.
4. **Dispatch:** when the courier collects the parcels, open **Dispatch**. Choose DTDC or Shree Maruti and scan or type each AWB (Enter moves to the next row), then tap *Save & mark dispatched*. Then tap *Send tracking* next to each customer. For a single order, use **Add tracking** on the order instead. You can also paste the courier's tracking link there.
   - **Send on WhatsApp (one tap):** opens **that customer's own chat** (their number from the order) with the tracking message already typed: order, courier, tracking number, "Prepaid: nothing to pay at delivery" and a skincare quote. Just press Send. The label picture is copied at the same time, so you can paste it into the chat (Ctrl+V on a computer, long-press → Paste on a phone).
   - On the Dispatch page, **Send to next customer** opens each customer's chat one after another.
   - Update progress later with one tap: Dispatched → In transit → Out for delivery. The date of each step is saved.
5. **Refill reminders (every day):** the Today page lists customers whose cream is probably running low (30 days after delivery by default; set a different number per product in Settings → Products → *Lasts (days)*). Tap the green WhatsApp button to send a friendly reminder, or *Skip 2 weeks*. Customers who already ordered again are left out automatically.

## Good to know

- Each brand has its own order numbers (for example MG261015001 or YF261015001), colour, products, return address and UPI ID. You can change all of these in Settings.
- Turn on online storage before you use more than one device. Otherwise two devices could give the same order number on the same day.
- Download a backup file from Settings once a week, even with online storage turned on.
