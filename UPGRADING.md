# Guía de actualización

Esta guía describe el procedimiento general para actualizar una instalación estable del servidor Docker. Consulta además las notas de la versión concreta, porque pueden incluir migraciones o comprobaciones adicionales.

## Antes de actualizar

1. Lee las [versiones publicadas en GitHub](https://github.com/el-rocho/cta-elrocho-selfhosted/releases).
2. Consulta las notas específicas:
   - [Actualización a 1.6.0](docs/actualizaciones/v1.6.0.md)
3. Avisa a los usuarios y evita que registren mediciones durante la copia.
4. Conserva una copia consistente de todo el directorio `data`, no solo del archivo `.sqlite`.

SQLite utiliza WAL y puede mantener cambios pendientes en archivos auxiliares. Detén brevemente el contenedor antes de copiar:

```bash
sudo docker compose down
sudo cp -a ./data "../control-tension-data-backup-$(date +%Y%m%d-%H%M%S)"
```

Guarda la copia fuera de `./data` y no la elimines hasta terminar las comprobaciones.

## Actualizar

Desde el directorio donde clonaste el repositorio:

```bash
git pull --ff-only
sudo docker compose pull
sudo docker compose up -d
```

La imagen nueva reutiliza `./data`. Si la versión incluye una migración, el servidor la ejecutará al arrancar.

## Comprobar

```bash
sudo docker compose ps
sudo docker logs --tail 100 control-tension-server
```

Comprueba también:

- Inicio de sesión de un usuario.
- Historial y configuración.
- Registro de una medición de prueba.
- Acceso desde el cliente Android o PWA.

Actualiza el servidor antes que los clientes y mantén ambos componentes en versiones compatibles.

## Precauciones

- No ejecutes simultáneamente dos versiones del servidor contra el mismo directorio `data`.
- No copies una base SQLite activa sin utilizar un mecanismo de copia consistente.
- No elimines la copia previa hasta verificar el funcionamiento y los datos.
- Si utilizas una etiqueta de imagen fija en lugar de `latest`, cámbiala expresamente a la nueva versión.

## Recuperación

Si necesitas volver atrás:

1. Detén el servidor.
2. Conserva aparte el directorio `data` posterior a la actualización, especialmente si contiene nuevas mediciones.
3. Restaura como `data` la copia completa realizada antes de actualizar.
4. Arranca la etiqueta de imagen de la versión anterior.
5. Comprueba los registros y el historial antes de reabrir el servicio a los usuarios.

Las mediciones realizadas después de la actualización no existen en la copia previa. Expórtalas o conserva ambas bases si necesitas recuperarlas.
