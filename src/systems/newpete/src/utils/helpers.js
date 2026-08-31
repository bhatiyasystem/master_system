// Helper utilities for Petty Cash System

// Generate unique serial numbers (SN-001, SN-002, etc.)
export const generateSerialNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `SN-${String(timestamp).slice(-6)}${String(random).padStart(3, '0')}`;
};

// Generate UUID
export const generateId = () => {
  return `ID-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Format date to DD/MM/YYYY
export const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Format date to YYYY-MM-DD for input
export const formatDateForInput = (dateStr) => {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get today's date in YYYY-MM-DD format
export const getTodayDate = () => {
  const today = new Date();
  return formatDateForInput(today);
};

// Get today's date in DD/MM/YYYY format
export const getTodayDateFormatted = () => {
  return formatDate(new Date());
};

// Calculate user balance
export const calculateBalance = (personName, credits, expenses) => {
  const creditAmount = credits
    .filter(c => c.personName === personName)
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
  
  const expenseAmount = expenses
    .filter(e => e.personName === personName && e.status === 'APPROVED')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  
  return creditAmount - expenseAmount;
};

// Get total balance for all
export const getTotalBalance = (credits, expenses) => {
  const totalCredit = credits.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
  const totalExpense = expenses
    .filter(e => e.status === 'APPROVED')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  
  return totalCredit - totalExpense;
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount);
};

// Validate date range
export const isDateInRange = (date, fromDate, toDate) => {
  const checkDate = new Date(date);
  const startDate = fromDate ? new Date(fromDate) : new Date('1900-01-01');
  const endDate = toDate ? new Date(toDate) : new Date('2099-12-31');
  
  return checkDate >= startDate && checkDate <= endDate;
};

// Base64 image conversion
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// Get file name from base64
export const getFileNameFromBase64 = (base64String) => {
  const arr = base64String.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  
  return new File([u8arr], `image-${Date.now()}.${mime.split('/')[1]}`, {
    type: mime
  });
};

// Calculate pending count
export const getPendingCount = (expenses) => {
  return expenses.filter(e => e.status === 'PENDING').length;
};

// Get today's expenses
export const getTodaysExpenses = (expenses) => {
  const today = getTodayDate();
  return expenses.filter(e => e.date === today && e.status === 'APPROVED')
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
};

export const getTodaysCredits = (credits) => {
  const today = getTodayDate();
  return credits.filter(c => c.date === today)
    .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
};

// Ledger entry creator
export const createLedgerEntry = (id, personName, type, amount, date, referenceId, balanceAfter) => {
  return {
    id: generateId(),
    personName,
    type, // CREDIT or EXPENSE
    amount: parseFloat(amount),
    date,
    referenceId,
    balanceAfter: parseFloat(balanceAfter),
    timestamp: new Date().toISOString()
  };
};
