'use client';

import React from 'react';
import { Outlet } from 'react-router-dom';
import { PublicFormOnlyGuard } from '../components/PublicFormOnlyGuard';

/** Layout raiz: guard de modo “só formulário” + rotas filhas. */
export function PublicFormRoot() {
  return (
    <PublicFormOnlyGuard>
      <Outlet />
    </PublicFormOnlyGuard>
  );
}
