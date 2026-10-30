import { FoundDocumentService } from '../../domain/services/FoundDocumentService.js';
import { InMemoryFoundDocumentRepository } from '../adapters/out/persistence/InMemoryFoundDocumentRepository.js';
import { UuidIdGenerator } from '../adapters/out/id/UuidIdGenerator.js';
import { SystemClock } from '../adapters/out/time/SystemClock.js';
import { FoundDocumentController } from '../adapters/in/http/FoundDocumentController.js';
import { createHttpServer } from '../adapters/in/http/HttpServer.js';

/**
 * Raíz de composición: único lugar donde se conectan los puertos
 * del dominio con sus adaptadores concretos.
 *
 * Para cambiar la BD en memoria por una real, basta con crear otro
 * adaptador que extienda FoundDocumentRepository y pasarlo aquí.
 */
export const buildContainer = (overrides = {}) => {
  const repository = overrides.repository ?? new InMemoryFoundDocumentRepository();
  const idGenerator = overrides.idGenerator ?? new UuidIdGenerator();
  const clock = overrides.clock ?? new SystemClock();

  const foundDocumentService = new FoundDocumentService({ repository, idGenerator, clock });

  const foundDocumentController = new FoundDocumentController({
    reportUseCase: foundDocumentService,
    searchUseCase: foundDocumentService,
    recoverUseCase: foundDocumentService,
  });

  const server = createHttpServer({ foundDocumentController });

  return { repository, foundDocumentService, foundDocumentController, server };
};
