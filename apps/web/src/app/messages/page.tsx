'use client';

import React, { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageCircle,
  Send,
  Film,
  ArrowLeft,
  UserPlus,
  ExternalLink,
  Check,
  CheckCheck,
  Sparkles,
  Search,
  X,
  UserCheck,
} from 'lucide-react';
import { authFetch, useAuthStore } from '../../stores/auth.store';

interface FriendUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface DirectMessageItem {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  movieTmdbId: number | null;
  movieMediaType: 'MOVIE' | 'SERIES' | null;
  movieTitle: string | null;
  moviePosterPath: string | null;
  isRead: boolean;
  createdAt: string;
}

interface ConversationSummary {
  friend: FriendUser;
  unreadCount: number;
  lastMessage: DirectMessageItem | null;
}

function formatMessageTime(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  } catch {
    return '';
  }
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFriendId = searchParams.get('friend');

  const { user, accessToken, hydrated, hydrate } = useAuthStore();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFriendId);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  // Add Friend modal & requests state
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [friendToast, setFriendToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMsgCountRef = useRef(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace('/auth');
    }
  }, [hydrated, accessToken, router]);

  useEffect(() => {
    if (initialFriendId) {
      setSelectedFriendId(initialFriendId);
    }
  }, [initialFriendId]);

  const loadConversations = useCallback(async () => {
    if (!accessToken) return;
    const [convRes, friendsRes] = await Promise.all([
      authFetch('/social/messages/conversations', { cache: 'no-store' }).catch(() => null),
      authFetch('/social/friends', { cache: 'no-store' }).catch(() => null),
    ]);
    if (convRes?.ok) {
      const data = await convRes.json();
      const list: ConversationSummary[] = data.conversations || [];
      setConversations(list);
      if (!selectedFriendId && !initialFriendId && list.length > 0 && window.innerWidth >= 768) {
        setSelectedFriendId(list[0].friend.id);
      }
    }
    if (friendsRes?.ok) {
      const fData = await friendsRes.json();
      setIncomingRequests(fData.incomingRequests || []);
      setOutgoingRequests(fData.outgoingRequests || []);
    }
    setLoadingList(false);
  }, [accessToken, selectedFriendId, initialFriendId]);

  // Live user search inside Add Friend modal
  useEffect(() => {
    if (!isAddFriendOpen || !accessToken) return;
    const q = userSearchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchingUsers(false);
      return;
    }
    let cancelled = false;
    setSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/social/users/search?q=${encodeURIComponent(q)}`, {
          cache: 'no-store',
        });
        if (res.ok && !cancelled) {
          setSearchResults(await res.json());
        }
      } finally {
        if (!cancelled) setSearchingUsers(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userSearchQuery, isAddFriendOpen, accessToken]);

  const notifyFriend = (msg: string) => {
    setFriendToast(msg);
    setTimeout(() => setFriendToast((prev) => (prev === msg ? null : prev)), 3500);
  };

  const handleSendFriendRequest = async (payload: { email?: string; targetUserId?: string }) => {
    if (!accessToken) return;
    const res = await authFetch('/social/friends/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (payload.email) setFriendEmail('');
      notifyFriend('Запрос в друзья отправлен!');
      await loadConversations();
    } else {
      notifyFriend(data?.message || 'Не удалось отправить запрос');
    }
  };

  const handleAcceptFriend = async (requestId: string, friendUserId?: string) => {
    if (!accessToken) return;
    const res = await authFetch(`/social/friends/${requestId}/accept`, {
      method: 'POST',
    });
    if (res.ok) {
      notifyFriend('Друг добавлен! Теперь можно общаться.');
      await loadConversations();
      if (friendUserId) setSelectedFriendId(friendUserId);
    }
  };

  const handleRejectFriend = async (requestId: string) => {
    if (!accessToken) return;
    const res = await authFetch(`/social/friends/${requestId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadConversations();
    }
  };

  const loadThread = useCallback(
    async (friendId: string, silent = false) => {
      if (!accessToken) return;
      if (!silent) setLoadingChat(true);
      const res = await authFetch(`/social/messages/${encodeURIComponent(friendId)}`, {
        cache: 'no-store',
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        setActiveFriend(data.friend || null);
        setMessages(data.messages || []);
      }
      if (!silent) setLoadingChat(false);
    },
    [accessToken]
  );

  useEffect(() => {
    if (accessToken) {
      loadConversations();
    }
  }, [accessToken, loadConversations]);

  useEffect(() => {
    if (accessToken && selectedFriendId) {
      prevMsgCountRef.current = 0;
      loadThread(selectedFriendId, false);
    }
  }, [accessToken, selectedFriendId, loadThread]);

  // Live polling every 3.5 seconds
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      loadConversations();
      if (selectedFriendId) {
        loadThread(selectedFriendId, true);
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [accessToken, selectedFriendId, loadConversations, loadThread]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendId || !draft.trim() || sending) return;

    setSending(true);
    const text = draft.trim();
    setDraft('');

    try {
      const res = await authFetch(`/social/messages/${encodeURIComponent(selectedFriendId)}`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const created = await res.json();
        setMessages((prev) => [...prev, created]);
        loadConversations();
      } else {
        setDraft(text);
      }
    } finally {
      setSending(false);
    }
  };

  if (!hydrated || !user) return null;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-16 pb-24 md:pb-8 min-h-screen bg-[#09090D] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 pb-4 mb-4 border-b border-[#292936]">
        <div>
          <div className="flex items-center gap-2 text-[#A18BFF] text-xs font-bold uppercase tracking-widest mb-1">
            <MessageCircle className="w-4 h-4" />
            <span>Мессенджер 67movies</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Чат с друзьями
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsAddFriendOpen(true)}
          className="relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl brand-btn text-xs font-bold text-white transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Добавить друга</span>
          {incomingRequests.length > 0 && (
            <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
              {incomingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Chat Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[540px] max-h-[calc(100vh-190px)]">
        {/* Left Sidebar: Friends & Conversations */}
        <aside
          className={`${
            selectedFriendId ? 'hidden md:flex' : 'flex'
          } md:col-span-4 lg:col-span-4 flex-col rounded-3xl bg-[#111119] border border-[#292936] overflow-hidden`}
        >
          <div className="px-4 py-3.5 border-b border-[#292936] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#92929F]">
              Диалоги ({conversations.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Incoming Friend Requests right inside Chat Sidebar */}
            {incomingRequests.length > 0 && (
              <div className="mb-2 p-2.5 rounded-2xl bg-[#8065FF]/10 border border-[#8065FF]/35 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#A18BFF] px-1">
                  Заявки в друзья ({incomingRequests.length})
                </p>
                {incomingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#181821] border border-[#292936]"
                  >
                    <span className="text-xs font-bold text-white truncate">
                      {req.from?.name || 'Пользователь'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAcceptFriend(req.requestId, req.from?.id)}
                        className="px-2.5 py-1 rounded-lg brand-btn text-white text-[11px] font-bold"
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectFriend(req.requestId)}
                        className="p-1 rounded-lg text-[#92929F] hover:text-red-400"
                        title="Отклонить"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {loadingList ? (
              <div className="p-8 text-center text-xs text-[#92929F]">Загрузка чатов...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <MessageCircle className="w-10 h-10 text-[#A18BFF] mx-auto opacity-60" />
                <p className="text-sm font-bold text-white">Пока нет друзей в чате</p>
                <p className="text-xs text-[#92929F] leading-relaxed">
                  Найдите друга по имени или email прямо здесь, чтобы переписываться и отправлять
                  друг другу фильмы.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddFriendOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl brand-btn text-white text-xs font-bold"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Добавить друга</span>
                </button>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.friend.id === selectedFriendId;
                const previewText = conv.lastMessage
                  ? conv.lastMessage.movieTitle
                    ? `🎬 ${conv.lastMessage.movieTitle}${
                        conv.lastMessage.content ? ` — ${conv.lastMessage.content}` : ''
                      }`
                    : conv.lastMessage.content
                  : 'Начните переписку...';

                return (
                  <button
                    key={conv.friend.id}
                    type="button"
                    onClick={() => setSelectedFriendId(conv.friend.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                      isSelected
                        ? 'bg-[#8065FF]/15 border border-[#8065FF]/50'
                        : 'hover:bg-[#181821] border border-transparent'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#181821] border border-[#292936] flex items-center justify-center shrink-0">
                      {conv.friend.avatarUrl ? (
                        <img
                          src={conv.friend.avatarUrl}
                          alt={conv.friend.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-base font-black text-[#A18BFF] uppercase">
                          {conv.friend.name.slice(0, 1)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white truncate">{conv.friend.name}</p>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-[#92929F] shrink-0">
                            {formatMessageTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-[#92929F] truncate">{previewText}</p>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#8065FF] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Panel: Active Chat Thread */}
        <section
          className={`${
            selectedFriendId ? 'flex' : 'hidden md:flex'
          } md:col-span-8 lg:col-span-8 flex-col rounded-3xl bg-[#111119] border border-[#292936] overflow-hidden`}
        >
          {!selectedFriendId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[#8065FF]/15 border border-[#8065FF]/30 flex items-center justify-center text-[#A18BFF]">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white">Выберите друга для переписки</h2>
              <p className="text-xs text-[#92929F] max-w-sm leading-relaxed">
                Обсуждайте кино и отправляйте друзьям карточки фильмов прямо со страницы любого
                фильма кнопкой «Отправить другу».
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-[#292936] flex items-center justify-between gap-3 bg-[#111119]">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedFriendId(null)}
                    className="md:hidden p-2 rounded-xl bg-[#181821] text-[#92929F] hover:text-white"
                    aria-label="Назад к списку"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#181821] border border-[#292936] flex items-center justify-center shrink-0">
                    {activeFriend?.avatarUrl ? (
                      <img
                        src={activeFriend.avatarUrl}
                        alt={activeFriend.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-black text-[#A18BFF] uppercase">
                        {(activeFriend?.name || '?').slice(0, 1)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {activeFriend?.name || 'Загрузка...'}
                    </p>
                    <p className="text-[11px] text-[#92929F]">Друг в 67movies</p>
                  </div>
                </div>

                {activeFriend && (
                  <Link
                    href={`/user/${activeFriend.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181821] hover:bg-[#8065FF]/20 border border-[#292936] hover:border-[#8065FF] text-xs font-semibold text-[#A18BFF] transition-all shrink-0"
                  >
                    <span>Профиль</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#09090D]/50">
                {loadingChat ? (
                  <div className="py-12 text-center text-xs text-[#92929F]">
                    Загрузка сообщений...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <p className="text-sm font-bold text-white">Сообщений пока нет</p>
                    <p className="text-xs text-[#92929F]">
                      Напишите привет или отправьте фильм со страницы любого тайтла!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === user.id;
                    const movieHref = msg.movieTmdbId
                      ? `/movie/${msg.movieTmdbId}?type=${
                          msg.movieMediaType === 'SERIES' ? 'tv' : 'movie'
                        }`
                      : null;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 space-y-2 ${
                            isMine
                              ? 'bg-[#8065FF] text-white rounded-br-md'
                              : 'bg-[#181821] border border-[#292936] text-white rounded-bl-md'
                          }`}
                        >
                          {/* Embedded Shared Movie Card */}
                          {movieHref && msg.movieTitle && (
                            <Link
                              href={movieHref}
                              className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                                isMine
                                  ? 'bg-black/25 hover:bg-black/35 border border-white/15'
                                  : 'bg-[#111119] hover:border-[#8065FF] border border-[#292936]'
                              }`}
                            >
                              <div className="w-12 h-18 rounded-lg overflow-hidden bg-[#09090D] shrink-0 flex items-center justify-center">
                                {msg.moviePosterPath ? (
                                  <img
                                    src={msg.moviePosterPath}
                                    alt={msg.movieTitle}
                                    className="w-12 h-[72px] object-cover group-hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <Film className="w-5 h-5 text-[#92929F]" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mb-1 ${
                                    isMine
                                      ? 'bg-white/20 text-white'
                                      : 'bg-[#8065FF]/20 text-[#A18BFF]'
                                  }`}
                                >
                                  {msg.movieMediaType === 'SERIES' ? 'Сериал' : 'Фильм'}
                                </span>
                                <p className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
                                  {msg.movieTitle}
                                </p>
                                <p
                                  className={`text-[10px] mt-1 font-semibold ${
                                    isMine ? 'text-white/80' : 'text-[#A18BFF]'
                                  }`}
                                >
                                  Открыть страницу →
                                </p>
                              </div>
                            </Link>
                          )}

                          {/* Text Content */}
                          {msg.content && (
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed px-0.5">
                              {msg.content}
                            </p>
                          )}

                          {/* Timestamp + Read Check */}
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] ${
                              isMine ? 'text-white/75' : 'text-[#92929F]'
                            }`}
                          >
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {isMine &&
                              (msg.isRead ? (
                                <CheckCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Bar */}
              <form
                onSubmit={handleSend}
                className="p-3 sm:p-4 border-t border-[#292936] bg-[#111119] flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Напишите сообщение..."
                  className="flex-1 px-4 py-3 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 rounded-xl brand-btn text-white text-sm font-bold disabled:opacity-45 transition-all shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Отправить</span>
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Add Friend Modal right inside Messenger */}
      {isAddFriendOpen && (
        <div
          onClick={() => setIsAddFriendOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#111119] border border-[#292936] rounded-3xl p-6 text-white shadow-2xl space-y-5 animate-scaleIn"
          >
            <div className="flex items-center justify-between border-b border-[#292936] pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#A18BFF]" />
                <h3 className="text-base font-bold">Добавить друга</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddFriendOpen(false)}
                className="p-1 text-[#92929F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {friendToast && (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#8065FF]/15 border border-[#8065FF]/40 text-xs font-semibold text-white">
                {friendToast}
              </div>
            )}

            {/* Add directly by Email */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (friendEmail.trim()) handleSendFriendRequest({ email: friendEmail.trim() });
              }}
              className="space-y-2"
            >
              <label className="text-xs font-semibold text-[#92929F]">По Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl brand-btn text-white text-xs font-bold shrink-0"
                >
                  Отправить
                </button>
              </div>
            </form>

            {/* Live Search by Name */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-[#92929F]">
                Или найти по имени в 67movies
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#92929F] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Введите имя пользователя..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                />
              </div>

              {searchingUsers && (
                <p className="text-xs text-[#92929F] px-1">Поиск пользователей...</p>
              )}

              {!searchingUsers && userSearchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-[#92929F] px-1">Пользователи не найдены.</p>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                  {searchResults.map((u) => {
                    const isAlreadyFriend = conversations.some((c) => c.friend.id === u.id);
                    const isOutgoing = outgoingRequests.some((r) => r.to?.id === u.id);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#181821] border border-[#292936]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-[#09090D] flex items-center justify-center shrink-0">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt={u.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-black text-[#A18BFF] uppercase">
                                {u.name.slice(0, 1)}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-white truncate">{u.name}</span>
                        </div>

                        {isAlreadyFriend ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFriendId(u.id);
                              setIsAddFriendOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold shrink-0"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>В чат</span>
                          </button>
                        ) : isOutgoing ? (
                          <span className="text-[11px] font-semibold text-[#92929F] px-2.5">
                            Отправлено
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSendFriendRequest({ targetUserId: u.id })}
                            className="px-3 py-1.5 rounded-xl brand-btn text-white text-xs font-bold shrink-0"
                          >
                            Добавить
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outgoing Pending Requests */}
            {outgoingRequests.length > 0 && (
              <div className="pt-2 border-t border-[#292936] space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#92929F]">
                  Отправленные заявки ({outgoingRequests.length})
                </p>
                {outgoingRequests.map((req) => (
                  <div
                    key={req.requestId}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-[#181821] border border-[#292936]"
                  >
                    <span className="font-semibold text-white">{req.to?.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRejectFriend(req.requestId)}
                      className="text-[#92929F] hover:text-red-400"
                    >
                      Отменить
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090D] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#8065FF] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
