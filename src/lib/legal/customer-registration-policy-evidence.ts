import crypto from "crypto";
import { prisma } from "@/server/db";

const POLICY_SOURCE_REVISION = "684dc79364b22aa984e7ed990feaedfd9bc9f406";
const POLICY_VERSION = "beta-2026-08-01";
const POLICY_EFFECTIVE_AT = new Date("2026-08-01T21:18:54.000Z");

const TERMS_SNAPSHOT = `Terms of Service

By accessing or using Reliance, you agree to these Terms of Service. Please read them carefully before using the platform.

1. Platform Role
Reliance is a technology platform that supports proof-of-service media access, communication, consent, and review workflows between users and service providers. Reliance does not perform, supervise, or control the underlying vendor services.

2. Vendor Responsibility
Vendors are solely responsible for the services they perform and the content they upload, submit, or communicate through the platform. Reliance does not independently verify every statement, representation, or recording made by vendors.

3. Public Proof, Reviews, and Trust Signals
Public service videos, reviews, Trust Score information, and other proof signals are intended to help users compare available information. They are not a guarantee, certification, warranty, endorsement, or promise of future performance. Users remain responsible for deciding whether to contact, hire, or continue working with a vendor.

4. Consent and Recordings
You acknowledge that service-related recordings may include starting-condition, work-in-progress, and final-result documentation when proper consent has been obtained. By accepting consent requests, you authorize participation in the service-video workflow and related platform processes.

5. Vendor Claims, Licensing, and Compliance
Vendors are responsible for maintaining any licenses, insurance, permits, authorizations, workplace practices, customer permissions, and legal compliance required for their work. Vendors must not upload misleading media, submit false business information, impersonate another person or business, or use Reliance to create a false impression of completed work.

6. Acceptable Use
You agree not to misuse the platform, including fraud, impersonation, unauthorized sharing of content, attempts to bypass consent controls, or interference with platform operations, security, or availability.

7. Communications
Reliance may send account, verification, invite, consent, service-record, review, and support communications by email, SMS, or other available channels. Message delivery may depend on third-party providers, carrier filtering, contact accuracy, and user device settings.

When you provide your mobile phone number and affirmatively opt in during account registration, vendor onboarding, employee invitation, customer consent, service-record, or review workflows, you authorize Reliance to send transactional messages related to that activity. Reliance is the sender of these SMS messages. Vendor or business names may appear only as context for the relevant service record, invite, consent request, or review workflow. Individual vendors are not the SMS sender.

SMS consent is not required to create an account, request service, or use available non-SMS workflows. Message frequency varies based on account, invite, consent, service-record, review, and support activity. Message and data rates may apply. Reply STOP to opt out and HELP for help where SMS replies are supported.

8. Account and Security Responsibilities
You are responsible for maintaining the confidentiality of your account credentials and for ensuring your account information is accurate and current. You are responsible for activity occurring under your account unless prohibited by applicable law.

9. Moderation and Availability
Reliance may review, reject, restrict, hide, remove, or delay content, accounts, promotions, service records, reviews, or customer-visible service evidence when needed for safety, quality, compliance, launch readiness, suspected abuse, or platform integrity. Reliance may also change, pause, or discontinue features during beta or launch operations.

10. Limitation of Liability
The platform is provided on an "as is" and "as available" basis. To the maximum extent permitted by law, Reliance disclaims warranties and is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, data, goodwill, or business interruption arising from platform use. Where permitted, total liability is limited to amounts paid by you to Reliance for use of the platform in the period preceding the claim.

11. Indemnification
You agree to defend, indemnify, and hold harmless Reliance, its affiliates, and personnel from claims, liabilities, damages, losses, and expenses arising from your misuse of the platform, violations of these Terms, unlawful content, or disputes caused by your conduct.

12. Disputes, Arbitration, and Class Action Waiver
Any dispute arising out of or relating to these Terms or platform use will be resolved by final and binding arbitration on an individual basis, except where prohibited by law. You and Reliance waive any right to a jury trial and waive any right to participate in a class action, class arbitration, or representative proceeding.

13. Suspension and Termination
Reliance may suspend, restrict, or terminate access to the platform at its discretion for abuse, fraud, policy violations, security concerns, unlawful conduct, or other behavior that creates risk for users, vendors, or the platform.

14. Changes to Terms
Reliance may update these Terms from time to time. Updated terms may be provided through the platform or related communications. Continued use of Reliance after updates become effective constitutes acceptance of the revised Terms.`;

const PRIVACY_SNAPSHOT = `Privacy Policy

Reliance values your privacy and is committed to handling personal information responsibly. This Privacy Policy explains what information we collect, how we use it, how we share it, and the choices available to you.

1. Information We Collect
- Account information, including name, email address, phone number, and profile details.
- Service and booking details, including appointment and workflow-related records.
- Consent records and related consent event history.
- Service-related media submitted in connection with service workflows.
- Device, browser, IP, and related security and verification data.
- Communication and contact details used for notifications and support.
- Review, activity, and usage data generated through platform interactions.
- Moderation, Trust Score, public-proof, and account-status records generated by platform workflows.

2. How We Use Information
- Provide and operate core platform functionality.
- Enable consent workflows and associated verification steps.
- Deliver service videos and customer access experiences.
- Detect, prevent, and investigate fraud, abuse, and security incidents.
- Maintain compliance logs and support dispute protection workflows.
- Provide customer support, analytics, and service improvements.
- Send account, invite, consent, service-record, review, and support communications.
- Operate moderation, public-proof, Trust Score, and launch-readiness controls.

3. Sharing of Information
We may share information as needed to operate the service workflow, including between vendors and customers where relevant to service records, consent, media access, and review flows. We may also share information with service providers that support hosting, communications, storage, analytics, and security operations. We may disclose information when required by law, legal process, or when reasonably necessary to protect users, safety, rights, or platform integrity.

4. SMS and Mobile Number Privacy
Reliance is the sender of the Reliance transactional SMS program. Vendor or business names may appear in a message only as context for the related invite, service record, consent request, review, or support workflow. Individual vendors are not the sender of the Reliance SMS program.

Reliance may send transactional SMS messages for account verification, vendor or employee invitations, service-record updates, customer video consent requests, approved service video notifications, review reminders, and support-related account updates after you provide a mobile number and opt in. Message frequency varies based on your account, invite, consent, service-record, review, and support activity. Message and data rates may apply. Reply STOP to opt out and HELP for help where SMS replies are supported.

Reliance does not sell, rent, or share mobile phone numbers or SMS opt-in consent with third parties or affiliates for marketing or promotional purposes.

5. Media and Consent Data
Service-related media and consent records may be stored and associated with relevant service records and accounts. These records may be retained and used for compliance, support, security, and dispute resolution purposes within the platform's operational workflows. Approved public media may appear on public vendor, service, discovery, or proof pages when the platform and moderation workflow allow it.

6. Public and Private Information
Public-facing areas may show provider profile details, services offered, approved public videos, public reviews, Trust Score context, and related proof signals. Private account details, consent logs, internal moderation notes, security records, and non-public media are used for platform operations and are not intended for general public display.

7. AI-Assisted Review
Reliance may use AI-assisted tools to help summarize, triage, or flag content for human review. AI assistance does not replace final human decisions for approval, moderation, vendor access, or account restrictions where manual review is required.

8. Data Retention
We retain information for as long as reasonably necessary for legitimate business and operational needs, including legal, security, compliance, support, and dispute-handling purposes. Retention periods may vary based on data type, context, and applicable obligations.

9. Security
We use commercially reasonable administrative, technical, and organizational safeguards to help protect personal information. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.

10. Your Rights and Choices
Where applicable, you may request access to, correction of, or deletion of certain personal information. You may also manage communication preferences through available settings or by contacting support where those controls are supported.

11. Policy Updates
Reliance may update this Privacy Policy from time to time. When updates are made, we may post the revised policy through the platform or related communications. Continued use of the platform after updates become effective indicates acceptance of the revised policy.`;

const SMS_SNAPSHOT = `Reliance SMS Policy

Reliance sends transactional SMS messages under the Reliance brand. Vendor or business names may appear only as context for a related invite, service record, consent request, review, or support workflow. Individual vendors are not the sender of the Reliance SMS program.

Who May Receive Messages
Customers, vendors, and invited team members may receive SMS messages after providing a mobile phone number and opting in through a Reliance registration, invite, consent, service-record, review, or support workflow.

Message Types
- Account access and verification messages.
- Vendor, employee, or team invitation links.
- Service-record updates and customer video consent requests.
- Approved service-video availability notifications.
- Review reminders and support or account-status updates.

This SMS program is transactional. Reliance does not use this campaign for marketing or promotional SMS messages.

How SMS Opt-In Works
Users can opt in by entering a mobile phone number and checking the unchecked SMS consent box on the public Reliance registration page. The consent language explains the types of transactional messages Reliance may send, that message frequency varies, that message and data rates may apply, and that users can reply STOP to opt out or HELP for help.

Consent to SMS is not required to create an account, request service, or use available non-SMS workflows. Where email is available, Reliance may use email instead of SMS.

Frequency, Fees, Help, and Opt-Out
- Message frequency varies based on account, invite, service-record, review, and support activity.
- Message and data rates may apply.
- Reply STOP, UNSUBSCRIBE, CANCEL, END, or QUIT to opt out.
- Reply START or YES to opt back in when supported.
- Reply HELP or INFO for help when supported.

Mobile Number Privacy
Reliance does not sell, rent, or share mobile phone numbers or SMS opt-in consent with third parties or affiliates for marketing or promotional purposes.

Support
For help, email Relianceorg.support@gmail.com. You can also review the Privacy Policy and Terms of Service.`;

type PolicyDefinition = {
  id: string;
  policyId: "TERMS" | "PRIVACY" | "SMS";
  version: string;
  effectiveAt: Date;
  contentSnapshot: string;
  contentHash: string;
  sourceRevision: string;
};

function hashSnapshot(content: string) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function definePolicy(
  id: string,
  policyId: PolicyDefinition["policyId"],
  contentSnapshot: string
): PolicyDefinition {
  return Object.freeze({
    id,
    policyId,
    version: POLICY_VERSION,
    effectiveAt: POLICY_EFFECTIVE_AT,
    contentSnapshot,
    contentHash: hashSnapshot(contentSnapshot),
    sourceRevision: POLICY_SOURCE_REVISION,
  });
}

export const CUSTOMER_REGISTRATION_POLICIES = Object.freeze({
  terms: definePolicy("policy_terms_beta_2026_08_01", "TERMS", TERMS_SNAPSHOT),
  privacy: definePolicy("policy_privacy_beta_2026_08_01", "PRIVACY", PRIVACY_SNAPSHOT),
  sms: definePolicy("policy_sms_beta_2026_08_01", "SMS", SMS_SNAPSHOT),
});

export function parseRegistrationBoolean(value: unknown) {
  return value === true || String(value || "").trim().toLowerCase() === "true";
}

function getRequestIp(request: Request) {
  return String(
    request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || ""
  )
    .split(",")[0]
    .trim()
    .slice(0, 255) || null;
}

async function ensurePolicyVersion(db: any, definition: PolicyDefinition) {
  const policy = await db.policyDocumentVersion.upsert({
    where: {
      policyId_version: {
        policyId: definition.policyId,
        version: definition.version,
      },
    },
    create: definition,
    update: {},
    select: { id: true, contentHash: true },
  });

  if (policy.contentHash !== definition.contentHash) {
    throw new Error(`POLICY_VERSION_HASH_MISMATCH:${definition.policyId}`);
  }

  return policy.id as string;
}

export async function recordCustomerRegistrationEvidence(input: {
  request: Request;
  userId: string;
  actorEmail: string;
  smsOptIn: boolean;
  registeredAt?: Date;
  db?: any;
}) {
  const registeredAt = input.registeredAt || new Date();
  const actorEmail = String(input.actorEmail || "").trim().toLowerCase();
  if (!input.userId || !actorEmail) {
    throw new Error("CUSTOMER_REGISTRATION_EVIDENCE_IDENTITY_REQUIRED");
  }

  const writeEvidence = async (tx: any) => {
    const [termsPolicyVersionId, privacyPolicyVersionId, smsPolicyVersionId] =
      await Promise.all([
        ensurePolicyVersion(tx, CUSTOMER_REGISTRATION_POLICIES.terms),
        ensurePolicyVersion(tx, CUSTOMER_REGISTRATION_POLICIES.privacy),
        ensurePolicyVersion(tx, CUSTOMER_REGISTRATION_POLICIES.sms),
      ]);

    return tx.customerRegistrationEvidence.create({
      data: {
        userId: input.userId,
        actorEmail,
        actorRole: "CUSTOMER",
        registeredAt,
        termsPolicyVersionId,
        privacyPolicyVersionId,
        smsPolicyVersionId,
        termsAcceptedAt: registeredAt,
        privacyAcknowledgedAt: registeredAt,
        smsOptIn: input.smsOptIn,
        smsDecisionAt: registeredAt,
        registrationIp: getRequestIp(input.request),
        userAgent: String(input.request.headers.get("user-agent") || "").slice(0, 1024) || null,
        verificationMethod: "EMAIL_VERIFICATION_LINK",
      },
    });
  };

  return input.db
    ? writeEvidence(input.db)
    : (prisma as any).$transaction(writeEvidence);
}

export async function markCustomerRegistrationEvidenceVerified(
  db: any,
  userId: string,
  verifiedAt: Date
) {
  if (!db?.customerRegistrationEvidence?.updateMany || !userId) return;

  await db.customerRegistrationEvidence.updateMany({
    where: {
      userId,
      verificationMethod: "EMAIL_VERIFICATION_LINK",
      verificationCompletedAt: null,
    },
    data: { verificationCompletedAt: verifiedAt },
  });
}
