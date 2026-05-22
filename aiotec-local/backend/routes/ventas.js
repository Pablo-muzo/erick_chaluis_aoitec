const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// GET ventas con filtros
router.get('/', auth, async (req, res) => {
  const { desde, hasta, estado } = req.query;
  let q = `SELECT v.*, c.nombre AS cliente_nombre, u.nombre AS vendedor
           FROM ventas v
           LEFT JOIN clientes c ON v.cliente_id = c.id
           JOIN usuarios u ON v.usuario_id = u.id WHERE 1=1`;
  const params = [];
  if (desde) { q += ' AND DATE(v.creado_en) >= ?'; params.push(desde); }
  if (hasta) { q += ' AND DATE(v.creado_en) <= ?'; params.push(hasta); }
  if (estado) { q += ' AND v.estado = ?'; params.push(estado); }
  q += ' ORDER BY v.creado_en DESC LIMIT 200';
  try {
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET una venta con detalle
router.get('/:id', auth, async (req, res) => {
  try {
    const [venta] = await db.query(`
      SELECT v.*, c.nombre AS cliente_nombre, c.documento, c.email AS cliente_email,
             u.nombre AS vendedor
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = ?`, [req.params.id]);
    if (!venta.length) return res.status(404).json({ error: 'No encontrada' });
    const [detalle] = await db.query(`
      SELECT d.*, p.nombre AS producto, p.codigo
      FROM detalle_ventas d JOIN productos p ON d.producto_id = p.id
      WHERE d.venta_id = ?`, [req.params.id]);
    res.json({ ...venta[0], detalle });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST crear venta
router.post('/', auth, async (req, res) => {
  const { cliente_id, items, metodo_pago, descuento, notas } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'Sin productos' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    // Calcular totales
    let subtotal = 0;
    for (const item of items) subtotal += item.precio_unitario * item.cantidad;
    const desc = descuento || 0;
    const impuesto = (subtotal - desc) * 0.12; // IVA 12%
    const total = subtotal - desc + impuesto;
    // Número de factura
    const [last] = await conn.query("SELECT COUNT(*) AS cnt FROM ventas");
    const num = 'FAC-' + String(last[0].cnt + 1).padStart(6, '0');
    const [res2] = await conn.query(
      'INSERT INTO ventas (numero_factura,cliente_id,usuario_id,subtotal,descuento,impuesto,total,metodo_pago,notas) VALUES (?,?,?,?,?,?,?,?,?)',
      [num, cliente_id || null, req.user.id, subtotal, desc, impuesto, total, metodo_pago || 'efectivo', notas || '']
    );
    const venta_id = res2.insertId;
    for (const item of items) {
      await conn.query(
        'INSERT INTO detalle_ventas (venta_id,producto_id,cantidad,precio_unitario,subtotal) VALUES (?,?,?,?,?)',
        [venta_id, item.producto_id, item.cantidad, item.precio_unitario, item.precio_unitario * item.cantidad]
      );
    }
    await conn.commit();
    res.status(201).json({ id: venta_id, numero_factura: num, total, message: 'Venta registrada' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
});

// PUT anular venta
router.put('/:id/anular', auth, async (req, res) => {
  try {
    await db.query("UPDATE ventas SET estado='anulada' WHERE id=?", [req.params.id]);
    res.json({ message: 'Venta anulada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
