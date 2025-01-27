import { NestFactory } from '@nestjs/core';
import { ScriptsModule } from './scripts/scripts.module';
import { ScriptsService } from './scripts/scripts.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(ScriptsModule);

  app.enableCors();
  await app.listen(3000);

  console.log('Application is running on: http://localhost:3000');
}

bootstrap();
