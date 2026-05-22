const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// GET historial de compras
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT dc.*,
             p.nombre  AS producto_nombre,
             p.codigo  AS producto_codigo,
             pr.nombre AS proveedor_nombre,
             u.nombre  AS usuario_nombre
      FROM detalle_compras dc
      JOIN productos   p  ON dc.producto_id  = p.id
      JOIN proveedores pr ON dc.proveedor_id = pr.id
      JOIN usuarios    u  ON dc.usuario_id   = u.id
      ORDER BY dc.creado_en DESC
      LIMIT 300`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST registrar ingreso por compra
router.post('/', auth, async (req, res) => {
  const { producto_id, proveedor_id, cantidad, costo_unitario, numero_comprobante, notas } = req.body;

  if (!producto_id || !proveedor_id || !cantidad || cantidad <= 0)
    return res.status(400).json({ error: 'Faltan campos requeridos: producto, proveedor y cantidad.' });
  if (!numero_comprobante || !numero_comprobante.trim())
    return res.status(400).json({ error: 'El número de factura / comprobante es obligatorio.' });
  if (costo_unitario !== undefined && parseFloat(costo_unitario) < 0)
    return res.status(400).json({ error: 'El costo unitario no puede ser negativo.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const costo = parseFloat(costo_unitario) || 0;
    const total = costo * parseInt(cantidad);

    // 1. Insertar en detalle_compras
    const [r] = await conn.query(
      `INSERT INTO detalle_compras
         (producto_id, proveedor_id, usuario_id, cantidad, costo_unitario, total, numero_comprobante, notas)
       VALUES (?,?,?,?,?,?,?,?)`,
      [producto_id, proveedor_id, req.user.id, cantidad, costo, total, numero_comprobante || null, notas || null]
    );

    // 2. Incrementar stock (SUMA, no sobreescritura)
    await conn.query(
      'UPDATE productos SET stock = stock + ? WHERE id = ?',
      [parseInt(cantidad), producto_id]
    );

    // 3. Registrar en movimientos_inventario para auditoría
    await conn.query(
      `INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, usuario_id, referencia_id)
       VALUES (?, 'entrada', ?, ?, ?, ?)`,
      [producto_id, cantidad, `Compra a proveedor${numero_comprobante ? ' - Comp: ' + numero_comprobante : ''}`, req.user.id, r.insertId]
    );

    await conn.commit();
    res.status(201).json({ id: r.insertId, message: 'Ingreso registrado correctamente', total });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

module.exports = router;
