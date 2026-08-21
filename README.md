# Handy Manager

Aplicación de escritorio sencilla para administrar y asignar handies (radios portátiles) entre los funcionarios de un edificio. Construida con **Tauri 2** y **Svelte 5** con persistencia en **SQLite** a través del plugin `@tauri-apps/plugin-sql`.

## Funcionalidades

- **Lista de handies**: vista en tarjetas del total de handies con su estado (asignado / libre) y dueño actual.
- **Asignación de handies**: clic sobre un handy abre un modal para asignarlo a un funcionario, reasignarlo o desvincularlo.
- **Fijar handies (pin)**: cualquier handy asignado puede fijarse (ícono de pin en la tarjeta, o desde el menú contextual) y queda agrupado en la sección **Fijados** en la parte superior. La columna `fixed` de la BD persiste el estado.
- **Filtros**:
  - Por nombre o área mediante el buscador.
  - Por estado (Todos / Asignados / Libres) tocando los contadores del encabezado.
- **Gestión de funcionarios**: alta, renombrado, cambio de área y baja (al eliminar, sus handies quedan libres).
- **Gestión de áreas**: alta, renombrado y baja con reasignación automática de sus funcionarios a otra área.
- **Gestión de handies**: crear o eliminar handies dinámicamente (solo si están libres y no es el último).
- **Historial**: registra automáticamente la fecha/hora en que cada handy se vincula o desvincula de un funcionario (incluye reasignaciones y liberación por baja de funcionario). Accesible desde el botón **Historial** del encabezado, con búsqueda y filtros por acción. Permite **exportar** lo que se ve a un archivo `.csv` (compatible con Excel y Google Sheets) y **eliminar** el historial (recientes, antiguas o todo) con confirmación y contraseña de seguridad configurable.
- **Menú contextual** en las tarjetas con acciones rápidas (asignar, revocar, reasignar, fijar).
- **Diálogos propios** (confirmar / alerta / prompt) reemplazando los nativos del navegador.

## Atajos de teclado

La aplicación es 100% navegable con el teclado:

- **Flechas** (`←` `→` `↑` `↓`): navegan los elementos en orden fila-mayor (rotando al llegar al borde). Dentro de un modal, navegan entre sus elementos; en inputs/selects conservan el comportamiento nativo.
- **`Tab` / `Shift`+`Tab`**: saltan entre zonas/secciones.
  - Página principal: `Encabezado → Buscador → Cuadrícula`.
  - Modal "Asignar handy": `Búsqueda → Lista → Acciones`.
  - Modal "Administración": `Tabs → Contenido de la pestaña activa → Cerrar`.
- **`Enter`**: aceptar / confirmar la acción enfocada.
- **`Esc` / `Supr`**: salir de un modal, cerrar un menú o volver.
- **`1`-`0`**: selección rápida de los handies 1 al 10; **`Ctrl`+`1`-`0`** para los handies 11 al 20.
- **`Ctrl`+`O`**: abre Administración. **`Ctrl`+`H`**: abre Historial.

Los atajos se muestran también en la barra inferior de la página principal.

## Tecnologías

| Capa | Tecnología |
| --- | --- |
| Frontend | Svelte 5 (runes), SvelteKit (`adapter-static`, modo SPA) |
| Shell de escritorio | Tauri 2 (Rust) |
| Persistencia | SQLite (`tauri-plugin-sql`) |
| Lenguaje | TypeScript |
| Build | Vite |
| Gestor de paquetes | Bun |

## Requisitos

- [Bun](https://bun.sh/) >= 1.x
- [Rust](https://www.rust-lang.org/) (stable) + [cargo](https://doc.rust-lang.org/cargo/)
- Herramientas del toolchain Tauri (ver [prerequisitos](https://v2.tauri.app/start/prerequisites/))

## Puesta en marcha

Instalar dependencias del frontend:

```bash
bun install
```

Ejecutar la aplicación en modo desarrollo (levanta Vite en `http://localhost:1420` y abre la ventana de Tauri):

```bash
bun run tauri dev
```

Solo el frontend en el navegador (sin Tauri, útil para iterar UI):

```bash
bun run dev
```

## Compilación de producción

```bash
bun run tauri build
```

Genera el instalador/paquete nativo en `src-tauri/target/release/` (los targets dependen de la configuración en `src-tauri/tauri.conf.json`). En Linux, el AppImage quedó descartado (WebKitGTK empaquetado no es compatible con los stacks gráficos nuevos como Mesa 26 en Fedora 44): se distribuye vía paquetes nativos que usan el WebKitGTK del sistema.

```bash
bun run tauri build --bundles deb,rpm
```

### Instalación en Linux

- **Fedora / RHEL / openSUSE** (`.rpm`): usa el WebKitGTK del sistema (recomendado).

  ```bash
  sudo dnf install handy-manager-*.x86_64.rpm
  ```

- **Debian / Ubuntu** (`.deb`): usa el WebKitGTK del sistema.

  ```bash
  sudo apt install ./handy-manager_*_amd64.deb
  ```

> Nota: en distribuciones muy nuevas (p. ej. Fedora 44) es imprescindible instalar vía `.rpm`/`.deb`: los AppImage que empaquetan su propio WebKitGTK (compilado en otra distro) pueden mostrar una ventana en blanco y crashear `WebKitWebProcess` (SIGABRT) por incompatibilidad con Mesa/GL del sistema.

#### Binario portable (`handy-manager-linux-x64`)

Es el binario compilado sin empaquetar (como el `.exe` portable de Windows). Usa el WebKitGTK del sistema de cada distro y requiere los requisitos de Tauri:

```bash
chmod +x handy-manager-linux-x64
./handy-manager-linux-x64
```

- Requiere `webkit2gtk4.1` (Fedora) o `libwebkit2gtk-4.1-0` (Debian/Ubuntu), GTK 3 y libsoup3.
- Compilado en `ubuntu-22.04` (glibc 2.35): funciona en **Debian 12+, Ubuntu 22.04+ y Fedora 42+**. En sistemas con glibc anterior falla con `version 'GLIBC_x.x' not found`.

## Scripts disponibles

| Script | Descripción |
| --- | --- |
| `bun run dev` | Servidor de desarrollo de Vite |
| `bun run build` | Build de producción del frontend |
| `bun run preview` | Previsualiza el build |
| `bun run check` | `svelte-kit sync` + `svelte-check` (diagnósticos de Svelte/TS) |
| `bun run check:watch` | Igual que `check` en modo watch |
| `bun run tauri dev` | Ejecuta la app de escritorio en desarrollo |
| `bun run tauri build` | Compila el binario/instalador de producción |

## Estructura del proyecto

```
handy-manager/
├── src/                        # Frontend (SvelteKit)
│   ├── routes/
│   │   ├── +layout.svelte      # Layout global: pantallas de carga/error, contexto y modales
│   │   ├── +layout.ts          # Desactiva SSR (modo SPA)
│   │   └── +page.svelte        # Vista principal: filtros, secciones Fijados/Otros
│   └── lib/
│       ├── app.css             # Tokens de diseño y estilos globales
│       ├── components/         # Componentes UI (Header, Grid, Card, Modales, etc.)
│       └── services/           # Servicios reactivos (db, modales y menú contextual)
└── src-tauri/                  # Backend Rust (Tauri)
    ├── src/lib.rs              # Registro de migraciones SQL y arranque de Tauri
    ├── tauri.conf.json         # Configuración de la app
    ├── capabilities/           # Permisos de los plugins
    └── Cargo.toml
```

## Base de datos

El esquema se mantiene mediante **migraciones versionadas** registradas en `src-tauri/src/lib.rs`; se aplican automáticamente al arrancar con `Database.load("sqlite:handy_manager.db")`.

### Migraciones

| Versión | Descripción |
| --- | --- |
| 1 | Tabla `handies` inicial (16 handies con `assignee`) |
| 2 | Expande `handies` a 20 |
| 3 | Crea `areas` y `owners` (`owners.area_id` → `areas.id`), migra `handies.assignee` a `owner_id` y siembra funcionarios/áreas |
| 4 | Agrega `handies.fixed` (INTEGER 0/1, default 0) para la sección Fijados |
| 5 | Quita el límite fijo de 20 handies y permite crear/eliminar dinámicamente |

### Esquema actual

```sql
areas(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

owners(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  area_id INTEGER NOT NULL REFERENCES areas(id)
);

handies(
  id INTEGER PRIMARY KEY,
  owner_id INTEGER REFERENCES owners(id),
  fixed INTEGER NOT NULL DEFAULT 0
);

handy_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  handy_id INTEGER NOT NULL,
  action TEXT NOT NULL,           -- 'assign' | 'unassign'
  owner_id INTEGER,
  owner_name TEXT NOT NULL,       -- snapshot del nombre al momento del evento
  timestamp TEXT NOT NULL         -- fecha/hora en formato ISO 8601
);

settings(
  key TEXT PRIMARY KEY,
  value TEXT
);                              -- ej. security_password
```

### Capa de datos (`src/lib/services/db.service.svelte.ts`)

`HandyDB` es una clase singleton exportada como `handyDB` que expone estado reactivo (`$state`) — `handies`, `owners`, `areas`, `loading`, `error` — y los métodos de operación: `assign`, `assignToOwner`, `unassign`, `updateAssignee`, `createOwner`, `updateOwner`, `updateOwnerArea`, `deleteOwner`, `createArea`, `updateArea`, `deleteArea`, `toggleFixed`, `createHandy`, `deleteHandy`, `refresh`. Todos refrescan la UI automáticamente tras cada operación.

## Personalización

- **Áreas y funcionarios por defecto**: se siembran en la migración 3 de `src-tauri/src/lib.rs`.
- **Estilos**: los tokens de color, tipografías y radios se definen como variables CSS en `src/lib/app.css`.
