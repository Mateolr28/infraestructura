import { describe, test, expect } from '@jest/globals';
import { FoundDocumentRepository } from '../../../../src/domain/ports/out/FoundDocumentRepository.js';
import { IdGenerator } from '../../../../src/domain/ports/out/IdGenerator.js';
import { Clock } from '../../../../src/domain/ports/out/Clock.js';
import { ReportFoundDocumentUseCase } from '../../../../src/domain/ports/in/ReportFoundDocumentUseCase.js';
import { SearchFoundDocumentUseCase } from '../../../../src/domain/ports/in/SearchFoundDocumentUseCase.js';
import { MarkDocumentRecoveredUseCase } from '../../../../src/domain/ports/in/MarkDocumentRecoveredUseCase.js';
import { FoundDocumentService } from '../../../../src/domain/services/FoundDocumentService.js';
import {
  DomainError,
  ValidationError,
  NotFoundError,
  InvalidStateError,
} from '../../../../src/domain/errors/DomainError.js';

/**
 * Los puertos son contratos: si un adaptador olvida implementar
 * un método, debe fallar de forma explícita.
 */
describe('Puertos del dominio (contratos)', () => {
  describe('puertos de salida sin implementar fallan explícitamente', () => {
    test('FoundDocumentRepository', async () => {
      const port = new FoundDocumentRepository();
      await expect(port.save({})).rejects.toThrow('no implementado');
      await expect(port.findById('x')).rejects.toThrow('no implementado');
      await expect(port.findByDocumentNumber({})).rejects.toThrow('no implementado');
    });

    test('IdGenerator', () => {
      expect(() => new IdGenerator().generate()).toThrow('no implementado');
    });

    test('Clock', () => {
      expect(() => new Clock().now()).toThrow('no implementado');
    });
  });

  describe('puertos de entrada sin implementar fallan explícitamente', () => {
    test('ReportFoundDocumentUseCase', async () => {
      await expect(new ReportFoundDocumentUseCase().report({})).rejects.toThrow('no implementado');
    });

    test('SearchFoundDocumentUseCase', async () => {
      const port = new SearchFoundDocumentUseCase();
      await expect(port.searchByDocumentNumber('1')).rejects.toThrow('no implementado');
      await expect(port.getById('1')).rejects.toThrow('no implementado');
    });

    test('MarkDocumentRecoveredUseCase', async () => {
      await expect(new MarkDocumentRecoveredUseCase().markAsRecovered('1', '1')).rejects.toThrow(
        'no implementado',
      );
    });
  });

  test('FoundDocumentService implementa todos los métodos de los puertos de entrada', () => {
    const service = new FoundDocumentService({});
    const methodsOf = (Port) =>
      Object.getOwnPropertyNames(Port.prototype).filter((m) => m !== 'constructor');

    for (const Port of [
      ReportFoundDocumentUseCase,
      SearchFoundDocumentUseCase,
      MarkDocumentRecoveredUseCase,
    ]) {
      for (const method of methodsOf(Port)) {
        expect(typeof service[method]).toBe('function');
      }
    }
  });
});

describe('Errores de dominio', () => {
  test.each([ValidationError, NotFoundError, InvalidStateError])(
    '%p hereda de DomainError y de Error, y conserva su nombre',
    (ErrorClass) => {
      const err = new ErrorClass('mensaje');
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(ErrorClass.name);
      expect(err.message).toBe('mensaje');
    },
  );

  test('ValidationError guarda los detalles (vacío por defecto)', () => {
    expect(new ValidationError('x').details).toEqual([]);
    expect(new ValidationError('x', ['a']).details).toEqual(['a']);
  });
});
