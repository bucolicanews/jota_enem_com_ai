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
  console.log('Edge Function test-llm-key started.'); // Added log

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
    const { data: { user }, error: userAuthError } = await supabaseClient.auth.getUser()
    if (userAuthError) { // Log auth error
        console.error('User authentication error:', userAuthError);
    }
    if (!user) {
      console.log('Access denied: No user found.'); // Added log
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }
    console.log('User authenticated:', user.id); // Added log

    const { modelId } = await req.json()
    if (!modelId) {
      console.log('Access denied: modelId is required.'); // Added log
      return new Response(JSON.stringify({ error: 'modelId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    console.log('Testing modelId:', modelId); // Added log

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

    if (dbError) {
        console.error('Database fetch error for model:', dbError); // Added log
    }
    if (!model) {
      console.log('Model not found for ID:', modelId); // Added log
      return new Response(JSON.stringify({ error: 'Model not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }
    console.log('Model fetched:', { id: model.id, provider: model.provider, model_variant: model.model_variant, is_standard: model.is_standard, user_id: model.user_id }); // Added log

    // Check access:
    // If it's a standard model, user_id must be null.
    // If it's not a standard model, user_id must match the current user's ID.
    if (!model.is_standard && model.user_id !== user.id) {
        console.log('Access denied: User does not own non-standard model.'); // Added log
        return new Response(JSON.stringify({ error: 'Access denied to this model' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        })
    }
    // Additional safeguard: if it's marked as standard but has a user_id, it's an invalid config.
    if (model.is_standard && model.user_id !== null) {
        console.log('Access denied: Invalid standard model configuration (user_id is not null).'); // Added log
        return new Response(JSON.stringify({ error: 'Invalid standard model configuration: user_id must be null' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
        })
    }
    console.log('Access granted for model testing.'); // Added log

    const { api_key, provider, model_variant } = model;
    
    console.log('DEBUG: Provider from DB:', provider);
    console.log('DEBUG: Model Variant from DB:', model_variant);

    let testResult = { success: false, message: 'Provider not supported' };

    // Test OpenAI
    if (provider === 'OpenAI') {
        console.log('Attempting to test OpenAI...'); // Added log
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
        });
        console.log('OpenAI response status:', response.status); // Added log
        if (response.ok) {
            testResult = { success: true, message: 'Conexão com OpenAI bem-sucedida!' };
        } else {
            const errorData = await response.json();
            console.error('OpenAI API error response:', errorData); // Added log
            testResult = { success: false, message: `Falha na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}` };
        }
    } 
    // Test Google Gemini
    else if (provider === 'Google Gemini') {
        console.log('Attempting to test Google Gemini...'); // Added log
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model_variant}:generateContent?key=${api_key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
        });
        console.log('Google Gemini response status:', response.status); // Added log
        if (response.ok) {
            testResult = { success: true, message: 'Conexão com Google Gemini bem-sucedida!' };
        } else {
            const errorData = await response.json();
            console.error('Google Gemini API error response:', errorData); // Added log
            testResult = { success: false, message: `Falha na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}` };
        }
    } 
    // Test Anthropic
    else if (provider === 'Anthropic') {
        console.log('Attempting to test Anthropic...'); // Added log
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
        });
        console.log('Anthropic response status:', response.status); // Added log
        if (response.ok) {
            testResult = { success: true, message: 'Conexão com Anthropic bem-sucedida!' };
        } else {
            const errorData = await response.json();
            console.error('Anthropic API error response:', errorData); // Added log
            testResult = { success: false, message: `Falha na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}` };
        }
    } 
    // Test Groq
    else if (provider === 'Groq') {
        console.log('Attempting to test Groq...'); // Added log
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
        });
        console.log('Groq response status:', response.status); // Added log
        if (response.ok) {
            testResult = { success: true, message: 'Conexão com Groq bem-sucedida!' };
        } else {
            const errorData = await response.json();
            console.error('Groq API error response:', errorData); // Added log
            testResult = { success: false, message: `Falha na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}` };
        }
    }
    // Test DeepSeek
    else if (provider === 'DeepSeek') {
        console.log('Attempting to test DeepSeek...'); // Added log
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
            body: JSON.stringify({ model: model_variant, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 5 })
        });
        console.log('DeepSeek response status:', response.status); // Added log
        if (response.ok) {
            testResult = { success: true, message: 'Conexão com DeepSeek bem-sucedida!' };
        } else {
            const errorData = await response.json();
            console.error('DeepSeek API error response:', errorData); // Added log
            testResult = { success: false, message: `Falha na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}` };
        }
    }

    console.log('Edge Function test-llm-key finished successfully.'); // Added log
    return new Response(JSON.stringify(testResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Unhandled error in test-llm-key:', error); // Added log
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})