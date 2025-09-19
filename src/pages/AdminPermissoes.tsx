import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, PlusCircle, Pencil, Trash2, Shield } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { requireAdmin, requireDevAccess } from '@/utils/permissions';

const AdminPermissoes = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [permissoes, setPermissoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPermissoes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('permissoes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      showError('Erro ao carregar permissões.');
      console.error('Error fetching permissoes:', error);
    } else {
      setPermissoes(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);

      const hasAccess = await requireDevAccess(user.id);
      if (!hasAccess) {
        showError('Acesso negado. Apenas administradores podem gerenciar permissões.');
        navigate('/dashboard');
        return;
      }
      
      setHasAdminAccess(true);
      fetchPermissoes();
    };
    checkPermissions();
  }, [navigate, fetchPermissoes]);

  if (!hasAdminAccess) {
    return <div>Verificando permissões...</div>;
  }

  return (
    <div>Admin Permissoes Content</div>
  );
};

export default AdminPermissoes;