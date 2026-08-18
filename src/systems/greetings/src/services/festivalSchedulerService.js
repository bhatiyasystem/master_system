import supabase from '../../../../SupabaseClient';

/*
  ── SQL to run once in Supabase SQL editor ───────────────────────────────────
  See FESTIVAL_SCHEDULER_SETUP.md at the repo root for the full schema,
  storage bucket, Edge Function source, and pg_cron setup.
*/

// ── IST helpers ──────────────────────────────────────────────────────────────

export const toScheduleAtIso = (dateStr, timeStr) => {
  // dateStr: 'YYYY-MM-DD', timeStr: 'HH:mm' — both entered in IST by the user.
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  // Build the UTC instant that corresponds to that IST wall-clock time.
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - 5.5 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
};

// ── Templates (read-only — populated by whatsappLogService.syncTemplates()) ──

export const fetchApprovedTemplates = async () => {
  const { data, error } = await supabase
    .from('whatsapp_templates')
    .select('name, status, language, body_text, header_text, footer_text, buttons, header_format, body_variable_count, header_variable_present, example_body_params, example_header_handle')
    .eq('status', 'APPROVED')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
};

// ── Contacts ──────────────────────────────────────────────────────────────────

export const fetchContacts = async ({ search } = {}) => {
  let query = supabase.from('festival_contacts').select('*').eq('is_active', true).order('name', { ascending: true });
  if (search) query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchContactsCount = async () => {
  const { count, error } = await supabase
    .from('festival_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (error) throw error;
  return count || 0;
};

// ── System users (current users of the app) ───────────────────────────────────
// Browsed directly from `users` — nothing is written here until the admin
// actually picks one (or "Select All"), so opening the picker never silently
// creates/mutates festival_contacts rows.

export const fetchSystemUsers = async ({ search } = {}) => {
  let query = supabase
    .from('users')
    .select('id, user_name, number')
    .eq('status', 'active')
    .not('number', 'is', null)
    .order('user_name', { ascending: true });
  if (search) query = query.ilike('user_name', `%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

// Upserts the given system users into festival_contacts (by phone number) so
// they can be referenced as recipients, and returns their contact rows.
export const upsertUsersAsContacts = async (users) => {
  if (!users?.length) return [];
  const rows = users.map((u) => {
    let phone = String(u.number).replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    return {
      name: u.user_name || 'Unknown',
      phone_number: phone,
      extra_fields: { source: 'default_user', user_id: u.id },
    };
  });
  const { data, error } = await supabase
    .from('festival_contacts')
    .upsert(rows, { onConflict: 'phone_number' })
    .select('id, phone_number');
  if (error) throw error;
  return data || [];
};

export const upsertContacts = async (rows) => {
  // rows: [{ name, phone_number, email, extra_fields }]
  if (!rows?.length) return [];
  const formattedRows = rows.map(r => {
    let phone = String(r.phone_number).replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;
    return {
      ...r,
      phone_number: phone
    };
  });
  const { data, error } = await supabase
    .from('festival_contacts')
    .upsert(formattedRows, { onConflict: 'phone_number' })
    .select();
  if (error) throw error;
  return data || [];
};

export const downloadContactsCsvTemplate = () => {
  const header = 'name,phone_number,email,business_name\n';
  const sample = 'John Doe,919876543210,john@example.com,Acme Traders\n';
  const blob = new Blob([header, sample], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'festival_contacts_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// ── Schedules ─────────────────────────────────────────────────────────────────

export const fetchSchedules = async ({ status, search } = {}) => {
  let query = supabase.from('festival_schedules').select('*').order('created_at', { ascending: false });
  if (status && status !== 'All') query = query.eq('status', status);
  if (search) query = query.or(`occasion.ilike.%${search}%,template_name.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchScheduleById = async (id) => {
  const { data, error } = await supabase.from('festival_schedules').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
};

export const createSchedule = async (payload) => {
  // payload: { occasion, templateName, scheduleDate, scheduleTime, audienceType, variableMapping, status }
  const createdBy = localStorage.getItem('user-id') || null;
  const { data, error } = await supabase
    .from('festival_schedules')
    .insert({
      occasion: payload.occasion,
      template_name: payload.templateName,
      schedule_at: toScheduleAtIso(payload.scheduleDate, payload.scheduleTime),
      audience_type: payload.audienceType,
      variable_mapping: payload.variableMapping || {},
      status: payload.status || 'Draft',
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateSchedule = async (id, payload) => {
  const update = {
    occasion: payload.occasion,
    template_name: payload.templateName,
    schedule_at: toScheduleAtIso(payload.scheduleDate, payload.scheduleTime),
    audience_type: payload.audienceType,
    variable_mapping: payload.variableMapping || {},
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from('festival_schedules').update(update).eq('id', id).select().single();
  if (error) throw error;
  return data;
};

export const duplicateSchedule = async (id) => {
  const original = await fetchScheduleById(id);
  const createdBy = localStorage.getItem('user-id') || null;
  const { data, error } = await supabase
    .from('festival_schedules')
    .insert({
      occasion: original.occasion,
      template_name: original.template_name,
      schedule_at: original.schedule_at,
      audience_type: original.audience_type,
      variable_mapping: original.variable_mapping,
      status: 'Draft',
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
};

// ── Recipient resolution (turns Draft -> Scheduled) ───────────────────────────

export const resolveAndScheduleRecipients = async (scheduleId, { audienceType, selectedContactIds, csvContacts }) => {
  let contacts = [];

  if (audienceType === 'csv' && csvContacts?.length) {
    contacts = await upsertContacts(csvContacts);
  } else if (audienceType === 'selected' && selectedContactIds?.length) {
    const { data, error } = await supabase.from('festival_contacts').select('*').in('id', selectedContactIds);
    if (error) throw error;
    contacts = data || [];
  } else {
    // 'all'
    contacts = await fetchContacts();
  }

  if (!contacts.length) throw new Error('No recipients resolved for this schedule.');

  const recipientRows = contacts.map((c) => ({
    schedule_id: scheduleId,
    contact_id: c.id,
    status: 'Pending',
  }));

  const { error: insertError } = await supabase.from('festival_schedule_recipients').insert(recipientRows);
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('festival_schedules')
    .update({ status: 'Scheduled', total_recipients: contacts.length, updated_at: new Date().toISOString() })
    .eq('id', scheduleId);
  if (updateError) throw updateError;

  return contacts.length;
};

const clearRecipients = async (scheduleId) => {
  const { error } = await supabase.from('festival_schedule_recipients').delete().eq('schedule_id', scheduleId);
  if (error) throw error;
};

export const reResolveRecipients = async (scheduleId, audienceArgs) => {
  await clearRecipients(scheduleId);
  return resolveAndScheduleRecipients(scheduleId, audienceArgs);
};

// ── Status actions ────────────────────────────────────────────────────────────

const setStatus = async (id, status, extra = {}) => {
  const { data, error } = await supabase
    .from('festival_schedules')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const pauseSchedule = (id) => setStatus(id, 'Paused');

export const resumeSchedule = async (id) => {
  const { count: sentOrFailed } = await supabase
    .from('festival_schedule_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('schedule_id', id)
    .in('status', ['Sent', 'Failed']);
  return setStatus(id, (sentOrFailed || 0) > 0 ? 'Running' : 'Scheduled');
};

export const cancelSchedule = (id) => setStatus(id, 'Cancelled');

export const deleteSchedule = async (id) => {
  const { error } = await supabase.from('festival_schedules').delete().eq('id', id);
  if (error) throw error;
};

// ── Progress / logs / failed ───────────────────────────────────────────────────

export const fetchRecipients = async (scheduleId, { status } = {}) => {
  let query = supabase
    .from('festival_schedule_recipients')
    .select('*, festival_contacts(name, phone_number, email)')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: true });
  if (status && status !== 'All') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchLogs = async (scheduleId) => {
  const { data, error } = await supabase
    .from('festival_schedule_logs')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ── Manual trigger (for testing before the cron tick fires) ──────────────────

export const triggerSchedulerEdgeFunction = async () => {
  const res = await fetch('/api/festival-scheduler-run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to trigger Edge Function via proxy');
  }
  return res.json();
};

export default {
  fetchApprovedTemplates,
  fetchContacts,
  fetchContactsCount,
  fetchSystemUsers,
  upsertUsersAsContacts,
  upsertContacts,
  downloadContactsCsvTemplate,
  fetchSchedules,
  fetchScheduleById,
  createSchedule,
  updateSchedule,
  duplicateSchedule,
  resolveAndScheduleRecipients,
  reResolveRecipients,
  pauseSchedule,
  resumeSchedule,
  cancelSchedule,
  deleteSchedule,
  fetchRecipients,
  fetchLogs,
  triggerSchedulerEdgeFunction,
};
