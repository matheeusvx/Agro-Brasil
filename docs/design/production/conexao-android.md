# Android — diagnóstico e correção da conexão local

Validação em 09/11/2026. Nenhum commit, push ou treinamento de ML.

## Causa e correção

O emulador `emulator-5554` estava conectado e autorizado no ADB, mas `adb reverse --list` estava vazio. MongoDB e Express já estavam ativos e ouvindo exclusivamente em `127.0.0.1`, nas portas 27017 e 3000. `/health` e `/api/v1/me` responderam HTTP 200 usando a sessão demonstrativa existente. Ela não estava expirada: validade até 10/11/2026 às 10h38, America/Sao_Paulo (13h38 UTC).

No Android, `127.0.0.1` refere-se ao próprio emulador. Faltava a ponte para o loopback do computador. Foi executado:

```powershell
& "$env:ANDROID_HOME/platform-tools/adb.exe" -s emulator-5554 reverse tcp:3000 tcp:3000
```

O login passou imediatamente ao repetir **Verificar acesso**, no mesmo APK e com o token já preenchido. Não foi necessário renovar sessão, reiniciar serviços, reconstruir o app ou modificar autenticação. O endereço padrão nativo de `apiBase()` é `http://127.0.0.1:3000`; o sucesso após encaminhar somente essa porta confirma o destino efetivamente usado pelo APK instalado. O fluxo de galeria não foi usado.

O novo [`scripts/connect-android-local.ps1`](../../../scripts/connect-android-local.ps1) verifica saúde da API/MongoDB e dispositivo e configura/confere o encaminhamento. Foi executado com sucesso. Não lê tokens. Deve ser repetido após reiniciar/reconectar o ADB ou emulador; a configuração não é permanente. Não abre portas na rede, não configura túneis externos e não altera o bind do Express.

## Validação real

Serviços já ativos foram mantidos para preservar dados e processos existentes. A validação usou a base normal da porta 3000, sem inserir registros nem executar seed. Resultados estruturados, sem credenciais: [conexao-validacao.json](evidencias/conexao-validacao.json). Verificação do script/ADB: [conexao-adb.txt](evidencias/conexao-adb.txt).

| Verificação | Resultado |
|---|---|
| MongoDB/Express | Listeners em 127.0.0.1:27017 e 127.0.0.1:3000; health confirma MongoDB |
| `/health`, `/api/v1/me`, `/api/v1/catalog` | HTTP 200 |
| Token deliberadamente inválido | HTTP 401, sem alterar banco ou sessão válida |
| Organização sem vínculo | HTTP 403, sem contornar autorização |
| Login Android | Token existente aceito, organização autorizada disponível |
| Home | Carregada online na sessão normal |
| Produção → Produção e excedentes | Duas produções: tomate 100 kg e alface 12,5 kg; total 112,5 kg e duas culturas, conferidos com `/productions` |
| Perda real da API no Android | Removido somente o reverse; Atualizar preservou 112,5 kg e mostrou “Offline · dados desatualizados” |
| Recuperação | Reverse restaurado; Atualizar consultou novamente e removeu o aviso offline |
| Logs | Inspecionados logcat e log do processo do app; nenhum SocketException, Connection refused, CLEARTEXT, Failed host lookup, FATAL EXCEPTION ou Unhandled Exception no trecho disponível. O login captura exceções, por isso a ausência de stack trace não demonstra conectividade; a causa foi confirmada pelo reverse ausente e recuperação imediata |
| `flutter analyze` | No issues found |
| `flutter test` | 97 testes aprovados, sem atualizar goldens |
| `flutter test test/live_api.dart` | Um teste aprovado, HTTP Dart real contra API/seed existentes |

Os 112,5 kg pertencem aos registros demonstrativos já existentes na base local. Não são os 205 kg da base isolada usada no relatório anterior e não representam estatística regional. As capturas desta rodada são do Android real, com respostas da API, sem dados injetados na interface.

## Capturas

- [Erro antes do encaminhamento](evidencias/conexao-login-indisponivel.png), com campo de token oculto pelo próprio aplicativo.
- [Home autenticada](evidencias/conexao-home.png).
- [Dashboard online — 112,5 kg](evidencias/conexao-producao.png).
- [Snapshot offline com aviso](evidencias/conexao-offline.png).
- [Atualização online recuperada](evidencias/conexao-recuperada.png).

## Offline, erros e limites

O dashboard permite consulta do snapshot previamente carregado, com indicação de desatualização. Não permite autenticação inicial offline e não cria fila de escritas. A suíte verifica isolamento do cache e rejeição de fallback em 401/403; os testes HTTP reais confirmaram a diferença entre identidade inválida (401) e organização não autorizada (403). Não foi necessário alterar regras nem mensagens para corrigir esta ocorrência.

Na tela inicial, falha de transporte permanece apresentada pela mensagem genérica existente “Serviço indisponível. Tente novamente.”. Respostas HTTP de autenticação usam a mensagem da API, que agrupa token inválido, expirado ou usuário inativo; não é possível atribuir especificamente expiração apenas pelo status 401. A validade da sessão foi conferida separadamente no arquivo local, sem divulgar o token. O teste negativo 401 desta rodada usa token inválido, não uma credencial expirada criada para o teste.

O teste offline interrompeu o acesso do app à API pela remoção do encaminhamento, sem desligar o MongoDB/Express ou a rede geral do Android. O comportamento de rede móvel em aparelho físico e autenticação de produção continuam sem validação nesta rodada. Não foi gerado novo APK porque não houve mudança no código do aplicativo.

## Preservação

Nenhum arquivo de código dos dashboards, Home, Ofertas, Pedidos, Rastreabilidade, portal Next.js ou backend foi alterado nesta correção. As mudanças anteriores do workspace foram preservadas. Foram adicionados somente o utilitário de configuração local, documentação e evidências; o teste HTTP existente atualizou sua evidência em `docs/evidencias/flutter-api-real.json`. MongoDB, API e encaminhamento foram deixados ativos; nenhuma credencial foi renovada.
