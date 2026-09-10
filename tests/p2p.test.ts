import { describe, expect, it } from "vitest";
import {
  averageTopPrices,
  isBankTransferMethodName,
  P2P_TOP_N,
} from "../shared/utils/p2p";

describe("p2p helpers", () => {
  it("averages the highest N prices", () => {
    expect(
      averageTopPrices([320, 333.3, 333.25, 310], {
        take: P2P_TOP_N,
        direction: "highest",
      }),
    ).toBe(333.275);
  });

  it("averages the lowest N prices", () => {
    expect(
      averageTopPrices([334.5, 333.42, 333.5, 340], {
        take: 2,
        direction: "lowest",
      }),
    ).toBe(333.46);
  });

  it("returns null for empty lists", () => {
    expect(
      averageTopPrices([], { take: 2, direction: "highest" }),
    ).toBeNull();
  });

  it("detects bank transfer method names", () => {
    expect(isBankTransferMethodName("Bank Transfer")).toBe(true);
    expect(isBankTransferMethodName("Bank Transfer (Sri Lanka)")).toBe(true);
    expect(isBankTransferMethodName("Airtime Mobile Top-Up")).toBe(false);
  });
});
