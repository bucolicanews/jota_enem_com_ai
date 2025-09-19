import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Upload, Download, Trash2, FileText, XCircle } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';

const Documents = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isMobile = useIsMobile();

  const fetchDocuments = useCallback(async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Erro ao carregar documentos.');
      console.error('Error fetching documents:', error);
    } else {
      setDocuments(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      
      setUser(user);
      fetchDocuments(user.id);
    };
    getUser();
  }, [navigate, fetchDocuments]);

  // Função unificada para upload de um arquivo.
  const uploadFile = async (file: File) => {
    if (!user) return;

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = `${user.id}/${fileName}`;

    setUploading(true);
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) {
        showError('Erro ao fazer upload do arquivo.');
        console.error('Upload error:', uploadError);
        return;
      }

      const { data: insertData, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
        });

      if (insertError) {
        showError('Erro ao registrar o documento.');
        console.error('Insert error:', insertError);
        return;
      }

      showSuccess('Documento enviado com sucesso!');
      fetchDocuments(user.id);
    } catch (error) {
      showError('Ocorreu um erro inesperado.');
      console.error('Unexpected error:', error);
    } finally {
      setUploading(false);
    }
  };

  // Lida com o evento de seleção de arquivo pelo input.
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      uploadFile(event.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Lida com o evento de soltar o arquivo na área de drag and drop.
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      uploadFile(event.dataTransfer.files[0]);
      event.dataTransfer.clearData();
    }
  };

  // Previne o comportamento padrão de arrastar e soltar.
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);

      if (error) {
        showError('Erro ao baixar o arquivo.');
        console.error('Download error:', error);
        return;
      }

      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showSuccess('Download iniciado!');
    } catch (error) {
      showError('Ocorreu um erro inesperado ao baixar.');
      console.error('Unexpected download error:', error);
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete || !user) {
      return;
    }

    setLoading(true);
    try {
      // 1. Remover do Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([documentToDelete.file_path]);

      if (storageError) {
        throw storageError;
      }

      // 2. Remover da tabela 'documents'
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentToDelete.id);

      if (dbError) {
        throw dbError;
      }

      showSuccess('Documento excluído com sucesso!');
      setDocumentToDelete(null);
      setIsDeleteDialogOpen(false);
      fetchDocuments(user.id);
    } catch (error) {
      showError('Erro ao excluir o documento.');
      console.error('Delete error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 px-4 py-6 md:px-8 md:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
      
      {/* Portal de Upload Centralizado */}
      <Card
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex flex-col items-center justify-center p-12 text-center transition-all duration-300
          ${isDragging ? 'border-4 border-dashed border-primary bg-zinc-50 dark:bg-zinc-800' : 'border-2 border-dashed border-gray-300 dark:border-gray-700'}
        `}
      >
        <div className="flex flex-col items-center space-y-4">
          <Upload className={`h-16 w-16 transition-colors duration-300 ${isDragging ? 'text-primary' : 'text-gray-500'}`} />
          <p className="text-lg font-semibold text-muted-foreground">
            Arraste e solte arquivos aqui
          </p>
          <p className="text-sm text-muted-foreground">
            ou clique no botão abaixo para selecionar um arquivo.
          </p>
        </div>
        <Button onClick={handleButtonClick} disabled={uploading} className="mt-6">
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {uploading ? 'Enviando...' : 'Fazer Upload'}
        </Button>
        <Input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
      </Card>

      {/* Lista de Documentos */}
      <Card>
        <CardHeader>
          <CardTitle>Seus documentos</CardTitle>
          <CardDescription>
            Gerencie e acesse os materiais de estudo que você carregou.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-md shadow-sm transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    <FileText className="h-6 w-6 text-gray-500" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{doc.file_name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(doc.file_path, doc.file_name)}
                      aria-label="Baixar documento"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDocumentToDelete(doc);
                        setIsDeleteDialogOpen(true);
                      }}
                      aria-label="Excluir documento"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
              <XCircle className="h-12 w-12 mb-4 text-gray-400" />
              <p>Você ainda não enviou nenhum documento.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Documento</DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja excluir este documento? Esta ação é irreversível.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Documents;
