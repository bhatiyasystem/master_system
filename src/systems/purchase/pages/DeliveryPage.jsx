import React from 'react';
import PurchaseHeader from '../components/PurchaseHeader';
import DeliveryView from '../components/DeliveryView';

export default function DeliveryPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Log and view incoming truck & driver details" />
      <DeliveryView />
    </div>
  );
}