import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { config } from './config/env.js';
import apiRouter from './routes/apiRoutes.js';
import { initSocket } from './sockets/socketHandler.js';
import { AuthService } from './services/authService.js';

const app = express();
const server = http.createServer(app);

// Configuración de orígenes permitidos para CORS (soporta FRONTEND_URL con o sin barra final y localhost)
const frontendUrlConfig = (config.frontendUrl || 'http://localhost:5173').trim();
const normalizedFrontend = frontendUrlConfig.replace(/\/$/, '');

const corsOriginValidator = (origin, callback) => {
  // Permitir solicitudes sin origin (como apps móviles, Postman o curl)
  if (!origin) return callback(null, true);

  const normalizedOrigin = origin.replace(/\/$/, '');
  
  if (
    normalizedOrigin === normalizedFrontend ||
    normalizedOrigin.includes('localhost') ||
    normalizedOrigin.includes('127.0.0.1') ||
    normalizedOrigin.endsWith('.vercel.app') // Opcional para previsualizaciones de Vercel
  ) {
    return callback(null, true);
  }

  // Si no coincide pero queremos ser flexibles en producción:
  return callback(null, true);
};

// Configuración de CORS Express
app.use(cors({
  origin: corsOriginValidator,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// WebSockets con Socket.io y CORS flexible
const io = new Server(server, {
  cors: {
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true
  }
});
initSocket(io);

// Rutas de la API v1
app.use('/api/v1', apiRouter);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Cevichería API REST + KDS + Admin + IA',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

server.listen(config.port, async () => {
  console.log(`=======================================================`);
  console.log(`🌊 Servidor Cevicheria API REST corriendo en puerto ${config.port}`);
  console.log(`⚡ WebSockets listos en ws://localhost:${config.port}`);
  console.log(`🚀 API Base: http://localhost:${config.port}/api/v1`);
  console.log(`=======================================================`);

  // Ejecutar seed inicial de usuarios
  await AuthService.seedUsuariosIniciales();
});
