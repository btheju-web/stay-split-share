import type { Group, Member } from "@/lib/splitstay";

export type BadgeId =
  | "first-payment"
  | "quick-settler"
  | "always-on-time"
  | "budget-boss"
  | "budget-streak"
  | "team-player"
  | "all-square";

export type Badge = {
  id: BadgeId;
  label: string;
  description: string;
  icon: string;
  earned: boolean;
};

export type Score = {
  memberId: string;
  points: number;
  onTimePayments: number;
  latePayments: number;
  monthSpend: number;
  budget: number | null;
  withinBudget: boolean | null;
  badges: Badge[];
  level: number;
  levelLabel: string;
};

export const ON_TIME_DAYS = 7;
export const POINTS = {
  onTime: 25,
  late: 8,
  withinBudget: 30,
  settledUp: 15,
  paidExpense: 5,
};

export function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function levelFor(points: number): { level: number; label: string } {
  if (points >= 300) return { level: 5, label: "Legend" };
  if (points >= 200) return { level: 4, label: "Champion" };
  if (points >= 120) return { level: 3, label: "Reliable" };
  if (points >= 50) return { level: 2, label: "Rising" };
  return { level: 1, label: "Rookie" };
}

/**
 * A payment is "on time" when it was logged within ON_TIME_DAYS of the oldest
 * expense the payer still owed a share of at the time of payment.
 */
export function isPaymentOnTime(group: Group, payment: { from: string; date: string }) {
  const paidAt = new Date(payment.date).getTime();
  const priorPayments = group.payments.filter(
    (p) => p.from === payment.from && new Date(p.date).getTime() < paidAt,
  ).length;
  const owed = group.expenses
    .filter(
      (e) =>
        e.paidBy !== payment.from &&
        e.splitBetween.includes(payment.from) &&
        new Date(e.date).getTime() <= paidAt,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const target = owed[priorPayments] ?? owed[owed.length - 1];
  if (!target) return true;
  const days = (paidAt - new Date(target.date).getTime()) / 86_400_000;
  return days <= ON_TIME_DAYS;
}

export function computeScores(
  group: Group,
  balances: Record<string, number>,
  now = new Date(),
): Score[] {
  const thisMonth = now.toISOString().slice(0, 7);

  return group.members.map((m: Member) => {
    const payments = group.payments.filter((p) => p.from === m.id);
    let onTimePayments = 0;
    let latePayments = 0;
    for (const p of payments) {
      if (isPaymentOnTime(group, p)) onTimePayments += 1;
      else latePayments += 1;
    }

    // This month's share of all expenses they were split into.
    const monthSpend = group.expenses
      .filter((e) => monthKey(e.date) === thisMonth && e.splitBetween.includes(m.id))
      .reduce((s, e) => s + e.amount / e.splitBetween.length, 0);

    const budget = group.budgets?.[m.id] ?? null;
    const withinBudget = budget != null && budget > 0 ? monthSpend <= budget : null;

    const paidExpenses = group.expenses.filter((e) => e.paidBy === m.id).length;
    const settled = Math.abs(balances[m.id] ?? 0) < 0.01 && group.expenses.length > 0;

    let points =
      onTimePayments * POINTS.onTime +
      latePayments * POINTS.late +
      paidExpenses * POINTS.paidExpense +
      (withinBudget ? POINTS.withinBudget : 0) +
      (settled ? POINTS.settledUp : 0);
    points = Math.round(points);

    // Budget streak: within budget for the last 3 completed months too.
    const monthsWithin = budget
      ? [0, 1, 2, 3].filter((back) => {
          const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
          const key = d.toISOString().slice(0, 7);
          const spend = group.expenses
            .filter((e) => monthKey(e.date) === key && e.splitBetween.includes(m.id))
            .reduce((s, e) => s + e.amount / e.splitBetween.length, 0);
          return spend > 0 && spend <= budget;
        }).length
      : 0;

    const badges: Badge[] = [
      {
        id: "first-payment",
        label: "First Settle",
        description: "Logged your first payment",
        icon: "🎉",
        earned: payments.length >= 1,
      },
      {
        id: "quick-settler",
        label: "Quick Settler",
        description: `3 payments made within ${ON_TIME_DAYS} days`,
        icon: "⚡",
        earned: onTimePayments >= 3,
      },
      {
        id: "always-on-time",
        label: "Always On Time",
        description: "Every payment made on time",
        icon: "⏱️",
        earned: payments.length >= 2 && latePayments === 0,
      },
      {
        id: "budget-boss",
        label: "Budget Boss",
        description: "Stayed within this month's budget",
        icon: "🎯",
        earned: withinBudget === true,
      },
      {
        id: "budget-streak",
        label: "Budget Streak",
        description: "Within budget 3 months running",
        icon: "🔥",
        earned: monthsWithin >= 3,
      },
      {
        id: "team-player",
        label: "Team Player",
        description: "Paid for 5 group expenses",
        icon: "🤝",
        earned: paidExpenses >= 5,
      },
      {
        id: "all-square",
        label: "All Square",
        description: "Currently settled up with everyone",
        icon: "✅",
        earned: settled,
      },
    ];

    if (badges.filter((b) => b.earned).length >= 5) points += 20;

    const { level, label } = levelFor(points);
    return {
      memberId: m.id,
      points,
      onTimePayments,
      latePayments,
      monthSpend: Math.round(monthSpend * 100) / 100,
      budget,
      withinBudget,
      badges,
      level,
      levelLabel: label,
    };
  });
}
