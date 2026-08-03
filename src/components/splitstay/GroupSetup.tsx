import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Plus, Users } from "lucide-react";
import type { UseSplitStay } from "@/hooks/use-splitstay";
import { AuthChip } from "./AuthChip";
import { ThemeToggle } from "./ThemeToggle";


export function GroupSetup({ store }: { store: UseSplitStay }) {
  const [groupName, setGroupName] = useState("");
  const [memberInput, setMemberInput] = useState("");
  const [members, setMembers] = useState<string[]>([]);

  const addMember = () => {
    const n = memberInput.trim();
    if (!n) return;
    if (members.some((m) => m.toLowerCase() === n.toLowerCase())) {
      setMemberInput("");
      return;
    }
    setMembers([...members, n]);
    setMemberInput("");
  };

  const remove = (i: number) => setMembers(members.filter((_, idx) => idx !== i));

  const create = () => {
    if (!groupName.trim() || members.length < 2) return;
    store.createGroup(groupName, members);
    setGroupName("");
    setMembers([]);
  };

  const canCreate = groupName.trim().length > 0 && members.length >= 2;

  return (
    <div className="min-h-screen flex flex-col px-4 py-6">
      <div className="w-full max-w-lg mx-auto flex justify-end items-center gap-1">
        <ThemeToggle />
        <AuthChip store={store} />
      </div>

      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center py-4">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
               style={{ backgroundImage: "var(--gradient-brand)" }}>
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome to SplitStay</h1>
          <p className="text-muted-foreground mt-2">Create a group to start splitting expenses with your roommates.</p>
        </div>

        <div className="rounded-2xl glass p-6 rounded-2xl">
          <div className="space-y-2">
            <Label htmlFor="gname">Group name</Label>
            <Input
              id="gname"
              placeholder="e.g. Room 204"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div className="space-y-2 mt-5">
            <Label>Members</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a name"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addMember();
                  }
                }}
              />
              <Button type="button" onClick={addMember} variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {members.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {members.map((m, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                  >
                    {m}
                    <button
                      onClick={() => remove(i)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${m}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">Add at least 2 members.</p>
          </div>

          <Button
            className="w-full mt-6 h-11 text-base"
            disabled={!canCreate}
            onClick={create}
          >
            Create group
          </Button>
        </div>

        {store.state.groups.length > 0 && (
          <div className="mt-6 rounded-2xl glass p-4 rounded-2xl">
            <p className="text-sm font-medium mb-2">Your groups</p>
            <div className="space-y-1">
              {store.state.groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => store.setActiveGroup(g.id)}
                  className="w-full text-left rounded-lg px-3 py-2 hover:bg-secondary transition"
                >
                  <div className="text-sm font-medium">{g.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.members.length} members · {g.expenses.length} expenses
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
