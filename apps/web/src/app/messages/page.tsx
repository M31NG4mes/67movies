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
  Copy,
  Reply,
  Pencil,
  Trash2,
  Users,
  UserMinus,
  Settings,
  LogOut,
  MoreVertical,
} from 'lucide-react';
import { authFetch, useAuthStore } from '../../stores/auth.store';

const PROD_API_FALLBACK = 'https://six7movies-api.onrender.com/api';
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined'
    ? window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:4000/api'
      : PROD_API_FALLBACK
    : process.env.NODE_ENV === 'production'
    ? PROD_API_FALLBACK
    : 'http://localhost:4000/api');

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
  replyToId?: string | null;
  replyToContent?: string | null;
  replyToSenderName?: string | null;
  editedAt?: string | null;
  reactions?: Record<string, string[]>;
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

interface ChatGroupItem {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  members: FriendUser[];
  lastMessage: DirectMessageItem | null;
}

interface GifItem {
  id: string;
  title: string;
  url: string;
  preview: string;
}

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👍', '😱', '🎬'];

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

const GIF_CATEGORIES = [
  { label: '🔥 Тренды', query: '' },
  { label: '🎬 Кино', query: 'cinema movie popcorn' },
  { label: '😂 Смех', query: 'funny laugh lol' },
  { label: '❤️ Любовь', query: 'love heart cute' },
  { label: '😱 Шок', query: 'shocked mind blown omg' },
  { label: '🐱 Коты', query: 'cat funny' },
  { label: '⚡ Аниме', query: 'anime reaction' },
  { label: '👋 Привет', query: 'hello wave hi' },
  { label: '👏 Браво', query: 'applause clap bravo' },
];

const FALLBACK_GIFS: GifItem[] = [
  { id: 'f1', title: 'Попкорн', url: 'https://media.giphy.com/media/pUeXcg80cO8I8/giphy.gif', preview: 'https://media.giphy.com/media/pUeXcg80cO8I8/200w.gif' },
  { id: 'f2', title: 'Браво', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', preview: 'https://media.giphy.com/media/g9582DNuQppxC/200w.gif' },
  { id: 'f3', title: 'Шедевр', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif' },
  { id: 'f4', title: 'Взрыв мозга', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif', preview: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/200w.gif' },
  { id: 'f5', title: 'Смех', url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif', preview: 'https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif' },
  { id: 'f6', title: 'Огонь', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', preview: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif' },
  { id: 'f7', title: 'Шок', url: 'https://media.giphy.com/media/5VKbvrjxpVJCM/giphy.gif', preview: 'https://media.giphy.com/media/5VKbvrjxpVJCM/200w.gif' },
  { id: 'f8', title: 'Жду', url: 'https://media.giphy.com/media/QBd2kLB5qDmysEXre9/giphy.gif', preview: 'https://media.giphy.com/media/QBd2kLB5qDmysEXre9/200w.gif' },
  { id: 'f9', title: 'Привет', url: 'https://media.giphy.com/media/3og0IQCsqncpVWxyTu/giphy.gif', preview: 'https://media.giphy.com/media/3og0IQCsqncpVWxyTu/200w.gif' },
  { id: 'f10', title: 'Грусть', url: 'https://media.giphy.com/media/ISOckXUybVfQ4/giphy.gif', preview: 'https://media.giphy.com/media/ISOckXUybVfQ4/200w.gif' },
  { id: 'f11', title: 'Сердце', url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif', preview: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w.gif' },
  { id: 'f12', title: 'Кот печатает', url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif', preview: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif' },
  { id: 'f13', title: 'Танец', url: 'https://media.giphy.com/media/l3vRlT2k2L35Cnn5C/giphy.gif', preview: 'https://media.giphy.com/media/l3vRlT2k2L35Cnn5C/200w.gif' },
  { id: 'f14', title: 'Ок', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200w.gif' },
  { id: 'f15', title: 'Нет', url: 'https://media.giphy.com/media/vyTnNTrs3wqQ0UIvwE/giphy.gif', preview: 'https://media.giphy.com/media/vyTnNTrs3wqQ0UIvwE/200w.gif' },
  { id: 'f16', title: 'Да!', url: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/giphy.gif', preview: 'https://media.giphy.com/media/3ohzdIuqJoo8QdKlnW/200w.gif' },
  { id: 'f17', title: 'Аниме вау', url: 'https://media.giphy.com/media/b2rLe6TwuIkyQ/giphy.gif', preview: 'https://media.giphy.com/media/b2rLe6TwuIkyQ/200w.gif' },
  { id: 'f18', title: 'Круто', url: 'https://media.giphy.com/media/SVH9y2LQUVVCRcqD7o/giphy.gif', preview: 'https://media.giphy.com/media/SVH9y2LQUVVCRcqD7o/200w.gif' },
  { id: 'f19', title: 'Думаю', url: 'https://media.giphy.com/media/a5viI92PAF89q/giphy.gif', preview: 'https://media.giphy.com/media/a5viI92PAF89q/200w.gif' },
  { id: 'f20', title: 'Очки', url: 'https://media.giphy.com/media/1jnyRP4DorCh2/giphy.gif', preview: 'https://media.giphy.com/media/1jnyRP4DorCh2/200w.gif' },
  { id: 'f21', title: 'Фейспалм', url: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/giphy.gif', preview: 'https://media.giphy.com/media/XsUtdIeJ0MWMo/200w.gif' },
  { id: 'f22', title: 'Вечеринка', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif' },
  { id: 'f23', title: 'Кивок', url: 'https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif', preview: 'https://media.giphy.com/media/NEvPzZ8bd1V4Y/200w.gif' },
  { id: 'f24', title: 'Сон', url: 'https://media.giphy.com/media/mkhMTALnrYRLnuoe5P/giphy.gif', preview: 'https://media.giphy.com/media/mkhMTALnrYRLnuoe5P/200w.gif' },
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
  const initialGroupId = searchParams.get('group');

  const { user, accessToken, hydrated, hydrate } = useAuthStore();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [groups, setGroups] = useState<ChatGroupItem[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    initialGroupId ? null : initialFriendId
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialGroupId);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);

  // Reply, Edit, Copy & Right-Click Context Menu
  const [replyingTo, setReplyingTo] = useState<DirectMessageItem | null>(null);
  const [editingMsg, setEditingMsg] = useState<DirectMessageItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    msg: DirectMessageItem;
    x: number;
    y: number;
  } | null>(null);
  const [chatToast, setChatToast] = useState<string | null>(null);

  // Emoji & Live GIF Picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'gif'>('emoji');
  const [gifSearch, setGifSearch] = useState('');
  const [gifResults, setGifResults] = useState<GifItem[]>(FALLBACK_GIFS);
  const [loadingGifs, setLoadingGifs] = useState(false);

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
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(0);
  const lastTypingPingRef = useRef(0);

  const showChatToast = (msg: string) => {
    setChatToast(msg);
    setTimeout(() => setChatToast((prev) => (prev === msg ? null : prev)), 2200);
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const st = useAuthStore.getState();
    if (!st.hydrated) st.hydrate();
    if (!useAuthStore.getState().accessToken) {
      router.replace('/auth');
    }
  }, [hydrated, accessToken, router]);

  useEffect(() => {
    if (initialFriendId) setSelectedFriendId(initialFriendId);
  }, [initialFriendId]);

  const loadConversations = useCallback(async () => {
    if (!accessToken) return;
    const [convRes, friendsRes, groupsRes] = await Promise.all([
      authFetch('/social/messages/conversations', { cache: 'no-store' }).catch(() => null),
      authFetch('/social/friends', { cache: 'no-store' }).catch(() => null),
      authFetch('/social/groups', { cache: 'no-store' }).catch(() => null),
    ]);
    if (convRes?.ok) {
      const data = await convRes.json();
      const list: ConversationSummary[] = data.conversations || [];
      setConversations(list);
      if (!selectedFriendId && !selectedGroupId && !initialFriendId && list.length > 0 && window.innerWidth >= 768) {
        setSelectedFriendId(list[0].friend.id);
      }
    }
    if (groupsRes?.ok) {
      const gData = await groupsRes.json();
      setGroups(gData.groups || []);
    }
    if (friendsRes?.ok) {
      const fData = await friendsRes.json();
      setIncomingRequests(fData.incomingRequests || []);
      setOutgoingRequests(fData.outgoingRequests || []);
    }
    setLoadingList(false);
  }, [accessToken, selectedFriendId, selectedGroupId, initialFriendId]);

  const buildMessagesSig = (list: DirectMessageItem[]) => {
    if (list.length === 0) return '0';
    const last = list[list.length - 1];
    return `${list.length}:${last.id}:${last.editedAt || ''}:${JSON.stringify(last.reactions || {})}`;
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
        const incoming: DirectMessageItem[] = data.messages || [];
        setActiveFriend(data.friend || null);
        setMessages((prev) =>
          buildMessagesSig(prev) === buildMessagesSig(incoming) ? prev : incoming
        );
        setIsFriendTyping(Boolean(data.isFriendTyping));
      }
      if (!silent) setLoadingChat(false);
    },
    [accessToken]
  );

  const loadGroupThread = useCallback(
    async (groupId: string, silent = false) => {
      if (!accessToken) return;
      if (!silent) setLoadingChat(true);
      const res = await authFetch(`/social/groups/${encodeURIComponent(groupId)}/messages`, {
        cache: 'no-store',
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        const incoming: DirectMessageItem[] = data.messages || [];
        setActiveFriend(null);
        setMessages((prev) =>
          buildMessagesSig(prev) === buildMessagesSig(incoming) ? prev : incoming
        );
        setIsFriendTyping(false);
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
      setReplyingTo(null);
      setEditingMsg(null);
      loadThread(selectedFriendId, false);
    }
  }, [accessToken, selectedFriendId, loadThread]);

  useEffect(() => {
    if (accessToken && selectedGroupId) {
      prevMsgCountRef.current = 0;
      setIsFriendTyping(false);
      setReplyingTo(null);
      setEditingMsg(null);
      loadGroupThread(selectedGroupId, false);
    }
  }, [accessToken, selectedGroupId, loadGroupThread]);

  // Live polling: active thread every 4s, sidebar list every 12s (pauses when tab is hidden)
  useEffect(() => {
    if (!accessToken) return;
    const threadInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (selectedGroupId) {
        loadGroupThread(selectedGroupId, true);
      } else if (selectedFriendId) {
        loadThread(selectedFriendId, true);
      }
    }, 4000);
    const listInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadConversations();
    }, 12000);
    return () => {
      clearInterval(threadInterval);
      clearInterval(listInterval);
    };
  }, [accessToken, selectedFriendId, selectedGroupId, loadConversations, loadThread, loadGroupThread]);

  // Smooth auto-scroll on new messages or typing bubble
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current || isFriendTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isFriendTyping]);

  // Close right-click context menu on Escape or outside click
  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', closeMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [contextMenu]);

  // Live GIPHY GIF search via same-origin /api/gifs (GIPHY API + Tenor fallback)
  useEffect(() => {
    if (!pickerOpen || pickerTab !== 'gif') return;
    let cancelled = false;
    setLoadingGifs(true);

    const timer = setTimeout(async () => {
      try {
        const giphyRes = await fetch(
          `/api/gifs?q=${encodeURIComponent(gifSearch.trim())}&limit=32`,
          { cache: 'no-store' }
        ).catch(() => null);
        if (giphyRes?.ok && !cancelled) {
          const giphyJson = await giphyRes.json();
          if (Array.isArray(giphyJson?.items) && giphyJson.items.length > 0) {
            setGifResults(giphyJson.items);
            return;
          }
        }

        const res = await fetch(
          `${API_BASE}/media/gifs?q=${encodeURIComponent(gifSearch.trim())}&limit=32`
        ).catch(() => null);
        if (res?.ok && !cancelled) {
          const items = await res.json();
          if (Array.isArray(items) && items.length > 0) {
            setGifResults(items);
            return;
          }
        }
        if (!cancelled) {
          const q = gifSearch.trim().toLowerCase();
          setGifResults(
            q
              ? FALLBACK_GIFS.filter((g) => g.title.toLowerCase().includes(q))
              : FALLBACK_GIFS
          );
        }
      } catch {
        if (!cancelled) setGifResults(FALLBACK_GIFS);
      } finally {
        if (!cancelled) setLoadingGifs(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickerOpen, pickerTab, gifSearch]);

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
      showChatToast('Файл слишком большой (макс. 10 МБ)');
      return;
    }
    try {
      const compressed = await compressImageToDataUrl(file);
      setPendingImage(compressed);
      setPickerOpen(false);
    } catch {
      showChatToast('Не удалось обработать фото');
    }
  };

  const handleCopyMessage = async (msg: DirectMessageItem) => {
    const textToCopy = msg.content || msg.movieTitle || '';
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      showChatToast('Скопировано ✓');
    } catch {
      showChatToast('Не удалось скопировать');
    }
    setContextMenu(null);
  };

  const handleStartReply = (msg: DirectMessageItem) => {
    setEditingMsg(null);
    setReplyingTo(msg);
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const handleStartEdit = (msg: DirectMessageItem) => {
    setReplyingTo(null);
    setEditingMsg(msg);
    setDraft(msg.content || '');
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    setContextMenu(null);

    // Optimistic update for instant feel
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const map = { ...(m.reactions || {}) };
        const list = Array.isArray(map[emoji]) ? [...map[emoji]] : [];
        const idx = list.indexOf(user.id);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(user.id);
        if (list.length === 0) delete map[emoji];
        else map[emoji] = list;
        return { ...m, reactions: map };
      })
    );

    const res = await authFetch(`/social/messages/${encodeURIComponent(messageId)}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }).catch(() => null);

    if (res?.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
    }
  };

  const handleDeleteMessage = async (msg: DirectMessageItem) => {
    setContextMenu(null);
    const snapshot = messages;
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    if (editingMsg?.id === msg.id) {
      setEditingMsg(null);
      setDraft('');
    }
    if (replyingTo?.id === msg.id) setReplyingTo(null);

    const res = await authFetch(`/social/messages/${encodeURIComponent(msg.id)}`, {
      method: 'DELETE',
    }).catch(() => null);

    if (res?.ok) {
      showChatToast('Сообщение удалено');
      loadConversations();
    } else {
      setMessages(snapshot);
      showChatToast('Не удалось удалить сообщение');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedGroupMemberIds.length === 0 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const res = await authFetch('/social/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: groupName.trim(),
          memberIds: selectedGroupMemberIds,
        }),
      });
      if (res.ok) {
        const created: ChatGroupItem = await res.json();
        setGroups((prev) => [created, ...prev]);
        setIsCreateGroupOpen(false);
        setGroupName('');
        setSelectedGroupMemberIds([]);
        setSelectedFriendId(null);
        setSelectedGroupId(created.id);
        showChatToast(`Группа «${created.name}» создана`);
      } else {
        const err = await res.json().catch(() => ({}));
        showChatToast(err?.message || 'Ошибка создания группы');
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const sendPayload = async (payload: {
    content?: string;
    imageUrl?: string;
    gifUrl?: string;
    replyToId?: string;
    replyToContent?: string;
    replyToSenderName?: string;
  }) => {
    const targetUrl = selectedGroupId
      ? `/social/groups/${encodeURIComponent(selectedGroupId)}/messages`
      : selectedFriendId
      ? `/social/messages/${encodeURIComponent(selectedFriendId)}`
      : null;
    if (!targetUrl || sending) return false;
    setSending(true);
    try {
      const res = await authFetch(targetUrl, {
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
    if ((!selectedFriendId && !selectedGroupId) || sending) return;

    // Handle Edit mode
    if (editingMsg) {
      const updatedText = draft.trim();
      if (!updatedText) return;
      setSending(true);
      try {
        const res = await authFetch(`/social/messages/${encodeURIComponent(editingMsg.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: updatedText }),
        });
        if (res.ok) {
          const updated = await res.json();
          setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? { ...m, ...updated } : m)));
          setEditingMsg(null);
          setDraft('');
          showChatToast('Сообщение изменено ✓');
        }
      } finally {
        setSending(false);
      }
      return;
    }

    if (!draft.trim() && !pendingImage) return;

    const text = draft.trim();
    const img = pendingImage;
    const reply = replyingTo;

    setDraft('');
    setPendingImage(null);
    setReplyingTo(null);
    setPickerOpen(false);

    const ok = await sendPayload({
      content: text || undefined,
      imageUrl: img || undefined,
      replyToId: reply?.id,
      replyToContent: reply
        ? reply.content || reply.movieTitle || (reply.imageUrl ? '📷 Фото' : reply.gifUrl ? '🎞️ GIF' : '')
        : undefined,
      replyToSenderName: reply
        ? reply.senderId === user?.id
          ? user?.name
          : activeFriend?.name || 'Друг'
        : undefined,
    });

    if (!ok) {
      setDraft(text);
      setPendingImage(img);
      setReplyingTo(reply);
    }
  };

  const handleSendGif = async (gifUrl: string) => {
    setPickerOpen(false);
    const reply = replyingTo;
    setReplyingTo(null);
    await sendPayload({
      gifUrl,
      replyToId: reply?.id,
      replyToContent: reply ? reply.content || reply.movieTitle || 'Сообщение' : undefined,
      replyToSenderName: reply
        ? reply.senderId === user?.id
          ? user?.name
          : activeFriend?.name || 'Друг'
        : undefined,
    });
  };

  const [isGroupManageOpen, setIsGroupManageOpen] = useState(false);
  const [addMemberIds, setAddMemberIds] = useState<string[]>([]);
  const [managingGroup, setManagingGroup] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const openContextMenuForMsg = useCallback(
    (msg: DirectMessageItem, clientX: number, clientY: number) => {
      const menuW = 240;
      const menuH = 215;
      const clampedX = Math.min(
        Math.max(8, clientX),
        Math.max(8, window.innerWidth - menuW - 12)
      );
      const clampedY = Math.min(
        Math.max(8, clientY),
        Math.max(8, window.innerHeight - menuH - 12)
      );
      setContextMenu({ msg, x: clampedX, y: clampedY });
    },
    []
  );

  const handleClearDirectConversation = async (friendIdOverride?: string) => {
    const targetId = friendIdOverride || selectedFriendId;
    if (!targetId || managingGroup) return;
    if (!window.confirm('Удалить всю переписку с этим другом?')) return;
    setManagingGroup(true);
    try {
      const res = await authFetch(
        `/social/messages/conversation/${encodeURIComponent(targetId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        if (targetId === selectedFriendId) {
          setMessages([]);
        }
        await loadConversations();
        showChatToast('Переписка удалена');
      } else {
        showChatToast('Не удалось удалить переписку');
      }
    } catch {
      showChatToast('Ошибка сети при удалении');
    } finally {
      setManagingGroup(false);
    }
  };

  const handleClearGroupMessages = async () => {
    if (!selectedGroupId || managingGroup) return;
    if (!window.confirm('Удалить всю переписку в этой группе?')) return;
    setManagingGroup(true);
    try {
      const res = await authFetch(
        `/social/groups/${encodeURIComponent(selectedGroupId)}/messages`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setMessages([]);
        await loadConversations();
        setIsGroupManageOpen(false);
        showChatToast('Переписка группы очищена');
      } else {
        const d = await res.json().catch(() => null);
        showChatToast(d?.message || 'Не удалось очистить переписку');
      }
    } catch {
      showChatToast('Ошибка сети');
    } finally {
      setManagingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupId || managingGroup) return;
    if (!window.confirm('Удалить группу навсегда? Все сообщения будут удалены.')) return;
    setManagingGroup(true);
    try {
      const res = await authFetch(
        `/social/groups/${encodeURIComponent(selectedGroupId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setGroups((prev) => prev.filter((g) => g.id !== selectedGroupId));
        setSelectedGroupId(null);
        setMessages([]);
        setIsGroupManageOpen(false);
        showChatToast('Группа удалена');
      } else {
        const d = await res.json().catch(() => null);
        showChatToast(d?.message || 'Не удалось удалить группу');
      }
    } catch {
      showChatToast('Ошибка сети');
    } finally {
      setManagingGroup(false);
    }
  };

  const handleAddGroupMembers = async () => {
    if (!selectedGroupId || addMemberIds.length === 0 || managingGroup) return;
    setManagingGroup(true);
    try {
      const res = await authFetch(
        `/social/groups/${encodeURIComponent(selectedGroupId)}/members`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberIds: addMemberIds }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setGroups((prev) =>
          prev.map((g) =>
            g.id === selectedGroupId
              ? { ...g, members: data.members || g.members, memberCount: data.memberCount ?? g.memberCount }
              : g
          )
        );
        setAddMemberIds([]);
        showChatToast('Участники добавлены');
      } else {
        const d = await res.json().catch(() => null);
        showChatToast(d?.message || 'Не удалось добавить участников');
      }
    } catch {
      showChatToast('Ошибка сети');
    } finally {
      setManagingGroup(false);
    }
  };

  const handleRemoveGroupMember = async (memberId: string) => {
    if (!selectedGroupId || managingGroup) return;
    const isSelf = memberId === user?.id;
    if (
      !window.confirm(
        isSelf ? 'Покинуть эту группу?' : 'Удалить участника из группы?'
      )
    ) {
      return;
    }
    setManagingGroup(true);
    try {
      const res = await authFetch(
        `/social/groups/${encodeURIComponent(selectedGroupId)}/members/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        const data = await res.json();
        if (isSelf) {
          setGroups((prev) => prev.filter((g) => g.id !== selectedGroupId));
          setSelectedGroupId(null);
          setMessages([]);
          setIsGroupManageOpen(false);
          showChatToast('Вы вышли из группы');
        } else {
          setGroups((prev) =>
            prev.map((g) =>
              g.id === selectedGroupId
                ? {
                    ...g,
                    members: data.members || g.members,
                    memberCount: data.memberCount ?? g.memberCount,
                  }
                : g
            )
          );
          showChatToast('Участник удалён');
        }
      } else {
        const d = await res.json().catch(() => null);
        showChatToast(d?.message || 'Не удалось выполнить действие');
      }
    } catch {
      showChatToast('Ошибка сети');
    } finally {
      setManagingGroup(false);
    }
  };

  if (!hydrated || !user) return null;

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3 sm:px-6 lg:px-8 pt-16 md:pt-14 pb-4 md:pb-8 h-[100dvh] bg-[#09090D] flex flex-col overflow-hidden">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoPick}
      />

      {/* Floating Micro-Toast */}
      <AnimatePresence>
        {chatToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] px-4 py-2 rounded-2xl bg-[#181821]/95 border border-[#8065FF]/50 text-xs font-bold text-white shadow-2xl backdrop-blur-md"
          >
            {chatToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact Header */}
      <div
        className={`${
          selectedFriendId || selectedGroupId ? 'hidden md:flex' : 'flex'
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
            selectedFriendId || selectedGroupId ? 'hidden md:flex' : 'flex'
          } md:col-span-4 flex-col rounded-3xl bg-[#111119] border border-[#292936] overflow-hidden min-h-0`}
        >
          <div className="px-4 py-3 border-b border-[#292936] flex items-center justify-between gap-2 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#92929F]">
              Диалоги ({conversations.length + groups.length})
            </span>
            <button
              type="button"
              onClick={() => setIsCreateGroupOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#181821] hover:bg-[#8065FF]/20 border border-[#292936] hover:border-[#8065FF]/50 text-[11px] font-bold text-[#A18BFF] transition-all"
              title="Создать групповой чат с друзьями"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Создать группу</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
            ) : conversations.length === 0 && groups.length === 0 ? (
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
              <>
                {groups.map((grp) => {
                  const isSelected = grp.id === selectedGroupId;
                  const previewText = grp.lastMessage
                    ? grp.lastMessage.movieTitle
                      ? `🎬 ${grp.lastMessage.movieTitle}`
                      : grp.lastMessage.gifUrl
                      ? '🎞️ GIF'
                      : grp.lastMessage.imageUrl
                      ? `📷 Фото${grp.lastMessage.content ? ` — ${grp.lastMessage.content}` : ''}`
                      : grp.lastMessage.content
                    : `${grp.memberCount} участн.`;

                  return (
                    <motion.button
                      key={grp.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedFriendId(null);
                        setSelectedGroupId(grp.id);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all ${
                        isSelected
                          ? 'bg-[#8065FF]/15 border border-[#8065FF]/50'
                          : 'hover:bg-[#181821] border border-transparent'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#8065FF]/20 border border-[#8065FF]/40 flex items-center justify-center shrink-0 text-[#A18BFF]">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-white truncate">{grp.name}</span>
                          <span className="text-[10px] font-bold text-[#A18BFF] bg-[#8065FF]/15 px-1.5 py-0.5 rounded-md shrink-0">
                            {grp.memberCount}
                          </span>
                        </div>
                        <p className="text-xs text-[#92929F] truncate mt-0.5">{previewText}</p>
                      </div>
                    </motion.button>
                  );
                })}
                {conversations.map((conv) => {
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
                      onClick={() => {
                        setSelectedGroupId(null);
                        setSelectedFriendId(conv.friend.id);
                      }}
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
                          decoding="async"
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          {conv.unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#8065FF] text-white text-[10px] font-black flex items-center justify-center">
                              {conv.unreadCount}
                            </span>
                          )}
                          {conv.lastMessage && (
                            <span
                              role="button"
                              tabIndex={0}
                              title="Удалить диалог"
                              aria-label="Удалить диалог"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearDirectConversation(conv.friend.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleClearDirectConversation(conv.friend.id);
                                }
                              }}
                              className="p-1.5 rounded-lg text-[#92929F] hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
              </>
            )}
          </div>
        </aside>

        {/* Right Panel: Active Chat Thread */}
        <section
          className={`${
            selectedFriendId || selectedGroupId ? 'flex' : 'hidden md:flex'
          } md:col-span-8 flex-col rounded-3xl bg-[#111119] border border-[#292936] overflow-hidden min-h-0 relative`}
        >
          {!selectedFriendId && !selectedGroupId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[#8065FF]/15 border border-[#8065FF]/30 flex items-center justify-center text-[#A18BFF]">
                <Sparkles className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white">Выберите друга или группу</h2>
              <p className="text-xs text-[#92929F] max-w-sm leading-relaxed">
                Отправляйте фото, эмодзи, тысячи GIF, реакции, ответы и карточки фильмов!
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-3.5 sm:px-5 py-3 border-b border-[#292936] flex items-center justify-between gap-3 bg-[#111119] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFriendId(null);
                      setSelectedGroupId(null);
                    }}
                    className="md:hidden p-2 rounded-xl bg-[#181821] text-[#92929F] hover:text-white active:scale-95 transition-transform"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  {selectedGroupId ? (
                    (() => {
                      const activeGroup = groups.find((g) => g.id === selectedGroupId);
                      return (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-[#8065FF]/20 border border-[#8065FF]/40 flex items-center justify-center shrink-0 text-[#A18BFF]">
                            <Users className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                              {activeGroup?.name || 'Группа'}
                            </p>
                            <p className="text-[11px] text-[#92929F] truncate">
                              {activeGroup ? `${activeGroup.memberCount} участн.` : 'Групповой чат'}
                            </p>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {selectedGroupId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAddMemberIds([]);
                      setIsGroupManageOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181821] hover:bg-[#8065FF]/20 border border-[#292936] hover:border-[#8065FF] text-xs font-semibold text-[#A18BFF] transition-all shrink-0"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Управление</span>
                  </button>
                ) : (
                  activeFriend && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleClearDirectConversation()}
                        disabled={managingGroup}
                        title="Удалить переписку"
                        aria-label="Удалить переписку"
                        className="p-2 rounded-xl bg-[#181821] hover:bg-rose-500/15 border border-[#292936] hover:border-rose-500/40 text-[#92929F] hover:text-rose-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Link
                        href={`/user/${activeFriend.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#181821] hover:bg-[#8065FF]/20 border border-[#292936] hover:border-[#8065FF] text-xs font-semibold text-[#A18BFF] transition-all"
                      >
                        <span>Профиль</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  )
                )}
              </div>

              {/* Messages Feed */}
              <div
                onClick={() => setContextMenu(null)}
                onScroll={() => setContextMenu(null)}
                className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 bg-[#09090D]/50 scroll-smooth"
              >
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
                  <>
                    {messages.map((msg) => {
                      const isMine = msg.senderId === user.id;
                      const movieHref = msg.movieTmdbId
                        ? `/movie/${msg.movieTmdbId}?type=${
                            msg.movieMediaType === 'SERIES' ? 'tv' : 'movie'
                          }`
                        : null;
                      const reactionEntries = Object.entries(msg.reactions || {}).filter(
                        ([, users]) => Array.isArray(users) && users.length > 0
                      );
                      const groupSenderName =
                        selectedGroupId && !isMine
                          ? groups
                              .find((g) => g.id === selectedGroupId)
                              ?.members?.find((m) => m.id === msg.senderId)?.name || 'Участник'
                          : null;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                        >
                          {groupSenderName && (
                            <span className="text-[11px] font-bold text-[#A18BFF] mb-1 px-1">
                              {groupSenderName}
                            </span>
                          )}
                          {/* Message Bubble + 3-dots Action Button (visible on mobile, hover on desktop) */}
                          <div
                            className={`flex items-end gap-1 max-w-full group ${
                              isMine ? 'flex-row' : 'flex-row-reverse'
                            }`}
                          >
                            <button
                              type="button"
                              aria-label="Действия с сообщением"
                              title="Реакции, ответить, редактировать, удалить"
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                openContextMenuForMsg(msg, rect.left, rect.bottom + 6);
                              }}
                              className="p-1.5 rounded-full text-[#92929F] hover:text-white hover:bg-white/10 opacity-75 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 mb-1"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            <div
                              style={{ WebkitTouchCallout: 'none' }}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openContextMenuForMsg(msg, e.clientX, e.clientY);
                              }}
                              onTouchStart={(e) => {
                                const touch = e.touches[0];
                                if (!touch) return;
                                const cx = touch.clientX;
                                const cy = touch.clientY;
                                touchStartPosRef.current = { x: cx, y: cy };
                                if (longPressTimerRef.current) {
                                  clearTimeout(longPressTimerRef.current);
                                }
                                longPressTimerRef.current = setTimeout(() => {
                                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                                    navigator.vibrate(18);
                                  }
                                  openContextMenuForMsg(msg, cx, cy);
                                }, 420);
                              }}
                              onTouchMove={(e) => {
                                const touch = e.touches[0];
                                const start = touchStartPosRef.current;
                                if (!touch || !start) return;
                                if (
                                  Math.abs(touch.clientX - start.x) > 10 ||
                                  Math.abs(touch.clientY - start.y) > 10
                                ) {
                                  if (longPressTimerRef.current) {
                                    clearTimeout(longPressTimerRef.current);
                                    longPressTimerRef.current = null;
                                  }
                                }
                              }}
                              onTouchEnd={() => {
                                if (longPressTimerRef.current) {
                                  clearTimeout(longPressTimerRef.current);
                                  longPressTimerRef.current = null;
                                }
                              }}
                              onTouchCancel={() => {
                                if (longPressTimerRef.current) {
                                  clearTimeout(longPressTimerRef.current);
                                  longPressTimerRef.current = null;
                                }
                              }}
                              className={`min-w-0 overflow-hidden max-w-[80%] sm:max-w-[70%] rounded-2xl p-2.5 sm:p-3 space-y-2 shadow-lg select-none md:select-text ${
                                isMine
                                  ? 'bg-[#8065FF] text-white rounded-br-md'
                                  : 'bg-[#181821] border border-[#292936] text-white rounded-bl-md'
                              }`}
                            >
                            {/* Quoted Reply Preview */}
                            {msg.replyToContent && (
                              <div
                                className={`px-2.5 py-1.5 rounded-xl border-l-2 text-xs ${
                                  isMine
                                    ? 'bg-black/20 border-white/70 text-white/90'
                                    : 'bg-[#111119] border-[#A18BFF] text-[#B8B6C8]'
                                }`}
                              >
                                <p className="font-bold text-[10px] opacity-85">
                                  {msg.replyToSenderName || 'Ответ'}
                                </p>
                                <p className="line-clamp-1 text-[11px]">{msg.replyToContent}</p>
                              </div>
                            )}

                            {/* Uploaded Photo */}
                            {msg.imageUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxUrl(msg.imageUrl!);
                                }}
                                className="block w-full max-w-[230px] sm:max-w-[300px] overflow-hidden rounded-xl"
                              >
                                <img
                                  src={msg.imageUrl}
                                  alt="Фото"
                                  decoding="async"
                                  className="block w-full h-auto max-h-64 object-cover rounded-xl hover:scale-[1.02] transition-transform duration-200"
                                />
                              </button>
                            )}

                            {/* Embedded GIF */}
                            {msg.gifUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLightboxUrl(msg.gifUrl!);
                                }}
                                className="block w-full max-w-[230px] sm:max-w-[280px] overflow-hidden rounded-xl"
                              >
                                <img
                                  src={msg.gifUrl}
                                  alt="GIF"
                                  loading="lazy"
                                  decoding="async"
                                  className="block w-full h-auto max-h-56 object-cover rounded-xl"
                                />
                              </button>
                            )}

                            {/* Shared Movie Card */}
                            {movieHref && msg.movieTitle && (
                              <Link
                                href={movieHref}
                                onClick={(e) => e.stopPropagation()}
                                className={`group/card w-full min-w-0 max-w-full flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl overflow-hidden transition-all ${
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
                                      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform"
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

                            {/* Timestamp + Edited + Read Check */}
                            <div
                              className={`flex items-center justify-end gap-1.5 text-[10px] ${
                                isMine ? 'text-white/75' : 'text-[#92929F]'
                              }`}
                            >
                              {msg.editedAt && <span className="italic opacity-80">изм.</span>}
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

                          {/* Reactions Pills */}
                          {reactionEntries.length > 0 && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="flex flex-wrap items-center gap-1 mt-1 px-1"
                            >
                              {reactionEntries.map(([emoji, userIds]) => {
                                const reactedByMe = userIds.includes(user.id);
                                return (
                                  <motion.button
                                    key={emoji}
                                    type="button"
                                    whileTap={{ scale: 0.88 }}
                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-all ${
                                      reactedByMe
                                        ? 'bg-[#8065FF]/25 border-[#8065FF] text-white'
                                        : 'bg-[#181821] border-[#292936] text-[#B8B6C8] hover:border-[#8065FF]/60'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-[10px]">{userIds.length}</span>
                                  </motion.button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Animated Typing Indicator */}
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

              {/* Active Reply / Edit Context Bar */}
              <AnimatePresence>
                {(replyingTo || editingMsg) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="px-4 py-2 bg-[#181821] border-t border-[#292936] flex items-center justify-between gap-3 shrink-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {editingMsg ? (
                        <Pencil className="w-4 h-4 text-[#A18BFF] shrink-0" />
                      ) : (
                        <Reply className="w-4 h-4 text-[#A18BFF] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-[#A18BFF]">
                          {editingMsg
                            ? 'Редактирование сообщения'
                            : `Ответ для ${
                                replyingTo?.senderId === user.id
                                  ? user.name
                                  : activeFriend?.name || 'друга'
                              }`}
                        </p>
                        <p className="text-xs text-[#92929F] truncate">
                          {editingMsg
                            ? editingMsg.content
                            : replyingTo?.content ||
                              replyingTo?.movieTitle ||
                              (replyingTo?.imageUrl ? '📷 Фото' : '🎞️ GIF')}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null);
                        if (editingMsg) {
                          setEditingMsg(null);
                          setDraft('');
                        }
                      }}
                      className="p-1.5 rounded-lg text-[#92929F] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

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

              {/* Animated Emoji & Thousands-of-GIFs Picker Tray */}
              <AnimatePresence>
                {pickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="border-t border-[#292936] bg-[#14141D] p-3 space-y-2.5 shrink-0 max-h-72 flex flex-col"
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
                          placeholder="Искать любые GIF (кино, коты, мемы)..."
                          className="flex-1 max-w-[260px] px-3 py-1.5 rounded-lg bg-[#09090D] border border-[#292936] text-xs text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
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

                    {pickerTab === 'gif' && (
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                        {GIF_CATEGORIES.map((cat) => (
                          <button
                            key={cat.label}
                            type="button"
                            onClick={() => setGifSearch(cat.query)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all ${
                              gifSearch === cat.query
                                ? 'bg-[#8065FF]/20 border-[#8065FF] text-[#A18BFF]'
                                : 'bg-[#09090D] border-[#292936] text-[#92929F] hover:text-white'
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    )}

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
                      ) : loadingGifs ? (
                        <div className="py-8 text-center text-xs text-[#92929F]">
                          Загрузка GIF...
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {gifResults.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() => handleSendGif(g.url)}
                              className="group relative aspect-video rounded-xl overflow-hidden bg-[#09090D] border border-[#292936] hover:border-[#8065FF] transition-all"
                            >
                              <img
                                src={g.preview || g.url}
                                alt={g.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
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
                {!editingMsg && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    title="Прикрепить фото"
                    className="p-2.5 rounded-xl bg-[#181821] hover:bg-[#252533] border border-[#292936] text-[#92929F] hover:text-[#A18BFF] active:scale-95 transition-all shrink-0"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </button>
                )}

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
                  ref={inputRef}
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (e.target.value.trim() && !editingMsg) triggerTypingPing();
                  }}
                  placeholder={editingMsg ? 'Измените текст сообщения...' : 'Сообщение...'}
                  className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-[#09090D] border border-[#292936] text-sm text-white placeholder-[#92929F] focus:outline-none focus:border-[#8065FF]"
                />

                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.94 }}
                  disabled={(!draft.trim() && !pendingImage) || sending}
                  className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-5 py-2.5 rounded-xl brand-btn text-white text-sm font-bold disabled:opacity-40 transition-all shrink-0"
                >
                  {editingMsg ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span className="hidden sm:inline">
                    {editingMsg ? 'Сохранить' : 'Отправить'}
                  </span>
                </motion.button>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Right-Click Context Menu for Reactions, Reply, Edit & Copy */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="fixed z-[80] w-60 rounded-2xl bg-[#181821]/95 border border-[#292936] shadow-2xl backdrop-blur-xl p-2 space-y-1.5"
          >
            {/* Quick Reactions Row */}
            <div className="flex items-center justify-between px-1.5 py-1 bg-[#09090D]/70 rounded-xl border border-[#292936]/70">
              {QUICK_REACTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleToggleReaction(contextMenu.msg.id, em)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 hover:scale-125 active:scale-95 text-base flex items-center justify-center transition-transform"
                >
                  {em}
                </button>
              ))}
            </div>

            {/* Reply */}
            <button
              type="button"
              onClick={() => handleStartReply(contextMenu.msg)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-[#8065FF]/20 hover:text-[#A18BFF] transition-colors text-left"
            >
              <Reply className="w-4 h-4 text-[#A18BFF]" />
              <span>Ответить</span>
            </button>

            {/* Edit (own text messages) */}
            {contextMenu.msg.senderId === user.id && contextMenu.msg.content && (
              <button
                type="button"
                onClick={() => handleStartEdit(contextMenu.msg)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-[#8065FF]/20 hover:text-[#A18BFF] transition-colors text-left"
              >
                <Pencil className="w-4 h-4 text-[#A18BFF]" />
                <span>Редактировать</span>
              </button>
            )}

            {/* Copy */}
            {(contextMenu.msg.content || contextMenu.msg.movieTitle) && (
              <button
                type="button"
                onClick={() => handleCopyMessage(contextMenu.msg)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors text-left"
              >
                <Copy className="w-4 h-4 text-[#92929F]" />
                <span>Копировать текст</span>
              </button>
            )}

            {/* Delete (own messages) */}
            {contextMenu.msg.senderId === user.id && (
              <button
                type="button"
                onClick={() => handleDeleteMessage(contextMenu.msg)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Удалить</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Group Modal */}
      <AnimatePresence>
        {isCreateGroupOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsCreateGroupOpen(false)}
            className="fixed inset-0 z-[65] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreateGroup}
              className="w-full max-w-md rounded-3xl bg-[#111119] border border-[#292936] p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#A18BFF]" />
                  <span>Создать группу</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateGroupOpen(false)}
                  className="p-1.5 rounded-xl bg-[#181821] text-[#92929F] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#92929F]">Название группы</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Например: Вечерний киноклуб"
                  maxLength={60}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#181821] border border-[#292936] focus:border-[#8065FF] outline-none text-sm text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#92929F]">
                  Выберите друзей ({selectedGroupMemberIds.length})
                </label>
                {conversations.length === 0 ? (
                  <p className="text-xs text-[#92929F] py-3 text-center">
                    Сначала добавьте друзей, чтобы создать группу
                  </p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {conversations.map((c) => {
                      const checked = selectedGroupMemberIds.includes(c.friend.id);
                      return (
                        <button
                          key={c.friend.id}
                          type="button"
                          onClick={() =>
                            setSelectedGroupMemberIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== c.friend.id)
                                : [...prev, c.friend.id]
                            )
                          }
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                            checked
                              ? 'bg-[#8065FF]/15 border-[#8065FF]/60'
                              : 'bg-[#181821] border-[#292936] hover:border-[#8065FF]/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#111119] border border-[#292936] flex items-center justify-center shrink-0">
                              {c.friend.avatarUrl ? (
                                <img
                                  src={c.friend.avatarUrl}
                                  alt={c.friend.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-bold text-[#A18BFF]">
                                  {c.friend.name.slice(0, 1)}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-white truncate">
                              {c.friend.name}
                            </span>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                              checked
                                ? 'bg-[#8065FF] border-[#8065FF] text-white'
                                : 'border-[#292936]'
                            }`}
                          >
                            {checked && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!groupName.trim() || selectedGroupMemberIds.length === 0 || creatingGroup}
                className="w-full py-2.5 rounded-xl brand-btn text-white text-sm font-bold disabled:opacity-50"
              >
                {creatingGroup ? 'Создание...' : 'Создать группу'}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Add Friend Modal */}
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

      {/* Group Management Modal (Members, Add/Remove, Clear History, Delete/Leave Group) */}
      <AnimatePresence>
        {isGroupManageOpen && selectedGroupId && (() => {
          const activeGroup = groups.find((g) => g.id === selectedGroupId);
          if (!activeGroup) return null;
          const isOwner = activeGroup.ownerId === user.id;
          const memberIdsSet = new Set((activeGroup.members || []).map((m) => m.id));
          const availableFriendsToAdd = conversations.filter(
            (c) => !memberIdsSet.has(c.friend.id)
          );

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGroupManageOpen(false)}
              className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-3xl bg-[#111119] border border-[#292936] p-5 space-y-4 shadow-2xl max-h-[85dvh] overflow-y-auto"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white flex items-center gap-2 truncate">
                      <Users className="w-4 h-4 text-[#A18BFF] shrink-0" />
                      <span className="truncate">{activeGroup.name}</span>
                    </h3>
                    <p className="text-[11px] text-[#92929F]">
                      Участников: {activeGroup.memberCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGroupManageOpen(false)}
                    className="p-1.5 rounded-xl text-[#92929F] hover:text-white hover:bg-white/10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Current Members */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#92929F]">
                    Участники группы
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(activeGroup.members || []).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#181821] border border-[#292936]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#111119] flex items-center justify-center shrink-0">
                            {m.avatarUrl ? (
                              <img
                                src={m.avatarUrl}
                                alt={m.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xs font-black text-[#A18BFF] uppercase">
                                {m.name.slice(0, 1)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">
                              {m.name}
                            </p>
                            {m.id === activeGroup.ownerId && (
                              <span className="text-[10px] font-semibold text-[#A18BFF]">
                                Создатель
                              </span>
                            )}
                          </div>
                        </div>

                        {isOwner && m.id !== activeGroup.ownerId && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroupMember(m.id)}
                            disabled={managingGroup}
                            title="Удалить из группы"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[11px] font-semibold transition-colors shrink-0"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            <span>Удалить</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Friends to Group (Owner only) */}
                {isOwner && (
                  <div className="space-y-2 pt-2 border-t border-[#292936]">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#92929F]">
                      Добавить друзей
                    </p>
                    {availableFriendsToAdd.length === 0 ? (
                      <p className="text-xs text-[#92929F]">
                        Все ваши друзья уже в этой группе.
                      </p>
                    ) : (
                      <>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {availableFriendsToAdd.map((c) => {
                            const checked = addMemberIds.includes(c.friend.id);
                            return (
                              <button
                                key={c.friend.id}
                                type="button"
                                onClick={() =>
                                  setAddMemberIds((prev) =>
                                    checked
                                      ? prev.filter((id) => id !== c.friend.id)
                                      : [...prev, c.friend.id]
                                  )
                                }
                                className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                                  checked
                                    ? 'bg-[#8065FF]/15 border-[#8065FF]/60'
                                    : 'bg-[#181821] border-[#292936] hover:border-white/20'
                                }`}
                              >
                                <span className="text-xs font-bold text-white truncate">
                                  {c.friend.name}
                                </span>
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                    checked
                                      ? 'bg-[#8065FF] border-[#8065FF] text-white'
                                      : 'border-[#292936]'
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3" />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {addMemberIds.length > 0 && (
                          <button
                            type="button"
                            onClick={handleAddGroupMembers}
                            disabled={managingGroup}
                            className="w-full py-2.5 rounded-xl brand-btn text-white text-xs font-bold transition-all disabled:opacity-50"
                          >
                            Добавить выбранных ({addMemberIds.length})
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Danger Actions */}
                <div className="pt-2 border-t border-[#292936] space-y-2">
                  {isOwner ? (
                    <>
                      <button
                        type="button"
                        onClick={handleClearGroupMessages}
                        disabled={managingGroup}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>Удалить переписку группы</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteGroup}
                        disabled={managingGroup}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Удалить группу</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemoveGroupMember(user.id)}
                      disabled={managingGroup}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-bold text-rose-400 transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Покинуть группу</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
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
