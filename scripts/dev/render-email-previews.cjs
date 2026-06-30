const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..", "..");
const outDir = path.join(root, "tmp-email-previews");
fs.mkdirSync(outDir, { recursive: true });

const logoPath = path.join(root, "public", "reliance-email-logo.png");
const logoData = fs.existsSync(logoPath)
  ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
  : "";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailShell(input) {
  const details = (input.details || []).filter((detail) => detail.label && detail.value);
  const fallbackHref = input.fallbackHref || (input.cta && input.cta.href) || "";
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(input.title)}</title>
      </head>
      <body style="margin:0;background:#050a12;">
        <div style="margin:0;padding:0;background:#050a12;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050a12;margin:0;padding:0;">
            <tr>
              <td align="center" style="padding:28px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #1d3b66;border-radius:22px;background:#081426;overflow:hidden;font-family:Arial,sans-serif;color:#eaf2ff;">
                  <tr>
                    <td style="padding:24px 24px 18px;background:#07111f;border-bottom:1px solid #18345d;">
                      ${
                        logoData
                          ? `<img src="${logoData}" alt="Reliance" width="260" style="display:block;width:260px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`
                          : `<div style="font-size:19px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:#f8fbff;line-height:1;">RELIANCE</div>`
                      }
                      <div style="margin-top:12px;font-size:11px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:#7eb6ff;">${escapeHtml(input.eyebrow)}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:26px 24px 28px;">
                      ${input.greeting ? `<p style="margin:0 0 18px;color:#dce8ff;font-size:15px;line-height:1.55;">${escapeHtml(input.greeting)}</p>` : ""}
                      <h1 style="margin:0 0 18px;color:#ffffff;font-size:24px;line-height:1.22;font-weight:800;">${escapeHtml(input.headline)}</h1>
                      <div style="color:#dce8ff;font-size:15px;line-height:1.65;">${input.bodyHtml}</div>
                      ${
                        details.length
                          ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid #203f6c;border-radius:16px;background:#0b1830;">
                              <tr>
                                <td style="padding:16px 18px;">
                                  ${details
                                    .map(
                                      (detail, index) =>
                                        `<div style="margin:${index === 0 ? "0" : "10px"} 0 0;font-size:14px;color:#bfd0ea;"><strong style="color:#ffffff;">${escapeHtml(detail.label)}:</strong> ${escapeHtml(detail.value)}</div>`
                                    )
                                    .join("")}
                                </td>
                              </tr>
                            </table>`
                          : ""
                      }
                      ${
                        input.cta
                          ? `<p style="margin:24px 0;">
                              <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:#2f6df6;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:800;font-size:15px;">
                                ${escapeHtml(input.cta.label)}
                              </a>
                            </p>`
                          : ""
                      }
                      ${input.secondaryHtml ? `<div style="color:#c9d8ef;font-size:14px;line-height:1.65;">${input.secondaryHtml}</div>` : ""}
                      ${
                        fallbackHref
                          ? `<div style="margin:20px 0 0;padding:12px 14px;border-radius:12px;background:#07111f;border:1px solid #162f54;color:#92a8c7;font-size:12px;line-height:1.55;"><strong style="color:#c9d8ef;">Backup link:</strong> If the button does not open, copy and paste this secure link into your browser.<br/><a href="${escapeHtml(fallbackHref)}" style="color:#8fb9ff;word-break:break-all;">${escapeHtml(fallbackHref)}</a></div>`
                          : ""
                      }
                      ${input.footerNote ? `<p style="margin:20px 0 0;color:#92a8c7;font-size:12px;line-height:1.55;">${escapeHtml(input.footerNote)}</p>` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;
}

const base = "https://beta.relianceonline.org";
const serviceLink = `${base}/employee/jobs?jobId=cmqwvc2vr000bso843zn562dl&ct=sample-token`;
const reviewLink = `${base}/my-bookings/sample-booking?returnTo=%2Freviews`;
const recordsLink = `${base}/my-bookings`;
const serviceName = "Electrical Service Recording Test";
const vendorName = "Electro LLC";
const customerName = "Ivan Olivera";

const previews = [
  {
    file: "01-employee-service-order-link.png",
    title: "Employee service order link",
    eyebrow: "Service order link",
    headline: serviceName,
    greeting: "Hi Adrian Olivera,",
    bodyHtml: `<p style="margin:0 0 18px;"><strong style="color:#ffffff;">${escapeHtml(vendorName)}</strong> assigned you a service order.</p>`,
    details: [
      { label: "Assigned service", value: serviceName },
      { label: "Customer", value: customerName },
      { label: "Scheduled", value: "Jun 28, 2026, 5:25 PM" },
    ],
    cta: { label: "Open Service Order", href: serviceLink },
    secondaryHtml: `
      <p style="margin:0 0 10px;color:#ffffff;font-size:15px;font-weight:800;">What to do next:</p>
      <ol style="margin:0 0 18px 20px;padding:0;">
        <li>Open the secure service order link.</li>
        <li>Tap Start Job when work begins.</li>
        <li>Capture Starting Condition, Work in Progress, and Final Result clips.</li>
        <li>Keep each public stage clip to 30 seconds or less.</li>
        <li>Submit the completed package for manager review.</li>
      </ol>
      <p style="margin:0;">This secure link only opens the Reliance service order assigned to you.</p>
    `,
    fallbackHref: serviceLink,
  },
  {
    file: "02-employee-team-invite.png",
    title: "Employee team invite",
    eyebrow: "Team invite",
    headline: `Join ${vendorName} on Reliance`,
    greeting: "Hi Adrian Olivera,",
    bodyHtml: `
      <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${escapeHtml(vendorName)}</strong> invited you to join their team on Reliance as an employee.</p>
      <p style="margin:0;">Reliance is used to manage jobs, track service progress, and capture service videos for completed work.</p>
    `,
    cta: { label: "Accept Team Invite", href: `${base}/vendor/invite/sample-token` },
    secondaryHtml: `
      <p style="margin:0 0 10px;color:#ffffff;font-size:15px;font-weight:800;">What happens next:</p>
      <ol style="margin:0 0 18px 20px;padding:0;">
        <li>Confirm your name and contact details.</li>
        <li>Access assigned jobs sent by email or SMS.</li>
        <li>Complete service-video stages when work is assigned.</li>
      </ol>
      <p style="margin:0;">This invite may expire, so we recommend accepting it as soon as possible.</p>
    `,
    fallbackHref: `${base}/vendor/invite/sample-token`,
    footerNote: "If you were not expecting this, you can safely ignore this email.",
  },
  {
    file: "03-customer-video-consent-request.png",
    title: "Customer video consent request",
    eyebrow: "Video consent request",
    headline: "Review service video approval",
    greeting: `Hello ${customerName},`,
    bodyHtml: `
      <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${escapeHtml(vendorName)}</strong> is asking for your permission to record and share service videos for this appointment through Reliance.</p>
      <p style="margin:0;">If you approve, the provider can continue the Reliance service-video workflow and you will be able to review the videos afterward.</p>
    `,
    details: [
      { label: "Service", value: serviceName },
      { label: "Service date", value: "June 28, 2026" },
      { label: "Request type", value: "service video approval" },
    ],
    cta: { label: "Review Video Consent Request", href: `${base}/consent/sample-token` },
    fallbackHref: `${base}/consent/sample-token`,
    footerNote: "If you did not expect this request, you can ignore this message.",
  },
  {
    file: "04-customer-service-video-ready.png",
    title: "Customer service video ready",
    eyebrow: "Service videos ready",
    headline: `${vendorName} shared your service video proof`,
    greeting: `Hello ${customerName},`,
    bodyHtml: `
      <p style="margin:0 0 14px;"><strong style="color:#ffffff;">${escapeHtml(vendorName)}</strong> completed the service-video package for your recent service.</p>
      <p style="margin:0;">Open Reliance to review the Starting Condition, Work in Progress, and Final Result clips shared by your provider.</p>
    `,
    details: [
      { label: "Service", value: serviceName },
      { label: "Service provider", value: vendorName },
      { label: "Video package", value: "Starting Condition, Work in Progress, and Final Result" },
    ],
    cta: { label: "Watch Service Video", href: `${base}/my-bookings/sample-booking` },
    fallbackHref: `${base}/my-bookings/sample-booking`,
  },
  {
    file: "05-review-reminder.png",
    title: "Review reminder",
    eyebrow: "Service feedback",
    headline: "How was your service?",
    greeting: `Hello ${customerName},`,
    bodyHtml: `
      <p style="margin:0 0 14px;">We would love your feedback on your recent service with <strong style="color:#ffffff;">${escapeHtml(vendorName)}</strong>.</p>
      <p style="margin:0;">Your feedback helps future customers choose with confidence and helps providers improve their service.</p>
    `,
    details: [
      { label: "Service", value: serviceName },
      { label: "Date", value: "June 28, 2026" },
    ],
    cta: { label: "Review Your Service", href: reviewLink },
    secondaryHtml: `
      <p style="margin:0 0 8px;color:#ffffff;font-weight:800;">Start with a quick rating:</p>
      <p style="margin:0 0 14px;">
        <a href="${reviewLink}&rating=1" aria-label="Start a 1 out of 5 star review" style="display:inline-block;margin:0 8px 8px 0;padding:9px 12px;border-radius:999px;border:1px solid #2b5aa5;background:#0d1b33;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;"><span style="display:inline-block;min-width:12px;text-align:center;">1</span><span style="color:#facc15;margin-left:4px;">&#9733;</span></a>
        <a href="${reviewLink}&rating=2" aria-label="Start a 2 out of 5 star review" style="display:inline-block;margin:0 8px 8px 0;padding:9px 12px;border-radius:999px;border:1px solid #2b5aa5;background:#0d1b33;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;"><span style="display:inline-block;min-width:12px;text-align:center;">2</span><span style="color:#facc15;margin-left:4px;">&#9733;</span></a>
        <a href="${reviewLink}&rating=3" aria-label="Start a 3 out of 5 star review" style="display:inline-block;margin:0 8px 8px 0;padding:9px 12px;border-radius:999px;border:1px solid #2b5aa5;background:#0d1b33;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;"><span style="display:inline-block;min-width:12px;text-align:center;">3</span><span style="color:#facc15;margin-left:4px;">&#9733;</span></a>
        <a href="${reviewLink}&rating=4" aria-label="Start a 4 out of 5 star review" style="display:inline-block;margin:0 8px 8px 0;padding:9px 12px;border-radius:999px;border:1px solid #2b5aa5;background:#0d1b33;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;"><span style="display:inline-block;min-width:12px;text-align:center;">4</span><span style="color:#facc15;margin-left:4px;">&#9733;</span></a>
        <a href="${reviewLink}&rating=5" aria-label="Start a 5 out of 5 star review" style="display:inline-block;margin:0 8px 8px 0;padding:9px 12px;border-radius:999px;border:1px solid #2b5aa5;background:#0d1b33;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;line-height:1;"><span style="display:inline-block;min-width:12px;text-align:center;">5</span><span style="color:#facc15;margin-left:4px;">&#9733;</span></a>
      </p>
      <p style="margin:0;">Your feedback window is open for a limited time. You can watch your service video, confirm the rating, and leave feedback in one place.</p>
    `,
    fallbackHref: reviewLink,
  },
  {
    file: "06-review-window-closed.png",
    title: "Review window closed",
    eyebrow: "Feedback window closed",
    headline: "Your feedback window has closed",
    greeting: `Hello ${customerName},`,
    bodyHtml: `
      <p style="margin:0 0 14px;">Your feedback window for <strong style="color:#ffffff;">${escapeHtml(vendorName)}</strong> has ended without a submitted review.</p>
      <p style="margin:0;">If you still need help, open My Service Records in Reliance or contact support from the app.</p>
    `,
    cta: { label: "Open My Service Records", href: recordsLink },
    fallbackHref: recordsLink,
  },
  {
    file: "07-device-pairing-invite.png",
    title: "Device pairing invite",
    eyebrow: "Device pairing",
    headline: "Pair this phone for service videos",
    bodyHtml: `
      <p style="margin:0 0 14px;">You have been invited to pair this phone with <strong style="color:#ffffff;">${escapeHtml(vendorName)}</strong> on Reliance.</p>
      <p style="margin:0;">Open this message on the phone you want to use for Reliance service videos, then tap the button below.</p>
    `,
    details: [
      { label: "Backup code", value: "482-119" },
      { label: "Expires", value: "Jun 28, 10:45 AM" },
    ],
    cta: { label: "Pair This Phone", href: `${base}/device/pair?token=sample-token` },
    fallbackHref: `${base}/device/pair?token=sample-token`,
  },
  {
    file: "08-email-verification.png",
    title: "Email verification",
    eyebrow: "Welcome to Reliance",
    headline: "Finish setting up your vendor account",
    greeting: "Hi Cesar Olivera,",
    bodyHtml: `
      <p style="margin:0 0 14px;">Welcome to Reliance. Verify your email so you can sign in, continue vendor setup, and move your business profile toward approval, publishing, and customer visibility.</p>
      <p style="margin:0;">We verify your email before vendor access opens so your business account stays secure and Reliance can reliably send approval, profile, and service-status updates to the right inbox.</p>
    `,
    cta: { label: "Verify Email Address", href: `${base}/auth/verify-email?token=sample-token` },
    secondaryHtml: `
      <p style="margin:0 0 8px;color:#ffffff;font-weight:800;">What happens after you verify</p>
      <p style="margin:0 0 16px;">After verification, sign in again to continue building your vendor profile and services offered.</p>
      <p style="margin:0;"><strong style="color:#ffffff;">This link expires in 24 hours.</strong></p>
    `,
    fallbackHref: `${base}/auth/verify-email?token=sample-token`,
  },
  {
    file: "09-mfa-sign-in-code.png",
    title: "MFA sign-in code",
    eyebrow: "Sign-in code",
    headline: "Finish signing in",
    greeting: "Hello Cesar Olivera,",
    bodyHtml: `
      <p style="margin:0 0 14px;">Use this code to finish signing in to your Reliance account:</p>
      <p style="margin:0;font-size:30px;font-weight:800;letter-spacing:0.18em;color:#ffffff;">184729</p>
    `,
    secondaryHtml: '<p style="margin:0;">This code expires in 10 minutes.</p>',
    footerNote: "If you did not try to sign in, you can ignore this message.",
  },
  {
    file: "10-vendor-login-security-alert.png",
    title: "Vendor login security alert",
    eyebrow: "Security alert",
    headline: "New Reliance vendor sign-in",
    greeting: "Hello Cesar Olivera,",
    bodyHtml: '<p style="margin:0;">Reliance detected a sign-in to vendor tools.</p>',
    details: [
      { label: "Vendor account", value: vendorName },
      { label: "Device", value: "Chrome" },
      { label: "Approximate IP", value: "203.0.113.42" },
      { label: "Time", value: "6/28/2026, 2:10:00 AM EDT" },
    ],
    cta: { label: "Open Security Settings", href: `${base}/vendor/profile` },
    fallbackHref: `${base}/vendor/profile`,
    footerNote: "If this was you, no action is needed. If this was not you, change your password and review your Security Settings.",
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 760, height: 980 }, deviceScaleFactor: 1 });
  const index = [];
  for (const preview of previews) {
    const html = emailShell(preview);
    await page.setContent(html, { waitUntil: "load" });
    const outPath = path.join(outDir, preview.file);
    await page.screenshot({ path: outPath, fullPage: true });
    index.push({ title: preview.title, path: outPath });
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(index, null, 2));
  for (const item of index) {
    console.log(`${item.title}: ${item.path}`);
  }
})();
