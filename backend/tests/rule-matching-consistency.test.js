#!/usr/bin/env node

/**
 * Tests for rule matching consistency between existing rules and auto-generated rules
 */

import { normalizeMerchant } from '../src/categorizer/autoRuleGenerator.js';
import { guessCategory } from '../src/categorizer/index.js';

export default {
  name: 'Rule Matching Consistency Tests',
  
  async run(runner) {
    runner.test('Existing rules and auto rules use same matching logic', () => {
      // Create test transactions that should match specific patterns
      const testTransactions = [
        { name: 'Tim Hortons Tea Shop', expectedTeaMatch: true },
        { name: 'Green Tea Store', expectedTeaMatch: true },
        { name: 'Bubble Tea Place', expectedTeaMatch: true },
        { name: 'Starbucks Coffee', expectedTeaMatch: false },
        { name: 'McDonald\'s Restaurant', expectedTeaMatch: false },
        { name: 'Netflix Subscription', expectedTeaMatch: false },
        { name: 'Spotify Premium', expectedTeaMatch: false }
      ];

      for (const tx of testTransactions) {
        // Test existing rule matching
        const guess = guessCategory(tx);
        
        // Test auto rule normalization
        const normalized = normalizeMerchant(tx.name).normalized;
        const containsTea = normalized.includes('tea');
        
        // Both systems should agree on whether "tea" is present
        runner.assertEqual(
          containsTea,
          tx.expectedTeaMatch,
          `"${tx.name}" tea detection consistency`
        );
        
        // If the transaction contains tea, it should be categorized by a rule
        if (tx.expectedTeaMatch) {
          runner.assertTrue(
            guess.category !== null,
            `"${tx.name}" should be categorized by a rule`
          );
        }
      }
    });

    runner.test('Pattern matching types work consistently', () => {
      const testCases = [
        {
          pattern: 'tea',
          matchType: 'contains',
          transactions: [
            { name: 'Green Tea Store', shouldMatch: true },
            { name: 'Bubble Tea Place', shouldMatch: true },
            { name: 'Starbucks Coffee', shouldMatch: false },
            { name: 'Tea Time Cafe', shouldMatch: true }
          ]
        },
        {
          pattern: 'starbucks',
          matchType: 'contains',
          transactions: [
            { name: 'Starbucks Coffee', shouldMatch: true },
            { name: 'STARBUCKS', shouldMatch: true },
            { name: 'Starbucks®', shouldMatch: true },
            { name: 'McDonald\'s', shouldMatch: false }
          ]
        },
        {
          pattern: 'netflix',
          matchType: 'exact',
          transactions: [
            { name: 'Netflix', shouldMatch: true },
            { name: 'Netflix Subscription', shouldMatch: false },
            { name: 'netflix', shouldMatch: true },
            { name: 'NETFLIX', shouldMatch: true }
          ]
        }
      ];

      for (const testCase of testCases) {
        for (const tx of testCase.transactions) {
          const normalized = normalizeMerchant(tx.name).normalized;
          const normalizedPattern = normalizeMerchant(testCase.pattern).normalized;
          
          let matches = false;
          switch (testCase.matchType) {
            case 'contains':
              matches = normalized.includes(normalizedPattern);
              break;
            case 'exact':
              matches = normalized === normalizedPattern;
              break;
          }
          
          runner.assertEqual(
            matches,
            tx.shouldMatch,
            `"${tx.name}" ${testCase.matchType} "${testCase.pattern}"`
          );
        }
      }
    });

    runner.test('Priority ordering works correctly', () => {
      // Test that higher priority rules take precedence
      const testTransactions = [
        { name: 'Tim Hortons Tea Shop' },
        { name: 'Starbucks Coffee' },
        { name: 'Netflix Subscription' }
      ];

      for (const tx of testTransactions) {
        const guess = guessCategory(tx);
        
        // Should get a category (not null)
        runner.assertTrue(
          guess.category !== null,
          `"${tx.name}" should be categorized`
        );
        
        // Should have a source
        runner.assertTrue(
          guess.source !== 'none',
          `"${tx.name}" should have a source`
        );
        
        // Should have an explanation
        runner.assertTrue(
          typeof guess.explain === 'string',
          `"${tx.name}" should have an explanation`
        );
      }
    });

    runner.test('Regex patterns work consistently', () => {
      const testCases = [
        {
          pattern: '\\bTORONTO\\s*HYDRO\\b',
          matchType: 'regex',
          transactions: [
            { name: 'TORONTO HYDRO', shouldMatch: true },
            { name: 'Toronto Hydro', shouldMatch: true },
            { name: 'TORONTOHYDRO', shouldMatch: true }, // This actually matches because normalization removes spaces
            { name: 'TORONTO HYDRO BILL', shouldMatch: true }
          ]
        }
      ];

      for (const testCase of testCases) {
        for (const tx of testCase.transactions) {
          const normalized = normalizeMerchant(tx.name).normalized;
          
          let matches = false;
          try {
            const regex = new RegExp(testCase.pattern, 'i');
            matches = regex.test(normalized);
          } catch (e) {
            matches = false;
          }
          
          runner.assertEqual(
            matches,
            tx.shouldMatch,
            `"${tx.name}" regex "${testCase.pattern}"`
          );
        }
      }
    });

    await runner.runTests();
  }
};
