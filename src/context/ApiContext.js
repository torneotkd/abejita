import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const ApiContext = createContext();

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi debe ser utilizado dentro de un ApiProvider');
  }
  return context;
};

// 🔵 PRODUCCIÓN: La URL de la API se obtiene de las variables de entorno.
const getBaseURL = () => {
  // Para producción, siempre priorizar la variable de entorno.
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // URL de fallback para el entorno de producción.
  return 'https://www.smartbee.cl/api';
};

// Configuración de axios para conectar al backend
const api = axios.create({
  baseURL: getBaseURL(),
  // 🔵 PRODUCCIÓN: Timeout aumentado para redes potencialmente más lentas.
  timeout: 30000, 
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use(
  (config) => {
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

// Interceptor para manejar respuestas y errores centralizadamente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('❌ Response Error:', error.response?.status, error.message);
    
    if (error.response?.status === 401) {
      console.log('🔐 Sesión inválida, limpiando almacenamiento local.');
      localStorage.removeItem('smartbee_token');
      localStorage.removeItem('smartbee_user');
      
      if (!window.location.pathname.includes('login')) {
        window.location.reload();
      }
    }
    
    return Promise.reject(error);
  }
);

export const ApiProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true); // Asumir conectado al inicio
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('🌐 Conectando a la API en:', getBaseURL());
  }, []);

  // Probar conexión al inicio y luego periódicamente
  useEffect(() => {
    testConnectionSilent();
    
    // 🔵 PRODUCCIÓN: Verificar conexión con menos frecuencia.
    const interval = setInterval(testConnectionSilent, 60000); // Cada 60 segundos

    return () => clearInterval(interval);
  }, []);

  const testConnection = async () => {
    setLoading(true);
    try {
      await api.get('/health');
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setIsConnected(false);
      // 🔵 PRODUCCIÓN: Mensaje de error genérico.
      const errorMessage = 'No se pudo establecer conexión con el servidor.';
      setError(errorMessage);
      console.error('🔴 Error de conexión:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const testConnectionSilent = async () => {
    try {
      await api.get('/health');
      if (!isConnected) setIsConnected(true);
      if (error) setError(null);
    } catch (err) {
      if (isConnected) setIsConnected(false);
      if (!error) setError('Conexión perdida con el servidor.');
    }
  };

  const apiRequest = async (method, endpoint, data = null, showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const response = await api({
        method,
        url: endpoint,
        data,
      });
      setIsConnected(true);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Ocurrió un error en la petición.';
      
      if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
        setIsConnected(false);
        setError('No se puede conectar al servidor.');
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
    
    login: async (credentials) => {
      try {
        const response = await api.post('/usuarios/login', credentials);
        
        if (response.data && response.data.data) {
          localStorage.setItem('smartbee_token', response.data.data.token);
          localStorage.setItem('smartbee_user', JSON.stringify(response.data.data.usuario));
          setIsConnected(true);
          setError(null);
          return response.data;
        }
        throw new Error('Respuesta de login inválida');
      } catch (error) {
        console.error('❌ Error en login:', error);
        if (error.response?.status === 401) {
          throw new Error('Credenciales incorrectas');
        } else if (error.code === 'ERR_NETWORK') {
          setIsConnected(false);
          throw new Error('No se puede conectar al servidor. Verifique su conexión a internet.');
        }
        throw error;
      }
    },
    
    logout: () => {
      localStorage.removeItem('smartbee_token');
      localStorage.removeItem('smartbee_user');
    },
    
    isAuthenticated: () => !!localStorage.getItem('smartbee_token'),
    
    getCurrentUser: () => {
      try {
        const userData = localStorage.getItem('smartbee_user');
        return userData ? JSON.parse(userData) : null;
      } catch {
        return null;
      }
    }
  };

  // ... (El resto de los métodos para roles, colmenas, nodos, etc., no necesitan cambios)
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
    getByNodo: (nodoId, limit = 100) => apiRequest('get', `/mensajes/nodo/${nodoId}?limit=${limit}`),
    getRecientes: (hours = 24) => apiRequest('get', `/mensajes/recientes?hours=${hours}`),
  };

  // =============================================
  // MÉTODOS PARA DASHBOARD
  // =============================================
  const dashboard = {
    getStats: () => apiRequest('get', '/dashboard/stats'),
    getAlertas: () => apiRequest('get', '/dashboard/alertas'),
    getMonitoreo: () => apiRequest('get', '/dashboard/monitoreo'),
    getSensorData: async (hours = 168, userId = null) => {
      if (!userId) {
          const user = usuarios.getCurrentUser();
          if (user) userId = user.id;
      }
      if (!userId) throw new Error('Se requiere userId para obtener datos de sensores');
      
      try {
        return await apiRequest('get', `/dashboard/sensor-data?hours=${hours}&userId=${userId}`);
      } catch (error) {
        console.error('❌ Error obteniendo datos de sensores:', error);
        return { internos: [], externos: [], combinados: [], nodos: { interior: [], exterior: [] }, error: true };
      }
    }
  };
    
 // =============================================
  // MÉTODOS PARA ALERTAS
  // =============================================
  const alertas = {
    evaluar: (colmenaId, hours = 168) => apiRequest('get', `/alertas/evaluar/${colmenaId}?hours=${hours}`),
    getSugerencias: (alertaId) => apiRequest('get', `/alertas/sugerencias/${alertaId}`),
    getHistorial: (colmenaId, limit = 50, hours = 720) => apiRequest('get', `/alertas/historial/${colmenaId}?limit=${limit}&hours=${hours}`),
    getByUsuario: (usuarioId, hours = 24) => apiRequest('get', `/alertas/usuario/${usuarioId}?hours=${hours}`),
    evaluarParaUsuario: (usuarioId, hours = 168) => apiRequest('get', `/alertas/evaluarUsuario/${usuarioId}?hours=${hours}`),
    evaluarParaUsuarioActual: (hours = 168) => {
        const user = usuarios.getCurrentUser();
        if(!user) throw new Error("Usuario no autenticado");
        return apiRequest('get', `/alertas/evaluarUsuario/${user.id}?hours=${hours}`);
    },
    getAlertasRecientes: (hours = 24) => {
        const user = usuarios.getCurrentUser();
        if(!user) throw new Error("Usuario no autenticado");
        return apiRequest('get', `/alertas/usuario/${user.id}?hours=${hours}`);
    },
  };
    
 // =============================================
  // HELPERS Y UTILIDADES
  // =============================================
  const helpers = {
    formatDate: (date) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleString('es-CL');
    },
    getPrioridadAlerta: (alertaId) => {
      const prioridadesMap = { 'TI-TAC': 'CRÍTICA', 'TI-TBC-PI': 'CRÍTICA', 'HI-HAC-PI': 'CRÍTICA', 'HI-HBC-PV': 'CRÍTICA', 'TIE-TAC': 'CRÍTICA', 'HIE-HAC': 'CRÍTICA', 'TE-TA': 'ALTA', 'TE-TB': 'ALTA', 'PE-E': 'ALTA', 'PE-DP-PI': 'ALTA', 'TI-TAP': 'PREVENTIVA', 'HI-HAP-PI': 'PREVENTIVA', 'HI-HBP-PV': 'PREVENTIVA', 'PE-CPA': 'INFORMATIVA' };
      return prioridadesMap[alertaId] || 'MEDIA';
    },
    getEmojiPrioridad: (prioridad) => {
      const emojiMap = { 'CRÍTICA': '🚨', 'ALTA': '⚠️', 'PREVENTIVA': '💡', 'MEDIA': 'ℹ️', 'INFORMATIVA': '✅' };
      return emojiMap[prioridad] || 'ℹ️';
    },
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
    alertas,
    helpers,
    apiRequest,
    api,
    baseURL: getBaseURL(),
    clearSession: () => {
      localStorage.removeItem('smartbee_token');
      localStorage.removeItem('smartbee_user');
      setError(null);
    }
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};