import { X, CalendarClock, Users2, MessageSquareText } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import VariableMapper from './VariableMapper';
import MediaUploader from './MediaUploader'
import TemplatePicker from './TemplatePicker';
import AudienceSelector from './AudienceSelector';
import ScheduleSummary from './ScheduleSummary';
import TemplatePreview from './TemplatePreview';
import supabase from '../../../../../SupabaseClient';
import { fetchApprovedTemplates, createSchedule, updateSchedule, resolveAndScheduleRecipients, reResolveRecipients, } from '../../services/festivalSchedulerService';
import { useMagicToast } from '../../../../../context/MagicToastContext';

const emptyForm = {
  occasion: '',
  scheduleDate: '',
  scheduleTime: '',
  templateName: '',
  variableMapping: {},
  audienceType: 'all',
  selectedContactIds: [],
  csvContacts: [],
};

const splitScheduleAt = (iso) => {
  if (!iso) return { scheduleDate: '', scheduleTime: '' };
  const ist = new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000);
  return {
    scheduleDate: ist.toISOString().slice(0, 10),
    scheduleTime: ist.toISOString().slice(11, 16),
  };
};

export default function CreateScheduleModal({ schedule, onClose, onSaved }) {
  const { showToast } = useMagicToast();
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(schedule);

  useEffect(() => {
    fetchApprovedTemplates().then(setTemplates).catch((err) => showToast(err.message || 'Failed to load templates', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!schedule) {
      setForm(emptyForm);
      return;
    }
    const { scheduleDate, scheduleTime } = splitScheduleAt(schedule.schedule_at);
    setForm({
      ...emptyForm,
      occasion: schedule.occasion,
      scheduleDate,
      scheduleTime,
      templateName: schedule.template_name || '',
      variableMapping: schedule.variable_mapping || {},
      audienceType: schedule.audience_type,
    });

    if (schedule.audience_type === 'selected') {
      supabase
        .from('festival_schedule_recipients')
        .select('contact_id')
        .eq('schedule_id', schedule.id)
        .then(({ data }) => {
          setForm((prev) => ({ ...prev, selectedContactIds: (data || []).map((r) => r.contact_id).filter(Boolean) }));
        });
    }
  }, [schedule]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === form.templateName) || null,
    [templates, form.templateName]
  );

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const recipientCount = useMemo(() => {
    if (form.audienceType === 'csv') return form.csvContacts.length;
    if (form.audienceType === 'selected') return form.selectedContactIds.length;
    return schedule?.total_recipients ?? 0;
  }, [form.audienceType, form.csvContacts, form.selectedContactIds, schedule]);

  const buildPayload = useCallback(() => ({
    occasion: form.occasion,
    templateName: selectedTemplate?.name || '',
    scheduleDate: form.scheduleDate,
    scheduleTime: form.scheduleTime,
    audienceType: form.audienceType,
    variableMapping: form.variableMapping,
  }), [form, selectedTemplate]);

  const validateBasics = () => {
    if (!form.occasion) return 'Please enter an occasion.';
    if (!form.scheduleDate || !form.scheduleTime) return 'Please pick a schedule date and time.';
    if (!form.templateName) return 'Please select a WhatsApp template.';
    return null;
  };

  // Meta rejects a template send if the number of body/header parameters we
  // send doesn't match the template's definition (error 132000) — make sure
  // every {{n}} the template expects actually has a value before scheduling.
  const validateVariableMapping = () => {
    if (!selectedTemplate) return null;

    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(selectedTemplate.header_format) && !form.variableMapping.header_media) {
      return `Please upload a header ${selectedTemplate.header_format.toLowerCase()} before scheduling.`;
    }

    const requiredKeys = [
      ...(selectedTemplate.header_variable_present ? ['header'] : []),
      ...Array.from({ length: selectedTemplate.body_variable_count || 0 }, (_, i) => String(i + 1)),
    ];
    const incomplete = requiredKeys.some((key) => {
      const entry = form.variableMapping[key];
      if (!entry) return true;
      return entry.type === 'custom' ? !entry.value?.trim() : !entry.value;
    });
    if (incomplete) return `Please fill in all ${requiredKeys.length} template variable(s) before scheduling.`;
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validateBasics();
    if (err) return showToast(err, 'error');
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await updateSchedule(schedule.id, payload);
        showToast('Schedule updated as draft.');
      } else {
        await createSchedule({ ...payload, status: 'Draft' });
        showToast('Schedule saved as draft.');
      }
      onSaved();
    } catch (e) {
      showToast(e.message || 'Failed to save schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    const err = validateBasics() || validateVariableMapping();
    if (err) return showToast(err, 'error');

    const audienceArgs = {
      audienceType: form.audienceType,
      selectedContactIds: form.selectedContactIds,
      csvContacts: form.csvContacts,
    };

    if (form.audienceType === 'selected' && !form.selectedContactIds.length) {
      return showToast('Please select at least one client.', 'error');
    }
    if (form.audienceType === 'csv' && !form.csvContacts.length) {
      return showToast('Please upload a CSV list of clients.', 'error');
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      let scheduleId = schedule?.id;
      if (isEdit) {
        await updateSchedule(scheduleId, payload);
        await reResolveRecipients(scheduleId, audienceArgs);
      } else {
        const created = await createSchedule({ ...payload, status: 'Draft' });
        scheduleId = created.id;
        await resolveAndScheduleRecipients(scheduleId, audienceArgs);
      }
      showToast('Schedule saved — it will send automatically at the scheduled time.');
      onSaved();
    } catch (e) {
      showToast(e.message || 'Failed to schedule', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden border border-violet-100 flex flex-col max-h-[92vh]"
      >
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-black text-white text-lg">{isEdit ? 'Edit Schedule' : 'Create Schedule'}</h3>
            <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-wider">Festival WhatsApp Scheduler</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/15 text-white/90 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-0 bg-gray-50/60">
          <div className="p-6 space-y-5 overflow-y-auto">
            <section className="bg-white rounded-2xl border border-violet-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-wider">
                <CalendarClock className="w-4 h-4" /> Schedule
              </div>
              <TemplatePicker
                occasion={form.occasion}
                onOccasionChange={(v) => update({ occasion: v })}
                scheduleDate={form.scheduleDate}
                onScheduleDateChange={(v) => update({ scheduleDate: v })}
                scheduleTime={form.scheduleTime}
                onScheduleTimeChange={(v) => update({ scheduleTime: v })}
              />
            </section>

            <section className="bg-white rounded-2xl border border-violet-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-wider">
                <MessageSquareText className="w-4 h-4" /> Message
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp Template</label>
                <select
                  value={form.templateName || ''}
                  onChange={(e) => update({ templateName: e.target.value, variableMapping: {} })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {selectedTemplate && (
                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{selectedTemplate.header_format || 'NONE'} header</span>
                    <span>{selectedTemplate.body_variable_count || 0} body variable(s)</span>
                  </div>
                  <VariableMapper
                    template={selectedTemplate}
                    variableMapping={form.variableMapping}
                    onChange={(vm) => update({ variableMapping: vm })}
                  />
                  <MediaUploader
                    headerFormat={selectedTemplate.header_format}
                    mediaUrl={form.variableMapping.header_media}
                    onChange={(url) => update({ variableMapping: { ...form.variableMapping, header_media: url } })}
                  />
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-violet-100 shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-wider">
                <Users2 className="w-4 h-4" /> Audience
              </div>
              <AudienceSelector
                audienceType={form.audienceType}
                onAudienceTypeChange={(v) => update({ audienceType: v })}
                selectedContactIds={form.selectedContactIds}
                onSelectedContactIdsChange={(ids) => update({ selectedContactIds: ids })}
                csvContacts={form.csvContacts}
                onCsvContactsChange={(rows) => update({ csvContacts: rows })}
              />
            </section>

            <ScheduleSummary
              occasion={form.occasion}
              scheduleDate={form.scheduleDate}
              scheduleTime={form.scheduleTime}
              template={selectedTemplate}
              audienceType={form.audienceType}
              recipientCount={recipientCount}
              saving={saving}
              onSaveDraft={handleSaveDraft}
              onSchedule={handleSchedule}
            />
          </div>

          <div className="bg-gray-50/80 border-l border-gray-100 p-6 lg:sticky lg:top-0 flex flex-col">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Live Preview</p>
            <div className="flex-1 min-h-[220px]">
              <TemplatePreview template={selectedTemplate} variableMapping={form.variableMapping} occasion={form.occasion} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
