import { describe, test, expect } from '@jest/globals';
import { Location } from '../../../../src/domain/models/Location.js';
import { ValidationError } from '../../../../src/domain/errors/DomainError.js';
import { aLocation, catchError } from '../../../helpers/builders.js';

describe('Location (objeto de valor)', () => {
  test('crea una ubicación válida y recorta espacios', () => {
    const location = new Location(
      aLocation({ placeName: '  Tienda D1 ', address: ' Cra 7 # 45-10 ', city: ' Medellín ' }),
    );
    expect(location).toMatchObject({
      placeName: 'Tienda D1',
      address: 'Cra 7 # 45-10',
      city: 'Medellín',
    });
  });

  test('la referencia es opcional y queda en null si no se envía', () => {
    expect(new Location(aLocation({ reference: undefined })).reference).toBeNull();
    expect(new Location(aLocation({ reference: '   ' })).reference).toBeNull();
  });

  test('es inmutable', () => {
    const location = new Location(aLocation());
    expect(() => {
      'use strict';
      location.address = 'otra';
    }).toThrow(TypeError);
  });

  test.each(['placeName', 'address', 'city'])('exige el campo %s', async (field) => {
    const err = await catchError(() => new Location(aLocation({ [field]: '' })));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details).toHaveLength(1);
    expect(err.details[0]).toMatch(new RegExp(`^${field}:`));
  });

  test('reporta todos los campos faltantes a la vez', async () => {
    const err = await catchError(() => new Location({}));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.details).toHaveLength(3);
  });

  test.each([[undefined], [null], ['Calle 10'], [42]])(
    'con %p lanza ValidationError (no TypeError)',
    (value) => {
      expect(() => new Location(value)).toThrow(ValidationError);
    },
  );

  test('rechaza una referencia que no sea texto', () => {
    expect(() => new Location(aLocation({ reference: 123 }))).toThrow(ValidationError);
  });
});
