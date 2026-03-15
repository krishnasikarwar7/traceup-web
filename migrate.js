/**
 * Migration via Supabase HTTP API
 * Uses the service_role key to call Supabase's internal SQL endpoint
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'files', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const SQL_STATEMENTS = [
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS security_question TEXT',
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS security_answer TEXT'
];

async function tryEndpoint(url, method, headers, body) {
  try {
    const opts = { method, headers };
    if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return { ok: false, status: 0, text: err.message };
  }
}

async function migrate() {
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('');
  
  // Method 1: Try Supabase SQL API (v1/query endpoint)
  for (const sql of SQL_STATEMENTS) {
    console.log(`Running: ${sql}`);
    
    // Try the /rest/v1/rpc approach - won't work for DDL but let's try
    // Try the /pg endpoint that some Supabase instances support
    const endpoints = [
      {
        name: 'SQL query endpoint',
        url: `${SUPABASE_URL}/rest/v1/rpc/`,
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: { query: sql }
      }
    ];
    
    for (const ep of endpoints) {
      const result = await tryEndpoint(ep.url, ep.method, ep.headers, ep.body);
      console.log(`  ${ep.name}: ${result.status} - ${result.text.substring(0, 200)}`);
    }
  }
  
  // Method 2: Try using supabase-js to check and use schema cache reload
  console.log('\n--- Checking current column state via PostgREST ---');
  const checkRes = await tryEndpoint(
    `${SUPABASE_URL}/rest/v1/users?select=security_question&limit=0`,
    'GET',
    {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    }
  );
  console.log(`Column check: ${checkRes.status} - ${checkRes.text.substring(0, 300)}`);
  
  if (checkRes.ok) {
    console.log('\n✅ security_question column already exists!');
  } else {
    console.log('\n⚠️  Column does not exist yet. DDL cannot be run via REST API.');
    console.log('The SQL must be run in the Supabase SQL Editor.');
  }
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
