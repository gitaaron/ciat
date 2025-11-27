/**
 * Utility functions for loading and managing manually overridden transactions
 * Manual overrides are stored in a flat JSON file mapping transaction hash -> category
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const flatDir = path.join(__dirname, '..', '..', 'flat');
const manualOverridesPath = path.join(flatDir, 'manual-overrides.json');

/**
 * Load manual overrides from the JSON file
 * @returns {Object} Map of transaction hash -> category
 */
export function loadManualOverrides() {
  try {
    if (!fs.existsSync(manualOverridesPath)) {
      // If file doesn't exist, create it with empty object
      saveManualOverrides({});
      return {};
    }
    
    const content = fs.readFileSync(manualOverridesPath, 'utf8');
    const data = JSON.parse(content);
    
    // Ensure we have an overrides object
    if (!data.overrides || typeof data.overrides !== 'object') {
      console.warn(`Invalid manual overrides file format, expected { overrides: {...} }`);
      return {};
    }
    
    return data.overrides;
  } catch (error) {
    console.error(`Error loading manual overrides from ${manualOverridesPath}:`, error);
    return {};
  }
}

/**
 * Save manual overrides to the JSON file
 * @param {Object} overrides - Map of transaction hash -> category
 */
export function saveManualOverrides(overrides) {
  try {
    // Ensure flat directory exists
    if (!fs.existsSync(flatDir)) {
      fs.mkdirSync(flatDir, { recursive: true });
    }
    
    const data = {
      overrides: overrides || {}
    };
    
    // Write to temporary file first, then rename (atomic write)
    const tempPath = manualOverridesPath + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, manualOverridesPath);
  } catch (error) {
    console.error(`Error saving manual overrides to ${manualOverridesPath}:`, error);
    throw error;
  }
}

/**
 * Add or update a manual override for a transaction hash
 * @param {string} hash - Transaction hash
 * @param {string} category - Category to override to
 */
export function addManualOverride(hash, category) {
  const overrides = loadManualOverrides();
  overrides[hash] = category;
  saveManualOverrides(overrides);
}

/**
 * Remove a manual override for a transaction hash
 * @param {string} hash - Transaction hash
 */
export function removeManualOverride(hash) {
  const overrides = loadManualOverrides();
  delete overrides[hash];
  saveManualOverrides(overrides);
}

/**
 * Get the category for a transaction hash if it has a manual override
 * @param {string} hash - Transaction hash
 * @returns {string|null} Category if override exists, null otherwise
 */
export function getManualOverride(hash) {
  const overrides = loadManualOverrides();
  return overrides[hash] || null;
}

/**
 * Get the manual overrides file path
 * @returns {string} Path to manual overrides file
 */
export function getManualOverridesPath() {
  return manualOverridesPath;
}

