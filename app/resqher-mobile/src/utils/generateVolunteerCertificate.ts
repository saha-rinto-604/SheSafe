import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export type VolunteerCertificateData = {
  name: string;
  assistedIncidents: number;
  totalPoints: number;
};

export const CERTIFICATE_PAGE = {
  width: 842,
  height: 595,
} as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function numberOrZero(value: number) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function getVolunteerCertificateHtml(data: VolunteerCertificateData) {
  const name = escapeHtml(String(data.name || 'Volunteer').trim() || 'Volunteer');
  const assistedIncidents = numberOrZero(Number(data.assistedIncidents));
  const totalPoints = numberOrZero(Number(data.totalPoints));

  const achievementTitle =
    totalPoints >= 1500
      ? 'Outstanding Volunteer Contributor'
      : totalPoints >= 800
        ? 'Active Community Supporter'
        : 'ResQher Volunteer Contributor';

  const generatedDate = new Date().toLocaleDateString();

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=${CERTIFICATE_PAGE.width}, initial-scale=1.0" />
    <style>
      @page {
        size: ${CERTIFICATE_PAGE.width}px ${CERTIFICATE_PAGE.height}px;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: ${CERTIFICATE_PAGE.width}px;
        height: ${CERTIFICATE_PAGE.height}px;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #ffffff;
        color: #2f3442;
        font-family: Georgia, 'Times New Roman', serif;
      }

      .page {
        width: ${CERTIFICATE_PAGE.width}px;
        height: ${CERTIFICATE_PAGE.height}px;
        padding: 22px;
        background: #ffffff;
      }

      .certificate {
        width: 798px;
        height: 551px;
        padding: 13px;
        border: 7px solid #d4af37;
        background:
          linear-gradient(135deg, rgba(212, 175, 55, 0.11), rgba(255, 255, 255, 0) 32%),
          linear-gradient(315deg, rgba(212, 175, 55, 0.12), rgba(255, 255, 255, 0) 34%),
          #ffffff;
      }

      .inner-border {
        width: 758px;
        height: 511px;
        padding: 18px 42px;
        border: 2px solid #ead28a;
        text-align: center;
      }

      .brand {
        color: #b48a2c;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 4px;
        text-transform: uppercase;
      }

      .title {
        margin: 10px 0 0;
        color: #2f3442;
        font-size: 42px;
        line-height: 46px;
        font-weight: 700;
        letter-spacing: 4px;
      }

      .subtitle {
        margin: 0 0 18px;
        color: #b48a2c;
        font-size: 21px;
        line-height: 25px;
        letter-spacing: 4px;
        font-weight: 500;
      }

      .given {
        margin: 0;
        color: #555;
        font-family: Arial, sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 3px;
      }

      .name {
        display: inline-block;
        min-width: 340px;
        max-width: 610px;
        margin: 16px auto 11px;
        padding: 0 40px 8px;
        border-bottom: 2px solid #d4af37;
        color: #111827;
        font-size: 32px;
        line-height: 38px;
        white-space: nowrap;
      }

      .achievement {
        margin: 8px 0 12px;
        color: #b48a2c;
        font-family: Arial, sans-serif;
        font-size: 15px;
        font-weight: 800;
      }

      .message {
        width: 82%;
        margin: 0 auto;
        color: #333;
        font-size: 14px;
        line-height: 1.55;
      }

      .stats {
        display: flex;
        justify-content: center;
        gap: 18px;
        margin-top: 18px;
      }

      .stat-box {
        min-width: 122px;
        padding: 9px 18px;
        border: 1px solid #d4af37;
        background: rgba(255, 250, 235, 0.72);
      }

      .stat-value {
        color: #111827;
        font-family: Arial, sans-serif;
        font-size: 20px;
        line-height: 23px;
        font-weight: 800;
      }

      .stat-label {
        margin-top: 2px;
        color: #666;
        font-family: Arial, sans-serif;
        font-size: 10px;
        line-height: 13px;
        letter-spacing: 0.3px;
      }

      .badge {
        width: 72px;
        height: 72px;
        margin: 20px auto 0;
        border-radius: 50%;
        background: #d4af37;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Arial, sans-serif;
        font-weight: 900;
        font-size: 10px;
        letter-spacing: 1.2px;
        box-shadow: 0 8px 18px rgba(180, 138, 44, 0.24);
      }

      .footer {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        margin-top: 18px;
        padding: 0 38px;
        font-family: Arial, sans-serif;
      }

      .date {
        color: #555;
        font-size: 11px;
      }

      .signature {
        color: #333;
        font-size: 11px;
        text-align: center;
      }

      .signature-line {
        width: 138px;
        margin-bottom: 6px;
        border-top: 1px solid #b48a2c;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="certificate">
        <div class="inner-border">
          <div class="brand">ResQher</div>
          <h1 class="title">CERTIFICATE</h1>
          <h2 class="subtitle">OF APPRECIATION</h2>

          <p class="given">THE FOLLOWING AWARD IS GIVEN TO</p>

          <div class="name">${name}</div>
          <div class="achievement">${achievementTitle}</div>

          <p class="message">
            This certificate is proudly awarded to <b>${name}</b> for successfully assisting in
            <b>${assistedIncidents}</b> verified volunteer works through the <b>ResQher app</b>
            and earning <b>${totalPoints}</b> points. Their dedication, responsibility, and
            contribution reflect ResQher's mission of safer and faster community support.
          </p>

          <div class="stats">
            <div class="stat-box">
              <div class="stat-value">${assistedIncidents}</div>
              <div class="stat-label">Assisted Incidents</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${totalPoints}</div>
              <div class="stat-label">Total Points</div>
            </div>
          </div>

          <div class="badge">RESQHER</div>

          <div class="footer">
            <div class="date">Generated on: ${generatedDate}</div>
            <div class="signature">
              <div class="signature-line"></div>
              Admin
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export async function printVolunteerCertificatePdf(data: VolunteerCertificateData) {
  return Print.printToFileAsync({
    html: getVolunteerCertificateHtml(data),
    width: CERTIFICATE_PAGE.width,
    height: CERTIFICATE_PAGE.height,
    margins: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  });
}

export async function shareVolunteerCertificatePdf(data: VolunteerCertificateData) {
  const result = await printVolunteerCertificatePdf(data);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download or share your ResQher certificate',
      UTI: 'com.adobe.pdf',
    });
  }

  return result;
}

export async function generateVolunteerCertificatePdf(data: VolunteerCertificateData) {
  return shareVolunteerCertificatePdf(data);
}
