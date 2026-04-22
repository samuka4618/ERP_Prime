import React, { useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import {
  getPublicFormOnly,
  getPublicFormReturnUrl,
  isPublicPath,
  setPublicFormOnly
} from '../utils/publicFormOnly';

/**
 * Guard: se o usuário está em "modo só formulário" e tentou acessar
 * uma rota não permitida (ex.: /login), redireciona de volta.
 */
export const PublicFormOnlyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  if (!getPublicFormOnly()) {
    return <>{children}</>;
  }

  if (isPublicPath(location.pathname)) {
    return <>{children}</>;
  }

  const returnUrl = getPublicFormReturnUrl();
  const redirectTo = returnUrl || '/descarregamento/restrito';
  return <Navigate to={redirectTo} replace />;
};

/**
 * Marca a sessão como "só formulário" e guarda a URL para redirecionar
 * quem tentar acessar login/outras rotas.
 */
export const PublicFormOnlyWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    setPublicFormOnly(window.location.pathname);
  }, []);
  return <>{children}</>;
};