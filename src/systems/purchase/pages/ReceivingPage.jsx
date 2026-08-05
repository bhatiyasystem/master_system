import React from 'react';
import PurchaseHeader from '../components/PurchaseHeader';
import ReceivingView from '../components/ReceivingView';

export default function ReceivingPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
            <PurchaseHeader subtitle="Confirm goods received against deliveries" />
            <ReceivingView />
        </div>
    );
}