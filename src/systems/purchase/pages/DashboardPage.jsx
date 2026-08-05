import { useNavigate } from 'react-router-dom';
import PurchaseHeader from '../components/PurchaseHeader';
import DashboardView from '../components/DashboardView';

export default function DashboardPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Purchase overview at a glance" />
      <DashboardView onTabChange={(tab) => navigate(`/dashboard/purchase/${tab}`)} />
    </div>
  );
}
