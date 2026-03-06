# Auditoria N+1 (listagens)

## Resumo

- **Tickets (findAll, findByUser, findByAttendant):** Uma query com JOINs (users, attendant, category); sem N+1.
- **TicketHistory.findByTicket:** Uma query + formatação. Antes: N chamadas a `formatSystemDateOnly` (getTimezone em cache após a primeira). Otimizado: timezone resolvido uma vez, `formatSystemDateOnlyWithTimezone` síncrono no map.
- **Demais listagens:** Cadastros e outros módulos que usem listagem com JOIN único estão ok; onde houver loop com `findById` ou query por item, preferir JOIN ou `WHERE id IN (...)` + mapa.

## Otimização aplicada

- `TicketHistoryModel.findByTicket`: uso de `getSystemTimezone()` uma vez e `formatSystemDateOnlyWithTimezone(timezone, date)` no map, eliminando N chamadas assíncronas ao timezone.
