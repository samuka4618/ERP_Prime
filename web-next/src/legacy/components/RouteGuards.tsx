import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../contexts/PermissionsContext';
import LoadingSpinner from './LoadingSpinner';

export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  /** Quando true, não redirecciona para `/forcar-troca-senha` (usar nessa própria página). */
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

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/** Rota que exige permissão IAM; caso contrário redireciona para o dashboard. */
export const PermissionRoute: React.FC<{ permission: string; children: React.ReactNode }> = ({
  permission,
  children,
}) => {
  const { loadingPermissions, hasPermission } = usePermissions();
  if (loadingPermissions) return <LoadingSpinner />;
  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export const PermissionAnyRoute: React.FC<{ permissions: string[]; children: React.ReactNode }> = ({
  permissions,
  children,
}) => {
  const { loadingPermissions, hasAnyPermission } = usePermissions();
  if (loadingPermissions) return <LoadingSpinner />;
  if (!hasAnyPermission(...permissions)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};
