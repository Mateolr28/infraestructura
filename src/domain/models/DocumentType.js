/**
 * Tipos de documento de identidad que se pueden reportar.
 */
export const DocumentType = Object.freeze({
  CEDULA_CIUDADANIA: 'CEDULA_CIUDADANIA',
  TARJETA_IDENTIDAD: 'TARJETA_IDENTIDAD',
  CEDULA_EXTRANJERIA: 'CEDULA_EXTRANJERIA',
  PASAPORTE: 'PASAPORTE',
  LICENCIA_CONDUCCION: 'LICENCIA_CONDUCCION',
  OTRO: 'OTRO',
});

export const isValidDocumentType = (value) =>
  Object.values(DocumentType).includes(value);
