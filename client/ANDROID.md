# Android APK

La aplicación Android se genera con Capacitor y conserva el almacenamiento local de IndexedDB. El APK puede registrar partidos y estadísticas sin conexión; necesita acceso al servidor para sincronizar los cambios pendientes.

## Requisitos Windows

Instala Android Studio con Android SDK, Android SDK Platform y Android SDK Build-Tools. La ruta habitual del SDK es:

```text
C:\Users\<usuario>\AppData\Local\Android\Sdk
```

Configura `ANDROID_HOME` con esa ruta y añade `%ANDROID_HOME%\platform-tools` al `Path`. Reinicia el terminal y comprueba:

```powershell
adb version
java -version
```

## Generar el APK debug

Desde `client/`:

```powershell
npm run apk:debug
```

El APK se genera en:

```text
client/android/app/build/outputs/apk/debug/app-debug.apk
```

Para abrir el proyecto en Android Studio:

```powershell
npm run cap:open
```

La URL de sincronización del APK se configura en `.env.android` mediante `VITE_API_URL`. Antes de probar la sincronización, esa URL debe ser accesible desde el teléfono y usar HTTPS válido.