const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Resumen dashboard — SQLite usa date('now'), strftime, etc.
router.get('/dashboard', auth, async (req, res) => {
  try {
    const [[ventas_hoy]] = await db.query(
      "SELECT COUNT(*) AS cantidad, IFNULL(SUM(total),0) AS total FROM ventas WHERE DATE(creado_en)=DATE('now') AND estado='completada'"
    );
    const [[ventas_mes]] = await db.query(
      "SELECT COUNT(*) AS cantidad, IFNULL(SUM(total),0) AS total FROM ventas WHERE strftime('%Y-%m', creado_en)=strftime('%Y-%m','now') AND estado='completada'"
    );
    const [[clientes]] = await db.query("SELECT COUNT(*) AS total FROM clientes");
    const [[productos]] = await db.query("SELECT COUNT(*) AS total FROM productos WHERE activo=1");
    const [[stock_bajo]] = await db.query("SELECT COUNT(*) AS total FROM productos WHERE stock<=stock_minimo AND activo=1");
    const [ventas_semana] = await db.query(
      "SELECT DATE(creado_en) AS fecha, IFNULL(SUM(total),0) AS total FROM ventas WHERE creado_en >= datetime('now','-7 days') AND estado='completada' GROUP BY DATE(creado_en) ORDER BY fecha"
    );
    const [top_productos] = await db.query(
      "SELECT p.nombre, SUM(d.cantidad) AS vendidos, SUM(d.subtotal) AS ingresos FROM detalle_ventas d JOIN productos p ON d.producto_id=p.id JOIN ventas v ON d.venta_id=v.id WHERE v.estado='completada' AND strftime('%Y-%m', v.creado_en)=strftime('%Y-%m','now') GROUP BY p.id ORDER BY vendidos DESC LIMIT 5"
    );
    res.json({ ventas_hoy, ventas_mes, clientes: clientes.total, productos: productos.total, stock_bajo: stock_bajo.total, ventas_semana, top_productos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Reporte ventas por período
router.get('/ventas', auth, async (req, res) => {
  const { desde, hasta } = req.query;
  try {
    const [rows] = await db.query(
      "SELECT DATE(creado_en) AS fecha, COUNT(*) AS cantidad, SUM(total) AS total, SUM(impuesto) AS impuestos FROM ventas WHERE DATE(creado_en) BETWEEN ? AND ? AND estado='completada' GROUP BY DATE(creado_en) ORDER BY fecha",
      [desde || '2024-01-01', hasta || new Date().toISOString().split('T')[0]]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
