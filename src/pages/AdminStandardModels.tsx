import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, Trash2, TestTube, MessageSquareText, Pencil, ShieldAlert, XCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { EditStandardModelDialog } from '@/components/EditStandardModelDialog';
import { AdminStandardModelForm } from '@/components/AdminStandardModelForm'; // Importar o novo componente de formulário
import { requireAdmin } from '@/utils/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; // Adicionado: Importação dos componentes Avatar

interface LanguageModel {
  id: string;
  user_id: string | null;
  provider: string;
  api_key: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
  is_standard: boolean;
  system_message: string | null;
  description: string | null;
  avatar_url: string | null;
  created_at: string;
}

export const AdminStandardModels = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [models, setModels] = useState<LanguageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);

  // Estados para o diálogo de edição de agentes padrão
  const [isEditStandardDialogOpen, setIsEditStandardDialogOpen] = useState(false);
  const [selectedStandardModelToEdit, setSelectedStandardModelToEdit] = useState<LanguageModel | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('language_models')
      .select('*')
      .eq('is_standard', true) // Apenas modelos padrão
      .order('created_at', { ascending: false });

    if (error) {
      showError('Erro ao carregar agentes professores.');
      console.error('Error fetching standard models:', error);
    } else {
      setModels(data as LanguageModel[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkPermissionsAndFetchData = async () => {
      setCheckingPermissions(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login');
        return;
      }
      setUser(loggedInUser);
      const canAccess = await requireAdmin(loggedInUser.id);
      setIsAdmin(canAccess);
      if (canAccess) {
        fetchModels();
      }
      setCheckingPermissions(false);
    };
    checkPermissionsAndFetchData();
  }, [navigate, fetchModels]);

  const handleAddOrUpdateModel = async (modelData: Omit<LanguageModel, 'user_id' | 'is_standard'> & { id?: string }) => {
    if (!isAdmin) {
      showError('Acesso negado.');
      return;
    }
    setIsSubmitting(true);

    const dataToSave = {
      user_id: null, // Standard models are not linked to a specific user
      provider: modelData.provider,
      api_key: modelData.api_key,
      model_name: modelData.model_name,
      model_variant: modelData.model_variant,
      is_active: modelData.is_active,
      is_standard: true,
      system_message: modelData.system_message,
      description: modelData.description,
      avatar_url: modelData.avatar_url || null,
    };

    let error = null;
    if (modelData.id) {
      // Update existing model
      const { error: updateError } = await supabase
        .from('language_models')
        .update(dataToSave)
        .eq('id', modelData.id);
      error = updateError;
    } else {
      // Add new model
      const { error: insertError } = await supabase.from('language_models').insert(dataToSave);
      error = insertError;
    }

    if (error) {
      showError(`Erro ao ${modelData.id ? 'atualizar' : 'adicionar'} agente: ${error.message}`);
      console.error('Submit error:', error);
    } else {
      showSuccess(`Agente professor ${modelData.id ? 'atualizado' : 'adicionado'} com sucesso!`);
      fetchModels();
      // Reset form or close dialog if needed
      if (!modelData.id) { // Only reset form if adding a new one
        // This logic is now handled by the form component's initialModel prop
      }
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (modelId: string, modelAvatarUrl: string | null) => {
    if (!isAdmin) {
      showError('Acesso negado.');
      return;
    }
    if (!window.confirm('Tem certeza que deseja deletar este agente professor?')) return;

    setIsSubmitting(true);
    try {
      // 1. Deletar avatar do storage, se existir
      if (modelAvatarUrl) {
        const filePath = modelAvatarUrl.split('/model_avatars/')[1];
        if (filePath) {
          const { error: removeError } = await supabase.storage.from('model_avatars').remove([filePath]);
          if (removeError) {
            console.error('Erro ao deletar avatar do storage:', removeError);
          }
        }
      }

      // 2. Deletar o modelo do banco de dados
      const { error } = await supabase.from('language_models').delete().eq('id', modelId);
      if (error) {
        throw error;
      }
      showSuccess('Agente professor deletado com sucesso!');
      fetchModels();
    } catch (error: any) {
      showError(`Erro ao deletar agente professor: ${error.message}`);
      console.error('Delete error:', error);
    } finally {
      setIsSubmitting(false);
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

  const handleChat = (modelId: string) => {
    navigate(`/ai-chat/${modelId}`);
  };

  // Função para abrir o diálogo de edição de agentes padrão
  const handleEditClick = (model: LanguageModel) => {
    setSelectedStandardModelToEdit(model);
    setIsEditStandardDialogOpen(true);
  };

  // Função para fechar o diálogo de edição e recarregar os modelos
  const handleEditSuccess = () => {
    setIsEditStandardDialogOpen(false);
    fetchModels();
  };

  if (checkingPermissions) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive"><ShieldAlert className="h-12 w-12 mx-auto mb-4" />Acesso Negado</CardTitle>
            <CardDescription className="text-center">Apenas administradores podem acessar esta página.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/dashboard')}>Voltar para o Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Novo Agente Professor</CardTitle>
          <CardDescription>Configure um novo modelo de IA para ser um agente professor padrão.</CardDescription>
          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800 rounded-md">
            <p className="font-semibold mb-2">Como obter sua chave de API:</p>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><strong>Google Gemini:</strong> Visite <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">aistudio.google.com/app/apikey</a></li>
              <li><strong>OpenAI:</strong> Visite <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">platform.openai.com/api-keys</a></li>
              <li><strong>Anthropic:</strong> Visite <a href="https://console.anthropic.com/settings/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">console.anthropic.com/settings/api-keys</a></li>
              <li><strong>Groq:</strong> Visite <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">console.groq.com/keys</a></li>
              <li><strong>DeepSeek:</strong> Visite <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 hover:text-blue-800">platform.deepseek.com/api-keys</a></li>
            </ul>
          </div>
        </CardHeader>
        <CardContent>
          <AdminStandardModelForm
            isAdmin={isAdmin}
            onSubmit={handleAddOrUpdateModel}
            isSubmitting={isSubmitting}
            initialModel={null} // For adding a new model
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agentes Professores Ativos</CardTitle>
          <CardDescription>Gerencie os modelos de IA padrão disponíveis para os usuários PRO.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : models.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8">
              <XCircle className="h-12 w-12 mb-4 text-gray-400" />
              <p>Nenhum agente professor padrão configurado ainda.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg shadow-sm">
                  <div className="flex items-center gap-4 mb-4 sm:mb-0 sm:w-1/2">
                    <Avatar className="h-12 w-12 border-2">
                      <AvatarImage src={model.avatar_url || ''} alt={model.model_name || 'Agente'} />
                      <AvatarFallback>{getInitials(model.model_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-medium">{model.model_name} ({model.provider})</h4>
                      <p className="text-sm text-muted-foreground">{model.description}</p>
                      <p className="text-xs text-muted-foreground">Modelo: {model.model_variant}</p>
                      <p className={`text-xs font-semibold ${model.is_active ? 'text-green-600' : 'text-red-600'}`}>
                        Status: {model.is_active ? 'Ativo' : 'Inativo'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:w-1/2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(model.id)}
                      disabled={testingModelId === model.id || isSubmitting}
                    >
                      {testingModelId === model.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                      Testar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleChat(model.id)}
                      disabled={isSubmitting}
                    >
                      <MessageSquareText className="h-4 w-4 mr-2" />
                      Conversar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditClick(model)}
                      disabled={isSubmitting}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(model.id, model.avatar_url)}
                      disabled={isSubmitting}
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

      {/* Diálogo de Edição para Agentes Padrão */}
      <EditStandardModelDialog
        model={selectedStandardModelToEdit}
        isOpen={isEditStandardDialogOpen}
        onClose={() => setIsEditStandardDialogOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default AdminStandardModels;