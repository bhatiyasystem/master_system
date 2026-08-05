import React from 'react';
import { useNavigate } from 'react-router-dom';
import PurchaseHeader from '../components/PurchaseHeader';
import ImportView from '../components/ImportView';

export default function ImportPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Upload the Excel stock/indent sheet" />
      <ImportView onImported={() => navigate('/dashboard/purchase/indent')} />
    </div>
  );
}
