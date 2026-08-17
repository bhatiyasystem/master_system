import { useNavigate } from 'react-router-dom';
import PurchaseHeader from '../components/PurchaseHeader';
import PoListView from '../components/PoListView';

export default function PoListPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="All purchase orders raised" />
      <PoListView onRevise={(po) => navigate('/dashboard/purchase/pocreate', { state: { poId: po.id } })} />
    </div>
  );
}
