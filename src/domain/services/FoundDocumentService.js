import { FoundDocument } from '../models/FoundDocument.js';
import { DocumentNumber } from '../models/DocumentNumber.js';
import { NotFoundError, ValidationError } from '../errors/DomainError.js';

/**
 * SERVICIO DE DOMINIO.
 *
 * Implementa los puertos de entrada (casos de uso) usando únicamente
 * los puertos de salida. No conoce HTTP, ni la base de datos concreta.
 *
 * Implementa:
 *  - ReportFoundDocumentUseCase
 *  - SearchFoundDocumentUseCase
 *  - MarkDocumentRecoveredUseCase
 */
export class FoundDocumentService {
  /**
   * @param {{
   *   repository: import('../ports/out/FoundDocumentRepository.js').FoundDocumentRepository,
   *   idGenerator: import('../ports/out/IdGenerator.js').IdGenerator,
   *   clock: import('../ports/out/Clock.js').Clock
   * }} deps
   */
  constructor({ repository, idGenerator, clock }) {
    this.repository = repository;
    this.idGenerator = idGenerator;
    this.clock = clock;
  }

  // ---- ReportFoundDocumentUseCase ----
  async report(command = {}) {
    const foundDocument = FoundDocument.report({
      id: this.idGenerator.generate(),
      documentNumber: command.documentNumber,
      documentType: command.documentType,
      holderName: command.holderName ?? null,
      location: command.location,
      notes: command.notes ?? null,
      now: this.clock.now(),
    });
    await this.repository.save(foundDocument);
    return foundDocument;
  }

  // ---- SearchFoundDocumentUseCase ----
  async searchByDocumentNumber(rawNumber) {
    const documentNumber = new DocumentNumber(rawNumber);
    const results = await this.repository.findByDocumentNumber(documentNumber);
    // Solo se muestran los que siguen esperando a su dueño, los más recientes primero.
    return results
      .filter((doc) => doc.isAvailable())
      .sort((a, b) => b.reportedAt - a.reportedAt);
  }

  async getById(id) {
    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundError(`No existe un reporte con id ${id}`);
    return doc;
  }

  // ---- MarkDocumentRecoveredUseCase ----
  async markAsRecovered(id, rawNumber) {
    const doc = await this.getById(id);
    // Se exige el número para que nadie pueda cerrar reportes ajenos al azar.
    const provided = new DocumentNumber(rawNumber);
    if (!doc.documentNumber.equals(provided)) {
      throw new ValidationError('El número de documento no coincide con el reporte');
    }
    doc.markAsRecovered(this.clock.now());
    await this.repository.save(doc);
    return doc;
  }
}
