/**
 * CFT Inventory System v3 - Complete Google Apps Script
 * 
 * Sheet ID: 1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo
 * 
 * SETUP:
 * 1. Open Sheet > Extensions > Apps Script
 * 2. Delete existing code, paste this entire script
 * 3. Deploy > New deployment > Web app
 * 4. Execute as: Me | Access: Anyone
 * 5. Copy URL and update app.js CONFIG.APPS_SCRIPT_URL
 * 
 * REQUIRED SHEETS:
 * - Sheet1 (Inventory)
 * - DeliveryChannels
 * - DCItems
 * - PurchaseRequests
 * - DailyLog
 */

// ==================== MAIN HANDLERS ====================

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action || 'inventory';
  
  try {
    let data;
    
    switch(action) {
      case 'inventory':
        const invSheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
        data = invSheet.getDataRange().getValues();
        break;
        
      case 'deliveryChannels':
        const dcSheet = ss.getSheetByName('DeliveryChannels');
        data = dcSheet ? dcSheet.getDataRange().getValues() : [];
        break;
        
      case 'dcItems':
        const dcItemsSheet = ss.getSheetByName('DCItems');
        data = dcItemsSheet ? dcItemsSheet.getDataRange().getValues() : [];
        break;
        
      case 'purchaseRequests':
        const prSheet = ss.getSheetByName('PurchaseRequests');
        data = prSheet ? prSheet.getDataRange().getValues() : [];
        break;
        
      case 'dailyLog':
        const logSheet = ss.getSheetByName('DailyLog');
        data = logSheet ? logSheet.getDataRange().getValues() : [];
        break;
        
      case 'employees':
        const empSheet = ss.getSheetByName('Employees');
        data = empSheet ? empSheet.getDataRange().getValues() : [];
        break;
        
      case 'employeeAssets':
        const eaSheet = ss.getSheetByName('EmployeeAssets');
        data = eaSheet ? eaSheet.getDataRange().getValues() : [];
        break;
        
      default:
        data = { error: 'Unknown action: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  
  try {
    let result;
    let data = {};
    
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    
    // ==================== INVENTORY ====================
    
    if (action === 'add') {
      const sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
      sheet.appendRow([
        data.itemId,
        data.name,
        data.category,
        data.subCategory || '',
        data.quantity,
        data.status,
        data.location || '',
        data.value,
        data.addedDate,
        data.notes || '',
        data.returnDate || '',
        data.eventProject || '',
        data.vendorName || '',
        data.vendorContact || '',
        data.rentalCost || '',
        data.deposit || ''
      ]);
      result = { success: true, message: 'Item added' };
    }
    
    else if (action === 'update') {
      const sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
      sheet.getRange(data.rowIndex, 1, 1, 16).setValues([[
        data.itemId,
        data.name,
        data.category,
        data.subCategory || '',
        data.quantity,
        data.status,
        data.location || '',
        data.value,
        data.addedDate,
        data.notes || '',
        data.returnDate || '',
        data.eventProject || '',
        data.vendorName || '',
        data.vendorContact || '',
        data.rentalCost || '',
        data.deposit || ''
      ]]);
      result = { success: true, message: 'Item updated' };
    }
    
    else if (action === 'delete') {
      const sheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
      const row = parseInt(e.parameter.row) || data.rowIndex;
      sheet.deleteRow(row);
      result = { success: true, message: 'Item deleted' };
    }
    
    // ==================== DELIVERY CHANNELS ====================
    
    else if (action === 'createDC') {
      let dcSheet = ss.getSheetByName('DeliveryChannels');
      if (!dcSheet) {
        dcSheet = ss.insertSheet('DeliveryChannels');
        dcSheet.appendRow(['DC Number', 'Event Name', 'Activity', 'Event Date', 'Event Location', 'Client Name', 'Client POC', 'Client Phone', 'Site POC', 'Site Phone', 'Carrier Name', 'Carrier Phone', 'Vehicle Number', 'Dispatch Date', 'Expected Return', 'Actual Return', 'Status', 'PM Approver', 'Approval Date', 'Notes', 'Created Date', 'From Address', 'To Address']);
      }
      
      dcSheet.appendRow([
        data.dcNumber,
        data.eventName,
        data.activity,
        data.eventDate,
        data.eventLocation,
        data.clientName,
        data.clientPOC || '',
        data.clientPhone || '',
        data.sitePOC || '',
        data.sitePhone || '',
        data.carrierName,
        data.carrierPhone || '',
        data.vehicleNumber || '',
        data.dispatchDate || '',
        data.expectedReturn,
        data.actualReturn || '',
        data.status || 'Draft',
        data.pmApprover || '',
        data.approvalDate || '',
        data.notes || '',
        data.createdDate,
        data.fromAddress || '',
        data.toAddress || ''
      ]);
      
      // Add DC Items
      if (data.items && data.items.length > 0) {
        let dcItemsSheet = ss.getSheetByName('DCItems');
        if (!dcItemsSheet) {
          dcItemsSheet = ss.insertSheet('DCItems');
          dcItemsSheet.appendRow(['DC Number', 'Item ID', 'Item Name', 'Category', 'Quantity', 'Return Condition', 'Notes']);
        }
        
        data.items.forEach(item => {
          dcItemsSheet.appendRow([
            data.dcNumber,
            item.itemId,
            item.name,
            item.category,
            item.qty,
            '',
            ''
          ]);
        });
      }
      
      result = { success: true, dcNumber: data.dcNumber };
    }
    
    else if (action === 'updateDCStatus') {
      const dcSheet = ss.getSheetByName('DeliveryChannels');
      if (dcSheet) {
        const dcData = dcSheet.getDataRange().getValues();
        for (let i = 1; i < dcData.length; i++) {
          if (dcData[i][0] === data.dcNumber) {
            dcSheet.getRange(i + 1, 17).setValue(data.status); // Status column
            break;
          }
        }
      }
      result = { success: true };
    }
    
    else if (action === 'approveDC') {
      const dcSheet = ss.getSheetByName('DeliveryChannels');
      if (dcSheet) {
        const dcData = dcSheet.getDataRange().getValues();
        for (let i = 1; i < dcData.length; i++) {
          if (dcData[i][0] === data.dcNumber) {
            dcSheet.getRange(i + 1, 17).setValue('Approved');
            dcSheet.getRange(i + 1, 18).setValue(data.approver);
            dcSheet.getRange(i + 1, 19).setValue(data.date);
            break;
          }
        }
      }
      result = { success: true };
    }
    
    else if (action === 'dispatchDC') {
      const dcSheet = ss.getSheetByName('DeliveryChannels');
      if (dcSheet) {
        const dcData = dcSheet.getDataRange().getValues();
        for (let i = 1; i < dcData.length; i++) {
          if (dcData[i][0] === data.dcNumber) {
            dcSheet.getRange(i + 1, 14).setValue(data.dispatchDate);
            dcSheet.getRange(i + 1, 17).setValue('Dispatched');
            break;
          }
        }
      }
      result = { success: true };
    }
    
    else if (action === 'closeDC') {
      const dcSheet = ss.getSheetByName('DeliveryChannels');
      if (dcSheet) {
        const dcData = dcSheet.getDataRange().getValues();
        for (let i = 1; i < dcData.length; i++) {
          if (dcData[i][0] === data.dcNumber) {
            dcSheet.getRange(i + 1, 16).setValue(data.actualReturn);
            dcSheet.getRange(i + 1, 17).setValue('Closed');
            break;
          }
        }
      }
      result = { success: true };
    }
    
    else if (action === 'updateDCItems') {
      // Clear existing items for this DC and add new ones
      let dcItemsSheet = ss.getSheetByName('DCItems');
      if (!dcItemsSheet) {
        dcItemsSheet = ss.insertSheet('DCItems');
        dcItemsSheet.appendRow(['DC Number', 'Item ID', 'Item Name', 'Category', 'Quantity', 'Return Condition', 'Notes']);
      }
      
      // Delete existing items for this DC
      const allItems = dcItemsSheet.getDataRange().getValues();
      for (let i = allItems.length - 1; i >= 1; i--) {
        if (allItems[i][0] === data.dcNumber) {
          dcItemsSheet.deleteRow(i + 1);
        }
      }
      
      // Add new items
      if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
          dcItemsSheet.appendRow([
            data.dcNumber,
            item.itemId,
            item.name,
            item.category,
            item.qty,
            '',
            ''
          ]);
        });
      }
      
      result = { success: true };
    }
    
    // ==================== PURCHASE REQUESTS ====================
    
    else if (action === 'createPR') {
      let prSheet = ss.getSheetByName('PurchaseRequests');
      if (!prSheet) {
        prSheet = ss.insertSheet('PurchaseRequests');
        prSheet.appendRow(['PR Number', 'Item Name', 'Description', 'Quantity', 'Project', 'Department', 'Requested By', 'Priority', 'Needed By', 'Vendor', 'Status', 'Created Date', 'Approved By', 'Approved Date', 'Ordered Date', 'Received Date', 'Notes', 'Quote Amount', 'Quote Notes', 'Quoted By', 'Tracking ID', 'Order ID', 'Invoice Number', 'Final Amount']);
      }
      
      const pr = data.data || data;
      prSheet.appendRow([
        pr.prNumber,
        pr.itemName,
        pr.description || '',
        pr.quantity,
        pr.project,
        pr.department,
        pr.requestedBy,
        pr.priority,
        pr.neededBy,
        pr.vendor || '',
        pr.status || 'Request',
        pr.createdDate,
        '', '', '', '', '', '', '', '', '', '', '', ''
      ]);
      
      result = { success: true, prNumber: pr.prNumber };
    }
    
    else if (action === 'updatePR') {
      const prSheet = ss.getSheetByName('PurchaseRequests');
      if (prSheet) {
        const prData = prSheet.getDataRange().getValues();
        const updates = data.updates || {};
        
        for (let i = 1; i < prData.length; i++) {
          if (prData[i][0] === data.prNumber) {
            // Update specific fields
            if (updates.status) prSheet.getRange(i + 1, 11).setValue(updates.status);
            if (updates.approvedBy) prSheet.getRange(i + 1, 13).setValue(updates.approvedBy);
            if (updates.approvedDate) prSheet.getRange(i + 1, 14).setValue(updates.approvedDate);
            if (updates.orderedDate) prSheet.getRange(i + 1, 15).setValue(updates.orderedDate);
            if (updates.receivedDate) prSheet.getRange(i + 1, 16).setValue(updates.receivedDate);
            if (updates.quoteAmount) prSheet.getRange(i + 1, 18).setValue(updates.quoteAmount);
            if (updates.quoteNotes) prSheet.getRange(i + 1, 19).setValue(updates.quoteNotes);
            if (updates.quotedBy) prSheet.getRange(i + 1, 20).setValue(updates.quotedBy);
            if (updates.vendor) prSheet.getRange(i + 1, 10).setValue(updates.vendor);
            if (updates.trackingId) prSheet.getRange(i + 1, 21).setValue(updates.trackingId);
            if (updates.orderId) prSheet.getRange(i + 1, 22).setValue(updates.orderId);
            if (updates.invoiceNumber) prSheet.getRange(i + 1, 23).setValue(updates.invoiceNumber);
            if (updates.finalAmount) prSheet.getRange(i + 1, 24).setValue(updates.finalAmount);
            break;
          }
        }
      }
      result = { success: true };
    }
    
    // ==================== DAILY LOG ====================
    
    else if (action === 'createDailyLog') {
      let logSheet = ss.getSheetByName('DailyLog');
      if (!logSheet) {
        logSheet = ss.insertSheet('DailyLog');
        logSheet.appendRow(['Log ID', 'Item ID', 'Item Name', 'Team Member', 'Purpose', 'Request Date', 'Expected Return', 'Status', 'Handed Over By', 'Handover Date', 'Return Date', 'Notes']);
      }
      
      logSheet.appendRow([
        data.logId,
        data.itemId,
        data.itemName,
        data.teamMember,
        data.purpose,
        data.requestDate,
        data.expectedReturn,
        data.status || 'Requested',
        data.handedOverBy || '',
        data.handoverDate || '',
        data.returnDate || '',
        data.notes || ''
      ]);
      
      result = { success: true, logId: data.logId };
    }
    
    else if (action === 'updateDailyLog') {
      const logSheet = ss.getSheetByName('DailyLog');
      if (logSheet) {
        const logData = logSheet.getDataRange().getValues();
        for (let i = 1; i < logData.length; i++) {
          if (logData[i][0] === data.logId) {
            if (data.status) logSheet.getRange(i + 1, 8).setValue(data.status);
            if (data.handedOverBy) logSheet.getRange(i + 1, 9).setValue(data.handedOverBy);
            if (data.handoverDate) logSheet.getRange(i + 1, 10).setValue(data.handoverDate);
            if (data.returnDate) logSheet.getRange(i + 1, 11).setValue(data.returnDate);
            break;
          }
        }
      }
      result = { success: true };
    }
    
    // ==================== EMPLOYEES ====================
    
    else if (action === 'addEmployee') {
      let empSheet = ss.getSheetByName('Employees');
      if (!empSheet) {
        empSheet = ss.insertSheet('Employees');
        empSheet.appendRow(['empId', 'name', 'department', 'role', 'joinDate', 'phone', 'email', 'createdAt']);
      }
      empSheet.appendRow([
        data.empId,
        data.name,
        data.department,
        data.role || '',
        data.joinDate || '',
        data.phone || '',
        data.email || '',
        data.createdAt || new Date().toISOString()
      ]);
      result = { success: true, message: 'Employee added' };
    }
    
    else if (action === 'assignAsset') {
      let eaSheet = ss.getSheetByName('EmployeeAssets');
      if (!eaSheet) {
        eaSheet = ss.insertSheet('EmployeeAssets');
        eaSheet.appendRow(['id', 'empId', 'itemId', 'itemName', 'serialNo', 'assignedDate', 'returnedDate', 'status', 'notes']);
      }
      eaSheet.appendRow([
        data.id,
        data.empId,
        data.itemId,
        data.itemName,
        data.serialNo || '',
        data.assignedDate,
        '',
        'Active',
        data.notes || ''
      ]);
      
      // Update inventory item status to 'In Use'
      const invSheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
      const invData = invSheet.getDataRange().getValues();
      for (let i = 1; i < invData.length; i++) {
        if (invData[i][0] == data.itemId) {
          invSheet.getRange(i + 1, 6).setValue('In Use'); // Status column
          break;
        }
      }
      
      result = { success: true, message: 'Asset assigned to employee' };
    }
    
    else if (action === 'returnAsset') {
      const eaSheet = ss.getSheetByName('EmployeeAssets');
      if (eaSheet) {
        const eaData = eaSheet.getDataRange().getValues();
        for (let i = 1; i < eaData.length; i++) {
          if (eaData[i][0] == data.id) {
            eaSheet.getRange(i + 1, 7).setValue(data.returnedDate); // returnedDate
            eaSheet.getRange(i + 1, 8).setValue('Returned'); // status
            
            // Update inventory item status back to 'Available'
            const itemId = eaData[i][2];
            const invSheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
            const invData = invSheet.getDataRange().getValues();
            for (let j = 1; j < invData.length; j++) {
              if (invData[j][0] == itemId) {
                invSheet.getRange(j + 1, 6).setValue('Available');
                break;
              }
            }
            break;
          }
        }
      }
      result = { success: true, message: 'Asset returned' };
    }
    
    else {
      result = { error: 'Unknown action: ' + action };
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
