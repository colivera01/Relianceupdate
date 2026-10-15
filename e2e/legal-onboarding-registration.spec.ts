import { expect, test, type Page } from "@playwright/test";

import { createAuthSessionCookie } from "../src/lib/auth-session";
import onboardingMetadata from "../src/config/beta-onboarding-legal-metadata.generated.json";
import roleAssentContent from "../src/config/beta-role-assent-content.generated.json";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3102";
const managerId = "legal-onboarding-manager";
const vendorId = "legal-onboarding-vendor";

async function fillRegistrationIdentity(page: Page, role: "user" | "vendor") {
  await page.goto(`/auth/register?type=${role}`);
  await page.locator("#firstName").fill(role === "vendor" ? "Vera" : "Casey");
  await page.locator("#lastName").fill(role === "vendor" ? "Vendor" : "Customer");
  await page
    .locator("#registrationContactEmail")
    .fill(`${role}.legal-onboarding@example.test`);
  await page.locator("#phone").fill("4075550188");
  await page.locator("#registrationPassword").fill("Onboarding1!");
  await page.locator("#registrationConfirmPassword").fill("Onboarding1!");
}

async function openVendorBusinessStep(page: Page) {
  await fillRegistrationIdentity(page, "vendor");
  await page.locator("#address").fill("123 Main St");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option", { name: "Florida", exact: true }).click();
  await page.locator("#city").fill("Orlando");
  await page.locator("#zipCode").fill("32801");
  await expect(page.locator("#smsConsent")).not.toBeChecked();
  await page.getByRole("button", { name: "Next: Business Information" }).click();
  await expect(page.getByRole("heading", { name: "Review the current Vendor organization package" })).toBeVisible();
}

test.describe("beta onboarding legal alignment", () => {
  test("Customer registration shows only the exact Customer package and keeps SMS optional", async ({ page }) => {
    await fillRegistrationIdentity(page, "user");

    await expect(page.getByText("Vendor Organization Agreement", { exact: true })).toHaveCount(0);
    await expect(page.locator("#smsConsent")).not.toBeChecked();
    await page.getByLabel(/I agree to the/).check();
    await page.getByLabel(/I acknowledge the/).check();

    const terms = onboardingMetadata.entries.find((entry) => entry.documentId === "terms")!;
    const privacy = onboardingMetadata.entries.find((entry) => entry.documentId === "privacy")!;
    await expect(page.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      new RegExp(terms.viewerHref.replaceAll("/", "\\/")),
    );
    await expect(page.getByRole("link", { name: "Privacy Notice" }).first()).toHaveAttribute(
      "href",
      new RegExp(privacy.viewerHref.replaceAll("/", "\\/")),
    );

    await page.getByRole("button", { name: "Next Step" }).click();
    await expect(page.getByRole("heading", { name: "Almost Done!" })).toBeVisible();
    await expect(page.getByText(/SMS updates:\s*Not opted in/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeEnabled();
  });

  test("Vendor registration requires four visible acknowledgments but not SMS", async ({ page }) => {
    await openVendorBusinessStep(page);

    await page.locator("#businessName").fill("Onboarding Electric LLC");
    const businessType = page.getByRole("combobox").first();
    await businessType.click();
    await page.getByRole("option", { name: "Limited Liability Company (LLC)", exact: true }).click();
    const category = page.getByRole("combobox").nth(1);
    await category.click();
    await page.getByRole("option", { name: "Electrician", exact: true }).click();
    await page.locator("#foundedYear").fill("2020");
    await page.locator("#businessBio").fill("Residential electrical service and repair.");

    await expect(page.getByText("Vendor Organization Agreement", { exact: true })).toBeVisible();
    await expect(page.getByText(/Manager Work Record attestation is separate/)).toBeVisible();
    const submit = page.getByRole("button", { name: "Create Account" });
    await expect(submit).toBeDisabled();

    for (const acknowledgement of onboardingMetadata.vendorAcknowledgements) {
      const checkbox = page.getByLabel(acknowledgement.label, { exact: true });
      await page.locator(`label[for="vendor-registration-${acknowledgement.key}"]`).click();
      await expect(checkbox).toBeChecked();
    }
    await expect(submit).toBeEnabled();

    const privacyCheckbox = page.getByLabel(
      onboardingMetadata.vendorAcknowledgements.find((item) => item.key === "privacy")!.label,
      { exact: true },
    );
    await privacyCheckbox.focus();
    await privacyCheckbox.press("Space");
    await expect(privacyCheckbox).not.toBeChecked();
    await expect(submit).toBeDisabled();
    await privacyCheckbox.press("Space");
    await expect(privacyCheckbox).toBeChecked();
    await expect(submit).toBeEnabled();
  });
});

async function installVendorGateFixture(page: Page) {
  const session = createAuthSessionCookie({
    userId: managerId,
    email: "manager@example.test",
    userType: "vendor",
    availableProfiles: ["customer", "vendor"],
  });
  await page.context().addCookies([
    {
      name: "reliance_session",
      value: session,
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.addInitScript(({ managerId }) => {
    window.sessionStorage.setItem(
      "userData",
      JSON.stringify({
        id: managerId,
        name: "Vera Vendor",
        email: "manager@example.test",
        userType: "vendor",
        availableProfiles: ["customer", "vendor"],
      }),
    );
  }, { managerId });

  let decision: "ASSENT" | "DECLINE" | null = null;
  const decisions: string[] = [];
  const vendorEntries = roleAssentContent.entries.filter((entry) =>
    ["reliance.terms-of-use", "reliance.privacy-notice", "reliance.vendor-role-assent"].includes(
      entry.contentKey,
    ),
  );

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const fulfill = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (pathname === "/api/auth/session") {
      return fulfill({
        authenticated: true,
        user: {
          id: managerId,
          name: "Vera Vendor",
          email: "manager@example.test",
          userType: "vendor",
          availableProfiles: ["customer", "vendor"],
        },
      });
    }
    if (pathname === "/api/vendor/profile") {
      return fulfill({
        success: true,
        profile: {
          id: vendorId,
          name: "Onboarding Electric LLC",
          businessName: "Onboarding Electric LLC",
          membershipStatus: "ACTIVE",
          serviceTypes: [],
          specializations: [],
          serviceAreas: [],
          totalEmployees: 1,
        },
      });
    }
    if (pathname === "/api/vendor/context") {
      return fulfill({ success: true, vendorId, businessName: "Onboarding Electric LLC", role: "MANAGER" });
    }
    if (pathname === "/api/vendor/session-guard") {
      return fulfill({ ok: true, applies: true, nextCheckInMs: 60_000 });
    }
    if (pathname === "/api/user/available-roles") {
      return fulfill({ success: true, roles: ["customer", "vendor"] });
    }
    if (pathname === "/api/vendor/legal-assent") {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        decision = body.decision;
        decisions.push(body.decision);
      }
      return fulfill({
        identity: {
          vendorId,
          vendorName: "Onboarding Electric LLC",
          actorRole: "MANAGER",
          membershipId: "manager-membership",
        },
        status: {
          current: decision === "ASSENT",
          decision,
          decidedAt: decision ? "2026-10-14T20:00:00.000Z" : null,
        },
        presentation: {
          packageKey: roleAssentContent.packageKey,
          contentSetHash: onboardingMetadata.contentSets.vendor.contentSetHash,
          content: vendorEntries,
          vendorAcknowledgements: onboardingMetadata.vendorAcknowledgements,
        },
      });
    }
    if (pathname === `/api/vendors/${vendorId}/dashboard`) {
      return fulfill({
        profile: { id: vendorId, name: "Onboarding Electric LLC" },
        stats: {},
        recentJobs: [],
        archivedJobs: [],
        recentReviews: [],
        employeePerformance: [],
        insights: [],
        lifecycleCounts: {},
        notifications: [],
      });
    }
    return fulfill({ error: "Not mocked" }, 404);
  });
  return decisions;
}

test.describe("existing Vendor catch-up gate", () => {
  test("keeps operations locked, exposes escape actions, and visibly toggles all four controls", async ({ page, isMobile }) => {
    const decisions = await installVendorGateFixture(page);
    await page.goto("/test-fixtures/vendor-role-assent-gate");

    await expect(page.getByRole("heading", { name: /Review and agree for Onboarding Electric LLC/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Support & Help" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Log Out" }).first()).toBeVisible();
    if (isMobile) {
      await expect(page.getByRole("navigation", { name: "Vendor mobile navigation" }).getByText("Support & Help")).toBeVisible();
    } else {
      await expect(page.locator('aside [aria-disabled="true"]')).toHaveCount(9);
    }

    const agree = page.getByRole("button", { name: "Agree for Vendor" });
    const decline = page.getByRole("button", { name: "I do not agree" });
    await expect(agree).toBeDisabled();
    await expect(decline).toBeEnabled();
    await decline.click();
    await expect.poll(() => decisions.at(-1)).toBe("DECLINE");

    for (const acknowledgement of onboardingMetadata.vendorAcknowledgements) {
      const checkbox = page.getByLabel(acknowledgement.label, { exact: true });
      const indicator = checkbox.locator("xpath=following-sibling::span[1]");
      await expect(indicator.locator("svg")).toHaveCount(0);
      await checkbox.locator("xpath=ancestor::label").click();
      await expect(checkbox).toBeChecked();
      await expect(indicator.locator("svg")).toBeVisible();
    }
    await expect(agree).toBeEnabled();

    const authority = page.getByLabel(onboardingMetadata.vendorAcknowledgements[0].label, { exact: true });
    await authority.focus();
    await authority.press("Space");
    await expect(agree).toBeDisabled();
    await authority.press("Space");
    await expect(agree).toBeEnabled();
    await agree.click();
    await expect.poll(() => decisions.at(-1)).toBe("ASSENT");
    await expect(page.getByRole("heading", { name: /Review and agree/ })).toHaveCount(0);
    if (!isMobile) {
      await expect(page.locator('aside a[href="/vendor/dashboard"]')).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Unlocked Vendor Workspace" })).toBeVisible();
  });
});
