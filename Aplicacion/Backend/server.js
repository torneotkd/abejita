const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Importar configuraciones y middlewares
const { dbConfig, pool } = require('./config/database');
const corsConfig = require('./config/cors');
const { loggingMiddleware, errorHandler, notFoundHandler } = require('./middleware/general');

// Importar rutas
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const beehiveRoutes = require('./routes/beehives');
const nodeRoutes = require('./routes/nodes');
const nodeTypeRoutes = require('./routes/node-types');
const dashboardRoutes = require('./routes/dashboard');
const debugRoutes = require('./routes/debug');
const diagnosticRoutes = require('./routes/diagnostic');
const adminRoutes = require('./routes/admin');
const messageRoutes = require('./routes/messages');
const stationRoutes = require('./routes/stations');
const alertasRoutes = require('./routes/alertas');

const app = express();
const PORT = process.env.PORT || 3004; // ← CAMBIADO A 3004

// Middlewares globales
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggingMiddleware);

// =============================================
// RUTAS BÁSICAS Y DE SALUD
// =============================================
app.get('/api/health', (req, res) => {
    res.json({ 
        message: 'SmartBee API funcionando correctamente',
        timestamp: new Date().toISOString(),
        database: 'MySQL Local'
    });
});

app.get('/api/test-connection', async (req, res) => {
    let connection;
    try {
        console.log('🔗 Probando conexión...');
        connection = await pool.getConnection();
        console.log('✅ Conexión obtenida');
        
        const [result] = await connection.execute('SELECT 1 as test, NOW() as time');
        console.log('✅ Query ejecutada:', result[0]);
        
        res.json({ 
            success: true, 
            result: result[0],
            message: 'Conexión exitosa'
        });
        
    } catch (error) {
        console.error('💥 Error de conexión:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            code: error.code 
        });
    } finally {
        if (connection) {
            connection.release();
            console.log('🔓 Conexión liberada');
        }
    }
});

// =============================================
// REGISTRAR TODAS LAS RUTAS API
// =============================================
app.use('/api/usuarios', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/colmenas', beehiveRoutes);
app.use('/api/nodos', nodeRoutes);
app.use('/api/nodo-tipos', nodeTypeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mensajes', messageRoutes);
app.use('/api/nodo-mensajes', messageRoutes);
app.use('/api/estaciones', stationRoutes);
app.use('/api/alertas', alertasRoutes);

// Rutas de compatibilidad
app.get('/api/revisiones', (req, res) => {
    console.log('📝 Obteniendo revisiones...');
    res.json([]);
});

app.post('/api/revisiones', (req, res) => {
    res.json({ 
        message: 'Funcionalidad de revisiones pendiente de implementación',
        id: Date.now()
    });
});

app.get('/api/select/usuarios', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT id, nombre, apellido FROM usuario ORDER BY nombre');
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo usuarios para select:', error);
        res.status(500).json({ error: 'Error obteniendo usuarios' });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/colmenas/activas', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(`
            SELECT id, CONCAT('Colmena #', id) as nombre FROM colmena ORDER BY id
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error obteniendo colmenas activas:', error);
        res.status(500).json({ error: 'Error obteniendo colmenas activas' });
    } finally {
        if (connection) connection.release();
    }
});

// =============================================
// SERVIR ARCHIVOS ESTÁTICOS DE REACT
// =============================================
// Servir archivos estáticos desde la carpeta build
app.use(express.static(path.join(__dirname, 'build')));

// =============================================
// MIDDLEWARES DE MANEJO DE ERRORES
// =============================================
app.use(errorHandler);

// Ruta catch-all: cualquier petición que no sea /api/* devuelve React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// =============================================
// INICIAR SERVIDOR
// =============================================
const startServer = async () => {
    try {
        console.log('🔄 Probando conexión a MySQL local...');
        const connection = await pool.getConnection();
        console.log('✅ Conexión exitosa a MySQL local (127.0.0.1:3306)');
        connection.release();
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor SmartBee ejecutándose en puerto ${PORT}`);
            console.log(`🌐 Frontend: http://localhost:${PORT}`);
            console.log(`🌐 API: http://localhost:${PORT}/api`);
            console.log(`🗄️  Base de datos: MySQL Local (127.0.0.1:3306)`);
            console.log(`📋 Endpoints disponibles:`);
            console.log(`   ✅ GET  /api/health`);
            console.log(`   ✅ POST /api/usuarios/login`);
            console.log(`   ✅ GET  /api/usuarios`);
            console.log(`   ✅ GET  /api/colmenas`);
            console.log(`   ✅ GET  /api/mensajes/recientes`);
            console.log(`   ✅ GET  /api/dashboard/stats`);
            console.log(`   ✅ GET  /api/alertas/evaluar/:colmenaId`);
            console.log(`   ✅ GET  /api/alertas/usuario/:usuarioId`);
            console.log(`   ✅ GET  /api/debug/check-tables`);
        });
    } catch (error) {
        console.error('❌ Error conectando a MySQL local:', error.message);
        
        app.listen(PORT, () => {
            console.log(`🚀 Servidor SmartBee (modo desarrollo) en puerto ${PORT}`);
            console.log(`⚠️  Sin conexión a base de datos`);
        });
    }
};

startServer();

process.on('SIGINT', async () => {
    console.log('\n🔄 Cerrando servidor...');
    await pool.end();
    console.log('✅ Pool de conexiones cerrado');
    process.exit(0);
});

module.exports = app;