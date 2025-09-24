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

  try {
    // @ts-ignore: Deno is available in runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno is available in runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // @ts-ignore: Deno is available in runtime
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    // @ts-ignore: Deno is available in runtime
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''; // Você precisará configurar esta variável de ambiente

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'No Stripe signature header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const body = await req.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`Received Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        const checkoutSession = event.data.object;
        const userId = checkoutSession.metadata?.user_id;
        const planId = checkoutSession.metadata?.plan_id;
        const customerId = checkoutSession.customer;
        const subscriptionId = checkoutSession.subscription;
        const paymentIntentId = checkoutSession.payment_intent;

        if (!userId || !planId) {
          console.error('Missing metadata in checkout.session.completed event');
          break;
        }

        // Fetch plan details to get limits
        const { data: planDetails, error: planDetailsError } = await supabaseAdmin
          .from('planos')
          .select('*')
          .eq('id', planId)
          .single();

        if (planDetailsError || !planDetails) {
          console.error('Error fetching plan details:', planDetailsError);
          break;
        }

        // Update user's profile (cliente)
        const { error: updateProfileError } = await supabaseAdmin
          .from('cliente')
          .update({
            plano_id: planId,
            assinatura_ativa: true,
            creditos_perguntas: planDetails.limite_perguntas,
            creditos_redacoes: planDetails.limite_redacoes,
            creditos_simulados: planDetails.limite_simulados,
            // TODO: Handle parent_id for professor plans if applicable
          })
          .eq('id', userId);

        if (updateProfileError) {
          console.error('Error updating user profile after checkout:', updateProfileError);
        } else {
          console.log(`User ${userId} updated to plan ${planId}`);
        }

        // Record transaction
        const { error: insertTransactionError } = await supabaseAdmin
          .from('transacoes')
          .insert({
            user_id: userId,
            plano_id: planId,
            valor: checkoutSession.amount_total / 100, // amount_total is in cents
            status: 'aprovado',
            id_stripe_payment_intent: paymentIntentId,
            id_stripe_checkout_session: checkoutSession.id,
          });

        if (insertTransactionError) {
          console.error('Error inserting transaction:', insertTransactionError);
        } else {
          console.log(`Transaction recorded for user ${userId}, plan ${planId}`);
        }

        // For recurring plans, create/update subscription record
        if (planDetails.tipo === 'recorrente' && subscriptionId) {
          const { error: upsertSubscriptionError } = await supabaseAdmin
            .from('assinaturas')
            .upsert({
              user_id: userId,
              plano_id: planId,
              id_stripe_subscription: subscriptionId,
              status: 'active',
              current_period_end: new Date(checkoutSession.current_period_end * 1000).toISOString(), // Convert to ISO string
            }, { onConflict: 'user_id' }); // Assuming one active subscription per user

          if (upsertSubscriptionError) {
            console.error('Error upserting subscription:', upsertSubscriptionError);
          } else {
            console.log(`Subscription recorded for user ${userId}, subscription ID ${subscriptionId}`);
          }
        }
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        const subscriptionIdFromInvoice = invoice.subscription;

        if (!subscriptionIdFromInvoice) {
          console.error('Missing subscription ID in invoice.payment_succeeded event');
          break;
        }

        // Find the user and plan associated with this subscription
        const { data: subscriptionData, error: subError } = await supabaseAdmin
          .from('assinaturas')
          .select('user_id, plano_id')
          .eq('id_stripe_subscription', subscriptionIdFromInvoice)
          .single();

        if (subError || !subscriptionData) {
          console.error('Error fetching subscription data for invoice:', subError);
          break;
        }

        const { user_id: subUserId, plano_id: subPlanoId } = subscriptionData;

        // Fetch plan details to re-apply limits
        const { data: subPlanDetails, error: subPlanDetailsError } = await supabaseAdmin
          .from('planos')
          .select('*')
          .eq('id', subPlanoId)
          .single();

        if (subPlanDetailsError || !subPlanDetails) {
          console.error('Error fetching plan details for subscription renewal:', subPlanDetailsError);
          break;
        }

        // Re-apply credits for recurring plans
        const { error: updateCreditsError } = await supabaseAdmin
          .from('cliente')
          .update({
            creditos_perguntas: subPlanDetails.limite_perguntas,
            creditos_redacoes: subPlanDetails.limite_redacoes,
            creditos_simulados: subPlanDetails.limite_simulados,
          })
          .eq('id', subUserId);

        if (updateCreditsError) {
          console.error('Error re-applying credits after recurring payment:', updateCreditsError);
        } else {
          console.log(`Credits re-applied for user ${subUserId} on plan ${subPlanoId}`);
        }

        // Update subscription status and period end
        const { error: updateSubscriptionStatusError } = await supabaseAdmin
          .from('assinaturas')
          .update({
            status: 'active',
            current_period_end: new Date(invoice.lines.data[0].period.end * 1000).toISOString(),
          })
          .eq('id_stripe_subscription', subscriptionIdFromInvoice);

        if (updateSubscriptionStatusError) {
          console.error('Error updating subscription status:', updateSubscriptionStatusError);
        } else {
          console.log(`Subscription status updated for ${subscriptionIdFromInvoice}`);
        }
        break;

      case 'customer.subscription.deleted':
        const subscriptionDeleted = event.data.object;
        const deletedSubscriptionId = subscriptionDeleted.id;

        const { data: deletedSubData, error: deletedSubError } = await supabaseAdmin
          .from('assinaturas')
          .select('user_id')
          .eq('id_stripe_subscription', deletedSubscriptionId)
          .single();

        if (deletedSubError || !deletedSubData) {
          console.error('Error fetching subscription data for deletion:', deletedSubError);
          break;
        }

        // Set user's plan to null or free, and set subscription_active to false
        const { error: resetProfileError } = await supabaseAdmin
          .from('cliente')
          .update({
            plano_id: null, // Or ID of your 'Free' plan
            assinatura_ativa: false,
            creditos_perguntas: 0, // Reset credits
            creditos_redacoes: 0,
            creditos_simulados: 0,
          })
          .eq('id', deletedSubData.user_id);

        if (resetProfileError) {
          console.error('Error resetting user profile after subscription deletion:', resetProfileError);
        } else {
          console.log(`User ${deletedSubData.user_id} plan reset after subscription deletion.`);
        }

        // Update subscription record status
        const { error: updateDeletedSubError } = await supabaseAdmin
          .from('assinaturas')
          .update({ status: 'canceled' })
          .eq('id_stripe_subscription', deletedSubscriptionId);

        if (updateDeletedSubError) {
          console.error('Error updating deleted subscription status:', updateDeletedSubError);
        } else {
          console.log(`Subscription ${deletedSubscriptionId} marked as canceled.`);
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Error in stripe-webhook Edge Function:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});