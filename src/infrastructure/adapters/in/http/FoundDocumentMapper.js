/**
 * Convierte entidades del dominio en la representación JSON de la API.
 * Así el formato de respuesta puede cambiar sin tocar el dominio.
 */
export const toResponse = (doc) => ({
  id: doc.id,
  documentNumber: maskNumber(doc.documentNumber.value),
  documentType: doc.documentType,
  holderName: doc.holderName,
  location: {
    placeName: doc.location.placeName,
    address: doc.location.address,
    city: doc.location.city,
    reference: doc.location.reference,
  },
  notes: doc.notes,
  status: doc.status,
  reportedAt: doc.reportedAt.toISOString(),
  recoveredAt: doc.recoveredAt ? doc.recoveredAt.toISOString() : null,
});

/**
 * Por privacidad, en las respuestas solo se muestran los últimos 4 dígitos.
 * Quien busca ya conoce su número completo.
 */
export const maskNumber = (value) =>
  value.length <= 4 ? value : `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
