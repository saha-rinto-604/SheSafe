USE resqher_db;

-- Safe to run repeatedly (INSERT IGNORE skips duplicates)

-- ── Specialists / Doctors ────────────────────────────────────────────────────
INSERT IGNORE INTO medical_providers (id, provider_type, name, latitude, longitude, rating, affiliation, booking_url, shift, specialty, degree, safe_route_verified) VALUES
('doc-001','specialists','Dr. Anika Sultana',23.8173,90.4280,4.9,'Evercare Hospital Dhaka','https://www.evercaredhaka.com/appointments','morning','Cardiologist','MBBS, FCPS (Cardiology)',1),
('doc-002','specialists','Dr. Rafiq Hasan',23.7926,90.4167,4.7,'United Hospital Ltd.','https://www.uhlbd.com/appointment','evening','Neurologist','MBBS, MD (Neurology)',1),
('doc-003','specialists','Dr. Tasneem Akhter',23.7465,90.3747,4.5,'Popular Diagnostic Centre','https://www.populardiagnostic.com/appointment','now','Orthopedic Surgeon','MBBS, MS (Orthopedics)',0),
('doc-004','specialists','Dr. Kabir Ahmed',23.8180,90.4275,4.8,'Evercare Hospital Dhaka','https://www.evercaredhaka.com/appointments','morning','Gynecologist','MBBS, FCPS (Gynecology)',1),
('doc-005','specialists','Dr. Nusrat Jahan',23.7935,90.4175,4.9,'United Hospital Ltd.','https://www.uhlbd.com/appointment','now','Pediatrician','MBBS, DCH (Pediatrics)',1),
('doc-006','specialists','Dr. Faisal Rahman',23.7450,90.3730,4.6,'Ibn Sina Trust','https://www.ibnsinatrust.com/appointment','evening','Dermatologist','MBBS, FCPS (Dermatology)',1),
('doc-007','specialists','Dr. Shirin Begum',23.7780,90.3770,4.6,'NIMH Dhaka','https://www.nimhbd.org/','morning','Psychiatrist','MBBS, MD (Psychiatry)',1),
('doc-008','specialists','Dr. Mahbub Alam',23.7260,90.3985,4.5,'DMCH','https://dmch.gov.bd/','now','General Surgeon','MBBS, MS (General Surgery)',1),
('doc-009','specialists','Dr. Roksana Islam',23.7612,90.4002,4.4,'Eye Care BD',NULL,'morning','Eye Specialist','MBBS, FCPS (Ophthalmology)',0),
('doc-010','specialists','Dr. Tariq Morshed',23.7388,90.3940,4.8,'BIRDEM Hospital','https://www.birdem-general-hospital.com/','evening','Endocrinologist','MBBS, MD (Endocrinology)',1),
('doc-011','specialists','Dr. Parvin Sultana',23.7512,90.3815,4.7,'Square Hospital Ltd.','https://www.squarehospital.com/','morning','Rheumatologist','MBBS, FCPS (Rheumatology)',1),
('doc-012','specialists','Dr. Aminul Islam',23.8040,90.3660,4.3,'Mirpur ENT Centre',NULL,'now','ENT Specialist','MBBS, DLO (ENT)',0),
('doc-013','specialists','Dr. Laila Anjum',23.7895,90.3780,4.9,'Ahsania Mission','https://ahsaniamissioncancerhospital.com/','morning','Oncologist','MBBS, MD (Oncology)',1),
('doc-014','specialists','Dr. Zubayer Chowdhury',23.7480,90.3755,4.5,'Labaid Group','https://labaid.com.bd/','evening','Urologist','MBBS, FCPS (Urology)',1);

-- ── Hospitals ────────────────────────────────────────────────────────────────
INSERT IGNORE INTO medical_providers (id, provider_type, name, latitude, longitude, address, rating, affiliation, booking_url, safe_route_verified) VALUES
('hosp-001','hospital','Evercare Hospital',23.8173,90.4280,'Plot 81, Block E, Bashundhara R/A, Dhaka',4.8,'Evercare Group','https://www.evercaredhaka.com/appointments',1),
('hosp-002','hospital','United Hospital',23.7926,90.4167,'Plot 15, Road 71, Gulshan, Dhaka',4.7,'United Group','https://www.uhlbd.com/appointment',1),
('hosp-003','hospital','Popular Diagnostic Centre',23.7465,90.3747,'House 16, Road 2, Dhanmondi, Dhaka',4.5,'Popular Group','https://www.populardiagnostic.com/appointment',0),
('hosp-004','hospital','Ibn Sina Hospital',23.7450,90.3730,'House 48, Road 9/A, Dhanmondi, Dhaka',4.6,'Ibn Sina Trust','https://www.ibnsinatrust.com/appointment',1),
('hosp-005','hospital','Dhaka Medical College Hospital',23.7260,90.3985,'Bakshibazar, Dhaka 1000',4.4,'Government','https://dmch.gov.bd/',1),
('hosp-006','hospital','Square Hospital',23.7512,90.3815,'West Panthapath, Dhaka',4.7,'Square Group','https://www.squarehospital.com/',1),
('hosp-007','hospital','Labaid Specialized Hospital',23.7480,90.3755,'House 1, Road 4, Dhanmondi, Dhaka',4.5,'Labaid Group','https://labaid.com.bd/',1),
('hosp-008','hospital','BIRDEM General Hospital',23.7388,90.3940,'Shahbag, Dhaka',4.6,'BIRDEM','https://www.birdem-general-hospital.com/',1),
('hosp-009','hospital','Mugda Medical College Hospital',23.7334,90.4310,'Mugda, Dhaka',4.1,'Government',NULL,0),
('hosp-010','hospital','Shaheed Suhrawardy Medical College',23.7770,90.3755,'Sher-E-Bangla Nagar, Dhaka',4.3,'Government',NULL,1);

-- ── Ambulances ───────────────────────────────────────────────────────────────
INSERT IGNORE INTO medical_providers (id, provider_type, name, latitude, longitude, contact_number, rating, affiliation, ambulance_type, eta, safe_route_verified) VALUES
('amb-001','ambulance','Evercare Ambulance',23.8165,90.4270,'+880-1711-000001',4.9,'Evercare Hospital','icu_ccu','8 min',1),
('amb-002','ambulance','United Rapid Response',23.7940,90.4160,'+880-1711-000002',4.7,'United Hospital','ac','12 min',1),
('amb-003','ambulance','Red Crescent Ambulance',23.8100,90.4220,'+880-1711-000003',4.3,'Bangladesh Red Crescent','standard','15 min',0),
('amb-004','ambulance','Bashundhara Medical Ambulance',23.8120,90.4240,'+880-1711-000004',4.4,'Bashundhara Group','standard','10 min',1),
('amb-005','ambulance','Praava Health ICU',23.7950,90.4030,'+880-1711-000005',4.8,'Praava Health','icu_ccu','18 min',1),
('amb-006','ambulance','DMCH Emergency Ambulance',23.7265,90.3990,'+880-1711-000006',4.2,'Dhaka Medical College','standard','20 min',1),
('amb-007','ambulance','Square Hospital Ambulance',23.7508,90.3820,'+880-1711-000007',4.6,'Square Hospital','ac','14 min',1),
('amb-008','ambulance','Ibn Sina ICU Ambulance',23.7455,90.3738,'+880-1711-000008',4.7,'Ibn Sina Trust','icu_ccu','11 min',1),
('amb-009','ambulance','Mirpur Fire & Rescue EMS',23.8060,90.3690,'+880-1711-000009',4.0,'Fire Service BD','standard','22 min',0),
('amb-010','ambulance','Gulshan Emergency Care',23.7840,90.4120,'+880-1711-000010',4.5,'Gulshan Clinic','ac','9 min',1);

-- ── Pharmacies ───────────────────────────────────────────────────────────────
INSERT IGNORE INTO medical_providers (id, provider_type, name, latitude, longitude, address, contact_number, rating, affiliation, is_delivery_available, safe_route_verified) VALUES
('pharm-001','pharmacy','Lazz Pharma',23.8140,90.4260,'Bashundhara R/A, Dhaka','+880-1711-100001',4.5,'Lazz Group',1,1),
('pharm-002','pharmacy','ACME Pharmacy',23.7920,90.4150,'Gulshan 2, Dhaka','+880-1711-100002',4.4,'ACME Laboratories',1,1),
('pharm-003','pharmacy','Model Pharmacy',23.8090,90.4190,'Vatara, Dhaka','+880-1711-100003',4.2,'Independent',0,0),
('pharm-004','pharmacy','Nipa Drug House',23.7465,90.3760,'Dhanmondi 27, Dhaka','+880-1711-100004',4.3,'Independent',1,1),
('pharm-005','pharmacy','Gonoshasthaya Pharmacy',23.7512,90.3820,'Panthapath, Dhaka','+880-1711-100005',4.6,'Gonoshasthaya Kendra',0,1),
('pharm-006','pharmacy','Popular Pharmacy',23.7260,90.3985,'Bakshibazar, Dhaka','+880-1711-100006',4.1,'Popular Group',0,0),
('pharm-007','pharmacy','Square Pharmacy',23.7935,90.4175,'Gulshan 1, Dhaka','+880-1711-100007',4.7,'Square Group',1,1);

-- ── Diagnostics ──────────────────────────────────────────────────────────────
INSERT IGNORE INTO medical_providers (id, provider_type, name, latitude, longitude, address, rating, affiliation, booking_url, safe_route_verified) VALUES
('diag-001','diagnostics','Popular Diagnostic Centre Lab',23.8130,90.4255,'Bashundhara R/A Branch, Dhaka',4.6,'Popular Group','https://www.populardiagnostic.com/',1),
('diag-002','diagnostics','Ibn Sina Diagnostic',23.7900,90.4140,'Gulshan Branch, Dhaka',4.5,'Ibn Sina Trust','https://www.ibnsinatrust.com/',1),
('diag-003','diagnostics','Praava Health Lab',23.7945,90.4035,'Banani, Dhaka',4.7,'Praava Health','https://praavahealth.com/',0);
