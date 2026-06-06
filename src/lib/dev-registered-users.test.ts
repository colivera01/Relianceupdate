import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findRegisteredUserByEmail, syncRegisteredUsersFromDisk } from "./dev-registered-users";

const registryFile = path.join(process.cwd(), "tmp", "dev-registered-users.json");
const originalRegistryContents = fs.existsSync(registryFile)
  ? fs.readFileSync(registryFile, "utf8")
  : null;

afterEach(() => {
  if (originalRegistryContents == null) {
    if (fs.existsSync(registryFile)) {
      fs.unlinkSync(registryFile);
    }
    return;
  }

  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  fs.writeFileSync(registryFile, originalRegistryContents, "utf8");
  syncRegisteredUsersFromDisk();
});

describe("dev-registered-users", () => {
  it("reads persisted registry files with a UTF-8 BOM", () => {
    fs.mkdirSync(path.dirname(registryFile), { recursive: true });
    fs.writeFileSync(
      registryFile,
      `\uFEFF${JSON.stringify([
        {
          id: "bom-user",
          email: "bom-user@example.net",
          password: "BomPass1!",
          userType: "customer",
        },
      ])}`,
      "utf8"
    );

    syncRegisteredUsersFromDisk();

    expect(findRegisteredUserByEmail("bom-user@example.net")).toMatchObject({
      id: "bom-user",
      email: "bom-user@example.net",
    });
  });
});
