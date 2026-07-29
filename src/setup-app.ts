import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Request-handling wiring shared by the real server (main.ts) and the e2e test
 * app. Anything a test should exercise belongs here rather than in bootstrap():
 * when the two drifted apart, a main.ts-only feature (Swagger) could be dropped
 * without a single test failing.
 *
 * Environment-dependent bootstrap concerns — CORS origins, shutdown hooks, the
 * listen port — stay in main.ts, since tests drive the app in-process.
 */
export function configureApp(app: INestApplication): OpenAPIObject {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  return setupSwagger(app);
}

/**
 * OpenAPI docs served at the root so `GET /` is the interactive Swagger UI.
 * These routes are registered on the HTTP adapter, so the global JwtAuthGuard
 * doesn't cover them — the docs are reachable without a token, as intended.
 */
export function setupSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Bloom Room API')
    .setDescription('Auth and identity API for the Bloom Room apps.')
    .setVersion('1.0')
    // Lets the UI's "Authorize" button attach `Authorization: Bearer <jwt>`,
    // so protected routes like GET /me can be tried from the page.
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Mount UI at root; serve the raw spec at a clean /swagger.json (the default
  // for a root mount would be the awkward "/-json").
  SwaggerModule.setup('/', app, document, { jsonDocumentUrl: 'swagger.json' });
  return document;
}
