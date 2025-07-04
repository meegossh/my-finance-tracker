/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, apikey"
      },
    });
  }

  try {
    const { email, password } = await req.json();

    const supabase = createClient(
        Deno.env.get("URL") ?? "",
        Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password
    });

    return new Response(
      JSON.stringify({ data, error }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err)
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
