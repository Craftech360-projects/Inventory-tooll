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
    
    // Fix: Google Sheets CSV with multiline fields needs proper parsing
    // Use a simple approach: count unescaped quotes
    const lines = [];
    let currentLine = '';
    let openQuotes = false;
    let i = 0;
    
    while (i < csvText.length) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];
      
      if (char === '"') {
        if (openQuotes && nextChar === '"') {
          // Escaped quote - include one quote and skip next
          currentLine += '"';
          i += 2;
          continue;
        }
        openQuotes = !openQuotes;
      }
      
      if (char === '\n' && openQuotes) {
        // Inside quotes - convert to space
        currentLine += ' ';
      } else if (char === '\n' && !openQuotes) {
        // Outside quotes - end of row
        if (currentLine.trim()) lines.push(currentLine);
        currentLine = '';
      } else {
        currentLine += char;
      }
      i++;
    }
    if (currentLine.trim()) lines.push(currentLine);
    
    const fixedCsv = lines.join('\n');
    
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
