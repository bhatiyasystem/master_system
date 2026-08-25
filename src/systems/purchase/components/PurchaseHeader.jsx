import { useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { usePurchasePendingCounts } from '../hooks/usePurchasePendingCounts';

export default function PurchaseHeader({ subtitle }) {
  const location = useLocation();
  const counts = usePurchasePendingCounts();

  const getPagePendingBadge = () => {
    const path = location.pathname;
    if (path.startsWith('/dashboard/purchase/approval')) {
      return null;
    }
    if (path.startsWith('/dashboard/purchase/polist') || path.startsWith('/dashboard/purchase/pocreate')) {
      return null;
    }
    if (path.startsWith('/dashboard/purchase/delivery')) {
      return null;
    }
    if (path.startsWith('/dashboard/purchase/receiving')) {
      return null;
    }
    if (path.startsWith('/dashboard/purchase/payment-approval')) {
      return null;
    }
    if (path.startsWith('/dashboard/purchase/payment')) {
      return null;
    }
    return null;
  };

  const badgeText = getPagePendingBadge();

  return (
    <div className="space-y-4 border-b border-gray-200 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[#173254] p-3 text-[#C99A3E] shadow-sm">
            <ShoppingCart size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-gray-900 md:text-2xl flex flex-wrap items-center gap-2">
              <span>Purchase System</span>
              {badgeText && (
                <span className="inline-flex h-5 items-center justify-center rounded-full bg-rose-500 px-2 text-[10px] font-black text-white">
                  {badgeText}
                </span>
              )}
            </h1>
            <p className="text-xs font-semibold text-gray-500">{subtitle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
