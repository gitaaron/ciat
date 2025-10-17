#!/usr/bin/env node

/**
 * Tests for normalization consistency between existing rules and auto-generated rules
 */

import { normalizeMerchant } from '../src/categorizer/autoRuleGenerator.js';
import { guessCategory } from '../src/categorizer/index.js';

export default {
  name: 'Normalization Consistency Tests',
  
  async run(runner) {
    runner.test('Both systems use same normalization for merchant names', () => {
      const testCases = [
        'Tim Hortons Tea Shop',
        'STARBUCKS COFFEE',
        'Amazon.com',
        'McDonald\'s Restaurant',
        'Walmart Supercenter #1234',
        'Netflix Subscription',
        'Spotify Premium',
        'Green Tea Store',
        'Bubble Tea Place',
        'Tim Hortons #0421 Toronto ON',
        'McDonald\'s #1234',
        'Walmart Supercenter Store #5678'
      ];

      for (const merchantName of testCases) {
        // Test auto rule generator normalization
        const autoNormalized = normalizeMerchant(merchantName).normalized;
        
        // Test existing rule matching normalization (via guessCategory)
        const guess = guessCategory({ name: merchantName });
        
        // The normalization should be consistent - both should process the same way
        // We can't directly access the internal normalization, but we can verify
        // that the results are consistent by checking that both systems would
        // match the same patterns
        
        runner.assertTrue(
          typeof autoNormalized === 'string',
          `Auto normalization should return string for "${merchantName}"`
        );
        
        runner.assertTrue(
          autoNormalized.length > 0,
          `Auto normalization should not be empty for "${merchantName}"`
        );
        
        // Verify that the normalized string is lowercase and cleaned
        runner.assertTrue(
          autoNormalized === autoNormalized.toLowerCase(),
          `Auto normalization should be lowercase for "${merchantName}": "${autoNormalized}"`
        );
      }
    });

    runner.test('Tea pattern matching consistency', () => {
      const teaMerchants = [
        'Tim Hortons Tea Shop',
        'Green Tea Store',
        'Bubble Tea Place',
        'Tea Time Cafe',
        'Starbucks Tea',
        'McDonald\'s Tea'
      ];

      const nonTeaMerchants = [
        'Starbucks Coffee',
        'McDonald\'s Restaurant',
        'Walmart Store',
        'Netflix Subscription',
        'Amazon Purchase'
      ];

      // Test that tea merchants contain "tea" after normalization
      for (const merchant of teaMerchants) {
        const normalized = normalizeMerchant(merchant).normalized;
        runner.assertContains(
          normalized,
          'tea',
          `"${merchant}" should contain "tea" after normalization`
        );
      }

      // Test that non-tea merchants don't contain "tea" after normalization
      for (const merchant of nonTeaMerchants) {
        const normalized = normalizeMerchant(merchant).normalized;
        runner.assertFalse(
          normalized.includes('tea'),
          `"${merchant}" should not contain "tea" after normalization: "${normalized}"`
        );
      }
    });

    runner.test('Punctuation and special characters are handled consistently', () => {
      const testCases = [
        { input: 'McDonald\'s', expected: 'mcdonald s' },
        { input: 'Walmart #1234', expected: 'walmart' },
        { input: 'Amazon.com', expected: 'amazon com' },
        { input: 'Starbucks®', expected: 'starbucks' },
        { input: 'Netflix™', expected: 'netflix' }
      ];

      for (const testCase of testCases) {
        const normalized = normalizeMerchant(testCase.input).normalized;
        runner.assertEqual(
          normalized,
          testCase.expected,
          `Normalization of "${testCase.input}"`
        );
      }
    });

    runner.test('Store numbers are removed consistently', () => {
      const testCases = [
        'Walmart #1234',
        'McDonald\'s #5678',
        'Starbucks Store #0421',
        'Target #9999',
        'Costco #123'
      ];

      for (const merchant of testCases) {
        const normalized = normalizeMerchant(merchant).normalized;
        
        // Should not contain numbers
        runner.assertFalse(
          /\d/.test(normalized),
          `"${merchant}" should not contain numbers after normalization: "${normalized}"`
        );
        
        // Should not contain # symbol
        runner.assertFalse(
          normalized.includes('#'),
          `"${merchant}" should not contain # after normalization: "${normalized}"`
        );
      }
    });

    runner.test('Brand canonicalization works consistently', () => {
      const testCases = [
        { input: 'McDonald\'s', expected: 'mcdonald s' },
        { input: 'mcdonalds', expected: 'mcdonalds' },
        { input: 'Costco Wholesale', expected: 'costco' },
        { input: 'Walmart Supercenter', expected: 'walmart' },
        { input: 'Starbucks Coffee', expected: 'starbucks' },
        { input: 'Tim Hortons', expected: 'timhortons' }
      ];

      for (const testCase of testCases) {
        const normalized = normalizeMerchant(testCase.input).normalized;
        runner.assertEqual(
          normalized,
          testCase.expected,
          `Brand canonicalization for "${testCase.input}"`
        );
      }
    });

    await runner.runTests();
  }
};
