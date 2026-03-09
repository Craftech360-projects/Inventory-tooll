// Netlify serverless function to fetch daily log data from Google Sheets
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo/export?format=csv&gid=';

// Will need to get the actual gid for DailyLog sheet
// For now, try to export - the sheet will be created by Apps Script

exports.handler = async (event, context) => {
  try {
    // Try to get DailyLog sheet - gid will be determined after sheet creation
    // Using a placeholder gid, Apps Script will create the sheet
    const response = await fetch(SHEET_CSV_URL + 'DailyLog', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    // If sheet doesn't exist, return empty
    if (!response.ok) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Access-Control-Allow-Origin': '*'
        },
        body: 'Log ID,Item ID,Item Name,Team Member,Purpose,Request Date,Expected Return,Status,Handed Over By,Handover Date,Return Date,Notes'
      };
    }
    
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
    // Return header row if error (sheet doesn't exist yet)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*'
      },
      body: 'Log ID,Item ID,Item Name,Team Member,Purpose,Request Date,Expected Return,Status,Handed Over By,Handover Date,Return Date,Notes'
    };
  }
};
