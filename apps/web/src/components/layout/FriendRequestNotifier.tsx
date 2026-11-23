'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Check, X, Ban, MessageCircle } from 'lucide-react';
import { authFetch, useAuthStore } from '../../stores/auth.store';

interface RequestUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

interface IncomingRequest {
  requestId: string;
  from?: RequestUser;
  user?: RequestUser;
}

interface MessageToast {
  id: string;
  title: string;
  preview: string;
  avatarUrl?: string | null;
  href: string;
}

export function FriendRequestNotifier() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken, hydrated } = useAuthStore();

  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msgToasts, setMsgToasts] = useState<MessageToast[]>([]);

  const seenMsgIdsRef = useRef<Map<string, string>>(new Map());
  const initializedMsgsRef = useRef(false);

  const pollNotifications = useCallback(async () => {
    if (!accessToken) {
      setRequests([]);
      return;
    }
    if (typeof document !== 'undefined' && document.hidden) return;

    try {
      const isOnMessagesPage = pathname?.startsWith('/messages');
      const [friendsRes, convRes, groupsRes] = await Promise.all([
        authFetch('/social/friends', { cache: 'no-store' }).catch(() => null),
        isOnMessagesPage
          ? Promise.resolve(null)
          : authFetch('/social/messages/conversations', { cache: 'no-store' }).catch(() => null),
        isOnMessagesPage
          ? Promise.resolve(null)
          : authFetch('/social/groups', { cache: 'no-store' }).catch(() => null),
      ]);

      if (friendsRes?.ok) {
        const data = await friendsRes.json();
        const incoming: IncomingRequest[] = Array.isArray(data?.incomingRequests)
          ? data.incomingRequests
          : [];
        setRequests(incoming);
      }

      const newToasts: MessageToast[] = [];

      if (convRes?.ok) {
        const cData = await convRes.json();
        const convs: any[] = Array.isArray(cData?.conversations) ? cData.conversations : [];
        for (const c of convs) {
          const lm = c?.lastMessage;
          const key = `dm:${c?.friend?.id}`;
          if (!lm?.id) continue;
          const prevId = seenMsgIdsRef.current.get(key);
          seenMsgIdsRef.current.set(key, lm.id);

          if (
            initializedMsgsRef.current &&
            prevId !== lm.id &&
            lm.senderId !== user?.id &&
            !isOnMessagesPage
          ) {
            const preview = lm.movieTitle
              ? `🎬 ${lm.movieTitle}`
              : lm.gifUrl
              ? '🎞️ Отправил(а) GIF'
              : lm.imageUrl
              ? `📷 Фото${lm.content ? `: ${lm.content}` : ''}`
              : lm.content || 'Новое сообщение';
            newToasts.push({
              id: lm.id,
              title: c.friend?.name || 'Сообщение',
              preview,
              avatarUrl: c.friend?.avatarUrl || null,
              href: `/messages?friend=${encodeURIComponent(c.friend.id)}`,
            });
          }
        }
      }

      if (groupsRes?.ok) {
        const gData = await groupsRes.json();
        const grps: any[] = Array.isArray(gData?.groups) ? gData.groups : [];
        for (const g of grps) {
          const lm = g?.lastMessage;
          const key = `grp:${g?.id}`;
          if (!lm?.id) continue;
          const prevId = seenMsgIdsRef.current.get(key);
          seenMsgIdsRef.current.set(key, lm.id);

          if (
            initializedMsgsRef.current &&
            prevId !== lm.id &&
            lm.senderId !== user?.id &&
            !isOnMessagesPage
          ) {
            const sender = g.members?.find((m: any) => m.id === lm.senderId)?.name || '';
            const body = lm.movieTitle
              ? `🎬 ${lm.movieTitle}`
              : lm.gifUrl
              ? '🎞️ GIF'
              : lm.imageUrl
              ? `📷 Фото${lm.content ? `: ${lm.content}` : ''}`
              : lm.content || 'Новое сообщение';
            newToasts.push({
              id: lm.id,
              title: g.name || 'Группа',
              preview: sender ? `${sender}: ${body}` : body,
              avatarUrl: null,
              href: `/messages?group=${encodeURIComponent(g.id)}`,
            });
          }
        }
      }

      initializedMsgsRef.current = true;

      if (newToasts.length > 0) {
        setMsgToasts((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const merged = [...newToasts.filter((t) => !existingIds.has(t.id)), ...prev];
          return merged.slice(0, 2);
        });
        for (const t of newToasts) {
          setTimeout(() => {
            setMsgToasts((prev) => prev.filter((item) => item.id !== t.id));
          }, 7000);
        }
      }
    } catch {
      // ignore network errors
    }
  }, [accessToken, pathname, user?.id]);

  useEffect(() => {
    if (!hydrated || !accessToken) {
      initializedMsgsRef.current = false;
      seenMsgIdsRef.current.clear();
      return;
    }
    pollNotifications();
    const timer = setInterval(pollNotifications, 12000);
    return () => clearInterval(timer);
  }, [hydrated, accessToken, pollNotifications]);

  const visible = requests.filter((r) => !dismissedIds.includes(r.requestId));
  const current = visible[0];
  const sender = current?.from || current?.user;

  const handleAccept = async (req: IncomingRequest) => {
    if (busyId) return;
    setBusyId(req.requestId);
    try {
      const res = await authFetch(`/social/friends/${encodeURIComponent(req.requestId)}/accept`, {
        method: 'POST',
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((item) => item.requestId !== req.requestId));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (req: IncomingRequest) => {
    if (busyId) return;
    setBusyId(req.requestId);
    try {
      const res = await authFetch(`/social/friends/${encodeURIComponent(req.requestId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((item) => item.requestId !== req.requestId));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleBlock = async (req: IncomingRequest) => {
    const target = req.from || req.user;
    if (busyId || !target?.id) return;
    setBusyId(req.requestId);
    try {
      const res = await authFetch(
        `/social/friends/${encodeURIComponent(target.id)}/block`,
        { method: 'POST' },
      );
      if (res.ok) {
        setRequests((prev) =>
          prev.filter((item) => {
            const u = item.from || item.user;
            return item.requestId !== req.requestId && u?.id !== target.id;
          })
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-[360px] z-[80] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {accessToken && current && sender && (
          <motion.div
            key={`fr-${current.requestId}`}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="pointer-events-auto rounded-2xl bg-[#111119]/95 backdrop-blur-2xl border border-[#8065FF]/45 shadow-[0_20px_50px_rgba(0,0,0,0.75)] p-4 text-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#181821] border border-[#292936] flex items-center justify-center shrink-0">
                  {sender.avatarUrl ? (
                    <img
                      src={sender.avatarUrl}
                      alt={sender.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-black text-[#A18BFF] uppercase">
                      {(sender.name || '?').slice(0, 1)}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#A18BFF]">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Запрос в друзья</span>
                    {visible.length > 1 && (
                      <span className="px-1.5 rounded-full bg-[#8065FF]/25 text-[10px]">
                        +{visible.length - 1}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-white truncate mt-0.5">{sender.name}</p>
                  {sender.email && (
                    <p className="text-[11px] text-[#92929F] truncate">{sender.email}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDismissedIds((prev) => [...prev, current.requestId])}
                aria-label="Скрыть уведомление"
                className="p-1 rounded-lg text-[#92929F] hover:text-white hover:bg-white/5 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3.5">
              <button
                type="button"
                disabled={busyId === current.requestId}
                onClick={() => handleAccept(current)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl brand-btn text-white text-xs font-bold disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Принять</span>
              </button>

              <button
                type="button"
                disabled={busyId === current.requestId}
                onClick={() => handleDecline(current)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-[#181821] hover:bg-white/10 border border-[#292936] text-xs font-semibold text-white transition-colors disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5 text-[#92929F]" />
                <span>Отклонить</span>
              </button>

              <button
                type="button"
                disabled={busyId === current.requestId}
                onClick={() => handleBlock(current)}
                className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-semibold text-rose-300 transition-colors disabled:opacity-50"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Блок</span>
              </button>
            </div>
          </motion.div>
        )}

        {accessToken &&
          msgToasts.map((toast) => (
            <motion.div
              key={`msg-${toast.id}`}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="pointer-events-auto rounded-2xl bg-[#111119]/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.75)] p-3.5 text-white cursor-pointer hover:border-[#8065FF]/60 transition-colors"
              onClick={() => {
                setMsgToasts((prev) => prev.filter((item) => item.id !== toast.id));
                router.push(toast.href);
              }}
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#181821] border border-[#292936] flex items-center justify-center shrink-0">
                    {toast.avatarUrl ? (
                      <img
                        src={toast.avatarUrl}
                        alt={toast.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <MessageCircle className="w-5 h-5 text-[#A18BFF]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#A18BFF] truncate">{toast.title}</p>
                    <p className="text-xs text-white/90 line-clamp-2 mt-0.5">{toast.preview}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMsgToasts((prev) => prev.filter((item) => item.id !== toast.id));
                  }}
                  aria-label="Закрыть"
                  className="p-1 rounded-lg text-[#92929F] hover:text-white shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
