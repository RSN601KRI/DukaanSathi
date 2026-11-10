import { z } from "zod";
import type { Action } from "./parser";
import { needsConfirm, type State } from "./store";

export const snapshotSchema = z.object({
  products: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      qty: z.coerce.number(),
      unit: z.string(),
      price: z.coerce.number(),
      low: z.coerce.number(),
    }),
  ),
  sales: z.array(
    z.object({
      id: z.string(),
      product: z.string(),
      qty: z.coerce.number(),
      total: z.coerce.number(),
      at: z.string(),
    }),
  ),
  credits: z.array(
    z.object({ id: z.string(), customer: z.string(), amount: z.coerce.number(), at: z.string() }),
  ),
  log: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      transcript: z.string(),
      source: z.string(),
      action: z.string(),
      status: z.string(),
      result: z.string(),
    }),
  ),
});

export function validateAction(state: State, action: Action): string | null {
  if (!needsConfirm(action)) return null;
  if (action.action === "add_credit")
    return action.customer?.trim() &&
      Number.isFinite(action.amount) &&
      (action.amount ?? 0) > 0 &&
      (action.amount ?? 0) < 100000000
      ? null
      : "Customer aur positive amount chahiye.";
  const product = state.products.find((p) => p.key === action.product);
  if (!product) return "Product list mein nahi hai.";
  if (
    !Number.isFinite(action.quantity) ||
    (action.quantity ?? 0) <= 0 ||
    (action.quantity ?? 0) >= 1000000
  )
    return "Quantity positive honi chahiye.";
  if (action.unit && action.unit !== product.unit)
    return `Is product ki unit ${product.unit} hai. Dobara likhiye.`;
  if (action.action === "record_sale" && product.qty < (action.quantity ?? 0))
    return `Sirf ${product.qty} ${product.unit} bacha hai — bikri nahi likhi.`;
  return null;
}

export function pricedAction(state: State, action: Action): Action {
  if (action.action !== "record_sale") return action;
  const product = state.products.find((p) => p.key === action.product);
  return product
    ? {
        ...action,
        unit: product.unit,
        price: Math.round((action.quantity ?? 0) * product.price * 100) / 100,
      }
    : action;
}
