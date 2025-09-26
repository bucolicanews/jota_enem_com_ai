// supabase/functions/utils/llm-providers.ts

import { getVertexAIAuthToken } from './google-auth.ts';

interface LLMMessage {
  role: string;
  content: string;
}

interface LLMResponse {
  aiResponse: string;
  success: boolean;
  errorMessage?: string;
}

const GOOGLE_VERTEX_AI_REGION = 'us-central1'; // Região padrão para Vertex AI

export async function invokeLLM(
  provider: string,
  modelVariant: string,
  apiKey: string,
  chatHistory: LLMMessage[], // Renomeado para clareza
  modelSystemMessage: string | null, // Renomeado para clareza
): Promise<LLMResponse> {
  let aiResponse = 'Não foi possível obter uma resposta do modelo de IA.';
  let success = false;
  let errorMessage: string | undefined;

  try {
    // Adicionar instrução explícita para responder em Português à mensagem de sistema do modelo
    const finalSystemInstruction = (modelSystemMessage ? modelSystemMessage.trim() + '\n\n' : '') + 'Responda sempre em Português do Brasil.';

    // Preparar mensagens para diferentes APIs LLM
    let messagesForApi: any[] = [];

    if (provider === 'Google Gemini') {
      // Para Gemini (Vertex AI), system_instruction é separado, e os papéis são 'user'/'model'
      messagesForApi = chatHistory.map(msg => ({
        role: msg.role === 'ai' ? 'model' : 'user', // Vertex AI usa 'model' para respostas da IA
        parts: [{ text: msg.content }]
      }));
    } else {
      // Para OpenAI, Anthropic, Groq, DeepSeek, a mensagem de sistema faz parte do array de mensagens
      if (finalSystemInstruction) {
        messagesForApi.push({ role: 'system', content: finalSystemInstruction });
      }
      messagesForApi.push(...chatHistory.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : msg.role, // APIs tipo OpenAI usam 'assistant' para respostas da IA
        content: msg.content
      })));
    }

    if (provider === 'OpenAI') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices[0]?.message?.content || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Falha na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Google Gemini') {
      const { token: accessToken, projectId } = await getVertexAIAuthToken();
      const vertexAiEndpoint = `https://${GOOGLE_VERTEX_AI_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GOOGLE_VERTEX_AI_REGION}/publishers/google/models/${modelVariant}:generateContent`;

      const body: any = {
        contents: messagesForApi,
        generationConfig: {
          maxOutputTokens: 500,
        },
      };
      if (finalSystemInstruction) {
        body.system_instruction = { parts: [{ text: finalSystemInstruction }] };
      }

      const response = await fetch(vertexAiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
          body: JSON.stringify(body)
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.candidates[0]?.content?.parts[0]?.text || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Erro na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}`;
        if (errorMessage.includes('Quota exceeded')) {
          errorMessage = 'Desculpe, o limite de uso da IA (Google Gemini) foi atingido. Por favor, tente novamente mais tarde ou considere verificar seu plano de API.';
        } else {
          errorMessage = 'Não foi possível acessar o modelo Gemini. Verifique se o modelo está correto e se sua chave de API tem as permissões necessárias.';
        }
      }
    } else if (provider === 'Anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.content[0]?.text || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Erro na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices[0]?.message?.content || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Falha na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'DeepSeek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 500 })
      });
      if (response.ok) {
        const data = await response.json();
        aiResponse = data.choices[0]?.message?.content || aiResponse;
        success = true;
      } else {
        const errorData = await response.json();
        errorMessage = `Falha na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else {
      errorMessage = `Provedor de IA '${provider}' não suportado.`;
    }
  } catch (fetchError: any) {
    errorMessage = `Erro na comunicação com o provedor ${provider}: ${fetchError.message}`;
  }

  return { aiResponse, success, errorMessage };
}

export async function testLLMConnection(
  provider: string,
  modelVariant: string,
  apiKey: string,
): Promise<LLMResponse> {
  let success = false;
  let message = 'Provedor não suportado';

  try {
    const testUserMessage = 'Hello';
    const testSystemInstruction = 'Responda sempre em Português do Brasil.';

    let messagesForApi: any[] = [];

    if (provider === 'Google Gemini') {
      messagesForApi = [{ role: 'user', parts: [{ text: testUserMessage }] }];
    } else {
      messagesForApi.push({ role: 'system', content: testSystemInstruction });
      messagesForApi.push({ role: 'user', content: testUserMessage });
    }

    if (provider === 'OpenAI') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com OpenAI bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Google Gemini') {
      const { token: accessToken, projectId } = await getVertexAIAuthToken();
      const vertexAiEndpoint = `https://${GOOGLE_VERTEX_AI_REGION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${GOOGLE_VERTEX_AI_REGION}/publishers/google/models/${modelVariant}:generateContent`;

      const body = {
        contents: messagesForApi,
        system_instruction: { parts: [{ text: testSystemInstruction }] },
        generationConfig: {
          maxOutputTokens: 5,
        },
      };

      const response = await fetch(vertexAiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com Google Gemini bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com Gemini: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com Anthropic bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com Anthropic: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'Groq') {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com Groq bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com Groq: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    } else if (provider === 'DeepSeek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: modelVariant, messages: messagesForApi, max_tokens: 5 })
      });
      if (response.ok) {
        success = true;
        message = 'Conexão com DeepSeek bem-sucedida!';
      } else {
        const errorData = await response.json();
        message = `Falha na conexão com DeepSeek: ${errorData.error?.message || 'Erro desconhecido'}`;
      }
    }
  } catch (fetchError: any) {
    message = `Erro na comunicação com o provedor ${provider}: ${fetchError.message}`;
  }

  return { aiResponse: message, success, errorMessage: message };
}