import masterSupabase from '../SupabaseClient';
import hrSupabase from '../systems/HR_fms/src/services/supabaseHRClient';

const SHEET_TABLE_MAP = {
  'JOINING': { client: hrSupabase, table: 'hr_sheets' },
  'LEAVING': { client: hrSupabase, table: 'hr_sheets' },
  'INDENT': { client: hrSupabase, table: 'hr_sheets' },
  'ENQUIRY': { client: hrSupabase, table: 'hr_sheets' },
  'Follow - Up': { client: hrSupabase, table: 'hr_sheets' },
  'Leave Management': { client: hrSupabase, table: 'hr_sheets' },
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
    'Timestamp',
    'Employee ID',
    'Indent No',
    'Enquiry No',
    'Name As Per Aadhar',
    'Father Name',
    'Date Of Joining',
    'Joining Place',
    'Designation',
    'Salary',
    'Aadhar Frontside Photo',
    'Pan card',
    "Candidate's Photo",
    'Current Address',
    'Address As Per Aadhar Card',
    'Date Of Birth As Per Aadhar Card',
    'Gender',
    'Mobile No.',
    'Family Mobile No.',
    'Relationship With Family Person',
    'Past Pf Id No. (If Any)',
    'Current Bank A.C No.',
    'Ifsc Code',
    'Branch Name',
    'Photo Of Front Bank Passbook',
    'Personal Email-Id',
    'ESIC No (IF Any)',
    'Highest Qualification',
    'PF Eligible',
    'ESIC Eligible',
    'Joining Company Name',
    'Email ID To Be Issue',
    'Issue Mobile',
    'Issue Laptop',
    'Aadhar Card No',
    'Mode Of Attendance',
    'Quafication Photo',
    'Payment Mode',
    'Salary Slip',
    'Resume Copy',
    'Status',
    'Planned Date',
    'Actual',
    'Unused',
    'Actual Date',
    'Check Salary Slip Resume',
    'Offer Letter Received',
    'Welcome Meeting',
    'Biometric Access',
    'Official Email ID',
    'Assign Assets',
    'PF ESIC',
    'Company Directory'
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

export async function supabaseFetchSheet(sheetName, params = {}) {
  const config = SHEET_TABLE_MAP[sheetName] || { client: masterSupabase, table: 'checklist' };
  const client = config.client;

  try {
    if (config.table === 'hr_sheets') {
      const { data, error } = await client
        .from('hr_sheets')
        .select('*')
        .eq('sheet_name', sheetName)
        .order('row_index', { ascending: true });

      if (error) throw error;

      const headers = SHEET_HEADERS[sheetName] || [];
      const formattedRows = (data || []).map(record => {
        const rowArr = Array.isArray(record.row_data) ? record.row_data : JSON.parse(record.row_data || '[]');
        const obj = { id: record.id, row_index: record.row_index };
        headers.forEach((hdr, idx) => {
          obj[hdr] = rowArr[idx] !== undefined ? rowArr[idx] : '';
        });
        return obj;
      });

      const formattedData = formatAsSheet2DMatrix(sheetName, formattedRows);
      const payload = { success: true, data: formattedData };
      return {
        ok: true,
        status: 200,
        success: true,
        data: formattedData,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      };
    }

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
    if (config.table === 'hr_sheets') {
      let resultData = [];

      if (action === 'insert' || action === 'add') {
        const rawRowData = payloadData.rowData;
        const rowArr = Array.isArray(rawRowData)
          ? rawRowData
          : JSON.parse(rawRowData || '[]');

        // Count to find next row_index
        const { count } = await client
          .from('hr_sheets')
          .select('*', { count: 'exact', head: true })
          .eq('sheet_name', sheetName);

        const nextRowIndex = (count || 0) + 7;

        const { data, error } = await client
          .from('hr_sheets')
          .insert({
            sheet_name: sheetName,
            row_index: nextRowIndex,
            row_data: rowArr
          })
          .select();

        if (error) throw error;
        resultData = data || [];
      } else if (action === 'update') {
        const rawRowData = payloadData.rowData;
        const rowArr = Array.isArray(rawRowData)
          ? rawRowData
          : JSON.parse(rawRowData || '[]');

        const rowIndex = parseInt(payloadData.rowIndex, 10);

        const { data, error } = await client
          .from('hr_sheets')
          .update({ row_data: rowArr })
          .eq('sheet_name', sheetName)
          .eq('row_index', rowIndex)
          .select();

        if (error) throw error;
        resultData = data || [];
      } else if (action === 'updateCell') {
        const rowIndex = parseInt(payloadData.rowIndex, 10);
        const columnIndex = parseInt(payloadData.columnIndex, 10);
        const val = payloadData.value;

        // Fetch existing rowData
        const { data: existing, error: fetchErr } = await client
          .from('hr_sheets')
          .select('*')
          .eq('sheet_name', sheetName)
          .eq('row_index', rowIndex)
          .maybeSingle();

        if (fetchErr) throw fetchErr;

        if (existing) {
          const rowArr = Array.isArray(existing.row_data)
            ? existing.row_data
            : JSON.parse(existing.row_data || '[]');

          // Pad array if columnIndex exceeds array length
          while (rowArr.length < columnIndex) {
            rowArr.push('');
          }

          rowArr[columnIndex - 1] = val;

          const { data: updated, error: updateErr } = await client
            .from('hr_sheets')
            .update({ row_data: rowArr })
            .eq('id', existing.id)
            .select();

          if (updateErr) throw updateErr;
          resultData = updated || [];
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
    }

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
    const resPayload = { success: false, error: err.message || String(err) };
    return {
      ok: false,
      status: 500,
      success: false,
      error: err.message || String(err),
      json: async () => resPayload,
      text: async () => JSON.stringify(resPayload),
    };
  }
}
