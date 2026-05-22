const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// GET todos los productos
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, c.nombre AS categoria, pr.nombre AS proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      WHERE p.activo = 1 ORDER BY p.nombre`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET alertas stock mínimo
router.get('/alertas-stock', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, codigo, nombre, stock, stock_minimo FROM productos WHERE stock <= stock_minimo AND activo=1 ORDER BY stock ASC'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET un producto
router.get('/:id', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM productos WHERE id=? AND activo=1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST crear producto
router.post('/', auth, async (req, res) => {
  const { codigo, nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock, stock_minimo } = req.body;
  if (!codigo || !nombre || !precio_venta) return res.status(400).json({ error: 'Campos requeridos' });
  try {
    const [r] = await db.query(
      'INSERT INTO productos (codigo,nombre,descripcion,categoria_id,proveedor_id,precio_compra,precio_venta,stock,stock_minimo) VALUES (?,?,?,?,?,?,?,?,?)',
      [codigo, nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock || 0, stock_minimo || 5]
    );
    res.status(201).json({ id: r.insertId, message: 'Producto creado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT actualizar producto
router.put('/:id', auth, async (req, res) => {
  const { nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock, stock_minimo } = req.body;
  try {
    await db.query(
      'UPDATE productos SET nombre=?,descripcion=?,categoria_id=?,proveedor_id=?,precio_compra=?,precio_venta=?,stock=?,stock_minimo=? WHERE id=?',
      [nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock, stock_minimo, req.params.id]
    );
    res.json({ message: 'Producto actualizado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE (desactivar) producto
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('UPDATE productos SET activo=0 WHERE id=?', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
