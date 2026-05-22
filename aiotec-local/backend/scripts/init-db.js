/**
 * init-db.js
 * Inicializa la base de datos SQLite con el esquema y datos de prueba.
 * Ejecutar UNA sola vez: node scripts/init-db.js
 * Si la DB ya existe, no hace nada para no borrar datos reales.
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'techstore.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Verificar si ya fue inicializada
const tablesExist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'").get();
if (tablesExist) {
  console.log('⚠️  La base de datos ya existe. Para reinicializar, borra el archivo data/techstore.db');
  process.exit(0);
}

console.log('🚀 Creando esquema...');

db.exec(`
-- USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT CHECK(rol IN ('admin','vendedor','cajero')) DEFAULT 'vendedor',
  activo INTEGER DEFAULT 1,
  reset_token TEXT DEFAULT NULL,
  reset_token_expiry TEXT DEFAULT NULL,
  creado_en TEXT DEFAULT (datetime('now'))
);

-- CATEGORIAS
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT
);

-- PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  activo INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now'))
);

-- PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria_id INTEGER,
  proveedor_id INTEGER,
  precio_compra REAL NOT NULL DEFAULT 0,
  precio_venta REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_minimo INTEGER NOT NULL DEFAULT 5,
  imagen_url TEXT,
  activo INTEGER DEFAULT 1,
  creado_en TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

-- CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  direccion TEXT,
  documento TEXT,
  tipo_documento TEXT CHECK(tipo_documento IN ('cedula','ruc','pasaporte')) DEFAULT 'cedula',
  creado_en TEXT DEFAULT (datetime('now'))
);

-- VENTAS
CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_factura TEXT NOT NULL UNIQUE,
  cliente_id INTEGER,
  usuario_id INTEGER NOT NULL,
  subtotal REAL NOT NULL,
  descuento REAL DEFAULT 0,
  impuesto REAL DEFAULT 0,
  total REAL NOT NULL,
  metodo_pago TEXT CHECK(metodo_pago IN ('efectivo','tarjeta','transferencia','mixto')) DEFAULT 'efectivo',
  estado TEXT CHECK(estado IN ('completada','anulada','pendiente')) DEFAULT 'completada',
  notas TEXT,
  creado_en TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- DETALLE VENTAS
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precio_unitario REAL NOT NULL,
  descuento REAL DEFAULT 0,
  subtotal REAL NOT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

-- MOVIMIENTOS INVENTARIO
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  tipo TEXT CHECK(tipo IN ('entrada','salida','ajuste')) NOT NULL,
  cantidad INTEGER NOT NULL,
  motivo TEXT,
  usuario_id INTEGER,
  referencia_id INTEGER,
  creado_en TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- SESIONES CAJA
CREATE TABLE IF NOT EXISTS sesiones_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  saldo_inicial REAL NOT NULL,
  saldo_final REAL,
  total_efectivo REAL DEFAULT 0,
  total_tarjeta REAL DEFAULT 0,
  total_transferencia REAL DEFAULT 0,
  estado TEXT CHECK(estado IN ('abierta','cerrada')) DEFAULT 'abierta',
  abierta_en TEXT DEFAULT (datetime('now')),
  cerrada_en TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- DETALLE COMPRAS
CREATE TABLE IF NOT EXISTS detalle_compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  proveedor_id INTEGER NOT NULL,
  usuario_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  costo_unitario REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  numero_comprobante TEXT DEFAULT NULL,
  notas TEXT DEFAULT NULL,
  creado_en TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (producto_id) REFERENCES productos(id),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- TRIGGER: descontar stock al insertar detalle de venta
CREATE TRIGGER IF NOT EXISTS after_detalle_venta_insert
AFTER INSERT ON detalle_ventas
BEGIN
  UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
  INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, referencia_id)
  VALUES (NEW.producto_id, 'salida', NEW.cantidad, 'Venta', NEW.venta_id);
END;
`);

console.log('✅ Esquema creado');

// ── SEED DATA ────────────────────────────────────────────

// Hash para password "12345678" (bcrypt)
const defaultHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // "password"
// Generar hash real para josechaluis0@gmail.com con 12345678
const adminHash = bcrypt.hashSync('12345678', 12);

console.log('📝 Insertando usuarios...');
const insertUser = db.prepare('INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?,?,?,?)');
const usersData = [
  ['Jose Chaluis', 'josechaluis0@gmail.com', adminHash, 'admin'],
  ['Admin Principal', 'admin@aiotec.com', defaultHash, 'admin'],
  ['Carlos Paredes', 'carlos@aiotec.com', defaultHash, 'vendedor'],
  ['María Fernández', 'maria@aiotec.com', defaultHash, 'vendedor'],
  ['Luis Castillo', 'luis@aiotec.com', defaultHash, 'cajero'],
];
for (const u of usersData) insertUser.run(...u);

console.log('📝 Insertando categorías...');
db.exec(`INSERT INTO categorias (nombre) VALUES
  ('Laptops'),('Computadoras de escritorio'),('Monitores'),
  ('Impresoras'),('Discos Duros HDD'),('Discos Sólidos SSD'),
  ('Memorias RAM'),('Procesadores CPU'),('Tarjetas Gráficas'),
  ('Pasta Térmica'),('Memorias USB'),('Periféricos'),('Accesorios');`);

console.log('📝 Insertando proveedores...');
db.exec(`INSERT INTO proveedores (nombre, contacto, telefono, email, direccion) VALUES
  ('TechDistrib Ecuador',  'Jorge Morales',    '0998-112233', 'ventas@techdistrib.ec',  'Av. América N32-45, Quito'),
  ('MegaPC Mayorista',     'Patricia Lara',    '0987-445566', 'patricia@megapc.com',    'Av. Eloy Alfaro 520, Quito'),
  ('ComputerWorld SA',     'Andrés Vásquez',   '0976-778899', 'andres@cworld.ec',       'Av. 6 de Diciembre, Quito'),
  ('InnovaSupplies',       'Sofía Benítez',    '0965-334455', 'sofia@innovasup.com',    'Calle Sucre 12-34, Ambato'),
  ('PeriféricosPro',       'Roberto Chávez',   '0954-667788', 'roberto@perifpro.ec',    'Av. Cevallos 8-15, Ambato');`);

console.log('📝 Insertando productos...');
// Deshabilitar trigger temporalmente para seed (no queremos descontar stock en seed)
db.pragma('foreign_keys = OFF');
db.exec(`DROP TRIGGER IF EXISTS after_detalle_venta_insert;`);

db.exec(`INSERT INTO productos (codigo, nombre, descripcion, categoria_id, proveedor_id, precio_compra, precio_venta, stock, stock_minimo) VALUES
  ('LAP001', 'Laptop HP 15-dy5131wm',       'Intel Core i5-1235U, 8GB RAM, 512GB SSD, 15.6" FHD',     1, 1,  480.00,  650.00, 6, 3),
  ('LAP002', 'Laptop Lenovo IdeaPad 3',     'AMD Ryzen 5 5500U, 8GB RAM, 256GB SSD, 15.6"',           1, 1,  390.00,  520.00, 4, 3),
  ('LAP003', 'Laptop ASUS VivoBook 14',     'Intel Core i3-1215U, 8GB RAM, 256GB SSD, 14" FHD',       1, 2,  310.00,  420.00, 3, 3),
  ('LAP004', 'Laptop Dell Inspiron 15',     'Intel Core i7-1255U, 16GB RAM, 512GB SSD, 15.6"',        1, 3,  680.00,  899.00, 2, 2),
  ('PC001',  'PC Ensamblada Core i5',       'Intel i5-12400, 16GB DDR4, 500GB SSD, Case ATX',         2, 2,  420.00,  580.00, 4, 2),
  ('PC002',  'PC Gamer Ryzen 5',            'Ryzen 5 5600X, 16GB DDR4, 1TB SSD, GTX 1660 Super',      2, 3,  780.00, 1050.00, 2, 2),
  ('MON001', 'Monitor LG 24" Full HD',      'IPS 24" 1920x1080 75Hz, HDMI+VGA',                       3, 1,  115.00,  165.00, 5, 4),
  ('MON002', 'Monitor Samsung 27" Curvo',   'VA Curved 27" 1080p 144Hz, FreeSync',                    3, 2,  190.00,  265.00, 4, 3),
  ('IMP001', 'Impresora Epson EcoTank L3250','Multifuncional, WiFi, Sistema de Tinta Continua',        4, 4,  145.00,  210.00, 4, 3),
  ('IMP002', 'Impresora HP LaserJet M110w', 'Laser Monocromatica, WiFi, USB',                         4, 4,  125.00,  175.00, 5, 2),
  ('HDD001', 'Disco Duro Seagate 1TB',      '3.5" SATA 7200RPM, cache 256MB',                         5, 1,   38.00,   58.00, 12, 5),
  ('HDD002', 'Disco Duro WD 2TB Blue',      '3.5" SATA 5400RPM, NAS/Desktop',                         5, 1,   52.00,   78.00, 14, 5),
  ('SSD001', 'SSD Kingston 480GB',          'SATA III 2.5", 550MB/s lectura',                          6, 2,   28.00,   45.00, 10, 6),
  ('SSD002', 'SSD Samsung 870 EVO 1TB',     'SATA III 2.5", 560MB/s, MLC V-NAND',                     6, 3,   68.00,   98.00, 8, 4),
  ('SSD003', 'NVMe WD Black SN770 500GB',   'PCIe Gen4, 5150MB/s lectura, M.2 2280',                  6, 3,   45.00,   72.00, 9, 4),
  ('RAM001', 'RAM Kingston 8GB DDR4 3200',  'DIMM, 3200MHz, CL22, Desktop',                            7, 2,   18.00,   30.00, 15, 8),
  ('RAM002', 'RAM Corsair 16GB DDR4 3600',  'Vengeance RGB, 2x8GB Kit, CL18',                          7, 3,   42.00,   65.00, 10, 5),
  ('CPU001', 'Procesador Intel Core i5-12400','12th Gen, 6C/12T, 4.4GHz boost, LGA1700',              8, 1,  148.00,  210.00, 4, 2),
  ('CPU002', 'Procesador AMD Ryzen 5 5600X','6C/12T, 4.6GHz boost, PCIe 4.0, AM4',                    8, 1,  138.00,  195.00, 3, 2),
  ('GPU001', 'Tarjeta Grafica RTX 3060 12GB','NVIDIA, GDDR6, HDMI+3xDP, 192-bit',                    9, 3,  280.00,  390.00, 2, 2),
  ('GPU002', 'Tarjeta Grafica RX 6600 8GB', 'AMD Radeon, GDDR6, PCIe 4.0, 128-bit',                  9, 2,  200.00,  285.00, 2, 2),
  ('PAS001', 'Pasta Termica Noctua NT-H1',  '3.5g, alta conductividad, no electrica',                 10, 4,   4.50,    9.00, 28,10),
  ('PAS002', 'Pasta Termica Arctic MX-6',   '4g, grafeno, >12.5 W/mK',                               10, 4,   5.00,   11.00, 24,10),
  ('USB001', 'Memoria USB Kingston 64GB',   'USB 3.2 Gen1, 130MB/s, DataTraveler',                   11, 2,   6.50,   13.00, 30,10),
  ('USB002', 'Memoria USB SanDisk 128GB',   'Ultra USB 3.0, 130MB/s, retractil',                     11, 2,   9.00,   18.00, 25,10),
  ('PER001', 'Teclado Mecanico Redragon K552','TKL, switches Red, RGB, USB',                         12, 5,   28.00,   48.00, 10, 5),
  ('PER002', 'Mouse Inalambrico Logitech M310','2.4GHz, 1000dpi, bateria AA',                        12, 5,   14.00,   24.00, 14, 6),
  ('PER003', 'Audifonos Gaming HyperX Cloud Stinger','7.1 Virtual, USB, microfono abatible',         12, 5,   35.00,   58.00, 6, 3),
  ('ACC001', 'Hub USB-C 7 en 1',            'USB3.0x3, HDMI 4K, SD/TF, PD 100W',                    13, 4,   12.00,   22.00, 18, 6),
  ('ACC002', 'Mochila Laptop 15.6" Targus', 'Compartimento acolchado, impermeable, USB carga',       13, 5,   22.00,   38.00, 11, 4);`);

console.log('📝 Insertando clientes...');
db.exec(`INSERT INTO clientes (nombre, email, telefono, direccion, documento, tipo_documento, creado_en) VALUES
  ('Jhon Torres',        'jhon.torres@gmail.com',     '0998-112233', 'Av. Cevallos 3-45, Ambato',        '1803191160', 'cedula',    '2024-11-05 09:15:00'),
  ('Ana Martinez',       'ana.martinez@hotmail.com',  '0987-223344', 'Calle Bolivar 12-08, Ambato',      '1801234567', 'cedula',    '2024-11-12 10:30:00'),
  ('Empresa DataSoft',   'compras@datasoft.ec',       '032-445566',  'Parque Industrial, Ambato',        '1891234560001','ruc',     '2024-11-20 14:00:00'),
  ('Miguel Pacheco',     'miguel.p@yahoo.com',        '0976-334455', 'Los Andes, Ambato',                '1805678901', 'cedula',    '2024-11-28 11:20:00'),
  ('Sofia Ramos',        'sofia.r@gmail.com',         '0965-445566', 'Av. Miraflores 7-23, Ambato',      '1807890123', 'cedula',    '2024-12-03 09:45:00'),
  ('Tech Solutions SAS', 'admin@techsolutions.ec',    '032-556677',  'Centro Comercial Caracol, Quito',  '1790123456001','ruc',     '2024-12-10 15:30:00'),
  ('Rodrigo Vega',       'rodrigo.v@outlook.com',     '0954-556677', 'Huachi Grande, Ambato',            '1809012345', 'cedula',    '2024-12-15 10:00:00'),
  ('Valentina Cruz',     'val.cruz@gmail.com',        '0943-667788', 'Picaihua, Ambato',                 '1810123456', 'cedula',    '2024-12-20 16:15:00'),
  ('Colegio San Alfonso','administracion@sanalfonso.ec','032-667788', 'Av. El Rey s/n, Ambato',          '1891567890001','ruc',     '2025-01-08 08:30:00'),
  ('Pedro Salazar',      'pedro.salazar@gmail.com',   '0932-778899', 'Ficoa, Ambato',                    '1811234567', 'cedula',    '2025-01-15 11:45:00'),
  ('Laura Hidalgo',      'laura.h@hotmail.com',       '0921-889900', 'Izamba, Ambato',                   '1812345678', 'cedula',    '2025-01-22 13:00:00'),
  ('Inversiones MegaTec','contacto@megatec.ec',       '032-778899',  'Av. Indoamerica km 2, Ambato',     '1892345678001','ruc',     '2025-02-05 09:00:00'),
  ('Diego Andrade',      'diego.a@gmail.com',         '0910-990011', 'Cdla. Espana, Ambato',             '1813456789', 'cedula',    '2025-02-12 14:30:00'),
  ('Camila Flores',      'camila.f@yahoo.com',        '0999-001122', 'Pishilata, Ambato',                '1814567890', 'cedula',    '2025-02-18 10:15:00'),
  ('Municipio Ambato',   'tic@municipioambato.gob.ec','032-889900',  'Av. Rodrigo Pachano s/n, Ambato',  '1860012345001','ruc',     '2025-03-03 08:00:00'),
  ('Esteban Mora',       'esteban.m@gmail.com',       '0988-112234', 'Juan Benigno Vela, Ambato',        '1815678901', 'cedula',    '2025-03-10 12:00:00'),
  ('Natalia Pena',       'natalia.p@gmail.com',       '0977-223345', 'Av. Colombia 5-67, Ambato',        '1816789012', 'cedula',    '2025-03-20 15:45:00'),
  ('Hospital IESS Ambato','informatica@iess-amb.gob.ec','032-990011', 'Av. Pasteur s/n, Ambato',         '1868901234001','ruc',     '2025-04-02 09:30:00'),
  ('Kevin Espin',        'kevin.e@hotmail.com',       '0966-334456', 'Quisapincha, Ambato',              '1817890123', 'cedula',    '2025-04-08 11:00:00'),
  ('Mariana Romero',     'mariana.r@gmail.com',       '0955-445567', 'El Labrador, Ambato',              '1818901234', 'cedula',    '2025-04-15 14:20:00');`);

console.log('📝 Insertando ventas y detalles...');

// Insertar ventas (sin trigger activo durante seed)
db.exec(`INSERT INTO ventas (numero_factura, cliente_id, usuario_id, subtotal, descuento, impuesto, total, metodo_pago, estado, creado_en) VALUES
  ('FAC-000001', 1,  3, 650.00,   0.00,  78.00,  728.00, 'efectivo',      'completada', '2024-11-06 10:20:00'),
  ('FAC-000002', 2,  4, 165.00,   0.00,  19.80,  184.80, 'tarjeta',       'completada', '2024-11-08 14:35:00'),
  ('FAC-000003', 3,  3, 1890.00, 90.00, 216.00, 2016.00, 'transferencia', 'completada', '2024-11-12 09:00:00'),
  ('FAC-000004', 4,  4,  520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2024-11-15 11:45:00'),
  ('FAC-000005', 1,  3,  175.00,  0.00,  21.00,  196.00, 'tarjeta',       'completada', '2024-11-20 16:10:00'),
  ('FAC-000006', 5,  4,  420.00,  20.00, 48.00,  448.00, 'efectivo',      'completada', '2024-11-22 10:30:00'),
  ('FAC-000007', 2,  3,  265.00,  0.00,  31.80,  296.80, 'tarjeta',       'completada', '2024-11-25 13:00:00'),
  ('FAC-000008', 6,  4, 2100.00,100.00, 240.00, 2240.00, 'transferencia', 'completada', '2024-11-28 09:30:00'),
  ('FAC-000009',  7,  3,  195.00,  0.00,  23.40,  218.40, 'efectivo',      'completada', '2024-12-02 10:00:00'),
  ('FAC-000010',  1,  4,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2024-12-04 11:30:00'),
  ('FAC-000011',  8,  3,  899.00,  50.00,103.80,  952.80, 'efectivo',      'completada', '2024-12-06 14:00:00'),
  ('FAC-000012',  2,  4,  210.00,  0.00,  25.20,  235.20, 'tarjeta',       'completada', '2024-12-09 09:45:00'),
  ('FAC-000013',  3,  3, 3150.00,150.00, 360.00, 3360.00, 'transferencia', 'completada', '2024-12-11 10:00:00'),
  ('FAC-000014',  5,  4,  520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2024-12-13 15:20:00'),
  ('FAC-000015',  4,  3,  390.00,  0.00,  46.80,  436.80, 'tarjeta',       'completada', '2024-12-16 11:00:00'),
  ('FAC-000016',  1,  4,  285.00,  0.00,  34.20,  319.20, 'efectivo',      'completada', '2024-12-18 10:30:00'),
  ('FAC-000017',  6,  3, 1890.00, 90.00, 216.00, 2016.00, 'transferencia', 'completada', '2024-12-20 09:00:00'),
  ('FAC-000018',  7,  4,  130.00,  0.00,  15.60,  145.60, 'efectivo',      'completada', '2024-12-23 12:00:00'),
  ('FAC-000019',  8,  3,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2024-12-26 10:00:00'),
  ('FAC-000020',  2,  4,  420.00,  0.00,  50.40,  470.40, 'efectivo',      'completada', '2024-12-28 14:30:00'),
  ('FAC-000021',  9,  3, 4200.00,200.00, 480.00, 4480.00, 'transferencia', 'completada', '2025-01-09 09:00:00'),
  ('FAC-000022',  1,  4,  520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2025-01-10 10:30:00'),
  ('FAC-000023', 10,  3,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2025-01-13 11:00:00'),
  ('FAC-000024',  2,  4,  195.00,  0.00,  23.40,  218.40, 'efectivo',      'completada', '2025-01-15 14:20:00'),
  ('FAC-000025',  5,  3, 1050.00, 50.00, 120.00, 1120.00, 'tarjeta',       'completada', '2025-01-17 09:45:00'),
  ('FAC-000026', 11,  4,  420.00,  0.00,  50.40,  470.40, 'efectivo',      'completada', '2025-01-20 13:30:00'),
  ('FAC-000027',  4,  3,  390.00,  0.00,  46.80,  436.80, 'tarjeta',       'completada', '2025-01-22 10:00:00'),
  ('FAC-000028',  6,  4, 2940.00,140.00, 336.00, 3136.00, 'transferencia', 'completada', '2025-01-24 09:00:00'),
  ('FAC-000029',  1,  3,  265.00,  0.00,  31.80,  296.80, 'efectivo',      'completada', '2025-01-27 15:00:00'),
  ('FAC-000030', 10,  4,  210.00,  0.00,  25.20,  235.20, 'tarjeta',       'completada', '2025-01-29 11:30:00'),
  ('FAC-000031', 12,  3, 5200.00,250.00, 594.00, 5544.00, 'transferencia', 'completada', '2025-02-06 09:00:00'),
  ('FAC-000032',  1,  4,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2025-02-07 10:30:00'),
  ('FAC-000033', 13,  3,  520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2025-02-10 11:00:00'),
  ('FAC-000034',  2,  4,  899.00, 50.00, 102.00,  951.00, 'tarjeta',       'completada', '2025-02-12 14:00:00'),
  ('FAC-000035', 14,  3,  265.00,  0.00,  31.80,  296.80, 'efectivo',      'completada', '2025-02-14 09:30:00'),
  ('FAC-000036',  5,  4,  390.00,  0.00,  46.80,  436.80, 'tarjeta',       'completada', '2025-02-17 13:00:00'),
  ('FAC-000037', 11,  3,  210.00,  0.00,  25.20,  235.20, 'efectivo',      'completada', '2025-02-19 10:45:00'),
  ('FAC-000038',  3,  4, 3900.00,200.00, 444.00, 4144.00, 'transferencia', 'completada', '2025-02-21 09:00:00'),
  ('FAC-000039',  4,  3,  420.00,  0.00,  50.40,  470.40, 'efectivo',      'completada', '2025-02-24 14:30:00'),
  ('FAC-000040',  1,  4,  195.00,  0.00,  23.40,  218.40, 'tarjeta',       'completada', '2025-02-26 11:00:00'),
  ('FAC-000041', 15,  3, 7800.00,400.00, 888.00, 8288.00, 'transferencia', 'completada', '2025-03-04 09:00:00'),
  ('FAC-000042',  1,  4,  899.00,  0.00, 107.88,1006.88, 'tarjeta',        'completada', '2025-03-05 10:30:00'),
  ('FAC-000043', 16,  3,  520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2025-03-07 11:00:00'),
  ('FAC-000044',  5,  4,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2025-03-10 14:00:00'),
  ('FAC-000045',  2,  3,  390.00,  0.00,  46.80,  436.80, 'efectivo',      'completada', '2025-03-12 09:30:00'),
  ('FAC-000046', 17,  4,  265.00,  0.00,  31.80,  296.80, 'efectivo',      'completada', '2025-03-14 13:00:00'),
  ('FAC-000047',  1,  3,  210.00,  0.00,  25.20,  235.20, 'tarjeta',       'completada', '2025-03-17 10:45:00'),
  ('FAC-000048',  6,  4, 4500.00,200.00, 516.00, 4816.00, 'transferencia', 'completada', '2025-03-19 09:00:00'),
  ('FAC-000049', 13,  3,  420.00,  0.00,  50.40,  470.40, 'efectivo',      'completada', '2025-03-21 14:30:00'),
  ('FAC-000050',  4,  4,  195.00,  0.00,  23.40,  218.40, 'efectivo',      'completada', '2025-03-24 11:00:00'),
  ('FAC-000051', 10,  3,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2025-03-26 10:00:00'),
  ('FAC-000052',  2,  4,  285.00,  0.00,  34.20,  319.20, 'efectivo',      'completada', '2025-03-28 15:00:00'),
  ('FAC-000053', 18,  3, 9600.00,500.00,1092.00,10192.00,'transferencia',  'completada', '2025-04-03 09:00:00'),
  ('FAC-000054',  1,  4,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2025-04-04 10:30:00'),
  ('FAC-000055', 19,  3,  420.00,  0.00,  50.40,  470.40, 'efectivo',      'completada', '2025-04-07 11:00:00'),
  ('FAC-000056',  5,  4,  899.00, 50.00, 102.00,  951.00, 'tarjeta',       'completada', '2025-04-09 14:00:00'),
  ('FAC-000057',  2,  3,  520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2025-04-11 09:30:00'),
  ('FAC-000058', 20,  4,  390.00,  0.00,  46.80,  436.80, 'tarjeta',       'completada', '2025-04-14 13:00:00'),
  ('FAC-000059',  1,  3,  265.00,  0.00,  31.80,  296.80, 'efectivo',      'completada', '2025-04-16 10:45:00'),
  ('FAC-000060',  3,  4, 5600.00,280.00, 639.60, 5959.60, 'transferencia', 'completada', '2025-04-18 09:00:00'),
  ('FAC-000061', 16,  3,  210.00,  0.00,  25.20,  235.20, 'efectivo',      'completada', '2025-04-21 14:30:00'),
  ('FAC-000062',  4,  4,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2025-04-23 11:00:00'),
  ('FAC-000063', 13,  3,  195.00,  0.00,  23.40,  218.40, 'efectivo',      'completada', '2025-04-25 10:00:00'),
  ('FAC-000064', 10,  4,  420.00,  0.00,  50.40,  470.40, 'efectivo',      'completada', '2025-04-28 15:00:00'),
  ('FAC-000065',  1,  3,  899.00,  0.00, 107.88,1006.88,  'tarjeta',       'completada', '2025-05-02 10:00:00'),
  ('FAC-000066', 11,  4,  650.00,  0.00,  78.00,  728.00, 'efectivo',      'completada', '2025-05-05 11:30:00'),
  ('FAC-000067',  5,  3,  420.00,  0.00,  50.40,  470.40, 'tarjeta',       'completada', '2025-05-07 09:00:00'),
  ('FAC-000068',  6,  4, 6300.00,300.00, 720.00, 6720.00, 'transferencia', 'completada', '2025-05-09 09:00:00'),
  ('FAC-000069', 14,  3,  265.00,  0.00,  31.80,  296.80, 'efectivo',      'completada', '2025-05-12 14:00:00'),
  ('FAC-000070',  2,  4,  390.00,  0.00,  46.80,  436.80, 'tarjeta',       'completada', '2025-05-14 10:30:00'),
  ('FAC-000071',  1,  3,  520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2025-05-16 11:00:00'),
  ('FAC-000072', 16,  4,  195.00,  0.00,  23.40,  218.40, 'efectivo',      'completada', '2025-05-19 13:00:00'),
  ('FAC-000073', 10,  3,  650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2025-05-21 10:00:00'),
  ('FAC-000074',  3,  4, 2800.00,140.00, 319.20, 2979.20, 'transferencia', 'completada', '2025-05-23 09:30:00'),
  ('FAC-000075',  1,  3, 650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2026-05-02 10:15:00'),
  ('FAC-000076',  5,  4, 420.00,  0.00,  50.40,  470.40, 'efectivo',      'completada', '2026-05-03 11:30:00'),
  ('FAC-000077',  2,  3, 899.00, 50.00, 102.00,  951.00, 'tarjeta',       'completada', '2026-05-05 09:00:00'),
  ('FAC-000078',  6,  4,3500.00,175.00, 399.00, 3724.00, 'transferencia', 'completada', '2026-05-06 09:00:00'),
  ('FAC-000079', 13,  3, 520.00,  0.00,  62.40,  582.40, 'efectivo',      'completada', '2026-05-07 14:00:00'),
  ('FAC-000080',  1,  4, 390.00,  0.00,  46.80,  436.80, 'tarjeta',       'completada', '2026-05-08 10:30:00'),
  ('FAC-000081', 10,  3, 265.00,  0.00,  31.80,  296.80, 'efectivo',      'completada', '2026-05-09 11:00:00'),
  ('FAC-000082',  4,  4, 650.00,  0.00,  78.00,  728.00, 'tarjeta',       'completada', '2026-05-10 13:00:00'),
  ('FAC-000083',  1,  3, 210.00,  0.00,  25.20,  235.20, 'efectivo',      'completada', '2026-05-11 10:00:00'),
  ('FAC-000084',  2,  4, 195.00,  0.00,  23.40,  218.40, 'efectivo',      'completada', '2026-05-12 09:30:00');`);

// Insertar todos los detalles de venta sin trigger
db.exec(`INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
  (1,  1, 1, 650.00,  650.00),
  (2,  7, 1, 165.00,  165.00),
  (3,  1, 2, 650.00, 1300.00),(3,  7, 2, 165.00,  330.00),(3, 13, 4,  45.00,  180.00),(3, 16, 2,  30.00,   60.00),
  (4,  2, 1, 520.00,  520.00),
  (5,  9, 1, 175.00,  175.00),
  (6,  3, 1, 420.00,  420.00),
  (7,  8, 1, 265.00,  265.00),
  (8,  1, 1, 650.00,  650.00),(8,  5, 1, 580.00,  580.00),(8,  7, 2, 165.00,  330.00),(8, 16, 4,  30.00,  120.00),(8, 26, 2,  48.00,   96.00),
  (9, 27, 1,  24.00,   24.00),(9, 28, 1,  58.00,   58.00),(9, 29, 1,  22.00,   22.00),(9, 16, 3,  30.00,   90.00),
  (10,  1, 1, 650.00,  650.00),
  (11,  4, 1, 899.00,  899.00),
  (12,  9, 1, 210.00,  210.00),
  (13,  5, 2, 580.00, 1160.00),(13,  7, 4, 165.00,  660.00),(13, 13, 6,  45.00,  270.00),(13, 16, 4,  30.00,  120.00),
  (14,  2, 1, 520.00,  520.00),
  (15,  2, 1, 390.00,  390.00),
  (16,  8, 1, 265.00,  265.00),(16, 22, 2,   9.00,   18.00),
  (17,  1, 1, 650.00,  650.00),(17,  6, 1,1050.00, 1050.00),(17, 13, 4,  45.00,  180.00),
  (18, 24, 2,  13.00,   26.00),(18, 25, 2,  18.00,   36.00),(18, 29, 3,  22.00,   66.00),
  (19,  1, 1, 650.00,  650.00),
  (20,  3, 1, 420.00,  420.00),
  (21,  7, 6, 165.00,  990.00),(21,  9, 3, 210.00,  630.00),(21, 16, 8,  30.00,  240.00),(21, 13, 6,  45.00,  270.00),(21, 24,10,  13.00,  130.00),
  (22,  2, 1, 520.00,  520.00),
  (23,  1, 1, 650.00,  650.00),
  (24, 27, 1,  48.00,   48.00),(24, 28, 1,  24.00,   24.00),(24, 22, 3,   9.00,   27.00),(24, 29, 2,  22.00,   44.00),
  (25,  6, 1,1050.00, 1050.00),
  (26,  3, 1, 420.00,  420.00),
  (27,  2, 1, 390.00,  390.00),
  (28,  4, 1, 899.00,  899.00),(28,  5, 1, 580.00,  580.00),(28,  7, 3, 165.00,  495.00),(28, 13, 6,  45.00,  270.00),
  (29,  8, 1, 265.00,  265.00),
  (30,  9, 1, 210.00,  210.00),
  (31,  1, 4, 650.00, 2600.00),(31,  7, 4, 165.00,  660.00),(31, 13, 6,  45.00,  270.00),(31, 16, 6,  30.00,  180.00),(31, 26, 4,  48.00,  192.00),(31, 27, 4,  24.00,   96.00),
  (32,  1, 1, 650.00,  650.00),
  (33,  2, 1, 520.00,  520.00),
  (34,  4, 1, 899.00,  899.00),
  (35,  8, 1, 265.00,  265.00),
  (36,  2, 1, 390.00,  390.00),
  (37,  9, 1, 210.00,  210.00),
  (38,  5, 2, 580.00, 1160.00),(38,  6, 1,1050.00, 1050.00),(38, 20, 1, 390.00,  390.00),(38, 21, 1, 285.00,  285.00),(38, 16, 6,  30.00,  180.00),(38, 17, 3,  65.00,  195.00),
  (39,  3, 1, 420.00,  420.00),
  (40, 27, 1,  48.00,   48.00),(40, 28, 1,  24.00,   24.00),(40, 22, 3,   9.00,   27.00),(40, 29, 2,  22.00,   44.00),(40, 23, 1,  11.00,   11.00),
  (41,  7, 8, 165.00, 1320.00),(41,  9, 5, 210.00, 1050.00),(41, 10, 6, 175.00, 1050.00),(41,  1, 2, 650.00, 1300.00),(41, 16,10,  30.00,  300.00),(41, 13, 6,  45.00,  270.00),(41, 24,10,  13.00,  130.00),
  (42,  4, 1, 899.00,  899.00),
  (43,  2, 1, 520.00,  520.00),
  (44,  1, 1, 650.00,  650.00),
  (45,  2, 1, 390.00,  390.00),
  (46,  8, 1, 265.00,  265.00),
  (47,  9, 1, 210.00,  210.00),
  (48,  6, 2,1050.00, 2100.00),(48,  5, 1, 580.00,  580.00),(48, 20, 1, 390.00,  390.00),(48, 16, 6,  30.00,  180.00),(48, 17, 3,  65.00,  195.00),(48, 13, 6,  45.00,  270.00),(48, 26, 3,  48.00,  144.00),
  (49,  3, 1, 420.00,  420.00),
  (50, 27, 1,  48.00,   48.00),(50, 28, 1,  24.00,   24.00),(50, 22, 3,   9.00,   27.00),(50, 29, 2,  22.00,   44.00),
  (51,  1, 1, 650.00,  650.00),
  (52,  8, 1, 265.00,  265.00),(52, 22, 2,   9.00,   18.00),
  (53, 18, 4, 210.00,  840.00),(53, 19, 4, 195.00,  780.00),(53,  7,10, 165.00, 1650.00),(53, 16,10,  30.00,  300.00),(53, 13,10,  45.00,  450.00),(53, 17, 5,  65.00,  325.00),(53,  9, 3, 210.00,  630.00),(53, 24,20,  13.00,  260.00),
  (54,  1, 1, 650.00,  650.00),
  (55,  3, 1, 420.00,  420.00),
  (56,  4, 1, 899.00,  899.00),
  (57,  2, 1, 520.00,  520.00),
  (58,  2, 1, 390.00,  390.00),
  (59,  8, 1, 265.00,  265.00),
  (60,  1, 2, 650.00, 1300.00),(60,  6, 2,1050.00, 2100.00),(60, 20, 1, 390.00,  390.00),(60, 21, 1, 285.00,  285.00),(60, 17, 4,  65.00,  260.00),(60, 26, 4,  48.00,  192.00),(60, 16, 6,  30.00,  180.00),
  (61,  9, 1, 210.00,  210.00),
  (62,  1, 1, 650.00,  650.00),
  (63, 27, 1,  48.00,   48.00),(63, 28, 1,  24.00,   24.00),(63, 29, 2,  22.00,   44.00),(63, 22, 3,   9.00,   27.00),(63, 30, 1,  38.00,   38.00),
  (64,  3, 1, 420.00,  420.00),
  (65,  4, 1, 899.00,  899.00),
  (66,  1, 1, 650.00,  650.00),
  (67,  3, 1, 420.00,  420.00),
  (68,  1, 3, 650.00, 1950.00),(68,  7, 4, 165.00,  660.00),(68, 16, 6,  30.00,  180.00),(68, 13, 6,  45.00,  270.00),(68, 24,10,  13.00,  130.00),(68, 26, 4,  48.00,  192.00),(68, 27, 4,  24.00,   96.00),
  (69,  8, 1, 265.00,  265.00),
  (70,  2, 1, 390.00,  390.00),
  (71,  2, 1, 520.00,  520.00),
  (72, 29, 2,  22.00,   44.00),(72, 27, 1,  48.00,   48.00),(72, 28, 1,  24.00,   24.00),(72, 22, 3,   9.00,   27.00),(72, 30, 1,  38.00,   38.00),
  (73,  1, 1, 650.00,  650.00),
  (74,  5, 2, 580.00, 1160.00),(74,  7, 4, 165.00,  660.00),(74, 16, 6,  30.00,  180.00),(74, 13, 4,  45.00,  180.00),
  (75,  1, 1, 650.00,  650.00),
  (76,  3, 1, 420.00,  420.00),
  (77,  4, 1, 899.00,  899.00),
  (78,  1, 2, 650.00, 1300.00),(78,  7, 4, 165.00,  660.00),(78, 13, 4,  45.00,  180.00),(78, 16, 4,  30.00,  120.00),(78, 26, 4,  48.00,  192.00),
  (79,  2, 1, 520.00,  520.00),
  (80,  2, 1, 390.00,  390.00),
  (81,  8, 1, 265.00,  265.00),
  (82,  1, 1, 650.00,  650.00),
  (83,  9, 1, 210.00,  210.00),
  (84, 27, 1,  48.00,   48.00),(84, 28, 1,  24.00,   24.00),(84, 22, 3,   9.00,   27.00),(84, 29, 2,  22.00,   44.00),(84, 30, 1,  38.00,   38.00);`);

// Reactivar foreign keys y recrear trigger
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TRIGGER IF NOT EXISTS after_detalle_venta_insert
AFTER INSERT ON detalle_ventas
BEGIN
  UPDATE productos SET stock = stock - NEW.cantidad WHERE id = NEW.producto_id;
  INSERT INTO movimientos_inventario (producto_id, tipo, cantidad, motivo, referencia_id)
  VALUES (NEW.producto_id, 'salida', NEW.cantidad, 'Venta', NEW.venta_id);
END;
`);

// Verificación
const stats = {
  usuarios: db.prepare('SELECT COUNT(*) as c FROM usuarios').get().c,
  clientes: db.prepare('SELECT COUNT(*) as c FROM clientes').get().c,
  productos: db.prepare('SELECT COUNT(*) as c FROM productos').get().c,
  ventas: db.prepare('SELECT COUNT(*) as c FROM ventas').get().c,
  detalles: db.prepare('SELECT COUNT(*) as c FROM detalle_ventas').get().c,
};

console.log('\n✅ Base de datos inicializada correctamente:');
console.table(stats);
console.log('\n🔑 Credenciales de acceso:');
console.log('   Email:      josechaluis0@gmail.com');
console.log('   Contraseña: 12345678');
console.log('\n🚀 Ejecuta "npm start" para iniciar el servidor');

db.close();
