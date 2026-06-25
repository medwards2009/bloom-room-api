import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Browser clients (bloom-room-web) call this API cross-origin. Auth is via
  // Bearer token, not cookies, so reflecting the request origin is enough for
  // now; lock this to an allow-list before production.
  app.enableCors({ origin: true });
  await app.listen(process.env.PORT ?? 8080);
}
void bootstrap();
