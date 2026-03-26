export type IncidentStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

export type PlaceIncident = {
    id: string;
    reporter: string;
    time: string;
    status: IncidentStatus;
};

export const DHAKA_INCIDENTS: Record<string, PlaceIncident[]> = {
    'dhaka-dhanmondi-lake': [
        { id: 'inc-dh-001', reporter: 'Fatima Rahman', time: '12 min ago', status: 'ACTIVE' },
        { id: 'inc-dh-002', reporter: 'Kabir Hossain', time: '1 hr ago', status: 'RESOLVED' },
    ],
    'dhaka-gulshan-1': [
        { id: 'inc-gul-001', reporter: 'Nadia Akter', time: '25 min ago', status: 'RESOLVED' },
        { id: 'inc-gul-002', reporter: 'Officer Alam', time: '2 hr ago', status: 'CANCELLED' },
    ],
    'dhaka-mirpur-10': [
        { id: 'inc-mir-001', reporter: 'Ayesha Khan', time: '5 min ago', status: 'ACTIVE' },
        { id: 'inc-mir-002', reporter: 'Nabil Hasan', time: 'Yesterday', status: 'RESOLVED' },
    ],
    'dhaka-hatirjheel': [
        { id: 'inc-hat-001', reporter: 'Rafiq Islam', time: '40 min ago', status: 'ACTIVE' },
    ],
};
