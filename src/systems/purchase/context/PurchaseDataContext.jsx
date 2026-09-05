/**
 * PurchaseDataContext
 *
 * Fetches shared purchase data once at the layout level and keeps it alive
 * for the entire session. Individual purchase pages consume this context
 * instead of fetching independently — so navigation between pages is instant
 * with no loading spinner.
 *
 * Data is automatically refreshed every 30 seconds in the background.
 * Pages that perform mutations (approve, create PO, etc.) should call
 * `refresh()` from this context after their action to re-sync immediately.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  fetchIndents,
  fetchPOs,
  fetchDeliveries,
  fetchReceivings,
  fetchPaymentApprovals,
  fetchPayments,
  fetchPayablePOs,
} from '../services/purchaseService';
import { fetchTatTracking, fetchTatSettings } from '../../../core/services/tatService';

const POLL_MS = 30_000;

const PurchaseDataContext = createContext(null);

export function PurchaseDataProvider({ children }) {
  const [indents, setIndents] = useState([]);
  const [pos, setPos] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [receivings, setReceivings] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [payablePOs, setPayablePOs] = useState([]);
  const [tatTracking, setTatTracking] = useState({});   // keyed by stageKey:entityId
  const [tatSettings, setTatSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialized = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Fetch all base data in parallel
      const [
        indentRows,
        poRows,
        deliveryRows,
        receivingRows,
        approvalRows,
        paymentRows,
        payablePORows,
        settingsRows,
      ] = await Promise.all([
        fetchIndents(),
        fetchPOs(),
        fetchDeliveries(),
        fetchReceivings(),
        fetchPaymentApprovals(),
        fetchPayments(),
        fetchPayablePOs(),
        fetchTatSettings(),
      ]);

      setIndents(indentRows || []);
      setPos(poRows || []);
      setDeliveries(deliveryRows || []);
      setReceivings(receivingRows || []);
      setApprovals(approvalRows || []);
      setPayments(paymentRows || []);
      setPayablePOs(payablePORows || []);
      setTatSettings(settingsRows || []);

      // Fetch TAT tracking for all stages in parallel
      const indentIds = (indentRows || []).map(r => r.dbId);
      const poIds = (poRows || []).map(p => p.id);
      const deliveryIds = (deliveryRows || []).map(d => d.id);
      const approvalIds = (approvalRows || []).map(a => a.id);

      const trackingResults = await Promise.all([
        indentIds.length > 0 ? fetchTatTracking('indent_approval', indentIds) : Promise.resolve([]),
        indentIds.length > 0 ? fetchTatTracking('purchase_order', indentIds) : Promise.resolve([]),
        poIds.length > 0    ? fetchTatTracking('delivery', poIds)            : Promise.resolve([]),
        deliveryIds.length > 0 ? fetchTatTracking('receiving', deliveryIds)  : Promise.resolve([]),
        approvalIds.length > 0 ? fetchTatTracking('payment_approval', approvalIds) : Promise.resolve([]),
        approvalIds.length > 0 ? fetchTatTracking('payment', approvalIds)    : Promise.resolve([]),
      ]);

      const combined = {};
      trackingResults.flat().forEach(t => {
        combined[`${t.stage_key}:${t.entity_id}`] = t;
      });
      setTatTracking(combined);

      initialized.current = true;
    } catch (err) {
      setError(err.message || 'Failed to load purchase data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + periodic background refresh
  useEffect(() => {
    refresh();
    const id = setInterval(() => refresh(true), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  /**
   * Helper: get TAT tracking entry for a specific stage + entity.
   */
  const getTatEntry = useCallback((stageKey, entityId) => {
    return tatTracking[`${stageKey}:${String(entityId)}`] ?? null;
  }, [tatTracking]);

  /**
   * Helper: get TAT minutes for a stage key from settings.
   */
  const getTatMins = useCallback((stageKey, fallback = 20) => {
    const s = tatSettings.find(x => x.stage_key === stageKey);
    return (s && s.is_active) ? s.tat_minutes : fallback;
  }, [tatSettings]);

  return (
    <PurchaseDataContext.Provider value={{
      indents, pos, deliveries, receivings, approvals, payments, payablePOs,
      tatTracking, tatSettings,
      loading, error,
      refresh: () => refresh(true),
      getTatEntry, getTatMins,
    }}>
      {children}
    </PurchaseDataContext.Provider>
  );
}

export function usePurchaseData() {
  const ctx = useContext(PurchaseDataContext);
  if (!ctx) throw new Error('usePurchaseData must be used inside PurchaseDataProvider');
  return ctx;
}
