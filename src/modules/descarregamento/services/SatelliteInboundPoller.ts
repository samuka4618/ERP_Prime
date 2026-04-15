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

function pollSilent(): boolean {
  const v = (process.env.SATELLITE_POLL_SILENT || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export class SatelliteInboundPoller {
  private static timer: ReturnType<typeof setInterval> | null = null;

  static start(): void {
    if (!SatelliteSyncService.isEnabled()) {
      return;
    }
    const intervalMs = Math.max(15000, parseInt(process.env.SATELLITE_POLL_INTERVAL_MS || '60000', 10) || 60000);
    console.log(`🛰️  Poller do satélite ativo (intervalo ${intervalMs} ms)`);
    if (!pollSilent()) {
      console.log('🛰️  Cada ciclo regista atividade em [satellite poll] (defina SATELLITE_POLL_SILENT=true para silenciar).');
    }
    this.tick().catch((e) => console.error('SatelliteInboundPoller:', e));
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('SatelliteInboundPoller:', e));
    }, intervalMs);
  }

  static async tick(): Promise<void> {
    const c = client();
    if (!c) return;

    const silent = pollSilent();
    if (!silent) {
      console.log('🛰️  [satellite poll] GET /internal/submissions …');
    }

    let list: SatelliteSubmission[] = [];
    try {
      const { data } = await c.get<{ data: { submissions: SatelliteSubmission[] } }>('/internal/submissions', {
        params: { limit: '50' }
      });
      list = data?.data?.submissions || [];
    } catch (e: any) {
      console.error(
        '🛰️  [satellite poll] falha na consulta:',
        e?.response?.status,
        e?.response?.data ?? e?.message ?? e
      );
      return;
    }

    if (list.length === 0) {
      if (!silent) {
        console.log('🛰️  [satellite poll] nenhuma submissão pendente no satélite.');
      }
      return;
    }

    if (!silent) {
      console.log(`🛰️  [satellite poll] ${list.length} submissão(ões) pendente(s) a processar.`);
    }

    const ackIds: string[] = [];
    let imported = 0;
    let deduped = 0;
    for (const s of list) {
      try {
        const existing = await FormResponseModel.findBySatelliteSubmissionId(s.id);
        if (existing) {
          ackIds.push(s.id);
          deduped++;
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
        imported++;
        if (!silent) {
          console.log(
            `🛰️  [satellite poll] importada chegada: id_satélite=${s.id} motorista=${s.driver_name} form=${s.source_form_id} tracking=${s.tracking_token}`
          );
        }
      } catch (err) {
        console.error(`SatelliteInboundPoller: falha ao importar ${s.id}:`, err);
      }
    }

    if (ackIds.length > 0) {
      try {
        const ackRes = await c.post<{ data?: { updated?: number } }>('/internal/submissions/ack', { ids: ackIds });
        const updated = ackRes.data?.data?.updated ?? ackIds.length;
        if (!silent) {
          console.log(
            `🛰️  [satellite poll] POST /internal/submissions/ack → ${updated} id(s) confirmados no satélite (importadas=${imported}, já existiam=${deduped}).`
          );
        }
      } catch (e: any) {
        console.error(
          '🛰️  [satellite poll] falha no ack:',
          e?.response?.status,
          e?.response?.data ?? e?.message ?? e
        );
      }
    }
  }
}
