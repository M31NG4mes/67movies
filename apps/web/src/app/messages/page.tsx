'use client';

import React, { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  ImagePlus,
  Smile,
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
  imageUrl?: string | null;
  gifUrl?: string | null;
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
  isTyping?: boolean;
  lastMessage: DirectMessageItem | null;
}

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Популярные',
    emojis: ['😂', '🔥', '❤️', '😍', '😎', '😭', '🤯', '🤩', '👍', '👏', '🙌', '💯', '✨', '🎉', '👀', '🤔'],
  },
  {
    label: 'Кино',
    emojis: ['🎬', '🍿', '🎥', '🎞️', '🎭', '⭐', '🏆', '👻', '🚀', '👽', '🦸', '🕵️', '🐉', '🎧', '📺', '🎟️'],
  },
  {
    label: 'Реакции',
    emojis: ['😱', '🤣', '🥹', '😤', '😴', '🥳', '😈', '💀', '🤡', '🫡', '🤝', '🫶', '🙏', '💪', '⚡', '❄️'],
  },
];

const CURATED_GIFS: { title: string; tags: string; url: string }[] = [
  {
    title: 'Попкорн',
    tags: 'popcorn кино попкорн смотрю movie',
    url: 'https://media.giphy.com/media/pUeXcg80cO8I8/giphy.gif',
  },
  {
    title: 'Аплодисменты',
    tags: 'clap браво аплодисменты дикаприо dicaprio',
    url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
  },
  {
    title: 'Шедевр',
    tags: 'cinema absolute шедевр скорсезе fire огонь',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
  {
    title: 'Взрыв мозга',
    tags: 'mind blown шок взрыв мозга wow',
    url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
  },
  {
    title: 'Смех',
    tags: 'laugh смех ржу lol haha',
    url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
  },
  {
    title: 'Огонь',
    tags: 'fire огонь круто cool yes',
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  },
  {
    title: 'Шок',
    tags: 'shocked удивление omg шок',
    url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif',
  },
  {
    title: 'Жду',
    tags: 'waiting жду время clock',
    url: 'https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif',
  },
  {
    title: 'Привет',
    tags: 'hi hello привет здарова wave',
    url: 'https://media.giphy.com/media/3og0IQCsqncpVWxyTu/giphy.gif',
  },
  {
    title: 'Грусть',
    tags: 'sad грусть плачу cry',
    url: 'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif',
  },
  {
    title: 'Сердце',
    tags: 'love любовь сердце heart',
    url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
  },
  {
    title: 'Кот смотрит',
    tags: 'cat кот смотрю кино',
    url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  },
];

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

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Некорректное изображение'));
      img.onload = () => {
        const maxSide = 1280;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFriendId = searchParams.get('friend');

  const { user, accessToken, hydrated, hydrate } = useAuthStore();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFriendId);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  // Emoji & GIF Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'gif'>('emoji');
  const [gifSearch, setGifSearch] = useState('');

  // Fullscreen image lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(0);
  const lastTypingPingRef = useRef(0);

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
        setIsFriendTyping(Boolean(data.isFriendTyping));
      }
      if (!silent) setLoadingChat(false);
    },
    [accessToken]
  );

  useEffect(() => {
    if (accessToken) loadConversations();
  }, [accessToken, loadConversations]);

  useEffect(() => {
    if (accessToken && selectedFriendId) {
      prevMsgCountRef.current = 0;
      setIsFriendTyping(false);
      loadThread(selectedFriendId, false);
    }
  }, [accessToken, selectedFriendId, loadThread]);

  // Smooth live polling every 2 seconds for instant messages & typing indicator
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      loadConversations();
      if (selectedFriendId) {
        loadThread(selectedFriendId, true);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [accessToken, selectedFriendId, loadConversations, loadThread]);

  // Auto-scroll smoothly when new messages or typing bubble arrive
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current || isFriendTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isFriendTyping]);

  // Notify server when current user is typing (throttled every 2.2s)
  const triggerTypingPing = useCallback(() => {
    if (!selectedFriendId || !accessToken) return;
    const now = Date.now();
    if (now - lastTypingPingRef.current < 2200) return;
    lastTypingPingRef.current = now;
    authFetch(`/social/messages/${encodeURIComponent(selectedFriendId)}/typing`, {
      method: 'POST',
    }).catch(() => {});
  }, [selectedFriendId, accessToken]);

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
        if (res.ok && !cancelled) setSearchResults(await res.json());
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
    const res = await authFetch(`/social/friends/${requestId}/accept`, { method: 'POST' });
    if (res.ok) {
      notifyFriend('Друг добавлен! Теперь можно общаться.');
      await loadConversations();
      if (friendUserId) setSelectedFriendId(friendUserId);
    }
  };

  const handleRejectFriend = async (requestId: string) => {
    if (!accessToken) return;
    const res = await authFetch(`/social/friends/${requestId}`, { method: 'DELETE' });
    if (res.ok) await loadConversations();
  };

  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notifyFriend('Файл слишком большой (максимум 10 МБ)');
      return;
    }
    try {
      const compressed = await compressImageToDataUrl(file);
      setPendingImage(compressed);
      setPickerOpen(false);
    } catch {
      notifyFriend('Не удалось обработать фото');
    }
  };

  const sendPayload = async (payload: { content?: string; imageUrl?: string; gifUrl?: string }) => {
    if (!selectedFriendId || sending) return;
    setSending(true);
    try {
      const res = await authFetch(`/social/messages/${encodeURIComponent(selectedFriendId)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setMessages((prev) => [...prev, created]);
        loadConversations();
        return true;
      }
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendId || (!draft.trim() && !pendingImage) || sending) return;

    const text = draft.trim();
    const img = pendingImage;
    setDraft('');
    setPendingImage(null);
    setPickerOpen(false);

    const ok = await sendPayload({
      content: text || undefined,
      imageUrl: img || undefined,
    });
    if (!ok) {
      setDraft(text);
      setPendingImage(img);
    }
  };

  const handleSendGif = async (gifUrl: string) => {
    setPickerOpen(false);
    await sendPayload({ gifUrl });
  };

  const filteredGifs = gifSearch.trim()
    ? CURATED_GIFS.filter(
        (g) =>
          g.title.toLowerCase().includes(gifSearch.toLowerCase()) ||
          g.tags.toLowerCase().includes(gifSearch.toLowerCase())
      )
    : CURATED_GIFS;

  if (!hydrated || !user) return null;

  return (
    <div className="max-w-[1360px] mx-auto px-3 sm:px-6 lg:px-8 pt-16 md:pt-14 pb-4 md:pb-8 h-[100dvh] bg-[#09090D] flex flex-col overflow-hidden">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoPick}
      />

      {/* Compact Header (hidden on mobile when inside an active chat thread for max screen space) */}
      <div
        className={`${
          selectedFriendId ? 'hidden md:flex' : 'flex'
        } items-center justify-between gap-3 pb-3 mb-3 border-b border-[#292936] shrink-0`}
      >
        <div>
          <div className="flex items-center gap-2 text-[#A18BFF] text-[11px] font-bold uppercase tracking-widest mb-0.5">
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Мессенджер 67movies</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Чат с друзьями
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsAddFriendOpen(true)}
          className="relative inline-flex items-center gap-2 px-3.5 py-2 rounded-xl brand-btn text-xs font-bold text-white transition-all"
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
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
        {/* Left Sidebar: Friends & Conversations */}
        <aside
          className={`${
            selectedFriendId ? 'hidden md:flex' : 'flex'
          } md:col-span-4 flex-col rounded-3xl bg-[#111119] border border-[#292936] overflow-hidden min-h-0`}
        >
          <div className="px-4 py-3 border-b border-[#292936] flex items-center justify-between shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#92929F]">
              Диалоги ({conversations.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Incoming Friend Requests */}
            <AnimatePresence>
              {incomingRequests.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 p-2.5 rounded-2xl bg-[#8065FF]/10 border border-[#8065FF]/35 space-y-2"
                >
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
                </motion.div>
              )}
            </AnimatePresence>

            {loadingList ? (
              <div className="p-8 text-center text-xs text-[#92929F]">Загрузка чатов...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <MessageCircle className="w-10 h-10 text-[#A18BFF] mx-auto opacity-60" />
                <p className="text-sm font-bold text-white">Пока нет друзей в чате</p>
                <p className="text-xs text-[#92929F] leading-relaxed">
                  Найдите друга по имени или email прямо здесь, чтобы переписываться и отправлять
                  фильмы.
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
                const previewText = conv.isTyping
                  ? 'печатает...'
                  : conv.lastMessage
                  ? conv.lastMessage.movieTitle
                    ? `🎬 ${conv.lastMessage.movieTitle}`
                    : conv.lastMessage.gifUrl
                    ? '🎞️ GIF'
                    : conv.lastMessage.imageUrl
                    ? `📷 Фото${conv.lastMessage.content ? ` — ${conv.lastMessage.content}` : ''}`
                    : conv.lastMessage.content
                  : 'Начните переписку...';

                return (
                  <motion.button
                    key={conv.friend.id}
                    type="button"
                    whileTap={{ scale: 0.98 }}
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
                        <p
                          className={`text-xs truncate ${
                            conv.isTyping ? 'text-[#A18BFF] font-semibold animate-pulse' : 'text-[#92929F]'
                          }`}
                        >
                          {previewText}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#8065FF] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Panel: Active Chat Thread */}
        <section
          className={`${
            selectedFriendId ? 'flex' : 'hidden md:flex'
          } md:col-span-8 flex-col rounded-3xl bg-[#111119] border border-[#292936] overflow-hidden min-h-0 relative`}
        >
          {!selectedFriendId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[#8065FF]/15 border border-[#8065FF]/30 flex items-center justify-center text-[#A18BFF]">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white">Выберите друга для переписки</h2>
              <p className="text-xs text-[#92929F] max-w-sm leading-relaxed">
                Отправляйте фото, эмодзи, GIF и карточки фильмов прямо со страницы любого тайтла.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-3.5 sm:px-5 py-3 border-b border-[#292936] flex items-center justify-between gap-3 bg-[#111119] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedFriendId(null)}
                    className="md:hidden p-2 rounded-xl bg-[#181821] text-[#92929F] hover:text-white active:scale-95 transition-transform"
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
                    <AnimatePresence mode="wait">
                      {isFriendTyping ? (
                        <motion.p
                          key="typing"
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          className="text-[11px] font-semibold text-[#A18BFF]"
                        >
                          печатает...
                        </motion.p>
                      ) : (
                        <motion.p
                          key="idle"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-[11px] text-[#92929F]"
                        >
                          Друг в 67movies
                        </motion.p>
                      )}
                    </AnimatePresence>
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
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2.5 bg-[#09090D]/50 scroll-smooth">
                {loadingChat ? (
                  <div className="py-12 text-center text-xs text-[#92929F]">
                    Загрузка сообщений...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <p className="text-sm font-bold text-white">Сообщений пока нет</p>
                    <p className="text-xs text-[#92929F]">
                      Напишите привет, отправьте GIF, фото или фильм!
                    </p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg) => {
                      const isMine = msg.senderId === user.id;
                      const movieHref = msg.movieTmdbId
                        ? `/movie/${msg.movieTmdbId}?type=${
                            msg.movieMediaType === 'SERIES' ? 'tv' : 'movie'
                          }`
                        : null;

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 12, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-2.5 sm:p-3 space-y-2 shadow-lg ${
                              isMine
                                ? 'bg-[#8065FF] text-white rounded-br-md'
                                : 'bg-[#181821] border border-[#292936] text-white rounded-bl-md'
                            }`}
                          >
                            {/* Uploaded Photo */}
                            {msg.imageUrl && (
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(msg.imageUrl!)}
                                className="block overflow-hidden rounded-xl max-w-[280px] sm:max-w-[320px] focus:outline-none"
                              >
                                <img
                                  src={msg.imageUrl}
                                  alt="Фото"
                                  className="w-full max-h-72 object-cover rounded-xl hover:scale-[1.02] transition-transform duration-200"
                                />
                              </button>
                            )}

                            {/* Embedded GIF */}
                            {msg.gifUrl && (
                              <button
                                type="button"
                                onClick={() => setLightboxUrl(msg.gifUrl!)}
                                className="block overflow-hidden rounded-xl max-w-[260px] focus:outline-none"
                              >
                                <img
                                  src={msg.gifUrl}
                                  alt="GIF"
                                  className="w-full max-h-60 object-cover rounded-xl"
                                />
                              </button>
                            )}

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
                                <div className="w-12 h-[72px] rounded-lg overflow-hidden bg-[#09090D] shrink-0 flex items-center justify-center">
                                  {msg.moviePosterPath ? (
                                    <img
                                      src={msg.moviePosterPath}
                                      alt={msg.movieTitle}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
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
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}

                {/* Live Animated Typing Indicator Bubble */}
                <AnimatePresence>
                  {isFriendTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.9 }}
                      className="flex justify-start"
                    >
                      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[#181821] border border-[#292936] flex items-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="w-2 h-2 rounded-full bg-[#A18BFF]"
                            animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }}
                            transition={{
                              duration: 0.75,
                              repeat: Infinity,
                              delay: i * 0.16,
                              ease: 'easeInOut',
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Pending Photo Preview */}
              <AnimatePresence>
                {pendingImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="px-4 py-2.5 bg-[#181821] border-t border-[#292936] flex items-center justify-between gap-3 shrink-0"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={pendingImage}
                        alt="Предпросмотр"
                        className="w-12 h-12 rounded-xl object-cover border border-[#8065FF]/50"
                      />
                      <span className="text-xs font-semibold text-white">Фото готово к отправке</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingImage(null)}
                      className="p-1.5 rounded-lg bg-black/40 text-[#92929F] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated Emoji & GIF Picker Tray */}
              <AnimatePresence>
                {pickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="border-t border-[#292936] bg-[#14141D] p-3 space-y-2.5 shrink-0 max-h-64 flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-[#09090D] p-1 rounded-xl border border-[#292936]">
                        <button
                          type="button"
                          onClick={() => setPickerTab('emoji')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            pickerTab === 'emoji'
                              ? 'bg-[#8065FF] text-white'
                              : 'text-[#92929F] hover:text-white'
                          }`}
                        >
                          😊 Эмодзи
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickerTab('gif')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            pickerTab === 'gif'
                              ? 'bg-[#8065FF] text-white'
                              : 'text-[#92929F] hover:text-white'
                          }`}
                        >
                          🎞️ GIF
                        </button>
                      </div>

                      {pickerTab === 'gif' && (
                        <input
                          type="text"
                          value={gifSearch}
                          onChange={(e) => setGifSearch(e.target.value)}
                          placeholder="Поиск GIF (попкорн, огонь...)..."
                          className="flex-1 max-w-[220px] px-3 py-1.5 rounded-lg bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => setPickerOpen(false)}
                        className="p-1 text-[#92929F] hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1">
                      {pickerTab === 'emoji' ? (
                        <div className="space-y-2.5">
                          {EMOJI_GROUPS.map((grp) => (
                            <div key={grp.label}>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-[#92929F] mb-1">
                                {grp.label}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {grp.emojis.map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => {
                                      setDraft((prev) => prev + em);
                                      triggerTypingPing();
                                    }}
                                    className="w-9 h-9 rounded-xl hover:bg-white/10 active:scale-90 text-xl flex items-center justify-center transition-transform"
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {filteredGifs.map((g) => (
                            <button
                              key={g.url}
                              type="button"
                              onClick={() => handleSendGif(g.url)}
                              className="group relative aspect-video rounded-xl overflow-hidden bg-[#09090D] border border-[#292936] hover:border-[#8065FF] transition-all"
                            >
                              <img
                                src={g.url}
                                alt={g.title}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 bg-black/70 text-[10px] font-bold text-white truncate">
                                {g.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Message Input Bar */}
              <form
                onSubmit={handleSend}
                className="p-2.5 sm:p-3.5 border-t border-[#292936] bg-[#111119] flex items-center gap-2 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title="Прикрепить фото"
                  className="p-2.5 rounded-xl bg-[#181821] hover:bg-[#252533] border border-[#292936] text-[#92929F] hover:text-[#A18BFF] active:scale-95 transition-all shrink-0"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  title="Эмодзи и GIF"
                  className={`p-2.5 rounded-xl border active:scale-95 transition-all shrink-0 ${
                    pickerOpen
                      ? 'bg-[#8065FF]/20 border-[#8065FF] text-[#A18BFF]'
                      : 'bg-[#181821] hover:bg-[#252533] border-[#292936] text-[#92929F] hover:text-[#A18BFF]'
                  }`}
                >
                  <Smile className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (e.target.value.trim()) triggerTypingPing();
                  }}
                  placeholder="Сообщение..."
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                />

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.94 }}
                  disabled={(!draft.trim() && !pendingImage) || sending}
                  className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl brand-btn text-white text-sm font-bold disabled:opacity-40 transition-all shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Отправить</span>
                </motion.button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Fullscreen Image / GIF Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightboxUrl}
              alt="Просмотр"
              className="max-w-full max-h-[88vh] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Friend Modal right inside Messenger */}
      <AnimatePresence>
        {isAddFriendOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddFriendOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#111119] border border-[#292936] rounded-3xl p-6 text-white shadow-2xl space-y-5"
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

                {!searchingUsers &&
                  userSearchQuery.trim().length >= 2 &&
                  searchResults.length === 0 && (
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
