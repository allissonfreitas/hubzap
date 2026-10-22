# Ativar Outlook Calendar no HubZap público

A Agenda mantém os lembretes locais e consulta as ocorrências do calendário padrão para os próximos 14 dias (incluindo reuniões recorrentes). É somente leitura: não lê e-mail, não cria nem altera eventos. Links Teams são abertos no navegador quando fornecidos pelo Graph; na ausência deles, abre o compromisso no Outlook.

## O que Allisson precisa criar

1. Acesse Microsoft Entra admin center → App registrations → New registration. Nome sugerido: **HubZap Community**.
2. Escolha contas somente da sua organização, ou contas organizacionais e pessoais se quiser oferecer suporte público. A escolha deve corresponder ao tenant configurado abaixo.
3. Copie **Application (client) ID**. Para uso restrito à organização, copie também **Directory (tenant) ID**. Esses identificadores são públicos; **não crie client secret**.
4. Em Authentication → Advanced settings, habilite **Allow public client flows**. Esta implementação usa OAuth Device Code com MSAL Node: não exige redirect URI. Políticas corporativas podem bloquear esse fluxo; nesse caso o administrador precisa autorizar seu uso antes da conexão.
5. Em API permissions → Microsoft Graph → Delegated permissions, adicione apenas **Calendars.ReadBasic**. Remova o User.Read padrão se não for necessário para outro uso. Não adicione permissões de aplicação, e-mail ou escrita. Conceda consentimento administrativo apenas se a política do tenant exigir.

## Configuração local

Configure as variáveis no ambiente do processo que inicia o HubZap:

```powershell
$env:HUBZAP_MICROSOFT_CLIENT_ID = '<Application client ID real>'
$env:HUBZAP_MICROSOFT_TENANT_ID = '<Directory tenant ID real>'
npm start
```

Também é possível criar `%APPDATA%\HubZap Community\outlook-config.json` para o aplicativo instalado:

```json
{
  "clientId": "<Application client ID real>",
  "tenantId": "<Directory tenant ID real>"
}
```

As variáveis têm prioridade sobre o arquivo. `tenantId` aceita o UUID do tenant, `organizations`, `consumers` ou `common` (padrão). Não coloque senha, secret ou tokens nesse arquivo. Reinicie o HubZap após configurar. Arquivos `.env` não são carregados automaticamente.

## Uso e limites

Abra Agenda → Conectar Outlook. O HubZap abre `https://microsoft.com/devicelogin`; digite no site Microsoft o código exibido na Agenda e aprove a leitura básica do calendário. A autenticação acontece no navegador Microsoft, nunca em um formulário do HubZap. Desconectar remove a sessão e o cache local; para revogar consentimento na Microsoft, use o painel de aplicativos da sua conta/organização.

O cache MSAL só é persistido com `safeStorage` e criptografia do sistema; no Linux sem armazenamento seguro, fica apenas em memória. Nenhum token é enviado ao renderer ou salvo em texto puro. O cache é exclusivo da edição Community. A sincronização ocorre ao conectar, ao atualizar manualmente e a cada cinco minutos com o app aberto. Avisos nativos e badge aparecem nos 15 minutos anteriores à reunião, uma vez por ocorrência durante a execução. Não há avisos com o aplicativo fechado. A configuração de notificações do Windows pode ocultar avisos.

Em caso de consentimento negado, token expirado/revogado, falta de licença de calendário ou política corporativa, a Agenda informa erro e permite reconectar. A autenticação real requer o registro acima e uma conta de teste; não há credenciais inventadas no projeto.

Referências oficiais: [MSAL Node](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node), [calendarView e permissões mínimas](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0).
