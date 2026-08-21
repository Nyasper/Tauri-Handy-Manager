# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/), y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Corregido

- Permitir renombrar funcionarios y áreas solo cambiando la capitalización del nombre (ej. "juan" → "JUAN").
- Corregir capitalización de un funcionario desde los flujos de creación/asignación: al escribir un nombre que difiere solo en mayúsculas de uno existente, se actualiza en lugar de ignorarse.
- Resolver promesas colgadas al abrir un modal con otro ya activo: el modal anterior se cancela automáticamente.
- Evitar entradas duplicadas en el historial al reasignar un handy al mismo funcionario.
- Limpiar el estado de error al recargar los datos correctamente.
- Impedir que los atajos de teclado (Ctrl+O, Ctrl+H, números) se disparen mientras se edita un campo de texto.

### Cambiado

- La aplicación inicia sin áreas precargadas: las áreas por defecto ya no se siembran al crear la base de datos, permitiendo empezar sin datos y hacer persistente su eliminación.
- Documentar los servicios de modales, menú contextual, base de datos y accesos rápidos.
