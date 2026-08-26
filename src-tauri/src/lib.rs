use rusqlite::backup::Backup;
use rusqlite::{Connection, OpenFlags};
use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

/// Absolute path of the SQLite database file managed by the SQL plugin.
fn db_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("No se pudo resolver el directorio de configuración: {e}"))?;
    Ok(dir.join("handy_manager.db"))
}

/// Check that a file starts with the SQLite database header.
fn looks_like_sqlite(path: &std::path::Path) -> bool {
    use std::io::Read;
    let mut f = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut header = [0u8; 16];
    if f.read_exact(&mut header).is_err() {
        return false;
    }
    &header == b"SQLite format 3\x00"
}

/// Create a consistent snapshot of the live database into `dest_path`.
#[tauri::command]
fn backup_database(app: tauri::AppHandle, dest_path: String) -> Result<(), String> {
    let src = db_path(&app)?;
    if !src.exists() {
        return Err("No existe la base de datos para respaldar".into());
    }

    let src_conn = Connection::open_with_flags(&src, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("No se pudo abrir la base de datos: {e}"))?;
    let mut dest_conn =
        Connection::open(&dest_path).map_err(|e| format!("No se pudo crear el archivo destino: {e}"))?;

    let backup = Backup::new(&src_conn, &mut dest_conn)
        .map_err(|e| format!("No se pudo iniciar el respaldo: {e}"))?;
    backup
        .run_to_completion(5, Duration::from_millis(100), None)
        .map_err(|e| format!("El respaldo falló: {e}"))?;

    Ok(())
}

/// Replace the live database with the contents of `src_path` (a valid SQLite file).
#[tauri::command]
fn restore_database(app: tauri::AppHandle, src_path: String) -> Result<(), String> {
    let src = std::path::PathBuf::from(&src_path);
    if !src.exists() {
        return Err("El archivo de respaldo no existe".into());
    }
    if !looks_like_sqlite(&src) {
        return Err("El archivo seleccionado no es una base de datos SQLite válida".into());
    }

    let dest = db_path(&app)?;
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("No se pudo acceder a los datos: {e}"))?;
    }

    let src_conn = Connection::open_with_flags(&src, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("No se pudo abrir el respaldo: {e}"))?;
    let mut dest_conn = Connection::open(&dest)
        .map_err(|e| format!("No se pudo abrir la base de datos actual: {e}"))?;

    let backup = Backup::new(&src_conn, &mut dest_conn)
        .map_err(|e| format!("No se pudo iniciar la restauración: {e}"))?;
    backup
        .run_to_completion(5, Duration::from_millis(100), None)
        .map_err(|e| format!("La restauración falló: {e}"))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            write_text_file,
            backup_database,
            restore_database
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

