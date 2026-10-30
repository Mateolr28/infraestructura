/**
 * UTILIDADES COMPARTIDAS POR TODAS LAS PRUEBAS
 *
 * Aquí viven los "builders" (constructores de datos de prueba) y los dobles
 * de prueba más usados. Centralizarlos evita repetir el mismo objeto en cada
 * archivo y hace que cada prueba muestre solo el dato que le importa.
 */

/**
 * Crea una ubicación válida por defecto.
 * Se le pueden pasar solo los campos que se quieren cambiar, por ejemplo:
 *   aLocation({ city: 'Cali' })  → misma ubicación pero en Cali.
 */
export const aLocation = (overrides = {}) => ({
  placeName: 'Droguería La Esquina',
  address: 'Calle 10 # 5-20',
  city: 'Bogotá',
  reference: 'Lo tiene la cajera',
  ...overrides, // los valores enviados reemplazan a los de por defecto
});

/**
 * Crea el "comando" (los datos de entrada) para registrar un documento encontrado.
 * Por defecto es completamente válido; cada prueba cambia solo lo que necesita
 * para provocar el caso que quiere verificar.
 */
export const aReportCommand = (overrides = {}) => ({
  documentNumber: '1.020.345.678', // con puntos a propósito, para probar la normalización
  documentType: 'CEDULA_CIUDADANIA',
  holderName: 'Ana Pérez',
  notes: 'Estaba junto a la caja',
  ...overrides,
  // Se distingue entre "no enviaron location" (undefined → usar la de por defecto)
  // y "enviaron location: null" (null → respetarlo para probar ese error).
  location: overrides.location === undefined ? aLocation() : overrides.location,
});

/**
 * Doble de prueba del puerto Clock.
 * Devuelve siempre la misma fecha, y permite "adelantar el tiempo" con advance(),
 * así las pruebas que dependen del orden por fecha son deterministas.
 */
export const fakeClock = (iso = '2026-10-30T10:00:00.000Z') => {
  let current = new Date(iso);
  return {
    // Se devuelve una copia para que nadie pueda modificar la fecha interna.
    now: () => new Date(current),
    // Avanza el reloj la cantidad de milisegundos indicada.
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
};

/**
 * Doble de prueba del puerto IdGenerator.
 * Genera ids predecibles (doc-1, doc-2, ...) en lugar de UUID aleatorios,
 * para poder comparar resultados exactos en las aserciones.
 */
export const sequentialIds = (prefix = 'doc') => {
  let n = 0;
  return { generate: () => `${prefix}-${++n}` };
};

/**
 * Ejecuta una función (síncrona o asíncrona) y devuelve el error que lance.
 * Sirve para inspeccionar propiedades del error (por ejemplo err.details),
 * algo que expect(...).toThrow() no permite de forma directa.
 * Si la función NO lanza error, la prueba falla.
 */
export const catchError = async (fn) => {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('Se esperaba que la función lanzara un error');
};
