# Instrucciones de UBL Manager

## Proyecto

- Frontend: React 18 + Vite en `client/`.
- Backend: Express + MySQL en `server/`.
- Frontend local: `http://localhost:5173`.
- API local: `http://localhost:4000`.
- La interfaz usa Bootstrap, Axios, SweetAlert2 y Font Awesome.

## Validacion local

Antes de publicar cambios:

```powershell
npm run build
node --check server/index.js
```

Para comprobar el backend local:

```powershell
Invoke-RestMethod http://localhost:4000/api/matches
```

## Despliegue remoto

Servidor SSH:

- Host: `192.168.1.61`
- Usuario: `quique`
- Ruta remota del proyecto: `/home/quique/ublmanager`
- La contrasena SSH o sudo debe introducirse directamente en el terminal. Nunca incluirla en codigo, instrucciones ni comandos guardados.

### Frontend y backend

El `docker-compose.yml` compila el frontend dentro de la imagen web y sirve la aplicacion completa en el puerto 4173. No es necesario copiar `client/dist` manualmente.

### Backend Docker

El despliegue remoto usa el `docker-compose.yml` situado en la raiz remota. El Compose construye la API desde `server/` y el frontend desde `client/`, sirviendolo con Caddy en el puerto 4173.

Por tanto, despues de publicar los cambios en GitHub, actualizar el repositorio remoto y reconstruir ambos servicios:

```powershell
ssh quique@192.168.1.61 "cd /home/quique/ublmanager; git pull --ff-only"
```

Si cambia el esquema, copiar tambien `db/init.sql` a la ubicacion remota correspondiente y ejecutar la migracion contra la base de datos antes de usar las nuevas tablas.

Reconstruir el contenedor con TTY porque `sudo` solicita contrasena:

```powershell
ssh -t quique@192.168.1.61 "cd /home/quique/ublmanager; sudo docker compose up -d --build --force-recreate"
```

No reconstruir solo la API si cambia el frontend: el Compose debe reconstruir ambos servicios desde la raiz.

## Verificacion remota

Comprobar el API desplegado:

```powershell
$matches = Invoke-RestMethod http://192.168.1.61:4000/api/matches
$first = @($matches)[0]
Invoke-RestMethod "http://192.168.1.61:4000/api/matches/$($first.id)/players"
```

Para la funcionalidad de convocatorias deben funcionar ambas rutas:

- `GET /api/matches`, incluyendo `player_count`.
- `GET /api/matches/:matchId/players`.

## Convenciones de implementacion

- Mantener la validacion de minimo 7 jugadores convocados en frontend y backend.
- Validar en backend que los jugadores convocados pertenecen al equipo local.
- Mantener la relacion `match_players` y las actualizaciones de convocatoria dentro del flujo de partidos.
- Las fechas de la tabla se muestran como `dd/mm/aaaa` y la hora en una columna independiente.
- Las acciones de interfaz usan Font Awesome con `title` y `aria-label`; no quitar las etiquetas accesibles al sustituir texto por iconos.
- Los mensajes de WhatsApp se preparan desde el partido guardado e incluyen fecha, hora, hora de llegada, lugar, enlace y convocados.
- Usar SweetAlert2 para confirmaciones de acciones como copiar el mensaje de WhatsApp.
