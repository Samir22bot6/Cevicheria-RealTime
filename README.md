# 🐟 Cevicheria Real-Time MVP (Carta Digital QR + KDS + Asistente IA + Pagos)

Sistema web en tiempo real para cevicherías y restaurantes con menú digital por QR (fricción cero para el comensal), asistente de maridaje con Gemini AI, pantallas de cocina (KDS) por estaciones, gestión administrativa de mesas y cobros integrados con Mercado Pago Perú (Yape, Plin y Tarjetas).

---

## 🚀 Arquitectura y Tecnologías

- **Backend:** Node.js, Express, Socket.io, `@supabase/supabase-js`, `@google/genai` (Gemini 2.5 Flash), `mercadopago`, JWT + bcryptjs.
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Socket.io-client.
- **Base de Datos:** PostgreSQL / Supabase diseñado en Tercera Forma Normal (3FN) con vistas (`vw_kds_cocina`, `vw_cuenta_sesion`) y fallback a mock store en memoria para pruebas locales.

---

## 📁 Estructura del Proyecto

```
CevicheriaAPIREST/
├── backend/
│   ├── src/
│   │   ├── config/          # Variables de entorno y cliente Supabase
│   │   ├── controllers/     # Controladores REST (carta, pedidos, kds, sesiones, admin, pagos)
│   │   ├── middlewares/     # Auth JWT y RBAC por roles
│   │   ├── routes/          # Rutas agrupadas /api/v1
│   │   ├── services/        # Lógica de negocio (IA Gemini, Mercado Pago, KDS, etc.)
│   │   └── sockets/         # Handlers de Socket.io en tiempo real
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes UI (RutaProtegida, etc.)
│   │   ├── services/        # Cliente Axios y conexión Socket.io
│   │   ├── views/           # Vistas (ClienteView, AdminView, CocinaView, LoginView)
│   │   └── App.jsx
│   ├── .env.example
│   └── package.json
└── database/
    └── schema_cevicheria_3fn.sql   # Esquema 3FN, índices, vistas y datos iniciales
```

---

## ⚡ Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone https://github.com/Samir22bot6/Cevicheria-RealTime.git
cd Cevicheria-RealTime
```

### 2. Configurar Backend
```bash
cd backend
npm install
cp .env.example .env
```
*(Edita `.env` con tus claves de Supabase, Gemini AI y Mercado Pago si las tienes; si no, funcionará en modo demo automático).*

Iniciar backend:
```bash
npm start   # o: node src/index.js
# Servidor corriendo en http://localhost:4000
```

### 3. Configurar Frontend
```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
# Aplicación corriendo en http://localhost:5173
```

---

## 🔑 Cuentas por Defecto (Personal del Restaurante)

Al arrancar el backend por primera vez, se inicializan automáticamente dos usuarios de prueba:
- **Admin:** `admin@cevicheria.com` / `Admin123!` (Acceso a `/admin`)
- **Cocina:** `cocina@cevicheria.com` / `Cocina123!` (Acceso a `/cocina`)

Los comensales **no requieren cuenta**: entran directo escaneando `/mesa/M-07`.

---

## 💳 Pasarela de Pagos (Mercado Pago Perú)
Soporta **Checkout Pro / Orders API** para Yape, Plin y Tarjeta. Si `MP_ACCESS_TOKEN` no está configurado, el sistema activa el **Modo Demo** permitiendo simular pagos aprobados sin bloquear pruebas locales.
