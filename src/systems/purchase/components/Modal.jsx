import { X } from 'lucide-react';
;

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null;
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`flex max-h-[90vh] w-full ${widths[size]} flex-col rounded-2xl bg-white shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between rounded-t-2xl bg-[#173254] px-5 py-3.5 text-white">
          <h5 className="text-[15px] font-bold">{title}</h5>
          <button onClick={onClose} className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-gray-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
