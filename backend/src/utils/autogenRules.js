/**
 * Utility functions for loading and managing auto-generated rules
 * Autogen rules are stored in a flat JSON file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flatDir = path.join(__dirname, '..', '..', 'flat');
const autogenRulesPath = path.join(flatDir, 'autogen-rules.json');

/**
 * Load autogen rules from the JSON file
 * @returns {Array} Array of autogen rule objects
 */
export function loadAutogenRules() {
  try {
    if (!fs.existsSync(autogenRulesPath)) {
      // If file doesn't exist, create it with empty array
      saveAutogenRules([]);
      return [];
    }
    
    const content = fs.readFileSync(autogenRulesPath, 'utf8');
    const data = JSON.parse(content);
    
    // Ensure we have a rules array
    if (!data.rules || !Array.isArray(data.rules)) {
      console.warn(`Invalid autogen rules file format, expected { rules: [...] }`);
      return [];
    }
    
    return data.rules;
  } catch (error) {
    console.error(`Error loading autogen rules from ${autogenRulesPath}:`, error);
    return [];
  }
}

/**
 * Save autogen rules to the JSON file
 * @param {Array} rules - Array of autogen rule objects
 */
export function saveAutogenRules(rules) {
  try {
    // Ensure flat directory exists
    if (!fs.existsSync(flatDir)) {
      fs.mkdirSync(flatDir, { recursive: true });
    }
    
    const data = {
      rules: rules || []
    };
    
    // Write to temporary file first, then rename (atomic write)
    const tempPath = autogenRulesPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, autogenRulesPath);
  } catch (error) {
    console.error(`Error saving autogen rules to ${autogenRulesPath}:`, error);
    throw error;
  }
}

/**
 * Get the autogen rules file path
 * @returns {string} Path to autogen rules file
 */
export function getAutogenRulesPath() {
  return autogenRulesPath;
}

