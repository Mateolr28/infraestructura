import { DocumentNumber } from './DocumentNumber.js';
import { Location } from './Location.js';
import { DocumentStatus } from './DocumentStatus.js';
import { isValidDocumentType, DocumentType } from './DocumentType.js';
import { ValidationError, InvalidStateError } from '../errors/DomainError.js';

/**
 * Entidad principal: un documento que alguien vio extraviado
 * y registró con la dirección donde se encuentra.
 */
export class FoundDocument {
  constructor({
    id,
    documentNumber,
    documentType,
    holderName = null,
    location,
    notes = null,
    reportedAt,
    status = DocumentStatus.REPORTADO,
    recoveredAt = null,
  }) {
    if (!id) throw new ValidationError('El documento debe tener un identificador');
    if (!isValidDocumentType(documentType)) {
      throw new ValidationError(
        `documentType inválido. Valores permitidos: ${Object.values(DocumentType).join(', ')}`,
      );
    }
    if (holderName !== null && typeof holderName !== 'string') {
      throw new ValidationError('holderName debe ser texto');
    }
    if (notes !== null && typeof notes !== 'string') {
      throw new ValidationError('notes debe ser texto');
    }

    this.id = id;
    this.documentNumber =
      documentNumber instanceof DocumentNumber ? documentNumber : new DocumentNumber(documentNumber);
    this.documentType = documentType;
    this.holderName = holderName?.trim() || null;
    this.location = location instanceof Location ? location : new Location(location);
    this.notes = notes?.trim() || null;
    this.reportedAt = reportedAt ?? new Date();
    this.status = status;
    this.recoveredAt = recoveredAt;
  }

  /** Fábrica para un reporte nuevo. */
  static report({ id, documentNumber, documentType, holderName, location, notes, now }) {
    return new FoundDocument({
      id,
      documentNumber,
      documentType,
      holderName,
      location,
      notes,
      reportedAt: now,
      status: DocumentStatus.REPORTADO,
    });
  }

  isAvailable() {
    return this.status === DocumentStatus.REPORTADO;
  }

  /** El dueño indica que ya recuperó su documento. */
  markAsRecovered(now = new Date()) {
    if (!this.isAvailable()) {
      throw new InvalidStateError('Este documento ya fue marcado como recuperado');
    }
    this.status = DocumentStatus.RECUPERADO;
    this.recoveredAt = now;
  }
}
