// src/redux/slice/inventorySlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  fetchInventoryDataApi,
  saveMaterialApi,
  deleteMaterialApi,
  postTransactionApi,
  createIndentsApi,
  updateIndentStatusApi,
  saveSettingsApi,
  saveListApi,
  saveUsersApi,
  logAuditApi,
  resetToDummyDataApi
} from '../api/inventoryApi';

export const fetchInventoryData = createAsyncThunk(
  'inventory/fetchData',
  async (_, thunkAPI) => {
    const response = await fetchInventoryDataApi();
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const saveMaterial = createAsyncThunk(
  'inventory/saveMaterial',
  async ({ material, currentUser }, thunkAPI) => {
    const response = await saveMaterialApi(material, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const deleteMaterial = createAsyncThunk(
  'inventory/deleteMaterial',
  async ({ sku, currentUser }, thunkAPI) => {
    const response = await deleteMaterialApi(sku, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const postTransaction = createAsyncThunk(
  'inventory/postTransaction',
  async ({ transaction, currentUser }, thunkAPI) => {
    const response = await postTransactionApi(transaction, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const createIndents = createAsyncThunk(
  'inventory/createIndents',
  async ({ items, requestedBy, department, currentUser }, thunkAPI) => {
    const response = await createIndentsApi(items, requestedBy, department, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const updateIndentStatus = createAsyncThunk(
  'inventory/updateIndentStatus',
  async ({ indentNo, status, currentUser }, thunkAPI) => {
    const response = await updateIndentStatusApi(indentNo, status, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const saveSettings = createAsyncThunk(
  'inventory/saveSettings',
  async ({ settings, currentUser }, thunkAPI) => {
    const response = await saveSettingsApi(settings, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const saveList = createAsyncThunk(
  'inventory/saveList',
  async ({ type, list, currentUser }, thunkAPI) => {
    const response = await saveListApi(type, list, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const saveUsers = createAsyncThunk(
  'inventory/saveUsers',
  async ({ users, currentUser }, thunkAPI) => {
    const response = await saveUsersApi(users, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const logAudit = createAsyncThunk(
  'inventory/logAudit',
  async ({ action, detail, currentUser }, thunkAPI) => {
    const response = await logAuditApi(action, detail, currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

export const resetToDummyData = createAsyncThunk(
  'inventory/resetToDummyData',
  async ({ currentUser }, thunkAPI) => {
    const response = await resetToDummyDataApi(currentUser);
    if (response.error) return thunkAPI.rejectWithValue(response.error);
    return response.data;
  }
);

const initialState = {
  materials: [],
  transactions: [],
  indents: [],
  units: [],
  locations: [],
  materialNames: [],
  settings: {
    pageSize: { master: 6, txn: 6, stock: 6 }
  },
  users: [],
  audit: [],
  loading: false,
  error: null
};

const handleFulfilled = (state, action) => {
  state.loading = false;
  state.error = null;
  if (action.payload) {
    state.materials = action.payload.materials || [];
    state.transactions = action.payload.transactions || [];
    state.indents = action.payload.indents || [];
    state.units = action.payload.units || [];
    state.locations = action.payload.locations || [];
    state.materialNames = action.payload.materialNames || [];
    state.settings = action.payload.settings || { pageSize: { master: 6, txn: 6, stock: 6 } };
    state.users = action.payload.users || [];
    state.audit = action.payload.audit || [];
  }
};

const handlePending = (state) => {
  state.loading = true;
  state.error = null;
};

const handleRejected = (state, action) => {
  state.loading = false;
  state.error = action.payload || 'An error occurred';
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch data
      .addCase(fetchInventoryData.pending, handlePending)
      .addCase(fetchInventoryData.fulfilled, handleFulfilled)
      .addCase(fetchInventoryData.rejected, handleRejected)
      // Save material
      .addCase(saveMaterial.pending, handlePending)
      .addCase(saveMaterial.fulfilled, handleFulfilled)
      .addCase(saveMaterial.rejected, handleRejected)
      // Delete material
      .addCase(deleteMaterial.pending, handlePending)
      .addCase(deleteMaterial.fulfilled, handleFulfilled)
      .addCase(deleteMaterial.rejected, handleRejected)
      // Post transaction
      .addCase(postTransaction.pending, handlePending)
      .addCase(postTransaction.fulfilled, handleFulfilled)
      .addCase(postTransaction.rejected, handleRejected)
      // Create indents
      .addCase(createIndents.pending, handlePending)
      .addCase(createIndents.fulfilled, handleFulfilled)
      .addCase(createIndents.rejected, handleRejected)
      // Update indent status
      .addCase(updateIndentStatus.pending, handlePending)
      .addCase(updateIndentStatus.fulfilled, handleFulfilled)
      .addCase(updateIndentStatus.rejected, handleRejected)
      // Save settings
      .addCase(saveSettings.pending, handlePending)
      .addCase(saveSettings.fulfilled, handleFulfilled)
      .addCase(saveSettings.rejected, handleRejected)
      // Save custom lists
      .addCase(saveList.pending, handlePending)
      .addCase(saveList.fulfilled, handleFulfilled)
      .addCase(saveList.rejected, handleRejected)
      // Save users
      .addCase(saveUsers.pending, handlePending)
      .addCase(saveUsers.fulfilled, handleFulfilled)
      .addCase(saveUsers.rejected, handleRejected)
      // Log audit
      .addCase(logAudit.pending, handlePending)
      .addCase(logAudit.fulfilled, handleFulfilled)
      .addCase(logAudit.rejected, handleRejected)
      // Reset to dummy data
      .addCase(resetToDummyData.pending, handlePending)
      .addCase(resetToDummyData.fulfilled, handleFulfilled)
      .addCase(resetToDummyData.rejected, handleRejected);
  }
});

export default inventorySlice.reducer;
