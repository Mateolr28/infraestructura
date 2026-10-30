/**
 * PUERTO DE SALIDA: persistencia de documentos encontrados.
 *
 * El dominio define QUÉ necesita; la infraestructura decide CÓMO
 * (memoria, PostgreSQL, Mongo...). Cualquier adaptador debe extender
 * esta clase e implementar todos sus métodos.
 */
export class FoundDocumentRepository {
  /** @param {import('../../models/FoundDocument.js').FoundDocument} foundDocument */
  async save(foundDocument) {
    throw new Error('FoundDocumentRepository.save() no implementado');
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../../models/FoundDocument.js').FoundDocument|null>}
   */
  async findById(id) {
    throw new Error('FoundDocumentRepository.findById() no implementado');
  }

  /**
   * @param {import('../../models/DocumentNumber.js').DocumentNumber} documentNumber
   * @returns {Promise<import('../../models/FoundDocument.js').FoundDocument[]>}
   */
  async findByDocumentNumber(documentNumber) {
    throw new Error('FoundDocumentRepository.findByDocumentNumber() no implementado');
  }
}
