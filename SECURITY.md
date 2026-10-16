# Segurança

## Princípios do MVP

- O conteúdo remoto do WhatsApp roda sem Node.js.
- `contextIsolation`, `sandbox` e `webSecurity` permanecem habilitados.
- Cada conta usa uma partição persistente própria.
- Links externos são enviados ao navegador padrão.
- Não versionar cookies, perfis de sessão, credenciais, tokens ou arquivos `.env`.

## Observação

O aplicativo depende do WhatsApp Web e mudanças feitas pelo provedor podem exigir atualização do Hub.
