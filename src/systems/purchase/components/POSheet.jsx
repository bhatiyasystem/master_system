;
import bhatiyaLogo from '../../../assets/bhatiya_Logo.jpg';

export default function POSheet({ po, revisionNote }) {
  return (
    <div className="mx-auto max-w-[900px] rounded-xl border border-gray-200 bg-white p-6 md:p-8 print:border-0 print:shadow-none">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center">
            <img src={bhatiyaLogo} alt="Bhatia Enterprises" className="h-full w-full object-contain" />
          </div>
          <div>
           <div className="font-sora text-[23px] font-extrabold leading-tight text-[#173254]">Bhatia Enterprises</div>
            <div className="mt-0.5 text-[11.3px] text-gray-500">Nehru Chowk, Bilaspur (C.G.)</div>
          </div>
        </div>
        <div className="text-right">
          <h4 className="text-[16px] font-extrabold tracking-wide text-[#0E2138]">PURCHASE ORDER</h4>
          <div className="mt-0.5 text-[11.8px] text-gray-500">
            PO No: <b>{po.poNo}</b>
          </div>
          <div className="text-[11.8px] text-gray-500">
            PO Date: <b>{po.poDate}</b>
          </div>
          {revisionNote && <div className="text-[11.8px] text-rose-600">{revisionNote}</div>}
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <InfoBox title="VENDOR">
          <b>{po.vendor.name || '—'}</b>
          <br />
          {po.vendor.addr || ''}
          <br />
          GSTIN: {po.vendor.gstin || '—'}
          <br />
          Contact: {po.vendor.contact || '—'}
          <br />
          Email: {po.vendor.email || '—'}
          <br />
          Ship Via: {po.vendor.fixTransporter || '—'}
        </InfoBox>
        <InfoBox title="SHIP TO">
          Bhatia Enterprises
          <br />
          Nehru Chowk, Bilaspur (C.G.)
          <br />
          GSTIN: {po.shipTo.gstin || '—'}
          <br />
          Contact: {po.shipTo.contact || '—'}
          <br />
          Email: {po.shipTo.email || '—'}
        </InfoBox>
      </div>

     

      <table className="mb-3 w-full border-collapse">
        <thead>
          <tr className="bg-[#173254] text-white">
            {['S.No', 'Product Name', 'Qty', 'Units'].map((h) => (
              <th key={h} className="px-2.5 py-2 text-left text-[10.8px] font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {po.items.map((it, idx) => (
            <tr key={idx} className={idx % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="border-b border-gray-200 px-2.5 py-1.5 text-[12px]">{idx + 1}</td>
              <td className="border-b border-gray-200 px-2.5 py-1.5 text-[12px]">
                {it.productName}
                {it.isExtra && (
                  <span className="ml-1.5 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">Extra</span>
                )}
              </td>
              <td className="border-b border-gray-200 px-2.5 py-1.5 text-[12px]">{it.qty}</td>
              <td className="border-b border-gray-200 px-2.5 py-1.5 text-[12px]">{it.units}</td>
            </tr>
          ))}
        </tbody>
      </table>



      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 text-[11px] text-gray-500">
        <b>Terms and conditions:</b>
        <br />
        {po.terms.split('\n').map((line, idx) => (
          <React.Fragment key={idx}>
            {line}
            <br />
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2.5 text-[11.3px] text-gray-500">
        <div>This is a computer generated PO</div>
        <div className="min-w-[170px] text-center">
          For Bhatia Enterprises
          <div className="mt-8 border-t border-gray-800 pt-1.5 text-[11.3px] font-semibold text-gray-800">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="bg-[#173254] px-3 py-1.5 text-[11.2px] font-bold text-white">{title}</div>
      <div className="px-3 py-2.5 text-[12px] leading-relaxed">{children}</div>
    </div>
  );
}

