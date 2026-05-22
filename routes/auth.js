const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');

const mailer = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Campos requeridos' });
  try {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE email=? AND activo=1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign(
      { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
      process.env.JWT_SECRET, { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  if (!nombre || !email || !password) return res.status(400).json({ error: 'Campos requeridos' });
  try {
    const [exists] = await db.query('SELECT id FROM usuarios WHERE email=?', [email]);
    if (exists.length) return res.status(409).json({ error: 'El correo ya está registrado' });
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)',
      [nombre, email, hash, rol || 'vendedor']
    );
    res.status(201).json({ message: 'Cuenta creada exitosamente' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/forgot-password ─────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });
  try {
    const [rows] = await db.query('SELECT id, nombre FROM usuarios WHERE email=? AND activo=1', [email]);
    if (!rows.length) return res.json({ message: 'Si el correo existe, recibirás un enlace' });
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hora
    await db.query('UPDATE usuarios SET reset_token=?, reset_token_expiry=? WHERE id=?', [token, expiry, rows[0].id]);
    const link = `${process.env.FRONTEND_URL}/pages/reset-password.html?token=${token}`;
    await mailer.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Recuperación de contraseña - InTech',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
          <h2 style="color:#0066ff">InTech Manager</h2>
          <p>Hola <strong>${rows[0].nombre}</strong>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón:</p>
          <a href="${link}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#0066ff;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Restablecer contraseña</a>
          <p style="color:#888;font-size:13px">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
        </div>`
    });
    res.json({ message: 'Si el correo existe, recibirás un enlace' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/auth/reset-password ──────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Datos requeridos' });
  try {
    const [rows] = await db.query(
      "SELECT id FROM usuarios WHERE reset_token=? AND reset_token_expiry > datetime('now')", [token]
    );
    if (!rows.length) return res.status(400).json({ error: 'Token inválido o expirado' });
    const hash = await bcrypt.hash(password, 12);
    await db.query('UPDATE usuarios SET password_hash=?, reset_token=NULL, reset_token_expiry=NULL WHERE id=?', [hash, rows[0].id]);
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
