/**
 * PUERTO DE ENTRADA: el dueño confirma que ya recuperó su documento,
 * para que deje de aparecer como disponible.
 */
export class MarkDocumentRecoveredUseCase {
  /**
   * @param {string} id               Identificador del reporte
   * @param {string} documentNumber   Número del documento, como verificación
   * @returns {Promise<import('../../models/FoundDocument.js').FoundDocument>}
   */
  async markAsRecovered(id, documentNumber) {
    throw new Error('MarkDocumentRecoveredUseCase.markAsRecovered() no implementado');
  }
}
