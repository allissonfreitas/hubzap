# HubZap by AFATEC

Aplicativo desktop open source para usar sessões independentes do WhatsApp Web em uma única janela, com foco em produtividade e atendimento.

## Recursos

- Contas Pessoal e Empresa com sessões independentes
- Indicadores de conversas não lidas
- Visualização de conta selecionada ou lado a lado
- Mensagens rápidas
- Eventos e lembretes
- Central de Atendimento
- Modo Privacidade independente por conta
- Tema claro e escuro
- Builds para Windows e Linux

## Desenvolvimento

```bash
npm install
npm start
```

## Dados da edição pública

A partir da versão 0.1.1, a edição pública usa identidade e diretório de dados próprios (`HubZap Community`). Ela não importa automaticamente sessões do WhatsApp, configurações, mensagens rápidas, lembretes ou atendimentos de outras edições do HubZap. Essa separação evita compartilhar dados com edições privadas.

## Licença

MIT. HubZap é um projeto da AFATEC.

[afatec.net](https://afatec.net)

> Este projeto não é afiliado, patrocinado ou endossado pela WhatsApp LLC ou Meta Platforms, Inc. WhatsApp é marca de seus respectivos proprietários.

## Interface e produtividade

A barra lateral inicia compacta (72 px); use » para expandir. Conta, layout e zoom ficam na toolbar. Configurações → Aparência salva tema Claro/Escuro/Sistema, fonte Padrão/Inter/Poppins/Arial, tamanho da interface, zoom do WhatsApp e preferência de sidebar no perfil Community. Inter e Poppins são distribuídas localmente com suas licenças, sem carregar fontes remotas. O tema e as fontes personalizam o HubZap; o conteúdo do WhatsApp mantém sua própria aparência, com zoom independente.

Stickers aceita PNG, WebP e GIF locais, até 5 MB por arquivo, 50 MB na biblioteca e 200 itens. Há busca, categorias, recentes, favoritos e exclusão. O botão Mostrar arquivo abre a pasta para anexar manualmente no WhatsApp. O HubZap não injeta APIs de envio, não converte arquivos em pacotes oficiais de figurinhas e não automatiza mensagens.

A Agenda combina a área Outlook (Hoje / Próximos 14 dias) e os lembretes locais existentes. Para ativar a conexão oficial, siga [a configuração Microsoft](docs/OUTLOOK.md). Sem Client ID real, os lembretes locais continuam disponíveis. A conexão solicita somente leitura básica do calendário, sem senha Microsoft ou client secret.

## Validação e instalador

```bash
npm ci
npm test
npm run smoke
npm run dist:win -- --publish never
```

O smoke test abre o Electron com dados isolados em `.smoke-data/`, verifica a navegação e as preferências e salva uma captura em `dist/hubzap-preview.png`. Não autentica WhatsApp nem Microsoft. A sincronização real do Outlook deve ser validada com uma conta autorizada após configurar o registro Microsoft. Os workflows geram artefatos de build; não publicam releases automaticamente.

## Repertório e criador de figurinhas

Salve imagens dos grupos pelo menu de contexto quando disponíveis, importe arquivos, arraste ou cole imagens e organize em Pessoal, Empresa e Compartilhados. Há nome, grupo de origem, etiquetas, favoritos, detecção de duplicatas e exportação do original. O criador local gera WebP estático com imagem e texto. [Como usar](docs/STICKERS.md).

## Windows e Linux em todas as versões

O suporte aos dois sistemas é obrigatório. O workflow Linux executa testes e a interface no Ubuntu e gera AppImage, DEB e RPM x64 com `npm run dist:linux -- --publish never`. Os pacotes ficam nos artefatos **HubZap-Linux-x64** em GitHub Actions; o instalador Windows fica em **HubZap-Windows-Setup**. Não são publicadas releases automaticamente. Para executar AppImage, torne o arquivo executável; algumas distribuições exigem FUSE, ou use `--appimage-extract-and-run`.

## Atualização permanente pelo aplicativo

O botão Atualizar está na barra superior e em Configurações. O canal permanece fixo em `allissonfreitas/hubzap` no Windows e Linux. Ele verifica, baixa, valida e inicia a instalação da versão nova pelo próprio app. Os instaladores/manifestos devem ser publicados em uma Release estável aprovada; artefatos de teste não aparecem no botão. [Fluxo e preparação de versões](docs/UPDATES.md).
