# Instruções do projeto

- Sempre conversar em português do Brasil.
- Manter suporte a **Windows e Linux em todas as versões**. Linux é uma exigência permanente de Allisson, não uma entrega opcional.
- Preservar os formatos Linux AppImage, DEB e RPM e o instalador Windows NSIS.
- Ao alterar funcionalidades, executar testes e validar o build Windows e o build Linux. Usar o workflow Ubuntu para Linux quando estiver desenvolvendo no Windows. Relatar falhas e validações pendentes sem afirmar que o build passou.
- Não publicar release ou tag automaticamente. Builds de CI devem usar `--publish never` e entregar os pacotes como artefatos.
- Manter a edição pública isolada de outras edições e preservar dados e sessões locais existentes.
- Stickers: guardar apenas imagens escolhidas explicitamente pelo usuário; não coletar conversas em massa, usar APIs internas do WhatsApp ou automatizar envio. Preservar os bytes das animações importadas.
