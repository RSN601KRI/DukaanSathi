import type { Action } from "./parser";

export interface Product {
  key: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  low: number;
}
export interface Sale {
  id: string;
  product: string;
  qty: number;
  total: number;
  at: string;
}
export interface Credit {
  id: string;
  customer: string;
  amount: number;
  at: string;
}
export interface LogEntry {
  id: string;
  at: string;
  transcript: string;
  source: string;
  action: string;
  status: string;
  result: string;
}
export interface State {
  products: Product[];
  sales: Sale[];
  credits: Credit[];
  log: LogEntry[];
}

const KEY = "dukaansaathi-v1";
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

export function sampleState(): State {
  const t = new Date().toISOString();
  return {
    products: [
      { key: "chawal", name: "चावल Chawal", qty: 42, unit: "kg", price: 60, low: 10 },
      { key: "atta", name: "आटा Atta", qty: 8, unit: "kg", price: 45, low: 10 },
      { key: "cheeni", name: "चीनी Cheeni", qty: 25, unit: "kg", price: 45, low: 8 },
      { key: "doodh", name: "दूध Doodh", qty: 18, unit: "L", price: 56, low: 10 },
      { key: "tel", name: "तेल Tel", qty: 3, unit: "L", price: 160, low: 5 },
      { key: "dal", name: "दाल Dal", qty: 15, unit: "kg", price: 120, low: 5 },
      { key: "namak", name: "नमक Namak", qty: 30, unit: "packet", price: 25, low: 10 },
      { key: "biscuit", name: "बिस्किट Biscuit", qty: 60, unit: "packet", price: 10, low: 20 },
      { key: "sabun", name: "साबुन Sabun", qty: 12, unit: "pc", price: 35, low: 10 },
      { key: "chai", name: "चाय Chai", qty: 9, unit: "packet", price: 140, low: 5 },
    ],
    sales: [
      { id: uid(), product: "chawal", qty: 5, total: 300, at: t },
      { id: uid(), product: "doodh", qty: 4, total: 224, at: t },
      { id: uid(), product: "biscuit", qty: 6, total: 60, at: t },
    ],
    credits: [
      { id: uid(), customer: "Ramesh", amount: 450, at: t },
      { id: uid(), customer: "Sunita", amount: 1200, at: t },
      { id: uid(), customer: "Imran", amount: 300, at: t },
    ],
    log: [],
  };
}

export function load(): State {
  try {
    const r = localStorage.getItem(KEY);
    if (r) return JSON.parse(r);
  } catch {
    /* ignore */
  }
  return sampleState();
}
export function save(s: State) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export const needsConfirm = (a: Action) =>
  ["add_stock", "record_sale", "add_credit"].includes(a.action);

export function describe(a: Action): string {
  switch (a.action) {
    case "add_stock":
      return `Stock mein ${a.quantity} ${a.unit ?? ""} ${a.product} jodna hai?`;
    case "record_sale":
      return `${a.quantity} ${a.unit ?? ""} ${a.product} ki bikri${a.price ? ` ₹${a.price}` : ""} likhni hai?`;
    case "add_credit":
      return `${a.customer} ke khaate mein ₹${a.amount} udhaar likhna hai?`;
    default:
      return "";
  }
}

export function execute(s: State, a: Action): { state: State; result: string } {
  const st: State = structuredClone(s);
  const p = a.product ? st.products.find((x) => x.key === a.product) : undefined;
  switch (a.action) {
    case "add_stock": {
      if (!p) return { state: s, result: `Product "${a.product}" list mein nahi hai.` };
      if (!Number.isFinite(a.quantity) || !a.quantity || a.quantity <= 0)
        return { state: s, result: "Quantity positive honi chahiye." };
      p.qty += a.quantity;
      return {
        state: st,
        result: `${a.quantity} ${p.unit} ${p.name} jod diya. Ab stock: ${p.qty} ${p.unit}.`,
      };
    }
    case "record_sale": {
      if (!p) return { state: s, result: `Product "${a.product}" list mein nahi hai.` };
      if (!Number.isFinite(a.quantity) || !a.quantity || a.quantity <= 0)
        return { state: s, result: "Quantity positive honi chahiye." };
      if (p.qty < a.quantity)
        return {
          state: s,
          result: `Sirf ${p.qty} ${p.unit} ${p.name} bacha hai — bikri nahi likhi.`,
        };
      p.qty -= a.quantity;
      const total = Math.round(a.quantity * p.price * 100) / 100;
      st.sales.push({
        id: uid(),
        product: p.key,
        qty: a.quantity,
        total,
        at: new Date().toISOString(),
      });
      return {
        state: st,
        result: `${a.quantity} ${p.unit} ${p.name} ki bikri ₹${total} likh di. Bacha: ${p.qty} ${p.unit}.`,
      };
    }
    case "add_credit": {
      if (!a.customer?.trim() || !Number.isFinite(a.amount) || !a.amount || a.amount <= 0)
        return { state: s, result: "Customer aur positive amount chahiye." };
      const customer = a.customer.trim();
      st.credits.push({ id: uid(), customer, amount: a.amount, at: new Date().toISOString() });
      const due = st.credits
        .filter((c) => c.customer.toLowerCase() === customer.toLowerCase())
        .reduce((x, c) => x + c.amount, 0);
      return {
        state: st,
        result: `${a.customer} ka ₹${a.amount} udhaar likh diya. Kul baaki: ₹${due}.`,
      };
    }
    case "get_stock": {
      if (!a.product) {
        const low = s.products.filter((x) => x.qty <= x.low).map((x) => x.name);
        return {
          state: s,
          result: low.length ? `Kam stock: ${low.join(", ")}.` : "Sab stock theek hai.",
        };
      }
      if (!p) return { state: s, result: `Product "${a.product}" list mein nahi hai.` };
      return { state: s, result: `${p.name}: ${p.qty} ${p.unit} bacha hai.` };
    }
    case "get_daily_summary": {
      const { total, count } = todaySales(s);
      const credit = s.credits.reduce((x, c) => x + c.amount, 0);
      return {
        state: s,
        result: `Aaj ${count} bikri, kul ₹${total}. Kul udhaar baaki: ₹${credit}.`,
      };
    }
    default:
      return { state: s, result: "Samajh nahi aaya. Dobara boliye." };
  }
}

export function todaySales(s: State) {
  const t = s.sales.filter((x) => x.at.slice(0, 10) === today());
  return { total: t.reduce((a, b) => a + b.total, 0), count: t.length };
}
export function addLog(s: State, e: Omit<LogEntry, "id" | "at">): State {
  return { ...s, log: [{ ...e, id: uid(), at: new Date().toISOString() }, ...s.log].slice(0, 50) };
}
