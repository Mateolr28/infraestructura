import { buildContainer } from './infrastructure/config/container.js';

const PORT = Number(process.env.PORT) || 3000;

const { server } = buildContainer();

server.listen(PORT, () => {
  console.log(`API de documentos extraviados escuchando en http://localhost:${PORT}`);
  console.log('  POST  /api/documentos                  -> registrar documento encontrado');
  console.log('  GET   /api/documentos?numero=XXXX      -> buscar por número de documento');
  console.log('  GET   /api/documentos/:id              -> ver un reporte');
  console.log('  PATCH /api/documentos/:id/recuperado   -> marcar como recuperado');
});
