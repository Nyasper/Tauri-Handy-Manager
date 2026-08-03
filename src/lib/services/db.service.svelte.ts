import { browser } from "$app/environment";
import Database from "@tauri-apps/plugin-sql";

export interface Area {
  id: number;
  name: string;
}

export interface Owner {
  id: number;
  name: string;
  area_id: number | null;
  area_name: string | null;
}

export interface Handy {
  id: number;
  owner_id: number | null;
  owner_name: string | null;
  area_id: number | null;
  area_name: string | null;
  fixed: boolean;
}

export type HistoryAction = 'assign' | 'unassign';

export interface HistoryEntry {
  id: number;
  handy_id: number;
  action: HistoryAction;
  owner_id: number | null;
  owner_name: string;
  timestamp: string;
}

class HandyDB {
  private db: Database | null = null;

  // Reactively track the list of 20 handies with their owner/area
  handies = $state<Handy[]>([]);

  // Predefined owners + any added manually
  owners = $state<Owner[]>([]);

  // Available areas
  areas = $state<Area[]>([]);

  // Link/unlink history (newest first)
  history = $state<HistoryEntry[]>([]);

  // Map owner_id -> handy id for quick lookup
  handyByOwner = $derived(
    new Map(
      this.handies
        .filter((h) => h.owner_id != null)
        .map((h) => [h.owner_id!, h.id]),
    ),
  );

  // Reactively track state
  loading = $state(true);
  error = $state<string | null>(null);

  constructor() {
    if (!browser) return;
    this.initDb();
  }

  async initDb() {
    try {
      this.loading = true;
      this.error = null;
      this.db = await Database.load("sqlite:handy_manager.db");
      await this.ensureSchema();
      await this.refresh();
    } catch (e: any) {
      console.error("Error al inicializar la base de datos:", e);
      this.error = e.message || "Error al iniciar la base de datos";
    } finally {
      this.loading = false;
    }
  }

  private async ensureSchema() {
    if (!this.db) return;
    await this.db.execute(
      "CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)",
    );
    await this.db.execute(
      "CREATE TABLE IF NOT EXISTS owners (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, area_id INTEGER NOT NULL REFERENCES areas(id))",
    );
    await this.db.execute(
      "CREATE TABLE IF NOT EXISTS handies (id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES owners(id), fixed INTEGER NOT NULL DEFAULT 0)",
    );
    const [{ count }] = await this.db.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM handies",
    );
    if (count === 0) {
      for (let i = 1; i <= 20; i++) {
        await this.db.execute(
          "INSERT OR IGNORE INTO handies (id, owner_id, fixed) VALUES (?, NULL, 0)",
          [i],
        );
      }
    }
    await this.db.execute(
      "CREATE TABLE IF NOT EXISTS handy_history (id INTEGER PRIMARY KEY AUTOINCREMENT, handy_id INTEGER NOT NULL, action TEXT NOT NULL, owner_id INTEGER, owner_name TEXT NOT NULL, timestamp TEXT NOT NULL)",
    );
    await this.db.execute(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)",
    );
    for (const name of [
      'Gerencia / Gobernancia',
      'Seguridad',
      'Recepción',
      'Cadete / Garajista',
      'Mantenimiento',
      'Mucama',
      'Vidriero',
      'Playero',
      'Otro',
    ]) {
      await this.db.execute("INSERT OR IGNORE INTO areas (name) VALUES (?)", [name]);
    }
  }

  async refresh() {
    if (!this.db) return;
    try {
      const [handies, owners, areas, history] = await Promise.all([
        this.db.select<Handy[]>(
          `SELECT h.id, h.fixed, h.owner_id, o.name AS owner_name, o.area_id, a.name AS area_name
           FROM handies h
           LEFT JOIN owners o ON o.id = h.owner_id
           LEFT JOIN areas a ON a.id = o.area_id
           ORDER BY h.id ASC`,
        ),
        this.db.select<Owner[]>(
          `SELECT o.id, o.name, o.area_id, a.name AS area_name
           FROM owners o
           LEFT JOIN areas a ON a.id = o.area_id
           ORDER BY o.name COLLATE NOCASE ASC`,
        ),
        this.db.select<Area[]>("SELECT id, name FROM areas ORDER BY id ASC"),
        this.db.select<HistoryEntry[]>(
          "SELECT id, handy_id, action, owner_id, owner_name, timestamp FROM handy_history ORDER BY timestamp DESC, id DESC",
        ),
      ]);
      this.handies = handies.map((h) => ({ ...h, fixed: !!h.fixed }));
      this.owners = owners;
      this.areas = areas;
      this.history = history;
    } catch (e: any) {
      console.error("Error al recargar base de datos:", e);
      this.error = e.message || "Error al cargar los datos";
    }
  }

  /** Find an owner by name (case-insensitive), or null if it doesn't exist. */
  findOwner(name: string): Owner | null {
    const normalized = name.trim().toLowerCase();
    return (
      this.owners.find((o) => o.name.trim().toLowerCase() === normalized) ?? null
    );
  }

  /** Default area for new owners: 'Otro', or the first area if it doesn't exist. */
  get defaultAreaId(): number | null {
    const otro = this.areas.find((a) => a.name.trim().toLowerCase() === 'otro');
    return otro?.id ?? this.areas[0]?.id ?? null;
  }

  /** Create a new owner if the name doesn't exist yet, returning it. */
  async createOwner(name: string, areaId?: number): Promise<Owner> {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    const normalized = name.trim();
    if (!normalized) throw new Error("El nombre de la persona no puede estar vacío");

    const existing = this.findOwner(normalized);
    if (existing) return existing;

    const resolvedAreaId = areaId ?? this.defaultAreaId;
    if (resolvedAreaId == null) throw new Error("No hay áreas disponibles");

    await this.db.execute("INSERT INTO owners (name, area_id) VALUES (?, ?)", [
      normalized,
      resolvedAreaId,
    ]);
    await this.refresh();
    return this.findOwner(normalized)!;
  }

  /** Update the area of an existing owner. */
  async updateOwnerArea(ownerId: number, areaId: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    await this.db.execute("UPDATE owners SET area_id = ? WHERE id = ?", [
      areaId,
      ownerId,
    ]);
    await this.refresh();
  }

  /** Update an owner's name and/or area. Throws if the new name is taken. */
  async updateOwner(id: number, name: string, areaId: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    const normalized = name.trim();
    if (!normalized) throw new Error("El nombre del funcionario no puede estar vacío");

    const duplicate = this.owners.find(
      (o) =>
        o.id !== id &&
        o.name.trim().toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      throw new Error(`Ya existe un funcionario llamado "${normalized}"`);
    }

    await this.db.execute("UPDATE owners SET name = ?, area_id = ? WHERE id = ?", [
      normalized,
      areaId,
      id,
    ]);
    await this.refresh();
  }

  /** Delete an owner, freeing any assigned handy first. */
  async deleteOwner(id: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const owner = this.owners.find((o) => o.id === id);
    const freed = this.handies.filter((h) => h.owner_id === id);
    await this.db.execute("UPDATE handies SET owner_id = NULL WHERE owner_id = ?", [id]);
    for (const handy of freed) {
      await this.recordHistory('unassign', handy.id, id, owner?.name ?? 'Desconocido');
    }
    await this.db.execute("DELETE FROM owners WHERE id = ?", [id]);
    await this.refresh();
  }

  /** Create a new area if the name doesn't exist yet, returning it. */
  async createArea(name: string): Promise<Area> {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    const normalized = name.trim();
    if (!normalized) throw new Error("El nombre del área no puede estar vacío");

    const existing = this.areas.find(
      (a) => a.name.trim().toLowerCase() === normalized.toLowerCase(),
    );
    if (existing) throw new Error(`Ya existe el área "${normalized}"`);

    await this.db.execute("INSERT INTO areas (name) VALUES (?)", [normalized]);
    await this.refresh();
    return this.areas.find((a) => a.name.trim() === normalized)!;
  }

  /** Rename an existing area. Throws if the new name is taken. */
  async updateArea(id: number, name: string) {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    const normalized = name.trim();
    if (!normalized) throw new Error("El nombre del área no puede estar vacío");

    const duplicate = this.areas.find(
      (a) => a.id !== id && a.name.trim().toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      throw new Error(`Ya existe el área "${normalized}"`);
    }

    await this.db.execute("UPDATE areas SET name = ? WHERE id = ?", [normalized, id]);
    await this.refresh();
  }

  /** Delete an area. If it's the only one, throws. Reassigns its owners to another area. */
  async deleteArea(id: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    const remaining = this.areas.filter((a) => a.id !== id);
    if (remaining.length === 0) {
      throw new Error("No se puede eliminar la única área");
    }

    const fallback = remaining[0];
    await this.db.execute("UPDATE owners SET area_id = ? WHERE area_id = ?", [
      fallback.id,
      id,
    ]);
    await this.db.execute("DELETE FROM areas WHERE id = ?", [id]);
    await this.refresh();
  }

  /** Persist a link/unlink event to the history table. */
  private async recordHistory(
    action: HistoryAction,
    handyId: number,
    ownerId: number | null,
    ownerName: string,
  ) {
    if (!this.db) return;
    await this.db.execute(
      "INSERT INTO handy_history (handy_id, action, owner_id, owner_name, timestamp) VALUES (?, ?, ?, ?, ?)",
      [handyId, action, ownerId, ownerName, new Date().toISOString()],
    );
  }

  /** Assign a handy to an existing owner. */
  async assignToOwner(id: number, ownerId: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    // Check if the person already has a handy assigned
    const existing = this.handies.find(
      (h) => h.owner_id === ownerId && h.id !== id,
    );
    if (existing) {
      const owner = this.owners.find((o) => o.id === ownerId);
      throw new Error(
        `La persona "${owner?.name}" ya tiene asignado el handy #${existing.id}`,
      );
    }

    const handy = this.handies.find((h) => h.id === id);
    const newOwner = this.owners.find((o) => o.id === ownerId);
    if (!newOwner) throw new Error("El funcionario seleccionado no existe");

    await this.db.execute("UPDATE handies SET owner_id = ? WHERE id = ?", [
      ownerId,
      id,
    ]);
    if (handy?.owner_id != null && handy.owner_id !== ownerId) {
      await this.recordHistory(
        'unassign',
        id,
        handy.owner_id,
        handy.owner_name ?? 'Desconocido',
      );
    }
    await this.recordHistory(
      'assign',
      id,
      ownerId,
      newOwner.name,
    );
    await this.refresh();
  }

  /** Assign a handy to a person by name, creating the owner if needed. */
  async assign(id: number, name: string) {
    const owner = await this.createOwner(name);
    await this.assignToOwner(id, owner.id);
  }

  /** Update assignment for an existing owner (renaming or moving areas). */
  async updateAssignee(id: number, newOwnerName: string) {
    const owner = await this.createOwner(newOwnerName);
    await this.assignToOwner(id, owner.id);
  }

  async unassign(id: number) {
    if (!this.db) {
      throw new Error("La base de datos no está inicializada");
    }
    try {
      const handy = this.handies.find((h) => h.id === id);
      await this.db.execute("UPDATE handies SET owner_id = NULL, fixed = 0 WHERE id = ?", [
        id,
      ]);
      if (handy?.owner_id != null) {
        await this.recordHistory(
          'unassign',
          id,
          handy.owner_id,
          handy.owner_name ?? 'Desconocido',
        );
      }
      await this.refresh();
    } catch (e: any) {
      console.error(`Error al desvincular handy #${id}:`, e);
      throw new Error(e.message || "Error al desvincular el handy");
    }
  }

  /** Toggle whether a handy is fixed to the "Fijados" section. */
  async toggleFixed(id: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const handy = this.handies.find((h) => h.id === id);
    if (!handy) return;
    await this.db.execute("UPDATE handies SET fixed = ? WHERE id = ?", [
      handy.fixed ? 0 : 1,
      id,
    ]);
    await this.refresh();
  }

  /** Create a new handy. Its id/number is assigned automatically (max+1, in order). */
  async createHandy(): Promise<number> {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const res = await this.db.execute(
      "INSERT INTO handies (owner_id, fixed) VALUES (NULL, 0)",
    );
    await this.refresh();
    return res.lastInsertId!;
  }

  /** Delete a handy. It must be unassigned (no owner). */
  async deleteHandy(id: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    const handy = this.handies.find((h) => h.id === id);
    if (!handy) throw new Error("El handy no existe");

    if (this.handies.length <= 1) {
      throw new Error("No se puede eliminar el último handy");
    }

    if (handy.owner_id != null) {
      throw new Error("No se puede eliminar un handy asignado. Primero desvincúlalo.");
    }

    await this.db.execute("DELETE FROM handies WHERE id = ?", [id]);
    await this.refresh();
  }

  /** Read a setting value by key, or null if it doesn't exist. */
  async getSetting(key: string): Promise<string | null> {
    if (!this.db) return null;
    const rows = await this.db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = ?",
      [key],
    );
    return rows[0]?.value ?? null;
  }

  /** Upsert a setting value. */
  async setSetting(key: string, value: string) {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    await this.db.execute(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [key, value],
    );
  }

  /** Get the configured security password, or null if not set. */
  async getSecurityPassword(): Promise<string | null> {
    return this.getSetting('security_password');
  }

  /** Set or change the security password. */
  async setSecurityPassword(password: string) {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    await this.setSetting('security_password', password);
  }

  /** Delete the n most recent history entries (newest first). */
  async deleteRecentHistory(n: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const rows = await this.db.select<{ id: number }[]>(
      "SELECT id FROM handy_history ORDER BY timestamp DESC, id DESC LIMIT ?",
      [n],
    );
    await this.deleteHistoryByIds(rows.map((r) => r.id));
  }

  /** Delete the n oldest history entries (oldest first). */
  async deleteOldestHistory(n: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const rows = await this.db.select<{ id: number }[]>(
      "SELECT id FROM handy_history ORDER BY timestamp ASC, id ASC LIMIT ?",
      [n],
    );
    await this.deleteHistoryByIds(rows.map((r) => r.id));
  }

  /** Delete all history entries. */
  async clearHistory() {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    await this.db.execute("DELETE FROM handy_history");
    await this.refresh();
  }

  /** Delete the given history entry ids. */
  private async deleteHistoryByIds(ids: number[]) {
    if (!this.db) return;
    if (ids.length === 0) {
      await this.refresh();
      return;
    }
    const placeholders = ids.map(() => '?').join(', ');
    await this.db.execute(
      `DELETE FROM handy_history WHERE id IN (${placeholders})`,
      ids,
    );
    await this.refresh();
  }
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV string (comma-separated, UTF-8 BOM) from history entries. */
export function historyToCsv(entries: HistoryEntry[]): string {
  const header = ['Handy #', 'Acción', 'Funcionario', 'Fecha', 'Hora'];
  const rows = entries.map((entry) => {
    const date = new Date(entry.timestamp);
    const fecha = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('es-UY', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
    const hora = Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
    return [
      String(entry.handy_id),
      entry.action === 'assign' ? 'Vinculado' : 'Desvinculado',
      entry.owner_name,
      fecha,
      hora,
    ]
      .map(csvEscape)
      .join(',');
  });
  return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
}

export const handyDB = new HandyDB();
