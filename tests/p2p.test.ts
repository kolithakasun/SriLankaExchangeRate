import { describe, expect, it } from "vitest";
import {
  BINANCE_BANK_SRI_LANKA,
  isBinanceBankSriLanka,
  pickBookPrice,
} from "../shared/utils/p2p";

describe("p2p helpers", () => {
  it("picks competitive highest from the top of a sell book", () => {
    // API order: best bids first, then weaker / outlier lows at the end.
    expect(
      pickBookPrice([331.88, 331.88, 331.87, 331.5, 325.02], "highest"),
    ).toBe(331.88);
  });

  it("picks competitive lowest from the top of a buy book", () => {
    // API order: best asks first, then expensive outliers later.
    expect(
      pickBookPrice([333.45, 333.8, 333.86, 334.0, 349.99], "lowest"),
    ).toBe(333.45);
  });

  it("does not use far-page outliers when window is limited", () => {
    const sell = [332.88, 332.86, 332.8, 332.7, 332.5, 320, 310];
    expect(pickBookPrice(sell, "highest")).toBe(332.88);
    const buy = [333.0, 333.1, 333.2, 333.5, 334, 349, 360];
    expect(pickBookPrice(buy, "lowest")).toBe(333.0);
  });

  it("returns null for empty lists", () => {
    expect(pickBookPrice([], "highest")).toBeNull();
  });

  it("detects BankSriLanka methods only", () => {
    expect(BINANCE_BANK_SRI_LANKA).toBe("BankSriLanka");
    expect(
      isBinanceBankSriLanka({
        identifier: "BankSriLanka",
        tradeMethodName: "Bank Transfer (Sri Lanka)",
      }),
    ).toBe(true);
    expect(
      isBinanceBankSriLanka({
        identifier: "BANK",
        tradeMethodName: "Bank Transfer",
      }),
    ).toBe(false);
  });
});
