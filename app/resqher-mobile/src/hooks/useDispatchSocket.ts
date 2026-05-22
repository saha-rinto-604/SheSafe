import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getAccessToken, getWebSocketUrl } from '../services/api';
import type { NearbyIncident } from '../services/incidentService';

type DispatchEvent =
    | { type: 'dispatch.connected'; payload: { userId: string } }
    | { type: 'sos.new'; payload: { incidentId: string; victimName: string; avatarUri?: string | null; latitude: number; longitude: number; address: string | null; distanceKm: number | null; createdAt: string } }
    | { type: 'sos.accepted'; payload: { incidentId: string; volunteer: { id: string; name: string; photoUrl: string | null } } }
    | { type: 'sos.claimed'; payload: { incidentId: string } }
    | { type: 'sos.rejected'; payload: { incidentId: string } };

type Handlers = {
    onNewSos?: (incident: NearbyIncident) => void;
    onAccepted?: (payload: Extract<DispatchEvent, { type: 'sos.accepted' }>['payload']) => void;
    onClaimed?: (incidentId: string) => void;
};

export function useDispatchSocket({ onNewSos, onAccepted, onClaimed }: Handlers) {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const mountedRef = useRef(true);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handlersRef = useRef({ onNewSos, onAccepted, onClaimed });

    useEffect(() => {
        handlersRef.current = { onNewSos, onAccepted, onClaimed };
    }, [onNewSos, onAccepted, onClaimed]);

    const connect = useCallback(async () => {
        try {
            const token = await getAccessToken();
            const ws = new WebSocket(getWebSocketUrl(`/ws/dispatch/?token=${encodeURIComponent(token || '')}`));
            wsRef.current = ws;

            ws.onopen = () => {
                if (mountedRef.current) setIsConnected(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data: DispatchEvent = JSON.parse(event.data);
                    if (!mountedRef.current) return;

                    if (data.type === 'sos.new') {
                        handlersRef.current.onNewSos?.({
                            id: String(data.payload.incidentId),
                            victimName: data.payload.victimName,
                            avatarUri: data.payload.avatarUri ?? null,
                            distanceKm: Number(data.payload.distanceKm ?? 0),
                            locationLabel: data.payload.address || `${Number(data.payload.latitude).toFixed(4)}, ${Number(data.payload.longitude).toFixed(4)}`,
                            latitude: Number(data.payload.latitude),
                            longitude: Number(data.payload.longitude),
                            status: 'ACTIVE',
                            createdAt: data.payload.createdAt,
                        });
                    }

                    if (data.type === 'sos.accepted') {
                        handlersRef.current.onAccepted?.(data.payload);
                    }

                    if (data.type === 'sos.claimed') {
                        handlersRef.current.onClaimed?.(String(data.payload.incidentId));
                    }
                } catch {
                    // Ignore malformed dispatch frames.
                }
            };

            ws.onerror = () => {
                if (mountedRef.current) setIsConnected(false);
            };

            ws.onclose = () => {
                if (!mountedRef.current) return;
                setIsConnected(false);
                reconnectRef.current = setTimeout(connect, 3000);
            };
        } catch {
            if (!mountedRef.current) return;
            setIsConnected(false);
            reconnectRef.current = setTimeout(connect, 3000);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active' && mountedRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
                connect();
            }
        });

        return () => {
            mountedRef.current = false;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
            wsRef.current = null;
            sub.remove();
        };
    }, [connect]);

    return { isConnected };
}
