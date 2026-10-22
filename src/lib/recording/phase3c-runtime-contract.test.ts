import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { EMPLOYEE_V2_RUNTIME_ACTIVATION_STATE } from "@/lib/recording/employee-v2-service-order";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Phase 3C dormant Employee runtime contract", () => {
  it("does not introduce an Employee dashboard", () => {
    expect(fs.existsSync(path.join(root, "src/app/employee/dashboard/page.tsx"))).toBe(false);
    expect(EMPLOYEE_V2_RUNTIME_ACTIVATION_STATE).toBe(
      "DORMANT_REQUIRES_EXPLICIT_V2_CONTEXT",
    );
  });

  it("keeps V2 out of the signed-in legacy work list and renders it only in the Service Order", () => {
    const route = read("src/app/api/employee/jobs/route.ts");
    const page = read("src/app/employee/jobs/page.tsx");
    expect(route).toContain("if (isV2 && !tokenAccess) return null");
    expect(route).toContain("buildEmployeeV2ServiceOrderView");
    expect(page).toContain("EmployeeV2ServiceOrderPanel");
    expect(page).toContain("job.recordingCompliance?.v2ServiceOrder");
  });

  it("requires contextual Service Order entry across recording and media mutations", () => {
    const protectedRoutes = [
      "src/app/api/employee/jobs/[jobId]/start/route.ts",
      "src/app/api/employee/jobs/[jobId]/recording-certification/route.ts",
      "src/app/api/employee/jobs/[jobId]/verify-location/route.ts",
      "src/app/api/employee/jobs/[jobId]/safety-check/route.ts",
      "src/app/api/employee/jobs/[jobId]/recording-access/route.ts",
      "src/app/api/employee/jobs/[jobId]/stage/route.ts",
      "src/app/api/employee/jobs/[jobId]/complete/route.ts",
      "src/app/api/vendors/[vendorId]/media/sessions/route.ts",
      "src/app/api/vendors/[vendorId]/media/sessions/[sessionId]/route.ts",
      "src/app/api/vendors/[vendorId]/media/[assetId]/route.ts",
      "src/app/api/vendors/[vendorId]/media/upload/init/route.ts",
      "src/app/api/vendors/[vendorId]/media/upload/proxy/route.ts",
      "src/app/api/vendors/[vendorId]/media/upload/status/route.ts",
      "src/app/api/vendors/[vendorId]/media/upload/complete/route.ts",
    ];
    for (const route of protectedRoutes) {
      expect(read(route), route).toContain("assertV2EmployeeServiceOrderEntry");
    }
  });

  it("uses the canonical V2 resolver inside recording-session authorization", () => {
    const route = read("src/app/api/vendors/[vendorId]/media/sessions/route.ts");
    expect(route.match(/resolveCurrentV2RecordingAuthorization/g)?.length).toBeGreaterThanOrEqual(3);
    expect(route).toContain("db: tx");
    expect(route).toContain("persistAllowedRecordingGateDecision");
  });

  it("keeps standing Public participation out of the V2 Service Order decision panel", () => {
    const panel = read("src/components/employee/EmployeeV2ServiceOrderPanel.tsx");
    expect(panel).toContain("EmployeeServiceOrderLegalAssent");
    expect(panel).toContain('purpose="EMPLOYEE_RECORDING_PARTICIPATION"');
    expect(panel).not.toContain("EMPLOYEE_STANDING_PUBLIC_MEDIA");
    expect(panel).not.toContain("public-media-consent");
  });

  it("keeps accountless legal assent separate from the later recording choice", () => {
    const legalGate = read("src/components/employee/EmployeeServiceOrderLegalAssent.tsx");
    expect(legalGate).toContain('purpose="EMPLOYEE_SERVICE_ORDER_LEGAL_ASSENT"');
    expect(legalGate).toContain("This Service Order is not for me");
    expect(legalGate).toContain("does not submit a recording-participation choice");
    expect(legalGate).not.toContain('decision="ALLOW"');
    expect(legalGate).not.toContain("EMPLOYEE_STANDING_PUBLIC_MEDIA");
  });

  it("renders an explicit high-contrast checked state for every legal acknowledgment", () => {
    const legalGate = read("src/components/employee/EmployeeServiceOrderLegalAssent.tsx");
    expect(legalGate).toContain('className="peer sr-only"');
    expect(legalGate).toContain("peer-checked:bg-blue-700");
    expect(legalGate).toContain('<Check className="h-4 w-4 text-white" strokeWidth={3} />');
    expect(legalGate).toContain('checked ? "border-blue-700 bg-blue-50"');
  });

  it("renders an explicit high-contrast checked state for Manager Work Record attestation", () => {
    const managerAttestation = read("src/components/vendor/ManagerWorkRecordAttestation.tsx");
    expect(managerAttestation).toContain('className="peer sr-only"');
    expect(managerAttestation).toContain("peer-checked:bg-blue-700");
    expect(managerAttestation).toContain('<Check className="h-4 w-4 text-white" strokeWidth={3} />');
    expect(managerAttestation).toContain('confirmed ? "border-blue-700 bg-blue-50"');
  });

  it("resolves every Service Video stage through its own canonical recording gate", () => {
    const route = read("src/app/api/employee/jobs/route.ts");
    expect(route).toContain('recordingStage: stage');
    expect(route).not.toContain('permissionGate.correctionRequestedStages.length\n              ? await loadRecordingPermissionGate');
  });

  it("requires one exact-context Service Order safety/location baseline before opening any camera", () => {
    const locationRoute = read("src/app/api/employee/jobs/[jobId]/verify-location/route.ts");
    const safetyRoute = read("src/app/api/employee/jobs/[jobId]/safety-check/route.ts");
    const page = read("src/app/employee/jobs/page.tsx");
    const safetyCheck = read("src/components/employee/EmployeeStageSafetyCheck.tsx");

    expect(locationRoute).toContain("persistV2StageLocationAttempt");
    expect(locationRoute).toContain("serviceOrderSafetyRequirement");
    expect(locationRoute).toContain("stage: evidenceRequirement.stage");
    expect(locationRoute).toContain("locationAttemptId: locationAttempt.id");
    expect(safetyRoute).toContain("appendEmployeeRecordingSafetyEvidence");
    expect(safetyRoute).toContain("assertV2EmployeeServiceOrderEntry");
    expect(safetyRoute).toContain("recordingStage");
    expect(safetyRoute).toContain("serviceOrderSafetyRequirement");
    expect(page).toContain("EmployeeStageSafetyCheck");
    expect(page).toContain("isEmployeeStageSafetyResolvableBlock");
    expect(safetyCheck).toContain("Verify location and complete check");
    expect(safetyCheck).toContain("same check supports all three Service Videos");
    expect(safetyCheck).toContain("/verify-location");
    expect(safetyCheck).toContain("/safety-check");
    expect(page).toContain("/recording-access");
    expect(page).toContain("usesV2StageSafety");
    expect(page).toContain("Safety or location conditions changed?");
  });
});
