# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/), y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

### Agregado

- Al asignar un handy, si el nombre escrito no existe, el botón principal crea el funcionario y lo asigna automáticamente en un solo paso.
- En el modal de asignación, al seleccionar un funcionario distinto al actual, aparece el botón **Reasignar Handy** (en lugar del genérico "Guardar Cambios").
- La opción "Agregar funcionario y asignar handy" crea el funcionario, lo asigna y cierra el modal automáticamente.
- Botón discreto **← Todos** junto al buscador del grid: aparece cuando hay algún filtro activo (por estado o por texto) y al pulsarlo cancela el filtrado y vuelve a mostrar todos los handies.
- La tarjeta **Total** del header se vuelve clickeable cuando hay un filtro aplicado y cancela el filtrado (igual que **← Todos**); sin filtro permanece estática.

### Corregido

- El modal de historial quedaba cargando indefinidamente al abrir: un contador reactivo leído e incrementado dentro del `$effect` provocaba un bucle infinito de recargas. Ahora la consulta se lanza una sola vez.
- Permitir renombrar funcionarios y áreas solo cambiando la capitalización del nombre (ej. "juan" → "JUAN").
- Corregir capitalización de un funcionario desde los flujos de creación/asignación: al escribir un nombre que difiere solo en mayúsculas de uno existente, se actualiza en lugar de ignorarse.
- Resolver promesas colgadas al abrir un modal con otro ya activo: el modal anterior se cancela automáticamente.
- Evitar entradas duplicadas en el historial al reasignar un handy al mismo funcionario.
- Limpiar el estado de error al recargar los datos correctamente.
- Impedir que los atajos de teclado (Ctrl+O, Ctrl+H, números) se disparen mientras se edita un campo de texto.
- Corregir el botón "Reintentar" de la pantalla de error: ahora reintenta la inicialización de la base de datos en lugar de una recarga que no tenía efecto.
- Corregir la activación por teclado del botón de fijar en las tarjetas de handy: al pulsar Enter/Space sobre él ya no se dispara la asignación del handy.
- Manejar correctamente las promesas de los diálogos de archivo (exportar CSV, copia de seguridad) y la carga de la contraseña de seguridad.
- En el modal de asignación, al abrir un handy ya asignado, por defecto solo se muestra el botón **Desvincular**; el botón de reasignar aparece únicamente al seleccionar otro funcionario.
- Eliminar un espacio sobrante en el texto de la opción "Agregar funcionario y asignar handy" (el salto de línea del template generaba doble espacio alrededor del nombre).
- Impedir eliminar o renombrar el área por defecto **Otro**: al quitarla, los nuevos funcionarios perdían su área por defecto y el default pasaba silenciosamente a otra área. Ahora los botones Renombrar/Eliminar de esa área están deshabilitados (con el badge "Por defecto") y la capa de datos la protege.
- Al renombrar un funcionario sin área válida, ya no se intenta asignar el área inexistente `0`: se muestra un error claro si no hay áreas disponibles.

### Mejorado

- El historial ya no se carga completo: se pagina en la base de datos en páginas fijas de 500 registros, con carga incremental al hacer scroll hasta el final de la lista.
- Nuevo filtro por rango de fechas en el historial: se puede acotar "desde" una fecha, "hasta" otra, o ambas (también aplica al exportar CSV).
- El botón "Agregar funcionario" del modal de asignación indica el handy a asignar (ej. "y asignar handy #5").
- Deshabilitar automáticamente el botón "Asignar Handy" cuando la búsqueda no encuentra ningún funcionario ni un nombre nuevo válido.
- Refactor de accesibilidad de las tarjetas de handy: la tarjeta es un `<button>` nativo y el botón de fijar queda fuera de ella (HTML válido, sin interactivos anidados).
- Eliminar imports con barras escapadas (`$lib\/...`) y extraer lookups repetidos de `handyByOwner` en las listas de administración.
- El buscador de funcionarios en Administración queda fijo (sticky) junto a las pestañas al scrollear el listado.
- Los toasts de todos los modals (Administración, Historial, Seguridad, Copia de seguridad y Asignación) se auto-descartan a los 3 segundos.
- Las tarjetas de handy pasan a un formato horizontal compacto: el número a la izquierda, la información (Handy + dueño/área o Libre) al centro y un LED de estado a la derecha, reduciendo el espacio vertical que ocupaba el diseño anterior tipo radio.
- El encabezado del modal Historial se rediseñó: los controles (total, filtros de acción, rango de fechas, exportar, copia de seguridad y eliminar) se muestran en una fila uniforme, y el buscador pasa a ocupar todo el ancho debajo de ellos, antes de los registros.
- "Exportar a CSV" y "Copia de seguridad" quedan agrupados y siempre en la misma fila en cualquier ancho.
- El export a CSV siempre refleja la vista filtrada actual (usa la misma búsqueda debounced que la lista).
- Si solo se selecciona la fecha "desde" en el historial, el campo "hasta" se completa automáticamente con la fecha de hoy.
- La búsqueda del historial ahora también filtra por **área** del funcionario (además de nombre y # de handy), igual que la lista principal; aplica también al export CSV.

### Cambiado

- El indicador del historial pasa de "Mostrando x de x" a **"x Registros Totales"** (total de coincidencias con el filtro aplicado).
- Los handies fijados ya no se pueden desvincular ni reasignar: hay que desfijarlos primero. El modal de asignación muestra un aviso con un botón **Desfijar**, el menú contextual oculta "Liberar Handy" y "Reasignar handy" para ellos, y la capa de datos lo valida.
- Los handies fijados ya no se agrupan en una sección separada **Fijados**: se muestran junto al resto en la **Lista de Handies**, conservando su color amarillo que los diferencia.
- La pestaña "Áreas" de Administración reemplaza el formulario inline "Nueva área" por un header "{n} areas" con el botón "Agregar área", que solicita el nombre mediante un diálogo.
- El toast de Administración flota justo debajo del modal (sin bloquear la interacción) y los mensajes de éxito/error incluyen el dato afectado (ej. `Funcionario "Juan" eliminado con éxito`, `Área "Seguridad" renombrada a "Patrimonio"`).
- La hora en el historial (interfaz y export CSV) se muestra en formato de 24 horas.
- La pantalla de inicio usa un layout de app-shell: el header y los atajos quedan fijos y la cuadrícula de handies scrollea internamente, con el campo de búsqueda fijo (sticky) arriba del área scrolleable.
- Los modals ahora mantienen su header (título y botón cerrar) siempre visible mientras el contenido scrollea debajo; las barras de Administración (pestañas), Historial (búsqueda/filtros/exportar) y Asignar Handy (búsqueda) quedan fijas al scrollear.
- La aplicación inicia sin áreas precargadas: las áreas por defecto ya no se siembran al crear la base de datos, permitiendo empezar sin datos y hacer persistente su eliminación.
- Documentar los servicios de modales, menú contextual, base de datos y accesos rápidos.
