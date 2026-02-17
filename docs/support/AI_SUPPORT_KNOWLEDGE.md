# AI Support Knowledge Base for BOB

> **Source of Truth**: `docs/support/AI_SUPPORT_KNOWLEDGE.md`
> **Generated Based On**: `docs/support/6.0_KB_GENERATION_PROMPT.md`
> **Context**: Base de conocimiento para Agente de AI de Soporte Técnico.

---

## 1. Visión General del Producto

**BOB** es una herramienta de escritorio diseñada para **automatizar y monitorear múltiples instancias de Antigravity** (un asistente de codificación AI) ejecutándose dentro de Visual Studio Code.

### Qué ES BOB:
*   Un **monitor de estado** para agentes de AI (Antigravity).
*   Un **automatizador de UI** que detecta inactividad y mantiene al agente trabajando.
*   Una herramienta para **desarrolladores** que gestionan múltiples tareas de AI simultáneamente.
*   Una aplicación de escritorio construida con **Tauri (Rust) + Svelte**.

### Qué NO ES BOB:
*   Un modelo de AI en sí mismo (es un orquestador).
*   Una extensión de VS Code (aunque interactúa con VS Code y tiene un companion extension en desarrollo).
*   Una herramienta de gestión de proyectos general (es específica para Antigravity).

---

## 2. Tipos de Usuario y Capacidades

| Rol | Descripción | Capacidades Principales |
| :--- | :--- | :--- |
| **Usuario Final (Developer)** | Desarrollador de software que utiliza Antigravity para codificar. | - Ejecutar BOB.<br>- Escanear ventanas de VS Code.<br>- Activar/Desactivar monitoreo por instancia (Dev/Support).<br>- Configurar prompts y timeouts.<br>- Ver logs de actividad.<br>- Recibir notificaciones en Discord. |
| **Administrador / Contribuidor** | Desarrollador que mantiene o mejora BOB. | - Compilar el código fuente (Rust/Node).<br>- Modificar scripts de automatización (PowerShell/Rust).<br>- Configurar webhooks globales. |

> **Nota**: Actualmente no existe un sistema de gestión de usuarios o login dentro de la app. Es una aplicación local de escritorio de un solo usuario.

---

## 3. Glosario de Términos

*   **Instancia**: Una ventana de Visual Studio Code ejecutando Antigravity.
*   **Antigravity**: El agente de AI target que BOB monitorea.
*   **Scan / Detección**: Proceso de buscar ventanas activas de VS Code con "Antigravity" en el título.
*   **Prompt**: Instrucción de texto que BOB envía automáticamente al chat de Antigravity cuando detecta inactividad.
*   **Dev Mode**: Modo de operación para issues de desarrollo (features, refactors).
*   **Support Mode**: Modo de operación para issues de soporte o tickets de usuarios.
*   **Inactivity Timeout**: Tiempo de espera antes de que BOB intervenga automáticamente.
*   **Retry**: Intento automático de recuperar una operación fallida o un estado de error en la UI de Antigravity.
*   **Silent Mode**: *[Feature en desarrollo]* Modo de operación sin robar foco de ventana, usando WebSocket y extensión auxiliar.
*   **Legacy Mode**: Modo de operación actual en Windows usando PowerShell y simulación de mouse/teclado.

---

## 4. Mapeo de Módulos y Pantallas

### 4.1. Dashboard Principal
*   **Función**: Vista general de todas las instancias detectadas.
*   **Elementos Clave**:
    *   **Botón "🔍 Scan"**: Inicia la detección de ventanas.
    *   **Lista de Tarjetas**: Representación visual de cada instancia de VS Code.
    *   **Footer**: Estado global de la aplicación (versión, conexión Silent Mode).

### 4.2. Tarjeta de Instancia (Instance Card)
*   **Función**: Control individual de una sesión de Antigravity.
*   **Elementos Clave**:
    *   **Icono de Estado**: 🟡 Idle, 🟢 Working, 🔴 Error, ✅ Complete.
    *   **Barra de Progreso**: Muestra el avance del issue actual.
    *   **Stats**: Contadores separados para `🛠️ Dev` y `🚑 Support` (issues completados/total).
    *   **Toggles de Modo**:
        *   `🛠️ Dev`: Activa el monitoreo para tareas de desarrollo.
        *   `🚑 Support`: Activa el monitoreo para tickets de soporte.
        *   *(Son mutuamente excluyentes)*.
    *   **Botón ⚙️**: Abre el panel de configuración de la instancia.

### 4.3. Panel de Configuración de Instancia (Settings)
*   **Función**: Ajustes específicos para una sesión.
*   **Campos**:
    *   **Issues Path**: Ruta local a la carpeta de issues (override).
    *   **GitHub Repo**: Repositorio asociado (para sincronización de issues).
    *   **Custom Prompt (Dev)**: Prompt específico para modo desarrollo.
    *   **Custom Prompt (Support)**: Prompt específico para modo soporte (tiene fallback por defecto).

### 4.4. Configuración Global (Global Settings)
*   **Función**: Ajustes de comportamiento general de la app.
*   **Campos**:
    *   **Default Prompt**: Prompt base si no hay custom.
    *   **Inactivity Timeout**: Segundos de espera.
    *   **Max Retries**: Límite de reintentos.
    *   **Discord Webhook**: URL para alertas.

---

## 5. User Stories y Flujos Clave

### User Story 1: Automatización de Desarrollo
> "Como desarrollador, quiero que BOB avance mis tareas de refactorización mientras tomo un café."

**Flujo:**
1.  Abrir VS Code con el proyecto.
2.  Abrir BOB y dar clic en "Scan".
3.  Activar el toggle `🛠️ Dev` en la tarjeta correspondiente.
4.  BOB detecta inactividad -> Envía Prompt de Desarrollo -> Antigravity trabaja -> BOB espera -> Repite.

### User Story 2: Atención de Soporte
> "Como soporte, quiero que BOB atienda los tickets de usuarios automáticamente usando un prompt empático."

**Flujo:**
1.  Abrir VS Code en el repo de soporte.
2.  En BOB, activar el toggle `🚑 Support`.
3.  BOB detecta inactividad -> Envía Prompt de Soporte (o el Default de Soporte) -> Antigravity responde al usuario -> Issue completado.

---

## 6. Temas de Soporte y Solución de Problemas

### Dudas Frecuentes (FAQ)

**Q: ¿Por qué BOB no detecta mi ventana de VS Code?**
*   **A**: Asegúrate de que la ventana tenga "Antigravity" visible en el título. Verifica si necesitas ejecutar BOB con permisos de Administrador si VS Code también los tiene.

**Q: ¿Funciona en Mac?**
*   **A**: Actualmente el soporte principal es Windows (Legacy Mode). La versión para macOS está en desarrollo activo (ver `docs/multiplataforma/00_DISCOVERY.md`).

**Q: ¿Por qué BOB "roba" el foco de mi mouse/teclado?**
*   **A**: En "Legacy Mode", BOB usa simulación de input (Win32 API) que requiere traer la ventana al frente. Se está trabajando en un "Silent Mode" para evitar esto.

**Q: Mi prompt de soporte no se envía, usa otro.**
*   **A**: Si el campo "Custom Prompt (Support)" está vacío, BOB usa el `DEFAULT_SUPPORT_PROMPT` interno. Si quieres cambiarlo, escribe tu propio prompt en ese campo.

### Errores Comunes

| Síntoma | Causa Probable | Solución |
| :--- | :--- | :--- |
| **"Legacy mode removed"** | Versión desactualizada de backend. | Actualizar BOB a la última versión. |
| **Detección de estado incorrecta (siempre "Unknown")** | Cambios en la UI de Antigravity (colores/layout). | Requiere actualización de scripts de detección (PowerShell) o recalibración. |
| **Crash al iniciar** | Falta `WebView2` o dependencias. | Instalar `WebView2` runtime en Windows. |

---

## 7. Guía de Clasificación y Escalado

### Clasificación de Feedback

1.  **Bug 🐛 (Prioridad Alta)**:
    *   Crashes, hangs, o errores de script explícitos.
    *   *Ejemplo*: "BOB se cierra al hacer clic en Scan".
    *   -> **Escalar a Ingeniería**.

2.  **Problema de Uso ⚙️ (Prioridad Media)**:
    *   Confusión sobre configuración o prompts.
    *   *Ejemplo*: "No sé cómo configurar el webhook de Discord".
    *   -> **Resolver con Documentación / FAQ**.

3.  **Feature Request 💡 (Prioridad Baja)**:
    *   Nuevas funcionalidades (Soporte Linux, Analytics).
    *   *Ejemplo*: "Quiero gráficas de productividad".
    *   -> **Registrar en Backlog de Producto**.

### Señales para Escalar (Escalation Triggers)

**🔴 Escalar INMEDIATAMENTE a Ingeniería si:**
*   BOB deja de detectar ventanas tras una actualización de VS Code o Antigravity (Breaking Change externo).
*   El "Silent Mode" causa corrupción de estado en el agente.
*   Hay reportes múltiples de crashes en una versión específica de Windows.

**🟡 Escalar a Producto si:**
*   Usuarios piden consistentemente una feature y bloquea su adopción (ej. Soporte Mac crítico).
*   El Default Prompt de Soporte está generando respuestas de baja calidad sistemáticamente.

---

## 8. Referencias Cruzadas (Docs Internos)

*   **Arquitectura Técnica**: `README.md`
*   **Estado Multiplataforma**: `docs/multiplataforma/00_DISCOVERY.md`
*   **Plan de Migración**: `docs/multiplataforma/01_MIGRATION_PLAN.md`
*   **Knowledge Base Gen Prompt**: `docs/support/6.0_KB_GENERATION_PROMPT.md`
*   **Design System**: *[No Documentado / Archivo faltante]* (Referencia rota a `docs/16_design_system.md` en prompts originales).

---
