import type { DashboardScreen } from '../types';

export function DashboardScreens(props: {
  screen: DashboardScreen;
  payload: unknown;
  navigate: (screen: DashboardScreen, payload?: unknown) => void;
}) {
  return null;
}
