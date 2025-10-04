const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Importar configuraciones y middlewares
const { pool } = require('./config/database');
const corsConfig = require('./config/cors');
const { loggingMiddleware, errorHandler, notFoundHandler } = require('./middleware/general');

// Importar rutas de producción
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const beehiveRoutes = require('./routes/beehives');
const nodeRoutes = require('./routes/nodes');
const nodeTypeRoutes = require('./routes/node-types');
const dashboardRoutes = require('./routes/dashboard');
const messageRoutes = require('./routes/messages');
const stationRoutes = require('./routes/stations');
const alertasRoutes = require('./routes/alertas');

const app = express();
const PORT = process.env.PORT || 3306;

// =============================================
// MIDDLEWARES DE SEGURIDAD Y GLOBALES
// =============================================
app.use(helmet()); // Aplica cabeceras de seguridad
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggingMiddleware); // Middleware para logging de peticiones

// Configuración de límite de peticiones para las rutas de la API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Límite de 100 peticiones por IP en la ventana de tiempo
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas peticiones desde esta IP, por favor intente de nuevo después de 15 minutos.'
});

// Aplicar el límite de peticiones a todas las rutas de la API
app.use('/api/', apiLimiter);

// =============================================
// RUTA DE SALUD DEL SERVIDOR (HEALTH CHECK)
// =============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        message: 'SmartBee API está operativa.',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// REGISTRO DE RUTAS DE LA APLICACIÓN
// =============================================
app.use('/api/usuarios', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/colmenas', beehiveRoutes);
app.use('/api/nodos', nodeRoutes);
app.use('/api/nodo-tipos', nodeTypeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/mensajes', messageRoutes);
app.use('/api/estaciones', stationRoutes);
app.use('/api/alertas', alertasRoutes);

// Rutas de compatibilidad para selects (si aún son necesarias)
app.get('/api/select/usuarios', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT id, nombre, apellido FROM usuario ORDER BY nombre');
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo usuarios para select:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// MIDDLEWARES DE MANEJO DE ERRORES (al final)
// =============================================
app.use(notFoundHandler); // Maneja rutas no encontradas
app.use(errorHandler); // Maneja todos los demás errores

// =============================================
// INICIO DEL SERVIDOR
// =============================================
const startServer = async () => {
    try {
        // Verificar la conexión con la base de datos antes de iniciar
        const connection = await pool.getConnection();
        console.log('✅ Conexión con la base de datos establecida correctamente.');
        connection.release();
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor SmartBee iniciado en modo producción en el puerto ${PORT}`);
            console.log(`🌐 API disponible en la ruta base /api`);
        });
    } catch (error) {
        console.error('❌ FATAL: No se pudo conectar a la base de datos. El servidor no se iniciará.');
        console.error(error.message);
        process.exit(1); // Termina el proceso si no hay conexión a la BD
    }
};

startServer();

// Manejo elegante del cierre del servidor
process.on('SIGINT', async () => {
    console.log('\n🔄 Recibida señal de interrupción. Cerrando conexiones...');
    await pool.end();
    console.log('✅ Pool de conexiones de la base de datos cerrado.');
    process.exit(0);
});

module.exports = app;
