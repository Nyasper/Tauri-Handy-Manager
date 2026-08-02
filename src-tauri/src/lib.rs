// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
                CREATE TABLE IF NOT EXISTS handies (
                    id INTEGER PRIMARY KEY CHECK(id >= 1 AND id <= 16),
                    assignee TEXT UNIQUE
                );
                INSERT OR IGNORE INTO handies (id, assignee) VALUES
                (1, NULL), (2, NULL), (3, NULL), (4, NULL),
                (5, NULL), (6, NULL), (7, NULL), (8, NULL),
                (9, NULL), (10, NULL), (11, NULL), (12, NULL),
                (13, NULL), (14, NULL), (15, NULL), (16, NULL);
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "expand_handies_to_20",
            sql: "
                PRAGMA foreign_keys = OFF;
                ALTER TABLE handies RENAME TO handies_old;
                CREATE TABLE handies (
                    id INTEGER PRIMARY KEY CHECK(id >= 1 AND id <= 20),
                    assignee TEXT UNIQUE
                );
                INSERT OR IGNORE INTO handies (id, assignee)
                    SELECT id, assignee FROM handies_old;
                INSERT OR IGNORE INTO handies (id, assignee) VALUES
                (17, NULL), (18, NULL), (19, NULL), (20, NULL);
                DROP TABLE handies_old;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_areas_and_owners",
            sql: "
                CREATE TABLE IF NOT EXISTS areas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE
                );

                INSERT OR IGNORE INTO areas (name) VALUES
                ('Gerencia / Gobernancia'),
                ('Seguridad'),
                ('Recepción'),
                ('Cadete / Garajista'),
                ('Mantenimiento'),
                ('Mucama'),
                ('Vidriero'),
                ('Playero'),
                ('Otro');

                CREATE TABLE IF NOT EXISTS owners (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    area_id INTEGER NOT NULL REFERENCES areas(id)
                );

                INSERT OR IGNORE INTO owners (name, area_id)
                SELECT name, (SELECT id FROM areas WHERE name = 'Otro')
                FROM (
                    SELECT 'Carolina Silvera' AS name
                    UNION ALL SELECT 'Natalia Rodríguez'
                    UNION ALL SELECT 'Silvina Laviaguerre'
                    UNION ALL SELECT 'Lautaro Hinojosa'
                    UNION ALL SELECT 'Gabriel Maciel'
                    UNION ALL SELECT 'Yuliana Silva'
                    UNION ALL SELECT 'Andrea Quintana'
                    UNION ALL SELECT 'Gricell Medina'
                    UNION ALL SELECT 'Mariana Fernandez'
                    UNION ALL SELECT 'Romina Pouer'
                    UNION ALL SELECT 'Romina Gonzales'
                    UNION ALL SELECT 'Mikaela Reboledo'
                    UNION ALL SELECT 'Joseline Morales'
                    UNION ALL SELECT 'Martin Añon'
                    UNION ALL SELECT 'Cristian Castro'
                    UNION ALL SELECT 'Gonzalo Herrera'
                    UNION ALL SELECT 'Maicol Sequeira'
                    UNION ALL SELECT 'Nahuel Porta'
                    UNION ALL SELECT 'Gabriel Bentancurt'
                    UNION ALL SELECT 'Silvina Acosta'
                    UNION ALL SELECT 'Gerardo Duartes'
                    UNION ALL SELECT 'Gustavo Muñoz'
                    UNION ALL SELECT 'Lorena Pereyra'
                    UNION ALL SELECT 'Patricio Gimenez'
                    UNION ALL SELECT 'Manuel Suarez'
                    UNION ALL SELECT 'Francisco Sastre'
                    UNION ALL SELECT 'José Ducasse'
                    UNION ALL SELECT 'Fernando Segovia'
                    UNION ALL SELECT 'Matias Alonso'
                ) AS seed;

                INSERT OR IGNORE INTO owners (name, area_id)
                SELECT DISTINCT assignee, (SELECT id FROM areas WHERE name = 'Otro')
                FROM handies
                WHERE assignee IS NOT NULL;

                PRAGMA foreign_keys = OFF;
                ALTER TABLE handies RENAME TO handies_old;
                CREATE TABLE handies (
                    id INTEGER PRIMARY KEY CHECK(id >= 1 AND id <= 20),
                    owner_id INTEGER REFERENCES owners(id)
                );
                INSERT OR IGNORE INTO handies (id, owner_id)
                    SELECT h.id, o.id
                    FROM handies_old h
                    LEFT JOIN owners o ON o.name = h.assignee;
                DROP TABLE handies_old;
                PRAGMA foreign_keys = ON;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_fixed_to_handies",
            sql: "
                ALTER TABLE handies ADD COLUMN fixed INTEGER NOT NULL DEFAULT 0;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "allow_dynamic_handies",
            sql: "
                PRAGMA foreign_keys = OFF;
                ALTER TABLE handies RENAME TO handies_old;
                CREATE TABLE handies (
                    id INTEGER PRIMARY KEY,
                    owner_id INTEGER REFERENCES owners(id),
                    fixed INTEGER NOT NULL DEFAULT 0
                );
                INSERT OR IGNORE INTO handies (id, owner_id, fixed)
                    SELECT id, owner_id, fixed FROM handies_old;
                DROP TABLE handies_old;
                PRAGMA foreign_keys = ON;
            ",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:handy_manager.db", migrations)
                .build()
        )
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

