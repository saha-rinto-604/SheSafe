import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getAccessToken, getWebSocketUrl } from '../services/api';
import type { NearbyIncident } from '../services/incidentService';
import type { BackendNotification } from '../services/notificationService';

type DispatchEvent =
    | { type: 'dispatch.connected'; payload: { userId: string } }
    | { type: 'sos.new'; payload: { incidentId: string; victimName: string; avatarUri?: string | null; latitude: number; longitude: number; address: string | null; distanceKm: number | null; createdAt: string } }
    | { type: 'sos.accepted'; payload: { incidentId: string; volunteer: { id: string; name: string; photoUrl: string | null } } }
    | { type: 'sos.claimed'; payload: { incidentId: string } }
    | { type: 'sos.rejected'; payload: { incidentId: string } }
    | { type: 'law_enforcement.assigned' | 'police:assigned'; payload: PoliceDispatchPayload }
    | { type: 'incident_status_updated' | 'incident:status_updated'; payload: PoliceDispatchPayload }
    | { type: 'law_enforcement.requested' | 'law_enforcement.request_updated'; payload: LawEnforcementRequestPayload }
    | { type: 'notification.created'; payload: BackendNotification };

export type PoliceDispatchPayload = {
    notificationId?: string | null;
    type?: string | null;
    incidentId: string;
    requestId?: string | null;
    status?: string | null;
    title?: string | null;
    message?: string | null;
    createdAt?: string | null;
    assignedPoliceId?: string | null;
    stationId?: string | null;
};

export type LawEnforcementRequestPayload = {
    notificationId?: string | null;
    type?: string | null;
    incidentId?: string | null;
    requestId?: string | null;
    status?: string | null;
    title?: string | null;
    message?: string | null;
    createdAt?: string | null;
};

type Handlers = {
    enabled?: boolean;
    onNewSos?: (incident: NearbyIncident) => void;
    onAccepted?: (payload: Extract<DispatchEvent, { type: 'sos.accepted' }>['payload']) => void;
    onClaimed?: (incidentId: string) => void;
    onIncidentStatusUpdated?: (payload: PoliceDispatchPayload) => void;
    onPoliceAssignment?: (payload: PoliceDispatchPayload) => void;
    onLawEnforcementRequest?: (payload: LawEnforcementRequestPayload) => void;
    onNotificationCreated?: (notification: BackendNotification) => void;
};

export function useDispatchSocket({
    enabled = true,
    onNewSos,
    onAccepted,
    onClaimed,
    onIncidentStatusUpdated,
    onPoliceAssignment,
    onLawEnforcementRequest,
    onNotificationCreated,
}: Handlers) {
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const mountedRef = useRef(true);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectRef = useRef<(() => Promise<void>) | null>(null);
    const handlersRef = useRef({ onNewSos, onAccepted, onClaimed, onIncidentStatusUpdated, onPoliceAssignment, onLawEnforcementRequest, onNotificationCreated });

    useEffect(() => {
        handlersRef.current = { onNewSos, onAccepted, onClaimed, onIncidentStatusUpdated, onPoliceAssignment, onLawEnforcementRequest, onNotificationCreated };
    }, [onNewSos, onAccepted, onClaimed, onIncidentStatusUpdated, onPoliceAssignment, onLawEnforcementRequest, onNotificationCreated]);

    const connect = useCallback(async () => {
        if (!enabled) return;
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

                    if (data.type === 'incident_status_updated' || data.type === 'incident:status_updated') {
                        handlersRef.current.onIncidentStatusUpdated?.({
                            ...data.payload,
                            incidentId: String(data.payload.incidentId),
                            requestId: data.payload.requestId ? String(data.payload.requestId) : null,
                            status: data.payload.status ? String(data.payload.status).toUpperCase() : undefined,
                            assignedPoliceId: data.payload.assignedPoliceId ? String(data.payload.assignedPoliceId) : null,
                        });
                    }

                    if (data.type === 'law_enforcement.assigned' || data.type === 'police:assigned') {
                        handlersRef.current.onPoliceAssignment?.({
                            ...data.payload,
                            incidentId: String(data.payload.incidentId),
                            requestId: data.payload.requestId ? String(data.payload.requestId) : null,
                            assignedPoliceId: data.payload.assignedPoliceId ? String(data.payload.assignedPoliceId) : null,
                        });
                    }

                    if (data.type === 'law_enforcement.requested' || data.type === 'law_enforcement.request_updated') {
                        handlersRef.current.onLawEnforcementRequest?.({
                            ...data.payload,
                            incidentId: data.payload.incidentId ? String(data.payload.incidentId) : null,
                            requestId: data.payload.requestId ? String(data.payload.requestId) : null,
                            status: data.payload.status ? String(data.payload.status).toUpperCase() : undefined,
                        });
                    }

                    if (data.type === 'notification.created') {
                        handlersRef.current.onNotificationCreated?.(data.payload);
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
                reconnectRef.current = setTimeout(() => { void connectRef.current?.(); }, 3000);
            };
        } catch {
            if (!mountedRef.current) return;
            setIsConnected(false);
            reconnectRef.current = setTimeout(() => { void connectRef.current?.(); }, 3000);
        }
    }, [enabled]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    useEffect(() => {
        mountedRef.current = true;
        let disabledTimer: ReturnType<typeof setTimeout> | null = null;
        if (enabled) {
            connect();
        } else {
            disabledTimer = setTimeout(() => {
                if (mountedRef.current) setIsConnected(false);
            }, 0);
            wsRef.current?.close();
            wsRef.current = null;
        }

        const sub = AppState.addEventListener('change', (state) => {
            if (enabled && state === 'active' && mountedRef.current && wsRef.current?.readyState !== WebSocket.OPEN) {
                connect();
            }
        });

        return () => {
            mountedRef.current = false;
            if (disabledTimer) clearTimeout(disabledTimer);
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            wsRef.current?.close();
            wsRef.current = null;
            sub.remove();
        };
    }, [connect, enabled]);

    return { isConnected };
}
