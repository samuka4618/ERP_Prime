'use client';

import React from 'react';
import toast, { Toaster, ToastBar } from 'react-hot-toast';
import { AuthProvider } from '@/legacy/contexts/AuthContext';
import { PermissionsProvider } from '@/legacy/contexts/PermissionsContext';
import { UiPreferencesProvider } from '@/legacy/contexts/UiPreferencesContext';
import { ThemeProvider } from '@/legacy/contexts/ThemeContext';
import { SystemConfigProvider } from '@/legacy/contexts/SystemConfigContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <UiPreferencesProvider>
            <SystemConfigProvider>
            <div className="min-h-screen bg-surface-app text-content-primary transition-colors duration-200">
              {children}
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
            </SystemConfigProvider>
          </UiPreferencesProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
