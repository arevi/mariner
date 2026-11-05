import { SHIP_GROUP_COLORS, SHIP_GROUP_COLORS_LIGHT } from '@mariner/ais';
import { useTheme } from 'next-themes';

export function useIsLight() {
  return useTheme().resolvedTheme === 'light';
}

export function useShipColors() {
  return useIsLight() ? SHIP_GROUP_COLORS_LIGHT : SHIP_GROUP_COLORS;
}
