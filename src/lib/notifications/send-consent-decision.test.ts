import { describe, expect, it } from "vitest";
import { buildConsentDecisionEmailContent } from "@/lib/notifications/send-consent-decision";

describe("consent decision email styling", () => {
  it("renders decision content inside the shared Reliance email shell", () => {
    const content = buildConsentDecisionEmailContent({
      accepted: true,
      vendorName: "Electro LLC",
      jobTitle: "Outlet Installation",
      recipientName: "Electro LLC Manager",
    });

    expect(content.subject).toBe(
      "Customer approved service video access: Outlet Installation"
    );
    expect(content.html).toContain("reliance-email-logo.png");
    expect(content.html).toContain("Recording permission update");
    expect(content.html).toContain("Recording allowed: Outlet Installation");
    expect(content.html).toContain("Electro LLC");
    expect(content.text).toContain("Next step:");
    expect(content.html).not.toContain("<script");
  });
});
