# Instruções do projeto

- Sempre conversar em português do Brasil.
- Manter suporte a **Windows e Linux em todas as versões**. Linux é uma exigência permanente de Allisson, não uma entrega opcional.
- Preservar os formatos Linux AppImage, DEB e RPM e o instalador Windows NSIS.
- Manter permanentemente o botão de atualização no aplicativo e o canal público fixo em `allissonfreitas/hubzap`. Não trocar esse caminho entre versões, sistemas ou instaladores; não permitir substituição por configuração local ou variável de ambiente. O botão deve verificar, baixar, validar, instalar e reiniciar no Windows e Linux pelo mesmo fluxo.
- Toda versão distribuída deve aumentar o número de versão e manter os arquivos `latest.yml` e `latest-linux.yml` junto dos instaladores na Release aprovada. Artefatos de CI não substituem Releases para o atualizador.
- Ao alterar funcionalidades, executar testes e validar o build Windows e o build Linux. Usar o workflow Ubuntu para Linux quando estiver desenvolvendo no Windows. Relatar falhas e validações pendentes sem afirmar que o build passou.
- Não publicar release ou tag automaticamente. Builds de CI devem usar `--publish never` e entregar os pacotes como artefatos.
- Manter a edição pública isolada de outras edições e preservar dados e sessões locais existentes.
- Stickers: guardar apenas imagens escolhidas explicitamente pelo usuário; não coletar conversas em massa, usar APIs internas do WhatsApp ou automatizar envio. Preservar os bytes das animações importadas.
