// SN Loan Associates - enquiry backend (Vercel serverless function)
// Sends every new enquiry to NOTIFY_NUMBER (default 9345793807) by SMS (Fast2SMS)
// and/or WhatsApp (Meta WhatsApp Cloud API). Every enquiry is also printed in Vercel Logs.
//
// WhatsApp template (create in Meta Business Manager, name: new_enquiry, language: English):
//   New loan enquiry
//   Name: {{1}}
//   Mobile: {{2}}
//   Loan: {{3}}
//   Amount: {{4}}
//   City: {{5}}

const hits = new Map(); // simple spam limit per IP (resets when the function restarts)

function clean(v, max) {
  return String(v || "").replace(/[<>]/g, "").trim().slice(0, max);
}

async function sendSMS(to, text) {
  const key = process.env.FAST2SMS_KEY;
  if (!key) return { skipped: "FAST2SMS_KEY not set" };
  const r = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: { authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ route: "q", message: text, language: "english", flash: 0, numbers: to })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.return === false) throw new Error("Fast2SMS: " + JSON.stringify(j));
  return j;
}

async function sendWhatsApp(to, d) {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) return { skipped: "WhatsApp not configured" };
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: "91" + to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE || "new_enquiry",
        language: { code: "en" },
        components: [{
          type: "body",
          parameters: [d.name, d.mobile, d.loanType, d.amount || "-", d.city || "-"]
            .map(t => ({ type: "text", text: String(t) }))
        }]
      }
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("WhatsApp: " + JSON.stringify(j));
  return j;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Use POST" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "unknown";
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 10 * 60 * 1000);
  if (list.length >= 5) return res.status(429).json({ ok: false, error: "Too many enquiries. Please call us." });
  list.push(now); hits.set(ip, list);

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  if (body.company) return res.status(200).json({ ok: true }); // honeypot: bots fill this

  const d = {
    name: clean(body.name, 60),
    mobile: clean(body.mobile, 10).replace(/\D/g, ""),
    loanType: clean(body.loanType, 40) || "Not selected",
    amount: clean(body.amount, 12).replace(/\D/g, ""),
    city: clean(body.city, 40)
  };
  if (d.name.length < 2) return res.status(400).json({ ok: false, error: "Enter your full name." });
  if (!/^[6-9]\d{9}$/.test(d.mobile)) return res.status(400).json({ ok: false, error: "Enter a valid 10-digit mobile number." });
  if (d.amount) d.amount = "Rs." + Number(d.amount).toLocaleString("en-IN");

  const to = (process.env.NOTIFY_NUMBER || "9345793807").replace(/\D/g, "").slice(-10);
  const text = `New Loan Enquiry - SN Loan Associates\nName: ${d.name}\nMobile: ${d.mobile}\nLoan: ${d.loanType}` +
               (d.amount ? `\nAmount: ${d.amount}` : "") + (d.city ? `\nCity: ${d.city}` : "");

  console.log("NEW ENQUIRY", JSON.stringify({ ...d, at: new Date().toISOString() }));

  const results = await Promise.allSettled([sendSMS(to, text), sendWhatsApp(to, d)]);
  const sent = results.some(r => r.status === "fulfilled" && !r.value?.skipped);
  results.forEach((r, i) => {
    const ch = i === 0 ? "SMS" : "WhatsApp";
    if (r.status === "rejected") console.error(ch, "failed:", r.reason?.message);
    else if (r.value?.skipped) console.warn(ch, "skipped:", r.value.skipped);
  });

  if (!sent) return res.status(502).json({ ok: false, error: "Notification not sent" });
  return res.status(200).json({ ok: true });
};
