import { NextRequest } from 'next/server'
import { supabase } from '../../../lib/supabaseClient'

export async function GET(req: NextRequest) {
  const { data, error } = await supabase
    .from('test2')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Supabase error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
