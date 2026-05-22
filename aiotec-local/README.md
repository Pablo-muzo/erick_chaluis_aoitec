# aioTec Manager — SQLite Edition

Sistema de gestión para tienda tecnológica. **No requiere MySQL ni ningún servidor de base de datos externo** — usa SQLite (archivo local incluido en el proyecto).

## 🚀 Inicio rápido

```bash
cd backend
npm install
npm start
```

Abre tu navegador en: **http://localhost:3000**

La base de datos se inicializa automáticamente en el primer arranque con datos de prueba.

## 🔑 Credenciales de acceso

| Campo    | Valor                     |
|----------|---------------------------|
| Email    | josechaluis0@gmail.com    |
| Password | 12345678                  |

## 📁 Estructura

```
aiotec/
├── backend/
│   ├── server.js          # Punto de entrada
│   ├── package.json
│   ├── .env               # Variables de entorno
│   ├── config/db.js       # SQLite (mejor-sqlite3)
│   ├── data/              # Aquí se crea techstore.db automáticamente
│   ├── middleware/auth.js
│   ├── routes/
│   └── scripts/init-db.js # Script de inicialización
└── frontend/
    ├── index.html         # Login
    ├── assets/
    ├── css/
    └── pages/
        └── dashboard.html
```

## 🌐 Despliegue en internet

El servidor Express sirve el frontend estático automáticamente.  
Solo necesitas desplegar la carpeta `backend/` junto con `frontend/`.

### En Railway, Render, Fly.io, etc.:
1. Sube el proyecto
2. Comando de inicio: `cd backend && npm install && npm start`
3. Variable de entorno: `JWT_SECRET=tu_clave_secreta`
4. La base de datos SQLite se crea en `backend/data/techstore.db`

> ⚠️ Para producción usa un volumen persistente (Railway Volumes, Render Disks, etc.) para que la DB no se pierda en cada deploy.

## 🔄 Reiniciar datos de prueba

```bash
rm backend/data/techstore.db
npm start
```
