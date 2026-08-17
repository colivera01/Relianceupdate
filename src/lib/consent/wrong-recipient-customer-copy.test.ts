import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("wrong-recipient customer confirmation", () => {
  it("states that correction belongs to the provider and the customer may close the page", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src", "app", "consent", "[token]", "page.tsx"),
      "utf8",
    );
    expect(source).toContain("reported as misdirected");
    expect(source).toContain("provider must correct the recipient");
    expect(source).toContain("No further action is required from you");
    expect(source).toContain("You may close this page");
  });
});
