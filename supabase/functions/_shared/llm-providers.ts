// supabase/functions/_shared/llm-providers.ts

import { getVertexAIAuthToken } from './google-auth.ts';

// --- INTERFACES ---
interface TestResult { success: boolean; errorMessage?: string; message?: string; }
interface InvokeResult { success: boolean; aiResponse?: string; errorMessage?: string; }
interface ChatHistoryPart { role: 'user' | 'model'; parts: { text: string }[]; }

// !!! IMPORTANTE: Substitua pela sua região do Google Cloud (ex: us-central1, southamerica-east1) !!!
const GOOGLE_CLOUD_REGION = 'pt-br';

// --- FUNÇÃO DE TESTE DE CONEXÃO ---
export async function testLLMConnection(
  provider: string,
  model_variant: string,
  api_key: string
): Promise<TestResult> {
  
  const testBody = JSON.stringify({
    contents: [{ parts: [{ text: "Test" }] }],
    generation_config: { max_output_tokens: 2 }
  });

  try {
    let url = '';
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    switch (provider) {
      case 'Google Vertex AI': {
        const { token, projectId } = await getVertexAIAuthToken();
        url = `https://${GOOGLE_CLOUD_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GOOGLE_CLOUD_REGION}/publishers/google/models/${model_variant}:generateContent`;
        headers['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'Google Gemini': {
        if (!api_key) return { success: false, errorMessage: "API Key do Google Gemini não fornecida." };
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model_variant}:generateContent?key=${api_key}`;
        break;
      }
      // Adicione outros provedores aqui
      default:
        return { success: false, errorMessage: `Provedor '${provider}' não suportado para teste.` };
    }

    const response = await fetch(url, { method: 'POST', headers, body: testBody });

    if (response.ok) {
      return { success: true, message: `Conexão com ${provider} bem-sucedida!` };
    } else {
      const errorData = await response.json();
      return { success: false, errorMessage: errorData?.error?.message || `Falha na conexão (Status: ${response.status})` };
    }
  } catch (error: any) {
    return { success: false, errorMessage: error.message };
  }
}

// --- FUNÇÃO DE INVOCAÇÃO DO CHAT ---
export async function invokeLLM(
  provider: string,
  model_variant: string,
  api_key: string,
  chatHistory: ChatHistoryPart[],
  system_message: string | null
): Promise<InvokeResult> {
  
  const requestBody: any = { contents: chatHistory };
  if (system_message) {
    requestBody.system_instruction = { parts: [{ text: system_message }] };
  }

  try {
    let url = '';
    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    switch (provider) {
      case 'Google Vertex AI': {
        const { token, projectId } = await getVertexAIAuthToken();
        url = `https://${GOOGLE_CLOUD_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GOOGLE_CLOUD_REGION}/publishers/google/models/${model_variant}:generateContent`;
        headers['Authorization'] = `Bearer ${token}`;
        break;
      }
      case 'Google Gemini': {
        if (!api_key) return { success: false, errorMessage: "API Key do Google Gemini não fornecida." };
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model_variant}:generateContent?key=${api_key}`;
        break;
      }
      // Adicione outros provedores aqui
      default:
        return { success: false, errorMessage: `Provedor '${provider}' não suportado para chat.` };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error?.message || `Erro da API (Status: ${response.status})`);
    }

    const data = await response.json();
    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error("A API retornou uma resposta vazia ou em formato inesperado.");
    }

    return { success: true, aiResponse };

  } catch (error: any) {
    return { success: false, errorMessage: `Erro ao invocar ${provider}: ${error.message}` };
  }
}