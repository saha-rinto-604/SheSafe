import api from './api';

export interface IncidentZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  incidentCount: number;
  incidents: { id: string; reporter: string; time: string; status: string }[];
}

export const incidentService = {
  async createIncident(payload: {
    latitude: number;
    longitude: number;
    address?: string;
  }) {
    const res = await api.post('/api/incidents', payload);
    return res.data.incident as {
      id: number | string;
      latitude: number;
      longitude: number;
      address: string | null;
      status: string;
      created_at: string;
    };
  },

  async cancelIncident(id: number | string) {
    const res = await api.patch(`/api/incidents/${id}/cancel`);
    return res.data.incident;
  },

  async getOne(id: number | string) {
    const res = await api.get(`/api/incidents/${id}`);
    return res.data.incident;
  },

  async getZones(): Promise<IncidentZone[]> {
    const res = await api.get('/api/incidents/zones');
    return (res.data?.zones ?? []) as IncidentZone[];
  },
};
