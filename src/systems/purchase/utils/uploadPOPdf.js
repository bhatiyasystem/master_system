import supabase from '../../../SupabaseClient';

/**
 * Upload a PDF Blob to Supabase Storage and return its public URL.
 * Tries 'whatsapp-documents' first, then 'whatsapp-media', then 'purchase-builty'.
 *
 * @param {Blob}   blob   - The PDF blob from generatePOPdfBlob()
 * @param {string} poNo   - PO number used to name the file (e.g. "BE-PO-2026-001")
 * @returns {Promise<string|null>} - Public URL of the uploaded PDF or null
 */
export async function uploadPOPdf(blob, poNo) {
    const safeName = (poNo || 'PO').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `po_${safeName}_${Date.now()}.pdf`;

    const buckets = ['whatsapp-documents', 'whatsapp-media', 'purchase-builty'];

    for (const bucketName of buckets) {
        try {
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(fileName, blob, { contentType: 'application/pdf', upsert: true });

            if (!uploadError) {
                const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
                if (data?.publicUrl) {
                    console.log(`[uploadPOPdf] Successfully uploaded PO PDF to bucket "${bucketName}":`, data.publicUrl);
                    return data.publicUrl;
                }
            } else {
                console.warn(`[uploadPOPdf] Upload to bucket "${bucketName}" failed:`, uploadError.message);
            }
        } catch (err) {
            console.warn(`[uploadPOPdf] Exception uploading to bucket "${bucketName}":`, err.message);
        }
    }

    console.error('[uploadPOPdf] Failed to upload PO PDF to any Supabase Storage bucket.');
    return null;
}
