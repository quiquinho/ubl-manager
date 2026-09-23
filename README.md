# UBL manager

Proyecto sencillo con frontend React + Vite y backend Express/Node para gestionar usuarios, roles y menú dinámico desde MySQL.

Estructura:

- `server/` - API Express y conexión a la base de datos (MySQL)
- `client/` - App React creada con Vite
- `db/init.sql` - script SQL para crear tablas y semillas iniciales

Configura las credenciales de la base de datos mediante las variables de entorno
descritas en `server/.env.example`. No guardes contraseñas reales en el repositorio.

Instrucciones rápidas:

1. Instalar dependencias:

```bash
cd d:/4 PROYECTOS/Desarrollos/BMN/ublmanager
npm install
npm run install-all
```

2. Crear la base de datos ejecutando el script SQL en `db/init.sql` contra la base `cynthia_app`.

3. Levantar backend y frontend con un solo comando:

```bash
npm run dev
```

También se pueden ejecutar por separado:

```bash
npm run start-server
npm run start-client
```

El frontend queda en `http://localhost:5173` y el API Node en `http://localhost:4000`.

Para compilar el frontend para Caddy:

```bash
npm run build
```

Publica `client/dist` en Caddy. El API Node debe ejecutarse aparte en el puerto 4000 y Caddy debe enrutar `/api/*` hacia `http://127.0.0.1:4000`.

En Raspberry sin Node instalado, usa `server/Dockerfile` y `docker-compose.prod.yml` para ejecutar el API en Docker.

Ejemplo de Caddyfile:

```caddyfile
ublmanager.duckdns.org {
	handle /api/* {
		reverse_proxy 127.0.0.1:4000
	}

	handle {
		root * /ruta/ublmanager/client/dist
		try_files {path} /index.html
		file_server
	}
}
```

Usar la extensión SQLTools en VS Code
--------------------------------------

Si prefieres ejecutar la migración desde VS Code usando la extensión SQLTools, sigue estos pasos:

1. Instala las extensiones recomendadas: `SQLTools` y `SQLTools MySQL/MariaDB` (recomendadas en `.vscode/extensions.json`).
2. Abre la paleta de comandos y crea una nueva conexión (o usa la configuración ya disponible en `.vscode/settings.json`).
	- Host: `192.168.1.61`
	- Port: `3306`
	- Database: `cynthia_app`
	- Username: `cynthia_user`
	- Password: la configurada en tu entorno local
3. Abre `db/init.sql` en el editor.
4. Conéctate a la conexión que creaste (desde el panel SQLTools) y ejecuta el script completo con el botón "Run" o con "Run Query".

Esto creará las tablas y semillas necesarias (roles, users, menu_page, role_menu).
cd client && npm run dev
```

4. Abrir `http://localhost:5173` para ver la landing.

Nota: El almacenamiento de contraseñas en Base64 no es seguro; aquí se hizo por petición explícita.
