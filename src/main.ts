import { NestFactory } from '@nestjs/core';
import { ScriptsModule } from './scripts/scripts.module';
import { ScriptsService } from './scripts/scripts.service';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ScriptsModule);
  const scriptsService = app.get(ScriptsService);

  scriptsService.runScriptOne();

  await app.close();
}

bootstrap();
