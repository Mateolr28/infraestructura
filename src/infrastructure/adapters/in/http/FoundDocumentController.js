import { toResponse } from './FoundDocumentMapper.js';
import { ValidationError } from '../../../../domain/errors/DomainError.js';

/**
 * ADAPTADOR DE ENTRADA (HTTP).
 *
 * Traduce peticiones HTTP a llamadas a los puertos de entrada del dominio.
 * Depende de los casos de uso, nunca de la base de datos.
 */
export class FoundDocumentController {
  /**
   * @param {{
   *   reportUseCase: import('../../../../domain/ports/in/ReportFoundDocumentUseCase.js').ReportFoundDocumentUseCase,
   *   searchUseCase: import('../../../../domain/ports/in/SearchFoundDocumentUseCase.js').SearchFoundDocumentUseCase,
   *   recoverUseCase: import('../../../../domain/ports/in/MarkDocumentRecoveredUseCase.js').MarkDocumentRecoveredUseCase
   * }} useCases
   */
  constructor({ reportUseCase, searchUseCase, recoverUseCase }) {
    this.reportUseCase = reportUseCase;
    this.searchUseCase = searchUseCase;
    this.recoverUseCase = recoverUseCase;
  }

  /** POST /api/documentos */
  report = async ({ body }) => {
    const doc = await this.reportUseCase.report(body ?? {});
    return { status: 201, body: toResponse(doc) };
  };

  /** GET /api/documentos?numero=123456 */
  search = async ({ query }) => {
    const numero = query.get('numero');
    if (!numero) {
      throw new ValidationError('Debes enviar el parámetro "numero" en la consulta');
    }
    const results = await this.searchUseCase.searchByDocumentNumber(numero);
    return {
      status: 200,
      body: {
        found: results.length > 0,
        total: results.length,
        message: results.length
          ? 'Hay documentos registrados con ese número. Revisa la dirección para recogerlo.'
          : 'Aún no hay documentos registrados con ese número.',
        results: results.map(toResponse),
      },
    };
  };

  /** GET /api/documentos/:id */
  getById = async ({ params }) => {
    const doc = await this.searchUseCase.getById(params.id);
    return { status: 200, body: toResponse(doc) };
  };

  /** PATCH /api/documentos/:id/recuperado   body: { documentNumber } */
  markAsRecovered = async ({ params, body }) => {
    const doc = await this.recoverUseCase.markAsRecovered(params.id, body?.documentNumber);
    return { status: 200, body: toResponse(doc) };
  };
}
