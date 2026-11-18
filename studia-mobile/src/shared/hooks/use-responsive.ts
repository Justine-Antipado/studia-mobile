import { useWindowDimensions } from "react-native";

export const MAX_CONTENT_WIDTH = 720;

/** Breakpoints: compact < 360dp (small Androids), tablet >= 600dp. */
export function useResponsive() {
  const { width, fontScale } = useWindowDimensions();
  const isCompact = width < 360;
  const isTablet = width >= 600;
  return {
    width,
    fontScale,
    isCompact,
    isTablet,
    actionIconSize: isCompact ? 52 : isTablet ? 72 : 60,
  };
}
