// ─── ResQher Medical Module — Seeded Mock Data ──────────────────────────────
// Dhaka context — specialists, hospitals, ambulances, pharmacies, others
// V4.0 — Rich provider data for all categories with map coordinates

import type { CategoryItem, QuickChip } from '../types/medical';

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════
export const CATEGORIES: CategoryItem[] = [
    { id: 'specialists', label: 'Specialists', icon: 'medkit-outline', description: 'Find specialist doctors' },
    { id: 'hospital', label: 'Hospitals', icon: 'business-outline', description: 'Navigate to hospitals' },
    { id: 'ambulance', label: 'Ambulance', icon: 'car-outline', description: 'Request ambulance' },
    { id: 'pharmacy', label: 'Pharmacy', icon: 'bandage-outline', description: 'Find nearby pharmacy' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK SELECTOR CHIPS — Map bottom bar
// ═══════════════════════════════════════════════════════════════════════════════
export const SPECIALIST_CHIPS: QuickChip[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'Cardiologist', label: 'Cardiology', icon: 'heart-outline' },
    { id: 'Neurologist', label: 'Neurology', icon: 'pulse-outline' },
    { id: 'Pediatrician', label: 'Pediatrics', icon: 'people-outline' },
    { id: 'Orthopedic Surgeon', label: 'Orthopedics', icon: 'fitness-outline' },
    { id: 'Gynecologist', label: 'Gynecology', icon: 'female-outline' },
    { id: 'Dermatologist', label: 'Dermatology', icon: 'body-outline' },
];

export const AMBULANCE_CHIPS: QuickChip[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'standard', label: 'Standard', icon: 'car-outline' },
    { id: 'ac', label: 'AC', icon: 'snow-outline' },
    { id: 'icu_ccu', label: 'ICU/CCU', icon: 'medkit-outline' },
];

export const GENERIC_CHIPS: QuickChip[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
];

export const OTHERS_CHIPS: QuickChip[] = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'Diagnostic Center', label: 'Diagnostics', icon: 'flask-outline' },
    { id: 'Blood Bank', label: 'Blood Bank', icon: 'water-outline' },
    { id: 'Mental Health', label: 'Mental Health', icon: 'accessibility-outline' },
    { id: 'Physiotherapy', label: 'Physio', icon: 'body-outline' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK SPECIALISTS / DOCTORS — 15 providers across Dhaka
// ═══════════════════════════════════════════════════════════════════════════════
export const MOCK_DOCTORS = [
    { id: 'doc-1', name: 'Dr. Nasrin Akhtar', degree: 'MBBS, FCPS (Cardiology)', hospital: 'Square Hospital', specialty: 'Cardiologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.squarehospital.com/appointment', latitude: 23.7518, longitude: 90.3754, rating: 4.8, affiliation: 'Square Hospital, Panthapath' },
    { id: 'doc-2', name: 'Dr. Asif Rahman', degree: 'MBBS, MD (Cardiology)', hospital: 'United Hospital', specialty: 'Cardiologist', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.uhlbd.com', latitude: 23.7961, longitude: 90.4246, rating: 4.7, affiliation: 'United Hospital, Gulshan 2' },
    { id: 'doc-3', name: 'Dr. Anwar Hossain', degree: 'MBBS, FRCP (Cardiology)', hospital: 'Apollo Hospitals', specialty: 'Cardiologist', shift: 'now', safeRouteVerified: true, bookingUrl: 'https://www.apollodhaka.com', latitude: 23.8050, longitude: 90.4190, rating: 4.9, affiliation: 'Apollo Hospitals, Bashundhara' },
    { id: 'doc-4', name: 'Dr. Tariq Islam', degree: 'MBBS, DLO (Neurology)', hospital: 'NINS', specialty: 'Neurologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://nins.gov.bd', latitude: 23.7269, longitude: 90.3894, rating: 4.9, affiliation: 'National Institute of Neurosciences' },
    { id: 'doc-5', name: 'Dr. Shirin Sultana', degree: 'MBBS, FCPS (Neurology)', hospital: 'BIRDEM', specialty: 'Neurologist', shift: 'evening', safeRouteVerified: false, bookingUrl: '', latitude: 23.7408, longitude: 90.3955, rating: 4.6, affiliation: 'BIRDEM General Hospital' },
    { id: 'doc-6', name: 'Dr. Mizanur Rahman', degree: 'MBBS, DCH, MD (Pediatrics)', hospital: 'Dhaka Shishu Hospital', specialty: 'Pediatrician', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.dsh.gov.bd', latitude: 23.7277, longitude: 90.4125, rating: 4.8, affiliation: 'Dhaka Shishu Hospital' },
    { id: 'doc-7', name: 'Dr. Fatema Begum', degree: 'MBBS, FCPS (Pediatrics)', hospital: 'Evercare Hospital', specialty: 'Pediatrician', shift: 'now', safeRouteVerified: true, bookingUrl: 'https://www.evercarebd.com', latitude: 23.8103, longitude: 90.4130, rating: 4.7, affiliation: 'Evercare Hospital, Bashundhara' },
    { id: 'doc-8', name: 'Dr. Rafiqul Islam', degree: 'MBBS, FCH (Pediatrics)', hospital: 'Holy Family', specialty: 'Pediatrician', shift: 'evening', safeRouteVerified: false, bookingUrl: '', latitude: 23.7545, longitude: 90.3842, rating: 4.7, affiliation: 'Holy Family Red Crescent Hospital' },
    { id: 'doc-9', name: 'Dr. Kamal Hossain', degree: 'MBBS, MS (Orthopedics)', hospital: 'NITOR', specialty: 'Orthopedic Surgeon', shift: 'morning', safeRouteVerified: true, bookingUrl: '', latitude: 23.7269, longitude: 90.3956, rating: 4.5, affiliation: 'National Institute of Traumatology' },
    { id: 'doc-10', name: 'Dr. Nurul Haque', degree: 'MBBS, FRCS (Orthopedics)', hospital: 'Square Hospital', specialty: 'Orthopedic Surgeon', shift: 'evening', safeRouteVerified: true, bookingUrl: 'https://www.squarehospital.com/appointment', latitude: 23.7525, longitude: 90.3762, rating: 4.6, affiliation: 'Square Hospital, Panthapath' },
    { id: 'doc-11', name: 'Dr. Jannatul Ferdous', degree: 'MBBS, FCPS (Gynecology)', hospital: 'Labaid Hospital', specialty: 'Gynecologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.labaidgroup.com', latitude: 23.7500, longitude: 90.3722, rating: 4.9, affiliation: 'Labaid Specialized Hospital' },
    { id: 'doc-12', name: 'Dr. Zahirul Islam', degree: 'MBBS, MS (Gynecology)', hospital: 'IMC Hospital', specialty: 'Gynecologist', shift: 'now', safeRouteVerified: false, bookingUrl: '', latitude: 23.8150, longitude: 90.4280, rating: 4.6, affiliation: 'International Medical College Hospital' },
    { id: 'doc-13', name: 'Dr. Sadia Islam', degree: 'MBBS, DDV (Dermatology)', hospital: 'Popular Medical College', specialty: 'Dermatologist', shift: 'morning', safeRouteVerified: true, bookingUrl: 'https://www.popularmedical.com.bd', latitude: 23.7395, longitude: 90.3730, rating: 4.7, affiliation: 'Popular Medical College Hospital' },
    { id: 'doc-14', name: 'Dr. Monika Roy', degree: 'MBBS, FCPS (Dermatology)', hospital: 'SKF Centre', specialty: 'Dermatologist', shift: 'evening', safeRouteVerified: false, bookingUrl: '', latitude: 23.7918, longitude: 90.3984, rating: 4.5, affiliation: 'SKF Skin & Laser Centre, Banani' },
    { id: 'doc-15', name: 'Dr. Sharmin Nahar', degree: 'MBBS, MD (Cardiology)', hospital: 'BSMMU', specialty: 'Cardiologist', shift: 'now', safeRouteVerified: true, bookingUrl: '', latitude: 23.7280, longitude: 90.3900, rating: 4.6, affiliation: 'Bangabandhu Sheikh Mujib Medical Univ.' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK HOSPITALS — 10 hospitals across Dhaka
// ═══════════════════════════════════════════════════════════════════════════════
export const MOCK_HOSPITALS = [
    { id: 'hosp-1', name: 'Square Hospital', address: '18/F Bir Uttam Qazi Nuruzzaman Sarak, Panthapath', contactNumber: '02-8159457', latitude: 23.7518, longitude: 90.3754, bookingUrl: 'https://www.squarehospital.com/appointment', safeRouteVerified: true, rating: 4.8, affiliation: 'Square Hospital Ltd.' },
    { id: 'hosp-2', name: 'United Hospital', address: 'Plot 15, Road 71, Gulshan 2', contactNumber: '10666', latitude: 23.7961, longitude: 90.4246, bookingUrl: 'https://www.uhlbd.com', safeRouteVerified: true, rating: 4.7, affiliation: 'United Hospital Limited' },
    { id: 'hosp-3', name: 'Evercare Hospital', address: 'Plot 81, Block E, Bashundhara R/A', contactNumber: '10678', latitude: 23.8103, longitude: 90.4130, bookingUrl: 'https://www.evercarebd.com', safeRouteVerified: true, rating: 4.9, affiliation: 'Evercare Hospital Dhaka' },
    { id: 'hosp-4', name: 'Labaid Hospital', address: 'House 1, Road 4, Dhanmondi', contactNumber: '16345', latitude: 23.7500, longitude: 90.3722, bookingUrl: 'https://www.labaidgroup.com', safeRouteVerified: true, rating: 4.6, affiliation: 'Labaid Specialized Hospital' },
    { id: 'hosp-5', name: 'Apollo Hospitals Dhaka', address: 'Plot 81, Block E, Bashundhara R/A', contactNumber: '10633', latitude: 23.8050, longitude: 90.4195, bookingUrl: 'https://www.apollodhaka.com', safeRouteVerified: true, rating: 4.8, affiliation: 'Apollo Hospitals Group' },
    { id: 'hosp-6', name: 'BIRDEM General Hospital', address: '122 Kazi Nazrul Islam Ave, Shahbag', contactNumber: '02-8616641', latitude: 23.7408, longitude: 90.3955, bookingUrl: '', safeRouteVerified: false, rating: 4.5, affiliation: 'BIRDEM Academy' },
    { id: 'hosp-7', name: 'Dhaka Medical College Hospital', address: 'Bakshibazar, Dhaka 1000', contactNumber: '02-55165088', latitude: 23.7219, longitude: 90.3985, bookingUrl: '', safeRouteVerified: false, rating: 4.4, affiliation: 'Dhaka Medical College' },
    { id: 'hosp-8', name: 'Holy Family Red Crescent Hospital', address: '1 Eskaton Garden Road, Eskaton', contactNumber: '02-9330075', latitude: 23.7545, longitude: 90.3842, bookingUrl: '', safeRouteVerified: true, rating: 4.6, affiliation: 'Bangladesh Red Crescent Society' },
    { id: 'hosp-9', name: 'National Heart Foundation Hospital', address: 'Plot 7/2, Mirpur, Dhaka 1216', contactNumber: '02-9012005', latitude: 23.8013, longitude: 90.3549, bookingUrl: 'https://www.nhf-bd.org', safeRouteVerified: true, rating: 4.7, affiliation: 'NHF Hospital & Research Institute' },
    { id: 'hosp-10', name: 'Popular Medical College Hospital', address: '2 Pugda, Shyamoli, Dhaka 1207', contactNumber: '02-9113112', latitude: 23.7395, longitude: 90.3730, bookingUrl: 'https://www.popularmedical.com.bd', safeRouteVerified: false, rating: 4.5, affiliation: 'Popular Medical College' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK AMBULANCES — 10 units across Dhaka (standard, AC, ICU/CCU)
// ═══════════════════════════════════════════════════════════════════════════════
export const MOCK_AMBULANCES = [
    { id: 'amb-1', name: 'Dhaka Emergency Ambulance', providerName: 'Dhaka Emergency Ambulance', type: 'standard' as const, contactNumber: '01711-100001', eta: '7 min', safeRouteVerified: true, latitude: 23.7630, longitude: 90.4050, rating: 4.5, affiliation: 'Ministry of Health, GoB' },
    { id: 'amb-2', name: 'Capital Ambulance Service', providerName: 'Capital Ambulance Service', type: 'ac' as const, contactNumber: '01711-100002', eta: '11 min', safeRouteVerified: true, latitude: 23.7850, longitude: 90.4180, rating: 4.6, affiliation: 'Capital City Transport' },
    { id: 'amb-3', name: 'ICU Mobile Unit — A1', providerName: 'ICU Mobile Unit — A1', type: 'icu_ccu' as const, contactNumber: '01711-100003', eta: '14 min', safeRouteVerified: true, latitude: 23.7500, longitude: 90.3800, rating: 4.8, affiliation: 'Square Hospital Emergency' },
    { id: 'amb-4', name: 'Red Crescent Ambulance', providerName: 'Red Crescent Ambulance', type: 'standard' as const, contactNumber: '01711-100004', eta: '6 min', safeRouteVerified: true, latitude: 23.7370, longitude: 90.4120, rating: 4.4, affiliation: 'Bangladesh Red Crescent Society' },
    { id: 'amb-5', name: 'DGHS AC Ambulance', providerName: 'DGHS AC Ambulance', type: 'ac' as const, contactNumber: '01711-100005', eta: '9 min', safeRouteVerified: false, latitude: 23.8055, longitude: 90.3720, rating: 4.3, affiliation: 'Directorate General of Health Services' },
    { id: 'amb-6', name: 'Rapid CCU Response Unit', providerName: 'Rapid CCU Response Unit', type: 'icu_ccu' as const, contactNumber: '01711-100006', eta: '18 min', safeRouteVerified: true, latitude: 23.7900, longitude: 90.3900, rating: 4.7, affiliation: 'United Hospital Emergency' },
    { id: 'amb-7', name: 'City Ambulance Dhaka', providerName: 'City Ambulance Dhaka', type: 'standard' as const, contactNumber: '01711-100007', eta: '5 min', safeRouteVerified: true, latitude: 23.7650, longitude: 90.3780, rating: 4.5, affiliation: 'Dhaka North City Corporation' },
    { id: 'amb-8', name: 'AC Medic Response', providerName: 'AC Medic Response', type: 'ac' as const, contactNumber: '01711-100008', eta: '13 min', safeRouteVerified: false, latitude: 23.7420, longitude: 90.4230, rating: 4.4, affiliation: 'Prothom Alo Health Initiative' },
    { id: 'amb-9', name: 'National ICU Response', providerName: 'National ICU Response', type: 'icu_ccu' as const, contactNumber: '01711-100009', eta: '20 min', safeRouteVerified: true, latitude: 23.8200, longitude: 90.4300, rating: 4.6, affiliation: 'Evercare Hospital Emergency' },
    { id: 'amb-10', name: 'Swift Medic Ambulance', providerName: 'Swift Medic Ambulance', type: 'standard' as const, contactNumber: '01711-100010', eta: '8 min', safeRouteVerified: true, latitude: 23.7750, longitude: 90.4055, rating: 4.5, affiliation: 'Medinova Emergency Services' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK PHARMACIES — 8 pharmacies across Dhaka
// ═══════════════════════════════════════════════════════════════════════════════
export const MOCK_PHARMACIES = [
    { id: 'phar-1', name: 'Niko Drug House', address: 'Road 11, Block D, Gulshan 1', isDeliveryAvailable: true, contactNumber: '01711-200001', safeRouteVerified: true, latitude: 23.7870, longitude: 90.4142, rating: 4.5, affiliation: 'Niko Pharmacy Chain' },
    { id: 'phar-2', name: "People's Pharmacy", address: 'House 52, Road 4/A, Dhanmondi', isDeliveryAvailable: true, contactNumber: '01711-200002', safeRouteVerified: true, latitude: 23.7498, longitude: 90.3709, rating: 4.6, affiliation: "People's Healthcare Ltd." },
    { id: 'phar-3', name: 'Medical Centre Pharmacy', address: 'Farmgate Bus Stand, Tejgaon', isDeliveryAvailable: false, contactNumber: '01711-200003', safeRouteVerified: false, latitude: 23.7558, longitude: 90.3801, rating: 4.3, affiliation: 'Independent' },
    { id: 'phar-4', name: 'Square Pharmacy', address: '18/F Panthapath, Dhaka 1205', isDeliveryAvailable: true, contactNumber: '01711-200004', safeRouteVerified: true, latitude: 23.7512, longitude: 90.3748, rating: 4.7, affiliation: 'Square Hospitals Ltd.' },
    { id: 'phar-5', name: 'United Pharmacy', address: 'Plot 15, Road 71, Gulshan 2', isDeliveryAvailable: true, contactNumber: '01711-200005', safeRouteVerified: true, latitude: 23.7965, longitude: 90.4148, rating: 4.6, affiliation: 'United Hospital Ltd.' },
    { id: 'phar-6', name: 'Incepta Pharmacy', address: '40/A Kalapani Road, Mirpur-2', isDeliveryAvailable: false, contactNumber: '01711-200006', safeRouteVerified: false, latitude: 23.7980, longitude: 90.3612, rating: 4.4, affiliation: 'Incepta Pharmaceuticals' },
    { id: 'phar-7', name: 'Popular Pharmacy', address: 'Shyamoli Bus Stand, Dhaka 1207', isDeliveryAvailable: true, contactNumber: '01711-200007', safeRouteVerified: true, latitude: 23.7395, longitude: 90.3724, rating: 4.5, affiliation: 'Popular Medical Centre' },
    { id: 'phar-8', name: 'Labaid Pharmacy', address: 'House 1, Road 4, Dhanmondi', isDeliveryAvailable: true, contactNumber: '01711-200008', safeRouteVerified: true, latitude: 23.7504, longitude: 90.3718, rating: 4.7, affiliation: 'Labaid Group' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK OTHERS — Diagnostics, Blood Banks, Mental Health, Physiotherapy
// ═══════════════════════════════════════════════════════════════════════════════
export const MOCK_OTHERS = [
    { id: 'oth-1', name: 'Popular Diagnostic Centre', address: '2 Shantinagar, Dhaka 1217', category: 'Diagnostic Center', icon: 'flask-outline', bookingUrl: 'https://www.popularmedical.com.bd', safeRouteVerified: true, latitude: 23.7418, longitude: 90.4053, rating: 4.6, affiliation: 'Popular Group' },
    { id: 'oth-2', name: 'Lab Aid Diagnostics', address: 'House 1, Road 4, Dhanmondi', category: 'Diagnostic Center', icon: 'flask-outline', bookingUrl: 'https://www.labaidgroup.com', safeRouteVerified: true, latitude: 23.7495, longitude: 90.3715, rating: 4.7, affiliation: 'Labaid Group' },
    { id: 'oth-3', name: 'Ibn Sina Diagnostic Centre', address: 'Kalyan Nagar, Mirpur Road', category: 'Diagnostic Center', icon: 'flask-outline', bookingUrl: 'https://www.ibnsinatrust.com', safeRouteVerified: false, latitude: 23.7580, longitude: 90.4310, rating: 4.5, affiliation: 'Ibn Sina Trust' },
    { id: 'oth-4', name: 'Medinova Diagnostic Centre', address: 'Bashundhara R/A, Block C', category: 'Diagnostic Center', icon: 'flask-outline', bookingUrl: '', safeRouteVerified: true, latitude: 23.8151, longitude: 90.4295, rating: 4.5, affiliation: 'Medinova Medical Services' },
    { id: 'oth-5', name: 'Thyrocare Diagnostic', address: '34 Kemal Ataturk Ave, Banani', category: 'Diagnostic Center', icon: 'flask-outline', bookingUrl: '', safeRouteVerified: false, latitude: 23.7935, longitude: 90.4072, rating: 4.4, affiliation: 'Thyrocare Bangladesh' },
    { id: 'oth-6', name: 'Sandhani National Blood Bank', address: 'Dhaka Medical College Campus', category: 'Blood Bank', icon: 'water-outline', bookingUrl: '', safeRouteVerified: true, latitude: 23.7222, longitude: 90.3990, rating: 4.8, affiliation: 'Sandhani Bangladesh' },
    { id: 'oth-7', name: 'Quantum Blood Bank', address: 'Shyamoli, Dhaka 1207', category: 'Blood Bank', icon: 'water-outline', bookingUrl: '', safeRouteVerified: true, latitude: 23.7625, longitude: 90.3580, rating: 4.7, affiliation: 'Quantum Foundation' },
    { id: 'oth-8', name: 'Kaan Pete Roi', address: 'House 14A, Road 4, Gulshan 1', category: 'Mental Health', icon: 'accessibility-outline', bookingUrl: 'https://www.kaanpeteroi.org', safeRouteVerified: true, latitude: 23.7840, longitude: 90.4105, rating: 4.9, affiliation: 'Kaan Pete Roi Mental Health NGO' },
    { id: 'oth-9', name: 'Rozan Mental Health Centre', address: '66/1 Kalabagan, Dhanmondi', category: 'Mental Health', icon: 'accessibility-outline', bookingUrl: '', safeRouteVerified: false, latitude: 23.7462, longitude: 90.3741, rating: 4.6, affiliation: 'Rozan Foundation' },
    { id: 'oth-10', name: 'CRP Physiotherapy Centre', address: 'Savar, Dhaka 1340', category: 'Physiotherapy', icon: 'body-outline', bookingUrl: 'https://www.crp-bangladesh.org', safeRouteVerified: true, latitude: 23.8430, longitude: 90.2610, rating: 4.8, affiliation: 'Centre for Rehabilitation of the Paralysed' },
];
