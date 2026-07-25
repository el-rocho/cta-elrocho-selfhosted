<p align="center">
  <img src="public/logo-day.png" alt="Logo Control Tensión Arterial - Modo Día" width="160" height="160" />
</p>

# Control Tensión Arterial (Autoalojada Multi-usuario) 🩺🐳

![Docker Ready](https://img.shields.io/badge/Docker-Autoalojado%20NAS-2496ED?style=for-the-badge&logo=docker)
![SQLite Database](https://img.shields.io/badge/Base%20de%20Datos-SQLite-003B57?style=for-the-badge&logo=sqlite)
![Seguridad 2FA](https://img.shields.io/badge/Seguridad-2FA%20TOTP-10b981?style=for-the-badge&logo=authenticator)
![Built with Vibe Coding](https://img.shields.io/badge/Built%20with-Vibe%20Coding%20%26%20AI-7c3aed?style=for-the-badge&logo=sparkles)
![Licencia](https://img.shields.io/badge/Licencia-MIT-blue?style=for-the-badge)

Versión autoalojada y multiusuario (Docker Compose) de la Aplicación Android "[Control Tensión Arterial](https://github.com/el-rocho/cta-elrocho)" para el registro, seguimiento y análisis de la tensión arterial. Diseñada para ofrecer máxima privacidad para toda la familia.

100% control de tus datos: privados y sin comunicación con servidores de terceros.

> ✨ **Metodología de Desarrollo**: Este proyecto ha sido conceptualizado, diseñado y guiado mediante **Vibe Coding**, utilizando asistencia avanzada de Inteligencia Artificial para la generación de código y arquitectura.

---

## 💡 ¿Qué versión elegir? (Autoalojada vs. Individual)

Este repositorio corresponde a la **Versión Autoalojada Multi-usuario (Docker & SQLite)**.

- 🐳 **Versión Autoalojada**: Diseñada para instalar en tu propio servidor doméstico o NAS (Synology, Unraid, Docker Compose) y permitir a **varios miembros de la familia (hasta 10 usuarios)** controlar su tensión arterial de forma centralizada con base de datos SQLite y **autenticación 2FA TOTP**.
- 📱 **[Versión Individual / Móvil Android (APK / PWA)](https://github.com/el-rocho/cta-elrocho)**: Si prefieres una aplicación móvil **100% offline, nativa Android (APK)** y sin necesidad de instalar un servidor ni crear cuentas de usuario, te recomendamos utilizar la versión individual para un único dispositivo.

### 🔄 Migración e Importación desde la Versión Individual (Móvil/APK):
Si tú o algún familiar habéis estado utilizando la versión móvil individual y queréis migrar vuestro historial al servidor autoalojado:
1. En la app móvil individual, pulsa **Exportar** y descarga el archivo de copia `.csv`.
2. En el servidor autoalojado, inicia sesión con tu usuario familiar (ej. *"Carmen"*).
3. Abre **Exportar / Imprimir** &rarr; pestaña **Importar** y selecciona el archivo `.csv`.
4. El servidor asociará automáticamente todas tus tomas históricas a tu perfil en SQLite.

---

## 🚀 Características Principales de la Versión Autoalojada

- **Multiusuario Familiar Centralizado (~10 Usuarios)**: Cuentas individuales para cada miembro de la familia con aislamiento estricto de mediciones, historial y preferencias.
- **Base de Datos SQLite Persistente**: Almacenamiento ágil y ligero en un único archivo (`/data/cta_database.sqlite`). Copias de seguridad ultrasimples respaldando la carpeta `/data`.
- **Autenticación Segura & Doble Factor (2FA / TOTP)**:
  - Cifrado de contraseñas con **bcrypt**.
  - Sesiones cifradas en cookies seguras `HttpOnly`.
  - **Soporte 2FA TOTP (RFC 6238)** con Código QR compatible con Google Authenticator, Aegis, Authy, Bitwarden, 1Password, etc.
  - **8 Códigos de rescate de emergencia** de un solo uso.
- **Panel de Administración Familiar**: La primera persona registrada se convierte en Administrador, pudiendo dar de alta a familiares, restablecer claves o administrar permisos.
- **Misma Experiencia de Diseño Cuidada**:
  - **Filtro de Síndrome de Bata Blanca**: Algoritmo médico inteligente que descarta tomas iniciales elevadas producidas por la ansiedad del momento.
  - **Informes PDF**: Gráfico temporal con doble eje Y (tensión arterial + línea de pulsaciones) y tabla de registros.
  - **Exportación e Importación CSV**: Copias de seguridad automáticas con metadatos.
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

### 📋 Comprobación de Estado (Opcional)

- **Verificar que el contenedor está activo**: `sudo docker compose ps`
- **Consultar los registros de la base de datos**: `sudo docker logs control-tension-server`
- **Detener el servidor**: `sudo docker compose down`

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
1. **Agrupación Consecutiva**: Se agrupan dentro de una misma sesión las tomas donde el intervalo entre una toma y la anterior sea menor al margen configurado (**3, 5 o 10 minutos**).
2. **Sesiones de 2 tomas**: Si la 1ª toma es significativamente superior a la 2ª ($\ge 8$ mmHg sistólica / $\ge 4$ mmHg diastólica), se descarta la 1ª toma reteniendo la 2ª. En caso contrario, se promedian ambas.
3. **Sesiones de 3 tomas**: Se descarta siempre la 1ª toma y se calcula la media con las 2 tomas restantes.
4. **Sesiones de 4 o más tomas**: Se descarta la 1ª toma y se continúan descartando las siguientes tomas iniciales elevadas ($\ge 8$ mmHg sistólica / $\ge 4$ mmHg diastólica) respecto a la media de las restantes, siempre y cuando queden al menos 3 tomas válidas para calcular la media definitiva.

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

