#!/usr/bin/env node

/**
 * Integration test for the specific "tea rule" scenario that was causing issues
 * This test ensures that existing "tea" rules and auto-generated "tea" rules
 * match the same transactions consistently.
 */

import { normalizeMerchant, generateAutoRules } from '../src/categorizer/autoRuleGenerator.js';
import { guessCategory, getRulesUsedInImport } from '../src/categorizer/index.js';

export default {
  name: 'Tea Rule Integration Tests',
  
  async run(runner) {
    runner.test('Tea rule consistency - existing vs auto-generated', () => {
      // Create test transactions that contain "tea"
      const teaTransactions = [
        { name: 'Tim Hortons Tea Shop', amount: -5.99, date: '2025-01-01', category: 'guilt_free' },
        { name: 'Green Tea Store', amount: -12.50, date: '2025-01-02', category: 'guilt_free' },
        { name: 'Bubble Tea Place', amount: -8.75, date: '2025-01-03', category: 'guilt_free' },
        { name: 'Tea Time Cafe', amount: -6.25, date: '2025-01-04', category: 'guilt_free' },
        { name: 'Starbucks Tea', amount: -4.50, date: '2025-01-05', category: 'guilt_free' }
      ];

      // Test 1: Existing rule matching
      for (const tx of teaTransactions) {
        const guess = guessCategory(tx);
        
        // Should be categorized (not null)
        runner.assertTrue(
          guess.category !== null,
          `"${tx.name}" should be categorized by existing rules`
        );
        
        // Should be categorized as guilt_free (based on existing tea rules)
        runner.assertEqual(
          guess.category,
          'guilt_free',
          `"${tx.name}" should be categorized as guilt_free`
        );
        
        // Should have a rule_id and rule_type
        runner.assertTrue(
          guess.rule_id !== undefined,
          `"${tx.name}" should have a rule_id`
        );
        
        runner.assertEqual(
          guess.rule_type,
          'user_rule',
          `"${tx.name}" should be matched by a user rule`
        );
      }

      // Test 2: Auto rule generation
      const autoRulesResult = generateAutoRules(teaTransactions);
      const teaAutoRules = autoRulesResult.rules.filter(rule => 
        rule.pattern && rule.pattern.toLowerCase().includes('tea')
      );
      
      // Should generate tea-related auto rules
      runner.assertTrue(
        teaAutoRules.length > 0,
        'Should generate tea-related auto rules'
      );
      
      // Test 3: Auto rule matching consistency
      for (const autoRule of teaAutoRules) {
        for (const tx of teaTransactions) {
          const normalized = normalizeMerchant(tx.name).normalized;
          const normalizedPattern = normalizeMerchant(autoRule.pattern).normalized;
          
          let autoRuleMatches = false;
          switch (autoRule.type) {
            case 'contains':
              autoRuleMatches = normalized.includes(normalizedPattern);
              break;
            case 'exact':
              autoRuleMatches = normalized === normalizedPattern;
              break;
          }
          
          // If the auto rule matches, the existing rule should also match
          if (autoRuleMatches) {
            const existingGuess = guessCategory(tx);
            runner.assertTrue(
              existingGuess.category !== null,
              `"${tx.name}" should be matched by existing rules if auto rule matches`
            );
          }
        }
      }
    });

    runner.test('Used rules detection works correctly', () => {
      // Create transactions with rule_id and rule_type set (simulating import)
      const transactionsWithRules = [
        { 
          name: 'Tim Hortons Tea Shop', 
          amount: -5.99, 
          date: '2025-01-01', 
          category: 'guilt_free',
          rule_id: 'rule_1760714801814_j96y0vnny', // Existing tea rule ID
          rule_type: 'user_rule'
        },
        { 
          name: 'Green Tea Store', 
          amount: -12.50, 
          date: '2025-01-02', 
          category: 'guilt_free',
          rule_id: 'rule_1760714801814_j96y0vnny', // Same tea rule ID
          rule_type: 'user_rule'
        }
      ];

      const usedRules = getRulesUsedInImport(transactionsWithRules);
      
      // Should find the tea rule as used
      const teaRule = usedRules.find(rule => 
        rule.id === 'rule_1760714801814_j96y0vnny'
      );
      
      runner.assertTrue(
        teaRule !== undefined,
        'Should find the tea rule in used rules'
      );
      
      runner.assertEqual(
        teaRule.type,
        'user_rule',
        'Tea rule should be identified as user_rule'
      );
      
      runner.assertEqual(
        teaRule.transactions.length,
        2,
        'Tea rule should have 2 matching transactions'
      );
    });

    runner.test('Normalization produces consistent results', () => {
      const testCases = [
        'Tim Hortons Tea Shop',
        'Green Tea Store',
        'Bubble Tea Place',
        'Tea Time Cafe',
        'Starbucks Tea'
      ];

      for (const merchantName of testCases) {
        const normalized = normalizeMerchant(merchantName).normalized;
        
        // All should contain "tea" after normalization
        runner.assertContains(
          normalized,
          'tea',
          `"${merchantName}" should contain "tea" after normalization`
        );
        
        // Should be lowercase
        runner.assertEqual(
          normalized,
          normalized.toLowerCase(),
          `"${merchantName}" normalization should be lowercase`
        );
        
        // Should not contain punctuation
        runner.assertFalse(
          /[^\w\s]/.test(normalized),
          `"${merchantName}" normalization should not contain punctuation: "${normalized}"`
        );
      }
    });

    runner.test('Pattern matching edge cases', () => {
      const edgeCases = [
        { name: 'Tea', shouldMatch: true },
        { name: 'TEA', shouldMatch: true },
        { name: 'tea', shouldMatch: true },
        { name: 'Tea Shop', shouldMatch: true },
        { name: 'Green Tea', shouldMatch: true },
        { name: 'Bubble Tea Place', shouldMatch: true },
        { name: 'Tim Hortons Tea', shouldMatch: true },
        { name: 'Starbucks Coffee', shouldMatch: false },
        { name: 'McDonald\'s', shouldMatch: false },
        { name: 'Netflix', shouldMatch: false }
      ];

      for (const testCase of edgeCases) {
        const normalized = normalizeMerchant(testCase.name).normalized;
        const containsTea = normalized.includes('tea');
        
        runner.assertEqual(
          containsTea,
          testCase.shouldMatch,
          `"${testCase.name}" tea detection`
        );
      }
    });

    await runner.runTests();
  }
};
