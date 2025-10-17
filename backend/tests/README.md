# CIAT Backend Tests

This directory contains unit tests for the CIAT backend, specifically focused on ensuring consistency between existing rule matching and auto-generated rule matching.

## Test Structure

- `simple-test-runner.js` - Simple test runner framework
- `normalization-consistency.test.js` - Tests for normalization consistency
- `rule-matching-consistency.test.js` - Tests for rule matching consistency  
- `tea-rule-integration.test.js` - Integration tests for the specific "tea rule" scenario

## Running Tests

### Run All Tests
```bash
npm test
# or
npm run test:all
```

### Run Individual Test Suites
```bash
# Normalization consistency tests
npm run test:normalization

# Rule matching consistency tests
npm run test:matching

# Tea rule integration tests
npm run test:tea
```

### Run Specific Test File
```bash
node tests/test-runner.js tests/normalization-consistency.test.js
```

## Test Coverage

### Normalization Consistency Tests
- Verifies both systems use the same normalization function
- Tests punctuation and special character handling
- Tests store number removal
- Tests brand canonicalization
- Tests case sensitivity handling

### Rule Matching Consistency Tests
- Verifies existing rules and auto rules use same matching logic
- Tests different pattern matching types (contains, exact, regex)
- Tests priority ordering
- Tests edge cases

### Tea Rule Integration Tests
- Tests the specific scenario that was causing issues
- Verifies existing "tea" rules match the same transactions as auto-generated "tea" rules
- Tests used rules detection
- Tests normalization edge cases

## What These Tests Prevent

These tests ensure that:

1. **No duplicate auto-generated rules** - Existing rules will properly match during import
2. **Consistent categorization** - Same transactions get same categories regardless of rule source
3. **Proper rule detection** - Used rules are correctly identified during import
4. **Normalization consistency** - Both systems process merchant names identically

## Adding New Tests

To add new tests:

1. Create a new `.test.js` file in this directory
2. Export a default object with `name` and `run` properties
3. Use the test runner's assertion methods:
   - `runner.assert(condition, message)`
   - `runner.assertEqual(actual, expected, message)`
   - `runner.assertTrue(condition, message)`
   - `runner.assertFalse(condition, message)`
   - `runner.assertContains(haystack, needle, message)`

Example:
```javascript
export default {
  name: 'My Test Suite',
  
  async run(runner) {
    runner.test('My test case', () => {
      runner.assertEqual(1 + 1, 2, 'Math should work');
    });
    
    await runner.runTests();
  }
};
```
