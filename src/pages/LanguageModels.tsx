import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, Trash2, TestTube } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface LanguageModel {
  id: string;
  user_id: string;
  provider: string;
  api_key: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
  created_at: string;
}

const LanguageModels = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [models, setModels] = useState<LanguageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);

  const [provider, setProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelVariant, setModelVariant] = useState('');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);
      fetchModels(user.id);
    };
    getUser();
  }, [navigate]);

  const fetchModels = useCallback(async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('language_models')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Erro ao carregar modelos.');
      console.error('Error fetching models:', error);
    } else {
      setModels(data as LanguageModel[]);
    }
    setLoading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !provider || !apiKey || !modelName || !modelVariant) {
      showError('Por favor, preencha todos os campos.');
      return;
    }
    setIsSubmitting(true);

    const { error } = await supabase.from('language_models').insert({
      user_id: user.id,
      provider: provider,
      api_key: apiKey,
      model_name: modelName,
      model_variant: modelVariant,
    });

    if (error) {
      showError('Erro ao salvar a chave de API.');
    } else {
      showSuccess('Chave de API salva com sucesso!');
      setProvider('');
      setApiKey('');
      setModelName('');
      setModelVariant('');
      fetchModels(user.id);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (modelId: string) => {
    const { error } = await supabase.from('language_models').delete().eq('id', modelId);
    if (error) {
      showError('Erro ao deletar a chave de API.');
    } else {
      showSuccess('Chave de API deletada com sucesso!');
      setModels(models.filter(m => m.id !== modelId));
    }
  };

  const handleTest = async (modelId: string) => {
    setTestingModelId(modelId);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-key', {
        body: { modelId },
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        showSuccess(data.message);
      } else {
        showError(data.message || 'Ocorreu um erro desconhecido.');
      }
    } catch (err: any) {
      showError(`Falha ao testar a conexão: ${err.message}`);
    } finally {
      setTestingModelId(null);
    }
  };

  const MODEL_VARIANTS: Record<string, string[]> = {
    OpenAI: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    'Google Gemini': ['gemini-1.5-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.0-pro'],
    Anthropic: ['claude-3.5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Configurar Modelo de IA</CardTitle>
          <CardDescription>Adicione suas chaves de API para usar modelos de linguagem</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provedor</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OpenAI">OpenAI</SelectItem>
                    <SelectItem value="Google Gemini">Google Gemini</SelectItem>
                    <SelectItem value="Anthropic">Anthropic (Claude)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-variant">Modelo</Label>
                <Select value={modelVariant} onValueChange={setModelVariant} disabled={!provider}>
                  <SelectTrigger id="model-variant">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {provider && MODEL_VARIANTS[provider]?.map((variant) => (
                      <SelectItem key={variant} value={variant}>{variant}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-name">Nome da IA (Opcional)</Label>
                <Input
                  id="model-name"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="Ex: Meu Assistente GPT"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Chave de API</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Insira sua chave de API"
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Chave
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Minhas Chaves de API</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma chave de API configurada ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{model.provider}</h4>
                    <p className="text-sm text-muted-foreground">
                      {model.model_name || model.model_variant}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(model.id)}
                      disabled={testingModelId === model.id}
                    >
                      {testingModelId === model.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Testar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(model.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LanguageModels;