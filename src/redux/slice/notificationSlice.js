import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { fetchNotificationsApi, createNotificationApi, deleteNotificationApi, markAsReadApi } from "../api/notificationApi";

export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async ({ role, userId }, { rejectWithValue }) => {
    try {
      const data = await fetchNotificationsApi(role, userId);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const markAsRead = createAsyncThunk(
  "notifications/markAsRead",
  async ({ notificationId, userId }, { rejectWithValue }) => {
    try {
      await markAsReadApi(notificationId, userId);
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createNotification = createAsyncThunk(
  "notifications/createNotification",
  async (notificationData, { rejectWithValue }) => {
    try {
      const data = await createNotificationApi(notificationData);
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const removeNotification = createAsyncThunk(
  "notifications/deleteNotification",
  async (id, { rejectWithValue }) => {
    try {
      await deleteNotificationApi(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const NOTIF_CACHE_KEY = 'notificationsCache';

const getNotifCacheKey = () => {
  const user = (localStorage.getItem('user-name') || 'guest').toLowerCase();
  return `${NOTIF_CACHE_KEY}_${user}`;
};

const readNotifCache = () => {
  try {
    const key = getNotifCacheKey();
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return [];
};

const writeNotifCache = (list) => {
  try {
    const key = getNotifCacheKey();
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    list: readNotifCache(),
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
        writeNotifCache(action.payload);
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createNotification.fulfilled, (state, action) => {
        state.list.unshift(action.payload);
        writeNotifCache(state.list);
      })
      .addCase(removeNotification.fulfilled, (state, action) => {
        state.list = state.list.filter((n) => n.id !== action.payload);
        writeNotifCache(state.list);
      })
      .addCase(markAsRead.fulfilled, (state, action) => {
        const index = state.list.findIndex(n => n.id === action.payload);
        if (index !== -1) {
          state.list[index].isRead = true;
          writeNotifCache(state.list);
        }
      });
  },
});

export default notificationSlice.reducer;
