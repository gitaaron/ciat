# Debug Mode Testing Instructions

## Current Status
- ✅ Stub backend server running on port 3108
- ✅ Frontend running on port 5184
- ✅ Debug mode implemented

## How to Test

### 1. Open Debug Mode
Navigate to: `http://localhost:5184?debug=true`

### 2. Expected Behavior
- You should see "DEBUG MODE" chip in the header
- Debug controls panel should be visible
- Import wizard should be pre-populated with mock data
- Step 3 (Rules Review) should show 4 auto-generated rules

### 3. Test Steps
1. **Step 1 (File Selection)**: Should show mock file "test.csv"
2. **Step 2 (Account Assignment)**: Should show file assigned to "Test Account"
3. **Step 3 (Rules Review)**: Should show 4 auto-generated rules:
   - "york square" → fixed_costs (2 matches)
   - "smoque bones" → guilt_free (1 match)
   - "amazon channels" → fixed_costs (1 match)
   - "jian hing" → fixed_costs (1 match)
4. **Step 4 (Transaction Review)**: Should show 5 mock transactions

### 4. Debug Controls
- Use the debug control buttons to jump between steps
- Each step should be properly populated with mock data

### 5. API Testing
Test the stub API directly:
```bash
curl -X POST http://localhost:3108/api/rules/auto-generate \
  -H "Content-Type: application/json" \
  -d '{"transactions": []}' | jq .
```

## Troubleshooting

### If auto rules don't show up:
1. Check browser console for errors
2. Verify stub server is running: `lsof -i :3108`
3. Check if debug mode is enabled (should see "DEBUG MODE" chip)

### If frontend doesn't load:
1. Check if frontend is running: `lsof -i :5184`
2. Try refreshing the page
3. Check browser console for JavaScript errors

## Expected Results
- Auto-generated rules should display in Step 3
- Rules should be interactive (can be applied, edited, etc.)
- Debug mode should work without requiring actual file uploads
