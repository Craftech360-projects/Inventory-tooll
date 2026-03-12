// Netlify function to fetch Delivery Channels from Google Sheets
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo/gviz/tq?tqx=out:csv&sheet=DeliveryChannels';

exports.handler = async (event, context) => {
  try {
    const cacheBuster = Date.now();
    const response = await fetch(SHEET_CSV_URL + '&_=' + cacheBuster, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    let csvText = await response.text();
    
    // Fix: Handle newlines within CSV fields (Google Sheets escapes them as \n in quoted fields)
    // Reconstruct broken lines by detecting incomplete rows
    const lines = csvText.split('\n');
    const fixedLines = [];
    let currentLine = '';
    let inQuotes = false;
    
    for (const line of lines) {
      // Count quotes to determine if we're inside a quoted field
      const quoteCount = (line.match(/"[^"]*(?:""[^"]*)*"/g) || []).length;
      const rawQuotes = (line.match(/"/g) || []).length;
      
      if (currentLine === '') {
        currentLine = line;
        // Toggle inQuotes based on odd/even quote count at start
        inQuotes = rawQuotes % 2 === 1;
      } else {
        currentLine += '\n' + line;
        // If line ends with quote, we're exiting quoted field
        if (line.trim().endsWith('"') && rawQuotes % 2 === 0) {
          fixedLines.push(currentLine);
          currentLine = '';
          inQuotes = false;
        }
      }
    }
    if (currentLine) fixedLines.push(currentLine);
    
    const fixedCsv = fixedLines.join('\n');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: fixedCsv
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
