import { InvitationsController } from './invitations.controller';

describe('InvitationsController', () => {
  let service: any;
  let controller: InvitationsController;

  beforeEach(() => {
    service = {
      createInvitation: jest.fn().mockReturnValue('created'),
      sendInvitationEmail: jest.fn().mockReturnValue('sent'),
      getInvitation: jest.fn().mockReturnValue('info'),
      acceptInvitation: jest.fn().mockReturnValue('accepted'),
    };
    controller = new InvitationsController(service);
  });

  it('create', () => {
    const dto = { email: 'a@a.com' } as any;
    expect(controller.create(dto)).toBe('created');
    expect(service.createInvitation).toHaveBeenCalledWith(dto);
  });

  it('send', () => {
    expect(controller.send(3)).toBe('sent');
    expect(service.sendInvitationEmail).toHaveBeenCalledWith(3);
  });

  it('getByToken', () => {
    expect(controller.getByToken('tok')).toBe('info');
    expect(service.getInvitation).toHaveBeenCalledWith('tok');
  });

  it('accept', () => {
    const dto = { token: 't', password: 'Pass1234' } as any;
    expect(controller.accept(dto)).toBe('accepted');
    expect(service.acceptInvitation).toHaveBeenCalledWith('t', 'Pass1234');
  });
});
