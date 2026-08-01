import Link from "next/link";
import { PolicyDocumentLayout } from "@/components/legal/PolicyDocumentLayout";
import { buildPolicyDocumentHref } from "@/lib/policy-navigation";
import { LAUNCH_SUPPORT_EMAIL } from "@/lib/support";

export default async function SmsPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const returnTo = Array.isArray(resolvedSearchParams.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams.returnTo;

  return (
    <PolicyDocumentLayout returnTo={returnTo}>
      <h1>Reliance SMS Policy</h1>

      <p>
        Reliance sends transactional SMS messages under the Reliance brand. Vendor or business
        names may appear only as context for a related invite, service record, consent request,
        review, or support workflow. Individual vendors are not the sender of the Reliance SMS
        program.
      </p>

      <h3>Who May Receive Messages</h3>
      <p>
        Customers, vendors, and invited team members may receive SMS messages after providing a
        mobile phone number and opting in through a Reliance registration, invite, consent,
        service-record, review, or support workflow.
      </p>

      <h3>Message Types</h3>
      <ul>
        <li>Account access and verification messages.</li>
        <li>Vendor, employee, or team invitation links.</li>
        <li>Service-record updates and customer video consent requests.</li>
        <li>Approved service-video availability notifications.</li>
        <li>Review reminders and support or account-status updates.</li>
      </ul>

      <p>
        This SMS program is transactional. Reliance does not use this campaign for marketing or
        promotional SMS messages.
      </p>

      <h3>How SMS Opt-In Works</h3>
      <p>
        Users can opt in by entering a mobile phone number and checking the unchecked SMS consent
        box on the public Reliance registration page. The consent language explains the types of
        transactional messages Reliance may send, that message frequency varies, that message and
        data rates may apply, and that users can reply STOP to opt out or HELP for help.
      </p>
      <p>
        Consent to SMS is not required to create an account, request service, or use available
        non-SMS workflows. Where email is available, Reliance may use email instead of SMS.
      </p>

      <h3>Frequency, Fees, Help, and Opt-Out</h3>
      <ul>
        <li>Message frequency varies based on account, invite, service-record, review, and support activity.</li>
        <li>Message and data rates may apply.</li>
        <li>Reply STOP, UNSUBSCRIBE, CANCEL, END, or QUIT to opt out.</li>
        <li>Reply START or YES to opt back in when supported.</li>
        <li>Reply HELP or INFO for help when supported.</li>
      </ul>

      <h3>Mobile Number Privacy</h3>
      <p>
        Reliance does not sell, rent, or share mobile phone numbers or SMS opt-in consent with
        third parties or affiliates for marketing or promotional purposes.
      </p>

      <h3>Support</h3>
      <p>
        For help, email{" "}
        <a href={`mailto:${LAUNCH_SUPPORT_EMAIL}`}>{LAUNCH_SUPPORT_EMAIL}</a>. You can also review
        the <Link href={buildPolicyDocumentHref("/privacy", returnTo || "")}>Privacy Policy</Link> and{" "}
        <Link href={buildPolicyDocumentHref("/terms", returnTo || "")}>Terms of Service</Link>.
      </p>
    </PolicyDocumentLayout>
  );
}
