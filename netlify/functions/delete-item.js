// Netlify function to delete inventory item from Google Sheets
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
    const { rowIndex } = JSON.parse(event.body || '{}');
    const row = rowIndex || event.queryStringParameters?.row;
    
    if (!row) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'row index required' })
      };
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    // Get sheet metadata to find the sheetId
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets(properties(sheetId,title))'
    });
    
    const inventorySheet = sheetMeta.data.sheets.find(s => s.properties.title === 'Inventory');
    const sheetId = inventorySheet ? inventorySheet.properties.sheetId : 0;

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: parseInt(row) - 1,
              endIndex: parseInt(row)
            }
          }
        }]
      }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, deletedRow: row })
    };
  } catch (error) {
    console.error('Error deleting item:', error);
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
