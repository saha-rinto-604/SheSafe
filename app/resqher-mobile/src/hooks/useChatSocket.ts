// ─── useChatSocket — WebSocket + Polling Fallback (NFR-006) ─────────────────
// Connects to Django Channels WebSocket for real-time chat.
// If WS fails or disconnects, falls back to polling every 5s.

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { chatService } from '../services/chatService';
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

export function useChatSocket(incidentId: string): UseChatSocketReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [victimLocation, setVictimLocation] = useState<IncidentLocation | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    // ── Fetch messages via REST (initial load + polling fallback) ──
    const refreshMessages = useCallback(async () => {
        try {
            const msgs = await chatService.getMessages(incidentId);
            if (mountedRef.current) setMessages(msgs);
        } catch { /* silent */ }
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
                        case 'chat.message.new':
                            setMessages(prev => [...prev, data.payload]);
                            break;
                        case 'incident.participant.joined':
                            setParticipants(prev => {
                                if (prev.find(p => p.id === data.payload.id)) return prev;
                                return [...prev, data.payload];
                            });
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
        // Try WS first
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'chat.message.send',
                payload: { content, message_type: type },
            }));
            return;
        }

        // Fallback to REST
        const msg = await chatService.sendMessage(incidentId, { content, type });
        if (mountedRef.current) {
            setMessages(prev => [...prev, msg]);
        }
    }, [incidentId]);

    // ── Lifecycle ──
    useEffect(() => {
        mountedRef.current = true;
        refreshMessages(); // Initial load
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
