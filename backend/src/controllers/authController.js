import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/authService.js';
import { config } from '../config/env.js';

export const AuthController = {
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'Email y contraseña requeridos' });
      }

      const usuario = await AuthService.buscarUsuarioPorEmail(email);
      if (!usuario) {
        return res.status(401).json({ ok: false, error: 'Credenciales inválidas o usuario inactivo' });
      }

      const passValido = await bcrypt.compare(password, usuario.password_hash);
      if (!passValido) {
        return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        {
          id_usuario: usuario.id_usuario,
          nombres: usuario.nombres,
          apellidos: usuario.apellidos,
          email: usuario.email,
          rol: usuario.rol
        },
        config.jwtSecret,
        { expiresIn: '12h' }
      );

      return res.status(200).json({
        ok: true,
        data: {
          token,
          usuario: {
            id_usuario: usuario.id_usuario,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            email: usuario.email,
            rol: usuario.rol
          }
        }
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }
};

