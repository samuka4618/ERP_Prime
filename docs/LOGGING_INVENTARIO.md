# Inventario de fontes de log

## Criticidade alta
- `src/server.ts`: bootstrap, roteamento API, eventos de ciclo de vida e tratamento global de erro.
- `src/shared/utils/logger.ts`: ponto central do backend.
- `src/modules/chamados/services/WebSocketService.ts`: fluxo de alta frequencia em tempo real.
- `src/modules/descarregamento/services/SatelliteInboundPoller.ts`: polling e integracao recorrente.
- `frontend/src/services/api.ts` e `web-next/src/legacy/services/api.ts`: interceptores de request/response.

## Criticidade media
- `frontend/src/utils/logger.ts` e `web-next/src/legacy/utils/logger.ts`: logging no browser e buffer local.
- `frontend/src/components/LogViewer.tsx` e `web-next/src/legacy/components/LogViewer.tsx`: visualizacao e custo de renderizacao.

## Criticidade baixa
- Scripts utilitarios (`scripts/*.ts`, `scripts/*.js`): logs pontuais de manutencao.
- `tools/cadastros-legacy/**`: utilitarios legados fora do fluxo principal.

## Diretriz de priorizacao
1. Fluxos online de producao (API, websocket e jobs).
2. Camadas compartilhadas (logger backend/frontend).
3. Ferramentas de suporte (viewer, scripts, docs).
