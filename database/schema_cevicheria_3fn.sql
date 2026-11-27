-- ============================================================================
-- BASE DE DATOS: SISTEMA WEB EN TIEMPO REAL PARA CEVICHERÍA (API REST + KDS)
-- MOTOR: PostgreSQL 15+
-- NORMALIZACIÓN: Tercera Forma Normal (3FN) / BCNF
-- DESCRIPCIÓN: Gestión de mesas con QR dinámico, sesiones de consumo, carta
--              personalizable, ruteo KDS por estación (Barra Fría / Caliente),
--              pagos divididos y filtro inteligente de reseñas.
-- ============================================================================

-- Habilitar extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. GESTIÓN DE PERSONAL Y ROLES
-- ============================================================================
CREATE TABLE usuarios (
    id_usuario      SERIAL PRIMARY KEY,
    nombres         VARCHAR(100) NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(30)  NOT NULL CHECK (rol IN ('ADMIN', 'CAJERO', 'MOZO', 'COCINA_FRIA', 'COCINA_CALIENTE')),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. DISTRIBUCIÓN FÍSICA DEL LOCAL Y SESIONES DE MESA (QR DINÁMICO)
-- ============================================================================
CREATE TABLE zonas (
    id_zona         SERIAL PRIMARY KEY,
    nombre          VARCHAR(60)  NOT NULL UNIQUE,
    descripcion     VARCHAR(200),
    activa          BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE mesas (
    id_mesa         SERIAL PRIMARY KEY,
    id_zona         INT          NOT NULL REFERENCES zonas(id_zona) ON UPDATE CASCADE ON DELETE RESTRICT,
    numero_mesa     VARCHAR(10)  NOT NULL UNIQUE,
    capacidad       SMALLINT     NOT NULL CHECK (capacidad > 0),
    codigo_qr_token UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    estado          VARCHAR(20)  NOT NULL DEFAULT 'LIBRE' 
                    CHECK (estado IN ('LIBRE', 'OCUPADA', 'CUENTA_SOLICITADA', 'MANTENIMIENTO'))
);

CREATE TABLE sesiones_mesa (
    id_sesion            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_mesa              INT          NOT NULL REFERENCES mesas(id_mesa) ON UPDATE CASCADE ON DELETE RESTRICT,
    id_mozo_asignado     INT          REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL,
    token_acceso_cliente VARCHAR(128) NOT NULL UNIQUE,
    cantidad_comensales  SMALLINT     NOT NULL DEFAULT 1 CHECK (cantidad_comensales > 0),
    estado               VARCHAR(20)  NOT NULL DEFAULT 'ABIERTA' 
                         CHECK (estado IN ('ABIERTA', 'CERRADA', 'CANCELADA')),
    abierta_en           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expira_en            TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '90 minutes'),
    cerrada_en           TIMESTAMPTZ
);

-- ============================================================================
-- 3. CARTA DIGITAL, ESTACIONES KDS Y PERSONALIZACIONES (3FN)
-- ============================================================================
CREATE TABLE estaciones_cocina (
    id_estacion     SERIAL PRIMARY KEY,
    nombre          VARCHAR(50)  NOT NULL UNIQUE,
    descripcion     VARCHAR(150)
);

CREATE TABLE categorias_carta (
    id_categoria        SERIAL PRIMARY KEY,
    nombre              VARCHAR(80)  NOT NULL UNIQUE,
    descripcion         VARCHAR(255),
    orden_visualizacion SMALLINT     NOT NULL DEFAULT 0,
    activa              BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE platos (
    id_plato                 SERIAL PRIMARY KEY,
    id_categoria             INT            NOT NULL REFERENCES categorias_carta(id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT,
    id_estacion              INT            NOT NULL REFERENCES estaciones_cocina(id_estacion) ON UPDATE CASCADE ON DELETE RESTRICT,
    nombre                   VARCHAR(120)   NOT NULL UNIQUE,
    descripcion              TEXT,
    precio_base              NUMERIC(10, 2) NOT NULL CHECK (precio_base >= 0),
    tiempo_prep_estimado_min SMALLINT       NOT NULL DEFAULT 10 CHECK (tiempo_prep_estimado_min > 0),
    imagen_url               VARCHAR(500),
    modelo_3d_url            VARCHAR(500),
    disponible               BOOLEAN        NOT NULL DEFAULT TRUE,
    es_recomendado_ia        BOOLEAN        NOT NULL DEFAULT FALSE,
    creado_en                TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE grupos_opciones (
    id_grupo_opcion    SERIAL PRIMARY KEY,
    nombre             VARCHAR(80) NOT NULL UNIQUE,
    es_obligatorio     BOOLEAN     NOT NULL DEFAULT FALSE,
    seleccion_multiple BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE opciones_personalizacion (
    id_opcion        SERIAL PRIMARY KEY,
    id_grupo_opcion  INT            NOT NULL REFERENCES grupos_opciones(id_grupo_opcion) ON UPDATE CASCADE ON DELETE CASCADE,
    nombre           VARCHAR(80)    NOT NULL,
    precio_adicional NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (precio_adicional >= 0),
    disponible       BOOLEAN        NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_grupo_opcion_nombre UNIQUE (id_grupo_opcion, nombre)
);

CREATE TABLE plato_grupos_opciones (
    id_plato        INT NOT NULL REFERENCES platos(id_plato) ON UPDATE CASCADE ON DELETE CASCADE,
    id_grupo_opcion INT NOT NULL REFERENCES grupos_opciones(id_grupo_opcion) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (id_plato, id_grupo_opcion)
);

-- ============================================================================
-- 4. PEDIDOS EN TIEMPO REAL Y DETALLE DE CONSUMO
-- ============================================================================
CREATE TABLE pedidos (
    id_pedido          SERIAL PRIMARY KEY,
    id_sesion          UUID        NOT NULL REFERENCES sesiones_mesa(id_sesion) ON UPDATE CASCADE ON DELETE RESTRICT,
    numero_ticket      VARCHAR(20) NOT NULL UNIQUE,
    origen             VARCHAR(15) NOT NULL DEFAULT 'QR_CLIENTE' CHECK (origen IN ('QR_CLIENTE', 'MOZO_APP')),
    estado             VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE_PAGO' 
                       CHECK (estado IN ('PENDIENTE_PAGO', 'RECIBIDO', 'PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO')),
    notas_generales    TEXT,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hora_confirmacion  TIMESTAMPTZ,
    iniciado_cocina_en TIMESTAMPTZ,
    listo_en           TIMESTAMPTZ,
    entregado_en       TIMESTAMPTZ
);

CREATE TABLE detalle_pedidos (
    id_detalle                SERIAL PRIMARY KEY,
    id_pedido                 INT            NOT NULL REFERENCES pedidos(id_pedido) ON UPDATE CASCADE ON DELETE CASCADE,
    id_plato                  INT            NOT NULL REFERENCES platos(id_plato) ON UPDATE CASCADE ON DELETE RESTRICT,
    cantidad                  SMALLINT       NOT NULL CHECK (cantidad > 0),
    precio_unitario_historico NUMERIC(10, 2) NOT NULL CHECK (precio_unitario_historico >= 0),
    subtotal_base             NUMERIC(10, 2) GENERATED ALWAYS AS (cantidad * precio_unitario_historico) STORED,
    estado_estacion           VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE' 
                              CHECK (estado_estacion IN ('PENDIENTE', 'PREPARANDO', 'LISTO', 'ENTREGADO', 'CANCELADO')),
    observaciones_item        VARCHAR(255)
);

CREATE TABLE detalle_pedido_opciones (
    id_detalle                 INT            NOT NULL REFERENCES detalle_pedidos(id_detalle) ON UPDATE CASCADE ON DELETE CASCADE,
    id_opcion                  INT            NOT NULL REFERENCES opciones_personalizacion(id_opcion) ON UPDATE CASCADE ON DELETE RESTRICT,
    precio_adicional_historico NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (precio_adicional_historico >= 0),
    PRIMARY KEY (id_detalle, id_opcion)
);

-- ============================================================================
-- 5. PAGOS Y FILTRO DE RESEÑAS (FEEDBACK LOOP)
-- ============================================================================
CREATE TABLE pagos (
    id_pago             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_sesion           UUID           NOT NULL REFERENCES sesiones_mesa(id_sesion) ON UPDATE CASCADE ON DELETE RESTRICT,
    id_cajero           INT            REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL,
    metodo_pago         VARCHAR(25)    NOT NULL CHECK (metodo_pago IN ('TARJETA_ONLINE', 'YAPE', 'PLIN', 'POS_FISICO', 'EFECTIVO')),
    monto               NUMERIC(10, 2) NOT NULL CHECK (monto > 0),
    propina             NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (propina >= 0),
    estado              VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE' 
                        CHECK (estado IN ('PENDIENTE', 'COMPLETADO', 'FALLIDO', 'REEMBOLSADO')),
    referencia_pasarela VARCHAR(120),
    pagado_en           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE resenas_experiencia (
    id_resena         SERIAL PRIMARY KEY,
    id_sesion         UUID        NOT NULL UNIQUE REFERENCES sesiones_mesa(id_sesion) ON UPDATE CASCADE ON DELETE CASCADE,
    calificacion      SMALLINT    NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
    comentario        TEXT,
    redirigido_google BOOLEAN     NOT NULL DEFAULT FALSE,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. ÍNDICES DE RENDIMIENTO PARA CONSULTAS EN TIEMPO REAL (API REST / WEBSOCKETS)
-- ============================================================================
CREATE INDEX idx_sesiones_mesa_activa   ON sesiones_mesa(id_mesa) WHERE estado = 'ABIERTA';
CREATE INDEX idx_pedidos_sesion         ON pedidos(id_sesion);
CREATE INDEX idx_pedidos_estado_tiempo  ON pedidos(estado, creado_en);
CREATE INDEX idx_detalle_estado_estacion ON detalle_pedidos(estado_estacion);
CREATE INDEX idx_platos_categoria       ON platos(id_categoria) WHERE disponible = TRUE;
CREATE INDEX idx_pagos_sesion           ON pagos(id_sesion);

-- ============================================================================
-- 7. VISTAS ÚTILES PARA EL BACKEND (KDS Y ESTADO DE CUENTA EN VIVO)
-- ============================================================================

-- Vista para Kitchen Display System (KDS) ordenada por llegada y estación
CREATE OR REPLACE VIEW vw_kds_cocina AS
SELECT 
    dp.id_detalle,
    p.id_pedido,
    p.numero_ticket,
    m.numero_mesa,
    ec.nombre AS estacion,
    pl.nombre AS plato,
    dp.cantidad,
    dp.estado_estacion,
    dp.observaciones_item,
    COALESCE(STRING_AGG(op.nombre, ', '), 'Estándar') AS personalizaciones,
    p.creado_en AS hora_pedido,
    EXTRACT(EPOCH FROM (NOW() - p.creado_en))::INT / 60 AS minutos_espera
FROM detalle_pedidos dp
JOIN pedidos p ON dp.id_pedido = p.id_pedido
JOIN sesiones_mesa sm ON p.id_sesion = sm.id_sesion
JOIN mesas m ON sm.id_mesa = m.id_mesa
JOIN platos pl ON dp.id_plato = pl.id_plato
JOIN estaciones_cocina ec ON pl.id_estacion = ec.id_estacion
LEFT JOIN detalle_pedido_opciones dpo ON dp.id_detalle = dpo.id_detalle
LEFT JOIN opciones_personalizacion op ON dpo.id_opcion = op.id_opcion
WHERE dp.estado_estacion IN ('PENDIENTE', 'PREPARANDO', 'LISTO')
  AND p.estado NOT IN ('PENDIENTE_PAGO', 'CANCELADO', 'ENTREGADO')
GROUP BY dp.id_detalle, p.id_pedido, p.numero_ticket, m.numero_mesa, 
         ec.nombre, pl.nombre, dp.cantidad, dp.estado_estacion, 
         dp.observaciones_item, p.creado_en
ORDER BY p.creado_en ASC;

-- Vista para calcular la cuenta acumulada y saldo pendiente de cada sesión activa
CREATE OR REPLACE VIEW vw_cuenta_sesion AS
WITH consumo AS (
    SELECT 
        p.id_sesion,
        COALESCE(SUM(
            dp.subtotal_base + (dp.cantidad * COALESCE(ext.total_extras, 0))
        ), 0) AS total_consumido
    FROM pedidos p
    JOIN detalle_pedidos dp ON p.id_pedido = dp.id_pedido
    LEFT JOIN (
        SELECT id_detalle, SUM(precio_adicional_historico) AS total_extras
        FROM detalle_pedido_opciones
        GROUP BY id_detalle
    ) ext ON dp.id_detalle = ext.id_detalle
    WHERE p.estado <> 'CANCELADO' AND dp.estado_estacion <> 'CANCELADO'
    GROUP BY p.id_sesion
),
abonado AS (
    SELECT 
        id_sesion,
        COALESCE(SUM(monto), 0) AS total_pagado
    FROM pagos
    WHERE estado = 'COMPLETADO'
    GROUP BY id_sesion
)
SELECT 
    sm.id_sesion,
    m.numero_mesa,
    sm.estado AS estado_sesion,
    COALESCE(c.total_consumido, 0.00) AS total_consumido,
    COALESCE(a.total_pagado, 0.00)    AS total_pagado,
    (COALESCE(c.total_consumido, 0.00) - COALESCE(a.total_pagado, 0.00)) AS saldo_pendiente
FROM sesiones_mesa sm
JOIN mesas m ON sm.id_mesa = m.id_mesa
LEFT JOIN consumo c ON sm.id_sesion = c.id_sesion
LEFT JOIN abonado a ON sm.id_sesion = a.id_sesion;

-- ============================================================================
-- 8. DATOS SEMILLA INICIALES (SEED DATA PARA PRUEBAS DE LA CEVICHERÍA)
-- ============================================================================
INSERT INTO zonas (nombre, descripcion) VALUES
('Salón Principal', 'Área central climatizada'),
('Terraza Marina', 'Área abierta cerca a la entrada'),
('Barra Cevichera', 'Vista directa a la preparación en frío');

INSERT INTO mesas (id_zona, numero_mesa, capacidad) VALUES
(1, 'M-01', 4),
(1, 'M-02', 4),
(1, 'M-03', 6),
(2, 'M-07', 4),
(3, 'B-01', 2);

INSERT INTO estaciones_cocina (nombre, descripcion) VALUES
('BARRA_FRIA', 'Ceviches, tiraditos, causas y leches de tigre'),
('COCINA_CALIENTE', 'Chicharrones, jaleas, parihuelas y arroces'),
('BAR_BEBIDAS', 'Chicha morada, limonadas, cervezas y chilcanos');

INSERT INTO categorias_carta (nombre, descripcion, orden_visualizacion) VALUES
('Ceviches', 'Preparados al momento con pesca fresca del día', 1),
('Tiraditos', 'Finas láminas de pescado bañadas en cremas de ají', 2),
('Chicharrones y Jaleas', 'Crocantes frituras marinas acompañadas de yuca y sarza', 3),
('Rondas Marinas', 'Combinaciones ideales para compartir al centro', 4),
('Bebidas', 'Refrescos naturales y bebidas heladas', 5);

INSERT INTO platos (id_categoria, id_estacion, nombre, descripcion, precio_base, tiempo_prep_estimado_min, es_recomendado_ia) VALUES
(1, 1, 'Ceviche Clásico de Pescado', 'Cubos de pesca del día marinados en limón sutil, cebolla roja, cilantro y ají limo, con camote glaseado y choclo.', 34.00, 8, TRUE),
(1, 1, 'Ceviche Mixto Carretillero', 'Pesca del día, pulpo, calamar y langostinos con toque de chicharrón de pota crocante.', 38.00, 10, TRUE),
(2, 1, 'Tiradito al Ají Amarillo', 'Láminas de pescado fresco en emulsión cremosa de ají amarillo y limón.', 32.00, 7, FALSE),
(3, 2, 'Jalea Mixta Familiar', 'Trozos crocantes de pescado y mariscos sobre yucas doradas, cubierta con sarza criolla y tártara.', 52.00, 15, TRUE),
(4, 2, 'Ronda Marina Tres Regiones', 'Ceviche clásico + Arroz con mariscos + Chicharrón de pescado para 3 personas.', 68.00, 18, TRUE),
(5, 3, 'Jarra de Chicha Morada (1L)', 'Maíz morado hervido con piña, membrillo, canela y clavo.', 16.00, 3, FALSE);

INSERT INTO grupos_opciones (nombre, es_obligatorio, seleccion_multiple) VALUES
('Nivel de Ají', TRUE, FALSE),
('Tipo de Pescado', TRUE, FALSE),
('Guarniciones Extra', FALSE, TRUE);

INSERT INTO opciones_personalizacion (id_grupo_opcion, nombre, precio_adicional) VALUES
(1, 'Sin Ají', 0.00),
(1, 'Ají Suave', 0.00),
(1, 'Ají Normal', 0.00),
(1, 'Ají Limo Picante', 0.00),
(2, 'Pesca del Día', 0.00),
(2, 'Lenguado Fino', 9.00),
(3, 'Porción Extra Cancha Serrana', 3.50),
(3, 'Porción Extra Chicharrón de Pota', 7.00);

-- Asociar grupos de opciones a los ceviches (id_plato 1 y 2)
INSERT INTO plato_grupos_opciones (id_plato, id_grupo_opcion) VALUES
(1, 1), (1, 2), (1, 3),
(2, 1), (2, 2), (2, 3);

-- ============================================================================
-- 9. CONFIGURACIÓN DEL LOCAL (GEOCERCA GPS) Y MIGRACIÓN PARA SUPABASE
-- ============================================================================
CREATE TABLE IF NOT EXISTS configuracion_local (
    id                      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nombre_local            VARCHAR(100) NOT NULL DEFAULT 'SIN ESPINAS',
    latitud                 NUMERIC(10, 7) NOT NULL DEFAULT -16.4090474,
    longitud                NUMERIC(10, 7) NOT NULL DEFAULT -71.5374510,
    radio_permitido_metros  INT NOT NULL DEFAULT 80 CHECK (radio_permitido_metros > 0),
    validar_gps             BOOLEAN NOT NULL DEFAULT FALSE,
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO configuracion_local (id, nombre_local, latitud, longitud, radio_permitido_metros, validar_gps)
VALUES (1, 'SIN ESPINAS', -16.4090474, -71.5374510, 80, FALSE)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- BLOQUE DE MIGRACIÓN RÁPIDA (Ejecutar en SQL Editor de Supabase si ya existe la BD)
-- ----------------------------------------------------------------------------
-- 1. Flujo Prepago Obligatorio: permitir 'PENDIENTE_PAGO' en pedidos
-- ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
-- ALTER TABLE pedidos 
--   ADD CONSTRAINT pedidos_estado_check 
--   CHECK (estado IN ('PENDIENTE_PAGO', 'RECIBIDO', 'PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'));
-- ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'PENDIENTE_PAGO';
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS hora_confirmacion TIMESTAMPTZ;
--
-- 2. Asegurar que pagos admita 'APROBADO' y columna id_pedido
-- ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_estado_check;
-- ALTER TABLE pagos 
--   ADD CONSTRAINT pagos_estado_check 
--   CHECK (estado IN ('PENDIENTE', 'APROBADO', 'COMPLETADO', 'FALLIDO', 'REEMBOLSADO'));
-- ALTER TABLE pagos ADD COLUMN IF NOT EXISTS id_pedido INT REFERENCES pedidos(id_pedido) ON DELETE SET NULL;
--
-- 3. Vista KDS de cocina excluyendo pedidos sin pagar
-- CREATE OR REPLACE VIEW vw_kds_cocina AS
-- SELECT 
--     dp.id_detalle,
--     p.id_pedido,
--     p.numero_ticket,
--     m.numero_mesa,
--     ec.nombre AS estacion,
--     pl.nombre AS plato,
--     dp.cantidad,
--     dp.estado_estacion,
--     dp.observaciones_item,
--     COALESCE(STRING_AGG(op.nombre, ', '), 'Estándar') AS personalizaciones,
--     p.creado_en AS hora_pedido,
--     EXTRACT(EPOCH FROM (NOW() - p.creado_en))::INT / 60 AS minutos_espera
-- FROM detalle_pedidos dp
-- JOIN pedidos p ON dp.id_pedido = p.id_pedido
-- JOIN sesiones_mesa sm ON p.id_sesion = sm.id_sesion
-- JOIN mesas m ON sm.id_mesa = m.id_mesa
-- JOIN platos pl ON dp.id_plato = pl.id_plato
-- JOIN estaciones_cocina ec ON pl.id_estacion = ec.id_estacion
-- LEFT JOIN detalle_pedido_opciones dpo ON dp.id_detalle = dpo.id_detalle
-- LEFT JOIN opciones_personalizacion op ON dpo.id_opcion = op.id_opcion
-- WHERE dp.estado_estacion IN ('PENDIENTE', 'PREPARANDO', 'LISTO')
--   AND p.estado NOT IN ('PENDIENTE_PAGO', 'CANCELADO', 'ENTREGADO')
-- GROUP BY dp.id_detalle, p.id_pedido, p.numero_ticket, m.numero_mesa, 
--          ec.nombre, pl.nombre, dp.cantidad, dp.estado_estacion, 
--          dp.observaciones_item, p.creado_en;
--
-- 4. Expiración de sesión y Geocerca GPS (si no se ejecutó previamente)
-- ALTER TABLE sesiones_mesa
--   ADD COLUMN IF NOT EXISTS expira_en TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 minutes');
--
-- CREATE TABLE IF NOT EXISTS configuracion_local (
--     id                      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
--     nombre_local            VARCHAR(100) NOT NULL DEFAULT 'SIN ESPINAS',
--     latitud                 NUMERIC(10, 7) NOT NULL DEFAULT -16.4090474,
--     longitud                NUMERIC(10, 7) NOT NULL DEFAULT -71.5374510,
--     radio_permitido_metros  INT NOT NULL DEFAULT 80 CHECK (radio_permitido_metros > 0),
--     validar_gps             BOOLEAN NOT NULL DEFAULT FALSE,
--     actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
--
-- INSERT INTO configuracion_local (id, nombre_local, latitud, longitud, radio_permitido_metros, validar_gps)
-- VALUES (1, 'SIN ESPINAS', -16.4090474, -71.5374510, 80, FALSE)
-- ON CONFLICT (id) DO NOTHING;
