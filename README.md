<p align="center">
  <img src="public/logo-day.png" alt="Control Tensión Arterial" width="160" height="160" />
</p>

# Control Tensión Arterial — Servidor autoalojado

![Docker](https://img.shields.io/badge/Despliegue-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/Base%20de%20datos-SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Multiusuario](https://img.shields.io/badge/Acceso-Multiusuario-10b981?style=flat-square)
![Idiomas](https://img.shields.io/badge/Idiomas-ES%20%7C%20EN-6366f1?style=flat-square)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue?style=flat-square)

Aplicación web autoalojada y multiusuario para registrar, consultar y analizar la tensión arterial de varios miembros de una familia.

Se despliega con Docker Compose, utiliza SQLite y mantiene los datos bajo tu control, sin enviarlos a servicios externos. Puede utilizarse directamente desde el navegador o mediante el cliente Android/PWA del proyecto.

> [!NOTE]
> Esta edición está pensada para una instalación privada en un servidor o NAS. Si sólo necesitas utilizar la aplicación en un dispositivo y sin infraestructura, elige la edición individual offline.

---

## Ecosistema: elige la edición adecuada

| Edición | Cuándo elegirla | Repositorio |
| :--- | :--- | :--- |
| **Individual offline** | Una persona, un dispositivo y funcionamiento sin servidor ni conexión. | [cta-elrocho](https://github.com/el-rocho/cta-elrocho) |
| **Servidor autoalojado** *(esta edición)* | Varios usuarios, datos centralizados y administración familiar en un servidor o NAS. | [cta-elrocho-selfhosted](https://github.com/el-rocho/cta-elrocho-selfhosted) |
| **Cliente para servidor** | Acceso desde Android o PWA a una instalación autoalojada existente. | [cta-elrocho-client-app](https://github.com/el-rocho/cta-elrocho-client-app) |

---

## Funciones principales

- Cuentas independientes para varios usuarios, con aislamiento de datos y preferencias.
- Primer usuario con funciones de administración familiar.
- Contraseñas protegidas con `bcrypt`, sesiones seguras y autenticación 2FA TOTP.
- Códigos de recuperación de un solo uso.
- Base de datos SQLite persistente en el directorio `data`.
- Registro de presión sistólica, presión diastólica, pulso, brazo y notas.
- Referencias configurables: `Europea ESC 2024`, `USA AHA/ACC 2025` e `Int. ISH 2020`.
- Objetivos terapéuticos orientativos y editables según la indicación profesional.
- Historial, estadísticas y gráficas de evolución de hasta un año.
- Filtro opcional de acomodación para agrupar tomas consecutivas y obtener un resultado efectivo por sesión.
- Informes PDF y CSV, copias completas e importación de datos de MyTherapy.
- Interfaz adaptable en español e inglés, con temas claro y oscuro.
- Panel administrativo de estado, actividad, base de datos y copias.

Las reglas clínicas y el funcionamiento del filtro se describen en la [matriz clínica](docs/reglas-clinicas-v1.6.0.md).

> [!IMPORTANT]
> Las clasificaciones y objetivos son informativos. La aplicación no sustituye el diagnóstico ni las indicaciones de un profesional sanitario.

---

## Instalación rápida con Docker Compose

### 1. Clonar y preparar los datos

Si trabajas como `root`, elimina `sudo` de los comandos.

```bash
sudo mkdir -p /opt/control-tension-arterial
cd /opt/control-tension-arterial
sudo git clone https://github.com/el-rocho/cta-elrocho-selfhosted.git .
sudo mkdir -p data
sudo chown -R 1000:1000 data
sudo chmod -R 775 data
```

### 2. Iniciar la aplicación

```bash
sudo docker compose up -d
```

### 3. Crear el primer usuario

Abre `http://IP_DEL_SERVIDOR:3000`. La primera cuenta registrada será la administradora de la instalación.

### Comprobaciones básicas

```bash
sudo docker compose ps
sudo docker logs control-tension-server
```

Para detener la aplicación:

```bash
sudo docker compose down
```

---

## Actualizaciones y copias

Antes de actualizar, consulta [UPGRADING.md](UPGRADING.md) y las notas de la versión correspondiente.

Para proteger toda la instalación:

1. detén el servicio;
2. respalda el directorio `data` completo;
3. actualiza la aplicación;
4. comprueba el estado del contenedor y el acceso de los clientes.

Mantén el servidor y los clientes Android/PWA en versiones compatibles.

---

## Acceso, HTTPS y clientes externos

- **Navegador:** abre `http://IP_DEL_SERVIDOR:3000` en la red local.
- **Android/PWA:** instala [cta-elrocho-client-app](https://github.com/el-rocho/cta-elrocho-client-app) y configura la URL del servidor.
- **Acceso remoto:** publica la aplicación mediante HTTPS y un proxy inverso como Nginx Proxy Manager, Caddy, Traefik o Cloudflare Tunnel.

HTTPS cifra el tráfico, permite cookies `Secure` y mejora la instalación como PWA. Si el proxy no reenvía `X-Forwarded-Proto: https`, configura `COOKIE_SECURE=true`.

La interfaz web servida por el propio servidor no necesita configuración CORS, tampoco cuando comparte dominio con la API detrás de un proxy inverso. Sólo debes definir `CORS_ORIGINS` si publicas el cliente en un dominio o puerto diferente:

```yaml
environment:
  - CORS_ORIGINS=https://mi-pwa.midominio.com
```

La PWA oficial del cliente se sirve en `https://cliente.cta.elrocho.es` y el servidor ya la admite desde la versión `1.7.1`; al declarar `CORS_ORIGINS` sustituyes por completo esa lista por omisión, así que incluye también ese origen. Indica varios separados por comas, sin barra final. No se recomienda utilizar `*` porque las peticiones incluyen credenciales.

---

## Migración desde la edición individual

Siempre que sea posible, utiliza una copia completa `.cta-backup.json`: conserva las mediciones y las preferencias, por lo que ofrece una migración más completa que el CSV.

1. Crea una copia completa `.cta-backup.json` desde la edición individual.
2. Inicia sesión en la cuenta de destino del servidor.
3. Abre **Datos e informes → Importar / Restaurar**.
4. Selecciona la copia, revisa el contenido y confirma la importación.

Si no dispones de una copia completa, exporta un CSV desde la edición individual e impórtalo siguiendo el mismo procedimiento. El CSV permite recuperar los resultados efectivos, pero puede no incluir las tomas originales de cada sesión ni todas las preferencias.

---

## Desarrollo local

```bash
npm install
npm run dev
npm run build
npm run server
```

---

## Licencia

Distribuido bajo la Licencia MIT.