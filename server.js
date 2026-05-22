require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

// ── Inicializar DB si no existe ─────────────────────────────
const dataDir = path.join(__dirname, 'data');
const dbFile  = path.join(dataDir, 'techstore.db');
if (!fs.existsSync(dbFile)) {
  console.log('⚙️  Base de datos no encontrada. Ejecutando inicialización...');
  require('./scripts/init-db');
}

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── API ─────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/productos',   require('./routes/productos'));
app.use('/api/ventas',      require('./routes/ventas'));
app.use('/api/clientes',    require('./routes/clientes'));
app.use('/api/proveedores', require('./routes/proveedores'));
app.use('/api/reportes',    require('./routes/reportes'));
app.use('/api/compras',     require('./routes/compras'));

// ── Servir Frontend estático ────────────────────────────────
const frontendDir = path.join(__dirname, '..', 'frontend');
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  // SPA fallback: rutas no-API devuelven index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

app.get('/api', (req, res) => res.json({ status: 'TechStore API corriendo con SQLite' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/`);
  console.log(`📦 API:      http://localhost:${PORT}/api`);
});
