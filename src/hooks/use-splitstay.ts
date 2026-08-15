import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Expense,
  type Group,
  type Member,
  type State,
  loadState,
  normalizeState,
  saveState,
  uid,
} from "@/lib/splitstay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchSharedGroups,
  mergeShared,
  publishGroup,
  saveSharedGroup,
} from "@/lib/shared-groups";

const EMPTY: State = { groups: [], activeGroupId: null };

async function loadCloud(userId: string): Promise<State | null> {
  const { data, error } = await supabase
    .from("user_data")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[splitstay] cloud load failed", error);
    return null;
  }
  const st = data?.state as State | undefined;
  return st ? normalizeState(st) : null;
}

async function saveCloud(userId: string, state: State) {
  const { error } = await supabase
    .from("user_data")
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
  if (error) console.error("[splitstay] cloud save failed", error);
}

export function useSplitStay() {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<State>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const modeRef = useRef<"guest" | "cloud" | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sharedSigs = useRef<Map<string, string>>(new Map());

  // Load state whenever auth changes.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setHydrated(false);
    (async () => {
      if (user) {
        const cloud = await loadCloud(user.id);
        if (cancelled) return;
        let next: State;
        if (cloud && (cloud.groups?.length ?? 0) > 0) {
          next = cloud;
        } else {
          // First sign-in: promote any guest data to cloud.
          const local = loadState();
          if ((local.groups?.length ?? 0) > 0) {
            await saveCloud(user.id, local);
            next = local;
          } else {
            next = cloud ?? EMPTY;
          }
        }
        // Pull in groups shared with this account.
        const rows = await fetchSharedGroups();
        if (cancelled) return;
        const groups = mergeShared(next.groups, rows);
        const activeGroupId = groups.some((g) => g.id === next.activeGroupId)
          ? next.activeGroupId
          : (groups[0]?.id ?? null);
        setState({ groups, activeGroupId });
        modeRef.current = "cloud";
      } else {
        setState(loadState());
        modeRef.current = "guest";
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Persist state to the active backend.
  useEffect(() => {
    if (!hydrated || !modeRef.current) return;
    if (modeRef.current === "guest") {
      saveState(state);
      return;
    }
    if (modeRef.current === "cloud" && user) {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveCloud(user.id, state);
        for (const g of state.groups) {
          if (!g.sharedId) continue;
          const sig = JSON.stringify([g.name, g.members, g.expenses, g.payments, g.budgets]);
          if (sharedSigs.current.get(g.sharedId) === sig) continue;
          sharedSigs.current.set(g.sharedId, sig);
          void saveSharedGroup(g);
        }
      }, 400);
    }
  }, [state, hydrated, user]);

  // Pick up other members' changes to shared groups.
  useEffect(() => {
    if (!user || !hydrated) return;
    const pull = async () => {
      const rows = await fetchSharedGroups();
      if (!rows.length) return;
      setState((s) => {
        const groups = mergeShared(s.groups, rows);
        for (const g of groups) {
          if (g.sharedId) {
            sharedSigs.current.set(
              g.sharedId,
              JSON.stringify([g.name, g.members, g.expenses, g.payments, g.budgets]),
            );
          }
        }
        const activeGroupId = groups.some((g) => g.id === s.activeGroupId)
          ? s.activeGroupId
          : (groups[0]?.id ?? null);
        return { groups, activeGroupId };
      });
    };
    const interval = setInterval(() => void pull(), 10000);
    return () => clearInterval(interval);
  }, [user, hydrated]);

  /** Moves a local group into the shared database so other accounts can join it. */
  const shareGroup = useCallback(
    async (groupId: string) => {
      if (!user) return null;
      const group = state.groups.find((g) => g.id === groupId);
      if (!group) return null;
      if (group.sharedId) return group.sharedId;
      const displayName = user.email?.split("@")[0] ?? "Owner";
      const sharedId = await publishGroup(user.id, group, displayName);
      if (!sharedId) return null;
      setState((s) => ({
        groups: s.groups.map((g) =>
          g.id === groupId ? { ...g, id: sharedId, sharedId, ownerId: user.id } : g,
        ),
        activeGroupId: s.activeGroupId === groupId ? sharedId : s.activeGroupId,
      }));
      return sharedId;
    },
    [user, state.groups],
  );

  const createGroup = useCallback((name: string, memberNames: string[]) => {
    const group: Group = {
      id: uid(),
      name: name.trim() || "New Group",
      members: memberNames
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => ({ id: uid(), name: n })),
      expenses: [],
      payments: [],
      budgets: {},
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ groups: [...s.groups, group], activeGroupId: group.id }));
    return group.id;
  }, []);

  const setActiveGroup = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeGroupId: id }));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setState((s) => {
      const groups = s.groups.filter((g) => g.id !== id);
      return {
        groups,
        activeGroupId: s.activeGroupId === id ? (groups[0]?.id ?? null) : s.activeGroupId,
      };
    });
  }, []);

  const addMember = useCallback((groupId: string, name: string) => {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === groupId
          ? { ...g, members: [...g.members, { id: uid(), name: name.trim() }] }
          : g,
      ),
    }));
  }, []);

  const removeMember = useCallback((groupId: string, memberId: string) => {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, members: g.members.filter((m) => m.id !== memberId) } : g,
      ),
    }));
  }, []);

  const updateMember = useCallback(
    (groupId: string, memberId: string, data: Partial<Omit<Member, "id">>) => {
      setState((s) => ({
        ...s,
        groups: s.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                members: g.members.map((m) => (m.id === memberId ? { ...m, ...data } : m)),
              }
            : g,
        ),
      }));
    },
    [],
  );


  const addExpense = useCallback(
    (groupId: string, data: Omit<Expense, "id" | "date"> & { date?: string }) => {
      setState((s) => ({
        ...s,
        groups: s.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                expenses: [
                  {
                    id: uid(),
                    date: data.date ?? new Date().toISOString(),
                    description: data.description,
                    amount: data.amount,
                    paidBy: data.paidBy,
                    splitBetween: data.splitBetween,
                  },
                  ...g.expenses,
                ],
              }
            : g,
        ),
      }));
    },
    [],
  );

  const updateExpense = useCallback(
    (groupId: string, expenseId: string, data: Partial<Expense>) => {
      setState((s) => ({
        ...s,
        groups: s.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                expenses: g.expenses.map((e) => (e.id === expenseId ? { ...e, ...data } : e)),
              }
            : g,
        ),
      }));
    },
    [],
  );

  const deleteExpense = useCallback((groupId: string, expenseId: string) => {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) } : g,
      ),
    }));
  }, []);

  /** Add several expenses at once (used by the receipt scanner). */
  const addExpenses = useCallback(
    (groupId: string, items: (Omit<Expense, "id" | "date"> & { date?: string })[]) => {
      setState((s) => ({
        ...s,
        groups: s.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                expenses: [
                  ...items.map((data) => ({
                    id: uid(),
                    date: data.date ?? new Date().toISOString(),
                    description: data.description,
                    amount: data.amount,
                    paidBy: data.paidBy,
                    splitBetween: data.splitBetween,
                  })),
                  ...g.expenses,
                ],
              }
            : g,
        ),
      }));
    },
    [],
  );

  const addPayment = useCallback(
    (groupId: string, data: { from: string; to: string; amount: number; note?: string }) => {
      setState((s) => ({
        ...s,
        groups: s.groups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                payments: [
                  { id: uid(), date: new Date().toISOString(), ...data },
                  ...(g.payments ?? []),
                ],
              }
            : g,
        ),
      }));
    },
    [],
  );

  const deletePayment = useCallback((groupId: string, paymentId: string) => {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) =>
        g.id === groupId
          ? { ...g, payments: (g.payments ?? []).filter((p) => p.id !== paymentId) }
          : g,
      ),
    }));
  }, []);

  const setBudget = useCallback((groupId: string, memberId: string, amount: number | null) => {
    setState((s) => ({
      ...s,
      groups: s.groups.map((g) => {
        if (g.id !== groupId) return g;
        const budgets = { ...(g.budgets ?? {}) };
        if (amount == null || !(amount > 0)) delete budgets[memberId];
        else budgets[memberId] = amount;
        return { ...g, budgets };
      }),
    }));
  }, []);

  const activeGroup: Group | null =
    state.groups.find((g) => g.id === state.activeGroupId) ?? null;

  const memberName = useCallback(
    (id: string): string => {
      if (!activeGroup) return "Unknown";
      return activeGroup.members.find((m) => m.id === id)?.name ?? "Unknown";
    },
    [activeGroup],
  );

  const signOut = useCallback(async () => {
    // Preserve current cloud data locally so guest mode continues where we left off.
    saveState(state);
    await supabase.auth.signOut();
  }, [state]);

  return {
    hydrated: hydrated && !authLoading,
    state,
    activeGroup,
    createGroup,
    setActiveGroup,
    deleteGroup,
    addMember,
    removeMember,
    updateMember,
    addExpense,
    addExpenses,
    updateExpense,
    deleteExpense,
    addPayment,
    deletePayment,
    setBudget,
    memberName,
    user,
    signOut,
    isCloud: modeRef.current === "cloud",
  };
}

export type UseSplitStay = ReturnType<typeof useSplitStay>;
export type { Member, Expense, Group };
