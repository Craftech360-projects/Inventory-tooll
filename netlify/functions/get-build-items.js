// Netlify serverless function to fetch build items (components) from Google Sheets
const SHEET_ID = '1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo';

exports.handler = async (event, context) => {
  try {
    const cacheBuster = Date.now();
    // Use sheet name instead of gid for reliability
    const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Build_Items&_=${cacheBuster}`;
    
    const response = await fetch(SHEET_CSV_URL, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    // If the sheet tab doesn't exist yet, return empty CSV with headers
    if (!response.ok) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        },
        body: 'Build ID,Item ID,Item Name,Category,Qty Used,Date Added'
      };
    }
    
    const csvText = await response.text();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
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
      body: 'Build ID,Item ID,Item Name,Category,Qty Used,Date Added'
    };
  }
};
