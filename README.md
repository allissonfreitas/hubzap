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
