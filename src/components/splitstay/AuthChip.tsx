import { Link } from "@tanstack/react-router";
import { LogOut, Cloud, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UseSplitStay } from "@/hooks/use-splitstay";

export function AuthChip({ store }: { store: UseSplitStay }) {
  if (!store.user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/auth">
          <CloudOff className="h-4 w-4" /> Sign in
        </Link>
      </Button>
    );
  }
  const email = store.user.email ?? "Account";
  const initial = email.charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <span className="h-7 w-7 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold">
            {initial}
          </span>
          <Cloud className="h-4 w-4 text-[color:var(--success,theme(colors.emerald.500))]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground -mt-1">
          Synced to your account
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void store.signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
