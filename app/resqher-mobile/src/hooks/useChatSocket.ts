// ─── useChatSocket — WebSocket + Polling Fallback (NFR-006) ─────────────────
// Connects to Django Channels WebSocket for real-time chat.
// If WS fails or disconnects, falls back to polling every 5s.

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { chatService } from '../services/chatService';
import { chatStore } from '../services/chatStore';
import { notificationStore } from '../services/notificationStore';
import { getAccessToken } from '../services/api';
import type { Message, Participant, IncidentLocation } from '../types/chat';

const POLL_INTERVAL_MS = 5000;
const WS_BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000')
    .replace(/^http/, 'ws')
    .replace(/\/+$/, '');

type WSEvent =
    | { type: 'chat.message.new'; payload: Message }
    | { type: 'incident.participant.joined'; payload: Participant }
    | { type: 'incident.location.updated'; payload: IncidentLocation };

interface UseChatSocketReturn {
    messages: Message[];
    participants: Participant[];
    victimLocation: IncidentLocation | null;
    isConnected: boolean;
    sendMessage: (content: string, type?: 'TEXT' | 'IMAGE' | 'AUDIO') => Promise<void>;
    refreshMessages: () => Promise<void>;
}

// selfId lets the hook optimistically show sent messages before the server echo arrives
export function useChatSocket(incidentId: string, selfId?: string): UseChatSocketReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [victimLocation, setVictimLocation] = useState<IncidentLocation | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);
    const selfIdRef = useRef(selfId);
    useEffect(() => { selfIdRef.current = selfId; }, [selfId]);

    // ── Fetch messages via REST (initial load + polling fallback) ──
    const refreshMessages = useCallback(async () => {
        try {
            const msgs = await chatService.getMessages(incidentId);
            if (mountedRef.current) {
                setMessages(msgs);
                chatStore.save(incidentId, msgs); // persist for offline re-open
            }
        } catch { /* silent — cached messages remain */ }
    }, [incidentId]);

    // ── Start polling fallback ──
    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(refreshMessages, POLL_INTERVAL_MS);
    }, [refreshMessages]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    // ── WebSocket connection ──
    const connectWS = useCallback(async () => {
        try {
            const token = await getAccessToken();
            const url = `${WS_BASE}/ws/chat/${incidentId}/?token=${token || ''}`;
            const ws = new WebSocket(url);

            ws.onopen = () => {
                if (mountedRef.current) {
                    setIsConnected(true);
                    stopPolling(); // WS is working, no need to poll
                }
            };

            ws.onmessage = (event) => {
                try {
                    const data: WSEvent = JSON.parse(event.data);
                    if (!mountedRef.current) return;

                    switch (data.type) {
                        case 'chat.message.new': {
                            const incoming = data.payload;
                            setMessages(prev => {
                                // Deduplicate: drop if real ID already present
                                if (prev.find(m => m.id === incoming.id)) return prev;
                                // If this is an echo of our own send, replace the optimistic entry
                                const sid = selfIdRef.current;
                                if (sid && incoming.sender.id === sid) {
                                    const optIdx = prev.findIndex(
                                        m => m.id.startsWith('opt-') && m.content === incoming.content
                                    );
                                    if (optIdx !== -1) {
                                        const next = [...prev];
                                        next[optIdx] = incoming;
                                        chatStore.save(incidentId, next);
                                        return next;
                                    }
                                }
                                const next = [...prev, incoming];
                                chatStore.save(incidentId, next);
                                return next;
                            });
                            // Notify if message is from someone else
                            if (incoming.sender.id !== selfIdRef.current) {
                                notificationStore.add({
                                    type: 'message_received',
                                    title: 'New Message',
                                    body: `${incoming.sender.name}: ${incoming.content.slice(0, 60)}`,
                                    incidentId,
                                    createdAt: new Date().toISOString(),
                                });
                            }
                            break;
                        }
                        case 'incident.participant.joined':
                            setParticipants(prev => {
                                if (prev.find(p => p.id === data.payload.id)) return prev;
                                return [...prev, data.payload];
                            });
                            if (data.payload.id !== selfIdRef.current) {
                                notificationStore.add({
                                    type: 'volunteer_joined',
                                    title: 'Responder Joined',
                                    body: `${data.payload.name || 'A responder'} has joined your incident`,
                                    incidentId,
                                    createdAt: new Date().toISOString(),
                                });
                            }
                            break;
                        case 'incident.location.updated':
                            setVictimLocation(data.payload);
                            break;
                    }
                } catch { /* malformed message, ignore */ }
            };

            ws.onerror = () => {
                if (mountedRef.current) {
                    setIsConnected(false);
                    startPolling(); // Fallback
                }
            };

            ws.onclose = () => {
                if (mountedRef.current) {
                    setIsConnected(false);
                    startPolling(); // Fallback
                    // Reconnect after 3s
                    setTimeout(() => {
                        if (mountedRef.current) connectWS();
                    }, 3000);
                }
            };

            wsRef.current = ws;
        } catch {
            // WS connection failed entirely — use polling
            if (mountedRef.current) {
                setIsConnected(false);
                startPolling();
            }
        }
    }, [incidentId, startPolling, stopPolling]);

    // ── Send message ──
    const sendMessage = useCallback(async (
        content: string,
        type: 'TEXT' | 'IMAGE' | 'AUDIO' = 'TEXT',
    ) => {
        // Try WS first — add an optimistic entry immediately so the message
        // appears in the list without waiting for the server echo
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            const tempId = `opt-${Date.now()}`;
            const optimistic: Message = {
                id: tempId,
                incidentId,
                sender: { id: selfIdRef.current ?? 'self', name: 'You', role: 'USER' },
                content,
                type,
                timestamp: new Date().toISOString(),
            };
            if (mountedRef.current) setMessages(prev => [...prev, optimistic]);
            wsRef.current.send(JSON.stringify({
                type: 'chat.message.send',
                payload: { content, message_type: type },
            }));
            return;
        }

        // Fallback to REST
        try {
            const msg = await chatService.sendMessage(incidentId, { content, type });
            if (mountedRef.current) {
                setMessages(prev => {
                    const next = [...prev, msg];
                    chatStore.save(incidentId, next);
                    return next;
                });
            }
        } catch { /* REST fallback failed — backend unreachable */ }
    }, [incidentId]);

    // ── Lifecycle ──
    useEffect(() => {
        mountedRef.current = true;

        // Load cached messages immediately so chat isn't blank on re-open
        chatStore.load(incidentId).then(cached => {
            if (mountedRef.current && cached.length > 0) setMessages(cached);
        });

        refreshMessages(); // Refresh from backend (overwrites cache on success)
        connectWS();       // Try WebSocket

        // Handle app state (reconnect on foreground)
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active' && mountedRef.current) {
                refreshMessages();
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                    connectWS();
                }
            }
        });

        return () => {
            mountedRef.current = false;
            wsRef.current?.close();
            wsRef.current = null;
            stopPolling();
            sub.remove();
        };
    }, [incidentId]);

    return { messages, participants, victimLocation, isConnected, sendMessage, refreshMessages };
}
