import { WorkShiftTagController } from './work.shift.tag.controller';

describe('WorkShiftTagController', () => {
  let controller: WorkShiftTagController;
  let service: any;

  const user = { id: 1, role: 'Admin' } as any;

  beforeEach(() => {
    service = {
      getAllTags: jest.fn().mockResolvedValue([]),
      getTagById: jest.fn().mockResolvedValue({ id: 1 }),
      createTag: jest.fn().mockResolvedValue({ id: 1 }),
      updateTag: jest.fn().mockResolvedValue({ id: 1 }),
      deleteTag: jest.fn().mockResolvedValue({ id: 1 }),
    };
    controller = new WorkShiftTagController(service);
  });

  it('getAllTags делегує', async () => {
    await controller.getAllTags();
    expect(service.getAllTags).toHaveBeenCalled();
  });

  it('getTagById делегує за id', async () => {
    await controller.getTagById(2);
    expect(service.getTagById).toHaveBeenCalledWith(2);
  });

  it('createTag делегує', async () => {
    const dto = { name: 'Тег' } as any;
    await controller.createTag(dto);
    expect(service.createTag).toHaveBeenCalledWith(dto);
  });

  it('updateTag делегує', async () => {
    const dto = { name: 'Новий' } as any;
    await controller.updateTag(2, dto);
    expect(service.updateTag).toHaveBeenCalledWith(2, dto);
  });

  it('deleteTag делегує за id', async () => {
    await controller.deleteTag(2);
    expect(service.deleteTag).toHaveBeenCalledWith(2);
  });
});
