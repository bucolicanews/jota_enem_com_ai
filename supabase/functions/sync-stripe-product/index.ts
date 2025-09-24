"use client";

// @ts-ignore: Deno imports are valid in runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore: ESM imports are valid in runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore: ESM imports are valid in runtime
import Stripe from "https://esm.sh/stripe@14.0.0"; // Alterado para v14.0.0 e removido ?target=deno

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('Edge Function sync-stripe-product started.');

  try {
    // @ts-ignore: Deno is available in runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno is available in runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // @ts-ignore: Deno is available in runtime
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY'); 

    console.log('SUPABASE_URL:', supabaseUrl ? 'Configured' : 'NOT CONFIGURED');
    console.log('STRIPE_SECRET_KEY (raw value from Deno.env.get):', stripeSecretKey ? 'Configured' : 'NOT CONFIGURED'); // Log de debug atualizado

    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not set in environment variables.');
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY environment variable is not set.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Internal Server Error because a critical env var is missing
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verify user authentication and admin permissions
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('cliente')
      .select('permissao_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error: User profile not found or database error.', profileError);
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
      console.error('Error: Access denied. Admin privilege required.', permissionError);
      return new Response(JSON.stringify({ error: 'Access denied: Admin privilege required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    console.log('User has Admin privileges.');

    const { planoId, nome, tipo, preco } = await req.json();
    console.log('Received plan data:', { planoId, nome, tipo, preco });

    if (!planoId || !nome || !tipo || !preco) {
      console.error('Error: Missing required plan data in request body.');
      return new Response(JSON.stringify({ error: 'Missing required plan data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let stripeProductId = null;
    let stripePriceMonthlyId = null;
    let stripePriceOneTimeId = null;

    // Check if plan already exists in Supabase to get existing Stripe IDs
    console.log('Fetching existing plan from Supabase:', planoId);
    const { data: existingPlan, error: fetchPlanError } = await supabaseAdmin
      .from('planos')
      .select('id_stripe_product, id_stripe_price_monthly, id_stripe_price_one_time')
      .eq('id', planoId)
      .single();

    if (fetchPlanError && fetchPlanError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error(`Error fetching existing plan from Supabase: ${fetchPlanError.message}`);
      throw new Error(`Error fetching existing plan: ${fetchPlanError.message}`);
    }

    if (existingPlan) {
      stripeProductId = existingPlan.id_stripe_product;
      stripePriceMonthlyId = existingPlan.id_stripe_price_monthly;
      stripePriceOneTimeId = existingPlan.id_stripe_price_one_time;
      console.log('Existing plan found. Stripe IDs:', { stripeProductId, stripePriceMonthlyId, stripePriceOneTimeId });
    } else {
      console.log('No existing plan found in Supabase for this ID. Will create new Stripe product.');
    }

    // 1. Create or update Stripe Product
    let product;
    if (stripeProductId) {
      console.log('Updating Stripe product:', stripeProductId);
      product = await stripe.products.update(stripeProductId, {
        name: nome,
      });
      console.log('Stripe product updated:', product.id);
    } else {
      console.log('Creating new Stripe product with name:', nome);
      product = await stripe.products.create({
        name: nome,
      });
      stripeProductId = product.id;
      console.log('New Stripe product created:', product.id);
    }

    // 2. Create or update Stripe Price(s)
    const unitAmount = Math.round(preco * 100); // Stripe expects amount in cents
    console.log('Calculated unit amount (cents):', unitAmount);

    if (tipo === 'recorrente') {
      console.log('Handling recurring plan price.');
      // Create or update monthly price
      if (stripePriceMonthlyId) {
        console.log('Retrieving existing monthly price:', stripePriceMonthlyId);
        const oldPrice = await stripe.prices.retrieve(stripePriceMonthlyId);
        console.log('Old price details:', { unit_amount: oldPrice.unit_amount, interval: oldPrice.recurring?.interval });

        if (oldPrice.unit_amount !== unitAmount || oldPrice.recurring?.interval !== 'month') {
          console.log('Old monthly price is different or inactive. Deactivating and creating new one.');
          await stripe.prices.update(stripePriceMonthlyId, { active: false });
          const newPrice = await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'brl',
            recurring: { interval: 'month' },
            product: stripeProductId,
          });
          stripePriceMonthlyId = newPrice.id;
          console.log('New monthly price created:', newPrice.id);
        } else {
          console.log('Existing monthly price is up-to-date and active. No change needed.');
        }
      } else {
        console.log('No existing monthly price. Creating new one.');
        const newPrice = await stripe.prices.create({
          unit_amount: unitAmount,
          currency: 'brl',
          recurring: { interval: 'month' },
          product: stripeProductId,
        });
        stripePriceMonthlyId = newPrice.id;
        console.log('New monthly price created:', newPrice.id);
      }
      stripePriceOneTimeId = null; // Ensure one-time price is null for recurring plans
      console.log('Set one-time price ID to null for recurring plan.');
    } else if (tipo === 'pre_pago') {
      console.log('Handling one-time plan price.');
      // Create or update one-time price
      if (stripePriceOneTimeId) {
        console.log('Retrieving existing one-time price:', stripePriceOneTimeId);
        const oldPrice = await stripe.prices.retrieve(stripePriceOneTimeId);
        console.log('Old price details:', { unit_amount: oldPrice.unit_amount, recurring: oldPrice.recurring });

        if (oldPrice.unit_amount !== unitAmount || oldPrice.recurring !== null) {
          console.log('Old one-time price is different or inactive. Deactivating and creating new one.');
          await stripe.prices.update(stripePriceOneTimeId, { active: false });
          const newPrice = await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'brl',
            product: stripeProductId,
          });
          stripePriceOneTimeId = newPrice.id;
          console.log('New one-time price created:', newPrice.id);
        } else {
          console.log('Existing one-time price is up-to-date and active. No change needed.');
        }
      } else {
        console.log('No existing one-time price. Creating new one.');
        const newPrice = await stripe.prices.create({
          unit_amount: unitAmount,
          currency: 'brl',
          product: stripeProductId,
        });
        stripePriceOneTimeId = newPrice.id;
        console.log('New one-time price created:', newPrice.id);
      }
      stripePriceMonthlyId = null; // Ensure monthly price is null for one-time plans
      console.log('Set monthly price ID to null for one-time plan.');
    }

    // 3. Update Supabase with Stripe IDs
    console.log('Updating Supabase plan with Stripe IDs:', { planoId, stripeProductId, stripePriceMonthlyId, stripePriceOneTimeId });
    const { error: updateDbError } = await supabaseAdmin
      .from('planos')
      .update({
        id_stripe_product: stripeProductId,
        id_stripe_price_monthly: stripePriceMonthlyId,
        id_stripe_price_one_time: stripePriceOneTimeId,
      })
      .eq('id', planoId);

    if (updateDbError) {
      console.error(`Error updating Supabase plan with Stripe IDs: ${updateDbError.message}`);
      throw new Error(`Error updating Supabase plan with Stripe IDs: ${updateDbError.message}`);
    }
    console.log('Supabase plan updated successfully with Stripe IDs.');

    console.log('Edge Function sync-stripe-product finished successfully.');
    return new Response(JSON.stringify({
      success: true,
      message: 'Plan synchronized with Stripe successfully',
      stripeProductId,
      stripePriceMonthlyId,
      stripePriceOneTimeId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Error in sync-stripe-product Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});