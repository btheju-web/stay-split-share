import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Expense, Group } from "@/lib/splitstay";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group: Group;
  editing?: Expense | null;
  onSubmit: (data: {
    description: string;
    amount: number;
    paidBy: string;
    splitBetween: string[];
    date: string;
  }) => void;
};

export function ExpenseDialog({ open, onOpenChange, group, editing, onSubmit }: Props) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState<string>(group.members[0]?.id ?? "");
  const [splitBetween, setSplitBetween] = useState<string[]>(group.members.map((m) => m.id));
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setPaidBy(editing.paidBy);
      setSplitBetween(editing.splitBetween);
      setDate(editing.date.slice(0, 10));
    } else {
      setDescription("");
      setAmount("");
      setPaidBy(group.members[0]?.id ?? "");
      setSplitBetween(group.members.map((m) => m.id));
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, editing, group.members]);

  const amt = parseFloat(amount);
  const valid =
    description.trim().length > 0 &&
    !Number.isNaN(amt) &&
    amt > 0 &&
    paidBy &&
    splitBetween.length > 0;

  const perPerson = useMemo(
    () => (valid ? amt / splitBetween.length : 0),
    [valid, amt, splitBetween.length],
  );

  const toggleSplit = (id: string, checked: boolean) => {
    setSplitBetween((s) => (checked ? [...s, id] : s.filter((x) => x !== id)));
  };

  const submit = () => {
    if (!valid) return;
    onSubmit({
      description: description.trim(),
      amount: amt,
      paidBy,
      splitBetween,
      date: new Date(date).toISOString(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Input
              id="desc"
              placeholder="e.g. Groceries"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amt">Amount (₹)</Label>
              <Input
                id="amt"
                type="number"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Paid by</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {group.members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Split between</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() =>
                  setSplitBetween(
                    splitBetween.length === group.members.length
                      ? []
                      : group.members.map((m) => m.id),
                  )
                }
              >
                {splitBetween.length === group.members.length ? "Clear all" : "Select all"}
              </button>
            </div>
            <div className="rounded-lg border divide-y">
              {group.members.map((m) => {
                const checked = splitBetween.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleSplit(m.id, Boolean(v))}
                    />
                    <span className="text-sm flex-1">{m.name}</span>
                  </label>
                );
              })}
            </div>
            {valid && (
              <p className="text-xs text-muted-foreground">
                ₹{perPerson.toFixed(2)} per person · split {splitBetween.length} ways
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {editing ? "Save changes" : "Add expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
