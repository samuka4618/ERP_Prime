import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getPool } from '../db';
import { requireInternalAuth } from '../middleware/internalAuth';

const router = Router();
router.use(requireInternalAuth);

function hashSchema(schema: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex');
}

/** PUT /internal/snapshots/:snapshotId — upsert snapshot (ERP envia schema completo + slug público) */
router.put('/snapshots/:snapshotId', async (req: Request, res: Response) => {
  const snapshotId = req.params.snapshotId;
  if (!/^[0-9a-f-]{36}$/i.test(snapshotId)) {
    res.status(400).json({ error: 'snapshotId deve ser UUID' });
    return;
  }
  const { source_form_id, version, schema, public_slug } = req.body || {};
  if (typeof source_form_id !== 'number' && typeof source_form_id !== 'string') {
    res.status(400).json({ error: 'source_form_id obrigatório' });
    return;
  }
  const sid = typeof source_form_id === 'string' ? parseInt(source_form_id, 10) : source_form_id;
  if (!Number.isInteger(sid) || sid <= 0) {
    res.status(400).json({ error: 'source_form_id inválido' });
    return;
  }
  if (!schema || typeof schema !== 'object') {
    res.status(400).json({ error: 'schema obrigatório (objeto)' });
    return;
  }
  const slug = typeof public_slug === 'string' && public_slug.trim() ? public_slug.trim().slice(0, 120) : null;
  if (!slug) {
    res.status(400).json({ error: 'public_slug obrigatório' });
    return;
  }
  const ver = typeof version === 'number' && Number.isInteger(version) ? version : 1;
  const contentHash = hashSchema(schema);
  const pool = getPool();
  await pool.query(
    `INSERT INTO form_snapshots (id, source_form_id, version, schema_json, public_slug, content_hash, updated_at)
     VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       source_form_id = EXCLUDED.source_form_id,
       version = EXCLUDED.version,
       schema_json = EXCLUDED.schema_json,
       public_slug = EXCLUDED.public_slug,
       content_hash = EXCLUDED.content_hash,
       updated_at = NOW()`,
    [snapshotId, sid, ver, JSON.stringify(schema), slug, contentHash]
  );
  res.json({ message: 'Snapshot gravado', data: { snapshot_id: snapshotId, public_slug: slug } });
});

/** DELETE /internal/snapshots/by-slug/:publicSlug — remove formulário público (ex.: despublicado no ERP) */
router.delete('/snapshots/by-slug/:publicSlug', async (req: Request, res: Response) => {
  const publicSlug = req.params.publicSlug;
  const pool = getPool();
  const r = await pool.query('DELETE FROM form_snapshots WHERE public_slug = $1 RETURNING id', [publicSlug]);
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'Slug não encontrado' });
    return;
  }
  res.json({ message: 'Removido' });
});

/** GET /internal/submissions?limit= — pendentes de ack (erp_ack_at IS NULL), mais antigos primeiro */
router.get('/submissions', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
  const pool = getPool();
  const rows = await pool.query(
    `SELECT s.id, s.snapshot_id, s.tracking_token, s.driver_name, s.phone, s.fornecedor_id, s.responses, s.created_at,
            fs.source_form_id, fs.public_slug
     FROM submissions s
     JOIN form_snapshots fs ON fs.id = s.snapshot_id
     WHERE s.erp_ack_at IS NULL
     ORDER BY s.created_at ASC, s.id ASC
     LIMIT $1`,
    [limit]
  );
  const list = rows.rows.map((row) => ({
    id: row.id,
    snapshot_id: row.snapshot_id,
    tracking_token: row.tracking_token,
    driver_name: row.driver_name,
    phone_number: row.phone,
    fornecedor_id: row.fornecedor_id,
    responses: row.responses,
    created_at: row.created_at,
    source_form_id: row.source_form_id,
    public_slug: row.public_slug
  }));
  res.json({ data: { submissions: list } });
});

/** POST /internal/submissions/ack */
router.post('/submissions/ack', async (req: Request, res: Response) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids deve ser array não vazio' });
    return;
  }
  const uuidIds = ids.filter((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x));
  if (uuidIds.length === 0) {
    res.status(400).json({ error: 'nenhum UUID válido' });
    return;
  }
  const pool = getPool();
  const r = await pool.query(
    `UPDATE submissions SET erp_ack_at = NOW() WHERE id = ANY($1::uuid[]) AND erp_ack_at IS NULL`,
    [uuidIds]
  );
  res.json({ message: 'Ack aplicado', data: { updated: r.rowCount } });
});

/** POST /internal/submissions/:submissionId/driver-state */
router.post('/submissions/:submissionId/driver-state', async (req: Request, res: Response) => {
  const submissionId = req.params.submissionId;
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) {
    res.status(400).json({ error: 'submissionId inválido' });
    return;
  }
  const phase = typeof req.body?.phase === 'string' ? req.body.phase.slice(0, 64) : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.slice(0, 2000) : null;
  const dock = typeof req.body?.dock === 'string' ? req.body.dock.trim().slice(0, 120) : null;
  if (!phase) {
    res.status(400).json({ error: 'phase obrigatório' });
    return;
  }
  const pool = getPool();
  const ex = await pool.query('SELECT id FROM submissions WHERE id = $1::uuid', [submissionId]);
  if (ex.rowCount === 0) {
    res.status(404).json({ error: 'Submissão não encontrada' });
    return;
  }
  await pool.query(
    `INSERT INTO driver_states (submission_id, phase, message, dock, updated_at)
     VALUES ($1::uuid, $2, $3, $4, NOW())
     ON CONFLICT (submission_id) DO UPDATE SET
       phase = EXCLUDED.phase,
       message = EXCLUDED.message,
       dock = EXCLUDED.dock,
       updated_at = NOW()`,
    [submissionId, phase, message, dock]
  );
  res.json({ message: 'Estado atualizado' });
});

export default router;
