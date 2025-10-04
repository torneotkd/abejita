require('dotenv').config();

// 🔵 LISTA BLANCA DE ORÍGENES PERMITIDOS
// Esta lista contiene todos los dominios que tienen permiso para hacer peticiones a la API.
const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',') 
    : [
        // 1. Dominio de Producción:
        // Aceptará peticiones de cualquier página bajo este dominio
        // (ej. smartbee.cl/chillan, smartbee.cl/ovalle, etc.)
        'https://www.smartbee.cl',

        // 2. Dominio de Desarrollo Local:
        // Permite que tu frontend de React en localhost se comunique con el backend.
        'http://localhost:3004',
      ];

const corsConfig = {
    origin: (origin, callback) => {
        // Si el origen de la petición está en nuestra lista blanca (o si no hay origen,
        // como en el caso de Postman), se permite el acceso.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Si el origen no está en la lista, se rechaza la petición.
            callback(new Error('Acceso no permitido por la política de CORS.'));
        }
    },
    
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = corsConfig;

