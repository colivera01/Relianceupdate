import { describe, expect, it } from "vitest";
import { getMaterialWorkRecordEditFields } from "./vendor-job-material-edit";

describe("material work-record edit detection", () => {
  it("detects evidence-bearing scope and service changes", () => {
    expect(
      getMaterialWorkRecordEditFields(
        { title: "Outlet repair", client: "Original Customer", serviceId: "service-1", peopleScope: "none" },
        { title: "Panel repair", client: "Corrected Customer", serviceId: "service-2", peopleScope: "customer" },
      ),
    ).toEqual(["title", "client", "serviceId", "peopleScope"]);
  });

  it("does not flag unchanged normalized values", () => {
    expect(
      getMaterialWorkRecordEditFields(
        { title: "Outlet repair", minorMayAppear: false },
        { title: " Outlet repair ", minorMayAppear: false },
      ),
    ).toEqual([]);
  });

  it("treats package audio scope as material", () => {
    expect(
      getMaterialWorkRecordEditFields(
        { title: "Outlet repair", audioRequested: false },
        { title: "Outlet repair", audioRequested: true },
      ),
    ).toEqual(["audioRequested"]);
  });
});
