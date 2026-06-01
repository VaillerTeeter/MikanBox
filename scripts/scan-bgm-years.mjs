/**
 * One-shot script: scan Bangumi API for years 1949-2000 that have anime (type=2).
 * Run: node scripts/scan-bgm-years.mjs
 *
 * Output: a TS array literal ready to paste into QueryPage.tsx.
 */

import { createBangumiClient } from 'bangumi-api-client';

const bgm = createBangumiClient({ userAgent: 'MikanBox/0.1.0' });

const START = 1900;
const END = 1948;
const DELAY_MS = 400; // be polite to Bangumi API

const validYears = [];

console.log(`Scanning ${START}–${END} for anime (type=2)...\n`);

for (let year = START; year <= END; year++) {
  try {
    const { data, error } = await bgm.subjects.getSubjects({
      type: 2,
      year,
      limit: 1,
    });

    if (error) {
      console.error(`  ${year}: ERROR – ${String(error)}`);
    } else {
      const total = data?.total ?? 0;
      if (total > 0) {
        validYears.push(year);
        console.log(`  ${year}: ${total} ✓`);
      } else {
        console.log(`  ${year}: 0`);
      }
    }
  } catch (e) {
    console.error(`  ${year}: EXCEPTION – ${e}`);
  }

  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log('\n========== RESULT ==========');
console.log(`Valid years (${validYears.length} total):`);
console.log(JSON.stringify(validYears));
console.log('\nPaste into QueryPage.tsx:');
console.log(`const HISTORICAL_YEARS: number[] = ${JSON.stringify(validYears)};`);
