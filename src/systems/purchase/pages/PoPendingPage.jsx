import React from 'react';
import { useNavigate } from 'react-router-dom';
import PurchaseHeader from '../components/PurchaseHeader';
import PoPendingView from '../components/PoPendingView';

export default function PoPendingPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Approved items waiting to be put on a PO" />
      <PoPendingView
        onCreatePO={(items, vendorName) =>
          navigate('/dashboard/purchase/pocreate', { state: { items, vendorName } })
        }
      />
    </div>
  );
}
