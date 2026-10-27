import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { darkPalette, lightPalette, type Palette } from "./tokens";

// The palette for the phone's current light/dark setting. It follows the system and updates
// live when the person flips it, with no restart.
export function useTheme(): { scheme: "light" | "dark"; colors: Palette } {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return { scheme, colors: scheme === "dark" ? darkPalette : lightPalette };
}

// Styles that depend on the theme. Write the stylesheet as a function of the palette at module
// level, then call this in the component; the styles are rebuilt only when the theme changes.
//   const createStyles = (c: Palette) => StyleSheet.create({ box: { backgroundColor: c.surface } });
//   const styles = useThemedStyles(createStyles);
export function useThemedStyles<T>(create: (colors: Palette) => T): T {
  const { colors } = useTheme();
  // `create` is a module-level function, so it never changes between renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => create(colors), [colors]);
}
