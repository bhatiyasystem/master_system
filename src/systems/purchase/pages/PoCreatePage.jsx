import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
;
import { fetchPO } from '../services/purchaseService';

export default function PoCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state || {};

  const [draft, setDraft] = useState(navState.poId ? null : buildDirectDraft(navState));
  const [loading, setLoading] = useState(!!navState.poId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!navState.poId) return;
    let cancelled = false;
    setLoading(true);
    fetchPO(navState.poId)
      .then((po) => {
        if (!cancelled) setDraft({ items: [], vendorName: po.vendor.name, existingPO: po });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load purchase order.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
     
  }, [navState.poId]);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Fill vendor & item details, then submit" />
      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          <Loader2 className="mx-auto mb-2 animate-spin" size={28} />
          Loading purchase order…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-rose-600">{error}</div>
      ) : draft ? (
        <PoCreateView
          draft={draft}
          onDone={() => navigate('/dashboard/purchase/polist')}
          onCancel={() => navigate('/dashboard/purchase/polist')}
        />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No items selected. Go to PO Pending to create a purchase order.
        </div>
      )}
    </div>
  );
}

function buildDirectDraft(navState) {
  if (navState.items) {
    return { items: navState.items, vendorName: navState.vendorName, existingPO: null };
  }
  return null;
}
