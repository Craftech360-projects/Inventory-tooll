/**
 * CFT Inventory - Google Apps Script
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open Google Sheet: https://docs.google.com/spreadsheets/d/1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo/edit
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Click Deploy > New deployment
 * 5. Select type: Web app
 * 6. Set "Execute as": Me
 * 7. Set "Who has access": Anyone
 * 8. Click Deploy and copy the Web App URL
 * 9. Update the dashboard's app.js with the new URL
 */

const SHEET_NAME = 'Sheet1';

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  try {
    const action = e.parameter.action;
    let result;
    
    switch(action) {
      case 'get':
        result = getData(sheet);
        break;
      case 'add':
        result = addRow(sheet, JSON.parse(e.postData.contents));
        break;
      case 'update':
        result = updateRow(sheet, JSON.parse(e.postData.contents));
        break;
      case 'delete':
        result = deleteRow(sheet, parseInt(e.parameter.row));
        break;
      default:
        result = { error: 'Unknown action' };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getData(sheet) {
  const data = sheet.getDataRange().getValues();
  return { values: data };
}

function addRow(sheet, rowData) {
  sheet.appendRow([
    rowData.itemId,
    rowData.name,
    rowData.category,
    rowData.subCategory || '',
    rowData.quantity,
    rowData.status,
    rowData.location || '',
    rowData.value,
    rowData.addedDate,
    rowData.notes || ''
  ]);
  return { success: true, message: 'Row added' };
}

function updateRow(sheet, data) {
  const rowIndex = data.rowIndex;
  const rowData = data.values;
  
  sheet.getRange(rowIndex, 1, 1, 10).setValues([[
    rowData.itemId,
    rowData.name,
    rowData.category,
    rowData.subCategory || '',
    rowData.quantity,
    rowData.status,
    rowData.location || '',
    rowData.value,
    rowData.addedDate,
    rowData.notes || ''
  ]]);
  
  return { success: true, message: 'Row updated' };
}

function deleteRow(sheet, rowIndex) {
  sheet.deleteRow(rowIndex);
  return { success: true, message: 'Row deleted' };
}
