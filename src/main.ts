import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup-app';

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Validation pipe + Swagger docs. Shared with the e2e test app so the suite
  // exercises the same wiring the real server runs — see src/setup-app.ts.
  configureApp(app);

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

  // Close the DB pool and drain in-flight requests when k8s sends SIGTERM.
  app.enableShutdownHooks();

  await app.listen(config.get<number>('PORT') ?? 8080);
}
void bootstrap();
