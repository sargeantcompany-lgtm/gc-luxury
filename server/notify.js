/* Emails a form submission to the agent through Resend's HTTP API. Uses Node's
 * built-in fetch, so no dependencies. Disabled unless RESEND_API_KEY and
 * NOTIFY_EMAIL are set. Never throws: every form has already saved by the time
 * this runs, so a failed send is logged and the visitor never sees it.
 */
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "";
// Without a verified domain, Resend only allows this sender, and only to the
// Resend account's own email address.
const EMAIL_FROM = process.env.EMAIL_FROM || "GC Luxury Forms <onboarding@resend.dev>";

function escHTML(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// rows is [label, value] pairs; rows with no value are left out.
async function sendFormEmail({ subject, title, subtitle, rows, replyTo }) {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) return;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1A1A1A;max-width:620px;">
    <h2 style="margin:0 0 4px;">${escHTML(title)}</h2>
    ${subtitle ? `<p style="margin:0 0 18px;color:#555;">${escHTML(subtitle)}</p>` : ""}
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;">
      ${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="border-bottom:1px solid #E3E1DC;color:#6E6E6E;width:190px;vertical-align:top;">${escHTML(k)}</td><td style="border-bottom:1px solid #E3E1DC;white-space:pre-wrap;">${escHTML(v)}</td></tr>`).join("")}
    </table>
    ${replyTo ? `<p style="font-size:12px;color:#888;margin-top:18px;">Reply to this email to respond to them directly.</p>` : ""}
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: NOTIFY_EMAIL.split(",").map((s) => s.trim()).filter(Boolean),
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        html,
      }),
    });
    if (!res.ok) console.error(`Form email failed (${subject}):`, res.status, await res.text());
  } catch (e) {
    console.error(`Form email failed (${subject}):`, e.message);
  }
}

module.exports = { sendFormEmail };
