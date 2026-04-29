import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Save } from 'lucide-react';
import { apiService } from '../services/api';

const AccessProfiles: React.FC = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [ps, perms] = await Promise.all([apiService.getAccessProfiles(), apiService.getPermissions()]);
      setProfiles(ps || []);
      setPermissions((perms || []).map((p: any) => ({ ...p, granted: false })));
      if (ps?.length) setSelectedProfileId(ps[0].id);
    };
    load().catch(() => toast.error('Falha ao carregar perfis de acesso'));
  }, []);

  useEffect(() => {
    const loadProfilePerms = async () => {
      if (!selectedProfileId) return;
      const rows = await apiService.getAccessProfilePermissions(selectedProfileId);
      const map = new Map(rows.map((r) => [Number(r.permission_id), !!r.granted]));
      setPermissions((prev) => prev.map((p) => ({ ...p, granted: map.get(Number(p.id)) ?? false })));
    };
    loadProfilePerms().catch(() => toast.error('Falha ao carregar permissões do perfil'));
  }, [selectedProfileId]);

  const createProfile = async () => {
    const name = newName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const created = await apiService.createAccessProfile({ name, slug });
    setProfiles((prev) => [...prev, created]);
    setSelectedProfileId(created.id);
    setNewName('');
  };

  const save = async () => {
    if (!selectedProfileId) return;
    try {
      setSaving(true);
      await apiService.updateAccessProfilePermissions(
        selectedProfileId,
        permissions.map((p) => ({ permissionId: p.id, granted: !!p.granted }))
      );
      toast.success('Perfil atualizado');
    } catch {
      toast.error('Falha ao salvar permissões do perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Perfis de Acesso</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow space-y-2">
            <div className="flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 px-3 py-2 border rounded" placeholder="Novo perfil" />
              <button onClick={createProfile} className="px-3 py-2 bg-primary-600 text-white rounded"><Plus className="w-4 h-4" /></button>
            </div>
            {profiles.map((p) => (
              <button key={p.id} onClick={() => setSelectedProfileId(p.id)} className={`w-full text-left px-3 py-2 rounded ${selectedProfileId === p.id ? 'bg-primary-100 text-primary-700' : ''}`}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="flex justify-end mb-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              {permissions.map((perm) => (
                <label key={perm.id} className="flex items-center justify-between py-2 border-b dark:border-gray-700">
                  <div>
                    <div className="text-sm font-medium">{perm.name}</div>
                    <div className="text-xs text-gray-500">{perm.module} - {perm.code}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!perm.granted}
                    onChange={(e) => setPermissions((prev) => prev.map((p) => p.id === perm.id ? { ...p, granted: e.target.checked } : p))}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessProfiles;

