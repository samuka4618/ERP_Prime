import { Routes, Route } from 'react-router-dom';
import PublicFormPage from './pages/PublicFormPage';
import DriverTrackingPage from './pages/DriverTrackingPage';

export default function App() {
  return (
    <Routes>
      <Route path="/d/:publicSlug" element={<PublicFormPage />} />
      <Route path="/t/:trackingToken" element={<DriverTrackingPage />} />
      <Route
        path="/"
        element={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-600 p-6 text-center">
            Use o link enviado (formulário de chegada ou acompanhamento).
          </div>
        }
      />
      <Route path="*" element={<div className="p-8 text-center text-gray-600">Página não encontrada.</div>} />
    </Routes>
  );
}
