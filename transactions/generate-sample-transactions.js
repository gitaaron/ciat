#!/usr/bin/env node

/**
 * Generate realistic sample transaction data - simple version that writes directly
 */

const fs = require('fs');
const path = require('path');

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Generate chequing - write directly to file
function generateChequing(filePath) {
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
  const endDate = new Date();
  let count = 0;

  // Salary 1 (bi-weekly)
  let d = new Date('2023-01-06');
  while (d <= endDate && count < 200) {
    stream.write(`${formatDate(d)},Electronic Funds Transfer DEPOSIT EMPLOYER SALARY,,${randomBetween(4500, 5200).toFixed(2)}\n`);
    d = addDays(d, 14);
    count++;
  }

  // Salary 2 (bi-weekly, offset)
  d = new Date('2023-01-13');
  while (d <= endDate && count < 400) {
    stream.write(`${formatDate(d)},Electronic Funds Transfer DEPOSIT EMPLOYER SALARY,,${randomBetween(3800, 4500).toFixed(2)}\n`);
    d = addDays(d, 14);
    count++;
  }

  // Mortgage (monthly)
  d = new Date('2023-01-01');
  while (d <= endDate && count < 500) {
    stream.write(`${formatDate(d)},Electronic Funds Transfer PREAUTHORIZED DEBIT MORTGAGE COMPANY,${randomBetween(2400, 2600).toFixed(2)},\n`);
    d.setMonth(d.getMonth() + 1);
    count++;
  }

  // Car payments
  d = new Date('2023-01-15');
  while (d <= endDate && count < 600) {
    stream.write(`${formatDate(d)},Electronic Funds Transfer PREAUTHORIZED DEBIT AUTO FINANCE COMPANY,${randomBetween(380, 420).toFixed(2)},\n`);
    d.setMonth(d.getMonth() + 1);
    count++;
  }

  d = new Date('2023-01-20');
  while (d <= endDate && count < 700) {
    stream.write(`${formatDate(d)},Electronic Funds Transfer PREAUTHORIZED DEBIT AUTO LOAN COMPANY,${randomBetween(320, 360).toFixed(2)},\n`);
    d.setMonth(d.getMonth() + 1);
    count++;
  }

  // Insurance (quarterly)
  d = new Date('2023-01-01');
  while (d <= endDate && count < 750) {
    if ([0, 3, 6, 9].includes(d.getMonth())) {
      stream.write(`${formatDate(d)},Electronic Funds Transfer PREAUTHORIZED DEBIT AUTO INSURANCE,${randomBetween(1200, 1400).toFixed(2)},\n`);
      count++;
    }
    d.setMonth(d.getMonth() + 1);
  }

  // Childcare
  d = new Date('2023-01-01');
  while (d <= endDate && count < 850) {
    stream.write(`${formatDate(d)},Electronic Funds Transfer PREAUTHORIZED DEBIT ABC CHILDREN'S CENTRE,${randomBetween(1200, 1500).toFixed(2)},\n`);
    d.setMonth(d.getMonth() + 1);
    count++;
  }

  // Utilities
  const utils = ['ELECTRIC COMPANY', 'GAS UTILITY', 'WATER & SEWER', 'INTERNET PROVIDER', 'CELL PHONE COMPANY'];
  d = new Date('2023-01-05');
  while (d <= endDate && count < 1000) {
    stream.write(`${formatDate(d)},Electronic Funds Transfer PREAUTHORIZED DEBIT ${randomElement(utils)},${randomBetween(80, 200).toFixed(2)},\n`);
    d.setMonth(d.getMonth() + 1);
    count++;
  }

  // Groceries (limited)
  d = new Date('2023-01-03');
  let groceryCount = 0;
  while (d <= endDate && groceryCount < 100) {
    if (Math.random() > 0.3) {
      stream.write(`${formatDate(d)},Point of Sale - Interac RETAIL PURCHASE ${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')} GROCERY STORE,${randomBetween(120, 220).toFixed(2)},\n`);
      groceryCount++;
      count++;
    }
    d = addDays(d, Math.floor(Math.random() * 4) + 5);
  }

  stream.end();
  return count;
}

// Generate visa - write directly
function generateVisa(filePath) {
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
  const startDate = new Date('2023-01-01');
  const endDate = new Date();
  let currentDate = new Date(startDate);
  let count = 0;
  const maxTransactions = 1500;

  const merchants = {
    gas: ['GAS STATION #123', 'FUEL CENTER #456', 'GAS STATION #789'],
    groceries: ['GROCERY STORE', 'SUPERMARKET CHAIN', 'ORGANIC FOOD MARKET'],
    coffee: ['STARBUCKS COFFEE', 'TIM HORTONS', 'COFFEE SHOP'],
    restaurants: ['RESTAURANT #101', 'FAST FOOD CHAIN', 'FAMILY RESTAURANT', 'PIZZA PLACE'],
    online: ['AMAZON.COM PURCHASE', 'ONLINE RETAILER', 'TARGET.COM'],
    kids: ['TOY STORE', 'CHILDREN\'S CLOTHING', 'KIDS SHOE STORE'],
    pharmacy: ['PHARMACY #123', 'DRUG STORE'],
    home: ['HOME DEPOT', 'HOME IMPROVEMENT', 'HARDWARE STORE'],
    entertainment: ['MOVIE THEATER', 'AMUSEMENT PARK', 'ZOO'],
    vacation: ['HOTEL RESERVATION', 'AIRLINE TICKETS', 'RENTAL CAR COMPANY', 'VACATION RENTAL']
  };

  while (currentDate <= endDate && count < maxTransactions) {
    // Skip 50% of days
    if (Math.random() < 0.5) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    const isSummer = currentDate.getMonth() >= 5 && currentDate.getMonth() <= 7;

    // Gas
    if (Math.random() > (isWeekend ? 0.4 : 0.6) && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.gas)} #${Math.floor(Math.random() * 1000)},${randomBetween(45, 75).toFixed(2)},\n`);
      count++;
    }

    // Groceries
    if (Math.random() > 0.65 && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.groceries)} #${Math.floor(Math.random() * 1000)},${randomBetween(85, 180).toFixed(2)},\n`);
      count++;
    }

    // Coffee
    if (Math.random() > 0.5 && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.coffee)} #${Math.floor(Math.random() * 1000)},${randomBetween(5, 15).toFixed(2)},\n`);
      count++;
    }

    // Restaurants
    if (Math.random() > (isWeekend ? 0.6 : 0.8) && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.restaurants)} #${Math.floor(Math.random() * 1000)},${randomBetween(35, 120).toFixed(2)},\n`);
      count++;
    }

    // Online
    if (Math.random() > 0.75 && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.online)} #${Math.floor(Math.random() * 1000000)},${randomBetween(25, 250).toFixed(2)},\n`);
      count++;
    }

    // Kids
    if (Math.random() > 0.93 && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.kids)} #${Math.floor(Math.random() * 1000)},${randomBetween(30, 150).toFixed(2)},\n`);
      count++;
    }

    // Pharmacy
    if (Math.random() > 0.93 && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.pharmacy)} #${Math.floor(Math.random() * 1000)},${randomBetween(20, 80).toFixed(2)},\n`);
      count++;
    }

    // Home
    if (Math.random() > 0.93 && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.home)} #${Math.floor(Math.random() * 1000)},${randomBetween(50, 400).toFixed(2)},\n`);
      count++;
    }

    // Entertainment
    if (Math.random() > (isSummer ? 0.88 : 0.95) && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.entertainment)} #${Math.floor(Math.random() * 1000)},${randomBetween(40, 200).toFixed(2)},\n`);
      count++;
    }

    // Vacation (summer)
    if (isSummer && Math.random() > 0.85 && count < maxTransactions) {
      stream.write(`${formatDate(currentDate)},PURCHASE ${randomElement(merchants.vacation)} #${Math.floor(Math.random() * 1000)},${randomBetween(100, 800).toFixed(2)},\n`);
      count++;
    }

    currentDate = addDays(currentDate, 1);
  }

  stream.end();
  return count;
}

// Main
const chequingPath = path.join(__dirname, '..', 'transactions', 'chequing.csv');
const visaPath = path.join(__dirname, '..', 'transactions', 'visa.csv');

console.log('Generating chequing account transactions...');
const chequingCount = generateChequing(chequingPath);
console.log(`Generated ${chequingCount} chequing transactions`);

console.log('Generating visa credit card transactions...');
const visaCount = generateVisa(visaPath);
console.log(`Generated ${visaCount} visa transactions`);

console.log('Done!');

