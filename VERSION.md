# CFT Inventory System v3 - Stable v2

**Version:** v3.2.0-stable
**Date:** 2026-02-18
**Tagged by:** Pattar

## Features in this version:

### Dashboard
- 7 Categories (IT Assets, Electronic Components, Event Equipment, Mechanical Division, Office Assets, Dead Stock, Rented Equipment)
- Standardized sub-categories per category
- Dark theme UI

### Delivery Channels (DC)
- Simplified flow: Draft → Checked Out → Checked In → Closed
- Clean status tabs (minimalistic)
- Check Out / Check In modals with "Select All" button
- PDF download (direct download, no print dialog)

### PDF Format
- Bigger logo (70px)
- Header: Company name + DC# + Date only
- Event Details table
- Shipping section (From / To addresses)
- Logistics & Approvals table
- Items table: Item SKU | Name | Description | Qty | Out | In | Remarks
- Signatures: Dispatched By | Received By | Returned By
- Brand colors (Orange #F5A623)

### Tech Stack
- HTML/CSS/JS (vanilla)
- Netlify hosting + functions
- Google Sheets backend
- html2pdf.js for PDF generation
- Flatpickr for date pickers

## URLs
- Dashboard: https://craftech360-inventory.netlify.app
- Google Sheet: 1MrwDU0XtemyfpwWNX551ulfUIAFECB4cLCPhNJH1yuo
