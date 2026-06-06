#!/usr/bin/env node
/* Writes config.js from environment variables (used on Vercel deploy). */
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';
const email = process.env.ADMIN_EMAIL || 'cody@gmail.com';
const password = process.env.ADMIN_PASSWORD || 'Welcome1!';

const out = `/* Generated at deploy time — do not edit on Vercel. Set env vars in the Vercel dashboard. */
window.GREENLIGHT_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(url)},
  SUPABASE_ANON_KEY: ${JSON.stringify(key)},
  ADMIN_EMAIL: ${JSON.stringify(email)},
  ADMIN_PASSWORD: ${JSON.stringify(password)}
};
`;

const target = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(target, out, 'utf8');
console.log('config.js written', url ? '(Supabase connected)' : '(local mode — add SUPABASE_URL + SUPABASE_ANON_KEY env vars)');
