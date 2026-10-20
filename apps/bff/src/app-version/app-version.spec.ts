import { AppVersionService } from "./app-version.service";
import type { PrismaService } from "../prisma/prisma.service";
import { compareAppVersions, isBelowMinAppVersion, isValidAppVersion } from "@bhavano/types/appVersion";

describe("compareAppVersions", () => {
  it("orders numerically, not as strings", () => {
    expect(compareAppVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareAppVersions("1.2.0", "1.10.0")).toBeLessThan(0);
  });

  it("treats a missing part as zero", () => {
    expect(compareAppVersions("1.2", "1.2.0")).toBe(0);
    expect(compareAppVersions("2", "1.9.9")).toBeGreaterThan(0);
  });
});

describe("isBelowMinAppVersion", () => {
  it("is true only when the app is older than the minimum", () => {
    expect(isBelowMinAppVersion("1.1.0", "1.2.0")).toBe(true);
    expect(isBelowMinAppVersion("1.2.0", "1.2.0")).toBe(false);
    expect(isBelowMinAppVersion("1.3.0", "1.2.0")).toBe(false);
  });

  it("never blocks when the minimum is unset or either value is unreadable", () => {
    expect(isBelowMinAppVersion("1.0.0", "")).toBe(false);
    expect(isBelowMinAppVersion("1.0.0", undefined)).toBe(false);
    expect(isBelowMinAppVersion(null, "1.2.0")).toBe(false);
    expect(isBelowMinAppVersion("abc", "1.2.0")).toBe(false);
    expect(isBelowMinAppVersion("1.0.0", "1.x")).toBe(false);
  });
});

describe("isValidAppVersion", () => {
  it("accepts one to three numeric parts", () => {
    expect(isValidAppVersion("1")).toBe(true);
    expect(isValidAppVersion("1.2")).toBe(true);
    expect(isValidAppVersion("1.2.0")).toBe(true);
    expect(isValidAppVersion("1.2.0.1")).toBe(false);
    expect(isValidAppVersion("1.2.0-beta")).toBe(false);
    expect(isValidAppVersion("")).toBe(false);
  });
});

describe("AppVersionService", () => {
  function make(row: { androidMinVersion: string; iosMinVersion: string; message: string } | null) {
    const prisma = {
      appVersionSetting: {
        findUnique: jest.fn().mockResolvedValue(row),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
    };
    return { prisma, service: new AppVersionService(prisma as unknown as PrismaService) };
  }

  it("defaults to no minimum, without inserting a row, when none is stored", async () => {
    const { prisma, service } = make(null);
    expect(await service.getSettings()).toEqual({ androidMinVersion: "", iosMinVersion: "", message: "" });
    expect(prisma.appVersionSetting.upsert).not.toHaveBeenCalled();
  });

  it("returns what an admin saved", async () => {
    const { service } = make({ androidMinVersion: "1.2.0", iosMinVersion: "", message: "Please update." });
    expect(await service.getSettings()).toEqual({ androidMinVersion: "1.2.0", iosMinVersion: "", message: "Please update." });
  });

  it("saves the three fields under the singleton id", async () => {
    const { prisma, service } = make(null);
    await service.updateSettings({ androidMinVersion: "1.2.0", iosMinVersion: "1.2.0", message: "" });
    expect(prisma.appVersionSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "singleton" } }),
    );
  });
});
