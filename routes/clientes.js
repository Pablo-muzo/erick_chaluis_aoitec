// ── CLIENTES ────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM clientes ORDER BY nombre');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  const { nombre, email, telefono, direccion, documento, tipo_documento } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const [r] = await db.query(
      'INSERT INTO clientes (nombre,email,telefono,direccion,documento,tipo_documento) VALUES (?,?,?,?,?,?)',
      [nombre, email, telefono, direccion, documento, tipo_documento || 'cedula']
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  const { nombre, email, telefono, direccion, documento } = req.body;
  try {
    await db.query('UPDATE clientes SET nombre=?,email=?,telefono=?,direccion=?,documento=? WHERE id=?',
      [nombre, email, telefono, direccion, documento, req.params.id]);
    res.json({ message: 'Actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Historial de compras de un cliente
router.get('/:id/historial', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM ventas WHERE cliente_id=? ORDER BY creado_en DESC', [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
