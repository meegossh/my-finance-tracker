import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Application-Name, apikey"
}

interface SignupBody {
  email: string
  password: string
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders
    })
  }

  let body: SignupBody
  try {
    const rawBody = await req.text()
    console.log("Raw request body:", rawBody)
    body = JSON.parse(rawBody)
  } catch (err) {
    console.error("JSON parse error:", err)
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { email, password } = body
  console.log("Parsed body:", { email, password })

  if (!email || !password) {
    console.error("Missing email or password in request.")
    return new Response(
      JSON.stringify({ error: "Missing email or password" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }

  const { data, error } = await supabase.auth.signUp({ email, password })
  console.log("Signup result:", { data, error })

  return new Response(
    JSON.stringify({ user: data?.user, error }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})
