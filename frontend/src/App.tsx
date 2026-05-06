import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider, usePermissions } from './contexts/PermissionsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SystemConfigProvider } from './contexts/SystemConfigContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import CreateTicket from './pages/CreateTicket';
import TicketDetail from './pages/TicketDetail';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Sessions from './pages/Sessions';
import NotificationsPage from './pages/Notifications';
import SystemConfig from './pages/SystemConfig';
import SystemSettings from './pages/SystemSettings';
import CategoryAssignments from './pages/CategoryAssignments';
import Categories from './pages/Categories';
import Status from './pages/Status';
import CadastrosConfig from './pages/CadastrosConfig';
import PermissionsPage from './pages/Permissions';
import AccessProfilesPage from './pages/AccessProfiles';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import BackupRestore from './pages/BackupRestore';
import { ClientRegistrations } from './pages/ClientRegistrations';
import { ClientRegistrationForm } from './pages/ClientRegistrationForm';
import { ClientRegistrationDetail } from './pages/ClientRegistrationDetail';
import SolicitacoesCompra from './pages/Compras/SolicitacoesCompra';
import NovaSolicitacaoCompra from './pages/Compras/NovaSolicitacaoCompra';
import SolicitacaoCompraDetail from './pages/Compras/SolicitacaoCompraDetail';
import ComprasConfig from './pages/Compras/ComprasConfig';
import NovoOrcamento from './pages/Compras/NovoOrcamento';
import MinhasSolicitacoesComprador from './pages/Compras/MinhasSolicitacoesComprador';
import SolicitacoesPendentesAprovacao from './pages/Compras/SolicitacoesPendentesAprovacao';
import OrcamentosRecebidos from './pages/Compras/OrcamentosRecebidos';
import OrcamentoDetail from './pages/Compras/OrcamentoDetail';
import AgendamentosDescarregamento from './pages/Descarregamento/Agendamentos';
import FornecedoresDescarregamento from './pages/Descarregamento/Fornecedores';
import DescarregamentoConfig from './pages/Descarregamento/DescarregamentoConfig';
import GradeDescarregamento from './pages/Descarregamento/GradeDescarregamento';
import Docas from './pages/Descarregamento/Docas';
import MotoristasPatio from './pages/Descarregamento/MotoristasPatio';
import HistoricoDescarregamento from './pages/Descarregamento/HistoricoDescarregamento';
import NovoAgendamento from './pages/Descarregamento/NovoAgendamento';
import NovoFornecedor from './pages/Descarregamento/NovoFornecedor';
import PublicForm from './pages/Descarregamento/PublicForm';
import DriverTracking from './pages/Descarregamento/DriverTracking';
import PublicFormRestrito from './pages/Descarregamento/PublicFormRestrito';
import LoadingSpinner from './components/LoadingSpinner';
import { PublicFormOnlyGuard, PublicFormOnlyWrapper } from './components/PublicFormOnlyGuard';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  /** Quando true, não redirecciona para troca obrigatória (usar nessa página). */
  bypassMandatoryPassword?: boolean;
}> = ({ children, bypassMandatoryPassword }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!bypassMandatoryPassword && user?.requiresPasswordChange) {
    return <Navigate to="/forcar-troca-senha" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    if (user?.requiresPasswordChange) {
      return <Navigate to="/forcar-troca-senha" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const PermissionRoute: React.FC<{ permission: string; children: React.ReactNode }> = ({ permission, children }) => {
  const { loadingPermissions, hasPermission } = usePermissions();
  if (loadingPermissions) return <LoadingSpinner />;
  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const iamV2Enabled = String(import.meta.env.VITE_FEATURE_IAM_V2 ?? 'true') !== 'false';
  return (
    <PublicFormOnlyGuard>
      <Routes>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } 
        />
        <Route
          path="/forcar-troca-senha"
          element={
            <ProtectedRoute bypassMandatoryPassword>
              <ForcePasswordChangePage />
            </ProtectedRoute>
          }
        />
        {/* Formulário e acompanhamento públicos: modo "só formulário" ativo (sem acesso a login/ERP). */}
        <Route path="/descarregamento/formulario/:id" element={<PublicFormOnlyWrapper><PublicForm /></PublicFormOnlyWrapper>} />
        <Route path="/descarregamento/formulario-publico" element={<PublicFormOnlyWrapper><PublicForm /></PublicFormOnlyWrapper>} />
        <Route path="/descarregamento/formulario-publico/:id" element={<PublicFormOnlyWrapper><PublicForm /></PublicFormOnlyWrapper>} />
        <Route path="/descarregamento/acompanhamento/:trackingCode" element={<PublicFormOnlyWrapper><DriverTracking /></PublicFormOnlyWrapper>} />
        <Route path="/descarregamento/restrito" element={<PublicFormRestrito />} />
        <Route 
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tickets" element={<PermissionRoute permission="tickets.view"><Tickets /></PermissionRoute>} />
        <Route path="tickets/new" element={<CreateTicket />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="client-registrations" element={<PermissionRoute permission="registrations.view"><ClientRegistrations /></PermissionRoute>} />
        <Route path="client-registrations/new" element={<ClientRegistrationForm />} />
        <Route path="client-registrations/:id" element={<ClientRegistrationDetail />} />
        <Route path="client-registrations/:id/edit" element={<ClientRegistrationForm />} />
        <Route path="compras/solicitacoes" element={<PermissionRoute permission="compras.solicitacoes.view"><SolicitacoesCompra /></PermissionRoute>} />
        <Route path="compras/solicitacoes/nova" element={<NovaSolicitacaoCompra />} />
        <Route path="compras/solicitacoes/:id" element={<SolicitacaoCompraDetail />} />
        <Route path="compras/solicitacoes/:solicitacaoId/orcamento/novo" element={<NovoOrcamento />} />
        <Route path="compras/orcamentos" element={<PermissionRoute permission="compras.orcamentos.view"><OrcamentosRecebidos /></PermissionRoute>} />
        <Route path="compras/orcamentos/:id" element={<OrcamentoDetail />} />
        <Route path="compras/minhas-solicitacoes" element={<MinhasSolicitacoesComprador />} />
        <Route path="compras/pendentes-aprovacao" element={<SolicitacoesPendentesAprovacao />} />
        <Route path="compras-config" element={<ComprasConfig />} />
        <Route path="descarregamento/agendamentos" element={<PermissionRoute permission="descarregamento.agendamentos.view"><AgendamentosDescarregamento /></PermissionRoute>} />
        <Route path="descarregamento/agendamentos/novo" element={<NovoAgendamento />} />
        <Route path="descarregamento/agendamentos/:id" element={<NovoAgendamento />} />
        <Route path="descarregamento/fornecedores" element={<PermissionRoute permission="descarregamento.fornecedores.view"><FornecedoresDescarregamento /></PermissionRoute>} />
        <Route path="descarregamento/fornecedores/novo" element={<NovoFornecedor />} />
        <Route path="descarregamento/fornecedores/:id/editar" element={<NovoFornecedor />} />
        <Route path="descarregamento/grade" element={<PermissionRoute permission="descarregamento.grade.view"><GradeDescarregamento /></PermissionRoute>} />
        <Route path="descarregamento/docas" element={<PermissionRoute permission="descarregamento.docas.view"><Docas /></PermissionRoute>} />
        <Route path="descarregamento/motoristas-patio" element={<PermissionRoute permission="descarregamento.motoristas.view"><MotoristasPatio /></PermissionRoute>} />
        <Route path="descarregamento/historico" element={<PermissionRoute permission="descarregamento.historico.view"><HistoricoDescarregamento /></PermissionRoute>} />
        <Route path="descarregamento-config" element={<DescarregamentoConfig />} />
        <Route path="users" element={<PermissionRoute permission="users.view"><Users /></PermissionRoute>} />
        <Route path="permissions" element={<PermissionRoute permission="permissions.manage"><PermissionsPage /></PermissionRoute>} />
        {iamV2Enabled && (
          <Route path="access-profiles" element={<PermissionRoute permission="profiles.manage"><AccessProfilesPage /></PermissionRoute>} />
        )}
        <Route path="profile" element={<Profile />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="system-config" element={<SystemConfig />} />
        <Route path="system-settings" element={<SystemSettings />} />
        <Route path="categories" element={<Categories />} />
        <Route path="status" element={<Status />} />
        <Route path="cadastros-config" element={<CadastrosConfig />} />
        <Route path="category-assignments" element={<CategoryAssignments />} />
        <Route path="reports" element={<PermissionRoute permission="reports.view"><Reports /></PermissionRoute>} />
        <Route path="audit" element={<PermissionRoute permission="system.audit.view"><Audit /></PermissionRoute>} />
        <Route path="backup" element={<BackupRestore />} />
      </Route>
    </Routes>
    </PublicFormOnlyGuard>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <SystemConfigProvider>
            <Router>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
              <AppRoutes />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--toast-bg)',
                    color: 'var(--toast-color)',
                    border: '1px solid var(--toast-border)',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#10B981',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#EF4444',
                      secondary: '#fff',
                    },
                  },
                }}
              >
                {(t) => (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toast.dismiss(t.id)}
                    onKeyDown={(e) => e.key === 'Enter' && toast.dismiss(t.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <ToastBar toast={t} />
                  </div>
                )}
              </Toaster>
          </div>
        </Router>
          </SystemConfigProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
