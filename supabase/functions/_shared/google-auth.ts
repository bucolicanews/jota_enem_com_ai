/// <reference path="../../deno.d.ts" />
import { JWT } from 'https://esm.sh/google-auth-library@9.11.0';

// Esta função agora lê a chave global que você salvou nos Secrets do Supabase.
export async function getVertexAIAuthToken(): Promise<{ token: string; projectId: string }> {
  // @ts-ignore: Deno está disponível no runtime
  const serviceAccountJSON = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  
  if (!serviceAccountJSON) {
    throw new Error('O secret GOOGLE_SERVICE_ACCOUNT_KEY não está configurado nas variáveis de ambiente da Edge Function.');
  }

  try {
    const credentials = JSON.parse(serviceAccountJSON);
    
    const jwtClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const { access_token } = await jwtClient.authorize();
    if (!access_token) {
      throw new Error('Falha ao obter o token de acesso do Google Vertex AI.');
    }
    
    const projectId = credentials.project_id;
    if (!projectId) {
      throw new Error('ID do projeto não encontrado na chave da conta de serviço.');
    }
    
    return { token: access_token, projectId: projectId };

  } catch (error: any) {
    console.error("Erro ao processar a chave da conta de serviço:", error.message);
    throw new Error("A chave da conta de serviço (GOOGLE_SERVICE_ACCOUNT_KEY) é inválida ou está mal formatada.");
  }
}