"use client";

// @ts-ignore: Deno imports are valid in runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-ignore: ESM imports are valid in runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore: ESM imports are valid in runtime
import Stripe from "https://esm.sh/stripe@14.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('--- sync-stripe-product function invoked ---'); // Log de início da função

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore: Deno is available in runtime
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    // @ts-ignore: Deno is available in runtime
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // @ts-ignore: Deno is available in runtime
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY'); 

    console.log('SUPABASE_URL (configurado):', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY (configurado):', !!supabaseServiceRoleKey);
    console.log('STRIPE_SECRET_KEY (configurado):', !!stripeSecretKey);
    console.log('STRIPE_SECRET_KEY (primeiros 5 caracteres):', stripeSecretKey ? stripeSecretKey.substring(0, 5) : 'NÃO CONFIGURADO');

    if (!stripeSecretKey) {
      console.error('ERRO: STRIPE_SECRET_KEY não está definida nas variáveis de ambiente.');
      return new Response(JSON.stringify({ error: 'A variável de ambiente STRIPE_SECRET_KEY não está definida. Por favor, configure-a no Painel do Supabase > Edge Functions > Gerenciar Segredos.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Verificar autenticação do usuário e permissões de administrador
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Erro: Cabeçalho de Autorização ausente.');
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error('Erro: Token de autenticação inválido ou usuário não encontrado.', userError);
      return new Response(JSON.stringify({ error: 'Token de autenticação inválido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    console.log('Usuário autenticado:', user.id, 'Email:', user.email);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('cliente')
      .select('permissao_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Erro: Perfil do usuário não encontrado ou erro no banco de dados.', profileError);
      return new Response(JSON.stringify({ error: 'Perfil do usuário não encontrado' }), {
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
      console.error('Erro: Acesso negado. Privilégio de Admin necessário.', permissionError);
      return new Response(JSON.stringify({ error: 'Acesso negado: Privilégio de Admin necessário' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    console.log('Usuário possui privilégios de Admin.');

    const { planoId, nome, tipo, preco } = await req.json();
    console.log('Dados do plano recebidos:', { planoId, nome, tipo, preco });

    if (!planoId || !nome || !tipo || !preco) {
      console.error('Erro: Dados do plano obrigatórios ausentes no corpo da requisição.');
      return new Response(JSON.stringify({ error: 'Dados do plano obrigatórios ausentes' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // --- INÍCIO DO BLOCO TEMPORARIAMENTE COMENTADO PARA DEBUG ---
    /*
    let stripeProductId = null;
    let stripePriceMonthlyId = null;
    let stripePriceOneTimeId = null;

    // Verificar se o plano já existe no Supabase para obter IDs do Stripe existentes
    console.log('Buscando plano existente no Supabase:', planoId);
    const { data: existingPlan, error: fetchPlanError } = await supabaseAdmin
      .from('planos')
      .select('id_stripe_product, id_stripe_price_monthly, id_stripe_price_one_time')
      .eq('id', planoId)
      .single();

    if (fetchPlanError && fetchPlanError.code !== 'PGRST116') { // PGRST116 significa "nenhuma linha encontrada"
      console.error(`Erro ao buscar plano existente no Supabase: ${fetchPlanError.message}`);
      throw new Error(`Erro ao buscar plano existente: ${fetchPlanError.message}`);
    }

    if (existingPlan) {
      stripeProductId = existingPlan.id_stripe_product;
      stripePriceMonthlyId = existingPlan.id_stripe_price_monthly;
      stripePriceOneTimeId = existingPlan.id_stripe_price_one_time;
      console.log('Plano existente encontrado. IDs do Stripe:', { stripeProductId, stripePriceMonthlyId, stripePriceOneTimeId });
    } else {
      console.log('Nenhum plano existente encontrado no Supabase para este ID. Será criado um novo produto Stripe.');
    }

    // 1. Criar ou atualizar Produto Stripe
    let product;
    if (stripeProductId) {
      console.log('Atualizando produto Stripe:', stripeProductId);
      product = await stripe.products.update(stripeProductId, {
        name: nome,
      });
      console.log('Produto Stripe atualizado:', product.id);
    } else {
      console.log('Criando novo produto Stripe com nome:', nome);
      product = await stripe.products.create({
        name: nome,
      });
      stripeProductId = product.id;
      console.log('Novo produto Stripe criado:', product.id);
    }

    // 2. Criar ou atualizar Preço(s) Stripe
    const unitAmount = Math.round(preco * 100); // Stripe espera o valor em centavos
    console.log('Valor unitário calculado (centavos):', unitAmount);

    if (tipo === 'recorrente') {
      console.log('Lidando com o preço do plano recorrente.');
      // Criar ou atualizar preço mensal
      if (stripePriceMonthlyId) {
        console.log('Recuperando preço mensal existente:', stripePriceMonthlyId);
        const oldPrice = await stripe.prices.retrieve(stripePriceMonthlyId);
        console.log('Detalhes do preço antigo:', { unit_amount: oldPrice.unit_amount, interval: oldPrice.recurring?.interval });

        if (oldPrice.unit_amount !== unitAmount || oldPrice.recurring?.interval !== 'month') {
          console.log('O preço mensal antigo é diferente ou inativo. Desativando e criando um novo.');
          await stripe.prices.update(stripePriceMonthlyId, { active: false });
          const newPrice = await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'brl',
            recurring: { interval: 'month' },
            product: stripeProductId,
          });
          stripePriceMonthlyId = newPrice.id;
          console.log('Novo preço mensal criado:', newPrice.id);
        } else {
          console.log('O preço mensal existente está atualizado e ativo. Nenhuma alteração necessária.');
        }
      } else {
        console.log('Nenhum preço mensal existente. Criando um novo.');
        const newPrice = await stripe.prices.create({
          unit_amount: unitAmount,
          currency: 'brl',
          recurring: { interval: 'month' },
          product: stripeProductId,
        });
        stripePriceMonthlyId = newPrice.id;
        console.log('Novo preço mensal criado:', newPrice.id);
      }
      stripePriceOneTimeId = null; // Garantir que o preço único seja nulo para planos recorrentes
      console.log('Definido o ID do preço único como nulo para o plano recorrente.');
    } else if (tipo === 'pre_pago') {
      console.log('Lidando com o preço do plano pré-pago.');
      // Criar ou atualizar preço único
      if (stripePriceOneTimeId) {
        console.log('Recuperando preço único existente:', stripePriceOneTimeId);
        const oldPrice = await stripe.prices.retrieve(stripePriceOneTimeId);
        console.log('Detalhes do preço antigo:', { unit_amount: oldPrice.unit_amount, recurring: oldPrice.recurring });

        if (oldPrice.unit_amount !== unitAmount || oldPrice.recurring !== null) {
          console.log('O preço único antigo é diferente ou inativo. Desativando e criando um novo.');
          await stripe.prices.update(stripePriceOneTimeId, { active: false });
          const newPrice = await stripe.prices.create({
            unit_amount: unitAmount,
            currency: 'brl',
            product: stripeProductId,
          });
          stripePriceOneTimeId = newPrice.id;
          console.log('Novo preço único criado:', newPrice.id);
        } else {
          console.log('O preço único existente está atualizado e ativo. Nenhuma alteração necessária.');
        }
      } else {
        console.log('Nenhum preço único existente. Criando um novo.');
        const newPrice = await stripe.prices.create({
          unit_amount: unitAmount,
          currency: 'brl',
          product: stripeProductId,
        });
        stripePriceOneTimeId = newPrice.id;
        console.log('Novo preço único criado:', newPrice.id);
      }
      stripePriceMonthlyId = null; // Garantir que o preço mensal seja nulo para planos únicos
      console.log('Definido o ID do preço mensal como nulo para o plano único.');
    }

    // 3. Atualizar Supabase com os IDs do Stripe
    console.log('Atualizando plano do Supabase com os IDs do Stripe:', { planoId, stripeProductId, stripePriceMonthlyId, stripePriceOneTimeId });
    const { error: updateDbError } = await supabaseAdmin
      .from('planos')
      .update({
        id_stripe_product: stripeProductId,
        id_stripe_price_monthly: stripePriceMonthlyId,
        id_stripe_price_one_time: stripePriceOneTimeId,
      })
      .eq('id', planoId);

    if (updateDbError) {
      console.error(`Erro ao atualizar plano do Supabase com os IDs do Stripe: ${updateDbError.message}`);
      throw new Error(`Erro ao atualizar plano do Supabase com os IDs do Stripe: ${updateDbError.message}`);
    }
    console.log('Plano do Supabase atualizado com sucesso com os IDs do Stripe.');
    */
    // --- FIM DO BLOCO TEMPORARIAMENTE COMENTADO PARA DEBUG ---

    console.log('Edge Function sync-stripe-product finalizada com sucesso (DEBUG MODE).');
    return new Response(JSON.stringify({
      success: true,
      message: 'Plano sincronizado com Stripe com sucesso (DEBUG MODE)',
      stripeProductId: 'debug_product_id',
      stripePriceMonthlyId: 'debug_price_monthly_id',
      stripePriceOneTimeId: 'debug_price_one_time_id',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Erro na função Edge sync-stripe-product (catch externo):', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});