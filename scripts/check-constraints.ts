import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  console.log("Checking DB constraints for 'kupon_claims'...");
  try {
    const { data, error } = await supabase.rpc('get_kupon_claims_by_device', { p_device_uuid: 'dummy' });
    console.log("RPC exists!", !!data, error);
    
    // We cannot query pg_constraint easily through REST API, but we know the constraints:
    // 1. kupon_claims_pkey
    // 2. kupon_claims_event_id_device_uuid_key
    // 3. Probably kupon_claims_event_id_guest_uuid_key
    // Let's just output this thought.
  } catch (err) {
    console.error(err);
  }
}

checkConstraints();
