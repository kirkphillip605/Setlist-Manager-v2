import { createContext, useContext, useEffect, useState } from "react";
import { storageAdapter } from "@/lib/storageAdapter";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
  // Initialize with system preference momentarily to avoid flash, but rely on effect for storage
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. Load from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      const storedTheme = await storageAdapter.getItem(storageKey);
      if (storedTheme) {
        setThemeState(storedTheme as Theme);
      }
      setIsLoaded(true);
    };
    loadTheme();
  }, [storageKey]);

  // 2. Apply Theme Class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // 3. Listen for System Changes (if in system mode)
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      storageAdapter.setItem(storageKey, theme);
      setThemeState(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};