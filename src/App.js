import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ApiProvider } from './context/ApiContext';
import Login from './pages/Login';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';

// Importar páginas de administrador
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import Colmenas from './pages/Colmenas';
import Revisiones from './pages/Colmenas'; // Asumiendo que Revisiones usa el mismo componente que Colmenas

// Importar páginas de usuario/apicultor
import UserDashboard from './pages/user/UserDashboard';

// Configuración de rutas por rol
const ROLE_CONFIG = {
  ADM: {
    name: 'Administrador',
    defaultRoute: '/dashboard',
    routes: [
      { path: '/dashboard', component: Dashboard, name: 'Dashboard', icon: '📊' },
      { path: '/usuarios', component: Usuarios, name: 'Usuarios', icon: '👥' },
      { path: '/colmenas', component: Colmenas, name: 'Colmenas', icon: '🏠' },
      { path: '/revisiones', component: Revisiones, name: 'Nodos', icon: '📡' },
    ]
  },
  API: {
    name: 'Apicultor',
    defaultRoute: '/user-dashboard',
    routes: [
      { path: '/user-dashboard', component: UserDashboard, name: 'Mi Dashboard', icon: '📊' },
    ]
  }
};

const getSidebarTheme = (userRole) => {
    // ... (tu lógica para obtener el tema)
    return {}; // Placeholder
};

// Componente wrapper para la aplicación autenticada
const AuthenticatedApp = ({ currentUser, onLogout }) => {
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const userRole = currentUser?.rol || 'API';
  const roleConfig = ROLE_CONFIG[userRole] || ROLE_CONFIG.API;
  const sidebarTheme = getSidebarTheme(userRole);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <Sidebar 
        currentUser={currentUser}
        roleConfig={roleConfig}
        theme={sidebarTheme}
        isMobileOpen={isMobileSidebarOpen}
        onMobileToggle={setIsMobileSidebarOpen}
      />
      <div className="main-content">
        <Navbar 
          currentUser={currentUser}
          onLogout={onLogout}
          roleConfig={roleConfig}
          onMobileMenuToggle={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Navigate to={roleConfig.defaultRoute} replace />} />
            {roleConfig.routes.map(({ path, component: Component }) => (
              <Route 
                key={path} 
                path={path} 
                element={<Component currentUser={currentUser} />} 
              />
            ))}
            <Route path="*" element={<Navigate to={roleConfig.defaultRoute} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

// Componente para mostrar información de rol no válido
const InvalidRoleMessage = ({ currentUser, onLogout }) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Rol No Válido</h3>
        <p className="text-sm text-gray-500 mb-4">
          Tu usuario tiene un rol no reconocido: <strong>{currentUser?.rol}</strong>. Por favor contacta al administrador.
        </p>
        <button onClick={onLogout} className="w-full btn btn-danger">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const token = localStorage.getItem('smartbee_token');
        const userData = localStorage.getItem('smartbee_user');
        
        if (token && userData) {
          const user = JSON.parse(userData);
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuthStatus();
  }, []);

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('smartbee_token');
    localStorage.removeItem('smartbee_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
<Router basename={process.env.NODE_ENV === 'production' ? '/chillan' : '/'}>      <ApiProvider>
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          ) : (
            <>
              {currentUser?.rol && ROLE_CONFIG[currentUser.rol] ? (
                <Route 
                  path="/*"
                  element={<AuthenticatedApp currentUser={currentUser} onLogout={handleLogout} />} 
                />
              ) : (
                <Route 
                  path="*" 
                  element={<InvalidRoleMessage currentUser={currentUser} onLogout={handleLogout} />}
                />
              )}
            </>
          )}
        </Routes>
      </ApiProvider>
    </Router>
  );
}

export default App;
