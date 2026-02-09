# XPLAT-017: Eliminar dependencia de PowerShell

## Priority: P1
## Status: Pendiente
## Estimate: 45-50 min

## Descripción
Migrar las funciones que aún dependen de PowerShell a soluciones multiplataforma (Rust/WebSocket).

## Tareas

### 1. Eliminar `detect_ui_state` (PowerShell)
- [ ] Remover llamadas a `detect-ui-state.ps1`
- [ ] Usar solo el estado que llega via WebSocket desde la extensión
- [ ] Actualizar `store.ts` para consumir estado de WebSocket

### 2. Migrar `scan_windows` → WebSocket Registry
- [ ] Usar el registro de extensiones conectadas como fuente de verdad
- [ ] La extensión ya envía: workspace, título, estado
- [ ] Eliminar `detect-windows.ps1`

### 3. Migrar `read_backlog` → Rust nativo  
- [ ] Implementar lectura de archivos `.md` con `std::fs`
- [ ] Glob pattern para encontrar `issues/*.md`
- [ ] Eliminar `read-backlog.ps1`

### 4. Cleanup
- [ ] Eliminar scripts `.ps1` no utilizados
- [ ] Actualizar `tauri.conf.json` (resources)
- [ ] Testing en Windows y macOS

## Beneficios
- ✅ BOB funcionará en Windows, macOS y Linux
- ✅ Menor latencia (sin spawn de PowerShell)
- ✅ Menos código que mantener
