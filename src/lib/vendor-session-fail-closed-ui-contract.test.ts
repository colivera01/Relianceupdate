import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getClientActorSessionKey } from "@/lib/client-session";

function source(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function browserStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("vendor session fail-closed UI contract", () => {
  it("binds client state to an opaque actor and session identity", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", browserStorage({ authToken: "session-token-a" }));
    const actor = {
      id: "user-1",
      email: "vendor@example.com",
      userType: "both",
      availableProfiles: ["vendor", "customer"],
    };
    const first = getClientActorSessionKey(actor);

    vi.stubGlobal("sessionStorage", browserStorage({ authToken: "session-token-b" }));
    const replacedSession = getClientActorSessionKey(actor);
    const changedActor = getClientActorSessionKey({ ...actor, id: "user-2" });

    expect(first).not.toBe(replacedSession);
    expect(first).not.toBe(changedActor);
    expect(first).not.toContain("session-token-a");
    expect(replacedSession).not.toContain("session-token-b");
  });

  it("does not promote cached vendor context before fresh actor authorization", () => {
    const hook = source("src/hooks/useVendorProfile.ts");

    expect(hook).toContain("getClientActorSessionKey(user)");
    expect(hook).toContain("if (status === 401 || status === 403)");
    expect(hook).toContain("clearVendorContextCache(userId)");
    expect(hook).toContain("data: hasCurrentActorProfile ? data : null");
    expect(hook).toContain("checkedActorKey === actorKey");
    expect(hook).toContain("activeActorKeyRef.current === actorKey");
    expect(hook).not.toContain("if (cachedContext?.vendorId) {");
  });

  it("renders vendor children only after the current actor access check resolves", () => {
    const layout = source("src/app/vendor/layout.tsx");

    expect(layout).toContain("const hasResolvedVendorAccessState = hasLiveVendorAccess || isVendorAccessRestricted");
    expect(layout).toContain("if (!hasResolvedVendorAccessState && vendorProfileLoading)");
    expect(layout).toContain("if (!hasResolvedVendorAccessState)");
  });

  it("purges job UI on actor changes, authorization failures, and late responses", () => {
    const page = source("src/app/vendor/jobs/[jobId]/page.tsx");

    expect(page).toContain("getClientActorSessionKey(user)");
    expect(page).toContain("const clearLoadedJobState = useCallback(() => {");
    expect(page).toContain("loadRequestRef.current += 1");
    expect(page).toContain("response.status !== 401 && response.status !== 403");
    expect(page).toContain("void refetchVendorProfile()");
    expect(page).toContain("if (!isCurrentRequest()) return");
    expect(page).toContain("activeContextKeyRef.current === expectedContextKey");
    expect(page).toContain("if (!isActiveContext(actionContextKey)) return");
    expect(page).toContain("loadedContextKey === currentContextKey");
    expect(page).toContain("hasCurrentLoadedContext && job");
    expect(page).toContain("key={`${actorKey}:${effectiveVendorId}:${job.id}`}");
    expect(page).toContain("actorKey={actorKey}");
  });

  it("reloads Manager attestation for the actor and clears stale state first", () => {
    const component = source("src/components/vendor/ManagerWorkRecordAttestation.tsx");

    expect(component).toContain("actorKey: string");
    expect(component).toContain("setView(null)");
    expect(component).toContain("setConfirmed(false)");
    expect(component).toContain("const controller = new AbortController()");
    expect(component).toContain("controller.abort();");
    expect(component).toContain("if (!activeRef.current) return");
    expect(component).toContain("response.status === 401 || response.status === 403");
    expect(component).toContain("props.onAuthorizationFailure?.(");
  });
});
