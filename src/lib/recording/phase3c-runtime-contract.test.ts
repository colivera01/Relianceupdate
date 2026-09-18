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
    expect(panel).toContain('purpose="EMPLOYEE_RECORDING_PARTICIPATION"');
    expect(panel).not.toContain("EMPLOYEE_STANDING_PUBLIC_MEDIA");
    expect(panel).not.toContain("public-media-consent");
  });
});
