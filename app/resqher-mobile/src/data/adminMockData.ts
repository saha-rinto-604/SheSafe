// Admin Dashboard Mock Data
export const ADMIN_STATS = {
  totalUsers: 245,
  verifiedVolunteers: 38,
  activeSos: 4,
  totalIncidents: 160,
  resolvedIncidents: 156,
  pendingVerifications: 5,
  policeEscalations: 3,
  userReports: 7,
  volunteersOnline: 12,
};

export type IncidentStatus = 'ACTIVE' | 'RESOLVED' | 'ESCALATED' | 'CANCELLED';

export type AssignedVolunteer = {
  id: string;
  name: string;
  distance: string;
};

export type MockIncident = {
  id: string;
  victim: string;
  location: string;
  time: string;
  status: IncidentStatus;
  volunteers: number;
  policeEscalated: boolean;
  assignedVolunteers?: AssignedVolunteer[];
};

export const MOCK_INCIDENTS: MockIncident[] = [
  { id: '#2041', victim: 'Ayesha Rahman', location: 'Mirpur, Dhaka', time: '10:42 PM', status: 'ACTIVE', volunteers: 2, policeEscalated: false, assignedVolunteers: [{ id: 'V-101', name: 'Tanvir Hasan', distance: '0.8 km' }, { id: 'V-102', name: 'Rafiq Ahmed', distance: '1.2 km' }] },
  { id: '#2040', victim: 'Fatima Akter', location: 'Gulshan, Dhaka', time: '9:15 PM', status: 'ACTIVE', volunteers: 1, policeEscalated: true, assignedVolunteers: [{ id: 'V-103', name: 'Mariam Khatun', distance: '2.5 km' }] },
  { id: '#2039', victim: 'Nusrat Jahan', location: 'Dhanmondi, Dhaka', time: '8:30 PM', status: 'ACTIVE', volunteers: 3, policeEscalated: false, assignedVolunteers: [{ id: 'V-104', name: 'Kamal Hossain', distance: '0.5 km' }, { id: 'V-105', name: 'Nasima Akter', distance: '1.1 km' }, { id: 'V-106', name: 'Rokeya Begum', distance: '1.8 km' }] },
  { id: '#2038', victim: 'Sumaiya Islam', location: 'Mohammadpur, Dhaka', time: '7:55 PM', status: 'RESOLVED', volunteers: 2, policeEscalated: true, assignedVolunteers: [{ id: 'V-101', name: 'Tanvir Hasan', distance: '0.4 km' }, { id: 'V-102', name: 'Rafiq Ahmed', distance: '1.0 km' }] },
  { id: '#2037', victim: 'Tania Begum', location: 'Uttara, Dhaka', time: 'Yesterday', status: 'CANCELLED', volunteers: 2, policeEscalated: false, assignedVolunteers: [{ id: 'V-108', name: 'Hasib Rahman', distance: '0.3 km' }, { id: 'V-109', name: 'Juel Rana', distance: '0.7 km' }] },
  { id: '#2036', victim: 'Sadia Hasan', location: 'Badda, Dhaka', time: '2 Days Ago', status: 'RESOLVED', volunteers: 1, policeEscalated: false, assignedVolunteers: [{ id: 'V-107', name: 'Noman', distance: '0.2 km' }] },
  { id: '#2034', victim: 'Ayesha Rahman', location: 'Mirpur, Dhaka', time: '3 Days Ago', status: 'RESOLVED', volunteers: 1, policeEscalated: true, assignedVolunteers: [{ id: 'V-103', name: 'Mariam Khatun', distance: '1.2 km' }] },
  { id: '#2033', victim: 'Ayesha Rahman', location: 'Mirpur, Dhaka', time: 'Last Week', status: 'CANCELLED', volunteers: 0, policeEscalated: false, assignedVolunteers: [] },
  { id: '#2032', victim: 'Ayesha Rahman', location: 'Mirpur, Dhaka', time: 'Just Now', status: 'ACTIVE', volunteers: 1, policeEscalated: true, assignedVolunteers: [{ id: 'V-104', name: 'Kamal Hossain', distance: '0.5 km' }] },
  { id: '#2031', victim: 'Tanvir Hasan', location: 'Banani, Dhaka', time: 'Last Month', status: 'RESOLVED', volunteers: 2, policeEscalated: false, assignedVolunteers: [{ id: 'V-108', name: 'Hasib Rahman', distance: '1.5 km' }] },
  { id: '#2030', victim: 'Tanvir Hasan', location: 'Banani, Dhaka', time: '2 Months Ago', status: 'CANCELLED', volunteers: 0, policeEscalated: false, assignedVolunteers: [] },
  { id: '#2029', victim: 'Nasima Akter', location: 'Badda, Dhaka', time: 'Yesterday', status: 'ACTIVE', volunteers: 1, policeEscalated: true, assignedVolunteers: [{ id: 'V-101', name: 'Tanvir Hasan', distance: '0.9 km' }] },
];

export type MockEscalation = {
  incidentId: string;
  victim: string;
  location: string;
  date: string;
};

export const MOCK_ESCALATIONS: MockEscalation[] = [
  { incidentId: '#2040', victim: 'Fatima Akter', location: 'Gulshan 2', date: 'Today' },
  { incidentId: '#2038', victim: 'Nusrat Jahan', location: 'Mohammadpur', date: 'Today' },
  { incidentId: '#2035', victim: 'Sumaiya Islam', location: 'Uttara Sector 7', date: 'Yesterday' },
];

export type MockVerification = {
  id: string;
  name: string;
  phone: string;
  submitted: string;
  idCardUrl: string;
  selfieUrl: string;
  certificateUrl?: string;
};

export const MOCK_VERIFICATIONS: MockVerification[] = [
  { 
    id: 'REQ-001', 
    name: 'Tanvir Hasan', 
    phone: '+880 1711-223344', 
    submitted: '2h ago',
    idCardUrl: 'https://placehold.co/600x400/8A38F6/FFFFFF/png?text=ID+Card',
    selfieUrl: 'https://placehold.co/400x600/8A38F6/FFFFFF/png?text=Selfie+With+ID',
    certificateUrl: 'https://placehold.co/600x450/8A38F6/FFFFFF/png?text=CPR+Certificate'
  },
  { 
    id: 'REQ-002', 
    name: 'Rafiq Ahmed', 
    phone: '+880 1722-334455', 
    submitted: '5h ago',
    idCardUrl: 'https://placehold.co/600x400/8A38F6/FFFFFF/png?text=ID+Card',
    selfieUrl: 'https://placehold.co/400x600/8A38F6/FFFFFF/png?text=Selfie+With+ID'
  },
  { 
    id: 'REQ-003', 
    name: 'Mariam Khatun', 
    phone: '+880 1733-445566', 
    submitted: '1d ago',
    idCardUrl: 'https://placehold.co/600x400/8A38F6/FFFFFF/png?text=ID+Card',
    selfieUrl: 'https://placehold.co/400x600/8A38F6/FFFFFF/png?text=Selfie+With+ID',
    certificateUrl: 'https://placehold.co/600x450/8A38F6/FFFFFF/png?text=First+Aid+Cert'
  },
];

export type MockReport = {
  id: string;
  reported: string;
  by: string;
  date: string;
  reason: string;
  incidentId: string;
};

export const MOCK_REPORTS: MockReport[] = [
  { id: 'R-001', reported: 'Rahim Uddin', by: 'Kamal Hossain', date: 'Today', reason: 'The user repeatedly sent fake SOS requests and wasted volunteer resources during non-emergency situations.', incidentId: '#2040' },
  { id: 'R-002', reported: 'Sakib Khan', by: 'Nasima Akter', date: 'Yesterday', reason: 'User was verbally abusive, used inappropriate language, and engaged in harassment when assistance was offered.', incidentId: '#2039' },
  { id: 'R-003', reported: 'Jamal Mia', by: 'Rokeya Begum', date: '2 days ago', reason: 'The individual was impersonating a verified volunteer and attempting to gather sensitive information.', incidentId: '#2036' },
];

export type MockStandardUser = {
  id: string;
  name: string;
  phone: string;
  sosRequests: number;
  incidents: MockIncident[];
};

export type MockVolunteer = {
  id: string;
  name: string;
  phone: string;
  rank: number;
  points: number;
  assistedCount: number;
  assistedIncidents: MockIncident[];
  sosRequests: number;
  sosIncidents: MockIncident[];
};

export const MOCK_STANDARD_USERS: MockStandardUser[] = [
  {
    id: 'U-001',
    name: 'Ayesha Rahman',
    phone: '+880 1711-000001',
    sosRequests: 5,
    incidents: [MOCK_INCIDENTS[8], MOCK_INCIDENTS[0], MOCK_INCIDENTS[6], MOCK_INCIDENTS[7], MOCK_INCIDENTS[2]],
  },
  {
    id: 'U-002',
    name: 'Tania Begum',
    phone: '+880 1711-000002',
    sosRequests: 1,
    incidents: [MOCK_INCIDENTS[4]],
  }
];

export const MOCK_VOLUNTEERS: MockVolunteer[] = [
  {
    id: 'V-101',
    name: 'Tanvir Hasan',
    phone: '+880 1722-000101',
    rank: 12,
    points: 245,
    assistedCount: 18,
    assistedIncidents: [MOCK_INCIDENTS[0], MOCK_INCIDENTS[3], MOCK_INCIDENTS[11]],
    sosRequests: 2,
    sosIncidents: [MOCK_INCIDENTS[9], MOCK_INCIDENTS[10]],
  },
  {
    id: 'V-103',
    name: 'Mariam Khatun',
    phone: '+880 1722-000103',
    rank: 5,
    points: 412,
    assistedCount: 35,
    assistedIncidents: [MOCK_INCIDENTS[1]],
    sosRequests: 0,
    sosIncidents: [],
  }
];

export type MockSafePlaceRequest = {
  id: string;
  placeName: string;
  location: string;
  requestedBy: string;
  userType: 'Standard User' | 'Volunteer';
  description: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export const MOCK_SAFE_PLACES: MockSafePlaceRequest[] = [
  {
    id: 'SP-001',
    placeName: 'UIU Campus Security Box',
    location: 'Madani Avenue, Dhaka',
    requestedBy: 'Ayesha Rahman',
    userType: 'Standard User',
    description: 'This is a 24/7 security booth inside the campus which provides immediate shelter and has first aid facilities.',
    date: 'Today, 10:30 AM',
    status: 'PENDING',
  },
  {
    id: 'SP-002',
    placeName: 'Khilkhet Police Station',
    location: 'Khilkhet, Dhaka',
    requestedBy: 'Tanvir Hasan',
    userType: 'Volunteer',
    description: 'Local police station. A reliable spot for anyone seeking emergency help.',
    date: 'Yesterday, 8:15 PM',
    status: 'PENDING',
  },
  {
    id: 'SP-003',
    placeName: 'Gulshan Pink City',
    location: 'Gulshan 2, Dhaka',
    requestedBy: 'Mariam Khatun',
    userType: 'Volunteer',
    description: 'Mall security is very active here and safe for women waiting for rides.',
    date: '2 Days Ago',
    status: 'APPROVED',
  }
];

export type SidebarItem = {

  key: string;
  label: string;
  icon: string;
};

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'verifications', label: 'Verifications', icon: 'check-circle' },
  { key: 'safeplaces', label: 'Safe Places', icon: 'map-pin' },
  { key: 'escalations', label: 'Escalations', icon: 'alert-triangle' },
  { key: 'reports', label: 'Reports', icon: 'file-text' },
];
