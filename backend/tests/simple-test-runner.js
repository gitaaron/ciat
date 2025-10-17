#!/usr/bin/env node

/**
 * Simple test runner that directly imports test modules
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SimpleTestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.startTime = Date.now();
  }

  async run(testName = 'all') {
    console.log('🧪 CIAT Backend Test Suite\n');
    
    try {
      if (testName === 'all' || testName === 'normalization') {
        await this.runTest('Normalization Consistency Tests', () => import('./normalization-consistency.test.js'));
      }
      
      if (testName === 'all' || testName === 'matching') {
        await this.runTest('Rule Matching Consistency Tests', () => import('./rule-matching-consistency.test.js'));
      }
      
      if (testName === 'all' || testName === 'tea') {
        await this.runTest('Tea Rule Integration Tests', () => import('./tea-rule-integration.test.js'));
      }
      
      this.printSummary();
    } catch (error) {
      console.log(`❌ Test runner error: ${error.message}`);
      this.failed++;
      this.printSummary();
    }
  }

  async runTest(name, importFn) {
    try {
      console.log(`\n📋 Running: ${name}`);
      console.log('─'.repeat(50));
      
      const testModule = await importFn();
      if (testModule.default?.run) {
        await testModule.default.run(this);
      } else {
        console.log('❌ Test module does not export a run function');
        this.failed++;
      }
    } catch (error) {
      console.log(`❌ Failed to load test: ${error.message}`);
      this.failed++;
    }
  }

  test(name, testFn) {
    this.tests.push({ name, fn: testFn });
  }

  async runTests() {
    for (const test of this.tests) {
      try {
        await test.fn();
        console.log(`✅ ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${test.name}`);
        console.log(`   ${error.message}`);
        this.failed++;
      }
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected "${expected}", got "${actual}"`);
    }
  }

  assertTrue(condition, message) {
    this.assert(condition, message);
  }

  assertFalse(condition, message) {
    this.assert(!condition, message);
  }

  assertContains(haystack, needle, message) {
    if (!haystack.includes(needle)) {
      throw new Error(`${message}: "${haystack}" does not contain "${needle}"`);
    }
  }

  printSummary() {
    const duration = Date.now() - this.startTime;
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
    if (this.failed === 0) {
      console.log('\n🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('\n💥 Some tests failed!');
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testName = process.argv[2] || 'all';
  const runner = new SimpleTestRunner();
  await runner.run(testName);
}

export default SimpleTestRunner;
