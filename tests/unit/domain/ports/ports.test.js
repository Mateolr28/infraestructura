/**
 * PRUEBAS UNITARIAS — Puertos y errores del dominio
 *
 * En la arquitectura hexagonal, los puertos son CONTRATOS: definen qué métodos
 * debe tener un adaptador (por ejemplo, una base de datos). En JavaScript no
 * existen las interfaces, así que cada puerto es una clase cuyos métodos lanzan
 * "no implementado". Estas pruebas verifican que:
 *  - si un adaptador olvida implementar un método, el error sea claro;
 *  - el servicio de dominio cumpla con todos los puertos de entrada;
 *  - la jerarquía de errores del dominio sea la esperada.
 */
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

describe('Puertos del dominio (contratos)', () => {
  // Puertos de salida: lo que el dominio NECESITA de afuera.
  describe('puertos de salida sin implementar fallan explícitamente', () => {
    // Los métodos del repositorio son asíncronos, por eso se usa .rejects.
    test('FoundDocumentRepository', async () => {
      const port = new FoundDocumentRepository();
      await expect(port.save({})).rejects.toThrow('no implementado');
      await expect(port.findById('x')).rejects.toThrow('no implementado');
      await expect(port.findByDocumentNumber({})).rejects.toThrow('no implementado');
    });

    // IdGenerator y Clock son síncronos, por eso basta con toThrow.
    test('IdGenerator', () => {
      expect(() => new IdGenerator().generate()).toThrow('no implementado');
    });

    test('Clock', () => {
      expect(() => new Clock().now()).toThrow('no implementado');
    });
  });

  // Puertos de entrada: los casos de uso que el dominio OFRECE.
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

  // El servicio no puede heredar de tres clases a la vez, así que se comprueba
  // por reflexión que tenga todos los métodos que definen los puertos de entrada.
  // Si mañana se agrega un método a un puerto y se olvida en el servicio,
  // esta prueba falla.
  test('FoundDocumentService implementa todos los métodos de los puertos de entrada', () => {
    const service = new FoundDocumentService({});

    // Lista los métodos declarados en la clase del puerto (sin el constructor).
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
  // Todos los errores específicos deben heredar de DomainError (y de Error).
  // La capa HTTP se apoya en esto para traducirlos al código correcto
  // (400, 404, 409...), así que la jerarquía no puede romperse.
  test.each([ValidationError, NotFoundError, InvalidStateError])(
    '%p hereda de DomainError y de Error, y conserva su nombre',
    (ErrorClass) => {
      const err = new ErrorClass('mensaje');
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(ErrorClass.name); // útil en los logs
      expect(err.message).toBe('mensaje');
    },
  );

  // ValidationError lleva una lista de detalles (un mensaje por campo inválido).
  test('ValidationError guarda los detalles (vacío por defecto)', () => {
    expect(new ValidationError('x').details).toEqual([]);
    expect(new ValidationError('x', ['a']).details).toEqual(['a']);
  });
});
