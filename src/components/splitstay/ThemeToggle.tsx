import { Moon, Sun, Sparkles, Square, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { mode, style, setMode, setStyle } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setMode("dark")}>
          <Moon className="h-4 w-4" /> Dark
          {mode === "dark" && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("light")}>
          <Sun className="h-4 w-4" /> Light
          {mode === "light" && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Surface style</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setStyle("glass")}>
          <Sparkles className="h-4 w-4" /> Liquid glass
          {style === "glass" && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setStyle("minimal")}>
          <Square className="h-4 w-4" /> Minimalist
          {style === "minimal" && <Check className="h-4 w-4 ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
