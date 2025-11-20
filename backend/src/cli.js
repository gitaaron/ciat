#!/usr/bin/env node

import { versioner } from './versioning.js';
import { program } from 'commander';
import readline from 'readline';

// Helper function for interactive confirmation
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
    });
  });
}

program
  .name('ciat-db')
  .description('CIAT Database Version Management CLI')
  .version('1.0.0');

// List versions command
program
  .command('list')
  .alias('ls')
  .description('List all database versions')
  .option('-l, --limit <number>', 'Limit number of versions to show', '20')
  .action((options) => {
    try {
      const versions = versioner.listVersions();
      const limit = parseInt(options.limit);
      const displayVersions = versions.slice(0, limit);
      
      if (displayVersions.length === 0) {
        console.log('No versions found.');
        return;
      }
      
      console.log('\n📊 Database Versions:');
      console.log('─'.repeat(80));
      console.log('ID'.padEnd(25) + 'Timestamp'.padEnd(20) + 'Size'.padEnd(10) + 'Description');
      console.log('─'.repeat(80));
      
      displayVersions.forEach(version => {
        const size = (version.size / 1024).toFixed(1) + 'KB';
        const timestamp = new Date(version.timestamp).toLocaleString();
        const id = version.id.substring(0, 24);
        const description = version.description || 'No description';
        
        console.log(
          id.padEnd(25) + 
          timestamp.padEnd(20) + 
          size.padEnd(10) + 
          description
        );
      });
      
      console.log('─'.repeat(80));
      console.log(`Showing ${displayVersions.length} of ${versions.length} versions\n`);
      
    } catch (error) {
      console.error('Error listing versions:', error.message);
      process.exit(1);
    }
  });

// Create version command
program
  .command('create')
  .alias('c')
  .description('Create a new database version')
  .argument('[description]', 'Description for the version')
  .action((description) => {
    try {
      const versionId = versioner.createVersion(description || 'Manual version');
      console.log(`✅ Created version: ${versionId}`);
    } catch (error) {
      console.error('Error creating version:', error.message);
      process.exit(1);
    }
  });

// Revert command
program
  .command('revert')
  .alias('r')
  .description('Revert to a specific database version')
  .argument('<version-id>', 'Version ID to revert to')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (versionId, options) => {
    try {
      if (!options.force) {
        console.log(`⚠️  This will revert the database to version: ${versionId}`);
        console.log('A backup of the current database will be created automatically.');
        
        const confirmed = await askConfirmation('Are you sure you want to continue? (y/N): ');
        if (!confirmed) {
          console.log('Operation cancelled.');
          return;
        }
      }
      
      const metadata = versioner.revertToVersion(versionId);
      console.log(`✅ Successfully reverted to version: ${versionId}`);
      console.log(`   Timestamp: ${metadata.timestamp}`);
      console.log(`   Description: ${metadata.description || 'No description'}`);
      
    } catch (error) {
      console.error('Error reverting version:', error.message);
      process.exit(1);
    }
  });

// Delete version command
program
  .command('delete')
  .alias('d')
  .description('Delete a specific database version')
  .argument('<version-id>', 'Version ID to delete')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (versionId, options) => {
    try {
      if (!options.force) {
        console.log(`⚠️  This will permanently delete version: ${versionId}`);
        
        const confirmed = await askConfirmation('Are you sure you want to continue? (y/N): ');
        if (!confirmed) {
          console.log('Operation cancelled.');
          return;
        }
      }
      
      versioner.deleteVersion(versionId);
      console.log(`✅ Successfully deleted version: ${versionId}`);
      
    } catch (error) {
      console.error('Error deleting version:', error.message);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .alias('w')
  .description('Start watching database for changes and auto-version')
  .option('-i, --interval <ms>', 'Check interval in milliseconds', '5000')
  .action((options) => {
    try {
      const interval = parseInt(options.interval);
      versioner.startWatching(interval);
      console.log(`👀 Watching database for changes (interval: ${interval}ms)`);
      console.log('Press Ctrl+C to stop watching...');
      
      // Keep the process alive
      process.stdin.resume();
      
    } catch (error) {
      console.error('Error starting watch:', error.message);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up old versions, keeping only the most recent ones')
  .option('-k, --keep <number>', 'Number of versions to keep', '10')
  .action((options) => {
    try {
      const keepCount = parseInt(options.keep);
      versioner.cleanupVersions(keepCount);
      console.log(`✅ Cleanup completed. Keeping ${keepCount} most recent versions.`);
      
    } catch (error) {
      console.error('Error during cleanup:', error.message);
      process.exit(1);
    }
  });

// Wipe command
program
  .command('wipe')
  .description('Wipe all database versions (complete cleanup)')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.force) {
        console.log('⚠️  This will permanently delete ALL database versions');
        
        const confirmed = await askConfirmation('Are you sure you want to continue? (y/N): ');
        if (!confirmed) {
          console.log('Operation cancelled.');
          return;
        }
      }
      
      versioner.wipeAllVersions();
      console.log('✅ Successfully wiped all database versions');
      
    } catch (error) {
      console.error('Error wiping versions:', error.message);
      process.exit(1);
    }
  });

// Clear command
program
  .command('clear')
  .description('Clear all data from the database (transactions, accounts, and rules)')
  .option('-f, --force', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      if (!options.force) {
        console.log('⚠️  This will permanently delete ALL transactions, accounts, and rules from the database');
        console.log('This action cannot be undone!');
        
        const confirmed = await askConfirmation('Are you sure you want to continue? (y/N): ');
        if (!confirmed) {
          console.log('Operation cancelled.');
          return;
        }
      }
      
      await versioner.clearAllData();
      
    } catch (error) {
      console.error('Error clearing database:', error.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .alias('s')
  .description('Show current database status and version info')
  .action(() => {
    try {
      const currentHash = versioner.calculateDatabaseHash();
      const versions = versioner.listVersions();
      const latestVersion = versions[0];
      
      console.log('\n📊 Database Status:');
      console.log('─'.repeat(50));
      console.log(`Current Hash: ${currentHash}`);
      console.log(`Total Versions: ${versions.length}`);
      
      if (latestVersion) {
        console.log(`Latest Version: ${latestVersion.id}`);
        console.log(`Latest Timestamp: ${new Date(latestVersion.timestamp).toLocaleString()}`);
        console.log(`Latest Description: ${latestVersion.description || 'No description'}`);
        
        if (latestVersion.hash === currentHash) {
          console.log('✅ Database matches latest version');
        } else {
          console.log('⚠️  Database has uncommitted changes');
        }
      } else {
        console.log('No versions found');
      }
      
      console.log('─'.repeat(50));
      
    } catch (error) {
      console.error('Error getting status:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
