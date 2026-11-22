import { useState } from "react";
import { Button } from "@poc/design-system";

/** Shell-only light/dark switch: toggles `dark` on <html>; remotes follow through CSS variables. In memory only. */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  return (
    <Button
      variant="outline"
      size="sm"
      data-testid="theme-toggle"
      aria-pressed={dark}
      onClick={() => {
        document.documentElement.classList.toggle("dark", !dark);
        setDark(!dark);
      }}
    >
      Dark mode
    </Button>
  );
}
