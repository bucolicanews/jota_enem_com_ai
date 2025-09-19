import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

// Funções específicas em português
export const showErroLogin = () => {
  toast.error('Email ou senha incorretos');
};

export const showErroEmailNaoConfirmado = () => {
  toast.error('Email não confirmado. Verifique sua caixa de entrada.');
};

export const showErroEmailJaCadastrado = () => {
  toast.error('Email já cadastrado');
};

export const showErroSenhaFraca = () => {
  toast.error('Senha muito fraca. Use pelo menos 6 caracteres');
};

export const showErroCamposObrigatorios = () => {
  toast.error('Preencha todos os campos obrigatórios');
};

export const showErroGenerico = (mensagem: string = 'Ocorreu um erro') => {
  toast.error(mensagem);
};