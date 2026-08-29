<p align="center">
  <img src="public/logo-day.png" alt="Logo Control Tensión Arterial Selfhosted" width="160" height="160" />
</p>

# Control Tensión Arterial (Autoalojada Multi-usuario) 🩺🐳

![Docker Ready](https://img.shields.io/badge/Docker-Autoalojado%20NAS-2496ED?style=for-the-badge&logo=docker)
![SQLite Database](https://img.shields.io/badge/Base%20de%20Datos-SQLite-003B57?style=for-the-badge&logo=sqlite)
![Seguridad 2FA](https://img.shields.io/badge/Seguridad-2FA%20TOTP-10b981?style=for-the-badge&logo=authenticator)
![Built with Vibe Coding](https://img.shields.io/badge/Built%20with-Vibe%20Coding%20%26%20AI-7c3aed?style=for-the-badge&logo=sparkles)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue?style=for-the-badge)

Versión autoalojada y multiusuario (Docker Compose) del repositorio [Control Tensión Arterial](https://github.com/el-rocho/cta-elrocho) para el registro, seguimiento y análisis de la tensión arterial. Diseñada para ofrecer máxima privacidad para toda la familia.

100% control de tus datos: privados y sin comunicación con servidores de terceros.

> ✨ **Metodología de Desarrollo**: Este proyecto ha sido conceptualizado, diseñado y guiado mediante **Vibe Coding**, utilizando asistencia avanzada de Inteligencia Artificial para la generación de código y arquitectura.

---

## 💡 Ecosistema de Aplicaciones: ¿Qué versión elegir?

Este repositorio corresponde a la **Versión Autoalojada Multi-usuario (Docker & SQLite)**. El proyecto cuenta con tres aplicaciones interconectadas:

| Aplicación | Repositorio GitHub | Descripción y Uso |
| :--- | :--- | :--- |
| 📱 **Versión Individual Móvil (Offline)** | [**cta-elrocho**](https://github.com/el-rocho/cta-elrocho) | Ideal para uso personal en un único teléfono. Funciona **100% offline**, sin cuentas, sin servidor y guardando todos los datos en el almacenamiento interno privado del dispositivo. |
| 🐳 **Servidor Autoalojado (Docker)** | **[cta-elrocho-selfhosted](https://github.com/el-rocho/cta-elrocho-selfhosted)** *(Este repo)* | Ideal si deseas desplegar la app en tu servidor privado o NAS para gestionar **varios perfiles familiares (~10 usuarios)** con base de datos SQLite y **2FA TOTP**. |
| 🚀 **Cliente Servidor (Android & PWA)** | [**cta-elrocho-client-app**](https://github.com/el-rocho/cta-elrocho-client-app) | App cliente para conectar al servidor autoalojado introduciendo la IP (`http://192.168.1.x:3000`), con interfaz nativa Android y exportación PDF/CSV. |

### 🔄 Migración e Importación desde la Versión Individual (Móvil/APK):
Si tú o algún familiar habéis estado utilizando la versión móvil individual y queréis migrar vuestro historial a este servidor autoalojado:
1. En la app móvil individual, pulsa **Exportar** &rarr; Descargar copia `.csv`.
2. En el servidor autoalojado, inicia sesión con tu usuario familiar (ej. *"Carmen"*).
3. Abre **Exportar / Imprimir** &rarr; pestaña **Importar** y selecciona el archivo `.csv`.
4. El servidor asociará automáticamente todas tus tomas históricas a tu perfil en SQLite.

### 📲 Acceso Rápido al Repositorio:
Escanea este código QR desde tu teléfono o tablet para acceder directamente al repositorio (`https://github.com/el-rocho/cta-elrocho-selfhosted`):

<p align="center">
  <img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https://github.com/el-rocho/cta-elrocho-selfhosted" alt="Código QR Repositorio Selfhosted" width="160" height="160" />
  <br />
  <sub><b>Escanea para acceder al repositorio en GitHub</b></sub>
</p>

---

## 🚀 Características Principales de la Versión Autoalojada

- **Multiusuario Familiar Centralizado (~10 Usuarios)**: Cuentas individuales para cada miembro de la familia con aislamiento estricto de mediciones, historial y preferencias.
- **Base de Datos SQLite Persistente**: Almacenamiento ágil y ligero en un único archivo (`/data/cta_database.sqlite`). Copias de seguridad ultrasimples respaldando la carpeta `/data`.
- **Autenticación Segura & Doble Factor (2FA / TOTP)**:
  - Cifrado de contraseñas con **bcrypt**.
  - Sesiones cifradas en cookies seguras `HttpOnly` y soporte de token por cabecera `X-Session-Token` para la app móvil cliente.
  - **Soporte 2FA TOTP (RFC 6238)** con Código QR compatible con Google Authenticator, Aegis, Authy, Bitwarden, 1Password, etc.
  - **8 Códigos de rescate de emergencia** de un solo uso.
- **Panel de Administración Familiar**: La primera persona registrada se convierte en Administrador, pudiendo dar de alta a familiares, restablecer claves o administrar permisos.
- **Estado y Diagnóstico del Servidor**: Comprobación pública mínima de disponibilidad y panel administrativo con recursos, base de datos, actividad reciente y estado de las copias.
- **Misma Experiencia de Diseño Cuidada**:
  - **Tres Referencias Clínicas**: Etiquetas y avisos según `ESC 2024`, `AHA/ACC 2025` o `ISH 2020`.
  - **Objetivos Terapéuticos**: Recomendados por guía y edad para usuarios medicados, con límites editables.
  - **Evolución y Tendencias**: Gráficas de hasta un año, estadísticas del periodo, presión de pulso, presión arterial media estimada, carga de presión y comparación de medias diarias en cuatro semanas.
  - **Filtro Opcional de Acomodación**: Calcula un único resultado efectivo por sesión y conserva el desglose completo.
  - **Informes PDF**: Estadísticas, métricas cardiovasculares, gráfico temporal, diagrama de dispersión PAS/PAD y recuento de tomas efectivas y descartadas.
  - **Exportación e Importación CSV**: Copias nativas con metadatos e importación transparente de MyTherapy.
  - **Interfaz Bilingüe (Español / Inglés)**: Adaptable a móviles, tabletas y ordenadores.

---

## 🐳 Instalación Rápida con Docker Compose

Sigue estos sencillos pasos para realizar una instalación limpia y funcional desde cero en tu servidor o NAS:

### 1. Crear el directorio y clonar el repositorio
```bash
# Crear la carpeta de la aplicación y acceder a ella
sudo mkdir -p /opt/control-tension-arterial
cd /opt/control-tension-arterial

# Clonar el proyecto y preparar la carpeta de datos con permisos
sudo git clone https://github.com/el-rocho/cta-elrocho-selfhosted.git .
sudo mkdir -p ./data
sudo chown -R 1000:1000 ./data
sudo chmod -R 775 ./data
```

### 2. Desplegar la aplicación
```bash
sudo docker compose up -d
```

*(💡 Nota: Si tu usuario es `root`, elimina `sudo` en los comandos anteriores).*

### 3. Acceso e Inicialización
Abre en tu navegador la dirección `http://<IP_DE_TU_SERVIDOR>:3000` y completa el registro del **Primer Usuario Administrador**.

---

### Actualizaciones

Antes de instalar una nueva versión, consulta la **[guía de actualización](UPGRADING.md)** y las notas específicas de la versión. Allí se describe cómo respaldar SQLite, actualizar la imagen y actuar si una versión incorpora migraciones.

> [!IMPORTANT]
> **Antes de actualizar a `v1.6.1-beta.3`, realiza una copia completa del directorio `data` con el contenedor detenido.** Esta beta incorpora una migración automática y transparente de las preferencias de usuario. Conserva la copia hasta verificar el inicio de sesión, el historial y la configuración. Consulta las [instrucciones específicas de `v1.6.1-beta.3`](docs/actualizaciones/v1.6.1-beta.3.md).

---

### 📋 Comprobación de Estado (Opcional)

- **Verificar que el contenedor está activo**: `sudo docker compose ps`
- **Consultar los registros de la base de datos**: `sudo docker logs control-tension-server`
- **Detener el servidor**: `sudo docker compose down`

---

## 📱 Cliente Móvil Android Dedicado (Recomendado)

Para acceder de forma cómoda y nativa desde tu teléfono o tablet Android sin necesidad de abrir el navegador web:
- Descarga la aplicación cliente [**cta-elrocho-client-app**](https://github.com/el-rocho/cta-elrocho-client-app) (compatible con **Obtainium**).
- Introduce la IP de tu servidor (ej. `http://192.168.1.50:3000`) en la app para conectar de forma permanente.

---

## 🔒 Recomendación de Seguridad y HTTPS (Proxy Inverso)

Para entornos de producción o acceso remoto fuera de tu red local, **se recomienda encarecidamente configurar un Proxy Inverso con SSL/HTTPS** (como **Nginx Proxy Manager**, **Traefik**, **Caddy** o **Cloudflare Tunnels**).

### 💡 Beneficios de usar acceso HTTPS:
1. **Seguridad y Cifrado**: Cifrado SSL/TLS para proteger contraseñas y datos de tensión arterial en tránsito.
2. **Cookies de Máxima Seguridad**: Habilita la directiva `Secure` en las cookies de sesión de los navegadores.
3. **PWA Instalable en Móviles**: Permite que navegadores en iOS/Android ofrezcan la opción *"Añadir a la pantalla de inicio"* como PWA nativa.
4. **Acceso a la API Nativa del Portapapeles**: Garantiza acceso completo a las funciones avanzadas del navegador (`navigator.clipboard`).

---

## 🛡️ Filtro de Síndrome de Bata Blanca

El **Filtro de Síndrome de Bata Blanca** mitiga la distorsión generada por el sesgo de alerta o ansiedad inicial del paciente al colocarse el manguito de tensión.

### 🔬 Cómo funciona el algoritmo:
1. **Agrupación Consecutiva**: Se agrupan dentro de una misma sesión las tomas donde el intervalo entre una toma y la anterior sea menor o igual a **5 minutos**. Este margen es fijo y no requiere configuración.
2. **Sesiones de 2 tomas**: Si la 1ª toma es significativamente superior a la 2ª ($\ge 8$ mmHg sistólica / $\ge 4$ mmHg diastólica), se descarta la 1ª toma reteniendo la 2ª. En caso contrario, se promedian ambas.
3. **Sesiones de 3 tomas**: Se descarta siempre la 1ª toma y se calcula la media con las 2 tomas restantes.
4. **Sesiones de 4 o más tomas**: Se compara cada toma inicial con la media de todas las posteriores y se descarta mientras sea superior en al menos $8$ mmHg de sistólica o $4$ mmHg de diastólica. El proceso se detiene en la primera toma estable; puede conservar todas las tomas o una única toma final.

El semáforo, los objetivos, los avisos, las tendencias y las exportaciones utilizan la media de las tomas efectivas. Las descartadas siguen visibles en el desglose de la sesión, pero no determinan esos resultados. Consulta la [matriz clínica de la versión 1.6.0](docs/reglas-clinicas-v1.6.0.md) para conocer las reglas completas y sus fuentes.

---

## 🛠️ Desarrollo Local

Si deseas ejecutar el proyecto localmente sin Docker para desarrollo:

```bash
# Instalar dependencias
npm install

# Iniciar frontend + backend en modo desarrollo
npm run dev

# Compilar producción y ejecutar servidor
npm run build
npm run server
```
