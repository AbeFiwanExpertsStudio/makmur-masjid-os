const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...vals] = line.split('=');
  const val = vals.join('=').trim();
  if (key && val) acc[key] = val.replace(/^["'](.*)["']$/, '$1'); // trim quotes
  return acc;
}, {});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function check() {
  console.log("Checking user_roles securely...");
  const { data: roles, error: err1 } = await supabase.from('user_roles').select('*');
  console.log("Roles Array:", roles, "Error:", err1);

  if (!err1) {
    const { data: users, error: err2 } = await supabase.auth.admin.listUsers();
    console.log("Users Map:", users.users.map(u => ({ id: u.id, email: u.email })));
  }
}

check();
