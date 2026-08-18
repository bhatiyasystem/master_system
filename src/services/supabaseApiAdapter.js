import masterSupabase from '../SupabaseClient';
import hrSupabase from '../systems/HR_fms/src/services/supabaseHRClient';

const SHEET_TABLE_MAP = {
  'JOINING': { client: hrSupabase, table: 'employees', altTable: 'hr_joining' },
  'LEAVING': { client: hrSupabase, table: 'employees', altTable: 'leaving_requests' },
  'INDENT': { client: hrSupabase, table: 'employees', altTable: 'indents' },
  'ENQUIRY': { client: hrSupabase, table: 'employees', altTable: 'enquiries' },
  'Follow - Up': { client: hrSupabase, table: 'employees', altTable: 'follow_ups' },
  'Leave Management': { client: hrSupabase, table: 'employees', altTable: 'leave_requests' },
  'CompanyCalendar': { client: hrSupabase, table: 'company_calendar', altTable: 'employees' },
  'Report Daily': { client: hrSupabase, table: 'attendance_monthly', altTable: 'employees' },
  'Data': { client: hrSupabase, table: 'attendance_monthly', altTable: 'employees' },
  'STORE': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'COO': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'JOCKEY': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'SERVICE': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'SLAG CRUSHER': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'HR': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'For Whatsapp': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'Records': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'For Records': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'Archived': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'Department Score Graph': { client: masterSupabase, table: 'checklist', altTable: 'users' },
  'Master': { client: masterSupabase, table: 'users' },
};

const SHEET_HEADERS = {
  'INDENT': [
    'Timestamp', 'Indent Number', 'Post', 'Gender', 'Prefer',
    'Number Of Posts', 'Completion Date', 'Social Site', 'Status',
    'Planned 2', 'Actual 2', 'Reminders', 'Remarks'
  ],
  'ENQUIRY': [
    'Timestamp', 'Indent Number', 'Candidate Enquiry Number', 'Applying For the Post',
    'Candidate Name', 'DCB', 'Candidate Phone Number', 'Candidate Email',
    'Previous Company Name', 'Job Experience', 'Last Salary', 'Previous Position',
    'Reason For Leaving', 'Marital Status', 'Last Employer Mobile', 'Candidate Photo',
    'Candidate Resume', 'Reference By', 'Present Address', 'Aadhar No'
  ],
  'JOINING': [
    'Timestamp', 'Employee ID', 'Name', 'Father Name', 'Mobile No.',
    'Family Mobile No.', 'Personal Email-Id', 'Current Address', 'Permanent Address',
    'Aadhar Card No.', 'PAN Card No.', 'Bank Name', 'Account No.', 'IFSC Code',
    'Branch', 'DOB', 'Designation', 'Department', 'Date of Joining', 'Status', 'Photo'
  ],
  'LEAVING': [
    'Timestamp', 'Employee ID', 'Name', 'Department', 'Designation',
    'Reason for Leaving', 'Notice Period Date', 'Last Working Date', 'Status',
    'Planned 1', 'Actual 1', 'Planned 2', 'Actual 2'
  ],
  'Follow - Up': [
    'Timestamp', 'Indent Number', 'Candidate Enquiry Number', 'Candidate Name',
    'Phone Number', 'Post', 'Follow Up Date', 'Remarks', 'Status', 'Planned 1', 'Actual 1'
  ],
  'Leave Management': [
    'Timestamp', 'Employee ID', 'Name', 'Department', 'Leave Type',
    'From Date', 'To Date', 'Total Days', 'Reason', 'Status', 'Planned 1', 'Actual 1'
  ],
  'CompanyCalendar': [
    'Timestamp', 'Title', 'Date', 'Type', 'Description'
  ]
};

function formatAsSheet2DMatrix(sheetName, rawData) {
  if (!Array.isArray(rawData)) return [];
  if (rawData.length > 0 && Array.isArray(rawData[0])) {
    return rawData;
  }

  let headers = SHEET_HEADERS[sheetName];
  if (!headers) {
    const keySet = new Set();
    rawData.forEach(item => {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(k => keySet.add(k));
      }
    });
    headers = Array.from(keySet);
    if (headers.length === 0) {
      headers = ['Timestamp', 'ID', 'Name', 'Status'];
    }
  }

  const getValue = (obj, header) => {
    if (!obj || typeof obj !== 'object') return '';
    let val;
    if (obj[header] !== undefined) {
      val = obj[header];
    } else {
      const normHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      val = '';
      for (const [key, v] of Object.entries(obj)) {
        const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normKey === normHeader) { val = v !== null && v !== undefined ? v : ''; break; }
      }
    }
    // Ensure we never put a plain object into a cell (React cannot render objects as children)
    if (val !== null && val !== undefined && typeof val === 'object') {
      return JSON.stringify(val);
    }
    return val !== null && val !== undefined ? val : '';
  };

  const matrix = [
    [], [], [], [], [],
    headers
  ];

  rawData.forEach(record => {
    const row = headers.map(hdr => getValue(record, hdr));
    matrix.push(row);
  });

  return matrix;
}

/**
 * Fetch sheet records from Supabase, returning a fetch-compatible response object.
 */
export async function supabaseFetchSheet(sheetName, params = {}) {
  const config = SHEET_TABLE_MAP[sheetName] || { client: masterSupabase, table: 'checklist' };
  const client = config.client;

  try {
    let query = client.from(config.table).select('*');
    if (params.limit) query = query.limit(params.limit);

    let { data, error } = await query;
    if (error && config.altTable) {
      const altResult = await client.from(config.altTable).select('*');
      data = altResult.data;
      error = altResult.error;
    }

    if (error) {
      data = [];
    }

    const formattedData = formatAsSheet2DMatrix(sheetName, data || []);
    const payload = { success: true, data: formattedData };
    return {
      ok: true,
      status: 200,
      success: true,
      data: formattedData,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  } catch (err) {
    console.warn(`[Supabase API] Error fetching sheet ${sheetName}:`, err);
    const emptyMatrix = formatAsSheet2DMatrix(sheetName, []);
    const payload = { success: true, data: emptyMatrix };
    return {
      ok: true,
      status: 200,
      success: true,
      data: emptyMatrix,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    };
  }
}

/**
 * Mutate (insert/update) sheet records in Supabase, returning a fetch-compatible response object.
 */
export async function supabaseMutateSheet(sheetName, action, payloadData = {}) {
  const config = SHEET_TABLE_MAP[sheetName] || { client: masterSupabase, table: 'checklist' };
  const client = config.client;

  try {
    let resultData = [];
    if (action === 'insert' || action === 'add') {
      const { data } = await client.from(config.table).insert(payloadData).select();
      resultData = data || [];
    } else if (action === 'update' || action === 'updateCell') {
      if (payloadData.id) {
        const { id, ...updates } = payloadData;
        const { data } = await client.from(config.table).update(updates).eq('id', id).select();
        resultData = data || [];
      } else {
        const { data } = await client.from(config.table).upsert(payloadData).select();
        resultData = data || [];
      }
    }

    const resPayload = { success: true, data: resultData };
    return {
      ok: true,
      status: 200,
      success: true,
      data: resultData,
      json: async () => resPayload,
      text: async () => JSON.stringify(resPayload),
    };
  } catch (err) {
    console.warn(`[Supabase API] Error mutating sheet ${sheetName}:`, err);
    const resPayload = { success: true, data: [] };
    return {
      ok: true,
      status: 200,
      success: true,
      data: [],
      json: async () => resPayload,
      text: async () => JSON.stringify(resPayload),
    };
  }
}
