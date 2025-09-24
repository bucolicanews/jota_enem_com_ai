// @ts-ignore: Deno imports are valid in runtime
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore: ESM imports are valid in runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore: ESM imports are valid in runtime
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore: Deno is available in runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno is available in runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // @ts-ignore: Deno is available in runtime
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

    console.log('Edge Function create-checkout-session started.');
    console.log('SUPABASE_URL:', supabaseUrl ? 'Configured' : 'NOT CONFIGURED');
    console.log('STRIPE_SECRET_KEY:', stripeSecretKey ? 'Configured' : 'NOT CONFIGURED');


    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Error: No Authorization header.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Error: Invalid authentication token or user not found.', userError);
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    console.log('User authenticated:', user.id, 'Email:', user.email);

    const { planoId, returnUrl } = await req.json();
    console.log('Received planoId:', planoId);
    console.log('Received returnUrl:', returnUrl);

    if (!planoId || !returnUrl) {
      console.error('Error: Missing required data: planoId or returnUrl.');
      return new Response(JSON.stringify({ error: 'Missing required data: planoId and returnUrl' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch plan details from Supabase
    const { data: plan, error: planError } = await supabaseAdmin
      .from('planos')
      .select('id, nome, tipo, id_stripe_price_monthly, id_stripe_price_one_time')
      .eq('id', planoId)
      .single();

    if (planError || !plan) {
      console.error('Error: Plan not found or database error.', planError);
      return new Response(JSON.stringify({ error: 'Plan not found or database error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    console.log('Plan fetched:', plan);

    let priceId: string | null = null;
    if (plan.tipo === 'recorrente' && plan.id_stripe_price_monthly) {
      priceId = plan.id_stripe_price_monthly;
    } else if (plan.tipo === 'pre_pago' && plan.id_stripe_price_one_time) {
      priceId = plan.id_stripe_price_one_time;
    }
    console.log('Determined Stripe Price ID:', priceId);

    if (!priceId) {
      console.error('Error: Stripe Price ID not configured for this plan type.');
      return new Response(JSON.stringify({ error: 'Stripe Price ID not configured for this plan type' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer_email: user.email, // Pre-fill customer email
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: plan.tipo === 'recorrente' ? 'subscription' : 'payment',
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_id: plan.id,
      },
    });
    console.log('Stripe Checkout Session created:', session.url);

    return new Response(JSON.stringify({ checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in create-checkout-session Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});