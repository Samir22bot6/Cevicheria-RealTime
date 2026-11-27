let ioInstance = null;

export const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    // Unirse a sala de sesión de cliente: mesa_<id_sesion>
    socket.on('unirse_sesion', (id_sesion) => {
      if (id_sesion) {
        socket.join(`mesa_${id_sesion}`);
      }
    });

    // Unirse a estaciones de cocina: BARRA_FRIA, COCINA_CALIENTE, BAR_BEBIDAS, TODAS
    socket.on('unirse_cocina', (estacion) => {
      if (estacion) {
        socket.join(`cocina_${estacion}`);
        socket.join('cocina_TODAS');
      }
    });

    // Unirse a sala de mozos y administradores
    socket.on('unirse_mozos', () => {
      socket.join('mozos');
      socket.join('admin');
    });

    // Solicitar mozo o cuenta desde cliente (compatibilidad con evento anterior)
    socket.on('solicitar_atencion', (data) => {
      const payload = {
        id_alerta: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo: data?.tipo || 'LLAMAR_MOZO',
        numero_mesa: data?.numero_mesa,
        id_sesion: data?.id_sesion,
        motivo: data?.motivo || data?.mensaje || 'La mesa solicita asistencia',
        mensaje: data?.mensaje || data?.motivo || 'La mesa solicita asistencia',
        hora: new Date().toISOString()
      };
      io.to('mozos').emit('alerta_mesa', payload);
      io.to('mozos').emit('llamar_mozo', payload);
    });

    // Evento dedicado llamar_mozo con motivo específico
    socket.on('llamar_mozo', (data) => {
      const motivo = data?.motivo || 'Necesita atención en mesa';
      const payload = {
        id_alerta: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo: 'LLAMAR_MOZO',
        numero_mesa: data?.numero_mesa,
        id_sesion: data?.id_sesion,
        motivo,
        mensaje: `Mesa ${data?.numero_mesa || '??'}: ${motivo}`,
        hora: new Date().toISOString()
      };
      io.to('mozos').emit('llamar_mozo', payload);
      io.to('mozos').emit('alerta_mesa', payload);
    });
  });

  return io;
};

export const getIO = () => ioInstance;

