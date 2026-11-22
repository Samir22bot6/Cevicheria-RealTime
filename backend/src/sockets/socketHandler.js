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
    });

    // Solicitar mozo o cuenta desde cliente
    socket.on('solicitar_atencion', (data) => {
      io.to('mozos').emit('alerta_mesa', {
        tipo: data?.tipo || 'LLAMAR_MOZO',
        numero_mesa: data?.numero_mesa,
        id_sesion: data?.id_sesion,
        mensaje: data?.mensaje || 'La mesa solicita asistencia',
        hora: new Date().toISOString()
      });
    });
  });

  return io;
};

export const getIO = () => ioInstance;

