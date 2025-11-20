/**
 * Utility functions for loading and managing user-level rules
 * User rules are stored in a flat JSON file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flatDir = path.join(__dirname, '..', '..', 'flat');
const userRulesPath = path.join(flatDir, 'user-rules.json');

/**
 * Load user rules from the JSON file
 * @returns {Array} Array of user rule objects
 */
export function loadUserRules() {
  try {
    if (!fs.existsSync(userRulesPath)) {
      // If file doesn't exist, create it with empty array
      saveUserRules([]);
      return [];
    }
    
    const content = fs.readFileSync(userRulesPath, 'utf8');
    const data = JSON.parse(content);
    
    // Ensure we have a rules array
    if (!data.rules || !Array.isArray(data.rules)) {
      console.warn(`Invalid user rules file format, expected { rules: [...] }`);
      return [];
    }
    
    return data.rules;
  } catch (error) {
    console.error(`Error loading user rules from ${userRulesPath}:`, error);
    return [];
  }
}

/**
 * Save user rules to the JSON file
 * @param {Array} rules - Array of user rule objects
 */
export function saveUserRules(rules) {
  try {
    // Ensure flat directory exists
    if (!fs.existsSync(flatDir)) {
      fs.mkdirSync(flatDir, { recursive: true });
    }
    
    const data = {
      rules: rules || []
    };
    
    // Write to temporary file first, then rename (atomic write)
    const tempPath = userRulesPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, userRulesPath);
  } catch (error) {
    console.error(`Error saving user rules to ${userRulesPath}:`, error);
    throw error;
  }
}

/**
 * Get the user rules file path
 * @returns {string} Path to user rules file
 */
export function getUserRulesPath() {
  return userRulesPath;
}

