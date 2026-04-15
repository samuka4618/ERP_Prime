import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { validateSubmissionBody, type SchemaJson } from '../lib/validateSubmission';
import { generateTrackingToken } from '../lib/tracking';

const router = Router();

router.get('/form/:publicSlug', async (req: Request, res: Response) => {
  const publicSlug = req.params.publicSlug;
  const pool = getPool();
  const r = await pool.query(
    `SELECT id, source_form_id, version, schema_json FROM form_snapshots WHERE public_slug = $1 LIMIT 1`,
    [publicSlug]
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'Formulário não encontrado' });
    return;
  }
  const row = r.rows[0];
  const schema = row.schema_json as SchemaJson;
  res.json({
    data: {
      snapshot_id: row.id,
      source_form_id: row.source_form_id,
      version: row.version,
      formulario: {
        id: row.source_form_id,
        title: schema.title || 'Formulário',
        description: schema.description || '',
        fields: schema.fields || []
      },
      fornecedores: schema.fornecedores || []
    }
  });
});

router.post('/form/:publicSlug/submit', async (req: Request, res: Response) => {
  const publicSlug = req.params.publicSlug;
  const pool = getPool();
  const r = await pool.query(
    `SELECT id, schema_json FROM form_snapshots WHERE public_slug = $1 LIMIT 1`,
    [publicSlug]
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'Formulário não encontrado' });
    return;
  }
  const snapshot = r.rows[0];
  const schema = snapshot.schema_json as SchemaJson;
  const validated = validateSubmissionBody(schema, req.body || {});
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }
  let tracking = generateTrackingToken();
  for (let i = 0; i < 5; i++) {
    const dup = await pool.query('SELECT 1 FROM submissions WHERE tracking_token = $1', [tracking]);
    if (dup.rowCount === 0) break;
    tracking = generateTrackingToken();
  }
  const subId = await pool.query(
    `INSERT INTO submissions (id, snapshot_id, tracking_token, driver_name, phone, fornecedor_id, responses)
     VALUES (gen_random_uuid(), $1::uuid, $2, $3, $4, $5, $6::jsonb)
     RETURNING id`,
    [snapshot.id, tracking, validated.value.driver_name, validated.value.phone, validated.value.fornecedor_id, JSON.stringify(validated.value.responses)]
  );
  const id = subId.rows[0].id as string;
  await pool.query(
    `INSERT INTO driver_states (submission_id, phase, message, updated_at) VALUES ($1::uuid, 'submitted', NULL, NOW())
     ON CONFLICT (submission_id) DO NOTHING`,
    [id]
  );
  res.status(201).json({
    message: 'Chegada registrada',
    data: {
      submission_id: id,
      tracking_token: tracking,
      tracking_path: `/t/${encodeURIComponent(tracking)}`
    }
  });
});

router.get('/tracking/:trackingToken', async (req: Request, res: Response) => {
  const trackingToken = req.params.trackingToken;
  const pool = getPool();
  const r = await pool.query(
    `SELECT s.id, s.driver_name, s.phone, s.fornecedor_id, s.responses, s.created_at, s.tracking_token,
            d.phase, d.message, d.updated_at as state_updated_at,
            fs.schema_json
     FROM submissions s
     LEFT JOIN driver_states d ON d.submission_id = s.id
     JOIN form_snapshots fs ON fs.id = s.snapshot_id
     WHERE s.tracking_token = $1`,
    [trackingToken]
  );
  if (r.rowCount === 0) {
    res.status(404).json({ error: 'Registro não encontrado' });
    return;
  }
  const row = r.rows[0];
  res.json({
    data: {
      response: {
        id: row.id,
        driver_name: row.driver_name,
        phone_number: row.phone,
        fornecedor_id: row.fornecedor_id,
        responses: row.responses,
        submitted_at: row.created_at,
        tracking_code: row.tracking_token,
        phase: row.phase || 'submitted',
        message: row.message,
        state_updated_at: row.state_updated_at
      }
    }
  });
});

export default router;
