import { describe, expect, it } from "vitest";
import { sampleState, execute, needsConfirm } from "./store";
import { pricedAction, validateAction } from "./shop";
import { parseCommand } from "./parser";

describe("shop business rules", () => {
  it("requires confirmation for stock, sale and credit writes", () => {
    for (const text of [
      "10 kilo chawal aaya",
      "2 kilo cheeni becha",
      "Ramesh ko 200 rupaye udhaar",
    ])
      expect(needsConfirm(parseCommand(text))).toBe(true);
    expect(needsConfirm(parseCommand("atta kitna bacha hai"))).toBe(false);
  });
  it("uses configured unit prices instead of a spoken amount", () => {
    const state = sampleState();
    const action = parseCommand("2 kilo cheeni becha 999 rupaye");
    expect(pricedAction(state, action).price).toBe(90);
    expect(execute(state, action).state.sales.at(-1)?.total).toBe(90);
  });
  it("prevents sales that would make stock negative", () => {
    const state = sampleState();
    const action = parseCommand("26 kilo cheeni becha");
    expect(validateAction(state, action)).not.toBeNull();
    expect(execute(state, action).state).toBe(state);
    expect(state.products.find((p) => p.key === "cheeni")?.qty).toBe(25);
  });
  it("rejects mismatched product units", () => {
    expect(validateAction(sampleState(), parseCommand("2 litre cheeni becha"))).not.toBeNull();
  });
  it("preserves decimal quantities", () => {
    expect(parseCommand("1.5 kilo cheeni becha").quantity).toBe(1.5);
    expect(
      execute(sampleState(), parseCommand("1.5 kilo cheeni becha")).state.sales.at(-1)?.total,
    ).toBe(67.5);
  });
  it("rejects zero, negative and nonfinite quantities", () => {
    for (const quantity of [0, -2, NaN, Infinity])
      expect(
        validateAction(sampleState(), {
          action: "record_sale",
          product: "cheeni",
          quantity,
          missing: [],
        }),
      ).not.toBeNull();
  });
});
