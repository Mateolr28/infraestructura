/**
 * PUERTO DE ENTRADA: verificar si hay documentos registrados
 * con un número de identificación.
 *
 * Caso de uso: quien perdió su documento consulta con su número.
 */
export class SearchFoundDocumentUseCase {
  /**
   * @param {string} documentNumber
   * @returns {Promise<import('../../models/FoundDocument.js').FoundDocument[]>}
   */
  async searchByDocumentNumber(documentNumber) {
    throw new Error('SearchFoundDocumentUseCase.searchByDocumentNumber() no implementado');
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../../models/FoundDocument.js').FoundDocument>}
   */
  async getById(id) {
    throw new Error('SearchFoundDocumentUseCase.getById() no implementado');
  }
}
