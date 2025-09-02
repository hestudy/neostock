import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, ...rest } = useNextTheme();
  return {
    theme: theme || 'light',
    setTheme,
    ...rest
  };
}