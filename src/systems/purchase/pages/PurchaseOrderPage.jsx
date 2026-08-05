import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function PurchaseOrderPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Manage pending and approved purchase orders" />
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        <button
          className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${
            tab === 'pending' ? 'bg-[#173254] text-white' : 'text-gray-600'
          }`}
          onClick={() => setTab('pending')}
        >
          PO Pending
        </button>
        <button
          className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition ${
            tab === 'approved' ? 'bg-[#173254] text-white' : 'text-gray-600'
          }`}
          onClick={() => setTab('approved')}
        >
          History
        </button>
      </div>

      {tab === 'pending' ? (
        <PoPendingView
          onCreatePO={(items, vendorName) =>
            navigate('/dashboard/purchase/pocreate', { state: { items, vendorName } })
          }
        />
      ) : (
        <PoListView
          onRevise={(po) =>
            navigate('/dashboard/purchase/pocreate', { state: { poId: po.id } })
          }
        />
      )}
    </div>
  );
}
