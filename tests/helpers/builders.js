/**
 * Datos de prueba reutilizables (patrón Test Data Builder).
 * Cada prueba sobrescribe solo lo que le interesa.
 */
export const aLocation = (overrides = {}) => ({
  placeName: 'Droguería La Esquina',
  address: 'Calle 10 # 5-20',
  city: 'Bogotá',
  reference: 'Lo tiene la cajera',
  ...overrides,
});

export const aReportCommand = (overrides = {}) => ({
  documentNumber: '1.020.345.678',
  documentType: 'CEDULA_CIUDADANIA',
  holderName: 'Ana Pérez',
  notes: 'Estaba junto a la caja',
  ...overrides,
  location: overrides.location === undefined ? aLocation() : overrides.location,
});

/** Reloj controlable para pruebas. */
export const fakeClock = (iso = '2026-10-30T10:00:00.000Z') => {
  let current = new Date(iso);
  return {
    now: () => new Date(current),
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
};

/** Generador de ids predecible: doc-1, doc-2, ... */
export const sequentialIds = (prefix = 'doc') => {
  let n = 0;
  return { generate: () => `${prefix}-${++n}` };
};

/** Ejecuta fn y devuelve el error lanzado (o falla si no lanza). */
export const catchError = async (fn) => {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('Se esperaba que la función lanzara un error');
};
