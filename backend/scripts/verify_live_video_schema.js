const { pool } = require('../src/config/db');

const REQUIRED_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED',
  'STREAMING',
  'RECORDING',
  'STOPPED',
  'DECLINED',
  'EXPIRED',
  'FAILED',
  'COMPLETED',
];
const REQUIRED_MESSAGE_TYPES = ['TEXT', 'IMAGE', 'AUDIO', 'SYSTEM', 'VIDEO'];
const REQUIRED_MEDIA_COLUMNS = [
  'media_public_id',
  'media_mime_type',
  'media_filename',
  'media_size_bytes',
];

function includesEnumValues(columnType, values) {
  return values.every((value) => String(columnType || '').includes(`'${value}'`));
}

async function main() {
  const [requestTables] = await pool.execute("SHOW TABLES LIKE 'incident_video_requests'");
  const [requestStatusRows] = await pool.execute(
    "SHOW COLUMNS FROM incident_video_requests LIKE 'status'"
  );
  const [messageTypeRows] = await pool.execute("SHOW COLUMNS FROM chat_messages LIKE 'message_type'");
  const [mediaRows] = await pool.execute(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'chat_messages'
        AND COLUMN_NAME IN (?, ?, ?, ?)`,
    REQUIRED_MEDIA_COLUMNS
  );
  const [settingRows] = await pool.execute(
    "SHOW COLUMNS FROM safety_settings LIKE 'allow_emergency_auto_evidence_recording'"
  );
  const [chatCountRows] = await pool.execute('SELECT COUNT(*) AS count FROM chat_messages');
  const [requestCountRows] = await pool.execute('SELECT COUNT(*) AS count FROM incident_video_requests');
  const [requestStatusCountRows] = await pool.execute(
    'SELECT status, COUNT(*) AS count FROM incident_video_requests GROUP BY status ORDER BY status'
  );

  const mediaColumns = new Set(mediaRows.map((row) => row.COLUMN_NAME));
  const result = {
    incidentVideoRequestsExists: requestTables.length === 1,
    requestStatusesSupported: includesEnumValues(requestStatusRows[0]?.Type, REQUIRED_REQUEST_STATUSES),
    videoMessageTypeSupported: includesEnumValues(messageTypeRows[0]?.Type, REQUIRED_MESSAGE_TYPES),
    mediaMetadataColumnsExist: REQUIRED_MEDIA_COLUMNS.every((name) => mediaColumns.has(name)),
    autoEvidenceSettingExists: Boolean(settingRows[0]),
    autoEvidenceSettingDefaultOff: String(settingRows[0]?.Default) === '0',
    chatMessageCount: Number(chatCountRows[0]?.count || 0),
    videoRequestCount: Number(requestCountRows[0]?.count || 0),
    videoRequestStatusCounts: Object.fromEntries(
      requestStatusCountRows.map((row) => [row.status, Number(row.count)])
    ),
  };
  console.log(JSON.stringify(result, null, 2));

  const schemaReady = Object.entries(result)
    .filter(([key]) => !key.endsWith('Count') && key !== 'videoRequestStatusCounts')
    .every(([, value]) => value === true);
  if (!schemaReady) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`Live Safety Video schema verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
