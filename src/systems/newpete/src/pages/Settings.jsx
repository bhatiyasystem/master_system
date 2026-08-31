import React, { useState } from 'react';
import { useMagicToast } from '@/context/MagicToastContext';
import { Trash2, Edit2, Plus } from 'lucide-react';
import { getSettings, saveSettings } from '../utils/storageManager';

export default function Settings() {
  const { showToast } = useMagicToast();
  const toast = {
    error: (msg) => showToast(msg, 'error'),
    success: (msg) => showToast(msg, 'success')
  };
  const [activeTab, setActiveTab] = useState('groupHeads'); // 'groupHeads', 'paymentModes'
  const [settings, setSettings] = useState(getSettings());

  // Group Heads State
  const [newGroupHead, setNewGroupHead] = useState('');
  const [editingGroupHeadId, setEditingGroupHeadId] = useState(null);

  // Payment Modes State
  const [newPaymentMode, setNewPaymentMode] = useState('');
  const [editingPaymentModeId, setEditingPaymentModeId] = useState(null);

  // ===== GROUP HEADS =====
  const handleAddGroupHead = () => {
    if (!newGroupHead.trim()) {
      toast.error('Please enter group head name');
      return;
    }

    const updatedSettings = {
      ...settings,
      groupHeads: [...settings.groupHeads, newGroupHead.trim()]
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    setNewGroupHead('');
    toast.success('Group head added successfully!');
  };

  const handleDeleteGroupHead = (index) => {
    const updatedSettings = {
      ...settings,
      groupHeads: settings.groupHeads.filter((_, i) => i !== index)
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    toast.success('Group head deleted!');
  };

  // ===== PAYMENT MODES =====
  const handleAddPaymentMode = () => {
    if (!newPaymentMode.trim()) {
      toast.error('Please enter payment mode');
      return;
    }

    const updatedSettings = {
      ...settings,
      paymentModes: [...settings.paymentModes, newPaymentMode.trim()]
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    setNewPaymentMode('');
    toast.success('Payment mode added successfully!');
  };

  const handleDeletePaymentMode = (index) => {
    const updatedSettings = {
      ...settings,
      paymentModes: settings.paymentModes.filter((_, i) => i !== index)
    };

    setSettings(updatedSettings);
    saveSettings(updatedSettings);
    toast.success('Payment mode deleted!');
  };

  return (
    <div className="p-6 space-y-6">


      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('groupHeads')}
            className={`py-3 px-4 font-medium border-b-2 transition ${activeTab === 'groupHeads'
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            Group Heads
          </button>
          <button
            onClick={() => setActiveTab('paymentModes')}
            className={`py-3 px-4 font-medium border-b-2 transition ${activeTab === 'paymentModes'
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
          >
            Payment Modes
          </button>
        </div>
      </div>

      {/* GROUP HEADS TAB */}
      {activeTab === 'groupHeads' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Manage Group Heads</h2>

          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newGroupHead}
              onChange={(e) => setNewGroupHead(e.target.value)}
              placeholder="Enter group head name"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onKeyPress={(e) => e.key === 'Enter' && handleAddGroupHead()}
            />
            <button
              onClick={handleAddGroupHead}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <Plus size={20} /> Add
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.groupHeads.map((head, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <span className="font-medium text-gray-900">{head}</span>
                <button
                  onClick={() => handleDeleteGroupHead(idx)}
                  className="text-red-600 hover:text-red-800 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          {settings.groupHeads.length === 0 && (
            <p className="text-center text-gray-500 py-8">No group heads added yet.</p>
          )}
        </div>
      )}

      {/* PAYMENT MODES TAB */}
      {activeTab === 'paymentModes' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Manage Payment Modes</h2>

          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={newPaymentMode}
              onChange={(e) => setNewPaymentMode(e.target.value)}
              placeholder="Enter payment mode"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              onKeyPress={(e) => e.key === 'Enter' && handleAddPaymentMode()}
            />
            <button
              onClick={handleAddPaymentMode}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              <Plus size={20} /> Add
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {settings.paymentModes.map((mode, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <span className="font-medium text-gray-900">{mode}</span>
                <button
                  onClick={() => handleDeletePaymentMode(idx)}
                  className="text-red-600 hover:text-red-800 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          {settings.paymentModes.length === 0 && (
            <p className="text-center text-gray-500 py-8">No payment modes added yet.</p>
          )}
        </div>
      )}


    </div>
  );
}
