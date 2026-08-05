import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Video, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import supabase from '../../../../../SupabaseClient';

const ACCEPT_BY_FORMAT = {
  IMAGE: 'image/*',
  VIDEO: 'video/*',
  DOCUMENT: '.pdf,.doc,.docx',
};

// Uploads to the 'festival-media' storage bucket, same pattern as
// src/systems/checklist-delegation/src/pages/admin/AllTasks.jsx's storage.from().upload()/.getPublicUrl().
export default function MediaUploader({ headerFormat, mediaUrl, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) return null;

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('festival-media')
        .upload(fileName, file, { cacheControl: '3600', contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('festival-media').getPublicUrl(fileName);
      onChange(publicUrl, file.name);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const Icon = headerFormat === 'IMAGE' ? ImageIcon : headerFormat === 'VIDEO' ? Video : FileText;

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Header {headerFormat.charAt(0) + headerFormat.slice(1).toLowerCase()}
      </label>
      <label className="flex items-center gap-3 border border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50">
        {uploading ? (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        ) : mediaUrl ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Icon className="w-5 h-5 text-gray-400" />
        )}
        <span className="text-sm text-gray-600 truncate">
          {uploading ? 'Uploading…' : mediaUrl ? 'Uploaded — click to replace' : `Upload ${headerFormat.toLowerCase()}`}
        </span>
        <input
          type="file"
          accept={ACCEPT_BY_FORMAT[headerFormat]}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Upload className="w-4 h-4 text-gray-300 ml-auto" />
      </label>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {mediaUrl && headerFormat === 'IMAGE' && (
        <img src={mediaUrl} alt="preview" className="h-20 rounded-lg border border-gray-200 object-cover" />
      )}
    </div>
  );
}
