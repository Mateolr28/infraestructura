import { describe, test, expect } from '@jest/globals';
import { DocumentNumber } from '../../../../src/domain/models/DocumentNumber.js';
import { ValidationError } from '../../../../src/domain/errors/DomainError.js';

describe('DocumentNumber (objeto de valor)', () => {
  describe('normalización', () => {
    test.each([
      ['1.020.345.678', '1020345678'],
      ['1020 345 678', '1020345678'],
      ['1020-345-678', '1020345678'],
      ['  52123456  ', '52123456'],
      ['ab123456', 'AB123456'],
      ['Pe 12.34-56', 'PE123456'],
    ])('"%s" se normaliza a "%s"', (raw, expected) => {
      expect(new DocumentNumber(raw).value).toBe(expected);
    });

    test('acepta números (no solo texto)', () => {
      expect(new DocumentNumber(52123456).value).toBe('52123456');
    });

    test('toString devuelve el valor normalizado', () => {
      expect(String(new DocumentNumber('1.234.567'))).toBe('1234567');
    });
  });

  describe('validación', () => {
    test.each([
      [undefined],
      [null],
      [{}],
      [''],
      ['   '],
    ])('rechaza valores vacíos o no textuales: %p', (raw) => {
      expect(() => new DocumentNumber(raw)).toThrow(ValidationError);
    });

    test.each([['12$45678'], ['1234#5678'], ['ñ1234567'], ['1234/5678']])(
      'rechaza caracteres especiales: "%s"',
      (raw) => {
        expect(() => new DocumentNumber(raw)).toThrow('solo puede contener letras y números');
      },
    );

    test('rechaza números con menos del mínimo de caracteres', () => {
      expect(() => new DocumentNumber('123')).toThrow(ValidationError);
    });

    test('rechaza números con más del máximo de caracteres', () => {
      expect(() => new DocumentNumber('1'.repeat(21))).toThrow(ValidationError);
    });

    test('acepta exactamente los límites mínimo y máximo', () => {
      expect(new DocumentNumber('1234').value).toHaveLength(DocumentNumber.MIN_LENGTH);
      expect(new DocumentNumber('1'.repeat(20)).value).toHaveLength(DocumentNumber.MAX_LENGTH);
    });
  });

  describe('igualdad', () => {
    test('dos números escritos distinto pero equivalentes son iguales', () => {
      expect(new DocumentNumber('1.020.345.678').equals(new DocumentNumber('1020345678'))).toBe(true);
    });

    test('números distintos no son iguales', () => {
      expect(new DocumentNumber('11111111').equals(new DocumentNumber('22222222'))).toBe(false);
    });

    test('no es igual a un string con el mismo valor', () => {
      expect(new DocumentNumber('11111111').equals('11111111')).toBe(false);
    });
  });
});
