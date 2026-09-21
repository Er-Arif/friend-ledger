const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const lanUrl = 'exp://192.168.1.48:8081';

QRCode.toString(lanUrl, { type: 'svg', margin: 2 }, (err, svg) => {
  if (err) {
    console.error('Error generating QR:', err);
    process.exit(1);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Friend Ledger - Expo Go QR Code</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #F7F8F6;
      color: #171A18;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border: 1px solid #E7EAE5;
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .brand {
      display: inline-block;
      background: #16A36A;
      color: #FFFFFF;
      padding: 6px 14px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.5px;
      margin-bottom: 14px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 6px 0;
    }
    .subtitle {
      color: #5C6B61;
      font-size: 14px;
      margin: 0 0 20px 0;
    }
    .qr-container {
      background: #FFFFFF;
      border: 1px solid #E7EAE5;
      border-radius: 16px;
      padding: 20px;
      margin: 0 auto 20px auto;
      max-width: 280px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }
    .qr-container svg {
      width: 100%;
      height: auto;
      display: block;
    }
    .url-box {
      background: #E8F7F0;
      border: 1px solid #BDE6D3;
      border-radius: 10px;
      padding: 10px 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      color: #16875D;
      font-weight: 600;
      word-break: break-all;
      margin-bottom: 24px;
    }
    .instructions {
      text-align: left;
      background: #F2F4F1;
      border-radius: 14px;
      padding: 18px 20px;
      font-size: 13px;
      line-height: 1.6;
    }
    .instructions strong {
      display: block;
      color: #171A18;
      margin-bottom: 4px;
    }
    .instructions ol {
      margin: 0 0 14px 0;
      padding-left: 18px;
      color: #5C6B61;
    }
    .instructions ol:last-child {
      margin-bottom: 0;
    }
    .instructions li {
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">FRIEND LEDGER</div>
    <h1>Scan to Run on Phone</h1>
    <p class="subtitle">Use your camera or Expo Go to load the mobile app</p>

    <div class="qr-container">
      ${svg}
    </div>

    <div class="url-box">
      ${lanUrl}
    </div>

    <div class="instructions">
      <strong>iPhone / iPad (iOS):</strong>
      <ol>
        <li>Make sure your phone is on Wi-Fi (same network).</li>
        <li>Open the default <b>Camera</b> app.</li>
        <li>Point at the QR code and tap <b>Open in Expo Go</b>.</li>
      </ol>

      <strong>Android:</strong>
      <ol>
        <li>Open the <b>Expo Go</b> app.</li>
        <li>Tap <b>Scan QR code</b> and point at this screen.</li>
      </ol>
    </div>
  </div>
</body>
</html>`;

  const outputPath = path.resolve(__dirname, '..', 'expo-qr.html');
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log('Saved QR page to:', outputPath);
});
