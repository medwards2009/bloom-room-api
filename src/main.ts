import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Browser clients (bloom-room-web) call this API cross-origin. Native mobile
  // clients send no Origin header and are unaffected by any of this.
  const origins = parseOrigins(config.get<string>('CORS_ORIGINS'));
  if (origins.length) {
    app.enableCors({ origin: origins });
  } else if (config.get<boolean>('AUTH_DEV_MODE')) {
    // Local work only: reflect whatever origin asks.
    app.enableCors({ origin: true });
  }
  // Otherwise CORS stays off: a real environment must name its origins.

  // OpenAPI docs served at the root so `GET /` is the interactive Swagger UI.
  // These routes are registered on the HTTP adapter, so the global JwtAuthGuard
  // doesn't cover them — the docs are reachable without a token, as intended.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Bloom Room API')
    .setDescription('Auth and identity API for the Bloom Room apps.')
    .setVersion('1.0')
    // Lets the UI's "Authorize" button attach `Authorization: Bearer <jwt>`,
    // so protected routes like GET /me can be tried from the page.
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Mount UI at root; serve the raw spec at a clean /swagger.json (the default
  // for a root mount would be the awkward "/-json").
  SwaggerModule.setup('/', app, document, { jsonDocumentUrl: 'swagger.json' });

  // Close the DB pool and drain in-flight requests when k8s sends SIGTERM.
  app.enableShutdownHooks();

  await app.listen(config.get<number>('PORT') ?? 8080);
}
void bootstrap();
