import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PurchaseHeader from '../components/PurchaseHeader';
import IndentView from '../components/IndentView';

export default function IndentPage() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <PurchaseHeader subtitle="Upload the Excel stock/indent sheet, and view every imported item below" />
      <IndentView
        refreshKey={refreshKey}
        onImported={() => setRefreshKey((k) => k + 1)}
        onTabChange={(tab) => navigate(`/dashboard/purchase/${tab}`)}
      />
    </div>
  );
}