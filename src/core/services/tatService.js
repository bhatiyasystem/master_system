import React from 'react';
import supabase from '../../SupabaseClient';

export async function fetchTatSettings() {
  let { data, error } = await supabase
    .from('purchase_tat_settings')
    .select('*');
  if (error) throw error;

  const logicalOrder = [
    'indent_approval', 'purchase_order', 'delivery', 'receiving', 'payment_approval', 'payment',
    'hr_indent', 'hr_find_enquiry', 'hr_call_tracker', 'hr_after_joining_work', 'hr_after_leaving_work', 'hr_payment'
  ];
  return (data || []).sort((a, b) => {
    return logicalOrder.indexOf(a.stage_key) - logicalOrder.indexOf(b.stage_key);
  });
}

export async function updateTatSetting(id, tatMinutes, isActive = true, stageKey = null) {
  // If using fallback mock ID, attempt an upsert by stage_key
  if (typeof id === 'string' && id.startsWith('mock_') && stageKey) {
    const { data, error } = await supabase
      .from('purchase_tat_settings')
      .upsert({
        stage_key: stageKey,
        tat_minutes: tatMinutes,
        is_active: isActive,
        updated_at: new Date().toISOString()
      }, { onConflict: 'stage_key' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('purchase_tat_settings')
    .update({ tat_minutes: tatMinutes, is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTatTracking(stageKey, entityIds) {
  if (!entityIds || entityIds.length === 0) return [];
  const stringIds = entityIds.map(id => String(id));
  const { data, error } = await supabase
    .from('purchase_tat_tracking')
    .select('*')
    .eq('stage_key', stageKey)
    .in('entity_id', stringIds);
  if (error) throw error;
  return data || [];
}

export async function startOrUpdateStage(entityId, stageKey, startedAt, tatMinutes) {
  if (!entityId) return null;
  let mins = tatMinutes;
  if (mins === undefined) {
    try {
      const { data: setting } = await supabase
        .from('purchase_tat_settings')
        .select('tat_minutes')
        .eq('stage_key', stageKey)
        .maybeSingle();
      mins = setting?.tat_minutes ?? 20;
    } catch (err) {
      mins = 20;
    }
  }

  const started = new Date(startedAt);
  const planned = new Date(started.getTime() + mins * 60000);

  const payload = {
    entity_id: String(entityId),
    stage_key: stageKey,
    started_at: started.toISOString(),
    planned_at: planned.toISOString(),
    status: 'Pending',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('purchase_tat_tracking')
    .upsert(payload, { onConflict: 'entity_id, stage_key' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeStage(entityId, stageKey, completedAt = new Date().toISOString()) {
  if (!entityId) return null;
  const { data, error } = await supabase
    .from('purchase_tat_tracking')
    .update({
      completed_at: completedAt,
      status: 'Completed',
      updated_at: new Date().toISOString()
    })
    .eq('entity_id', String(entityId))
    .eq('stage_key', stageKey)
    .select()
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error completing stage:', error);
  }
  return data || null;
}

export async function handleDeliveryReceived(deliveryId) {
  const now = new Date().toISOString();
  await completeStage(deliveryId, 'receiving', now);

  const { data: del } = await supabase
    .from('purchase_deliveries')
    .select('po_id')
    .eq('id', deliveryId)
    .maybeSingle();

  if (del && del.po_id) {
    const { data: allDels } = await supabase
      .from('purchase_deliveries')
      .select('received, received_at')
      .eq('po_id', del.po_id);

    if (allDels && allDels.length > 0 && allDels.every(d => d.received)) {
      const lastReceivedTime = allDels.reduce((max, d) => {
        const t = d.received_at ? new Date(d.received_at).getTime() : 0;
        return t > max ? t : max;
      }, 0);
      const startedAt = lastReceivedTime > 0 ? new Date(lastReceivedTime).toISOString() : now;
      await startOrUpdateStage(del.po_id, 'payment_approval', startedAt);
    }
  }
}

export function renderPlannedDateCell(tracking, fallbackStartDate, configuredMinutes) {
  let plannedAtStr = null;
  let isPending = true;

  const isValidDate = (d) => d instanceof Date && !isNaN(d.getTime());

  if (tracking) {
    if (tracking.status === 'Completed') {
      plannedAtStr = tracking.planned_at;
      isPending = false;
    } else {
      if (configuredMinutes !== undefined && configuredMinutes !== null) {
        const start = new Date(tracking.started_at || fallbackStartDate);
        if (isValidDate(start)) {
          const planned = new Date(start.getTime() + configuredMinutes * 60000);
          plannedAtStr = planned.toISOString();
        } else {
          plannedAtStr = tracking.planned_at;
        }
      } else {
        plannedAtStr = tracking.planned_at;
      }
    }
  } else if (fallbackStartDate) {
    const mins = (configuredMinutes !== undefined && configuredMinutes !== null) ? configuredMinutes : 20;
    const start = new Date(fallbackStartDate);
    if (isValidDate(start)) {
      const planned = new Date(start.getTime() + mins * 60000);
      plannedAtStr = planned.toISOString();
    }
  }

  if (!plannedAtStr) return '—';

  const plannedDate = new Date(plannedAtStr);
  if (!isValidDate(plannedDate)) return '—';
  const plannedText = plannedDate.toLocaleString('en-IN');
  const isOverdue = isPending && Date.now() > plannedDate.getTime();

  if (isOverdue) {
    return React.createElement(
      'div',
      { className: 'text-red-600 font-semibold' },
      plannedText.toUpperCase(),
      React.createElement(
        'span',
        { className: 'block text-[10px] text-red-500 font-bold uppercase tracking-wider' },
        // 'Delayed'
      )
    );
  }
  return React.createElement('span', null, plannedText);
}
