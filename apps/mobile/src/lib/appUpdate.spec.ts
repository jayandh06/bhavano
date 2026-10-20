import { updateRequirement } from "./appUpdate";

const settings = { androidMinVersion: "1.2.0", iosMinVersion: "", message: "Please update." };

describe("updateRequirement", () => {
  it("requires an update when the install is older than the platform's minimum", () => {
    expect(updateRequirement("android", "1.1.0", settings)).toEqual({ required: true, message: "Please update." });
  });

  it("lets a current or newer install through", () => {
    expect(updateRequirement("android", "1.2.0", settings).required).toBe(false);
    expect(updateRequirement("android", "1.3.1", settings).required).toBe(false);
  });

  it("uses the minimum for its own platform only", () => {
    expect(updateRequirement("ios", "1.0.0", settings).required).toBe(false);
  });

  it("fails open: nothing loaded yet, an unknown platform, or an unreadable version", () => {
    expect(updateRequirement("android", "1.1.0", undefined).required).toBe(false);
    expect(updateRequirement("web", "1.1.0", settings).required).toBe(false);
    expect(updateRequirement("android", null, settings).required).toBe(false);
    expect(updateRequirement("android", "dev", settings).required).toBe(false);
  });
});
