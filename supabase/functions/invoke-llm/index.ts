// @ts-ignore: Deno imports are valid in runtime
/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

// @ts-ignore: Deno imports are valid in runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-ignore: ESM imports are valid in runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the user's auth token
    // @ts-ignore: Deno is available in runtime
    const supabaseClient = createClient(
      // @ts-ignore: Deno is available in runtime
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore: Deno is available in runtime
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the user from the token
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { modelId, userMessage } = await req.json()
    if (!modelId || !userMessage) {
      return new Response(JSON.stringify({ error: 'modelId and userMessage are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Create a service role client to securely fetch the API key
    // @ts-ignore: Deno is available in runtime
    const serviceClient = createClient(
        // @ts-ignore: Deno is available in runtime
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore: Deno is available in runtime
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the model by ID first, including is_standard and user_id for access check
    const { data: model, error: dbError } = await serviceClient
      .from('language_models')
      .select('api_key, provider, model_name, model_variant, is_standard, user_id')
      .eq('id', modelId)
      .single()

    if (dbError || !model) {
      return new Response(JSON.stringify({ error: 'Model not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Check access:
    // If it's a standard model, user_id must be null.
    // If it's not a standard model, user_id must match the current user's ID.
    if (!model.is_standard && model.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Access denied to this model' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        })
    }
    // Additional safeguard: if it's marked as standard but has a user_id, it's an invalid config.
    if (model.is_standard && model.user_id !== null) {
        return new Response(JSON.stringify({ error: 'Invalid standard model configuration: user_id must be null' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        })
    }

    const { api_key, provider, model_variant } = model;

    // --- LOGGING PARA DEPURAR O PROVEDOR ---
    console.log('DEBUG: Provider recebido da DB:', provider);
    console.log('DEBUG: Model Variant recebido da DB:', model_variant);
    // --- FIM DO LOGGING ---
    
    let aiResponse = 'Não foi possível obter uma resposta do modelo de IA.';

    // Invoke the appropriate LLM based on the provider
    if (provider === 'OpenAI') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: userMessage }], max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('OpenAI API error:', errorData);
            aiResponse = `Erro na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    } 
    else if (provider === 'Google Gemini') {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model_variant}:generateContent?key=${api_key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: userMessage }] }] })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.candidates[0]?.content?.parts[0]?.text || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('Gemini API error:', errorData);
            aiResponse = `Erro na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    } 
    else if (provider === 'Anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: userMessage }], max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.content[0]?.text || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('Anthropic API error:', errorData);
            aiResponse = `Erro na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    }
    else if (provider === 'Groq') {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: userMessage }], max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('Groq API error:', errorData);
            aiResponse = `Erro na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    }
    else if (provider === 'DeepSeek') {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: userMessage }], max_tokens: 500 })
        });
        if (response.ok) {
            const data = await response.json();
            aiResponse = data.choices[0]?.message?.content || aiResponse;
        } else {
            const errorData = await response.json();
            console.error('DeepSeek API error:', errorData);
            aiResponse = `Erro na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}`;
        }
    }

    return new Response(JSON.stringify({ aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})