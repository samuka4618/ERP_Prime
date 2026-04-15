import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import type { Formulario } from '../models/Formulario';
import { FornecedorModel } from '../models/Fornecedor';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

/** UUID estável por formulário (para upsert no satélite sem coluna extra no ERP). */
export function satelliteSnapshotIdForForm(formId: number): string {
  const digest = crypto.createHash('sha256').update(`erp-prime-satellite-snapshot:${formId}`).digest();
  const buf = Buffer.from(digest.subarray(0, 16));
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const h = buf.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function satellitePublicSlugForForm(formId: number): string {
  return `fd-${formId}`;
}

function client(): AxiosInstance | null {
  const base = (process.env.SATELLITE_BASE_URL || '').trim();
  const token = (process.env.SATELLITE_AUTH_TOKEN || '').trim();
  if (!base || !token) return null;
  return axios.create({
    baseURL: trimBase(base),
    timeout: 20000,
    headers: { Authorization: `Bearer ${token}` }
  });
}

export class SatelliteSyncService {
  static isEnabled(): boolean {
    return !!(process.env.SATELLITE_BASE_URL || '').trim() && !!(process.env.SATELLITE_AUTH_TOKEN || '').trim();
  }

  /** Empurra snapshot do formulário + catálogo de fornecedores para o satélite. */
  static async pushFormSnapshot(formulario: Formulario): Promise<void> {
    const c = client();
    if (!c || !formulario.is_published) return;

    const snapshotId = satelliteSnapshotIdForForm(formulario.id);
    const publicSlug = satellitePublicSlugForForm(formulario.id);
    const fornecedoresRes = await FornecedorModel.findAll({ page: 1, limit: 5000, search: '' });
    const fornecedores = fornecedoresRes.data.map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category
    }));

    const schema = {
      title: formulario.title,
      description: formulario.description || '',
      fields: formulario.fields,
      fornecedores
    };

    await c.put(`/internal/snapshots/${snapshotId}`, {
      source_form_id: formulario.id,
      version: 1,
      schema,
      public_slug: publicSlug
    });
  }

  static async deleteSnapshotBySlug(formId: number): Promise<void> {
    const c = client();
    if (!c) return;
    const publicSlug = satellitePublicSlugForForm(formId);
    try {
      await c.delete(`/internal/snapshots/by-slug/${encodeURIComponent(publicSlug)}`);
    } catch (e: any) {
      if (e?.response?.status !== 404) throw e;
    }
  }

  static async pushDriverState(submissionUuid: string, phase: string, message?: string | null): Promise<void> {
    const c = client();
    if (!c) return;
    await c.post(`/internal/submissions/${submissionUuid}/driver-state`, {
      phase,
      message: message ?? null
    });
  }
}
