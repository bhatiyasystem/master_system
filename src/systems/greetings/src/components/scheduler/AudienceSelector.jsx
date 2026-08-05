import React, { useEffect, useState, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Users, ListChecks, Upload, Download, Search, CheckSquare, Square, UserCog, Loader2, X,
} from 'lucide-react';
import supabase from '../../../../../SupabaseClient';
import {
  fetchContacts, fetchContactsCount, downloadContactsCsvTemplate,
  fetchSystemUsers, upsertUsersAsContacts,
} from '../../services/festivalSchedulerService';

const TABS = [
  { id: 'all', label: 'All Clients', icon: Users },
  { id: 'selected', label: 'Selected Clients', icon: ListChecks },
  { id: 'csv', label: 'Upload CSV', icon: Upload },
];

// Column-name aliases so CSV exports from other systems (e.g. a `users` table
// export with `user_name`/`number`/`email_id`) work without the admin having
// to rename headers first. Matched case-insensitively, in priority order.
const NAME_ALIASES = ['name', 'full_name', 'client_name', 'contact_name', 'customer_name', 'user_name'];
const PHONE_ALIASES = ['phone_number', 'phone', 'mobile_number', 'mobile', 'contact_number', 'whatsapp_number', 'whatsapp', 'number'];
const EMAIL_ALIASES = ['email', 'email_address', 'email_id', 'mail'];

// Never carry these into extra_fields — CSV exports of internal tables (like
// a `users` export) can include password hashes/tokens, which have no
// business being copied into festival_contacts.
const BLOCKED_COLUMNS = ['password', 'password_hash', 'pwd', 'token', 'access_token', 'api_key', 'secret'];

// Finds the first alias present in a CSV row (case/whitespace-insensitive)
// and returns both the original header key and its value.
const findAliasField = (row, aliases) => {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const key = keys.find((k) => k.trim().toLowerCase() === alias);
    if (key && String(row[key] ?? '').trim()) return { key, value: row[key] };
  }
  return null;
};

const parseCsvRows = (data) => {
  const rows = [];
  (data || []).forEach((r) => {
    const phoneField = findAliasField(r, PHONE_ALIASES);
    if (!phoneField) return;

    const nameField = findAliasField(r, NAME_ALIASES);
    const emailField = findAliasField(r, EMAIL_ALIASES);
    const usedKeys = new Set([nameField?.key, phoneField.key, emailField?.key].filter(Boolean));

    const extraFields = {};
    Object.entries(r).forEach(([key, value]) => {
      if (usedKeys.has(key)) return;
      if (BLOCKED_COLUMNS.includes(key.trim().toLowerCase())) return;
      if (value === '' || value == null) return;
      extraFields[key] = value;
    });

    rows.push({
      name: nameField?.value || 'Unknown',
      phone_number: String(phoneField.value).replace(/\D/g, ''),
      email: emailField?.value || null,
      extra_fields: extraFields,
    });
  });
  return rows;
};

export default function AudienceSelector({
  audienceType,
  onAudienceTypeChange,
  selectedContactIds,
  onSelectedContactIdsChange,
  csvContacts,
  onCsvContactsChange,
}) {
  const [allCount, setAllCount] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [csvError, setCsvError] = useState(null);
  const [csvFileName, setCsvFileName] = useState(null);

  // System users (current users of the app) — browsed live from `users`.
  const [systemUsers, setSystemUsers] = useState([]);
  const [systemUserSearch, setSystemUserSearch] = useState('');
  const [systemUsersLoading, setSystemUsersLoading] = useState(false);
  const [userIdToContactId, setUserIdToContactId] = useState({});
  const [pendingUserId, setPendingUserId] = useState(null);
  const [selectingAllUsers, setSelectingAllUsers] = useState(false);

  useEffect(() => {
    fetchContactsCount().then(setAllCount).catch(() => setAllCount(0));
  }, []);

  const loadContacts = useCallback(async (term) => {
    try {
      const data = await fetchContacts({ search: term });
      setContacts(data);
    } catch {
      setContacts([]);
    }
  }, []);

  useEffect(() => {
    if (audienceType === 'selected') loadContacts(search);
  }, [audienceType, search, loadContacts]);

  const loadSystemUsers = useCallback(async (term) => {
    setSystemUsersLoading(true);
    try {
      const data = await fetchSystemUsers({ search: term });
      setSystemUsers(data);
    } catch {
      setSystemUsers([]);
    } finally {
      setSystemUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (audienceType === 'selected') loadSystemUsers(systemUserSearch);
  }, [audienceType, systemUserSearch, loadSystemUsers]);

  // Reconcile which system users are already part of the current selection
  // (e.g. when editing an existing "selected" schedule) so their checkboxes
  // show as checked without needing to re-upsert them.
  useEffect(() => {
    if (!selectedContactIds?.length) return;
    supabase
      .from('festival_contacts')
      .select('id, extra_fields')
      .in('id', selectedContactIds)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach((c) => {
          if (c.extra_fields?.source === 'default_user' && c.extra_fields?.user_id != null) {
            map[c.extra_fields.user_id] = c.id;
          }
        });
        setUserIdToContactId((prev) => ({ ...prev, ...map }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleContact = (id) => {
    const set = new Set(selectedContactIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    onSelectedContactIdsChange(Array.from(set));
  };

  // Selecting a system user upserts it into festival_contacts on demand (only
  // for that user), then adds/removes its contact id from the selection.
  const toggleSystemUser = async (user) => {
    let contactId = userIdToContactId[user.id];
    if (!contactId) {
      setPendingUserId(user.id);
      try {
        const [row] = await upsertUsersAsContacts([user]);
        contactId = row?.id;
        if (contactId) setUserIdToContactId((prev) => ({ ...prev, [user.id]: contactId }));
      } finally {
        setPendingUserId(null);
      }
    }
    if (!contactId) return;

    const isSelected = selectedContactIds.includes(contactId);
    onSelectedContactIdsChange(
      isSelected
        ? selectedContactIds.filter((id) => id !== contactId)
        : [...selectedContactIds, contactId]
    );
  };

  const allSystemUsersSelected = systemUsers.length > 0 &&
    systemUsers.every((u) => userIdToContactId[u.id] && selectedContactIds.includes(userIdToContactId[u.id]));

  const handleSelectAllSystemUsers = async () => {
    setSelectingAllUsers(true);
    try {
      const needingUpsert = systemUsers.filter((u) => !userIdToContactId[u.id]);
      let map = userIdToContactId;
      if (needingUpsert.length) {
        const rows = await upsertUsersAsContacts(needingUpsert);
        const next = { ...map };
        rows.forEach((row) => {
          const match = needingUpsert.find(
            (u) => String(u.number).replace(/\D/g, '') === row.phone_number
          );
          if (match) next[match.id] = row.id;
        });
        map = next;
        setUserIdToContactId(next);
      }
      const allIds = systemUsers.map((u) => map[u.id]).filter(Boolean);
      onSelectedContactIdsChange(Array.from(new Set([...selectedContactIds, ...allIds])));
    } finally {
      setSelectingAllUsers(false);
    }
  };

  const handleClearAllSystemUsers = () => {
    const systemContactIds = new Set(systemUsers.map((u) => userIdToContactId[u.id]).filter(Boolean));
    onSelectedContactIdsChange(selectedContactIds.filter((id) => !systemContactIds.has(id)));
  };

  const handleCsvFile = (file) => {
    if (!file) return;
    setCsvError(null);
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        const rows = parseCsvRows(results.data);
        if (!rows.length) {
          setCsvError(
            'No valid rows found — make sure the CSV has a phone number column ' +
            '(e.g. phone_number, phone, mobile, or number).'
          );
          return;
        }
        onCsvContactsChange(rows);
      },
      error: (err) => setCsvError(err.message || 'Failed to parse CSV'),
    });
  };

  const removeCsvRow = (index) => {
    onCsvContactsChange(csvContacts.filter((_, i) => i !== index));
  };

  const clearCsvContacts = () => {
    onCsvContactsChange([]);
    setCsvFileName(null);
    setCsvError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onAudienceTypeChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              audienceType === id
                ? 'bg-violet-600 text-white font-semibold shadow-sm'
                : 'text-gray-500 hover:bg-white/70 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {audienceType === 'all' && (
        <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-4 py-6 text-center">
          <p className="text-2xl font-bold text-gray-800">{allCount}</p>
          <p className="text-xs text-gray-500 mt-1">active client(s) will receive this message</p>
        </div>
      )}

      {audienceType === 'selected' && (
        <div className="space-y-5">
          {/* System users — current users of the app */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <UserCog className="w-3.5 h-3.5" /> System Users
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSystemUsers}
                  disabled={selectingAllUsers || systemUsers.length === 0 || allSystemUsersSelected}
                  className="text-xs font-medium text-violet-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                >
                  {selectingAllUsers ? 'Selecting…' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleClearAllSystemUsers}
                  className="text-xs font-medium text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={systemUserSearch}
                onChange={(e) => setSystemUserSearch(e.target.value)}
                placeholder="Search system users by name…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {systemUsersLoading ? (
                <p className="text-xs text-gray-400 px-3 py-4 text-center">Loading users…</p>
              ) : systemUsers.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-4 text-center">No system users found.</p>
              ) : (
                systemUsers.map((u) => {
                  const contactId = userIdToContactId[u.id];
                  const checked = Boolean(contactId && selectedContactIds.includes(contactId));
                  const isPending = pendingUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleSystemUser(u)}
                      disabled={isPending}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left disabled:opacity-60"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
                      ) : checked ? (
                        <CheckSquare className="w-4 h-4 text-violet-500 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-300 shrink-0" />
                      )}
                      <span className="font-medium text-gray-800">{u.user_name}</span>
                      <span className="text-gray-400 text-xs ml-auto">{u.number}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Other contacts — anyone already uploaded via CSV / previously added */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Other Contacts</span>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
              />
            </div>
            <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {contacts.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-4 text-center">No contacts found.</p>
              )}
              {contacts.map((c) => {
                const checked = selectedContactIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleContact(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-violet-500 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300 shrink-0" />
                    )}
                    <span className="font-medium text-gray-800">{c.name}</span>
                    <span className="text-gray-400 text-xs ml-auto">{c.phone_number}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-gray-500">{selectedContactIds.length} client(s) selected in total</p>
        </div>
      )}

      {audienceType === 'csv' && (
        <div className="space-y-2">
          <button
            onClick={downloadContactsCsvTemplate}
            className="flex items-center gap-1.5 text-xs text-violet-600 hover:underline"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV template
          </button>
          <label className="flex items-center gap-3 border border-dashed border-violet-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-violet-50/50 transition-colors">
            <Upload className="w-5 h-5 text-violet-400" />
            <span className="text-sm text-gray-600 truncate">
              {csvFileName ? csvFileName : 'Choose a CSV file (name, phone_number, email, …)'}
            </span>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => handleCsvFile(e.target.files?.[0])} />
          </label>
          <p className="text-[11px] text-gray-400">
            Column names are matched flexibly — <code>number</code>, <code>mobile</code>, or <code>phone</code> all work
            for the phone column, and <code>user_name</code>/<code>email_id</code> are recognized too. Any other
            column (e.g. <code>business_name</code>) is kept and usable in the template's variable mapper. Columns
            like <code>password</code> are always ignored for safety.
          </p>
          {csvError && <p className="text-xs text-red-500">{csvError}</p>}

          {csvContacts?.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-green-600 font-medium">{csvContacts.length} row(s) parsed successfully — preview below</p>
                <button
                  type="button"
                  onClick={clearCsvContacts}
                  className="text-xs font-medium text-gray-400 hover:text-red-600"
                >
                  Clear all
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">Phone</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {csvContacts.map((c, i) => (
                      <tr key={`${c.phone_number}-${i}`} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 text-gray-800 font-medium whitespace-nowrap">{c.name}</td>
                        <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{c.phone_number}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeCsvRow(i)}
                            className="text-gray-300 hover:text-red-500"
                            title="Remove this row"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
