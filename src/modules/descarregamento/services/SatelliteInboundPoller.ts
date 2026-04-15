import axios, { AxiosInstance } from 'axios';
import { FormResponseModel } from '../models/FormResponse';
import { SatelliteSyncService } from './SatelliteSyncService';

function trimBase(url: string): string {
  return url.replace(/\/+$/, '');
}

function client(): AxiosInstance | null {
  const base = (process.env.SATELLITE_BASE_URL || '').trim();
  const token = (process.env.SATELLITE_AUTH_TOKEN || '').trim();
  if (!base || !token) return null;
  return axios.create({
    baseURL: trimBase(base),
    timeout: 25000,
    headers: { Authorization: `Bearer ${token}` }
  });
}

type SatelliteSubmission = {
  id: string;
  tracking_token: string;
  driver_name: string;
  phone_number: string | null;
  fornecedor_id: number;
  responses: Record<string, unknown>;
  source_form_id: number;
};

export class SatelliteInboundPoller {
  private static timer: ReturnType<typeof setInterval> | null = null;

  static start(): void {
    if (!SatelliteSyncService.isEnabled()) {
      return;
    }
    const intervalMs = Math.max(15000, parseInt(process.env.SATELLITE_POLL_INTERVAL_MS || '60000', 10) || 60000);
    console.log(`🛰️  Poller do satélite ativo (intervalo ${intervalMs} ms)`);
    this.tick().catch((e) => console.error('SatelliteInboundPoller:', e));
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('SatelliteInboundPoller:', e));
    }, intervalMs);
  }

  static async tick(): Promise<void> {
    const c = client();
    if (!c) return;

    const { data } = await c.get<{ data: { submissions: SatelliteSubmission[] } }>('/internal/submissions', {
      params: { limit: '50' }
    });
    const list = data?.data?.submissions || [];
    if (list.length === 0) {
      return;
    }

    const ackIds: string[] = [];
    for (const s of list) {
      try {
        const existing = await FormResponseModel.findBySatelliteSubmissionId(s.id);
        if (existing) {
          ackIds.push(s.id);
          continue;
        }
        await FormResponseModel.create({
          form_id: s.source_form_id,
          responses: s.responses,
          driver_name: s.driver_name,
          phone_number: s.phone_number || undefined,
          fornecedor_id: s.fornecedor_id,
          tracking_code: s.tracking_token,
          satellite_submission_id: s.id
        });
        ackIds.push(s.id);
      } catch (err) {
        console.error(`SatelliteInboundPoller: falha ao importar ${s.id}:`, err);
      }
    }

    if (ackIds.length > 0) {
      await c.post('/internal/submissions/ack', { ids: ackIds });
    }
  }
}
