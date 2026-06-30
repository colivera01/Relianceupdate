import { readNotificationEnv } from "@/lib/env/notification-config";

export type RelianceEmailDetail = {
  label: string;
  value: string;
};

export type RelianceEmailCta = {
  label: string;
  href: string;
};

export type RelianceEmailTemplateInput = {
  eyebrow: string;
  headline: string;
  greeting?: string;
  bodyHtml: string;
  details?: RelianceEmailDetail[];
  cta?: RelianceEmailCta;
  secondaryHtml?: string;
  fallbackHref?: string;
  footerNote?: string;
  baseUrl?: string | null;
};

export function escapeRelianceEmailHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getRelianceEmailLogoUrl(baseUrl?: string | null): string {
  const env = readNotificationEnv();
  const normalizedBase = String(baseUrl || env.appBaseUrl || "").trim().replace(/\/+$/, "");
  return normalizedBase ? `${normalizedBase}/reliance-email-logo.png` : "";
}

export function buildRelianceEmailHtml(input: RelianceEmailTemplateInput): string {
  const logoUrl = getRelianceEmailLogoUrl(input.baseUrl);
  const details = (input.details || []).filter((detail) => detail.label && detail.value);
  const fallbackHref = input.fallbackHref || input.cta?.href || "";

  return `
    <div style="margin:0;padding:0;background:#050a12;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050a12;margin:0;padding:0;">
        <tr>
          <td align="center" style="padding:28px 14px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #1d3b66;border-radius:22px;background:#081426;overflow:hidden;font-family:Arial,sans-serif;color:#eaf2ff;">
              <tr>
                <td style="padding:24px 24px 18px;background:#07111f;border-bottom:1px solid #18345d;">
                  ${
                    logoUrl
                      ? `<img src="${escapeRelianceEmailHtml(logoUrl)}" alt="Reliance" width="260" style="display:block;width:260px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />`
                      : `<div style="font-size:19px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:#f8fbff;line-height:1;">RELIANCE</div>`
                  }
                  <div style="margin-top:12px;font-size:11px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;color:#7eb6ff;">${escapeRelianceEmailHtml(input.eyebrow)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:26px 24px 28px;">
                  ${input.greeting ? `<p style="margin:0 0 18px;color:#dce8ff;font-size:15px;line-height:1.55;">${escapeRelianceEmailHtml(input.greeting)}</p>` : ""}
                  <h1 style="margin:0 0 18px;color:#ffffff;font-size:24px;line-height:1.22;font-weight:800;">${escapeRelianceEmailHtml(input.headline)}</h1>
                  <div style="color:#dce8ff;font-size:15px;line-height:1.65;">${input.bodyHtml}</div>
                  ${
                    details.length
                      ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border:1px solid #203f6c;border-radius:16px;background:#0b1830;">
                          <tr>
                            <td style="padding:16px 18px;">
                              ${details
                                .map(
                                  (detail) =>
                                    `<div style="margin:${detail === details[0] ? "0" : "10px"} 0 0;font-size:14px;color:#bfd0ea;"><strong style="color:#ffffff;">${escapeRelianceEmailHtml(detail.label)}:</strong> ${escapeRelianceEmailHtml(detail.value)}</div>`
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
                          <a href="${escapeRelianceEmailHtml(input.cta.href)}" style="display:inline-block;background:#2f6df6;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:800;font-size:15px;">
                            ${escapeRelianceEmailHtml(input.cta.label)}
                          </a>
                        </p>`
                      : ""
                  }
                  ${input.secondaryHtml ? `<div style="color:#c9d8ef;font-size:14px;line-height:1.65;">${input.secondaryHtml}</div>` : ""}
                  ${
                    fallbackHref
                      ? `<div style="margin:20px 0 0;padding:12px 14px;border-radius:12px;background:#07111f;border:1px solid #162f54;color:#92a8c7;font-size:12px;line-height:1.55;"><strong style="color:#c9d8ef;">Backup link:</strong> If the button does not open, copy and paste this secure link into your browser.<br/><a href="${escapeRelianceEmailHtml(fallbackHref)}" style="color:#8fb9ff;word-break:break-all;">${escapeRelianceEmailHtml(fallbackHref)}</a></div>`
                      : ""
                  }
                  ${input.footerNote ? `<p style="margin:20px 0 0;color:#92a8c7;font-size:12px;line-height:1.55;">${escapeRelianceEmailHtml(input.footerNote)}</p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `.trim();
}
