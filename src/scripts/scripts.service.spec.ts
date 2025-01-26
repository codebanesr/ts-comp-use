import { Test, TestingModule } from '@nestjs/testing';
import { ScriptsService } from './scripts.service';

describe('ScriptsService', () => {
  let service: ScriptsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScriptsService],
    }).compile();

    service = module.get<ScriptsService>(ScriptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
