import { describe, expect, it } from "vitest";
import {
  BINANCE_BANK_SRI_LANKA,
  isBinanceBankSriLanka,
  pickBookPrice,
} from "../shared/utils/p2p";

describe("p2p helpers", () => {
  it("picks the single highest sell price", () => {
    expect(pickBookPrice([320, 333.3, 333.25, 310], "highest")).toBe(333.3);
  });

  it("picks the single lowest buy price", () => {
    expect(pickBookPrice([334.5, 333.42, 333.5, 340], "lowest")).toBe(333.42);
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
    expect(
      isBinanceBankSriLanka({
        identifier: "Mobiletopup",
        tradeMethodName: "Airtime Mobile Top-Up",
      }),
    ).toBe(false);
  });
});
