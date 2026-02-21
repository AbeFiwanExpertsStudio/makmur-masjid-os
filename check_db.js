const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) acc[key] = vals.join('=').trim();
  return acc;
}, {});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function check() {
  console.log("Checking user_roles...");
  const { data: roles, error: err1 } = await supabase.from('user_roles').select('*');
  console.log("Roles Array:", roles, "Error:", err1);
}

check();
