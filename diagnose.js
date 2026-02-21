const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key) acc[key.trim()] = val.join('=').trim().replace(/^"|"$/g, '');
  return acc;
}, {});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("-----------------------------------------");
  const [eventsRes, volRes, donRes, zakatRes] = await Promise.all([
    supabase.from("food_events").select("total_capacity, remaining_capacity"),
    supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "volunteer"),
    supabase.from("donations").select("amount"),
    supabase.from("zakat_counters").select("start_date, end_date, start_time, end_time, is_active"),
  ]);

  console.log("food_events error:", eventsRes.error);
  console.log("user_roles error:", volRes.error);
  console.log("donations error:", donRes.error);
  console.log("zakat_counters error:", zakatRes.error);
  console.log("-----------------------------------------");
}

run();
