import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Expense,
  type Group,
  type Member,
  type State,
  loadState,
  saveState,
  uid,
} from "@/lib/splitstay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
  return (data?.state as State | undefined) ?? null;
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

  // Load state whenever auth changes.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setHydrated(false);
    (async () => {
      if (user) {
        const cloud = await loadCloud(user.id);
        if (cancelled) return;
        if (cloud && (cloud.groups?.length ?? 0) > 0) {
          setState(cloud);
        } else {
          // First sign-in: promote any guest data to cloud.
          const local = loadState();
          if ((local.groups?.length ?? 0) > 0) {
            await saveCloud(user.id, local);
            setState(local);
          } else {
            setState(cloud ?? EMPTY);
          }
        }
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
      }, 400);
    }
  }, [state, hydrated, user]);

  const createGroup = useCallback((name: string, memberNames: string[]) => {
    const group: Group = {
      id: uid(),
      name: name.trim() || "New Group",
      members: memberNames
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => ({ id: uid(), name: n })),
      expenses: [],
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
    updateExpense,
    deleteExpense,
    memberName,
    user,
    signOut,
    isCloud: modeRef.current === "cloud",
  };
}

export type UseSplitStay = ReturnType<typeof useSplitStay>;
export type { Member, Expense, Group };
