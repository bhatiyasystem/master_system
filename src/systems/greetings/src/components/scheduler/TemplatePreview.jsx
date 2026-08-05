import React from 'react';
import { Image as ImageIcon, Video, FileText } from 'lucide-react';

const SAMPLE_CONTACT = {
  name: 'John Doe',
  phone_number: '919876543210',
  email: 'john@example.com',
  extra_fields: { business_name: 'Acme Traders' },
};

// WhatsApp templates apply their own *bold*/_italic_/~strike~ markup around
// {{n}} placeholders in the template body itself. If a variable's value also
// contains one of those characters (e.g. someone typed "*Holi" into the
// occasion field), it collides with the template's own marker and renders as
// a stray/mismatched asterisk (e.g. "**Holi*"). Strip them from substituted
// values so only the template's own formatting ever shows.
const stripMarkupChars = (value) => String(value ?? '').replace(/[*_~`]/g, '').trim();

const resolveField = (contact, path, occasion) => {
  if (!path) return null;
  if (path === 'occasion') return occasion || null;
  if (path === 'name') return contact.name;
  if (path === 'phone_number') return contact.phone_number;
  if (path === 'email') return contact.email;
  if (path.startsWith('extra_fields.')) return contact.extra_fields?.[path.slice('extra_fields.'.length)];
  return contact.extra_fields?.[path];
};

// Adapted from WhatsappHistory.jsx's renderTemplate — same {{n}} substitution + bubble layout,
// extended with a header-media block for IMAGE/VIDEO/DOCUMENT headers.
export default function TemplatePreview({ template, variableMapping = {}, previewContact, occasion }) {
  if (!template) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 p-8 text-center">
        Pick a template to see a live preview here.
      </div>
    );
  }

  const contact = previewContact || SAMPLE_CONTACT;

  const bodyIndices = Object.keys(variableMapping)
    .filter((k) => /^\d+$/.test(k))
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);

  let formattedBody = template.body_text || '';
  bodyIndices.forEach((idx) => {
    const entry = variableMapping[String(idx)];
    const rawValue = entry?.type === 'field' ? resolveField(contact, entry.value, occasion) : entry?.value;
    const value = stripMarkupChars(rawValue);
    formattedBody = formattedBody.replaceAll(`{{${idx}}}`, value || 'N/A');
  });

  const headerFormat = template.header_format || 'NONE';
  const headerMediaUrl = variableMapping.header_media;
  const MediaIcon = headerFormat === 'IMAGE' ? ImageIcon : headerFormat === 'VIDEO' ? Video : FileText;

  return (
    <div className="bg-[#e5ded8] rounded-xl p-4 h-full flex items-start">
      <div className="bg-white rounded-lg rounded-tl-none shadow-sm p-3 max-w-full w-full space-y-1.5 text-left">
        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && (
          <div className="rounded-md bg-gray-100 border border-gray-200 h-28 flex items-center justify-center overflow-hidden mb-1">
            {headerMediaUrl && headerFormat === 'IMAGE' ? (
              <img src={headerMediaUrl} alt="header" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-gray-400 text-xs gap-1">
                <MediaIcon className="w-6 h-6" />
                {headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()} header
              </div>
            )}
          </div>
        )}

        {headerFormat === 'TEXT' && template.header_text && (
          <div className="font-bold text-[#111b21] text-[13px] border-b border-black/5 pb-1 mb-1">
            {template.header_text}
          </div>
        )}

        <div className="text-[13px] text-[#303030] leading-relaxed whitespace-pre-wrap">{formattedBody}</div>

        {template.footer_text && (
          <div className="text-[10px] text-[#667781] mt-1">{template.footer_text}</div>
        )}

        {Array.isArray(template.buttons) && template.buttons.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-black/5 flex flex-wrap gap-1.5">
            {template.buttons.map((btn, idx) => (
              <span key={idx} className="bg-black/5 text-[#008069] text-[10px] font-semibold px-2 py-0.5 rounded border border-black/5">
                {btn.text || btn.type}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
