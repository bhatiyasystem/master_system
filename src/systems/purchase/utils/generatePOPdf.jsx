/* eslint-disable react-refresh/only-export-components */
import { StyleSheet, pdf, Document, Page, View, Text } from '@react-pdf/renderer';

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        fontSize: 10,
        padding: 36,
        color: '#1a1a2e',
        backgroundColor: '#ffffff',
    },
    // Header
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#173254' },
    companyAddr: { fontSize: 9, color: '#6b7280', marginTop: 2 },
    poTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0E2138', textAlign: 'right' },
    poMeta: { fontSize: 9, color: '#6b7280', textAlign: 'right', marginTop: 2 },
    poMetaBold: { fontFamily: 'Helvetica-Bold', color: '#1a1a2e' },
    // Divider
    divider: { borderBottom: '1px solid #e5e7eb', marginVertical: 10 },
    // Info boxes
    infoGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
    infoBox: { flex: 1, border: '1px solid #e5e7eb', borderRadius: 4 },
    infoBoxTitle: { backgroundColor: '#173254', color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8, padding: '4 6', letterSpacing: 0.6 },
    infoBoxBody: { padding: '6 8', fontSize: 9, lineHeight: 1.6 },
    bold: { fontFamily: 'Helvetica-Bold' },
    // Strip
    stripRow: { flexDirection: 'row', border: '1px solid #e5e7eb', borderRadius: 4, marginBottom: 10, overflow: 'hidden' },
    stripCell: { flex: 1, padding: '5 8', borderRight: '1px solid #e5e7eb' },
    stripCellLast: { flex: 1, padding: '5 8' },
    stripLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 },
    stripValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginTop: 2 },
    // Table
    tableHeader: { flexDirection: 'row', backgroundColor: '#173254', color: '#fff', padding: '5 6', marginBottom: 0 },
    tableHeaderCell: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
    tableRow: { flexDirection: 'row', borderBottom: '1px solid #e5e7eb', padding: '4 6' },
    tableRowAlt: { backgroundColor: '#f9fafb' },
    colNo: { width: 30 },
    colName: { flex: 1 },
    colQty: { width: 50, textAlign: 'right' },
    colUnit: { width: 50, textAlign: 'right' },
    // Terms
    termsBox: { border: '1px solid #e5e7eb', borderRadius: 4, padding: '6 8', marginTop: 10, backgroundColor: '#f9fafb' },
    termsTitle: { fontFamily: 'Helvetica-Bold', fontSize: 8, marginBottom: 4 },
    termsText: { fontSize: 8, color: '#6b7280', lineHeight: 1.55 },
    // Footer
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, alignItems: 'flex-end' },
    footerEmail: { fontSize: 8.5, color: '#6b7280' },
    sigBlock: { width: 160, textAlign: 'center' },
    sigLine: { borderTop: '1px solid #374151', paddingTop: 4, fontSize: 9, fontFamily: 'Helvetica-Bold' },
    sigLabel: { fontSize: 8, color: '#6b7280', marginTop: 2 },
});

// ─── PDF Document ─────────────────────────────────────────────────────────────

function PODocument({ po }) {
    return (
        <Document title={`Purchase Order — ${po.poNo}`} author="Bhatia Enterprises">
            <Page size="A4" style={S.page}>

                {/* Header */}
                <View style={S.headerRow}>
                    <View>
                        <Text style={S.companyName}>Bhatia Enterprises</Text>
                        <Text style={S.companyAddr}>Nehru Chowk, Bilaspur (C.G.)</Text>
                    </View>
                    <View>
                        <Text style={S.poTitle}>PURCHASE ORDER</Text>
                        <Text style={S.poMeta}>PO No: <Text style={S.poMetaBold}>{po.poNo}</Text></Text>
                        <Text style={S.poMeta}>PO Date: <Text style={S.poMetaBold}>{po.poDate}</Text></Text>
                    </View>
                </View>
                <View style={S.divider} />

                {/* Vendor + Ship To */}
                <View style={S.infoGrid}>
                    <View style={S.infoBox}>
                        <View style={S.infoBoxTitle}><Text>VENDOR</Text></View>
                        <View style={S.infoBoxBody}>
                            <Text style={S.bold}>{po.vendor?.name || '—'}</Text>
                            {po.vendor?.addr ? <Text>{po.vendor.addr}</Text> : null}
                            <Text>GSTIN: {po.vendor?.gstin || '—'}</Text>
                            <Text>Contact: {po.vendor?.contact || '—'}</Text>
                            <Text>Email: {po.vendor?.email || '—'}</Text>
                            <Text>Fixed Transporter: {po.vendor?.fixTransporter || po.shipVia || '—'}</Text>
                        </View>
                    </View>
                    <View style={S.infoBox}>
                        <View style={S.infoBoxTitle}><Text>SHIP TO</Text></View>
                        <View style={S.infoBoxBody}>
                            <Text style={S.bold}>Bhatia Enterprises</Text>
                            <Text>Nehru Chowk, Bilaspur (C.G.)</Text>
                            <Text>GSTIN: {po.shipTo?.gstin || '—'}</Text>
                            <Text>Contact: {po.shipTo?.contact || '—'}</Text>
                            <Text>Email: {po.shipTo?.email || '—'}</Text>
                        </View>
                    </View>
                </View>

                

                {/* Items table */}
                <View style={S.tableHeader}>
                    <Text style={[S.tableHeaderCell, S.colNo]}>S.No</Text>
                    <Text style={[S.tableHeaderCell, S.colName]}>Product Name</Text>
                    <Text style={[S.tableHeaderCell, S.colQty]}>Qty</Text>
                    <Text style={[S.tableHeaderCell, S.colUnit]}>Units</Text>
                </View>
                {(po.items || []).map((it, idx) => (
                    <View key={idx} style={[S.tableRow, idx % 2 === 1 ? S.tableRowAlt : {}]}>
                        <Text style={S.colNo}>{idx + 1}</Text>
                        <Text style={S.colName}>{it.productName || '—'}</Text>
                        <Text style={S.colQty}>{it.qty}</Text>
                        <Text style={S.colUnit}>{it.units}</Text>
                    </View>
                ))}

                {/* Terms */}
                {po.terms ? (
                    <View style={S.termsBox}>
                        <Text style={S.termsTitle}>Terms and Conditions:</Text>
                        <Text style={S.termsText}>{po.terms}</Text>
                    </View>
                ) : null}

                {/* Footer */}
                <View style={S.footerRow}>
                    {/* <Text style={S.footerEmail}>Mark all communications to purchase-team@bhatia.com</Text> */}
                    <View style={S.sigBlock}>
                        <Text style={S.sigLabel}>For Bhatia Enterprises</Text>
                        <Text style={[S.sigLine, { marginTop: 28 }]}>Authorized Signatory</Text>
                    </View>
                </View>

            </Page>
        </Document>
    );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * Generate a PDF blob for a given PO object.
 * @param {object} po - The PO data (same shape as mapPoRow output)
 * @returns {Promise<Blob>}
 */
export async function generatePOPdfBlob(po) {
    const doc = <PODocument po={po} />;
    return await pdf(doc).toBlob();
}
