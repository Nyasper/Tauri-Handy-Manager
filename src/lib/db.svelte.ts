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

class HandyDB {
  private db: Database | null = null;

  // Reactively track the list of 20 handies with their owner/area
  handies = $state<Handy[]>([]);

  // Predefined owners + any added manually
  owners = $state<Owner[]>([]);

  // Available areas
  areas = $state<Area[]>([]);

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
      // Load database. This applies migrations automatically if registered in Rust
      this.db = await Database.load("sqlite:handy_manager.db");
      await this.refresh();
    } catch (e: any) {
      console.error("Error al inicializar la base de datos:", e);
      this.error = e.message || "Error al iniciar la base de datos";
    } finally {
      this.loading = false;
    }
  }

  async refresh() {
    if (!this.db) return;
    try {
      const [handies, owners, areas] = await Promise.all([
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
      ]);
      this.handies = handies.map((h) => ({ ...h, fixed: !!h.fixed }));
      this.owners = owners;
      this.areas = areas;
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
    await this.db.execute("UPDATE handies SET owner_id = NULL WHERE owner_id = ?", [id]);
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

    await this.db.execute("UPDATE handies SET owner_id = ? WHERE id = ?", [
      ownerId,
      id,
    ]);
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
      await this.db.execute("UPDATE handies SET owner_id = NULL, fixed = 0 WHERE id = ?", [
        id,
      ]);
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
}

export const handyDB = new HandyDB();
