// src/components/forms/Form_create_user.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import {  Trash2} from 'lucide-react';

interface FormCreateUserProps {
  onSuccess: () => void;
}

interface Permissao {
  id: string;
  nome: string;
}

interface Empresa {
  id: string;
  nome: string;
}

const Form_create_user = ({ onSuccess }: FormCreateUserProps) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [nivelDificuldade, setNivelDificuldade] = useState('iniciante');
  const [permissaoSelecionadaId, setPermissaoSelecionadaId] = useState('');
  const [empresaSelecionadaId, setEmpresaSelecionadaId] = useState('');
  const [bloqueado, setBloqueado] = useState(false);

  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  useEffect(() => {
    const fetchSelectOptions = async () => {
      const { data: permissoesData, error: permissoesError } = await supabase.from('permissoes').select('id, nome');
      const { data: empresasData, error: empresasError } = await supabase.from('empresa').select('id, nome');

      if (permissoesError) console.error('Erro ao buscar permissões:', permissoesError);
      else setPermissoes(permissoesData || []);

      if (empresasError) console.error('Erro ao buscar empresas:', empresasError);
      else setEmpresas(empresasData || []);
    };
    fetchSelectOptions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create the user with email and password
      const { data: { user }, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
            apelido,
            nivel_dificuldade: nivelDificuldade,
            permissao_id: permissaoSelecionadaId,
            cod_empresa: empresaSelecionadaId || null,
            bloqueado,
            ativo: !bloqueado,
            avatar_url: null, // Initial avatar URL
          },
        },
      });

      if (authError) throw authError;

      // 2. The user profile is created automatically by a trigger in Supabase (if configured).
      // If not, you would insert into the 'cliente' table here.
      // Since your original code fetches the profile from 'cliente', we'll assume a trigger exists.

      showSuccess('Usuário criado com sucesso!');

      // Reset form and close dialog
      setEmail('');
      setPassword('');
      setNome('');
      setApelido('');
      setNivelDificuldade('iniciante');
      setPermissaoSelecionadaId('');
      setEmpresaSelecionadaId('');
      setBloqueado(false);

      onSuccess();
    } catch (error: any) {
      showError(error.message || 'Erro ao criar usuário.');
      console.error('Erro detalhado:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Adicionar Novo Usuário</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha *</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do usuário" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apelido">Apelido</Label>
            <Input id="apelido" value={apelido} onChange={(e) => setApelido(e.target.value)} placeholder="Apelido no chat" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="permissao_id">Permissão *</Label>
            <Select value={permissaoSelecionadaId} onValueChange={setPermissaoSelecionadaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a permissão" /></SelectTrigger>
              <SelectContent>
                {permissoes.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cod_empresa">Empresa</Label>
            <Select value={empresaSelecionadaId} onValueChange={setEmpresaSelecionadaId}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEmpresaSelecionadaId('')}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                {empresas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              
              </SelectContent>  
              

            </Select>



          </div>
          <div className="space-y-2">
            <Label htmlFor="nivel_dificuldade">Nível de Dificuldade</Label>
            <Select value={nivelDificuldade} onValueChange={setNivelDificuldade}>
              <SelectTrigger><SelectValue placeholder="Nível de Dificuldade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iniciante">Iniciante</SelectItem>
                <SelectItem value="intermediario">Intermediário</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="bloqueado" checked={bloqueado} onCheckedChange={setBloqueado} />
            <Label htmlFor="bloqueado">Usuário Bloqueado</Label>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Criar Usuário
        </Button>
      </form>
    </>
  );
};

export default Form_create_user;