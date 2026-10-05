const mockPlatform = { OS: "android" };
jest.mock("react-native", () => ({ Platform: mockPlatform }));
jest.mock("expo-application", () => ({
  getInstallReferrerAsync: jest.fn(),
  getInstallationTimeAsync: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock("./analyticsSession", () => ({ recordAppPageView: jest.fn() }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { recordAppPageView } from "./analyticsSession";
import {
  appInstallTrailPath,
  installAcquisitionFields,
  parseInstallReferrer,
  recordInstallReferrerOnce,
} from "./installReferrer";

const getItem = AsyncStorage.getItem as jest.Mock;
const setItem = AsyncStorage.setItem as jest.Mock;
const getReferrer = Application.getInstallReferrerAsync as jest.Mock;
const getInstallTime = Application.getInstallationTimeAsync as jest.Mock;
const recordPageView = recordAppPageView as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  mockPlatform.OS = "android";
});

describe("parseInstallReferrer", () => {
  it("reads the utm fields the website's Play links carry", () => {
    expect(parseInstallReferrer("utm_source=bhavano_web&utm_medium=qr&utm_campaign=footer")).toEqual({
      source: "bhavano_web",
      medium: "qr",
      campaign: "footer",
    });
  });

  it("reads Play's organic referrer and ignores fields it doesn't know", () => {
    expect(parseInstallReferrer("utm_source=google-play&utm_medium=organic&gclid=x")).toEqual({
      source: "google-play",
      medium: "organic",
    });
  });

  it("decodes escapes and survives a malformed pair", () => {
    expect(parseInstallReferrer("utm_source=a%20b&utm_medium=%E0%A4&utm_campaign=c+d")).toEqual({
      source: "a b",
      campaign: "c d",
    });
    expect(parseInstallReferrer("")).toEqual({});
  });
});

describe("appInstallTrailPath", () => {
  it("encodes only the fields present", () => {
    expect(appInstallTrailPath({ source: "bhavano_web", medium: "qr", campaign: "post_success" })).toBe(
      "/app-install?source=bhavano_web&medium=qr&campaign=post_success",
    );
    expect(appInstallTrailPath({})).toBe("/app-install");
  });
});

describe("recordInstallReferrerOnce", () => {
  it("stores the referrer and logs a fresh install in the trail", async () => {
    getItem.mockResolvedValue(null);
    getReferrer.mockResolvedValue("utm_source=bhavano_web&utm_medium=qr&utm_campaign=footer");
    getInstallTime.mockResolvedValue(new Date(Date.now() - 60_000));

    await recordInstallReferrerOnce();

    expect(setItem).toHaveBeenCalledWith(
      "bhavano.installAttribution",
      JSON.stringify({ source: "bhavano_web", medium: "qr", campaign: "footer" }),
    );
    expect(recordPageView).toHaveBeenCalledWith("/app-install?source=bhavano_web&medium=qr&campaign=footer");
  });

  it("stores but doesn't log an install from days ago (an app update reaching this code)", async () => {
    getItem.mockResolvedValue(null);
    getReferrer.mockResolvedValue("utm_source=google-play&utm_medium=organic");
    getInstallTime.mockResolvedValue(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));

    await recordInstallReferrerOnce();

    expect(setItem).toHaveBeenCalled();
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("does nothing once already stored", async () => {
    getItem.mockResolvedValue("{}");
    await recordInstallReferrerOnce();
    expect(getReferrer).not.toHaveBeenCalled();
  });

  it("stores nothing when the referrer read fails, so the next launch retries", async () => {
    getItem.mockResolvedValue(null);
    getReferrer.mockRejectedValue(new Error("service unavailable"));
    getInstallTime.mockResolvedValue(new Date());

    await expect(recordInstallReferrerOnce()).resolves.toBeUndefined();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("is Android only", async () => {
    mockPlatform.OS = "ios";
    await recordInstallReferrerOnce();
    expect(getItem).not.toHaveBeenCalled();
  });
});

describe("installAcquisitionFields", () => {
  it("maps the stored referrer to the login acquisition fields", async () => {
    getItem.mockResolvedValue(JSON.stringify({ source: "bhavano_web", medium: "qr", campaign: "footer" }));
    await expect(installAcquisitionFields()).resolves.toEqual({
      acquisitionSource: "bhavano_web",
      acquisitionMedium: "qr",
      acquisitionCampaign: "footer",
    });
  });

  it("clips to the login DTO limit so a long referrer can't fail login", async () => {
    getItem.mockResolvedValue(JSON.stringify({ source: "x".repeat(300) }));
    const fields = await installAcquisitionFields();
    expect(fields.acquisitionSource).toHaveLength(100);
  });

  it("is empty with nothing stored, no source, or bad JSON", async () => {
    getItem.mockResolvedValue(null);
    await expect(installAcquisitionFields()).resolves.toEqual({});
    getItem.mockResolvedValue(JSON.stringify({ medium: "qr" }));
    await expect(installAcquisitionFields()).resolves.toEqual({});
    getItem.mockResolvedValue("{not json");
    await expect(installAcquisitionFields()).resolves.toEqual({});
  });
});
