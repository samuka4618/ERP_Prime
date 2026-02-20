import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSystemConfig } from '../contexts/SystemConfigContext';
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { login } = useAuth();
  const { config } = useSystemConfig();

  const systemName = config?.system_name || 'ERP PRIME';
  const systemSubtitle = config?.system_subtitle || 'Sistema de Gestão Empresarial';
  const logoPath = config?.system_logo?.trim();
  const logoUrl = logoPath
    ? (logoPath.startsWith('http') ? logoPath : `/${logoPath.replace(/^\/+/, '')}`)
    : null;
  const logoInitials = systemName.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'PR';
  const showLogoImg = logoUrl && !logoError;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(formData);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-900">
      {/* Painel esquerdo: branding (desktop) / header compacto (mobile) */}
      <div className="lg:flex-1 lg:min-h-screen flex flex-col justify-center px-6 py-12 lg:py-16 lg:px-12 xl:px-20 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 dark:from-primary-800 dark:via-primary-900 dark:to-gray-900 relative overflow-hidden">
        {/* Padrão sutil de fundo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>
        <div className="relative z-10 text-center lg:text-left">
          <div className="inline-flex lg:inline-flex items-center justify-center">
            <div className="w-20 h-20 lg:w-24 lg:h-24 bg-white/95 dark:bg-gray-800 rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden border border-white/20">
              {showLogoImg ? (
                <img src={logoUrl!} alt={systemName} className="w-full h-full object-contain p-2" onError={() => setLogoError(true)} />
              ) : (
                <span className="text-primary-600 dark:text-primary-400 font-bold text-2xl lg:text-3xl">{logoInitials}</span>
              )}
            </div>
          </div>
          <h1 className="mt-6 lg:mt-8 text-2xl lg:text-3xl xl:text-4xl font-bold text-white tracking-tight">
            {systemName}
          </h1>
          <p className="mt-2 text-primary-100 dark:text-primary-200 text-sm lg:text-base max-w-sm mx-auto lg:mx-0">
            {systemSubtitle}
          </p>
          <p className="mt-6 text-primary-200/90 dark:text-primary-300/80 text-sm hidden lg:block max-w-xs">
            Acesse sua conta para gerenciar chamados, cadastros e relatórios em um só lugar.
          </p>
        </div>
      </div>

      {/* Painel direito: formulário */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 lg:py-16 lg:px-12 xl:px-24">
        <div className="w-full max-w-sm mx-auto lg:max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Faça login para continuar
            </p>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white lg:text-2xl">
            Entrar na sua conta
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Use seu e-mail e senha para acessar o sistema
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input w-full pl-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 dark:text-gray-500">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  Lembrar de mim
                </span>
              </label>
              <a href="#" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 transition-colors">
                Esqueceu a senha?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} {systemName}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
