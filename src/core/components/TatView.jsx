import React, { useState, useEffect } from "react";
import { Loader, Settings, Save, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { fetchTatSettings, updateTatSetting } from "../services/tatService";

// Helper function to format minutes into readable format (days, hours, minutes)
function formatMinutesToReadable(totalMinutes) {
  const mins = parseInt(totalMinutes, 10);
  if (isNaN(mins) || mins < 0) return "";
  if (mins === 0) return "0 minutes";

  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remainingMins = mins % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (remainingMins > 0) parts.push(`${remainingMins} minute${remainingMins > 1 ? 's' : ''}`);

  return parts.join(" ");
}

function TatView() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [section, setSection] = useState("Purchase");
  const [selectedStageKey, setSelectedStageKey] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [unit, setUnit] = useState("Minute"); // "Minute", "Hour", "Day"

  const PurchasePages = {
    Purchase: {
      indent_approval: { title: "Indent Approval" },
      purchase_order: { title: "Purchase Order" },
      delivery: { title: "Delivery" },
      receiving: { title: "Receiving" },
      payment_approval: { title: "Payment Approval" },
      payment: { title: "Payment" },
    },
  };

  const loadSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTatSettings();
      setSettings(data);
    } catch (err) {
      if (err.message && err.message.includes("row-level security")) {
        setError(
          "Database Error: New row violates Row-Level Security (RLS) policy. Please make sure to enable INSERT policy on 'purchase_tat_settings' table or seed the default data."
        );
      } else {
        setError("Failed to load TAT settings: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // When selected stage changes, populate form values from loaded settings
  useEffect(() => {
    if (selectedStageKey && settings.length > 0) {
      const currentSetting = settings.find(s => s.stage_key === selectedStageKey);
      if (currentSetting) {
        const totalMins = currentSetting.tat_minutes;
        // Determine the best unit for display
        if (totalMins > 0 && totalMins % 1440 === 0) {
          setUnit("Day");
          setInputValue(totalMins / 1440);
        } else if (totalMins > 0 && totalMins % 60 === 0) {
          setUnit("Hour");
          setInputValue(totalMins / 60);
        } else {
          setUnit("Minute");
          setInputValue(totalMins);
        }
      } else {
        setInputValue("");
        setUnit("Minute");
      }
    } else {
      setInputValue("");
      setUnit("Minute");
    }
  }, [selectedStageKey, settings]);

  // Calculate total minutes based on inputs
  const calculatedTotalMinutes = (() => {
    const val = parseInt(inputValue, 10);
    if (isNaN(val) || val < 0) return 0;
    if (unit === "Day") return val * 1440;
    if (unit === "Hour") return val * 60;
    return val;
  })();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedStageKey) return;

    const currentSetting = settings.find(s => s.stage_key === selectedStageKey);
    if (!currentSetting) {
      setError("Selected stage configuration not found in database.");
      return;
    }

    setError("");
    setSuccess("");
    try {
      await updateTatSetting(currentSetting.id, calculatedTotalMinutes, currentSetting.is_active, currentSetting.stage_key);
      setSuccess(`Successfully updated ${currentSetting.stage_name} TAT to ${formatMinutesToReadable(calculatedTotalMinutes)}!`);
      // Reload settings
      const data = await fetchTatSettings();
      setSettings(data);
    } catch (err) {
      setError("Failed to update TAT configuration: " + err.message);
    }
  };

  const pages = section ? PurchasePages[section] : {};

  return (
    <div className="bg-white rounded-3xl border border-blue-100 overflow-hidden shadow-sm p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Settings className="text-blue-600 animate-spin-slow" size={24} />
            TAT (Turnaround Time) Management
          </h2>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mt-1">
            Configure target times for purchase stages
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex flex-col gap-2 p-4 bg-red-50 border border-red-150 rounded-2xl text-xs text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle size={16} />
            {error}
          </div>
          {error.includes("row-level security") && (
            <div className="bg-white/50 p-3 rounded-xl border border-red-200 mt-2 font-mono text-[10px] whitespace-pre-wrap select-all">
              {`-- Run this SQL in your Supabase SQL Editor to seed the table & allow inserts:

create policy "Allow insert for everyone" on purchase_tat_settings for insert with check (true);

insert into purchase_tat_settings (stage_key, stage_name, tat_minutes, is_active) values
('indent_approval', 'Indent Approval', 20, true),
('purchase_order', 'Purchase Order', 30, true),
('delivery', 'Delivery', 60, true),
('receiving', 'Receiving', 20, true),
('payment_approval', 'Payment Approval', 15, true),
('payment', 'Payment', 10, true)
on conflict (stage_key) do nothing;`}
            </div>
          )}
        </div>
      )}

      {success && (
        <div className="mb-4 flex items-center gap-2 p-4 bg-green-50 border border-green-150 rounded-2xl text-xs font-semibold text-green-700">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Section Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Section</label>
              <select
                value={section}
                onChange={(e) => {
                  setSection(e.target.value);
                  setSelectedStageKey("");
                }}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="" disabled>Select Section</option>
                {Object.keys(PurchasePages).map((sectionName) => (
                  <option key={sectionName} value={sectionName}>
                    {sectionName}
                  </option>
                ))}
              </select>
            </div>

            {/* Page/Stage Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Page / Stage</label>
              <select
                value={selectedStageKey}
                onChange={(e) => setSelectedStageKey(e.target.value)}
                disabled={!section}
                className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
              >
                <option value="">-- Choose Stage --</option>
                {Object.entries(pages).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedStageKey && (
            <div className="bg-blue-50/20 border border-blue-50 rounded-2xl p-5 space-y-4 animate-fadeIn">
              <h3 className="text-sm font-black text-gray-800 border-b border-blue-50 pb-2">
                Configure TAT values for: <span className="text-blue-600">{pages[selectedStageKey]?.title}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* TAT Numeric Value */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time Duration</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Enter value"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="px-4 py-3 bg-white border border-gray-250 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                </div>

                {/* Unit Dropdown Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="px-4 py-3 bg-white border border-gray-250 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="Minute">Minute(s)</option>
                    <option value="Hour">Hour(s)</option>
                    <option value="Day">Day(s)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Calculation Output (e.g. 70 minutes -> 1 hour 10 minutes) */}
              {inputValue && (
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 bg-blue-50/40 px-4 py-3 rounded-2xl border border-blue-50/50">
                  <Clock size={15} />
                  <span>
                    Equivalent to: <strong>{formatMinutesToReadable(calculatedTotalMinutes)}</strong> ({calculatedTotalMinutes} minutes)
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 py-3 text-xs font-bold uppercase flex items-center gap-2 shadow-sm transition-all"
                >
                  <Save size={15} />
                  Save Configuration
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

export default TatView;