import { browser } from "$app/environment";
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";

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
  area_name: string | null;
  timestamp: string;
}

export const HISTORY_PAGE_SIZE_DEFAULT = 500;

/**
 * Servicio de base de datos SQLite (plugin Tauri) con estado reactivo.
 *
 * Mantiene sincronizados `handies`, `owners`, `areas` y las métricas del
 * historial con la base de datos y expone operaciones de
 * creación/actualización/eliminación que refrescan el estado tras cada cambio.
 *
 * El historial no se carga completo en memoria: se consulta por páginas de
 * `HISTORY_PAGE_SIZE_DEFAULT` registros (`queryHistory`), con filtros
 * opcionales de acción, búsqueda y rango de fechas.
 */
class HandyDB {
  private db: Database | null = null;

  // Reactively track the list of 20 handies with their owner/area
  handies = $state<Handy[]>([]);

  // Predefined owners + any added manually
  owners = $state<Owner[]>([]);

  // Available areas
  areas = $state<Area[]>([]);

  // History is paginated: only totals/counts stay in memory.
  historyTotal = $state(0);
  historyAssignCount = $state(0);
  historyUnassignCount = $state(0);
  historyEpoch = $state(0);

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

  /** Carga la base de datos, asegura el esquema y carga los datos iniciales. */
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
      "CREATE INDEX IF NOT EXISTS idx_handy_history_ts ON handy_history (timestamp DESC, id DESC)",
    );
    await this.db.execute(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)",
    );
  }

  /** Recarga todos los datos desde la base de datos y actualiza el estado reactivo. */
  async refresh() {
    if (!this.db) return;
    try {
      const [handies, owners, areas, counts] = await Promise.all([
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
        this.getHistoryCounts(),
      ]);
      this.error = null;
      this.handies = handies.map((h) => ({ ...h, fixed: !!h.fixed }));
      this.owners = owners;
      this.areas = areas;
      this.historyAssignCount = counts.assign;
      this.historyUnassignCount = counts.unassign;
      this.historyTotal = counts.total;
      this.historyEpoch += 1;
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
    if (existing) {
      if (existing.name !== normalized) {
        await this.db.execute("UPDATE owners SET name = ? WHERE id = ?", [
          normalized,
          existing.id,
        ]);
        await this.refresh();
        return this.findOwner(normalized)!;
      }
      return existing;
    }

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

    const current = this.areas.find((a) => a.id === id);
    if (
      current &&
      current.name.trim().toLowerCase() === 'otro' &&
      normalized.toLowerCase() !== 'otro'
    ) {
      throw new Error("No se puede renombrar el área por defecto 'Otro'");
    }

    const duplicate = this.areas.find(
      (a) => a.id !== id && a.name.trim().toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      throw new Error(`Ya existe el área "${normalized}"`);
    }

    await this.db.execute("UPDATE areas SET name = ? WHERE id = ?", [normalized, id]);
    await this.refresh();
  }

  /** Delete an area. The default one ('Otro') can't be removed; if it's the only one, throws. Reassigns its owners to another area. */
  async deleteArea(id: number) {
    if (!this.db) throw new Error("La base de datos no está inicializada");

    const current = this.areas.find((a) => a.id === id);
    if (current && current.name.trim().toLowerCase() === 'otro') {
      throw new Error("No se puede eliminar el área por defecto 'Otro'");
    }

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

    if (handy?.owner_id === ownerId) return;

    if (handy?.fixed) {
      throw new Error(
        "No se puede reasignar un handy fijado. Desfíjalo primero.",
      );
    }

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

  /** Desvincula un handy de su funcionario y registra el evento en el historial. */
  async unassign(id: number) {
    if (!this.db) {
      throw new Error("La base de datos no está inicializada");
    }
    try {
      const handy = this.handies.find((h) => h.id === id);
      if (handy?.fixed) {
        throw new Error(
          "No se puede desvincular un handy fijado. Desfíjalo primero.",
        );
      }
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
    if (typeof res.lastInsertId !== "number") {
      throw new Error("No se pudo obtener el id del nuevo handy");
    }
    return res.lastInsertId;
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

  /** Create a consistent snapshot of the database at the given path. */
  async backupDatabase(path: string) {
    if (!browser) throw new Error("Operación no disponible");
    await invoke('backup_database', { destPath: path });
  }

  /** Replace the current database with the backup at the given path. */
  async restoreDatabase(path: string) {
    if (!browser) throw new Error("Operación no disponible");
    this.loading = true;
    try {
      if (this.db) {
        await this.db.close();
        this.db = null;
      }
      await invoke('restore_database', { srcPath: path });
      this.db = await Database.load("sqlite:handy_manager.db");
      await this.ensureSchema();
      await this.refresh();
    } catch (e: any) {
      console.error("Error al restaurar la base de datos:", e);
      // Intentar volver a abrir la base actual para no dejar la app sin conexión
      try {
        if (!this.db) this.db = await Database.load("sqlite:handy_manager.db");
        await this.ensureSchema();
        await this.refresh();
      } catch {}
      throw new Error(e.message || "Error al restaurar la base de datos");
    } finally {
      this.loading = false;
    }
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

  /** Total counts per action, plus the overall total. */
  async getHistoryCounts(): Promise<{ assign: number; unassign: number; total: number }> {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const rows = await this.db.select<{ action: string | null; c: number }[]>(
      "SELECT action, COUNT(*) AS c FROM handy_history GROUP BY action",
    );
    const assign = rows.find((r) => r.action === 'assign')?.c ?? 0;
    const unassign = rows.find((r) => r.action === 'unassign')?.c ?? 0;
    return { assign, unassign, total: assign + unassign };
  }

  /** JOINs que exponen el área actual del dueño para buscar/filtrar el historial. */
  private static readonly HISTORY_JOINS =
    'LEFT JOIN owners o ON o.id = h.owner_id LEFT JOIN areas a ON a.id = o.area_id';

  /** Build the WHERE clause + params shared by history queries. */
  private buildHistoryFilter(
    action: HistoryAction | 'all',
    term?: string,
    from?: string,
    to?: string,
  ): { clause: string; params: unknown[] } {
    const where: string[] = [];
    const params: unknown[] = [];
    if (action && action !== 'all') {
      where.push('h.action = ?');
      params.push(action);
    }
    const text = term?.trim();
    if (text) {
      const escaped = text.replace(/[\\%_]/g, (m) => `\\${m}`);
      where.push(
        "(h.owner_name COLLATE NOCASE LIKE ? ESCAPE '\\' OR CAST(h.handy_id AS TEXT) LIKE ? ESCAPE '\\' OR a.name COLLATE NOCASE LIKE ? ESCAPE '\\')",
      );
      params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`);
    }
    if (from) {
      const start = new Date(`${from}T00:00:00`);
      if (!Number.isNaN(start.getTime())) {
        where.push('h.timestamp >= ?');
        params.push(start.toISOString());
      }
    }
    if (to) {
      const end = new Date(`${to}T23:59:59.999`);
      if (!Number.isNaN(end.getTime())) {
        where.push('h.timestamp <= ?');
        params.push(end.toISOString());
      }
    }
    return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  /** Fetch one page of history entries plus the total number of matches. */
  async queryHistory(opts: {
    action?: HistoryAction | 'all';
    term?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }): Promise<{ entries: HistoryEntry[]; total: number }> {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const { clause, params } = this.buildHistoryFilter(
      opts.action ?? 'all',
      opts.term,
      opts.from,
      opts.to,
    );
    const [{ total }] = await this.db.select<{ total: number }[]>(
      `SELECT COUNT(*) AS total
       FROM handy_history h ${HandyDB.HISTORY_JOINS} ${clause}`,
      params,
    );
    const entries = await this.db.select<HistoryEntry[]>(
      `SELECT h.id, h.handy_id, h.action, h.owner_id, h.owner_name, a.name AS area_name, h.timestamp
       FROM handy_history h ${HandyDB.HISTORY_JOINS} ${clause}
       ORDER BY h.timestamp DESC, h.id DESC
       LIMIT ? OFFSET ?`,
      [...params, opts.limit, opts.offset],
    );
    return { entries, total };
  }

  /** Fetch all history entries matching the given filter (used by CSV export). */
  async exportHistory(
    action: HistoryAction | 'all',
    term?: string,
    from?: string,
    to?: string,
  ): Promise<HistoryEntry[]> {
    if (!this.db) throw new Error("La base de datos no está inicializada");
    const { clause, params } = this.buildHistoryFilter(action, term, from, to);
    return this.db.select<HistoryEntry[]>(
      `SELECT h.id, h.handy_id, h.action, h.owner_id, h.owner_name, a.name AS area_name, h.timestamp
       FROM handy_history h ${HandyDB.HISTORY_JOINS} ${clause}
       ORDER BY h.timestamp DESC, h.id DESC`,
      params,
    );
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
      : date.toLocaleTimeString('es-UY', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
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
