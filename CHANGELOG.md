# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/), y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Agregado

- Al asignar un handy, si el nombre escrito no existe, el botón principal crea el funcionario y lo asigna automáticamente en un solo paso.

### Corregido

- Permitir renombrar funcionarios y áreas solo cambiando la capitalización del nombre (ej. "juan" → "JUAN").
- Corregir capitalización de un funcionario desde los flujos de creación/asignación: al escribir un nombre que difiere solo en mayúsculas de uno existente, se actualiza en lugar de ignorarse.
- Resolver promesas colgadas al abrir un modal con otro ya activo: el modal anterior se cancela automáticamente.
- Evitar entradas duplicadas en el historial al reasignar un handy al mismo funcionario.
- Limpiar el estado de error al recargar los datos correctamente.
- Impedir que los atajos de teclado (Ctrl+O, Ctrl+H, números) se disparen mientras se edita un campo de texto.
- Corregir el botón "Reintentar" de la pantalla de error: ahora reintenta la inicialización de la base de datos en lugar de una recarga que no tenía efecto.
- Corregir la activación por teclado del botón de fijar en las tarjetas de handy: al pulsar Enter/Space sobre él ya no se dispara la asignación del handy.
- Manejar correctamente las promesas de los diálogos de archivo (exportar CSV, copia de seguridad) y la carga de la contraseña de seguridad.

### Mejorado

- El botón "Agregar funcionario" del modal de asignación indica el handy a asignar (ej. "y asignar handy #5").
- Deshabilitar automáticamente el botón "Asignar Handy" cuando la búsqueda no encuentra ningún funcionario ni un nombre nuevo válido.
- Refactor de accesibilidad de las tarjetas de handy: la tarjeta es un `<button>` nativo y el botón de fijar queda fuera de ella (HTML válido, sin interactivos anidados).
- Eliminar imports con barras escapadas (`$lib\/...`) y extraer lookups repetidos de `handyByOwner` en las listas de administración.

### Cambiado

- La pantalla de inicio usa un layout de app-shell: el header y los atajos quedan fijos y la cuadrícula de handies scrollea internamente, con el campo de búsqueda fijo (sticky) arriba del área scrolleable.
- Los modals ahora mantienen su header (título y botón cerrar) siempre visible mientras el contenido scrollea debajo; las barras de Administración (pestañas), Historial (búsqueda/filtros/exportar) y Asignar Handy (búsqueda) quedan fijas al scrollear.
- La aplicación inicia sin áreas precargadas: las áreas por defecto ya no se siembran al crear la base de datos, permitiendo empezar sin datos y hacer persistente su eliminación.
- Documentar los servicios de modales, menú contextual, base de datos y accesos rápidos.
