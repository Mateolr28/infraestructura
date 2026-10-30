import { FoundDocumentRepository } from '../../../../domain/ports/out/FoundDocumentRepository.js';
import { FoundDocument } from '../../../../domain/models/FoundDocument.js';

/**
 * ADAPTADOR DE SALIDA: base de datos en memoria.
 *
 * Guarda "registros" planos (como lo haría una BD real) y reconstruye
 * las entidades al leer, de modo que nadie fuera del repositorio pueda
 * modificar los datos almacenados sin pasar por save().
 *
 * Mantiene un índice por número de documento para que la búsqueda
 * principal del negocio sea O(1).
 */
export class InMemoryFoundDocumentRepository extends FoundDocumentRepository {
  /** @type {Map<string, object>} id -> registro */
  #records = new Map();
  /** @type {Map<string, Set<string>>} número normalizado -> ids */
  #byNumber = new Map();

  async save(foundDocument) {
    const record = toRecord(foundDocument);
    this.#records.set(record.id, record);

    if (!this.#byNumber.has(record.documentNumber)) {
      this.#byNumber.set(record.documentNumber, new Set());
    }
    this.#byNumber.get(record.documentNumber).add(record.id);
  }

  async findById(id) {
    const record = this.#records.get(id);
    return record ? toEntity(record) : null;
  }

  async findByDocumentNumber(documentNumber) {
    const ids = this.#byNumber.get(documentNumber.value) ?? new Set();
    return [...ids].map((id) => toEntity(this.#records.get(id)));
  }

  /** Utilidad para pruebas. */
  clear() {
    this.#records.clear();
    this.#byNumber.clear();
  }
}

const toRecord = (doc) => ({
  id: doc.id,
  documentNumber: doc.documentNumber.value,
  documentType: doc.documentType,
  holderName: doc.holderName,
  location: { ...doc.location },
  notes: doc.notes,
  reportedAt: doc.reportedAt.toISOString(),
  status: doc.status,
  recoveredAt: doc.recoveredAt ? doc.recoveredAt.toISOString() : null,
});

const toEntity = (r) =>
  new FoundDocument({
    ...r,
    location: { ...r.location },
    reportedAt: new Date(r.reportedAt),
    recoveredAt: r.recoveredAt ? new Date(r.recoveredAt) : null,
  });
