import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import './login.css';

// Configuración de roles - debe coincidir con App.js
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
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [loginStep, setLoginStep] = useState('credentials');
  const [userInfo, setUserInfo] = useState(null);
  
  // ✅ CORRECCIÓN: Obtener usuarios del ApiContext
  const { usuarios, isConnected, loading } = useApi();

  // Verificar conexión al cargar el componente
  useEffect(() => {
    if (typeof isConnected !== 'undefined') {
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      if (isConnected) {
        console.log('✅ Conexión al servidor establecida (Puerto 3004)');
      } else if (!loading) {
        console.error('❌ Error de conexión al servidor (Puerto 3004)');
      }
    } else {
      setConnectionStatus('checking');
    }
  }, [isConnected, loading]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
  };

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

  const prepareLoginData = (usuario, password) => {
    const detectedMode = detectLoginMode(usuario);
    const trimmedUsuario = usuario.trim();
    
    if (detectedMode === 'id' || detectedMode === 'username') {
      return {
        ID: trimmedUsuario,
        password: password
      };
    } else {
      const partesNombre = trimmedUsuario.split(' ');
      const nombre = partesNombre[0] || '';
      const apellido = partesNombre.slice(1).join(' ') || '';
      
      return {
        nombre: nombre,
        apellido: apellido,
        password: password
      };
    }
  };

  const validateInput = (usuario) => {
    const detectedMode = detectLoginMode(usuario);
    const trimmedUsuario = usuario.trim();
    
    if (detectedMode === 'id') {
      if (!/^\d+$/.test(trimmedUsuario)) {
        return 'El ID numérico debe contener solo números';
      }
    } else if (detectedMode === 'username') {
      if (trimmedUsuario.length < 1) {
        return 'El nombre de usuario no puede estar vacío';
      }
      if (trimmedUsuario.includes(' ')) {
        return 'El nombre de usuario no debe contener espacios';
      }
    } else {
      if (!trimmedUsuario.includes(' ')) {
        return 'Por favor ingrese su nombre completo (nombre y apellido), su ID numérico, o su nombre de usuario';
      }
    }
    
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (connectionStatus !== 'connected') {
      setError('No hay conexión con el servidor. Verifique que el backend esté corriendo en puerto 3004.');
      return;
    }
    
    if (!formData.usuario.trim() || !formData.password.trim()) {
      setError('Usuario y contraseña son requeridos');
      return;
    }

    const validationError = validateInput(formData.usuario);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLogging(true);
    setError('');

    try {
      console.log('🔐 Intentando login...');
      
      const loginData = prepareLoginData(formData.usuario, formData.password);
      const detectedMode = detectLoginMode(formData.usuario);
      
      console.log(`📤 Enviando datos de login (modo: ${detectedMode}):`, { 
        ...loginData, 
        password: '***' 
      });
      
      // ✅ CORRECCIÓN: Usar usuarios.login del ApiContext
      if (!usuarios || !usuarios.login) {
        throw new Error('ApiContext no está configurado correctamente');
      }
      
      console.log('📡 Usando ApiContext para login (Puerto 3004)');
      
      // usuarios.login ahora retorna { data, error }
      const result = await usuarios.login(loginData);

      // Manejar respuesta exitosa
      if (result.data && result.data.usuario) {
        const usuarioData = result.data.usuario;
        const roleConfig = ROLE_CONFIG[usuarioData.rol];
        
        console.log('✅ Login exitoso:', usuarioData);
        console.log('🎭 Rol detectado:', usuarioData.rol, '-', roleConfig?.name || 'Desconocido');
        
        if (!roleConfig) {
          throw new Error(`Rol no válido: ${usuarioData.rol}. Contacte al administrador.`);
        }
        
        // Los tokens ya se guardaron en el ApiContext, pero los volvemos a guardar por seguridad
        localStorage.setItem('smartbee_token', result.data.token);
        localStorage.setItem('smartbee_user', JSON.stringify(usuarioData));
        
        // Mostrar información del rol antes de redirigir
        setUserInfo({ usuario: usuarioData, roleConfig });
        setLoginStep('role-info');
        
        // Auto-redirigir después de 3 segundos
        setTimeout(() => {
          finalizeLogin(usuarioData, roleConfig);
        }, 3000);
        
      } else {
        throw new Error(result.error || 'Error al iniciar sesión');
      }
      
    } catch (error) {
      console.error('💥 Error en login:', error);
      
      let errorMessage = 'Error al iniciar sesión';
      const errorMsg = error.message;
      
      if (errorMsg.includes('Credenciales incorrectas')) {
        errorMessage = 'Credenciales incorrectas. Verifique su usuario y contraseña.';
      } else if (errorMsg.includes('Usuario no encontrado')) {
        errorMessage = 'Usuario no encontrado. Verifique que su usuario esté registrado.';
      } else if (errorMsg.includes('No se puede conectar') || errorMsg.includes('Network Error')) {
        errorMessage = 'Error de conexión. Verifique que el servidor esté corriendo en puerto 3004.';
      } else if (errorMsg.includes('Rol no válido')) {
        errorMessage = errorMsg;
      } else if (errorMsg) {
        errorMessage = errorMsg;
      }
      
      setError(errorMessage);
      setLoginStep('credentials');
    } finally {
      setIsLogging(false);
    }
  };

  const finalizeLogin = (usuario, roleConfig) => {
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
    console.log('Solicitud de restablecimiento de contraseña.');
    alert('Contacte al administrador para restablecer su contraseña');
  };

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', text: '#166534' };
      case 'disconnected': return { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', text: '#b91c1c' };
      case 'checking': return { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#92400e' };
      default: return { bg: '#f9fafb', border: '#e5e7eb', dot: '#6b7280', text: '#374151' };
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Conectado al servidor (Puerto 3004)';
      case 'disconnected': return 'Sin conexión al servidor (Verifique puerto 3004)';
      case 'checking': return 'Verificando conexión...';
      default: return 'Estado desconocido';
    }
  };

  const colors = getConnectionColor();

  // Renderizar paso de información de rol
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  ¡Bienvenido, {usuario.nombre} {usuario.apellido}!
                </h2>
                <p className="text-gray-600">Login exitoso como <strong>{roleConfig.name}</strong></p>
                {usuario.comuna && (
                  <p className="text-sm text-gray-500">Ubicación: {usuario.comuna}</p>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">Tu perfil de acceso:</h3>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium mr-2">Usuario:</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                      {usuario.nombre} {usuario.apellido}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium mr-2">Rol:</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {roleConfig.name}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium mr-2">Descripción:</span>
                    <span>{roleConfig.description}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="font-medium mr-2">ID:</span>
                    <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">{usuario.id}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-blue-900 mb-3">Funcionalidades disponibles:</h4>
                <ul className="space-y-2">
                  {roleConfig.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-blue-800">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={handleContinue}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
              >
                Continuar al Sistema
              </button>

              <div className="text-center mt-4">
                <p className="text-xs text-gray-500">
                  Redirigiendo automáticamente en unos segundos...
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar paso de redirección
  if (loginStep === 'redirecting') {
    return (
      <div className="login-container">
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando tu workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  // Renderizar formulario de login por defecto
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-logo">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1 className="login-title">SmartBee</h1>
            <p className="login-subtitle">Sistema de Gestión de Colmenas</p>
          </div>
          
          <div className="login-decoration-1"></div>
          <div className="login-decoration-2"></div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-container">
            <div className="login-header">
              <h2 className="login-welcome-title">Bienvenido</h2>
              <p className="login-welcome-subtitle">Ingresa tu usuario y contraseña</p>
            </div>

            {/* Estado de conexión */}
            <div style={{ 
              marginBottom: '1rem',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: colors.dot
              }} />
              <span style={{ 
                fontSize: '0.875rem',
                color: colors.text,
                fontWeight: '500'
              }}>
                {getConnectionText()}
              </span>
            </div>

            {error && (
              <div className="login-error">
                <div className="login-error-content">
                  <svg className="login-error-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="login-error-text">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-form-group">
                <label htmlFor="usuario" className="login-form-label">
                  Usuario
                </label>
                <input
                  type="text"
                  id="usuario"
                  name="usuario"
                  value={formData.usuario}
                  onChange={handleInputChange}
                  className="login-form-input"
                  placeholder="Ingresa tu usuario"
                  disabled={isLogging || connectionStatus !== 'connected'}
                  autoComplete="username"
                />
              </div>

              <div className="login-form-group">
                <label htmlFor="password" className="login-form-label">
                  Contraseña
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="login-form-input"
                  placeholder="Ingresa tu contraseña"
                  disabled={isLogging || connectionStatus !== 'connected'}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={isLogging || connectionStatus !== 'connected'}
                className="login-submit-button"
              >
                {isLogging ? (
                  <>
                    <div className="login-spinner"></div>
                    Verificando credenciales...
                  </>
                ) : (
                  'Ingresar'
                )}
              </button>
            </form>

            <div className="login-forgot-password">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="login-forgot-link"
                disabled={isLogging}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;