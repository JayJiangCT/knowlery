import type { DashboardScreen } from '../types';

export function DashboardHome(props: { navigate: (screen: DashboardScreen, payload?: unknown) => void }) {
  return <div className="knowlery-home">Home (sections added in Phase 3)</div>;
}
