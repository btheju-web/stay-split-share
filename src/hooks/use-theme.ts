import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";
export type ThemeStyle = "glass" | "minimal";

const MODE_KEY = "splitstay.theme.mode";
const STYLE_KEY = "splitstay.theme.style";

export const DEFAULT_MODE: ThemeMode = "dark";
export const DEFAULT_STYLE: ThemeStyle = "glass";

function apply(mode: ThemeMode, style: ThemeStyle) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("theme-minimal", style === "minimal");
  root.classList.toggle("theme-glass", style === "glass");
  root.style.colorScheme = mode;
}

/** Dark/light mode + glass/minimal surface style, persisted locally. */
export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
  const [style, setStyleState] = useState<ThemeStyle>(DEFAULT_STYLE);

  useEffect(() => {
    const storedMode = (localStorage.getItem(MODE_KEY) as ThemeMode | null) ?? DEFAULT_MODE;
    const storedStyle = (localStorage.getItem(STYLE_KEY) as ThemeStyle | null) ?? DEFAULT_STYLE;
    setModeState(storedMode);
    setStyleState(storedStyle);
    apply(storedMode, storedStyle);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    localStorage.setItem(MODE_KEY, next);
    apply(next, (localStorage.getItem(STYLE_KEY) as ThemeStyle | null) ?? DEFAULT_STYLE);
  }, []);

  const setStyle = useCallback((next: ThemeStyle) => {
    setStyleState(next);
    localStorage.setItem(STYLE_KEY, next);
    apply((localStorage.getItem(MODE_KEY) as ThemeMode | null) ?? DEFAULT_MODE, next);
  }, []);

  const toggleMode = useCallback(
    () => setMode(mode === "dark" ? "light" : "dark"),
    [mode, setMode],
  );
  const toggleStyle = useCallback(
    () => setStyle(style === "glass" ? "minimal" : "glass"),
    [style, setStyle],
  );

  return { mode, style, setMode, setStyle, toggleMode, toggleStyle };
}
