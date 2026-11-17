import { describe, expect, it } from "vitest";
import type { DetailsIssue } from "@bhavano/types/postDetailsIssues";
import { issueForTarget, requiredAttributeStates, requiredState } from "./requiredFieldState";

const missing = (target: string): DetailsIssue => ({ target, text: `${target} missing`, missing: true, group: "other" });
const wrong = (target: string): DetailsIssue => ({ target, text: `${target} wrong`, missing: false, group: "other" });

describe("requiredState", () => {
  it("is ok when there is no problem for the field", () => {
    expect(requiredState(undefined, false)).toBe("ok");
    expect(requiredState(undefined, true)).toBe("ok");
  });

  it("is a soft `empty` while the field is simply not filled in yet", () => {
    expect(requiredState(missing("price"), false)).toBe("empty");
  });

  it("becomes `error` once its message is on screen (left empty after a visit, or Preview tapped)", () => {
    expect(requiredState(missing("price"), true)).toBe("error");
  });

  it("is `error` at once when a value has to change", () => {
    expect(requiredState(wrong("price"), false)).toBe("error");
  });
});

describe("issueForTarget", () => {
  it("finds the problem for a target, or nothing", () => {
    const issues = [missing("photos"), wrong("title")];
    expect(issueForTarget(issues, "title")?.text).toBe("title wrong");
    expect(issueForTarget(issues, "location")).toBeUndefined();
  });
});

describe("requiredAttributeStates", () => {
  const keys = ["bedrooms", "floor", "fromBroker"];

  it("marks the unfilled ones empty and the filled ones ok", () => {
    const states = requiredAttributeStates(keys, [missing("attr:bedrooms"), missing("posted_by")], {});
    expect(states).toEqual({ bedrooms: "empty", floor: "ok", fromBroker: "empty" });
  });

  it("looks up Posted by under its own target, and also under the plain attribute target", () => {
    expect(requiredAttributeStates(["fromBroker"], [missing("posted_by")], {}).fromBroker).toBe("empty");
    expect(requiredAttributeStates(["fromBroker"], [missing("attr:fromBroker")], {}).fromBroker).toBe("empty");
    expect(requiredAttributeStates(["fromBroker"], [], {}).fromBroker).toBe("ok");
  });

  it("turns a field `error` when its message is being shown", () => {
    const states = requiredAttributeStates(keys, [missing("attr:bedrooms"), missing("attr:floor")], { "attr:floor": "Floor is required" });
    expect(states).toEqual({ bedrooms: "empty", floor: "error", fromBroker: "ok" });
  });

  it("turns a wrong value `error` without waiting for a message", () => {
    expect(requiredAttributeStates(["floor"], [wrong("attr:floor")], {}).floor).toBe("error");
  });

  it("returns nothing for a category with no required fields", () => {
    expect(requiredAttributeStates([], [missing("attr:bedrooms")], {})).toEqual({});
  });
});
