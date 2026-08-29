"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock3, LockKeyhole, ShieldCheck, UserCheck, Volume2, VolumeX } from "lucide-react";

import styles from "./permission.module.css";

type Permission = {
  id: string;
  state: string;
  vendorName: string;
  serviceName: string;
  scheduledFor: string | null;
  recordingLocation: string | null;
  audioEnabled: boolean;
  initialAudience: "private";
  recipientEmailMasked: string | null;
  recipientPhoneMasked: string | null;
  customerName: string | null;
  actionExpiresAt: string;
  verificationOptions: { account: boolean; email: boolean; sms: boolean };
  plannedScope: {
    contractVersion?: string;
    siteControl?: string;
    intentionalParticipantPlan?: string;
    recordingBoundary?: string;
    prohibitedConditions?: string[];
    propertyScope?: string;
    peopleScope?: string;
    frameControl?: string;
    residenceInterior?: boolean;
    businessInterior?: boolean;
    minorMayAppear?: boolean;
    protectedNonParticipantMayAppear?: boolean;
    sensitiveInformationMayAppear?: boolean;
    identifiersMayAppear?: boolean;
    authorityHolderType: string;
    serviceCanContinueWithoutRecording: boolean;
    essentialPrivateRecording: boolean;
    audioEnabled: boolean;
    initialAudience: "private";
  } | null;
  authorityRequirement: {
    expectedAuthority: string | null;
    expectedClaimedRole: string | null;
    permittedClaimedRoles: string[];
    canAuthorizeInCurrentFlow: boolean;
    explanation: string;
  };
  canDecide: boolean;
  contentVersion: string | null;
};

const SIMPLIFIED_V1_CONTENT_VERSION = "recording-permission-v2-simplified-v1";

const SUPPORTED_CUSTOMER_AUTHORITY = {
  value: "customer",
  scope: "self_and_property",
} as const;

function stateMessage(state: string, simplifiedV1 = false) {
  const messages: Record<string, { title: string; detail: string }> = {
    allowed: { title: "Recording is allowed", detail: "Identity and authority were verified. Recordings will start Private." },
    decided: { title: "A decision was already saved", detail: "This secure link cannot be used again." },
    declined: simplifiedV1
      ? {
          title: "Recording declined",
          detail: "Reliance will not record this service through this work record. The Reliance work record is closed, and no further recording-permission action is required.",
        }
      : { title: "Recording was declined", detail: "Reliance recording stays locked. The service may continue without recording." },
    canceled: {
      title: "Recording declined",
      detail: "Reliance will not record this service through this work record. The Reliance work record is closed, and no further recording-permission action is required.",
    },
    later: { title: "No decision was saved", detail: "Recording stays locked. You can return to this secure link before it expires. The provider is not told that you approved or declined." },
    expired: { title: "This secure link expired", detail: "Ask the service provider to send a new recording-permission request." },
    superseded: {
      title: "This permission request was replaced",
      detail: "A newer request was sent. Please use the newest link or contact the business if you need another one.",
    },
    wrong_recipient: {
      title: "This request was reported as misdirected",
      detail: "The service provider must correct the recipient before sending another request. No further action is required from you. You may close this page.",
    },
  };
  return messages[state] || { title: "This request is not available", detail: "Ask the service provider to review the permission status." };
}

function scopeLabel(value: string) {
  const labels: Record<string, string> = {
    vendor_owned: "Vendor-owned property or controlled work area",
    customer_owned: "Customer-owned property",
    mixed: "Vendor and customer property",
    none: "No identifiable people",
    customer: "The customer may be identifiable",
    employee: "The assigned employee may be identifiable",
    multiple: "More than one person may be identifiable",
    controlled: "Only the planned work area",
    partial: "The work area and some surroundings",
    uncontrolled: "An area where people may enter unexpectedly",
    authorized_representative: "Customer's authorized representative",
    guardian: "Parent or legal guardian",
    vendor_manager: "Vendor manager",
    customer_controlled_residence: "Customer-controlled residence",
    customer_controlled_business_location: "Customer-controlled business location",
    vendor_controlled_business_location: "Vendor-controlled business location",
    assigned_service_professional: "Assigned service professional",
    customer_and_assigned_service_professional: "Customer and assigned service professional",
    service_area_equipment_item_and_work: "Service area, equipment or item, and the work being performed",
  };
  return labels[value] || value.replace(/_/g, " ");
}

export default function PermissionPage() {
  const token = String(useParams()?.token || "");
  const [permission, setPermission] = useState<Permission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState<"email" | "sms" | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState("");
  const [finished, setFinished] = useState<"allowed" | "declined" | "later" | "wrong_recipient" | null>(null);
  const [address, setAddress] = useState({ address: "", city: "", state: "", zipCode: "" });
  const simplifiedV1 = String(permission?.contentVersion || "").startsWith("recording-permission-v");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/consent/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json().catch(() => ({})) }))
      .then(({ response, body }) => {
        if (!active) return;
        if (!response.ok || !body?.permission) throw new Error(body?.error || "This recording request could not be loaded.");
        setPermission(body.permission);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "This recording request could not be loaded."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  async function beginVerification(nextChannel: "account" | "email" | "sms") {
    setBusy(`verify-${nextChannel}`);
    setError("");
    try {
      const response = await fetch(`/api/consent/${encodeURIComponent(token)}/verification/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: nextChannel }),
      });
      const body = await response.json().catch(() => ({}));
      if (body?.verified) {
        setVerified(true);
        setChannel(null);
      } else if (nextChannel !== "account") {
        setChannel(nextChannel);
      } else {
        setError("This signed-in account does not match the intended recipient. Use email or SMS verification instead.");
      }
    } catch {
      setError("Verification could not be started. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function verifyCode() {
    if (!channel || code.length !== 6) return;
    setBusy("code");
    setError("");
    const response = await fetch(`/api/consent/${encodeURIComponent(token)}/verification/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, code }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body?.verified) {
      setVerified(true);
      setChannel(null);
      setCode("");
    } else {
      setError(body?.error || "That code could not be verified. Request a new code if needed.");
    }
    setBusy("");
  }

  async function decide(decision: "allow" | "decline") {
    if (!permission?.authorityRequirement.permittedClaimedRoles.includes("customer")) {
      setError("This request cannot use the supported customer decision path.");
      return;
    }
    setBusy(decision);
    setError("");
    const response = await fetch(`/api/consent/${decision === "allow" ? "accept" : "decline"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        claimedRole: SUPPORTED_CUSTOMER_AUTHORITY.value,
        authorityScope: SUPPORTED_CUSTOMER_AUTHORITY.scope,
        customerBusinessAddress: permission?.recordingLocation === "customer-business" ? address : undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body?.success) setFinished(decision === "allow" ? "allowed" : "declined");
    else setError(body?.error || "Your decision could not be saved. Try again.");
    setBusy("");
  }

  async function wrongRecipient() {
    setBusy("wrong");
    const response = await fetch(`/api/consent/${encodeURIComponent(token)}/wrong-recipient`, { method: "POST" });
    if (response.ok) setFinished("wrong_recipient");
    else setError("The service provider could not be notified. Try again.");
    setBusy("");
  }

  if (loading) {
    return <main className={styles.page}><section className={styles.shell} aria-busy="true"><div className={styles.skeleton} /><div className={styles.skeletonTall} /></section></main>;
  }
  if (error && !permission) {
    return <main className={styles.page}><section className={styles.shell}><div className={styles.error} role="alert"><strong>Unable to open this request</strong><span>{error}</span></div></section></main>;
  }
  if (!permission) return null;
  if (finished) {
    const final = stateMessage(finished, simplifiedV1);
    return <main className={styles.page}><section className={styles.shell}><div className={styles.success}><CheckCircle2 /><div><h1>{final.title}</h1><p>{final.detail}</p></div></div></section></main>;
  }
  if (!permission.canDecide) {
    const final = stateMessage(permission.state, simplifiedV1);
    return <main className={styles.page}><section className={styles.shell}><div className={styles.status}><Clock3 /><div><h1>{final.title}</h1><p>{final.detail}</p></div></div></section></main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Recording permission</span>
          <h1>Choose whether this service may be recorded</h1>
          <p>This request was sent to you as the customer contact for this Service Order. You control whether Reliance may record the service.</p>
        </header>

        <div className={styles.serviceCard}>
          <div><span>Service provider</span><strong>{permission.vendorName}</strong></div>
          <div><span>Service</span><strong>{permission.serviceName}</strong></div>
          <div><span>Location type</span><strong>{permission.recordingLocation === "customer-business" ? "Customer business" : permission.recordingLocation === "business" ? "Vendor business" : "Customer residence"}</strong></div>
        </div>

        {permission.plannedScope ? (
          <div className={styles.serviceCard} aria-label="Approved recording scope">
            {permission.plannedScope.intentionalParticipantPlan ? (
              <>
                <div><span>Service site control</span><strong>{scopeLabel(permission.plannedScope.siteControl || "")}</strong></div>
                <div><span>Who may be intentionally identifiable</span><strong>{scopeLabel(permission.plannedScope.intentionalParticipantPlan)}</strong></div>
                <div><span>Recording boundary</span><strong>{scopeLabel(permission.plannedScope.recordingBoundary || "")}</strong></div>
                <div><span>Keep out of the recording</span><strong>Minors, unrelated people or conversations, private or sensitive information, credentials, keys, security details, and confidential information</strong></div>
              </>
            ) : (
              <>
                <div><span>Whose property may be recorded</span><strong>{scopeLabel(permission.plannedScope.propertyScope || "")}</strong></div>
                <div><span>Who may be identifiable</span><strong>{scopeLabel(permission.plannedScope.peopleScope || "")}</strong></div>
                <div><span>What the camera will show</span><strong>{scopeLabel(permission.plannedScope.frameControl || "")}</strong></div>
              </>
            )}
            <div><span>Recording decision</span><strong>{permission.plannedScope.authorityHolderType === "customer" ? "Verified customer contact" : scopeLabel(permission.plannedScope.authorityHolderType)}</strong></div>
            {!simplifiedV1 ? <div><span>Is recording required</span><strong>{permission.plannedScope.serviceCanContinueWithoutRecording ? "No - service may continue without recording" : "Yes - recording is required for this service"}</strong></div> : null}
            {permission.plannedScope.minorMayAppear ? <div><span>Children under 18</span><strong>May appear</strong></div> : null}
            {permission.plannedScope.protectedNonParticipantMayAppear ? <div><span>Bystanders or unrelated people</span><strong>May appear</strong></div> : null}
            {permission.plannedScope.sensitiveInformationMayAppear ? <div><span>Private documents, screens, or records</span><strong>May appear</strong></div> : null}
            {permission.plannedScope.identifiersMayAppear ? <div><span>Addresses, plates, keys, codes, or security details</span><strong>May appear</strong></div> : null}
            <div><span>Starting audience</span><strong>Private</strong></div>
          </div>
        ) : null}

        <div className={styles.education}>
          <article><ShieldCheck /><div><strong>Why you are being asked</strong><p>Reliance records Starting Condition, Work in Progress, and Final Result clips as proof of service.</p></div></article>
          {permission.audioEnabled ? (
            <article><Volume2 /><div><strong>Video and audio</strong><p>This Service Video will include sound because audio is part of documenting the service. Conversations and unrelated private information should not be intentionally recorded.</p></div></article>
          ) : (
            <article><VolumeX /><div><strong>Video only</strong><p>Audio will not be recorded.</p></div></article>
          )}
          <article><LockKeyhole /><div><strong>Private is the starting point</strong><p>Allowing recording does not make anything public. Public sharing would be a separate later decision.</p></div></article>
        </div>

        {!permission.authorityRequirement.canAuthorizeInCurrentFlow ? (
          <section className={styles.step}>
            <div className={styles.stepHeading}>
              <span><LockKeyhole /></span>
              <div>
                <h2>This request needs additional authority verification</h2>
                <p>{permission.authorityRequirement.explanation}</p>
              </div>
            </div>
            <div className={styles.decisionBox}>
              <p><strong>What happens now:</strong> Recording stays locked. Contact {permission.vendorName} to correct the required decision-maker or request a supported authority-verification path.</p>
              {!simplifiedV1 ? <div className={styles.actions}>
                <button className={styles.secondary} disabled={Boolean(busy)} onClick={() => setFinished("later")}>Decide later</button>
              </div> : null}
            </div>
          </section>
        ) : !verified ? (
          <section className={styles.step}>
            <div className={styles.stepHeading}><span>1</span><div><h2>Verify you received the request</h2><p>This prevents someone else from deciding with your link.</p></div></div>
            <div className={styles.actions}>
              <button className={styles.primary} disabled={Boolean(busy)} onClick={() => beginVerification("account")}><UserCheck />Use my signed-in account</button>
              {permission.verificationOptions.email ? <button className={styles.secondary} disabled={Boolean(busy)} onClick={() => beginVerification("email")}>Email code to {permission.recipientEmailMasked}</button> : null}
              {permission.verificationOptions.sms ? <button className={styles.secondary} disabled={Boolean(busy)} onClick={() => beginVerification("sms")}>Text code to {permission.recipientPhoneMasked}</button> : null}
            </div>
            {channel ? <div className={styles.codeRow}><label htmlFor="permission-code">6-digit code</label><input id="permission-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /><button className={styles.primary} disabled={code.length !== 6 || Boolean(busy)} onClick={verifyCode}>Verify code</button></div> : null}
          </section>
        ) : (
          <section className={styles.step}>
            <div className={styles.stepHeading}><span>2</span><div><h2>Make your recording decision</h2><p>You verified the customer contact Reliance intended for this Service Order. If this request is not for you, report it below instead of making a decision.</p></div></div>
            {permission.recordingLocation === "customer-business" ? <div className={styles.addressGrid}><label>Street address<input value={address.address} onChange={(event) => setAddress({ ...address, address: event.target.value })} /></label><label>City<input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>State<input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label><label>ZIP code<input inputMode="numeric" value={address.zipCode} onChange={(event) => setAddress({ ...address, zipCode: event.target.value })} /></label></div> : null}
            {simplifiedV1 ? (
              <div className={styles.decisionBox} aria-label="Customer recording decision">
                <h2>Your decision</h2>
                <p><strong>Allow Recording:</strong> Reliance may record the three Service Video stages according to the scope shown above. All remaining recording checks still apply.</p>
                <p><strong>Decline Recording:</strong> Reliance will not record through this work record, and the Reliance work record will be canceled. This does not cancel your underlying service with the provider.</p>
                <p><strong>This Request Is Not for Me:</strong> Use this only when the permission request was sent to the wrong person or contact.</p>
                <div className={styles.actions}>
                  <button className={styles.primary} disabled={Boolean(busy)} onClick={() => decide("allow")}>Allow Recording</button>
                  <button className={styles.danger} disabled={Boolean(busy)} onClick={() => decide("decline")}>Decline Recording</button>
                </div>
              </div>
            ) : (
              <div className={styles.decisionBox}><h2>Your decision</h2><p><strong>If you choose No:</strong> Reliance recording stays locked. {permission.plannedScope?.serviceCanContinueWithoutRecording ? "The service may continue without a Service Video." : "The business has said recording is required to complete this service, so the service will not proceed under this Service Order."}</p><p><strong>If you decide later:</strong> No decision is saved. Recording stays locked, you may return before this link expires, and the provider is not told that you approved or declined.</p><div className={styles.actions}><button className={styles.primary} disabled={Boolean(busy)} onClick={() => decide("allow")}>Allow recording</button><button className={styles.danger} disabled={Boolean(busy)} onClick={() => decide("decline")}>Decline recording</button><button className={styles.secondary} disabled={Boolean(busy)} onClick={() => setFinished("later")}>Decide later</button></div></div>
            )}
          </section>
        )}

        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <button className={styles.linkButton} disabled={Boolean(busy)} onClick={wrongRecipient}>This Request Is Not for Me</button>
      </section>
    </main>
  );
}
