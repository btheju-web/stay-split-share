import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ArrowRight, Users, ChevronDown, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExpenseDialog } from "./ExpenseDialog";
import { AuthChip } from "./AuthChip";
import { InviteDialog } from "./InviteDialog";
import type { UseSplitStay } from "@/hooks/use-splitstay";
import type { Expense } from "@/lib/splitstay";
import { computeBalances, formatINR, simplifySettlements } from "@/lib/splitstay";

export function Dashboard({ store }: { store: UseSplitStay }) {
  const group = store.activeGroup!;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  const balances = useMemo(() => computeBalances(group), [group]);
  const settlements = useMemo(() => simplifySettlements(balances), [balances]);
  const totalSpent = useMemo(
    () => group.expenses.reduce((s, e) => s + e.amount, 0),
    [group.expenses],
  );

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (e: Expense) => {
    setEditing(e);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 glass-strong rounded-none border-x-0 border-t-0">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          >
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">SplitStay</p>
            <h1 className="text-lg font-semibold truncate">{group.name}</h1>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Groups <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Switch group</DropdownMenuLabel>
              {store.state.groups.map((g) => (
                <DropdownMenuItem
                  key={g.id}
                  onClick={() => store.setActiveGroup(g.id)}
                  className={g.id === group.id ? "bg-secondary" : ""}
                >
                  {g.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => store.setActiveGroup(null)}>
                <Plus className="h-4 w-4" /> New group
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => store.deleteGroup(group.id)}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Delete this group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <InviteDialog store={store} />
          <AuthChip store={store} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Summary */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl glass p-4 rounded-2xl">
            <p className="text-xs text-muted-foreground">Total spent</p>
            <p className="text-2xl font-semibold mt-1">{formatINR(totalSpent)}</p>
          </div>
          <div className="rounded-2xl glass p-4 rounded-2xl">
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="text-2xl font-semibold mt-1">{group.members.length}</p>
          </div>
        </section>

        {/* Balances */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Balances
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.members.map((m) => {
              const bal = balances[m.id] ?? 0;
              const zero = Math.abs(bal) < 0.01;
              const positive = bal > 0.01;
              return (
                <div
                  key={m.id}
                  className="rounded-2xl border bg-card p-4 flex items-center justify-between shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-sm font-medium shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="font-medium truncate">{m.name}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        zero
                          ? "text-muted-foreground"
                          : positive
                            ? "text-[color:var(--success)]"
                            : "text-destructive"
                      }`}
                    >
                      {zero ? "settled" : formatINR(Math.abs(bal))}
                    </p>
                    {!zero && (
                      <p className="text-xs text-muted-foreground">
                        {positive ? "is owed" : "owes"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Settlements */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Settle up
          </h2>
          <div className="rounded-2xl glass rounded-2xl">
            {settlements.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Everyone is settled up 🎉
              </div>
            ) : (
              <ul className="divide-y">
                {settlements.map((s, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="font-medium">{store.memberName(s.from)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{store.memberName(s.to)}</span>
                    <span className="ml-auto font-semibold">{formatINR(s.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Expense history
          </h2>
          <div className="rounded-2xl glass rounded-2xl overflow-hidden">
            {group.expenses.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No expenses yet.</p>
                <Button onClick={openAdd} className="mt-4">
                  <Plus className="h-4 w-4" /> Add your first expense
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Paid by</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {e.description}
                        <div className="text-xs text-muted-foreground font-normal">
                          split {e.splitBetween.length} ways
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{store.memberName(e.paidBy)}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {formatINR(e.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(e)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(e)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </main>

      {/* Floating add button */}
      <button
        onClick={openAdd}
        className="fixed bottom-6 right-6 h-14 px-5 rounded-full text-primary-foreground font-medium inline-flex items-center gap-2 hover:opacity-95 active:scale-95 transition"
        style={{
          backgroundImage: "var(--gradient-brand)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        <Plus className="h-5 w-5" />
        Add expense
      </button>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        group={group}
        editing={editing}
        onSubmit={(data) => {
          if (editing) {
            store.updateExpense(group.id, editing.id, data);
          } else {
            store.addExpense(group.id, data);
          }
        }}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{confirmDelete?.description}" and update
              everyone's balances.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) store.deleteExpense(group.id, confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
