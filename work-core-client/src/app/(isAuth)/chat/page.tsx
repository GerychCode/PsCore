'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { IoSend } from 'react-icons/io5'
import { FaArrowLeft } from 'react-icons/fa'
import Avatar from '@/app/components/user/Avatar'
import { userStore } from '@/store/user.store'
import { chatStore } from '@/store/chat.store'
import { chatService } from '@/service/chat.service'
import { userService } from '@/service/user.service'
import { IChatMessage, IChatPartner, IConversation } from '@/interface/IChat'

export default function ChatPage() {
  const currentUser = userStore((state) => state.user)
  const queryClient = useQueryClient()

  const [selectedPartner, setSelectedPartner] = useState<IChatPartner | null>(
    null
  )
  const [messages, setMessages] = useState<IChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const selectedPartnerRef = useRef<IChatPartner | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  selectedPartnerRef.current = selectedPartner

  const { data: conversationsResponse } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => chatService.getConversations(),
    enabled: !!currentUser?.id,
  })
  const conversations: IConversation[] = conversationsResponse?.data ?? []

  const { data: usersResponse } = useQuery({
    queryKey: ['chat-users'],
    queryFn: () => userService.getUsersData(),
    enabled: !!currentUser?.id,
  })

  // Всі співробітники (крім себе): спершу активні діалоги, далі за алфавітом
  const chatList = useMemo(() => {
    const users: IChatPartner[] = (usersResponse?.data ?? []).filter(
      (u: IChatPartner) => u.id !== currentUser?.id
    )
    const conversationByPartner = new Map(
      conversations.map((c) => [c.partner.id, c])
    )
    return users
      .map((user) => ({
        user,
        conversation: conversationByPartner.get(user.id) ?? null,
      }))
      .sort((a, b) => {
        const aLast = a.conversation?.lastMessage?.id ?? 0
        const bLast = b.conversation?.lastMessage?.id ?? 0
        if (aLast !== bLast) return bLast - aLast
        return `${a.user.firstName} ${a.user.lastName}`.localeCompare(
          `${b.user.firstName} ${b.user.lastName}`,
          'uk'
        )
      })
  }, [usersResponse?.data, conversations, currentUser?.id])

  const refreshConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
  }, [queryClient])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Єдине сокет-зʼєднання сторінки чату
  useEffect(() => {
    if (!currentUser?.id) return

    const socket = io(
      process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3022',
      { withCredentials: true }
    )
    socketRef.current = socket

    socket.on('chat:message', (message: IChatMessage) => {
      const partner = selectedPartnerRef.current
      const isForOpenedChat =
        partner &&
        (message.senderId === partner.id || message.receiverId === partner.id)

      if (isForOpenedChat) {
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message]
        )
        // Відкритий діалог — одразу позначаємо вхідне прочитаним
        if (message.senderId === partner.id) {
          socket.emit('chat:read', { partnerId: partner.id })
        }
      }
      refreshConversations()
      // Реконсиляція глобального лічильника (вхідне в інший діалог / прочитання)
      chatStore.getState().refresh()
    })

    socket.on('chat:read', ({ readerId }: { readerId: number }) => {
      if (selectedPartnerRef.current?.id === readerId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.receiverId === readerId ? { ...m, isRead: true } : m
          )
        )
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [currentUser?.id, refreshConversations])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  const openConversation = async (partner: IChatPartner) => {
    setSelectedPartner(partner)
    setMessages([])
    setHasMore(false)
    try {
      const response = await chatService.getConversation(partner.id)
      setMessages(response.data.messages)
      setHasMore(response.data.hasMore)
      await chatService.markConversationRead(partner.id)
      refreshConversations()
      chatStore.getState().refresh()
    } catch {
      toast.error('Не вдалося завантажити діалог')
    }
  }

  const loadOlderMessages = async () => {
    if (!selectedPartner || messages.length === 0) return
    const container = messagesContainerRef.current
    const previousHeight = container?.scrollHeight ?? 0
    try {
      const response = await chatService.getConversation(
        selectedPartner.id,
        messages[0].id
      )
      setMessages((prev) => [...response.data.messages, ...prev])
      setHasMore(response.data.hasMore)
      // Зберігаємо позицію скролу після додавання повідомлень зверху
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - previousHeight
        }
      })
    } catch {
      toast.error('Не вдалося завантажити старіші повідомлення')
    }
  }

  const sendMessage = () => {
    const content = messageText.trim()
    if (!content || !selectedPartner || !socketRef.current || isSending) return

    setIsSending(true)
    socketRef.current.emit(
      'chat:send',
      { receiverId: selectedPartner.id, content },
      (response: { message?: IChatMessage; error?: string }) => {
        setIsSending(false)
        if (response?.error) {
          toast.error(response.error)
          return
        }
        // Саме повідомлення прийде подією chat:message — тут лише чистимо інпут
        setMessageText('')
      }
    )
  }

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatPreviewDate = (date: string) => {
    const messageDate = new Date(date)
    const today = new Date()
    return messageDate.toDateString() === today.toDateString()
      ? formatTime(date)
      : messageDate.toLocaleDateString('uk-UA', {
          day: '2-digit',
          month: '2-digit',
        })
  }

  return (
    <div className='flex h-full w-full gap-5'>
      {/* Список діалогів */}
      <div
        className={`flex-col w-full md:w-80 md:flex shrink-0 rounded-2xl shadow-xs border-1 border-secondary/10 bg-white overflow-hidden ${
          selectedPartner ? 'hidden' : 'flex'
        }`}
      >
        <div className='px-5 py-4 border-b border-secondary/10'>
          <h3 className='font-semibold text-black text-lg'>Повідомлення</h3>
        </div>
        <ul className='flex-grow overflow-y-auto custom-scrollbar'>
          {chatList.length === 0 ? (
            <li className='p-6 text-center text-secondary text-sm'>
              Немає співробітників для спілкування
            </li>
          ) : (
            chatList.map(({ user, conversation }) => (
              <li
                key={user.id}
                onClick={() => openConversation(user)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-secondary/5 hover:bg-slate-50 transition-colors ${
                  selectedPartner?.id === user.id ? 'bg-slate-50' : ''
                }`}
              >
                <Avatar avatar={user.avatar} size={2.75} />
                <div className='flex flex-col min-w-0 flex-grow'>
                  <div className='flex justify-between items-center gap-2'>
                    <span className='font-medium text-black truncate'>
                      {user.firstName} {user.lastName}
                    </span>
                    {conversation?.lastMessage && (
                      <span className='text-[10px] text-secondary shrink-0'>
                        {formatPreviewDate(conversation.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className='flex justify-between items-center gap-2'>
                    <span className='text-xs text-secondary truncate'>
                      {conversation?.lastMessage
                        ? `${
                            conversation.lastMessage.senderId ===
                            currentUser?.id
                              ? 'Ви: '
                              : ''
                          }${conversation.lastMessage.content}`
                        : 'Почніть розмову'}
                    </span>
                    {(conversation?.unreadCount ?? 0) > 0 && (
                      <span className='bg-primary text-white text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center shrink-0'>
                        {conversation!.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Вікно діалогу */}
      <div
        className={`flex-col flex-grow md:flex rounded-2xl shadow-xs border-1 border-secondary/10 bg-white overflow-hidden ${
          selectedPartner ? 'flex' : 'hidden'
        }`}
      >
        {selectedPartner ? (
          <>
            <div className='flex items-center gap-3 px-5 py-3 border-b border-secondary/10'>
              <FaArrowLeft
                className='md:hidden text-secondary cursor-pointer hover:opacity-75'
                onClick={() => setSelectedPartner(null)}
              />
              <Avatar avatar={selectedPartner.avatar} size={2.5} />
              <h3 className='font-semibold text-black'>
                {selectedPartner.firstName} {selectedPartner.lastName}
              </h3>
            </div>

            <div
              ref={messagesContainerRef}
              className='flex-grow overflow-y-auto custom-scrollbar p-5 flex flex-col gap-2'
            >
              {hasMore && (
                <button
                  onClick={loadOlderMessages}
                  className='self-center text-xs text-primary hover:opacity-75 mb-2'
                >
                  Завантажити старіші повідомлення
                </button>
              )}
              {messages.length === 0 ? (
                <p className='m-auto text-secondary text-sm'>
                  Повідомлень поки немає — напишіть першим!
                </p>
              ) : (
                messages.map((message) => {
                  const isMine = message.senderId === currentUser?.id
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          isMine
                            ? 'bg-primary text-white rounded-br-sm'
                            : 'bg-slate-100 text-black rounded-bl-sm'
                        }`}
                      >
                        <p>{message.content}</p>
                        <p
                          className={`text-[10px] mt-1 text-right ${
                            isMine ? 'text-white/70' : 'text-secondary'
                          }`}
                        >
                          {formatTime(message.createdAt)}
                          {isMine && (message.isRead ? ' ✓✓' : ' ✓')}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className='flex items-center gap-3 px-5 py-4 border-t border-secondary/10'>
              <input
                type='text'
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder='Напишіть повідомлення...'
                maxLength={2000}
                className='flex-grow px-4 py-2 rounded-xl border border-secondary/20 focus:outline-none focus:border-primary text-sm'
              />
              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || isSending}
                className='p-3 rounded-xl bg-primary text-white hover:opacity-90 disabled:opacity-40 transition-opacity'
              >
                <IoSend />
              </button>
            </div>
          </>
        ) : (
          <div className='m-auto text-secondary text-sm hidden md:block'>
            Оберіть співробітника, щоб почати спілкування
          </div>
        )}
      </div>
    </div>
  )
}
