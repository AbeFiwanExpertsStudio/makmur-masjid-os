const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...vals] = line.split('=');
  const val = vals.join('=').trim().replace(/^["'](.*)["']$/, '$1');
  if (key && val) acc[key] = val;
  return acc;
}, {});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function check() {
  const { data, error } = await supabase.from('zakat_counters').select('name, date, start_time, end_time');
  console.log("Supabase raw date/time objects:", data);
  
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hr = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  
  console.log("Frontend constructed:");
  console.log("Date:", `${yyyy}-${mm}-${dd}`);
  console.log("Time:", `${hr}:${min}:${sec}`);
}

check();
