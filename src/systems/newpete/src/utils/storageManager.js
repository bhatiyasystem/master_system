import supabase from '@/SupabaseClient';

const STORAGE_KEYS = {
  USERS: 'pcb_users',
  CREDITS: 'pcb_credits',
  EXPENSES: 'pcb_expenses',
  LEDGER: 'pcb_ledger',
  SETTINGS: 'pcb_settings',
  AUTH_USER: 'pcb_authUser'
};

const DEFAULT_SETTINGS = {
  groupHeads: ['IT', 'HR', 'Finance', 'Operations', 'Marketing'],
  paymentModes: ['Cash', 'Cheque', 'Bank Transfer', 'Online Payment'],
  lastSerialNumber: 0
};

// Initialize storage from Supabase
export const initializeStorage = async () => {
  try {
    // 1. Sync Settings
    const { data: settingsData } = await supabase.from('newpete_settings').select('*');
    let groupHeads = DEFAULT_SETTINGS.groupHeads;
    let paymentModes = DEFAULT_SETTINGS.paymentModes;
    let lastSerialNumber = DEFAULT_SETTINGS.lastSerialNumber;

    if (settingsData && settingsData.length > 0) {
      const gh = settingsData.find(s => s.setting_name === 'groupHeads');
      if (gh && gh.setting_value) groupHeads = JSON.parse(gh.setting_value);
      
      const pm = settingsData.find(s => s.setting_name === 'paymentModes');
      if (pm && pm.setting_value) paymentModes = JSON.parse(pm.setting_value);
      
      const lsn = settingsData.find(s => s.setting_name === 'lastSerialNumber');
      if (lsn && lsn.setting_value) lastSerialNumber = parseInt(lsn.setting_value) || 0;
    } else {
      // Seed default settings to Supabase
      await supabase.from('newpete_settings').upsert([
        { setting_name: 'groupHeads', setting_value: JSON.stringify(groupHeads) },
        { setting_name: 'paymentModes', setting_value: JSON.stringify(paymentModes) },
        { setting_name: 'lastSerialNumber', setting_value: String(lastSerialNumber) }
      ]);
    }
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ groupHeads, paymentModes, lastSerialNumber }));

    // 2. Sync Credits
    const { data: creditsData } = await supabase.from('newpete_credits').select('*');
    if (creditsData) {
      const credits = creditsData.map(c => ({
        id: c.id,
        sn: c.sn,
        personName: c.person_name,
        date: c.date,
        amount: parseFloat(c.amount || 0),
        paymentMode: c.payment_mode,
        image: c.image || '',
        remarks: c.remarks || '',
        status: c.status,
        timestamp: c.timestamp
      }));
      localStorage.setItem(STORAGE_KEYS.CREDITS, JSON.stringify(credits));
    }

    // 3. Sync Expenses
    const { data: expensesData } = await supabase.from('newpete_expenses').select('*');
    if (expensesData) {
      const expenses = expensesData.map(e => ({
        id: e.id,
        sn: e.sn,
        personName: e.person_name,
        date: e.date,
        amount: parseFloat(e.amount || 0),
        paymentMode: e.payment_mode,
        groupHead: e.group_head,
        image: e.image || '',
        remarks: e.remarks || '',
        status: e.status,
        timestamp: e.timestamp
      }));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    }

    // 4. Sync Ledger
    const { data: ledgerData } = await supabase.from('newpete_ledger').select('*');
    if (ledgerData) {
      const ledger = ledgerData.map(l => ({
        id: l.id,
        personName: l.person_name,
        type: l.type,
        amount: parseFloat(l.amount || 0),
        date: l.date,
        referenceId: l.reference_id,
        balance: parseFloat(l.balance || 0),
        timestamp: l.timestamp
      }));
      localStorage.setItem(STORAGE_KEYS.LEDGER, JSON.stringify(ledger));
    }
  } catch (err) {
    console.error("Failed to sync newpete storage with Supabase:", err);
  }
};

// Get data from storage
export const getFromStorage = (key) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};

// Save data to storage
export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Credits operations
export const getCredits = () => {
  return getFromStorage(STORAGE_KEYS.CREDITS) || [];
};

export const saveCredits = (credits) => {
  saveToStorage(STORAGE_KEYS.CREDITS, credits);
};

export const saveCredit = (credit) => {
  const credits = getCredits();
  credits.push(credit);
  saveCredits(credits);

  // Write asynchronously to Supabase
  supabase.from('newpete_credits').insert([{
    id: credit.id,
    sn: credit.sn,
    person_name: credit.personName,
    date: credit.date,
    amount: credit.amount,
    payment_mode: credit.paymentMode,
    image: credit.image || '',
    remarks: credit.remarks || '',
    status: credit.status,
    timestamp: credit.timestamp
  }]).then(({ error }) => { if (error) console.error("Error saving credit to Supabase:", error); });
};

export const getCreditById = (id) => {
  const credits = getCredits();
  return credits.find(c => c.id === id);
};

export const updateCredit = (updated) => {
  const credits = getCredits();
  const index = credits.findIndex(c => c.id === updated.id);
  if (index !== -1) {
    credits[index] = updated;
    saveCredits(credits);

    // Update asynchronously in Supabase
    supabase.from('newpete_credits').update({
      sn: updated.sn,
      person_name: updated.personName,
      date: updated.date,
      amount: updated.amount,
      payment_mode: updated.paymentMode,
      image: updated.image || '',
      remarks: updated.remarks || '',
      status: updated.status,
      timestamp: updated.timestamp
    }).eq('id', updated.id).then(({ error }) => { if (error) console.error("Error updating credit in Supabase:", error); });
  }
};

// Expenses operations
export const getExpenses = () => {
  return getFromStorage(STORAGE_KEYS.EXPENSES) || [];
};

export const saveExpenses = (expenses) => {
  saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
};

export const saveExpense = (expense) => {
  const expenses = getExpenses();
  expenses.push(expense);
  saveExpenses(expenses);

  // Write asynchronously to Supabase
  supabase.from('newpete_expenses').insert([{
    id: expense.id,
    sn: expense.sn,
    person_name: expense.personName,
    date: expense.date,
    amount: expense.amount,
    payment_mode: expense.paymentMode,
    group_head: expense.groupHead,
    image: expense.image || '',
    remarks: expense.remarks || '',
    status: expense.status,
    timestamp: expense.timestamp
  }]).then(({ error }) => { if (error) console.error("Error saving expense to Supabase:", error); });
};

export const getExpenseById = (id) => {
  const expenses = getExpenses();
  return expenses.find(e => e.id === id);
};

export const updateExpense = (updated) => {
  const expenses = getExpenses();
  const index = expenses.findIndex(e => e.id === updated.id);
  if (index !== -1) {
    expenses[index] = updated;
    saveExpenses(expenses);

    // Update asynchronously in Supabase
    supabase.from('newpete_expenses').update({
      sn: updated.sn,
      person_name: updated.personName,
      date: updated.date,
      amount: updated.amount,
      payment_mode: updated.paymentMode,
      group_head: updated.groupHead,
      image: updated.image || '',
      remarks: updated.remarks || '',
      status: updated.status,
      timestamp: updated.timestamp
    }).eq('id', updated.id).then(({ error }) => { if (error) console.error("Error updating expense in Supabase:", error); });
  }
};

// Ledger operations
export const getLedger = () => getFromStorage(STORAGE_KEYS.LEDGER) || [];

export const saveLedgers = (ledger) => {
  saveToStorage(STORAGE_KEYS.LEDGER, ledger);
};

export const saveLedger = (entry) => {
  const ledger = getLedger();
  ledger.push(entry);
  saveLedgers(ledger);

  // Write asynchronously to Supabase
  supabase.from('newpete_ledger').insert([{
    id: entry.id,
    person_name: entry.personName,
    type: entry.type,
    amount: entry.amount,
    date: entry.date,
    reference_id: entry.referenceId,
    balance: entry.balanceAfter !== undefined ? entry.balanceAfter : (entry.balance || 0),
    timestamp: entry.timestamp
  }]).then(({ error }) => { if (error) console.error("Error saving ledger entry to Supabase:", error); });
};
export const deleteLedgerEntryByReference = (referenceId) => {
  const ledger = getLedger();
  const filtered = ledger.filter(l => l.referenceId !== referenceId);
  saveLedgers(filtered);

  // Write asynchronously to Supabase
  supabase.from('newpete_ledger')
    .delete()
    .eq('reference_id', referenceId)
    .then(({ error }) => { if (error) console.error("Error deleting ledger entry from Supabase:", error); });
};

// Settings operations
export const getSettings = () => getFromStorage(STORAGE_KEYS.SETTINGS) || DEFAULT_SETTINGS;

export const saveSettings = (settings) => {
  saveToStorage(STORAGE_KEYS.SETTINGS, settings);

  // Write asynchronously to Supabase
  supabase.from('newpete_settings').upsert([
    { setting_name: 'groupHeads', setting_value: JSON.stringify(settings.groupHeads) },
    { setting_name: 'paymentModes', setting_value: JSON.stringify(settings.paymentModes) },
    { setting_name: 'lastSerialNumber', setting_value: String(settings.lastSerialNumber) }
  ]).then(({ error }) => { if (error) console.error("Error saving settings to Supabase:", error); });
};

export const getUsers = () => [];
export const saveUsers = () => {};

export { STORAGE_KEYS };
