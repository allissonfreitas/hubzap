# Atualização pelo botão do HubZap

O caminho público é permanente: **allissonfreitas/hubzap**, canal estável GitHub Releases. Ele é definido em `src/update-config.js` e no empacotamento, protegido por testes. Não existe opção de trocar o servidor nas preferências ou no ambiente. Manter os mesmos app IDs, perfil Community e identidade dos pacotes entre versões preserva as sessões locais.

O botão está sempre disponível em Configurações e na barra superior. Ao abrir o aplicativo, e depois a cada seis horas, ele verifica o canal. Uma versão nova destaca o botão. Ao clicar, o mesmo fluxo consulta a versão, baixa o pacote adequado, valida SHA-512 pelo electron-updater, abre a instalação e reinicia. O sistema pode solicitar autorização para instalar. Falhas deixam o app aberto para tentar novamente; o aplicativo não instala um arquivo sem download validado e não atualiza por conta própria ao sair.

Formatos: NSIS no Windows; AppImage, DEB e RPM no Linux. O electron-updater identifica o tipo do pacote Linux pelo marcador gerado pelo empacotamento. AppImage exige que o arquivo instalado esteja em local gravável; DEB/RPM podem solicitar autorização administrativa do sistema. Executar diretamente a pasta de desenvolvimento/descompactada não equivale a instalar um desses formatos.

## Preparar cada versão

1. Aumentar `version` em package.json e package-lock.json. Uma versão com número igual ao instalado não será oferecida. Esta implementação prepara **0.1.2**, posterior à 0.1.1.
2. Manter o canal e os nomes de pacote fixos. Executar testes, smoke e builds Windows/Linux.
3. Rodar `node scripts/verify-update-artifacts.cjs win32` no build Windows e `node scripts/verify-update-artifacts.cjs linux` no Linux. Isso confere origem configurada, versão, presença dos formatos, tamanho e SHA-512 dos arquivos. Os workflows fazem essa validação antes de disponibilizar artefatos.
4. Após aprovação explícita de Allisson para publicar, criar uma Release estável **v0.1.2** no mesmo commit validado em `allissonfreitas/hubzap`. Anexar os arquivos dos dois builds, sem renomear:
   - Windows: `HubZap-Setup-0.1.2.exe`, `latest.yml` e o `.blockmap` gerado.
   - Linux: os arquivos `.AppImage`, `.deb`, `.rpm`, `latest-linux.yml` e qualquer outro manifesto `latest-linux*.yml` gerado.
5. Publicar a Release como estável (não draft/prerelease) somente depois de anexar os pacotes e manifestos dos dois sistemas. Os arquivos do manifesto devem corresponder exatamente aos bytes publicados.
6. Em uma instalação anterior, clicar em Atualizar e confirmar download, instalação, nova versão e preservação das contas. Repetir em Windows e em instalação Linux representativa. Isso é uma validação real de atualização, distinta dos testes automatizados com instaladores simulados.

**Artefatos do GitHub Actions não são Releases.** Se apenas houver um build de teste, ele não aparece no botão dos aplicativos instalados. Os workflows continuam usando `--publish never`; não publicam releases nem tags automaticamente. A 0.1.2 só será oferecida aos usuários depois da publicação aprovada acima. Quem estiver na 0.1.1 poderá obter o novo instalador pelo mesmo caminho de Releases já usado por essa versão; as próximas atualizações usam o fluxo unificado.

Não alterar o caminho para outro repositório ao publicar versões seguintes. Não misturar pacotes da edição pública com edições privadas.
