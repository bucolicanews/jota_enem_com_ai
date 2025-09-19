import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Pencil, Ban, RefreshCw } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { requireAdmin } from '@/utils/permissions';
const AdminRedefinirSenha = () => {
const navigate = useNavigate();
const [user, setUser] = useState<SupabaseUser | null>(null);
const [hasAdminAccess, setHasAdminAccess] = useState(false);
const [profiles, setProfiles] = useState<any[]>([]);
const [permissoes, setPermissoes] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [isSubmitting, setIsSubmitting] = useState(false);
const [checkingPermissions, setCheckingPermissions] = useState(true);
const [searchTerm, setSearchTerm] = useState('');
const [filterPermission, setFilterPermission] = useState('all');
const fetchProfiles = useCallback(async () => {
setLoading(true);
const { data, error } = await supabase
.from('cliente')
.select('*, permissao:permissao_id(*)')
.order('nome', { ascending: true });
if (error) {
showError('Erro ao carregar perfis.');
console.error('Error fetching profiles:', error);
} else {
setProfiles(data || []);
}
setLoading(false);
}, []);
const fetchPermissoes = useCallback(async () => {
const { data, error } = await supabase
.from('permissoes')
.select('nome');
if (error) {
console.error('Erro ao carregar permissões:', error);
} else {
setPermissoes(data || []);
}
}, []);
useEffect(() => {
const checkAdmin = async () => {
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
navigate('/login');
return;
}
setUser(user);
const hasAccess = await requireAdmin(user.id);
if (!hasAccess) {
showError('Acesso negado. Você não tem permissões de administrador.');
navigate('/dashboard');
} else {
setHasAdminAccess(true);
fetchPermissoes();
fetchProfiles();
}
setCheckingPermissions(false);
};
checkAdmin();
}, [navigate, fetchProfiles, fetchPermissoes]);
const handleEditProfile = (profile) => {
navigate(`/admin/profiles/${profile.id}`);
};
const handleDeleteProfile = (profile) => {
console.log('Botão de banir/deletar clicado para o perfil:', profile);
};
const handleResetPassword = async (email) => {
setIsSubmitting(true);
try {
const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
redirectTo: `${window.location.origin}/reset-password`,
});
if (error) {
showError(`Erro ao enviar e-mail de redefinição de senha: ${error.message}`);
} else {
showSuccess('E-mail de redefinição de senha enviado com sucesso!');
}
} catch (error) {
showError('Erro ao enviar e-mail de redefinição de senha.');
console.error('Reset password error:', error);
} finally {
setIsSubmitting(false);
}
};
const filteredProfiles = useMemo(() => {
let filtered = profiles;
if (searchTerm) {
const lowerCaseSearch = searchTerm.toLowerCase();
filtered = filtered.filter(profile =>
profile.nome.toLowerCase().includes(lowerCaseSearch) ||
profile.email.toLowerCase().includes(lowerCaseSearch) ||
profile.permissao?.nome.toLowerCase().includes(lowerCaseSearch)
);
}
if (filterPermission !== 'all') {
filtered = filtered.filter(profile =>
profile.permissao?.nome === filterPermission
);
}
return filtered;
}, [profiles, searchTerm, filterPermission]);
if (checkingPermissions) {
return (
<div className="flex items-center justify-center min-h-screen">
<Loader2 className="h-8 w-8 animate-spin" />
</div>
);
}
if (!hasAdminAccess) {
return null;
}
return (
<main className="space-y-8 p-4 md:p-8">
<Card>
<CardHeader>
<CardTitle>Redefinir Senha </CardTitle>
<CardDescription>Envie para o Email do usuário o link de redefinição de senha</CardDescription>
</CardHeader>
<CardContent>
<div className="flex flex-col md:flex-row gap-4 mb-6">
<Input
placeholder="Buscar por nome, e-mail ou permissão..."
value={searchTerm}
onChange={(e) => setSearchTerm(e.target.value)}
className="flex-grow"
/>
<Select value={filterPermission} onValueChange={setFilterPermission}>
<SelectTrigger className="w-full md:w-[200px]">
<SelectValue placeholder="Filtrar por Permissão" />
</SelectTrigger>
<SelectContent>
<SelectItem value="all">Todas as Permissões</SelectItem>
{permissoes.map(p => (
<SelectItem key={p.nome} value={p.nome}>{p.nome}</SelectItem>
))}
</SelectContent>
</Select>
</div>
{loading ? (
<div className="flex justify-center items-center py-8">
<Loader2 className="h-8 w-8 animate-spin text-gray-500" />
</div>
) : filteredProfiles.length > 0 ? (
<Table>
<TableHeader>
<TableRow>
<TableHead>Nome</TableHead>
<TableHead>E-mail</TableHead>
<TableHead>Permissão</TableHead>
<TableHead>Ações</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{filteredProfiles.map((profile) => (
<TableRow key={profile.id}>
<TableCell className="font-medium">{profile.nome}</TableCell>
<TableCell>{profile.email}</TableCell>
<TableCell>{profile.permissao?.nome || 'N/A'}</TableCell>
<TableCell className="space-x-1">
<Button
variant="ghost"
size="icon"
onClick={() => handleResetPassword(profile.email)}
disabled={isSubmitting}
>
<RefreshCw className="h-4 w-4 text-purple-500" />
</Button>
</TableCell>
</TableRow>
))}
</TableBody>
</Table>
) : (
<p className="text-center text-gray-500 py-8">Nenhum perfil encontrado.</p>
)}
</CardContent>
</Card>
</main>
);
};
export default AdminRedefinirSenha;