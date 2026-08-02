# Especificación del Proyecto: Handy Manager

Este archivo contiene las especificaciones y reglas del proyecto para guiar el desarrollo de la aplicación por los agentes de IA.

---

## 📋 Descripción del Proyecto
La aplicación es un **CRUD** para administrar una lista de handies (radios de comunicación) y la asignación/vincualción de los mismos a personas en una organización.

## 🛠️ Requisitos Funcionales
1. **Identificadores de Handies (1 al 16)**:
   - Solo existen 16 handies, identificados con los números únicos del **1 al 16**.
   - No se pueden crear handies con otros números ni agregar dinámicamente más números fuera del rango 1-16.
2. **Vinculación/Desvinculación**:
   - El usuario puede vincular un número de handy (1 al 16) a una persona (nombre de la persona).
   - El usuario puede desvincular un número de handy de una persona, dejándolo libre.
3. **Restricción de Asignación**:
   - Cada persona puede tener asignado **como máximo 1 handy a la vez**.
   - Un handy solo puede estar asignado a **como máximo 1 persona a la vez**.
4. **Base de Datos Embebida**:
   - Los datos deben guardarse localmente en una base de datos **SQLite** utilizando el plugin oficial de Tauri (`tauri-plugin-sql`).
   - La base de datos debe inicializarse automáticamente al arrancar la aplicación y asegurar que las tablas necesarias (`handies`, `assignments`, etc. o una sola tabla de handies con el estado de asignación) estén creadas.

---

## 💻 Pila Tecnológica (Tech Stack)
* **Frontend**: Svelte 5 (utilizando Runes como `$state`, `$derived`, etc.) con TypeScript.
* **Backend**: Rust + Tauri v2.
* **Base de Datos**: SQLite (mediante el plugin oficial de Tauri `tauri-plugin-sql`).
* **Estilos**: Vanilla CSS con estética premium, colores HSL armoniosos, diseño responsivo, soporte para modo oscuro/claro, bordes suaves y micro-animaciones en los botones e interacciones.

---

## ⚙️ Reglas de Desarrollo y Buenas Prácticas
1. **Svelte 5**:
   - Usar estrictamente las nuevas características de Svelte 5 (Runes: `$state`, `$derived`, `$effect`, y Snippets en lugar de slots tradicionales).
   - Seguir las guías del skill `svelte5-best-practices` y `svelte-code-writer`.
2. **Tauri v2**:
   - Utilizar las APIs de Tauri v2 de manera segura.
   - Configurar correctamente los permisos y capacidades (`src-tauri/capabilities/default.json`) para usar el plugin de SQL.
3. **Base de Datos**:
   - El plugin `tauri-plugin-sql` requiere agregar la dependencia en `Cargo.toml` (`tauri-plugin-sql = { version = "2", features = ["sqlite"] }`) y registrar el plugin en el builder de Tauri en Rust (`main.rs`).
   - Crear una migración o inicialización de base de datos para preparar la base de datos `sqlite:handy_manager.db`.
   - La base de datos debe contener la tabla de handies (del 1 al 16) o manejar el estado de forma consistente para mantener el histórico o la asignación actual.
4. **Calidad Visual**:
   - La interfaz debe verse premium, moderna y no genérica.
   - Presentar la lista de los 16 handies de forma clara (por ejemplo, una cuadrícula o grid interactivo de 16 slots).
   - Indicar visualmente el estado de cada handy (Libre / Asignado a [Nombre]) con transiciones suaves y colores curados.
