// supabase/functions/_shared/google-auth.ts

import { JWT } from 'https://esm.sh/google-auth-library@9.11.0';

// Removido: @ts-ignore: Deno is available in runtime
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');

let jwtClient: JWT | null = null;
let cachedProjectId: string | null = null; // Cache project ID

export async function getVertexAIAuthToken(): Promise<{ token: string; projectId: string }> {
  if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  if (!jwtClient || !cachedProjectId) {
    const credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
    jwtClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    cachedProjectId = credentials.project_id; // Store project ID
  }

  const { access_token } = await jwtClient.authorize();
  if (!access_token) {
    throw new Error('Failed to obtain Google Vertex AI access token.');
  }
  if (!cachedProjectId) {
    throw new Error('Google Cloud Project ID not found in service account key.');
  }
  return { token: access_token, projectId: cachedProjectId };
}