// Rule-based Hindi/Hinglish command parser -> structured action JSON.
export type ActionType =
  "add_stock" | "record_sale" | "add_credit" | "get_stock" | "get_daily_summary" | "unknown";
export interface Action {
  action: ActionType;
  product?: string | undefined;
  quantity?: number | undefined;
  unit?: string | undefined;
  price?: number | undefined;
  customer?: string | undefined;
  amount?: number | undefined;
  missing: string[];
}

const HINDI_NUM: Record<string, number> = {
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  panch: 5,
  chhe: 6,
  che: 6,
  saat: 7,
  aath: 8,
  nau: 9,
  das: 10,
  bees: 20,
  tees: 30,
  pachas: 50,
  pachaas: 50,
  sau: 100,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
  बीस: 20,
  पचास: 50,
  सौ: 100,
};
const DEV_DIGITS = "०१२३४५६७८९";

export const PRODUCT_ALIASES: Record<string, string[]> = {
  chawal: ["chawal", "chaawal", "rice", "चावल"],
  atta: ["atta", "aata", "flour", "आटा"],
  cheeni: ["cheeni", "chini", "sugar", "चीनी"],
  doodh: ["doodh", "dudh", "milk", "दूध"],
  tel: ["tel", "oil", "तेल"],
  dal: ["dal", "daal", "दाल"],
  namak: ["namak", "salt", "नमक"],
  biscuit: ["biscuit", "biscuits", "बिस्किट"],
  sabun: ["sabun", "soap", "साबुन"],
  chai: ["chai", "chai patti", "tea", "चाय"],
};
const UNITS: Record<string, string> = {
  kilo: "kg",
  kg: "kg",
  किलो: "kg",
  litre: "L",
  liter: "L",
  लीटर: "L",
  packet: "packet",
  पैकेट: "packet",
  piece: "pc",
  पीस: "pc",
};

function normalize(t: string) {
  let s = t
    .toLowerCase()
    .replace(/[₹,?!।]/g, " ")
    .replace(/\.(?!\d)/g, " ");
  s = s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));
  return s.replace(/\s+/g, " ").trim();
}
function tokNum(tok: string): number | undefined {
  if (/^\d+(\.\d+)?$/.test(tok)) return parseFloat(tok);
  return HINDI_NUM[tok];
}
function findProduct(words: string[]): string | undefined {
  const joined = " " + words.join(" ") + " ";
  for (const [k, al] of Object.entries(PRODUCT_ALIASES))
    if (al.some((a) => joined.includes(" " + a + " "))) return k;
  return undefined;
}

export function parseCommand(text: string): Action {
  const s = normalize(text);
  const w = s.split(" ");
  const has = (...k: string[]) => k.some((x) => w.includes(x) || s.includes(x));
  const product = findProduct(w);

  // quantity: number directly followed by unit, else first number before rupee words
  let quantity: number | undefined,
    unit: string | undefined,
    price: number | undefined,
    amount: number | undefined;
  for (let i = 0; i < w.length; i++) {
    const token = w[i];
    if (!token) continue;
    const n = tokNum(token);
    if (n === undefined) continue;
    const next = w[i + 1];
    if (next && UNITS[next] && quantity === undefined) {
      quantity = n;
      unit = UNITS[next];
      continue;
    }
    if (
      next &&
      ["rupaye", "rupay", "rupees", "rs", "rupee", "रुपये", "रुपए", "ka", "ke"].includes(next) &&
      ["rupaye", "rupay", "rupees", "rs", "rupee", "रुपये", "रुपए"].includes(next)
    ) {
      if (amount === undefined) amount = n;
      else price = n;
      continue;
    }
    if (quantity === undefined) quantity = n;
    else if (amount === undefined) amount = n;
  }

  const isCredit = has("udhaar", "udhar", "उधार", "credit", "khata", "खाता");
  const isSummary = has(
    "hisaab",
    "hisab",
    "हिसाब",
    "summary",
    "aaj ki bikri",
    "total bikri",
    "aaj ka",
  );
  const isStockQ = has("kitna", "kitni", "कितना", "कितनी", "bacha", "bachi", "बचा", "stock check");
  const isSale = has("becha", "bechi", "beche", "बेचा", "बेची", "sold", "sale", "bika", "biki");
  const isAdd = has(
    "aaya",
    "aayi",
    "aaye",
    "आया",
    "आई",
    "add",
    "jodo",
    "जोड़ो",
    "stock mein",
    "kharida",
    "मंगाया",
    "mangaya",
  );

  if (isCredit) {
    // customer = word(s) before "ko" / "का" / "ka"
    let customer: string | undefined;
    const koIdx = w.findIndex((x) => ["ko", "को", "ka", "का", "ke", "के"].includes(x));
    if (koIdx > 0) customer = w[koIdx - 1];
    const amt = amount ?? quantity;
    const customerName =
      customer && !tokNum(customer)
        ? customer.charAt(0).toUpperCase() + customer.slice(1)
        : undefined;
    const missing = [!customerName && "customer", !amt && "amount"].filter(Boolean) as string[];
    return { action: "add_credit", customer: customerName, amount: amt, missing };
  }
  if (isSummary && !product) return { action: "get_daily_summary", missing: [] };
  if (isStockQ) return { action: "get_stock", product, missing: [] };
  if (isSale) {
    const missing = [!product && "product", !quantity && "quantity"].filter(Boolean) as string[];
    return { action: "record_sale", product, quantity, unit, price: amount, missing };
  }
  if (isAdd) {
    const missing = [!product && "product", !quantity && "quantity"].filter(Boolean) as string[];
    return { action: "add_stock", product, quantity, unit, missing };
  }
  return { action: "unknown", missing: [] };
}
