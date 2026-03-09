// Netlify function to update inventory item in Google Sheets
const { google } = require('googleapis');

const SHEET_ID = '1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo';

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const item = JSON.parse(event.body);
    const rowIndex = item.rowIndex;
    
    if (!rowIndex) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'rowIndex required' })
      };
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Update specific row
    const values = [[
      item.itemId,
      item.name,
      item.category,
      item.subCategory,
      item.quantity,
      item.status,
      item.location,
      item.value,
      item.addedDate,
      item.notes,
      item.returnDate || '',
      item.eventProject || '',
      item.vendorName || '',
      item.vendorContact || '',
      item.rentalCost || '',
      item.deposit || ''
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Inventory!A${rowIndex}:P${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, rowIndex })
    };
  } catch (error) {
    console.error('Error updating item:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
