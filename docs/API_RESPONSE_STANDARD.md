# Padrão de resposta da API

## Formato

- **Sucesso com corpo:** `{ message?: string, data?: T }` — código 200 ou 201.
- **Erro:** `{ error: string, details?: string[] }` — código 4xx/5xx (tratado pelo middleware de erro).
- **Sem conteúdo:** 204 No Content quando aplicável (ex.: delete).

## Uso nos controllers

Para padronizar respostas de sucesso, use os helpers em `src/shared/utils/apiResponse.ts`:

- `success(res, data?, message?, status?)` — resposta 200 (ou outro status).
- `created(res, data?, message?)` — resposta 201.
- `noContent(res)` — 204.

Exemplo:

```ts
import { created, success } from '../../../shared/utils/apiResponse';

// Criar recurso
return created(res, { ticket }, 'Chamado criado com sucesso');

// Listar
return success(res, result, 'Chamados obtidos com sucesso');
```

Os endpoints existentes podem ser migrados gradualmente para esse padrão; o middleware de erro já retorna `{ error }`.
