import { ShoppingCart } from 'lucide-react';

export default function PurchaseHeader({ subtitle }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
      <div className="rounded-2xl bg-[#173254] p-3 text-[#C99A3E] shadow-sm">
        <ShoppingCart size={26} />
      </div>
      <div>
        <h1 className="text-xl font-black tracking-tight text-gray-900 md:text-2xl">Purchase System</h1>
        <p className="text-xs font-semibold text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}
