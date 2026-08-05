import React from 'react';
import PurchaseHeader from '../components/PurchaseHeader';
import ApprovalView from '../components/ApprovalView';

export default function ApprovalPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Approve or reject a whole category at once" />
      <ApprovalView />
    </div>
  );
}
