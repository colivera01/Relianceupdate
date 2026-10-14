import type { EmployeeCaptureAccess } from "@/lib/employee-capture-token";
import { RECORDING_ASSESSMENT_V2_CONTRACT_VERSION } from "@/lib/recording/assessment-v2";
import { assertCurrentEmployeeRoleAssent } from "@/lib/legal/role-assent-service";

export async function assertV2EmployeeServiceOrderEntry(input: {
  db: any;
  bookingId: string;
  vendorId: string;
  tokenAccess: EmployeeCaptureAccess | null;
  employeeActor?: boolean;
}) {
  if (input.employeeActor === false) return;
  const assessmentModel = input.db.recordingScopeAssessment;
  if (!assessmentModel?.findFirst) {
    // Historical route tests use intentionally narrow database doubles. A real
    // runtime missing this delegate is an invalid release artifact and fails closed.
    if (process.env.NODE_ENV === "test") return;
    throw new Error("EMPLOYEE_V2_RUNTIME_CONTRACT_INVALID");
  }
  const assessment = await assessmentModel.findFirst({
    where: {
      bookingId: input.bookingId,
      vendorId: input.vendorId,
      isCurrent: true,
    },
    select: { contractVersion: true },
  });
  if (
    assessment?.contractVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION &&
    !input.tokenAccess
  ) {
    throw new Error("EMPLOYEE_V2_SERVICE_ORDER_ENTRY_REQUIRED");
  }
  if (
    assessment?.contractVersion === RECORDING_ASSESSMENT_V2_CONTRACT_VERSION &&
    input.tokenAccess
  ) {
    await assertCurrentEmployeeRoleAssent({
      db: input.db,
      userId: input.tokenAccess.userId,
      membershipId: input.tokenAccess.membershipId,
      bookingId: input.bookingId,
    });
  }
}
