// Netlify serverless function to fetch product builds data from Google Sheets
const SHEET_ID = '1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo';

exports.handler = async (event, context) => {
  try {
    const cacheBuster = Date.now();
    // Use sheet name instead of gid for reliability
    const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Builds&_=${cacheBuster}`;
    
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
        body: 'Build ID,Product Name,Description,Target Category,Status,Created By,Created Date,Completed Date,Result Item ID,Est Value,Component Count'
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
      statusCode: 200, // Return 200 with headers even on error
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*'
      },
      body: 'Build ID,Product Name,Description,Target Category,Status,Created By,Created Date,Completed Date,Result Item ID,Est Value,Component Count'
    };
  }
};
