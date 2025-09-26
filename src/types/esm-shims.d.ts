// src/types/esm-shims.d.ts

// Declara que a importação de 'https://esm.sh/google-auth-library@9.11.0'
// deve ser tratada como a importação do pacote 'google-auth-library' instalado localmente.
declare module 'https://esm.sh/google-auth-library@9.11.0' {
  export * from 'google-auth-library';
}