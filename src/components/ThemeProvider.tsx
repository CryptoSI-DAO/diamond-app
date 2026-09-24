"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const KEY = "dhp-app-theme";

type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void };
const Ctx = createContext<ThemeCtx>({ theme: "dark", setTheme: () => {} });

/** App-wide theme state: drives [data-theme] on <html> (CSS tokens)
 *  and ConnectKit's `theme` prop (wallet modal). Persisted to localStorage. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // hydrate from the DOM attribute (set pre-paint by the boot script in layout)
  useEffect(() => {
    const cur = document.documentElement.getAttribute("data-theme");
    if (cur === "light" || cur === "dark") setThemeState(cur);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  };

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
