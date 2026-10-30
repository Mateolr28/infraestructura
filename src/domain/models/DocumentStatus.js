/**
 * Estado del reporte de un documento encontrado.
 * - REPORTADO: alguien lo vio y registró dónde está.
 * - RECUPERADO: el dueño ya lo recogió; deja de aparecer en búsquedas.
 */
export const DocumentStatus = Object.freeze({
  REPORTADO: 'REPORTADO',
  RECUPERADO: 'RECUPERADO',
});
