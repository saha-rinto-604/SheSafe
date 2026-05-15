USE resqher_db;

-- Demo incidents — idempotent (skip each row if address already exists in incidents)

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.8023, 90.3654, 'Mirpur-10 Roundabout, Dhaka', 'ACTIVE',
       DATE_SUB(NOW(), INTERVAL 5 MINUTE)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Mirpur-10 Roundabout, Dhaka' LIMIT 1
);

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.7808, 90.4147, 'Gulshan-1 Circle, Dhaka', 'ACTIVE',
       DATE_SUB(NOW(), INTERVAL 22 MINUTE)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Gulshan-1 Circle, Dhaka' LIMIT 1
);

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.7937, 90.4048, 'Banani C Block Road, Dhaka', 'ACTIVE',
       DATE_SUB(NOW(), INTERVAL 90 MINUTE)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Banani C Block Road, Dhaka' LIMIT 1
);

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.7502, 90.3737, 'Dhanmondi Road 27, Dhaka', 'RESOLVED',
       DATE_SUB(NOW(), INTERVAL 3 HOUR)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Dhanmondi Road 27, Dhaka' LIMIT 1
);

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.7791, 90.4045, 'Mohakhali Bus Station, Dhaka', 'RESOLVED',
       DATE_SUB(NOW(), INTERVAL 6 HOUR)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Mohakhali Bus Station, Dhaka' LIMIT 1
);

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.7574, 90.3886, 'Farmgate Overbridge, Dhaka', 'RESOLVED',
       DATE_SUB(NOW(), INTERVAL 12 HOUR)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Farmgate Overbridge, Dhaka' LIMIT 1
);

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.7262, 90.4199, 'Motijheel Shapla Chattar, Dhaka', 'CANCELLED',
       DATE_SUB(NOW(), INTERVAL 18 HOUR)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Motijheel Shapla Chattar, Dhaka' LIMIT 1
);

INSERT INTO incidents (user_id, latitude, longitude, address, status, created_at)
SELECT (SELECT id FROM users ORDER BY id LIMIT 1),
       23.7100, 90.4019, 'Sadarghat Launch Terminal, Old Dhaka', 'CANCELLED',
       DATE_SUB(NOW(), INTERVAL 24 HOUR)
WHERE NOT EXISTS (
  SELECT 1 FROM incidents WHERE address = 'Sadarghat Launch Terminal, Old Dhaka' LIMIT 1
);
