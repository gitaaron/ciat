/**
 * Utility functions for loading and managing system-level rules
 * System rules are stored in a flat JSON file and have the lowest priority
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flatDir = path.join(__dirname, '..', 'flat');
const systemRulesPath = path.join(flatDir, 'system-rules.json');

/**
 * Load system rules from the JSON file
 * @returns {Array} Array of system rule objects
 */
export function loadSystemRules() {
  try {
    if (!fs.existsSync(systemRulesPath)) {
      // If file doesn't exist, return empty array (or create default file)
      console.warn(`System rules file not found at ${systemRulesPath}, returning empty array`);
      return [];
    }
    
    const content = fs.readFileSync(systemRulesPath, 'utf8');
    const data = JSON.parse(content);
    
    // Ensure we have a rules array
    if (!data.rules || !Array.isArray(data.rules)) {
      console.warn(`Invalid system rules file format, expected { rules: [...] }`);
      return [];
    }
    
    // Add default timestamps if not present
    return data.rules.map(rule => ({
      ...rule,
      created_at: rule.created_at || new Date(0).toISOString(),
      updated_at: rule.updated_at || new Date(0).toISOString()
    }));
  } catch (error) {
    console.error(`Error loading system rules from ${systemRulesPath}:`, error);
    return [];
  }
}

/**
 * Get the system rules file path
 * @returns {string} Path to system rules file
 */
export function getSystemRulesPath() {
  return systemRulesPath;
}

