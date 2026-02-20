import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
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
import NotificationsPage from './pages/Notifications';
import SystemConfig from './pages/SystemConfig';
import SystemSettings from './pages/SystemSettings';
import CategoryAssignments from './pages/CategoryAssignments';
import Categories from './pages/Categories';
import Status from './pages/Status';
import CadastrosConfig from './pages/CadastrosConfig';
import PermissionsPage from './pages/Permissions';
import Reports from './pages/Reports';
import AdminDashboard from './pages/AdminDashboard';
import Performance from './pages/Performance';
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
import NovoAgendamento from './pages/Descarregamento/NovoAgendamento';
import NovoFornecedor from './pages/Descarregamento/NovoFornecedor';
import PublicForm from './pages/Descarregamento/PublicForm';
import LoadingSpinner from './components/LoadingSpinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
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
        path="/" 
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="tickets/new" element={<CreateTicket />} />
        <Route path="tickets/:id" element={<TicketDetail />} />
        <Route path="client-registrations" element={<ClientRegistrations />} />
        <Route path="client-registrations/new" element={<ClientRegistrationForm />} />
        <Route path="client-registrations/:id" element={<ClientRegistrationDetail />} />
        <Route path="client-registrations/:id/edit" element={<ClientRegistrationForm />} />
        <Route path="compras/solicitacoes" element={<SolicitacoesCompra />} />
        <Route path="compras/solicitacoes/nova" element={<NovaSolicitacaoCompra />} />
        <Route path="compras/solicitacoes/:id" element={<SolicitacaoCompraDetail />} />
        <Route path="compras/solicitacoes/:solicitacaoId/orcamento/novo" element={<NovoOrcamento />} />
        <Route path="compras/orcamentos" element={<OrcamentosRecebidos />} />
        <Route path="compras/orcamentos/:id" element={<OrcamentoDetail />} />
        <Route path="compras/minhas-solicitacoes" element={<MinhasSolicitacoesComprador />} />
        <Route path="compras/pendentes-aprovacao" element={<SolicitacoesPendentesAprovacao />} />
        <Route path="compras-config" element={<ComprasConfig />} />
        <Route path="descarregamento/agendamentos" element={<AgendamentosDescarregamento />} />
        <Route path="descarregamento/agendamentos/novo" element={<NovoAgendamento />} />
        <Route path="descarregamento/agendamentos/:id" element={<NovoAgendamento />} />
        <Route path="descarregamento/fornecedores" element={<FornecedoresDescarregamento />} />
        <Route path="descarregamento/fornecedores/novo" element={<NovoFornecedor />} />
        <Route path="descarregamento/fornecedores/:id/editar" element={<NovoFornecedor />} />
        <Route path="descarregamento/grade" element={<GradeDescarregamento />} />
        <Route path="descarregamento/docas" element={<Docas />} />
        <Route path="descarregamento/motoristas-patio" element={<MotoristasPatio />} />
        <Route path="descarregamento-config" element={<DescarregamentoConfig />} />
        <Route path="descarregamento/formulario-publico" element={<PublicForm />} />
        <Route path="descarregamento/formulario-publico/:id" element={<PublicForm />} />
        <Route path="users" element={<Users />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="system-config" element={<SystemConfig />} />
        <Route path="system-settings" element={<SystemSettings />} />
        <Route path="categories" element={<Categories />} />
        <Route path="status" element={<Status />} />
        <Route path="cadastros-config" element={<CadastrosConfig />} />
        <Route path="category-assignments" element={<CategoryAssignments />} />
        <Route path="reports" element={<Reports />} />
        <Route path="admin-dashboard" element={<AdminDashboard />} />
        <Route path="performance" element={<Performance />} />
      </Route>
    </Routes>
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
