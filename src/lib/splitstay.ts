export type Member = { id: string; name: string; phone?: string; upi?: string };

export function isValidUpiId(v: string) {
  return /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(v.trim());
}

export function isValidPhone(v: string) {
  return /^\+?[0-9][0-9\s-]{7,15}$/.test(v.trim());
}

export function normalizePhone(v: string) {
  const digits = v.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.replace(/^0+/, "");
}

/** UPI deep link (BHIM/GPay/PhonePe/Paytm all handle upi://pay). */
export function buildUpiLink(opts: {
  upi: string;
  name: string;
  amount: number;
  note?: string;
  app?: "upi" | "gpay" | "phonepe" | "paytm";
}) {
  const params = new URLSearchParams({
    pa: opts.upi.trim(),
    pn: opts.name,
    am: opts.amount.toFixed(2),
    cu: "INR",
  });
  if (opts.note) params.set("tn", opts.note.slice(0, 50));
  const query = params.toString();
  switch (opts.app) {
    case "gpay":
      return `tez://upi/pay?${query}`;
    case "phonepe":
      return `phonepe://pay?${query}`;
    case "paytm":
      return `paytmmp://pay?${query}`;
    default:
      return `upi://pay?${query}`;
  }
}
export type Expense = {
  id: string;
  description: string;
  amount: number;
  paidBy: string; // member id
  splitBetween: string[]; // member ids
  date: string; // ISO
};
/** A recorded settle-up transfer between two members. */
export type Payment = {
  id: string;
  from: string; // member id (payer)
  to: string; // member id (receiver)
  amount: number;
  date: string; // ISO
  note?: string;
};

export type Group = {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
  /** Recorded settle-up payments. */
  payments: Payment[];
  /** Monthly spend budget per member id (₹). */
  budgets: Record<string, number>;
  createdAt: string;
};

export type State = {
  groups: Group[];
  activeGroupId: string | null;
};

const STORAGE_KEY = "splitstay:v1";

/** Fills in fields added after a user's data was first saved. */
export function normalizeState(state: State | null | undefined): State {
  if (!state || !Array.isArray(state.groups)) return { groups: [], activeGroupId: null };
  return {
    activeGroupId: state.activeGroupId ?? null,
    groups: state.groups.map((g) => ({
      ...g,
      members: g.members ?? [],
      expenses: g.expenses ?? [],
      payments: g.payments ?? [],
      budgets: g.budgets ?? {},
    })),
  };
}

export function loadState(): State {
  if (typeof window === "undefined") return { groups: [], activeGroupId: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { groups: [], activeGroupId: null };
    return normalizeState(JSON.parse(raw) as State);
  } catch {
    return { groups: [], activeGroupId: null };
  }
}

export function saveState(state: State) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function formatINR(n: number) {
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  return `${sign}₹${v.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function computeBalances(group: Group): Record<string, number> {
  const bal: Record<string, number> = {};
  group.members.forEach((m) => (bal[m.id] = 0));
  for (const exp of group.expenses) {
    const splitters = exp.splitBetween.filter((id) => bal[id] !== undefined);
    if (splitters.length === 0) continue;
    const share = exp.amount / splitters.length;
    if (bal[exp.paidBy] !== undefined) bal[exp.paidBy] += exp.amount;
    for (const s of splitters) bal[s] -= share;
  }
  // round to 2 decimals
  Object.keys(bal).forEach((k) => (bal[k] = Math.round(bal[k] * 100) / 100));
  return bal;
}

export type Settlement = { from: string; to: string; amount: number };

export function simplifySettlements(balances: Record<string, number>): Settlement[] {
  const debtors: { id: string; amt: number }[] = [];
  const creditors: { id: string; amt: number }[] = [];
  for (const [id, amt] of Object.entries(balances)) {
    if (amt < -0.01) debtors.push({ id, amt: -amt });
    else if (amt > 0.01) creditors.push({ id, amt });
  }
  debtors.sort((a, b) => b.amt - a.amt);
  creditors.sort((a, b) => b.amt - a.amt);

  const result: Settlement[] = [];
  let i = 0,
    j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    result.push({
      from: debtors[i].id,
      to: creditors[j].id,
      amount: Math.round(pay * 100) / 100,
    });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt < 0.01) i++;
    if (creditors[j].amt < 0.01) j++;
  }
  return result;
}
