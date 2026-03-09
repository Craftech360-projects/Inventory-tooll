// Netlify function to fetch DC Items from Google Sheets
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo/gviz/tq?tqx=out:csv&sheet=DCItems';

exports.handler = async (event, context) => {
  try {
    const cacheBuster = Date.now();
    const response = await fetch(SHEET_CSV_URL + '&_=' + cacheBuster, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    const csvText = await response.text();
    
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
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
