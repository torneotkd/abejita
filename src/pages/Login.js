import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import './login.css';

// 🔵 PRODUCCIÓN: Esta configuración debe ser idéntica a la de App.js.
const ROLE_CONFIG = {
  ADM: {
    name: 'Administrador',
    defaultRoute: '/dashboard',
    description: 'Gestión completa del sistema',
    features: ['Gestión de usuarios', 'Todas las colmenas', 'Reportes globales', 'Configuración del sistema']
  },
  API: {
    name: 'Apicultor',
    defaultRoute: '/user-dashboard',
    description: 'Gestión de colmenas propias',
    features: ['Mis colmenas', 'Dashboard personal', 'Reportes de mis colmenas', 'Gestión de perfil']
  }
};

const Login = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    usuario: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [loginStep, setLoginStep] = useState('credentials'); // 'credentials', 'role-info', 'redirecting'
  const [userInfo, setUserInfo] = useState(null);

  // 🔵 PRODUCCIÓN: Obtenemos el estado de conexión directamente del context.
  const { usuarios, isConnected } = useApi();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

  // Lógica para determinar el tipo de credencial ingresada (nombre, id, username)
  const detectLoginMode = (usuario) => {
    const trimmedUsuario = usuario.trim();
    if (/^\d+$/.test(trimmedUsuario)) {
      return 'id';
    }
    if (trimmedUsuario.includes(' ')) {
      return 'name';
    }
    return 'username';
  };

  // Prepara el objeto de datos para enviar al backend
  const prepareLoginData = (usuario, password) => {
    const detectedMode = detectLoginMode(usuario);
    const trimmedUsuario = usuario.trim();

    if (detectedMode === 'id' || detectedMode === 'username') {
      return { ID: trimmedUsuario, password };
    } else {
      const partesNombre = trimmedUsuario.split(' ');
      const nombre = partesNombre[0] || '';
      const apellido = partesNombre.slice(1).join(' ') || '';
      return { nombre, apellido, password };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isConnected) {
      setError('No hay conexión con el servidor. Por favor, verifique su conexión a internet.');
      return;
    }

    if (!formData.usuario.trim() || !formData.password.trim()) {
      setError('El usuario y la contraseña son obligatorios.');
      return;
    }

    setIsLogging(true);
    setError('');

    try {
      const loginData = prepareLoginData(formData.usuario, formData.password);

      // 🔵 PRODUCCIÓN: Se utiliza únicamente el método del ApiContext.
      const result = await usuarios.login(loginData);

      if (result.data && result.data.usuario) {
        const usuarioData = result.data.usuario;
        const roleConfig = ROLE_CONFIG[usuarioData.rol];

        if (!roleConfig) {
          throw new Error(`Rol no válido: "${usuarioData.rol}". Contacte al administrador.`);
        }

        // Mostrar pantalla intermedia con la información del rol
        setUserInfo({ usuario: usuarioData, roleConfig });
        setLoginStep('role-info');
        
        // Redirigir automáticamente después de unos segundos
        setTimeout(() => {
          finalizeLogin(usuarioData, roleConfig);
        }, 4000);

      } else {
        throw new Error(result.error || 'Respuesta inválida del servidor.');
      }

    } catch (err) {
      console.error('💥 Error en el proceso de login:', err);
      // 🔵 PRODUCCIÓN: Mensajes de error más amigables para el usuario.
      let errorMessage = 'Error al iniciar sesión. Intente nuevamente.';
      if (err.message.includes('Credenciales incorrectas')) {
        errorMessage = 'Credenciales incorrectas. Verifique su usuario y contraseña.';
      } else if (err.message.includes('Rol no válido')) {
        errorMessage = err.message;
      } else if (!isConnected) {
        errorMessage = 'Error de conexión. Verifique su conexión a internet.';
      }
      
      setError(errorMessage);
      setLoginStep('credentials');
    } finally {
      setIsLogging(false);
    }
  };

  const finalizeLogin = (usuario, roleConfig) => {
    // Evitar doble ejecución si el usuario hace clic y el timeout se activa
    if (loginStep === 'redirecting') return;

    setLoginStep('redirecting');
    
    onLoginSuccess(usuario);
    
    setTimeout(() => {
      navigate(roleConfig.defaultRoute);
    }, 100);
  };
  
  const handleContinue = () => {
    if (userInfo) {
      finalizeLogin(userInfo.usuario, userInfo.roleConfig);
    }
  };

  const handleForgotPassword = () => {
    alert('Para restablecer su contraseña, por favor contacte al administrador del sistema.');
  };
  
  // --- Lógica para el indicador de estado de conexión ---
  const getConnectionStatus = () => {
      if (!('isConnected' in window)) { // Check if the property exists
          return { status: 'checking', text: 'Verificando...', colors: { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#92400e' } };
      }
      if (isConnected) {
          return { status: 'connected', text: 'Conectado al servidor', colors: { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', text: '#166534' } };
      }
      return { status: 'disconnected', text: 'Sin conexión al servidor', colors: { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', text: '#b91c1c' } };
  };
  const { text: connectionText, colors: connectionColors, status: connectionStatus } = getConnectionStatus();


  // --- Renderizado de los diferentes pasos del login ---

  if (loginStep === 'role-info' && userInfo) {
    const { usuario, roleConfig } = userInfo;
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-form-panel" style={{ width: '100%' }}>
            <div className="login-form-container">
              <div className="text-center mb-6">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Bienvenido, {usuario.nombre}!</h2>
                <p className="text-gray-600">Has iniciado sesión como <strong>{roleConfig.name}</strong></p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Resumen de tu Perfil:</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                    {roleConfig.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mr-3 flex-shrink-0"></div>
                        {feature}
                      </li>
                    ))}
                </ul>
              </div>
              <button onClick={handleContinue} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200">
                Continuar al Sistema
              </button>
              <p className="text-center mt-4 text-xs text-gray-500">
                Serás redirigido automáticamente...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loginStep === 'redirecting') {
    return (
      <div className="login-container">
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando tu espacio de trabajo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-logo">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 20.25c4.97 0 9-4.28 9-9.5S17.97 1.25 12 1.25 3 5.53 3 10.75s4.03 9.5 9 9.5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10.75a2 2 0 100-4 2 2 0 000 4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14.75a4 4 0 100-8 4 4 0 000 8z" /></svg>
            </div>
            <h1 className="login-title">SmartBee</h1>
            <p className="login-subtitle">Sistema de Monitoreo Apícola</p>
          </div>
          <div className="login-decoration-1"></div>
          <div className="login-decoration-2"></div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-container">
            <div className="login-header">
              <h2 className="login-welcome-title">Bienvenido de Vuelta</h2>
              <p className="login-welcome-subtitle">Ingresa tus credenciales para continuar</p>
            </div>

            {/* Indicador de Conexión */}
            <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: connectionColors.bg, border: `1px solid ${connectionColors.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: connectionColors.dot, transition: 'background-color 0.3s' }} />
              <span style={{ fontSize: '0.875rem', color: connectionColors.text, fontWeight: '500' }}>
                {connectionText}
              </span>
            </div>

            {error && (
              <div className="login-error">
                <p className="login-error-text">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form-group">
                <label htmlFor="usuario" className="login-form-label">Usuario</label>
                <input
                  type="text"
                  id="usuario"
                  name="usuario"
                  value={formData.usuario}
                  onChange={handleInputChange}
                  className="login-form-input"
                  placeholder="ID, nombre de usuario o nombre completo"
                  disabled={isLogging || !isConnected}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="login-form-group">
                <label htmlFor="password" className="login-form-label">Contraseña</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="login-form-input"
                  placeholder="••••••••"
                  disabled={isLogging || !isConnected}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button type="submit" disabled={isLogging || !isConnected} className="login-submit-button">
                {isLogging ? (
                  <>
                    <div className="login-spinner"></div>
                    <span>Ingresando...</span>
                  </>
                ) : (
                  'Ingresar al Sistema'
                )}
              </button>
            </form>

            <div className="login-forgot-password">
              <button type="button" onClick={handleForgotPassword} className="login-forgot-link" disabled={isLogging}>
                ¿Problemas para ingresar?
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
