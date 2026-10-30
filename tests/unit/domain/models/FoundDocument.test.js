import { describe, test, expect } from '@jest/globals';
import { FoundDocument } from '../../../../src/domain/models/FoundDocument.js';
import { DocumentNumber } from '../../../../src/domain/models/DocumentNumber.js';
import { Location } from '../../../../src/domain/models/Location.js';
import { DocumentStatus } from '../../../../src/domain/models/DocumentStatus.js';
import { DocumentType, isValidDocumentType } from '../../../../src/domain/models/DocumentType.js';
import { ValidationError, InvalidStateError } from '../../../../src/domain/errors/DomainError.js';
import { aLocation } from '../../../helpers/builders.js';

const NOW = new Date('2026-10-30T10:00:00.000Z');

const reportDocument = (overrides = {}) =>
  FoundDocument.report({
    id: 'doc-1',
    documentNumber: '1.020.345.678',
    documentType: DocumentType.CEDULA_CIUDADANIA,
    holderName: 'Ana Pérez',
    location: aLocation(),
    notes: null,
    now: NOW,
    ...overrides,
  });

describe('FoundDocument (entidad)', () => {
  describe('FoundDocument.report()', () => {
    test('crea un reporte en estado REPORTADO con la fecha indicada', () => {
      const doc = reportDocument();
      expect(doc.id).toBe('doc-1');
      expect(doc.status).toBe(DocumentStatus.REPORTADO);
      expect(doc.reportedAt).toEqual(NOW);
      expect(doc.recoveredAt).toBeNull();
      expect(doc.isAvailable()).toBe(true);
    });

    test('convierte los datos primitivos en objetos de valor', () => {
      const doc = reportDocument();
      expect(doc.documentNumber).toBeInstanceOf(DocumentNumber);
      expect(doc.documentNumber.value).toBe('1020345678');
      expect(doc.location).toBeInstanceOf(Location);
    });

    test('acepta objetos de valor ya construidos', () => {
      const number = new DocumentNumber('52123456');
      const location = new Location(aLocation());
      const doc = reportDocument({ documentNumber: number, location });
      expect(doc.documentNumber).toBe(number);
      expect(doc.location).toBe(location);
    });

    test('holderName y notes son opcionales y se recortan', () => {
      expect(reportDocument({ holderName: undefined, notes: undefined })).toMatchObject({
        holderName: null,
        notes: null,
      });
      expect(reportDocument({ holderName: '  Ana  ', notes: ' nota ' })).toMatchObject({
        holderName: 'Ana',
        notes: 'nota',
      });
    });

    test('usa la fecha actual si no se indica una', () => {
      const doc = reportDocument({ now: undefined });
      expect(doc.reportedAt).toBeInstanceOf(Date);
    });
  });

  describe('validaciones', () => {
    test('exige un id', () => {
      expect(() => reportDocument({ id: undefined })).toThrow(ValidationError);
    });

    test.each([['CARNET'], [''], [undefined], ['cedula_ciudadania']])(
      'rechaza el tipo de documento %p',
      (documentType) => {
        expect(() => reportDocument({ documentType })).toThrow('documentType inválido');
      },
    );

    test.each(Object.values(DocumentType))('acepta el tipo de documento %s', (documentType) => {
      expect(reportDocument({ documentType }).documentType).toBe(documentType);
    });

    test('rechaza holderName o notes que no sean texto', () => {
      expect(() => reportDocument({ holderName: 123 })).toThrow(ValidationError);
      expect(() => reportDocument({ notes: ['x'] })).toThrow(ValidationError);
    });

    test('propaga los errores del número y la ubicación', () => {
      expect(() => reportDocument({ documentNumber: '12' })).toThrow(ValidationError);
      expect(() => reportDocument({ location: { city: 'Cali' } })).toThrow(ValidationError);
    });
  });

  describe('markAsRecovered()', () => {
    test('cambia el estado a RECUPERADO y guarda la fecha', () => {
      const doc = reportDocument();
      const later = new Date('2026-10-31T08:00:00.000Z');
      doc.markAsRecovered(later);
      expect(doc.status).toBe(DocumentStatus.RECUPERADO);
      expect(doc.recoveredAt).toEqual(later);
      expect(doc.isAvailable()).toBe(false);
    });

    test('no se puede recuperar dos veces', () => {
      const doc = reportDocument();
      doc.markAsRecovered(NOW);
      expect(() => doc.markAsRecovered(NOW)).toThrow(InvalidStateError);
    });
  });
});

describe('DocumentType', () => {
  test('isValidDocumentType reconoce los valores del catálogo', () => {
    expect(isValidDocumentType('PASAPORTE')).toBe(true);
    expect(isValidDocumentType('CARNET')).toBe(false);
  });

  test('el catálogo no se puede modificar', () => {
    expect(Object.isFrozen(DocumentType)).toBe(true);
    expect(Object.isFrozen(DocumentStatus)).toBe(true);
  });
});
