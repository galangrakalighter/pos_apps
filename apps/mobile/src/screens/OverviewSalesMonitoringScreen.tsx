import { AdminSalesMonitoringScreen } from './AdminSalesMonitoringScreen';
import { Session } from '../types';

export function OverviewSalesMonitoringScreen({ isTablet, session }: { isTablet: boolean; session: Session }) {
  return <AdminSalesMonitoringScreen isTablet={isTablet} session={session} />;
}
