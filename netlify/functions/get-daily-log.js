// Netlify serverless function to fetch DailyLog rows via Apps Script JSON endpoint.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxh4EkJYjC1EjI7rrbMcza1_XPs5WOp5_7RQlJlro-QZhVl5P41fxQVIAOyT-wrprlf/exec';

const HEADER = [
  'Log ID',
  'Item ID',
  'Item Name',
  'Team Member',
  'Purpose',
  'Request Date',
  'Expected Return',
  'Status',
  'Handed Over By',
  'Handover Date',
  'Return Date',
  'Notes'
];

function toCsv(rows) {
  const escapeCell = (value) => {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  return rows.map((row) => row.map(escapeCell).join(',')).join('\n');
}

exports.handler = async () => {
  try {
    const response = await fetch(`${APPS_SCRIPT_URL}?action=dailyLog&_=${Date.now()}`, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!response.ok) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Access-Control-Allow-Origin': '*'
        },
        body: toCsv([HEADER])
      };
    }

    const data = await response.json();
    const rows = Array.isArray(data) && data.length > 0 ? data : [HEADER];
    const csvText = toCsv(rows);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: csvText
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*'
      },
      body: toCsv([HEADER])
    };
  }
};
