# Backlog — MVP 2

Itens fora do escopo do MVP 1 (G10). Anote aqui; não implemente no MVP 1.

| Item | Origem | Observação |
|---|---|---|
| Build Linux | SPEC §7 | electron-builder já suporta; falta testar `node-pty` |
| Build Windows | SPEC §7 | PTY via ConPTY |
| Publicação web / multiusuário | SPEC §7 | exige backend com credenciais de serviço; rever G3 |
| Assinatura e notarização Apple, auto-update | SPEC §7 | precisa de Apple Developer ID |
| Logs agregados de vários pods / deployment | SPEC §7 | `kubectl logs -l` ou vários streams |
| Provedor Codex CLI (`codex exec --sandbox read-only --ephemeral`) | F7.0 | já instalado na máquina de desenvolvimento (0.158) |
| Provedor Gemini CLI | F7.0 | camada gratuita com conta Google |
| IA com leitura do repositório de código ("linked repository") | fase 6.5 | exige regras próprias: injeção vinda do log poderia ler segredos do repositório |
| Alertas (sino) por pico de erros | fase 6.5 | notificação do macOS |
| Abrir `.gz` e arquivos acima de 200 MB (leitura em streaming) | fase 6.6 | hoje o arquivo é lido inteiro no renderer |
