import React from 'react';
import PurchaseHeader from '../components/PurchaseHeader';
import PaymentApprovalView from '../components/PaymentApprovalView';

export default function PaymentApprovalPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
            <PurchaseHeader subtitle="Approve, reject, or hold payments for received POs" />
            <PaymentApprovalView />
        </div>
    );
}