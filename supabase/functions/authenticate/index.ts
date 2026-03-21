// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, password, turnstileToken, action, clientIp } = await req.json();

    if (!email || !password || !turnstileToken) {
      return new Response(JSON.stringify({ error: "Missing required fields in payload (email, password, or token)" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Cloudflare Turnstile Verification
    const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!TURNSTILE_SECRET) {
      console.error("CRITICAL: Missing TURNSTILE_SECRET_KEY in environment variables.");
      return new Response(JSON.stringify({ error: "Missing Turnstile Secret Key in Edge environment" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Turnstile Token received:", turnstileToken);

    const formData = new FormData();
    formData.append('secret', TURNSTILE_SECRET);
    formData.append('response', turnstileToken);
    
    // Optionally append IP if passed, otherwise Cloudflare uses the caller IP
    // formData.append('remoteip', clientIp); 

    const turnstileCheck = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const turnstileOutcome = await turnstileCheck.json();
    console.log("Cloudflare Response:", turnstileOutcome);
    
    if (!turnstileOutcome.success) {
      return new Response(JSON.stringify({ 
        error: "Cloudflare rejected the token", 
        details: turnstileOutcome['error-codes'] 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Rate Limiting Check (Anti-Brute Force)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Admin key for bypassing RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identifier = email || clientIp || 'unknown';
    
    // Store attempt in our DB
    await supabaseAdmin.from('auth_rate_limits').insert([
      { identifier, attempt_type: action }
    ]);

    // Check recent attempts
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin
      .from('auth_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('created_at', fifteenMinsAgo);

    if (countError) throw countError;
    
    if (count && count > 5) {
      return new Response(JSON.stringify({ error: 'Too many attempts. Account locked for 15 minutes.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Process Authentication Action (Signup / Login)
    let authResponse;

    if (action === 'signup') {
      // Use admin client to forcefully bypass email confirmation for @internal.axiom.app dummy addresses
      authResponse = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    } else if (action === 'login') {
      // Standard anon client for login — generates a valid session JWT
      const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
      authResponse = await supabaseClient.auth.signInWithPassword({ email, password });
    } else {
      throw new Error('Invalid action');
    }

    if (authResponse.error) {
      return new Response(JSON.stringify({ error: authResponse.error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return the session payload back to the client to establish their local session
    return new Response(JSON.stringify({ 
      success: true, 
      data: authResponse.data 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
