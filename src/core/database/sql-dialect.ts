/**
 * Helper de SQL por dialect: SQLite vs PostgreSQL.
 * Use estas funções em queries dinâmicas para que o mesmo código funcione com USE_POSTGRES true ou false.
 */
import { config } from '../../config/database';

const isPostgres = config.database.usePostgres;

/** Literal para “ativo” em comparação. SQLite: 1, Postgres: true. Use em WHERE col = sqlBooleanTrue(). */
export function sqlBooleanTrue(): string {
  return isPostgres ? 'true' : '1';
}

/** Literal para “inativo” em comparação. SQLite: 0, Postgres: false. */
export function sqlBooleanFalse(): string {
  return isPostgres ? 'false' : '0';
}

/** Valor para bind em UPDATE/INSERT de coluna booleana. SQLite: 1/0, Postgres: true/false. */
export function bindBoolean(value: boolean): number | boolean {
  return isPostgres ? !!value : (value ? 1 : 0);
}

/** Data/hora atual (timestamp). SQLite: datetime('now'), Postgres: NOW() */
export function sqlNow(): string {
  return isPostgres ? 'NOW()' : "datetime('now')";
}

/** Data atual (só dia). SQLite: DATE('now'), Postgres: CURRENT_DATE */
export function sqlDateToday(): string {
  return isPostgres ? 'CURRENT_DATE' : "DATE('now')";
}

/** Coluna como data (só dia). SQLite: DATE(col), Postgres: (col)::date */
export function sqlDateColumn(column: string): string {
  return isPostgres ? `(${column})::date` : `DATE(${column})`;
}

/** Expressão: coluna = data de hoje. */
export function sqlColumnEqualsDateToday(column: string): string {
  const today = sqlDateToday();
  const colDate = sqlDateColumn(column);
  return `${colDate} = ${today}`;
}

/**
 * Data/hora atual menos um intervalo.
 * @param interval - ex: "7 days", "5 minutes", "24 hours", "30 days", "1 day"
 */
export function sqlDatetimeMinus(interval: string): string {
  if (isPostgres) {
    const safe = interval.replace(/'/g, "''");
    return `NOW() - INTERVAL '${safe}'`;
  }
  const sqliteOffset = interval.replace(/\s+/, ' ');
  return `datetime('now', '-${sqliteOffset}')`;
}

/** Expressão: coluna >= agora menos intervalo. */
export function sqlColumnGteDatetimeMinus(column: string, interval: string): string {
  const bound = sqlDatetimeMinus(interval);
  return `${column} >= ${bound}`;
}

/** Hora do dia (0-23). SQLite: strftime('%H', col), Postgres: EXTRACT(HOUR FROM col) */
export function sqlStrftimeHour(column: string): string {
  return isPostgres ? `EXTRACT(HOUR FROM ${column})` : `strftime('%H', ${column})`;
}

/** Ano-mês. SQLite: strftime('%Y-%m', col), Postgres: to_char(col, 'YYYY-MM') */
export function sqlStrftimeYMD(column: string): string {
  return isPostgres ? `to_char(${column}, 'YYYY-MM')` : `strftime('%Y-%m', ${column})`;
}

/** Snippet para UPDATE: updated_at = valor atual. */
export function sqlUpdatedAtSet(): string {
  return 'updated_at = CURRENT_TIMESTAMP';
}

/**
 * Diferença em minutos entre duas colunas timestamp (fim - início).
 * SQLite: (julianday(end) - julianday(start)) * 24 * 60
 * Postgres: EXTRACT(EPOCH FROM (end - start))/60
 */
export function sqlMinutesDiff(startColumn: string, endColumn: string): string {
  return isPostgres
    ? `EXTRACT(EPOCH FROM (${endColumn} - ${startColumn}))/60`
    : `(julianday(${endColumn}) - julianday(${startColumn})) * 24 * 60`;
}

/**
 * Diferença em horas entre duas colunas timestamp (fim - início).
 * SQLite: (julianday(end) - julianday(start)) * 24
 * Postgres: EXTRACT(EPOCH FROM (end - start))/3600
 */
export function sqlHoursDiff(startColumn: string, endColumn: string): string {
  return isPostgres
    ? `EXTRACT(EPOCH FROM (${endColumn} - ${startColumn}))/3600`
    : `(julianday(${endColumn}) - julianday(${startColumn})) * 24`;
}

/**
 * Diferença em minutos de uma coluna até agora (now - startColumn).
 * SQLite: (julianday('now') - julianday(col)) * 24 * 60
 * Postgres: EXTRACT(EPOCH FROM (NOW() - col))/60
 */
export function sqlMinutesDiffFromNow(startColumn: string): string {
  return isPostgres
    ? `EXTRACT(EPOCH FROM (NOW() - ${startColumn}))/60`
    : `(julianday('now') - julianday(${startColumn})) * 24 * 60`;
}

/** Filtro: coluna >= valor (parâmetro ?). SQLite: datetime(col) >= datetime(?), Postgres: col >= ?::timestamp */
export function sqlDatetimeGeParam(column: string): string {
  return isPostgres ? `${column} >= ?::timestamp` : `datetime(${column}) >= datetime(?)`;
}

/** Filtro: coluna <= valor (parâmetro ?). */
export function sqlDatetimeLeParam(column: string): string {
  return isPostgres ? `${column} <= ?::timestamp` : `datetime(${column}) <= datetime(?)`;
}

/**
 * Data/hora atual menos N dias (parâmetro ?).
 * SQLite: datetime('now', '-' || ? || ' days')
 * Postgres: NOW() - (? || ' days')::INTERVAL  (ou INTERVAL '1 day' * ?)
 */
export function sqlNowMinusDaysParam(): string {
  return isPostgres ? "NOW() - (? || ' days')::INTERVAL" : "datetime('now', '-' || ? || ' days')";
}

/** Ordenação por proximidade de data (agendamentos). SQLite: julianday; Postgres: ABS(EXTRACT(EPOCH FROM (scheduled_date - NOW()))) */
export function sqlOrderByDateProximity(dateColumn: string): string {
  return isPostgres
    ? `ABS(EXTRACT(EPOCH FROM (${dateColumn}::timestamp - NOW()))) ASC`
    : `ABS(julianday(${dateColumn}) - julianday('now')) ASC`;
}

/** CASE para ordenar: hoje primeiro, depois passado, depois futuro. scheduled_date. */
export function sqlOrderByTodayFirstThenPastThenFuture(dateColumn: string): string {
  if (isPostgres) {
    const col = `(${dateColumn})::date`;
    return `CASE WHEN ${col} = CURRENT_DATE THEN 0 WHEN ${col} < CURRENT_DATE THEN 1 ELSE 2 END, ${dateColumn}::timestamp ASC`;
  }
  return `CASE WHEN ${dateColumn} = DATE('now') THEN 0 WHEN ${dateColumn} < DATE('now') THEN 1 ELSE 2 END, ${dateColumn} ASC`;
}

/** Coluna como data igual a hoje (para ORDER BY CASE). */
export function sqlDateEqualsToday(column: string): string {
  const today = sqlDateToday();
  const colDate = sqlDateColumn(column);
  return `${colDate} = ${today}`;
}

/** Coluna >= agora menos intervalo (para WHERE). */
export function sqlDateGteMinus(column: string, interval: string): string {
  const bound = sqlDatetimeMinus(interval);
  return `${column} >= ${bound}`;
}

/**
 * ORDER BY: strings só com dígitos primeiro (ordem numérica), depois as demais (ordem lexicográfica).
 * Necessário no Postgres porque CAST(col AS INTEGER) com valor como "Doca B" gera erro; no SQLite o CAST não falha, mas o GLOB mantém o mesmo critério.
 */
export function sqlOrderNumericStringColumn(column: string): string {
  if (isPostgres) {
    return `CASE WHEN ${column} ~ '^[0-9]+$' THEN 0 ELSE 1 END, CASE WHEN ${column} ~ '^[0-9]+$' THEN CAST(${column} AS INTEGER) ELSE 0 END, ${column}`;
  }
  return `CASE WHEN NOT (${column} GLOB '*[^0-9]*') AND length(${column}) > 0 THEN 0 ELSE 1 END, CASE WHEN NOT (${column} GLOB '*[^0-9]*') AND length(${column}) > 0 THEN CAST(${column} AS INTEGER) ELSE 0 END, ${column}`;
}

export const sqlDialect = {
  isPostgres,
  sqlNow,
  sqlDateToday,
  sqlDateColumn,
  sqlColumnEqualsDateToday,
  sqlDatetimeMinus,
  sqlColumnGteDatetimeMinus,
  sqlStrftimeHour,
  sqlStrftimeYMD,
  sqlUpdatedAtSet,
  sqlMinutesDiff,
  sqlMinutesDiffFromNow,
  sqlHoursDiff,
  sqlDatetimeGeParam,
  sqlDatetimeLeParam,
  sqlNowMinusDaysParam,
  sqlOrderByDateProximity,
  sqlOrderByTodayFirstThenPastThenFuture,
  sqlDateEqualsToday,
  sqlDateGteMinus,
  sqlOrderNumericStringColumn
};
