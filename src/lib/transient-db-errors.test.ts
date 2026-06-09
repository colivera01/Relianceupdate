import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTransientDbConnectivityError,
  withTransientDbRetry,
} from "@/lib/transient-db-errors";

describe("isTransientDbConnectivityError", () => {
  it("recognizes Prisma reachability failures by code", () => {
    expect(isTransientDbConnectivityError({ code: "P1001" })).toBe(true);
  });

  it("recognizes Prisma reachability failures by message", () => {
    expect(
      isTransientDbConnectivityError(new Error("Can't reach database server at host:1433"))
    ).toBe(true);
  });

  it("does not flag non-transient errors", () => {
    expect(isTransientDbConnectivityError(new Error("Unique constraint failed"))).toBe(false);
  });
});

describe("withTransientDbRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries transient database failures before succeeding", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Can't reach database server at host:1433"))
      .mockResolvedValue("ok");

    const assertion = expect(withTransientDbRetry(operation)).resolves.toBe("ok");
    await vi.runAllTimersAsync();

    await assertion;
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("retries up to the configured limit before surfacing the transient failure", async () => {
    vi.useFakeTimers();
    const failure = new Error("Can't reach database server at host:1433");
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(failure);

    const assertion = expect(withTransientDbRetry(operation)).rejects.toBe(failure);
    await vi.runAllTimersAsync();

    await assertion;
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-transient failures", async () => {
    const failure = new Error("Unique constraint failed");
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(failure);

    await expect(withTransientDbRetry(operation)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
