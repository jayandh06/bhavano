import { describe, expect, it } from "vitest";
import { boostRecoveryMessage, MIN_SAMPLE_SIZE, type BoostEffectivenessDto } from "@bhavano/types/boostEffectiveness";

function stats(overrides: Partial<BoostEffectivenessDto> = {}): BoostEffectivenessDto {
  return {
    avgViews7dBoosted: 4,
    avgViews7dUnboosted: 2,
    contactRate7dBoosted: 0.4,
    contactRate7dUnboosted: 0.2,
    boostedSampleSize: MIN_SAMPLE_SIZE,
    unboostedSampleSize: MIN_SAMPLE_SIZE,
    computedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("boostRecoveryMessage", () => {
  it("falls back to the honest non-numeric message before the first computation has ever run", () => {
    const msg = boostRecoveryMessage(null);
    expect(msg.hasEnoughData).toBe(false);
    expect(msg.headline).toBe("Featured ads get priority placement and reach more buyers.");
  });

  it("falls back when the boosted cohort hasn't reached the minimum sample size", () => {
    const msg = boostRecoveryMessage(stats({ boostedSampleSize: MIN_SAMPLE_SIZE - 1 }));
    expect(msg.hasEnoughData).toBe(false);
  });

  it("falls back when the unboosted cohort hasn't reached the minimum sample size", () => {
    const msg = boostRecoveryMessage(stats({ unboostedSampleSize: MIN_SAMPLE_SIZE - 1 }));
    expect(msg.hasEnoughData).toBe(false);
  });

  it("quotes a real contact-rate lift when both cohorts clear the minimum and the lift is real", () => {
    const msg = boostRecoveryMessage(stats({ contactRate7dBoosted: 0.4, contactRate7dUnboosted: 0.2 }));
    expect(msg.hasEnoughData).toBe(true);
    expect(msg.headline).toContain("2.0x more often");
  });

  it("falls back to views when there's no unboosted contact-rate baseline to compare against", () => {
    const msg = boostRecoveryMessage(
      stats({ contactRate7dBoosted: 0.4, contactRate7dUnboosted: 0, avgViews7dBoosted: 6, avgViews7dUnboosted: 2 }),
    );
    expect(msg.hasEnoughData).toBe(true);
    expect(msg.headline).toContain("3.0x more views");
  });

  it("falls back to the honest message rather than overselling a negligible or negative lift", () => {
    const msg = boostRecoveryMessage(
      stats({ contactRate7dBoosted: 0.2, contactRate7dUnboosted: 0.21, avgViews7dBoosted: 2, avgViews7dUnboosted: 2.1 }),
    );
    expect(msg.hasEnoughData).toBe(false);
  });
});
