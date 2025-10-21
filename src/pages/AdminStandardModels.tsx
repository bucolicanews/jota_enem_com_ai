// src/pages/AdminStandardModels.tsx

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Trash2, TestTube, MessageSquareText, Pencil, ShieldAlert, XCircle } from 'lucide-react';
import { EditStandardModelDialog } from '@/components/EditStandardModelDialog';
import { AdminStandardModelForm } from '@/components/AdminStandardModelForm'; // Importa o formulário que acabamos de criar
import { requireAdmin } from '@/utils/permissions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface LanguageModel {
  id: string;
  provider: string;
  api_key: string;
  model_name: string | null;
  model_variant: string | null;
  is_active: boolean;
  description: string | null;
  avatar_url: string | null;
}

// A palavra 'export' foi REMOVIDA daqui para usarmos 'export default' no final
const AdminStandardModels = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingPermissions, setCheckingPermissions] = useState(true);
  const [models, setModels] = useState<LanguageModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [isEditStandardDialogOpen, setIsEditStandardDialogOpen] = useState(false);
  const [selectedStandardModelToEdit, setSelectedStandardModelToEdit] = useState<LanguageModel | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '..';
    const names = name.split(' ');
    return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('language_models').select('*').eq('is_standard', true).order('created_at', { ascending: false });
    if (error) {
      showError('Erro ao carregar agentes.');
    } else {
      setModels(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkPermissionsAndFetchData = async () => {
      setCheckingPermissions(true);
      const { data: { user: loggedInUser } } = await supabase.auth.getUser();
      if (!loggedInUser) {
        navigate('/login'); return;
      }
      const canAccess = await requireAdmin(loggedInUser.id);
      setIsAdmin(canAccess);
      if (canAccess) {
        fetchModels();
      }
      setCheckingPermissions(false);
    };
    checkPermissionsAndFetchData();
  }, [navigate, fetchModels]);

  const handleAddOrUpdateModel = async (modelData: any) => {
    if (!isAdmin) {
      showError('Acesso negado.'); return;
    }
    setIsSubmitting(true);
    const dataToSave = {
      ...modelData,
      user_id: null,
      is_standard: true,
      api_key: modelData.provider === 'Google Vertex AI' ? '' : modelData.api_key,
    };
    const { id, ...dataWithoutId } = dataToSave;
    let result;
    if (id) {
      result = await supabase.from('language_models').update(dataWithoutId).eq('id', id);
    } else {
      result = await supabase.from('language_models').insert(dataWithoutId);
    }
    if (result.error) {
      showError(`Erro ao salvar agente: ${result.error.message}`);
    } else {
      showSuccess(`Agente ${id ? 'atualizado' : 'adicionado'} com sucesso!`);
      fetchModels();
    }
    setIsSubmitting(false);
  };

  const handleTest = async (modelId: string) => {
    setTestingModelId(modelId);
    try {
      // A correção é adicionar JSON.stringify()
      const { data, error } = await supabase.functions.invoke('test-llm-key', {
        body: JSON.stringify({ modelId }),
      });

      if (error) throw new Error(error.message);

      if (data.success) {
        showSuccess(data.message || 'Conexão bem-sucedida!');
      } else {
        showError(data.message || 'Ocorreu um erro desconhecido.');
      }
    } catch (err: any) {
      showError(`Falha ao testar a conexão: ${err.message}`);
    } finally {
      setTestingModelId(null);
    }
  };

  // Funções handle... restantes
  const handleDelete = (modelId: string, avatarUrl: string | null) => { /* ... */ };
  const handleChat = (modelId: string) => navigate(`/ai-chat/${modelId}`);
  const handleEditClick = (model: LanguageModel) => { setSelectedStandardModelToEdit(model); setIsEditStandardDialogOpen(true); };
  const handleEditSuccess = () => { setIsEditStandardDialogOpen(false); fetchModels(); };

  if (checkingPermissions) return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  if (!isAdmin) return <div className="p-8 text-center">Acesso negado.</div>;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Novo Agente Professor</CardTitle>
          <CardDescription>Configure um novo modelo de IA para ser um agente padrão.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminStandardModelForm isAdmin={isAdmin} onSubmit={handleAddOrUpdateModel} isSubmitting={isSubmitting} initialModel={null} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Agentes Professores Ativos</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div> : (
            <div className="space-y-4">
              {models.map((model) => (
                <div key={model.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12"><AvatarImage src={model.avatar_url || ''} /><AvatarFallback>{getInitials(model.model_name)}</AvatarFallback></Avatar>
                    <div>
                      <h4 className="font-semibold">{model.model_name} <span className="text-muted-foreground">({model.provider})</span></h4>
                      <p className="text-sm text-muted-foreground">{model.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleTest(model.id)} disabled={testingModelId === model.id}><TestTube className="h-4 w-4 mr-2" />Testar</Button>
                    <Button variant="secondary" size="sm" onClick={() => handleChat(model.id)}><MessageSquareText className="h-4 w-4 mr-2" />Conversar</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(model)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(model.id, model.avatar_url)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <EditStandardModelDialog model={selectedStandardModelToEdit} isOpen={isEditStandardDialogOpen} onClose={() => setIsEditStandardDialogOpen(false)} onSuccess={handleEditSuccess} />
    </div>
  );
};

// CORREÇÃO FINAL: Usando a exportação padrão no final do arquivo.
export default AdminStandardModels;