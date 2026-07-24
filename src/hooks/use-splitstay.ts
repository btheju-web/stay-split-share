import { useCallback, useEffect, useState } from "react";
import {
  type Expense,
  type Group,
  type Member,
  type State,
  loadState,
  saveState,
  uid,
} from "@/lib/splitstay";

export function useSplitStay() {
  const [state, setState] = useState<State>({ groups: [], activeGroupId: null });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

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
    setState((s) => ({
      groups: [...s.groups, group],
      activeGroupId: group.id,
    }));
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
        g.id === groupId
          ? {
              ...g,
              members: g.members.filter((m) => m.id !== memberId),
            }
          : g,
      ),
    }));
  }, []);

  const addExpense = useCallback(
    (
      groupId: string,
      data: Omit<Expense, "id" | "date"> & { date?: string },
    ) => {
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
                expenses: g.expenses.map((e) =>
                  e.id === expenseId ? { ...e, ...data } : e,
                ),
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
        g.id === groupId
          ? { ...g, expenses: g.expenses.filter((e) => e.id !== expenseId) }
          : g,
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

  return {
    hydrated,
    state,
    activeGroup,
    createGroup,
    setActiveGroup,
    deleteGroup,
    addMember,
    removeMember,
    addExpense,
    updateExpense,
    deleteExpense,
    memberName,
  };
}

export type UseSplitStay = ReturnType<typeof useSplitStay>;
export type { Member, Expense, Group };
