const { google } = require('googleapis');

const SHEET_ID = '1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo';
const DC_SHEET_NAME = 'DeliveryChannels';
const DC_ITEMS_SHEET_NAME = 'DCItems';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function toSafeString(value) {
  return String(value || '').trim();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const dcNumber = toSafeString(payload.dcNumber);
    const rowIndex = Number(payload.rowIndex || 0);

    if (!dcNumber) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'dcNumber is required' }),
      };
    }

    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets(properties(sheetId,title))',
    });

    const sheetMap = new Map(
      (meta.data.sheets || []).map((s) => [s.properties.title, s.properties.sheetId])
    );

    if (!sheetMap.has(DC_SHEET_NAME)) {
      return {
        statusCode: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'DeliveryChannels sheet not found' }),
      };
    }

    const dcCol = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${DC_SHEET_NAME}!A:A`,
    });
    const dcRows = dcCol.data.values || [];

    let targetRow = 0;
    if (rowIndex > 1 && rowIndex <= dcRows.length) {
      const rowDcNumber = toSafeString(dcRows[rowIndex - 1]?.[0]);
      if (rowDcNumber === dcNumber) {
        targetRow = rowIndex;
      }
    }
    if (!targetRow) {
      for (let i = 1; i < dcRows.length; i++) {
        if (toSafeString(dcRows[i]?.[0]) === dcNumber) {
          targetRow = i + 1;
          break;
        }
      }
    }

    if (!targetRow) {
      return {
        statusCode: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: `DC not found: ${dcNumber}` }),
      };
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetMap.get(DC_SHEET_NAME),
                dimension: 'ROWS',
                startIndex: targetRow - 1,
                endIndex: targetRow,
              },
            },
          },
        ],
      },
    });

    let deletedItemsRows = 0;
    if (sheetMap.has(DC_ITEMS_SHEET_NAME)) {
      const dcItemsCol = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${DC_ITEMS_SHEET_NAME}!A:A`,
      });
      const itemRows = dcItemsCol.data.values || [];

      const requests = [];
      for (let i = itemRows.length - 1; i >= 1; i--) {
        if (toSafeString(itemRows[i]?.[0]) === dcNumber) {
          requests.push({
            deleteDimension: {
              range: {
                sheetId: sheetMap.get(DC_ITEMS_SHEET_NAME),
                dimension: 'ROWS',
                startIndex: i,
                endIndex: i + 1,
              },
            },
          });
        }
      }

      if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: { requests },
        });
        deletedItemsRows = requests.length;
      }
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        dcNumber,
        deletedDCRow: targetRow,
        deletedItemsRows,
      }),
    };
  } catch (error) {
    console.error('Error deleting delivery channel:', error);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
