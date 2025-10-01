import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const ApiContext = createContext();

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context;
};

// ✅ CONFIGURACIÓN ACTUALIZADA PARA PRODUCCIÓN EN PUERTO 3004
const getBaseURL = () => {
  // Si hay una variable de entorno definida, úsala
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // ✅ NUEVO: En producción, usar rutas relativas
  // Esto funciona porque el backend sirve el frontend en el mismo puerto
  return '/api';
};

// Configuración de axios para conectar al backend
const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    
    // Agregar token si existe
    const token = localStorage.getItem('smartbee_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Interceptor para responses
api.interceptors.response.use(
  (response) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ Response Error:', error.response?.status, error.message);
    console.error('❌ URL que falló:', error.config?.url);
    
    // Si es error 401, limpiar localStorage y redirigir
    if (error.response?.status === 401) {
      console.log('🔐 Token expirado o inválido, limpiando sesión...');
      localStorage.removeItem('smartbee_token');
      localStorage.removeItem('smartbee_user');
      // Solo recargar si no estamos ya en login
      if (!window.location.pathname.includes('login')) {
        window.location.reload();
      }
    }
    
    return Promise.reject(error);
  }
);

export const ApiProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mostrar la URL que se está usando
  useEffect(() => {
    const baseURL = getBaseURL();
    console.log('🌐 Base URL configurada:', baseURL);
    console.log('🔗 Modo:', baseURL.startsWith('http') ? 'Desarrollo (URL absoluta)' : 'Producción (rutas relativas)');
  }, []);

  // Probar conexión al cargar
  useEffect(() => {
    testConnection();
    
    // Verificar conexión cada 30 segundos
    const interval = setInterval(() => {
      testConnectionSilent();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const testConnection = async () => {
    setLoading(true);
    try {
      const response = await api.get('/health');
      setIsConnected(true);
      setError(null);
      console.log('🟢 Conexión establecida con servidor (puerto 3004):', response.data.message);
      return response.data;
    } catch (err) {
      setIsConnected(false);
      let errorMessage = 'Error de conexión con el servidor';
      
      if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
        errorMessage = 'Servidor no disponible. Verifique que esté corriendo en puerto 3004';
      } else {
        errorMessage = err.response?.data?.message || err.message || errorMessage;
      }
      
      setError(errorMessage);
      console.error('🔴 Error de conexión:', errorMessage);
      console.error('🔴 URL que falló:', err.config?.url);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const testConnectionSilent = async () => {
    try {
      await api.get('/health');
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setIsConnected(false);
      if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
        setError('Servidor no disponible');
      } else {
        setError('Conexión perdida');
      }
    }
  };

  const apiRequest = async (method, endpoint, data = null, showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      let response;
      
      switch (method.toLowerCase()) {
        case 'get':
          response = await api.get(endpoint);
          break;
        case 'post':
          response = await api.post(endpoint, data);
          break;
        case 'put':
          response = await api.put(endpoint, data);
          break;
        case 'delete':
          response = await api.delete(endpoint);
          break;
        default:
          throw new Error(`Método HTTP no válido: ${method}`);
      }
      
      setIsConnected(true);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Error en la petición';
      
      if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
        setIsConnected(false);
        setError('No se puede conectar al servidor backend');
      } else {
        setError(errorMessage);
      }
      
      console.error(`❌ Error en ${method.toUpperCase()} ${endpoint}:`, errorMessage);
      throw err;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // =============================================
  // MÉTODOS PARA USUARIOS (INCLUYE LOGIN)
  // =============================================
  const usuarios = {
    getAll: () => apiRequest('get', '/usuarios'),
    getById: (id) => apiRequest('get', `/usuarios/${id}`),
    create: (data) => apiRequest('post', '/usuarios', data),
    update: (id, data) => apiRequest('put', `/usuarios/${id}`, data),
    delete: (id) => apiRequest('delete', `/usuarios/${id}`),
    
    // ✅ LOGIN - Retorna objeto compatible con Login.js
    login: async (credentials) => {
      try {
        console.log('🔐 Intentando login en puerto 3004:', { 
          ID: credentials.ID ? 'presente' : 'ausente',
          nombre: credentials.nombre ? 'presente' : 'ausente', 
          apellido: credentials.apellido ? 'presente' : 'ausente',
          password: credentials.password ? 'presente' : 'ausente'
        });
        
        const response = await api.post('/usuarios/login', credentials);
        
        if (response.data && response.data.data) {
          // Guardar token y datos del usuario
          localStorage.setItem('smartbee_token', response.data.data.token);
          localStorage.setItem('smartbee_user', JSON.stringify(response.data.data.usuario));
          
          console.log('✅ Login exitoso (puerto 3004):', response.data.data.usuario);
          setIsConnected(true);
          setError(null);
          
          // ✅ IMPORTANTE: Retornar en el formato que espera Login.js
          return {
            data: response.data.data,
            error: null
          };
        }
        
        throw new Error('Respuesta de login inválida');
      } catch (error) {
        console.error('❌ Error en login:', error);
        
        // Manejo específico de errores de login
        let errorMessage = 'Error al iniciar sesión';
        
        if (error.response?.status === 401) {
          errorMessage = 'Credenciales incorrectas';
        } else if (error.response?.status === 400) {
          errorMessage = error.response.data?.error || 'Datos de login incorrectos';
        } else if (error.response?.status === 404) {
          errorMessage = 'Usuario no encontrado';
        } else if (error.code === 'ERR_NETWORK') {
          setIsConnected(false);
          errorMessage = 'No se puede conectar al servidor. Verifique que esté corriendo en puerto 3004';
        }
        
        // ✅ IMPORTANTE: Lanzar error para que Login.js lo capture
        throw new Error(errorMessage);
      }
    },
    
    logout: () => {
      localStorage.removeItem('smartbee_token');
      localStorage.removeItem('smartbee_user');
      console.log('👋 Sesión cerrada');
    },
    
    isAuthenticated: () => {
      const token = localStorage.getItem('smartbee_token');
      const user = localStorage.getItem('smartbee_user');
      return !!(token && user);
    },
    
    getCurrentUser: () => {
      try {
        const userData = localStorage.getItem('smartbee_user');
        return userData ? JSON.parse(userData) : null;
      } catch (error) {
        console.error('Error obteniendo usuario actual:', error);
        return null;
      }
    }
  };

  // =============================================
  // MÉTODOS PARA ROLES
  // =============================================
  const roles = {
    getAll: () => apiRequest('get', '/roles'),
    getById: (id) => apiRequest('get', `/roles/${id}`),
    create: (data) => apiRequest('post', '/roles', data),
    update: (id, data) => apiRequest('put', `/roles/${id}`, data),
    delete: (id) => apiRequest('delete', `/roles/${id}`),
  };

  // =============================================
  // MÉTODOS PARA COLMENAS
  // =============================================
  const colmenas = {
    getAll: () => apiRequest('get', '/colmenas'),
    getById: (id) => apiRequest('get', `/colmenas/${id}`),
    create: (data) => apiRequest('post', '/colmenas', data),
    update: (id, data) => apiRequest('put', `/colmenas/${id}`, data),
    delete: (id) => apiRequest('delete', `/colmenas/${id}`),
    getByDueno: (duenoId) => apiRequest('get', `/colmenas/dueno/${duenoId}`),
    getUbicaciones: (id) => apiRequest('get', `/colmenas/${id}/ubicaciones`),
    addUbicacion: (id, data) => apiRequest('post', `/colmenas/${id}/ubicaciones`, data),
    getNodos: (id) => apiRequest('get', `/colmenas/${id}/nodos`),
    addNodo: (id, data) => apiRequest('post', `/colmenas/${id}/nodos`, data),
    removeNodo: (colmenaId, nodoId) => apiRequest('delete', `/colmenas/${colmenaId}/nodos/${nodoId}`),
  };

  // =============================================
  // MÉTODOS PARA NODOS
  // =============================================
  const nodos = {
    getAll: () => apiRequest('get', '/nodos'),
    getById: (id) => apiRequest('get', `/nodos/${id}`),
    create: (data) => apiRequest('post', '/nodos', data),
    update: (id, data) => apiRequest('put', `/nodos/${id}`, data),
    delete: (id) => apiRequest('delete', `/nodos/${id}`),
    getByTipo: (tipo) => apiRequest('get', `/nodos/tipo/${tipo}`),
    getUbicaciones: (id) => apiRequest('get', `/nodos/${id}/ubicaciones`),
    addUbicacion: (id, data) => apiRequest('post', `/nodos/${id}/ubicaciones`, data),
    getMensajes: (id, limit = 100) => apiRequest('get', `/nodos/${id}/mensajes?limit=${limit}`),
    getInterioresDisponibles: () => apiRequest('get', '/nodos/interiores/disponibles'),
    getExterioresDisponibles: () => apiRequest('get', '/nodos/exteriores/disponibles'),
  };

  // =============================================
  // MÉTODOS PARA TIPOS DE NODOS
  // =============================================
  const nodoTipos = {
    getAll: () => apiRequest('get', '/nodo-tipos'),
    getById: (id) => apiRequest('get', `/nodo-tipos/${id}`),
    create: (data) => apiRequest('post', '/nodo-tipos', data),
    update: (id, data) => apiRequest('put', `/nodo-tipos/${id}`, data),
    delete: (id) => apiRequest('delete', `/nodo-tipos/${id}`),
  };

  // =============================================
  // MÉTODOS PARA MENSAJES
  // =============================================
  const mensajes = {
    getAll: (limit = 100) => apiRequest('get', `/mensajes?limit=${limit}`),
    getById: (id) => apiRequest('get', `/mensajes/${id}`),
    create: (data) => apiRequest('post', '/mensajes', data),
    getByNodo: (nodoId, limit = 100) => apiRequest('get', `/mensajes/nodo/${nodoId}?limit=${limit}`),
    getByTopico: (topico, limit = 100) => apiRequest('get', `/mensajes/topico/${topico}?limit=${limit}`),
    delete: (id) => apiRequest('delete', `/mensajes/${id}`),
    
    getRecientes: async (hours = 24) => {
      try {
        const response = await apiRequest('get', `/mensajes/recientes?hours=${hours}`);
        return response;
      } catch (error) {
        console.error('❌ Error obteniendo mensajes recientes:', error);
        try {
          console.log('🔄 Intentando endpoint de fallback...');
          const fallbackResponse = await apiRequest('get', `/mensajes/simple`);
          return fallbackResponse;
        } catch (fallbackError) {
          console.error('❌ También falló el endpoint de fallback:', fallbackError);
          throw error;
        }
      }
    },
    
    testStatus: () => apiRequest('get', '/mensajes/status', null, false),
    testSimple: () => apiRequest('get', '/mensajes/simple', null, false),
    createTestMessage: () => apiRequest('post', '/mensajes/test-message'),
    getNodosEspecificos: () => apiRequest('get', '/mensajes/nodos-especificos', null, false),
  };

  // =============================================
  // MÉTODOS PARA DASHBOARD
  // =============================================
  const dashboard = {
    getStats: () => apiRequest('get', '/dashboard/stats'),
    getRecent: () => apiRequest('get', '/dashboard/recent'),
    getAlertas: () => apiRequest('get', '/dashboard/alertas'),
    getGraficos: () => apiRequest('get', '/dashboard/graficos'),
    getMonitoreo: () => apiRequest('get', '/dashboard/monitoreo'),
    
    getSensorData: async (hours = 168, userId = null) => {
      if (!userId) {
        try {
          const userData = localStorage.getItem('smartbee_user');
          if (userData) {
            const user = JSON.parse(userData);
            userId = user.id;
          }
        } catch (error) {
          console.error('Error obteniendo userId del localStorage:', error);
        }
      }
      
      if (!userId) {
        throw new Error('Se requiere userId para obtener datos de sensores');
      }
      
      try {
        return await apiRequest('get', `/dashboard/sensor-data?hours=${hours}&userId=${userId}`);
      } catch (error) {
        console.error('❌ Error obteniendo datos de sensores:', error);
        return {
          internos: [],
          externos: [],
          combinados: [],
          nodos: { interior: [], exterior: [] },
          message: 'Error obteniendo datos de sensores',
          error: true
        };
      }
    }
  };

  // =============================================
  // MÉTODOS PARA ESTACIONES
  // =============================================
  const estaciones = {
    getAll: () => apiRequest('get', '/estaciones'),
    getById: (id) => apiRequest('get', `/estaciones/${id}`),
    create: (data) => apiRequest('post', '/estaciones', data),
    update: (id, data) => apiRequest('put', `/estaciones/${id}`, data),
    delete: (id) => apiRequest('delete', `/estaciones/${id}`),
  };

  // =============================================
  // MÉTODOS PARA REPORTES
  // =============================================
  const reportes = {
    temperaturas: (colmenaId, fechaInicio, fechaFin) => 
      apiRequest('get', `/reportes/temperaturas/${colmenaId}?inicio=${fechaInicio}&fin=${fechaFin}`),
    humedad: (colmenaId, fechaInicio, fechaFin) => 
      apiRequest('get', `/reportes/humedad/${colmenaId}?inicio=${fechaInicio}&fin=${fechaFin}`),
    actividad: (colmenaId, fechaInicio, fechaFin) => 
      apiRequest('get', `/reportes/actividad/${colmenaId}?inicio=${fechaInicio}&fin=${fechaFin}`),
    resumen: (colmenaId) => apiRequest('get', `/reportes/resumen/${colmenaId}`),
  };

  // =============================================
  // MÉTODOS PARA ALERTAS
  // =============================================
  const alertas = {
    getAll: () => apiRequest('get', '/alertas'),
    evaluar: (colmenaId, hours = 168) => apiRequest('get', `/alertas/evaluar/${colmenaId}?hours=${hours}`),
    getSugerencias: (alertaId) => apiRequest('get', `/alertas/sugerencias/${alertaId}`),
    registrar: (data) => apiRequest('post', '/alertas/registrar', data),
    getHistorial: (colmenaId, limit = 50, hours = 720) => apiRequest('get', `/alertas/historial/${colmenaId}?limit=${limit}&hours=${hours}`),
    getByUsuario: (usuarioId, hours = 24) => apiRequest('get', `/alertas/usuario/${usuarioId}?hours=${hours}`),
    
    evaluarParaUsuario: async (usuarioId, hours = 168) => {
      try {
        if (!usuarioId) {
          const userData = localStorage.getItem('smartbee_user');
          if (!userData) {
            throw new Error('Usuario no autenticado');
          }
          const user = JSON.parse(userData);
          usuarioId = user.id;
        }
        
        return await apiRequest('get', `/alertas/evaluarUsuario/${usuarioId}?hours=${hours}`);
      } catch (error) {
        console.error('Error evaluando alertas para usuario:', error);
        throw error;
      }
    },
    
    getEstadisticas: (colmenaId, days = 30) => apiRequest('get', `/alertas/estadisticas/${colmenaId}?days=${days}`),
    limpiarAlertas: (colmenaId, days = 90) => apiRequest('delete', `/alertas/limpiar/${colmenaId}?days=${days}`),
    testPdonald: () => apiRequest('get', '/alertas/test/pdonald'),
    
    evaluarParaUsuarioActual: async (hours = 168) => {
      try {
        const userData = localStorage.getItem('smartbee_user');
        if (!userData) {
          throw new Error('Usuario no autenticado');
        }
        
        const user = JSON.parse(userData);
        return await apiRequest('get', `/alertas/evaluarUsuario/${user.id}?hours=${hours}`);
      } catch (error) {
        console.error('Error evaluando alertas para usuario actual:', error);
        throw error;
      }
    },
    
    getAlertasRecientes: async (hours = 24) => {
      try {
        const userData = localStorage.getItem('smartbee_user');
        if (!userData) {
          throw new Error('Usuario no autenticado');
        }
        
        const user = JSON.parse(userData);
        return await apiRequest('get', `/alertas/usuario/${user.id}?hours=${hours}`);
      } catch (error) {
        console.error('Error obteniendo alertas recientes:', error);
        throw error;
      }
    }
  };

  // =============================================
  // HELPERS
  // =============================================
  const helpers = {
    formatDate: (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    getPeriodoEstacional: () => {
      const mes = new Date().getMonth() + 1;
      const esInvernada = mes >= 3 && mes <= 7;
      return {
        esInvernada,
        esPrimaveraVerano: !esInvernada,
        esEnjarbrazon: (mes >= 8 && mes <= 12) || mes === 1,
        esCosecha: mes >= 11 || mes <= 3,
        nombrePeriodo: esInvernada ? 'Invernada' : 'Primavera-Verano',
        descripcion: esInvernada ? 'Marzo-Julio' : 'Agosto-Febrero'
      };
    },

    procesarPayload: (payload) => {
      try {
        if (!payload) return null;
        
        const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        return {
          temperatura: data.temperatura ? parseFloat(data.temperatura) : null,
          humedad: data.humedad ? parseFloat(data.humedad) : null,
          peso: data.peso ? parseFloat(data.peso) : null,
          latitud: data.latitud ? parseFloat(data.latitud) : null,
          longitud: data.longitud ? parseFloat(data.longitud) : null
        };
      } catch (error) {
        console.warn('Error procesando payload:', error);
        return null;
      }
    },

    getPrioridadAlerta: (alertaId) => {
      const prioridadesMap = {
        'TI-TAC': 'CRÍTICA',
        'TI-TAP': 'PREVENTIVA',
        'TI-TBC-PI': 'CRÍTICA',
        'TE-TA': 'ALTA',
        'TE-TB': 'ALTA',
        'HI-HAC-PI': 'CRÍTICA',
        'HI-HAP-PI': 'PREVENTIVA',
        'HI-HBC-PV': 'CRÍTICA',
        'HI-HBP-PV': 'PREVENTIVA',
        'PE-E': 'ALTA',
        'PE-CPA': 'INFORMATIVA',
        'PE-DP-PI': 'ALTA',
        'TIE-TAC': 'CRÍTICA',
        'HIE-HAC': 'CRÍTICA'
      };
      return prioridadesMap[alertaId] || 'MEDIA';
    },

    getEmojiPrioridad: (prioridad) => {
      const emojiMap = {
        'CRÍTICA': '🚨',
        'ALTA': '⚠️',
        'PREVENTIVA': '💡',
        'MEDIA': 'ℹ️',
        'INFORMATIVA': '✅'
      };
      return emojiMap[prioridad] || 'ℹ️';
    },

    checkConnection: async () => {
      try {
        await apiRequest('get', '/health', null, false);
        setIsConnected(true);
        return true;
      } catch {
        setIsConnected(false);
        return false;
      }
    }
  };

  // =============================================
  // MÉTODOS PARA SELECTS
  // =============================================
  const selects = {
    usuarios: () => apiRequest('get', '/select/usuarios', null, false),
    roles: () => apiRequest('get', '/select/roles', null, false),
    colmenas: () => apiRequest('get', '/select/colmenas', null, false),
    nodos: () => apiRequest('get', '/select/nodos', null, false),
    nodoTipos: () => apiRequest('get', '/select/nodo-tipos', null, false),
  };

  // =============================================
  // MÉTODOS DE DIAGNÓSTICO
  // =============================================
  const diagnostic = {
    fullDatabaseCheck: () => apiRequest('get', '/diagnostic/database-full-check', null, false),
    setupTables: () => apiRequest('post', '/diagnostic/setup-tables'),
    populateTestData: () => apiRequest('post', '/diagnostic/populate-test-data'),
    testMessages: () => apiRequest('get', '/mensajes/test', null, false),
  };

  // =============================================
  // VALOR DEL CONTEXTO
  // =============================================
  const value = {
    isConnected,
    loading,
    error,
    testConnection,
    usuarios,
    roles,
    colmenas,
    nodos,
    nodoTipos,
    mensajes,
    dashboard,
    estaciones,
    reportes,
    alertas,
    selects,
    helpers,
    diagnostic,
    apiRequest,
    api,
    baseURL: getBaseURL(),
    isBackendHealthy: () => isConnected && !error,
    getCurrentUserInfo: () => {
      try {
        const userData = localStorage.getItem('smartbee_user');
        const token = localStorage.getItem('smartbee_token');
        return {
          user: userData ? JSON.parse(userData) : null,
          token: token,
          isAuthenticated: !!(userData && token)
        };
      } catch (error) {
        console.error('Error obteniendo información del usuario:', error);
        return { user: null, token: null, isAuthenticated: false };
      }
    },
    clearSession: () => {
      localStorage.removeItem('smartbee_token');
      localStorage.removeItem('smartbee_user');
      setError(null);
      console.log('🧹 Sesión limpiada');
    }
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};