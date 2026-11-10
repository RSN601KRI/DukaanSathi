import { describe, it, expect } from "vitest";
import { parseCommand } from "./parser";

describe("parseCommand", () => {
  it("add_stock Hinglish", () => {
    expect(parseCommand("10 kilo chawal aaya")).toMatchObject({
      action: "add_stock",
      product: "chawal",
      quantity: 10,
      unit: "kg",
      missing: [],
    });
  });
  it("record_sale with price", () => {
    expect(parseCommand("2 kilo cheeni becha 90 rupaye")).toMatchObject({
      action: "record_sale",
      product: "cheeni",
      quantity: 2,
      price: 90,
    });
  });
  it("add_credit Devanagari", () => {
    expect(parseCommand("रमेश को 500 रुपये उधार")).toMatchObject({
      action: "add_credit",
      customer: "रमेश",
      amount: 500,
    });
  });
  it("get_stock", () => {
    expect(parseCommand("atta kitna bacha hai")).toMatchObject({
      action: "get_stock",
      product: "atta",
    });
  });
  it("summary", () => {
    expect(parseCommand("aaj ka hisaab batao").action).toBe("get_daily_summary");
  });
  it("flags missing quantity", () => {
    expect(parseCommand("doodh becha").missing).toContain("quantity");
  });
});
