# Drag & Drop Import Feature

The CIAT application now supports drag and drop functionality for importing multiple CSV and QFX files at once, with the ability to assign files to different accounts.

## Features

### 🎯 **Drag & Drop Interface**
- **Visual Drop Zone**: Large, intuitive drop area with visual feedback
- **Multiple File Support**: Drop multiple CSV or QFX files simultaneously
- **File Type Validation**: Automatically filters for CSV and QFX files only
- **Alternative Selection**: Click to select files if drag & drop isn't preferred

### 📁 **File Management**
- **Account Assignment**: Assign each file to a specific account
- **File Reassignment**: Change which account a file belongs to using dropdown
- **File Removal**: Remove individual files from the import list
- **File Information**: Display file names and sizes

### 🔄 **Batch Processing**
- **Multi-Account Support**: Process files for multiple accounts in one operation
- **Unified Review**: Review all transactions from all accounts in one interface
- **Bulk Import**: Import all approved transactions at once

## How to Use

### Step 1: Prepare Your Files
1. Ensure all your CSV or QFX files are in the correct format
2. Have your accounts set up in the system

### Step 2: Import Files
1. Navigate to the **Import** tab
2. **Drag and drop** your CSV or QFX files onto the drop zone, OR
3. **Click "Select Files"** to choose files from your computer
4. Files will be automatically assigned to your first account

### Step 3: Assign Files to Accounts
1. Review the files in the "Files to Import" section
2. Use the dropdown next to each file to assign it to the correct account
3. Remove any unwanted files using the × button
4. Click **"Process All Files"** when ready

### Step 4: Review Transactions
1. Review all transactions grouped by account
2. Adjust categories as needed
3. Check/uncheck transactions to ignore
4. Click **"Import All Transactions"** to complete the import

## User Interface

### Drop Zone
- **Visual Feedback**: Changes color and scales when files are dragged over
- **Supported Formats**: CSV (comma or tab delimited) and QFX (Quicken file format)
- **Clear Instructions**: Shows what to do and what file types are accepted
- **File Counter**: Displays total number of files selected

### File Assignment Section
- **Account Grouping**: Files are organized by account
- **File Details**: Shows filename and file size for each file
- **Account Selector**: Dropdown to reassign files to different accounts
- **Remove Button**: Red × button to remove individual files

### Review Section
- **Account Separation**: Transactions grouped by account with clear headers
- **Transaction Table**: Full transaction details with editable categories
- **Bulk Actions**: Import all or cancel the entire operation

## Technical Details

### File Processing
- Files are processed sequentially for each account
- Each file is validated and parsed individually
- Errors in one file don't stop processing of other files
- All transactions are combined for final review

### Account Management
- Files can be reassigned between accounts at any time
- Empty account groups are automatically removed
- Account names are displayed for easy identification

### Error Handling
- Invalid files are skipped with error messages
- Processing continues even if individual files fail
- Clear error messages help identify problematic files

## Best Practices

### File Organization
- **Naming Convention**: Use descriptive filenames that indicate the account
- **File Size**: Keep individual files reasonably sized for better performance
- **Format Consistency**: Ensure all CSV files follow the same format

### Account Setup
- **Create Accounts First**: Set up all your accounts before importing
- **Descriptive Names**: Use clear account names for easy file assignment
- **Account Verification**: Double-check file assignments before processing

### Import Workflow
- **Batch Similar Files**: Group files from the same account together
- **Review Before Import**: Always review transactions before final import
- **Test with Small Files**: Start with a few files to test the process

## Troubleshooting

### Common Issues

**Files Not Dropping**
- Ensure files are CSV format
- Check browser compatibility
- Try using the "Select Files" button instead

**Files Assigned to Wrong Account**
- Use the dropdown to reassign files
- Check account names are correct
- Verify file assignments before processing

**Processing Errors**
- Check CSV file format
- Ensure files aren't corrupted
- Verify account IDs are valid

**Import Failures**
- Review error messages carefully
- Check transaction data format
- Ensure all required fields are present

## Future Enhancements

Potential improvements for future versions:
- **Auto-Detection**: Automatically assign files based on filename patterns
- **File Preview**: Show sample data before processing
- **Batch Categories**: Apply categories to multiple transactions at once
- **Import History**: Track previous imports and their results
- **File Templates**: Save and reuse import configurations
