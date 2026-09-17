import { useMemo, useState } from "react";
import { Target, Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge as UIBadge } from "@/components/ui/badge";
import { computeScores } from "@/lib/gamification";
import { formatINR, parseMoney } from "@/lib/splitstay";
import { MoneyInput } from "@/components/ui/money-input";
import type { UseSplitStay } from "@/hooks/use-splitstay";

export function BudgetDialog({ store }: { store: UseSplitStay }) {
  const group = store.activeGroup!;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const openDialog = (o: boolean) => {
    if (o) {
      const d: Record<string, string> = {};
      group.members.forEach((m) => {
        const b = group.budgets?.[m.id];
        d[m.id] = b ? String(b) : "";
      });
      setDraft(d);
    }
    setOpen(o);
  };

  const save = () => {
    group.members.forEach((m) => {
      const v = parseMoney(draft[m.id] ?? "");
      store.setBudget(group.id, m.id, Number.isFinite(v) && v > 0 ? v : null);
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Monthly budgets">
          <Target className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Monthly budgets</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Set how much each person aims to spend per month. Staying inside the budget earns
          points and badges.
        </p>
        <div className="space-y-3">
          {group.members.map((m) => (
            <div key={m.id} className="space-y-1.5">
              <Label htmlFor={`b-${m.id}`}>{m.name}</Label>
              <MoneyInput
                id={`b-${m.id}`}
                placeholder="No budget"
                value={draft[m.id] ?? ""}
                onValueChange={(v) => setDraft((d) => ({ ...d, [m.id]: v }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save budgets</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Achievements({
  store,
  balances,
}: {
  store: UseSplitStay;
  balances: Record<string, number>;
}) {
  const group = store.activeGroup!;
  const scores = useMemo(() => computeScores(group, balances), [group, balances]);
  const ranked = useMemo(() => [...scores].sort((a, b) => b.points - a.points), [scores]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Leaderboard &amp; badges
        </h2>
        <Trophy className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ranked.map((s, i) => {
          const member = group.members.find((m) => m.id === s.memberId);
          if (!member) return null;
          const earned = s.badges.filter((b) => b.earned);
          const pct =
            s.budget && s.budget > 0 ? Math.min(100, (s.monthSpend / s.budget) * 100) : null;
          return (
            <div key={s.memberId} className="rounded-2xl glass p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-medium">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : member.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Lv{s.level} · {s.levelLabel} · {s.onTimePayments} on time
                    {s.latePayments > 0 ? ` · ${s.latePayments} late` : ""}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{s.points} pts</span>
              </div>

              {pct !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>This month</span>
                    <span
                      className={
                        s.withinBudget ? "text-[color:var(--success)]" : "text-destructive"
                      }
                    >
                      {formatINR(s.monthSpend)} / {formatINR(s.budget!)}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {earned.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No badges yet — settle up on time to earn some.
                  </p>
                ) : (
                  earned.map((b) => (
                    <UIBadge key={b.id} variant="secondary" title={b.description}>
                      <span className="mr-1">{b.icon}</span>
                      {b.label}
                    </UIBadge>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
