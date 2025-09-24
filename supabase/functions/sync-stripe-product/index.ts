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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify user authentication and admin permissions
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('cliente')
      .select('permissao_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { data: permission, error: permissionError } = await supabaseAdmin
      .from('permissoes')
      .select('nome')
      .eq('id', profile.permissao_id)
      .single();

    if (permissionError || permission?.nome !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Access denied: Admin privilege required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { planoId, nome, tipo, preco } = await req.json();

    if (!planoId || !nome || !tipo || !preco) {
      return new Response(JSON.stringify({ error: 'Missing required plan data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let stripeProductId = null;
    let stripePriceMonthlyId = null;
    let stripePriceOneTimeId = null;

    // Check if plan already exists in Supabase to get existing Stripe IDs
    const { data: existingPlan, error: fetchPlanError } = await supabaseAdmin
      .from('planos')
      .select('id_stripe_product, id_stripe_price_monthly, id_stripe_price_one_time')
      .eq('id', planoId)
      .single();

    if (fetchPlanError && fetchPlanError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      throw new Error(`Error fetching existing plan: ${fetchPlanError.message}`);
    }

    if (existingPlan) {
      stripeProductId = existingPlan.id_stripe_product;
      stripePriceMonthlyId = existingPlan.id_stripe_price_monthly;
      stripePriceOneTimeId = existingPlan.id_stripe_price_one_time;
    }

    // 1. Create or update Stripe Product
    let product;
    if (stripeProductId) {
      product = await stripe.products.update(stripeProductId, {
        name: nome,
      });
    } else {
      product = await stripe.products.create({
        name: nome,
      });
      stripeProductId = product.id;
    }

    // 2. Create or update Stripe Price(s)
    const unitAmount = Math.round(preco * 100); // Stripe expects amount in cents

    if (tipo === 'recorrente') {
      // Create or update monthly price
      if (stripePriceMonthlyId) {
        // Deactivate old price if it exists and is different
        const oldPrice = await stripe.prices.retrieve(stripePriceMonthlyId);
        if (oldPrice.unit_amount !== unitAmount || oldPrice.recurring?.interval !== 'month') {
          await stripe.prices.update(stripePriceMonthlyId, { active: false });
          const newPrice = await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'brl',
            recurring: { interval: 'month' },
            product: stripeProductId,
          });
          stripePriceMonthlyId = newPrice.id;
        }
      } else {
        const newPrice = await stripe.prices.create({
          unit_amount: unitAmount,
          currency: 'brl',
          recurring: { interval: 'month' },
          product: stripeProductId,
        });
        stripePriceMonthlyId = newPrice.id;
      }
      stripePriceOneTimeId = null; // Ensure one-time price is null for recurring plans
    } else if (tipo === 'pre_pago') {
      // Create or update one-time price
      if (stripePriceOneTimeId) {
        // Deactivate old price if it exists and is different
        const oldPrice = await stripe.prices.retrieve(stripePriceOneTimeId);
        if (oldPrice.unit_amount !== unitAmount || oldPrice.recurring !== null) {
          await stripe.prices.update(stripePriceOneTimeId, { active: false });
          const newPrice = await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'brl',
            product: stripeProductId,
          });
          stripePriceOneTimeId = newPrice.id;
        }
      } else {
        const newPrice = await stripe.prices.create({
          unit_amount: unitAmount,
          currency: 'brl',
          product: stripeProductId,
        });
        stripePriceOneTimeId = newPrice.id;
      }
      stripePriceMonthlyId = null; // Ensure monthly price is null for one-time plans
    }

    // 3. Update Supabase with Stripe IDs
    const { error: updateDbError } = await supabaseAdmin
      .from('planos')
      .update({
        id_stripe_product: stripeProductId,
        id_stripe_price_monthly: stripePriceMonthlyId,
        id_stripe_price_one_time: stripePriceOneTimeId,
      })
      .eq('id', planoId);

    if (updateDbError) {
      throw new Error(`Error updating Supabase plan with Stripe IDs: ${updateDbError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Plan synchronized with Stripe successfully',
      stripeProductId,
      stripePriceMonthlyId,
      stripePriceOneTimeId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in sync-stripe-product Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});