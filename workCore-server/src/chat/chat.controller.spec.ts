import { ChatController } from './chat.controller';

describe('ChatController', () => {
  let service: any;
  let controller: ChatController;

  beforeEach(() => {
    service = {
      getConversations: jest.fn().mockReturnValue('conv'),
      getUnreadCount: jest.fn().mockReturnValue('unread'),
      getConversation: jest.fn().mockReturnValue('dialog'),
      markConversationRead: jest.fn().mockReturnValue('read'),
    };
    controller = new ChatController(service);
  });

  it('getConversations', () => {
    expect(controller.getConversations(1)).toBe('conv');
    expect(service.getConversations).toHaveBeenCalledWith(1);
  });

  it('getUnreadCount', () => {
    expect(controller.getUnreadCount(1)).toBe('unread');
    expect(service.getUnreadCount).toHaveBeenCalledWith(1);
  });

  it('getConversation з валідним курсором', () => {
    controller.getConversation(1, 2, '5');
    expect(service.getConversation).toHaveBeenCalledWith(1, 2, 5);
  });

  it('getConversation без курсора', () => {
    controller.getConversation(1, 2, undefined);
    expect(service.getConversation).toHaveBeenCalledWith(1, 2, undefined);
  });

  it('getConversation з нечисловим курсором → undefined', () => {
    controller.getConversation(1, 2, 'abc');
    expect(service.getConversation).toHaveBeenCalledWith(1, 2, undefined);
  });

  it('markConversationRead', () => {
    expect(controller.markConversationRead(1, 2)).toBe('read');
    expect(service.markConversationRead).toHaveBeenCalledWith(1, 2);
  });
});
