//ImportaoclienteSupabaseparainteragircomobancodedados.
import{supabase}from'@/integrations/supabase/client';
export interface Permissao{
id:string;
nome:string;
descricao:string|null;
created_at:string;
updated_at:string;
}
export interface UserPermissions{
name:string;
isProf:boolean;
isAdmin:boolean;
isPro:boolean;
isFree:boolean;
}
/**
*Buscaonomedapermissãodeumusuárioespecífico,fazendoduasconsultas.
*AprimeiraparaoIDdapermissaoeasgundaparaonome.
*
*@paramuserIdOIDdousuário.
*@returnsOnomedapermissãoou'Usuário'emcasodeerro.
*/
export const getPermissaoUsuario=async(userId:string):Promise<string>=>{
try{
// Adicionado log para depurar o ID do usuário
console.log('DEBUG: Buscando permissões para o userId:', userId);
//Passo1:Buscaropermissao_iddousuário
const{data:clienteData,error:clienteError}=await supabase
.from('cliente')
.select('permissao_id')
.eq('id',userId)
.single();
if(clienteError||!clienteData){
console.error('ErroaobuscaroIDdapermissãodousuário:',clienteError);
return'Usuário';
}
const permissaoId=clienteData.permissao_id;
//Passo2:BuscaronomedapermissãousandooIDencontrado
const{data:permissaoData,error:permissaoError}=await supabase
.from('permissoes')
.select('nome')
.eq('id',permissaoId)
.single();
if(permissaoError||!permissaoData){
console.error('Erroaobuscaronomedapermissão:',permissaoError);
return'Usuário';
}
//Adicionadologparadepuraronomedapermissaoretornado
console.log('Nomedapermissãoretornado:',permissaoData.nome);
return permissaoData.nome;
}catch(error){
console.error('Erroaocarregarpermissão:',error);
return'Usuário';
}
};
export const getTodasPermissoes=async():Promise<Permissao[]>=>{
try{
const{data,error}=await supabase
.from('permissoes')
.select('*')
.order('nome',{ascending:true});
if(error){
console.error('Erroaobuscarpermissões:',error);
return[];
}
return data as Permissao[];
}catch(error){
console.error('Erroaocarregarpermissões:',error);
return[];
}
};
export const atualizarPermissaoUsuario=async(userId:string,permissaoId:string)=>{
try{
const{error}=await supabase
.from('cliente')
.update({permissao_id:permissaoId})
.eq('id',userId);
if(error){
throw error;
}
return true;
}catch(error){
console.error('Erroaotualizarpermissão:',error);
throw error;
}
};
export const checkUserPermissions=async(userId:string):Promise<UserPermissions>=>{
const permissionName=await getPermissaoUsuario(userId);
const isAdmin=permissionName==='Admin';
const isProf=permissionName==='Prof'||isAdmin;
const isPro=permissionName==='Pro'||isProf||isAdmin;
const isFree=permissionName==='Free';
console.log('Permissõesdousuário:',{name:permissionName,isProf,isAdmin,isPro,isFree});
return{
name:permissionName,
isProf,
isAdmin,
isPro,
isFree,
};
};

export const requireFree=async(userId:string):Promise<boolean>=>{
const permissions=await checkUserPermissions(userId);
return permissions.isFree;
};
export const requireAdmin=async(userId:string):Promise<boolean>=>{
const permissions=await checkUserPermissions(userId);
return permissions.isAdmin;
};
export const requireContentManager=async(userId:string):Promise<boolean>=>{
const permissions=await checkUserPermissions(userId);
return permissions.isProf;
};
export const requireProAccess=async(userId:string):Promise<boolean>=>{
const permissions=await checkUserPermissions(userId);
return permissions.isPro;
};
export const requireDevAccess=async(userId:string):Promise<boolean>=>{
const permissions=await checkUserPermissions(userId);
return permissions.isAdmin;
};
export const requireProfOnly=async(userId:string):Promise<boolean>=>{
const permissions=await checkUserPermissions(userId);
return permissions.name==='Prof';
};

export const requireProfOrAdmin = async (userId: string): Promise<boolean> => {
  const permissions = await checkUserPermissions(userId);
  return permissions.isProf || permissions.isAdmin;
};