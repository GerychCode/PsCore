import { Test, TestingModule } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { WorkShiftTagController } from '../src/work.shift.tag/work.shift.tag.controller';
import { WorkShiftTagService } from '../src/work.shift.tag/work.shift.tag.service';
import { AuthGuard } from '../src/common/guard/auth.guard';
import { RolesGuard } from '../src/common/guard/role.guard';

describe('WorkShiftTag (e2e)', () => {
  let app: INestApplication;

  const tagService = {
    getAllTags: jest.fn(),
    getTagById: jest.fn(),
    createTag: jest.fn(),
    updateTag: jest.fn(),
    deleteTag: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 1, role: 'Admin' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WorkShiftTagController],
      providers: [{ provide: WorkShiftTagService, useValue: tagService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(allowGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  it('GET /shift-tag повертає список тегів', () => {
    tagService.getAllTags.mockResolvedValue([{ id: 1, name: 'Запізнення' }]);

    return request(app.getHttpServer())
      .get('/shift-tag')
      .expect(200)
      .expect([{ id: 1, name: 'Запізнення' }]);
  });

  it('GET /shift-tag/:id перетворює параметр на число', async () => {
    tagService.getTagById.mockResolvedValue({ id: 7, name: 'Прогул' });

    await request(app.getHttpServer())
      .get('/shift-tag/7')
      .expect(200)
      .expect({ id: 7, name: 'Прогул' });

    expect(tagService.getTagById).toHaveBeenCalledWith(7);
  });

  it('GET /shift-tag/:id повертає 400 для нечислового id', () => {
    return request(app.getHttpServer()).get('/shift-tag/abc').expect(400);
  });

  it('POST /shift-tag створює тег', async () => {
    tagService.createTag.mockResolvedValue({ id: 9, name: 'Понаднормово' });

    await request(app.getHttpServer())
      .post('/shift-tag')
      .send({ name: 'Понаднормово', severity: 2 })
      .expect(201)
      .expect({ id: 9, name: 'Понаднормово' });

    expect(tagService.createTag).toHaveBeenCalledWith({
      name: 'Понаднормово',
      severity: 2,
    });
  });

  it('DELETE /shift-tag/:id видаляє тег', async () => {
    tagService.deleteTag.mockResolvedValue({ id: 9 });

    await request(app.getHttpServer()).delete('/shift-tag/9').expect(200);

    expect(tagService.deleteTag).toHaveBeenCalledWith(
      { id: 1, role: 'Admin' },
      9,
    );
  });
});
