# UBL Manager

Aplicacion web para gestionar equipos, jugadores, partidos, convocatorias y usuarios.
Esta formada por un frontend React + Vite y una API Express/Node conectada a MySQL.

## Requisitos

- Node.js 20 o superior y npm.
- MySQL accesible desde el equipo donde se ejecuta la API.
- Docker y Docker Compose, solo si se va a ejecutar la API en contenedor.

Estructura principal:

- `client/`: frontend React.
- `server/`: API Express y utilidades de base de datos.
- `db/init.sql`: tablas y datos iniciales.
- `docker-compose.prod.yml`: ejecucion de la API con Docker.

## Configurar la base de datos

1. Crea la base de datos MySQL, por ejemplo `cynthia_app`.
2. Copia el archivo de variables de entorno:

```powershell
Copy-Item server/.env.example server/.env
```

3. Edita `server/.env` y establece los valores reales de `DB_HOST`, `DB_USER`,
   `DB_PASS`, `DB_NAME` y `DB_PORT`. Este archivo no se sube a Git.
4. Ejecuta `db/init.sql` contra esa base de datos. Puede hacerse con el cliente
   `mysql`:

```powershell
Get-Content .\db\init.sql | mysql -h localhost -P 3306 -u cynthia_user -p cynthia_app
```

Tambien puedes ejecutar el archivo desde SQLTools usando las extensiones
`SQLTools` y `SQLTools MySQL/MariaDB`.

## Instalacion paso a paso

Desde la raiz del proyecto:

```powershell
npm install
npm run install-all
```

El segundo comando instala las dependencias del backend y del frontend.

## Ejecutar en desarrollo

La forma habitual inicia frontend y backend a la vez:

```powershell
npm run dev
```

Direcciones locales:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`

Vite redirige automaticamente las peticiones `/api` del frontend hacia la API.

Para ejecutar cada parte por separado, abre dos terminales en la raiz.

Terminal 1, backend:

```powershell
npm run start-server
```

Terminal 2, frontend:

```powershell
npm run start-client
```

## Ejecutar la API con Docker

Docker ejecuta la API en el puerto `4000` y usa las variables de `server/.env`.
Primero asegurate de haber creado y configurado ese archivo siguiendo la seccion
de base de datos. Despues, desde la raiz:

```powershell
docker compose -f docker-compose.prod.yml up -d --build
```

Comprobar el contenedor:

```powershell
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f ublmanager-api
```

La API estara disponible en `http://localhost:4000`. Para detenerla:

```powershell
docker compose -f docker-compose.prod.yml down
```

El compose solo ejecuta el backend. El frontend puede ejecutarse con Vite o
compilarse para servirlo con Caddy.

## Compilar y publicar el frontend

Crear la version de produccion:

```powershell
npm run build
```

El resultado queda en `client/dist`. Publicalo con Caddy y configura el proxy de
`/api/*` hacia la API en el puerto `4000`:

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

## Comprobaciones

Comprobar la sintaxis del backend:

```powershell
node --check server/index.js
```

Comprobar la compilacion del frontend:

```powershell
npm run build
```

Consultar la API local:

```powershell
Invoke-RestMethod http://localhost:4000/api/matches
```

No guardes contrasenas reales en el repositorio. El sistema actual almacena las
contrasenas de usuarios en Base64 por compatibilidad, pero Base64 no proporciona
cifrado ni proteccion adecuada para produccion.
