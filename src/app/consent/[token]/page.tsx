"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock3, LockKeyhole, ShieldCheck, UserCheck, VolumeX } from "lucide-react";

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
    propertyScope: string;
    peopleScope: string;
    frameControl: string;
    residenceInterior: boolean;
    businessInterior: boolean;
    minorMayAppear: boolean;
    protectedNonParticipantMayAppear: boolean;
    sensitiveInformationMayAppear: boolean;
    identifiersMayAppear: boolean;
    authorityHolderType: string;
    serviceCanContinueWithoutRecording: boolean;
    essentialPrivateRecording: boolean;
    audioEnabled: false;
    initialAudience: "private";
  } | null;
  canDecide: boolean;
};

const ROLE_OPTIONS = [
  { value: "customer", label: "I am the customer", scope: "self_and_property" },
  { value: "authorized_representative", label: "I am authorized for this customer and location", scope: "authorized_location_and_property" },
  { value: "customer_business_representative", label: "I represent this business location", scope: "business_location_and_property" },
  { value: "guardian", label: "I am the legal guardian of a minor", scope: "guardian_for_minor" },
] as const;

function stateMessage(state: string) {
  const messages: Record<string, { title: string; detail: string }> = {
    allowed: { title: "Recording is allowed", detail: "Identity and authority were verified. Recordings will start Private." },
    decided: { title: "A decision was already saved", detail: "This secure link cannot be used again." },
    declined: { title: "Recording was declined", detail: "Reliance recording stays locked. The service may continue without recording." },
    later: { title: "No decision was saved", detail: "Recording stays locked. You can return to this secure link before it expires if you want to decide." },
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
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState("");
  const [finished, setFinished] = useState<"allowed" | "declined" | "later" | "wrong_recipient" | null>(null);
  const [address, setAddress] = useState({ address: "", city: "", state: "", zipCode: "" });

  const selectedRole = useMemo(() => ROLE_OPTIONS.find((option) => option.value === role), [role]);

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
    if (!selectedRole) {
      setError("Choose the role that describes your authority for this service.");
      return;
    }
    setBusy(decision);
    setError("");
    const response = await fetch(`/api/consent/${decision === "allow" ? "accept" : "decline"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        claimedRole: selectedRole.value,
        authorityScope: selectedRole.scope,
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
    const final = stateMessage(finished);
    return <main className={styles.page}><section className={styles.shell}><div className={styles.success}><CheckCircle2 /><div><h1>{final.title}</h1><p>{final.detail}</p></div></div></section></main>;
  }
  if (!permission.canDecide) {
    const final = stateMessage(permission.state);
    return <main className={styles.page}><section className={styles.shell}><div className={styles.status}><Clock3 /><div><h1>{final.title}</h1><p>{final.detail}</p></div></div></section></main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>Recording permission</span>
          <h1>Choose whether this service may be recorded</h1>
          <p>{permission.vendorName} uses Reliance to create proof of the work. You are in control of this decision.</p>
        </header>

        <div className={styles.serviceCard}>
          <div><span>Service provider</span><strong>{permission.vendorName}</strong></div>
          <div><span>Service</span><strong>{permission.serviceName}</strong></div>
          <div><span>Location type</span><strong>{permission.recordingLocation === "customer-business" ? "Customer business" : "Customer residence"}</strong></div>
        </div>

        {permission.plannedScope ? (
          <div className={styles.serviceCard} aria-label="Approved recording scope">
            <div><span>Whose property may be recorded</span><strong>{scopeLabel(permission.plannedScope.propertyScope)}</strong></div>
            <div><span>Who may be identifiable</span><strong>{scopeLabel(permission.plannedScope.peopleScope)}</strong></div>
            <div><span>What the camera will show</span><strong>{scopeLabel(permission.plannedScope.frameControl)}</strong></div>
            <div><span>Who can approve</span><strong>{scopeLabel(permission.plannedScope.authorityHolderType)}</strong></div>
            <div><span>Is recording required</span><strong>{permission.plannedScope.serviceCanContinueWithoutRecording ? "No - service may continue without recording" : "Yes - recording is required for this service"}</strong></div>
            {permission.plannedScope.minorMayAppear ? <div><span>Children under 18</span><strong>May appear</strong></div> : null}
            {permission.plannedScope.protectedNonParticipantMayAppear ? <div><span>Bystanders or unrelated people</span><strong>May appear</strong></div> : null}
            {permission.plannedScope.sensitiveInformationMayAppear ? <div><span>Private documents, screens, or records</span><strong>May appear</strong></div> : null}
            {permission.plannedScope.identifiersMayAppear ? <div><span>Addresses, plates, keys, codes, or security details</span><strong>May appear</strong></div> : null}
            <div><span>Starting audience</span><strong>Private</strong></div>
          </div>
        ) : null}

        <div className={styles.education}>
          <article><ShieldCheck /><div><strong>Why you are being asked</strong><p>Reliance records Starting Condition, Work in Progress, and Final Result clips as proof of service.</p></div></article>
          <article><VolumeX /><div><strong>Audio is off</strong><p>This request does not authorize conversation or audio recording.</p></div></article>
          <article><LockKeyhole /><div><strong>Private is the starting point</strong><p>Allowing recording does not make anything public. Public sharing would be a separate later decision.</p></div></article>
        </div>

        {!verified ? (
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
            <div className={styles.stepHeading}><span>2</span><div><h2>Confirm your authority</h2><p>Choose the role that accurately describes you. A business representative cannot decide for unrelated people who may appear.</p></div></div>
            <div className={styles.roleGrid}>{ROLE_OPTIONS.map((option) => <label key={option.value} className={role === option.value ? styles.roleSelected : styles.role}><input type="radio" name="authority-role" value={option.value} checked={role === option.value} onChange={() => setRole(option.value)} /><span>{option.label}</span></label>)}</div>
            {permission.recordingLocation === "customer-business" ? <div className={styles.addressGrid}><label>Street address<input value={address.address} onChange={(event) => setAddress({ ...address, address: event.target.value })} /></label><label>City<input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label><label>State<input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label><label>ZIP code<input inputMode="numeric" value={address.zipCode} onChange={(event) => setAddress({ ...address, zipCode: event.target.value })} /></label></div> : null}
            <div className={styles.decisionBox}><h2>Your decision</h2><p><strong>If you choose No:</strong> Reliance recording stays locked. {permission.plannedScope?.serviceCanContinueWithoutRecording ? "The service may continue without a Service Video." : "The business has said recording is required to complete this service, so the service will not proceed under this Service Order."}</p><div className={styles.actions}><button className={styles.primary} disabled={!role || Boolean(busy)} onClick={() => decide("allow")}>Allow recording</button><button className={styles.danger} disabled={!role || Boolean(busy)} onClick={() => decide("decline")}>Decline recording</button><button className={styles.secondary} disabled={Boolean(busy)} onClick={() => setFinished("later")}>Decide later</button></div></div>
          </section>
        )}

        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        <button className={styles.linkButton} disabled={Boolean(busy)} onClick={wrongRecipient}>This request is not for me</button>
      </section>
    </main>
  );
}
