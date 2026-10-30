/**
 * PUERTO DE ENTRADA: registrar un documento visto extraviado.
 *
 * Caso de uso: una persona ve un documento olvidado en un lugar donde
 * no puede tomarlo (farmacia, tienda...) y registra la dirección.
 */
export class ReportFoundDocumentUseCase {
  /**
   * @param {{
   *   documentNumber: string,
   *   documentType: string,
   *   holderName?: string,
   *   location: { placeName: string, address: string, city: string, reference?: string },
   *   notes?: string
   * }} command
   * @returns {Promise<import('../../models/FoundDocument.js').FoundDocument>}
   */
  async report(command) {
    throw new Error('ReportFoundDocumentUseCase.report() no implementado');
  }
}
