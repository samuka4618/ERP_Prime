import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Save } from 'lucide-react';
import { apiService } from '../services/api';

interface Permission {
  id: number;
  name: string;
  code: string;
  module: string;
  granted?: boolean;
}

interface AccessProfile {
  id: number;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
}

const AccessProfilesPage: React.FC = () => {
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [search, setSearch] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) || null,
    [profiles, selectedProfileId]
  );

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    try {
      const [accessProfiles, allPermissions] = await Promise.all([
        apiService.getAccessProfiles(),
        apiService.getPermissions()
      ]);
      setProfiles(accessProfiles);
      setPermissions(Array.isArray(allPermissions) ? allPermissions : []);
      if (!selectedProfileId && accessProfiles.length > 0) {
        setSelectedProfileId(accessProfiles[0].id);
      }
    } catch {
      toast.error('Falha ao carregar perfis de acesso');
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!selectedProfileId) return;
      const profilePermissions = await apiService.getAccessProfilePermissions(selectedProfileId);
      const map = new Map<number, boolean>(
        profilePermissions.map((p) => [Number(p.permission_id), !!p.granted])
      );
      setPermissions((prev) => prev.map((perm) => ({ ...perm, granted: map.get(perm.id) ?? false })));
    };
    void run();
  }, [selectedProfileId]);

  const filteredPermissions = permissions.filter((p) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term) || p.module.toLowerCase().includes(term);
  });

  const togglePermission = (permissionId: number, granted: boolean) => {
    setPermissions((prev) => prev.map((p) => (p.id === permissionId ? { ...p, granted } : p)));
  };

  const savePermissions = async () => {
    if (!selectedProfileId) return;
    try {
      setSaving(true);
      await apiService.updateAccessProfilePermissions(
        selectedProfileId,
        permissions.map((p) => ({ permissionId: p.id, granted: !!p.granted }))
      );
      toast.success('Permissões do perfil atualizadas');
    } catch {
      toast.error('Falha ao salvar permissões do perfil');
    } finally {
      setSaving(false);
    }
  };

  const createProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const created = await apiService.createAccessProfile({ name, slug });
    setNewProfileName('');
    setProfiles((prev) => [...prev, created]);
    setSelectedProfileId(created.id);
    toast.success('Perfil criado');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Perfis de acesso</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Crie perfis e defina permissões por módulo/ação.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Perfis</h2>
            <div className="flex gap-2">
              <input
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Novo perfil"
                className="flex-1 px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              />
              <button onClick={createProfile} className="px-3 py-2 bg-primary-600 text-white rounded-md">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm ${selectedProfileId === p.id ? 'bg-primary-100 text-primary-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Matriz de permissões {selectedProfile ? `- ${selectedProfile.name}` : ''}
              </h2>
              <div className="flex gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar por módulo, nome ou código"
                  className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 w-72"
                />
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto border rounded-md dark:border-gray-700">
              {filteredPermissions.map((perm) => (
                <label key={perm.id} className="flex items-center justify-between gap-3 px-3 py-2 border-b dark:border-gray-700">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{perm.name}</div>
                    <div className="text-xs text-gray-500">{perm.module} - {perm.code}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!perm.granted}
                    onChange={(e) => togglePermission(perm.id, e.target.checked)}
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

export default AccessProfilesPage;

