/**
 * WhatsApp Client Service (whatsapp-web.js)
 * Aapke khud ke WhatsApp account se OTP bhejta hai
 * Setup: Server start hone par QR code scan karo - sirf EK baar!
 */

const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const qrcodeLib = require("qrcode");

let client = null;
let isReady = false;
let isInitializing = false;
let latestQrCode = null;
let latestQrTimestamp = null;

// Detect available browser on Windows
const fs = require('fs');
function getExecutablePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return undefined;
}

function initWhatsAppClient() {
  if (isInitializing || isReady) return;
  isInitializing = true;

  console.log("\n📲 ========================================");
  console.log("   WhatsApp Client Initializing...");
  console.log("   (Pehli baar QR code scan karna hoga)");
  console.log("========================================\n");

  const execPath = getExecutablePath();
  console.log("🌐 Browser found at:", execPath);

  client = new Client({
    authStrategy: new LocalAuth({ clientId: "mks-billing" }),
    webVersion: '2.3000.1023054691-alpha',
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1023054691-alpha.html'
    },
    puppeteer: {
      headless: true,
      ...(execPath ? { executablePath: execPath } : {}),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--metrics-recording-only",
        "--mute-audio",
        "--no-default-browser-check"
      ]
    }
  });

  client.on("qr", (qr) => {
    latestQrCode = qr;
    latestQrTimestamp = Date.now();
    console.log("\n\n📲 =============================================");
    console.log("   WhatsApp QR Code generated!");
    console.log("   Scan via terminal OR visit /whatsapp-qr in browser");
    console.log("=============================================\n");
    qrcode.generate(qr, { small: true });
    console.log("\n⏳ QR code scan karne ka wait kar raha hoon...\n");
  });

  client.on("authenticated", () => {
    latestQrCode = null;
    console.log("✅ [WHATSAPP] Authentication successful! Session save ho gayi.");
  });

  client.on("ready", () => {
    isReady = true;
    isInitializing = false;
    console.log("\n✅ =============================================");
    console.log("   WhatsApp Client READY!");
    console.log("   Ab login par WhatsApp OTP milega!");
    console.log("=============================================\n");
  });

  client.on("disconnected", (reason) => {
    console.warn("⚠️ [WHATSAPP] Disconnected:", reason);
    isReady = false;
    isInitializing = false;
    client = null;
    setTimeout(() => initWhatsAppClient(), 5000);
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ [WHATSAPP] Auth failed:", msg);
    isReady = false;
    isInitializing = false;
  });

  client.initialize().catch((err) => {
    console.error("❌ [WHATSAPP] Init error:", err.message);
    isReady = false;
    isInitializing = false;
  });
}

async function sendWhatsAppMessage(mobile, message) {
  if (!isReady || !client) {
    return { success: false, error: "WhatsApp client not ready. QR code scan karo." };
  }
  try {
    const cleanMobile = String(mobile).replace(/[^0-9]/g, "").slice(-10);
    const chatId = `91${cleanMobile}@c.us`;
    await client.sendMessage(chatId, message);
    return { success: true };
  } catch (err) {
    console.error("❌ [WHATSAPP SEND ERROR]:", err.message);
    return { success: false, error: err.message };
  }
}

async function sendWhatsAppMedia(mobile, mediaData, filename = 'poster.jpg', caption = '', mimeType = 'image/jpeg') {
  if (!isReady || !client) {
    return { success: false, error: "WhatsApp client not ready. QR code scan karo." };
  }
  try {
    const { MessageMedia } = require("whatsapp-web.js");
    const cleanMobile = String(mobile).replace(/[^0-9]/g, "").slice(-10);
    const chatId = `91${cleanMobile}@c.us`;

    let base64Data = '';
    if (Buffer.isBuffer(mediaData)) {
      base64Data = mediaData.toString('base64');
    } else if (typeof mediaData === 'string') {
      // Remove data:image/...;base64, prefix if present
      if (mediaData.includes('base64,')) {
        const parts = mediaData.split('base64,');
        base64Data = parts[1];
        if (parts[0].includes('image/png')) mimeType = 'image/png';
        else if (parts[0].includes('image/jpeg') || parts[0].includes('image/jpg')) mimeType = 'image/jpeg';
        else if (parts[0].includes('application/pdf')) mimeType = 'application/pdf';
      } else {
        base64Data = mediaData;
      }
    }

    const media = new MessageMedia(mimeType, base64Data, filename);
    await client.sendMessage(chatId, media, { caption });
    return { success: true };
  } catch (err) {
    console.error("❌ [WHATSAPP MEDIA SEND ERROR]:", err.message);
    return { success: false, error: err.message };
  }
}

function isWhatsAppReady() {
  return isReady;
}

// =====================================================================
// 🌐 WHATSAPP QR WEB PAGE HANDLER
// Browser mein QR code image ke saath page dikhata hai
// GET /whatsapp-qr  (server.js mein registered)
// =====================================================================
async function whatsappQrPageHandler(req, res) {
  if (isReady) {
    return res.send(`<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp - MKS Billing</title>
    <style>body{font-family:Arial,sans-serif;background:#e7ffe7;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:white;border-radius:20px;padding:40px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.1);max-width:400px}.icon{font-size:64px}h1{color:#25d366;font-size:22px;margin:12px 0}p{color:#555;font-size:15px}</style>
    <script>
      if (window.opener) {
        try { window.opener.postMessage({ type: 'WHATSAPP_CONNECTED' }, '*'); } catch(e){}
      }
      setTimeout(() => { try { window.close(); } catch(e){} }, 2500);
    </script>
    </head><body><div class="card"><div class="icon">✅</div><h1>WhatsApp Connected!</h1><p>WhatsApp सफलतापूर्वक कनेक्ट हो गया है!<br>यह विंडो 2 सेकंड में बंद हो जाएगी...</p></div></body></html>`);
  }

  if (!latestQrCode) {
    return res.send(`<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp QR - MKS Billing</title>
    <style>body{font-family:Arial,sans-serif;background:#fff8e1;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{background:white;border-radius:20px;padding:40px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.1);max-width:400px}.loader{border:6px solid #f3f3f3;border-top:6px solid #25d366;border-radius:50%;width:48px;height:48px;animation:spin 1s linear infinite;margin:20px auto}@keyframes spin{to{transform:rotate(360deg)}}</style>
    <script>
      setInterval(() => {
        fetch('/whatsapp-status').then(r=>r.json()).then(d=>{
          if(d.connected) {
            if(window.opener) { try { window.opener.postMessage({ type: 'WHATSAPP_CONNECTED' }, '*'); } catch(e){} }
            location.reload();
          } else {
            location.reload();
          }
        }).catch(()=>{});
      }, 3000);
    </script>
    </head><body><div class="card"><div style="font-size:64px">⏳</div><h1 style="color:#f59e0b">QR Load Ho Raha Hai...</h1><div class="loader"></div><p>Server QR generate kar raha hai.<br>Yeh page auto-refresh ho raha hai...</p></div></body></html>`);
  }

  try {
    const qrDataUrl = await qrcodeLib.toDataURL(latestQrCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    const ageSeconds = latestQrTimestamp ? Math.floor((Date.now() - latestQrTimestamp) / 1000) : 0;

    res.send(`<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp QR - MKS Billing</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#e8f5e9,#f3e5f5);display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
    .card{background:white;border-radius:24px;padding:32px 28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.15);max-width:460px;width:100%}
    h1{color:#075e54;font-size:20px;margin:8px 0 4px}
    .sub{color:#888;font-size:13px;margin-bottom:20px}
    .qr-box{background:white;border:3px solid #25d366;border-radius:16px;padding:16px;display:inline-block;margin:0 auto 20px}
    .qr-box img{width:300px;height:300px;display:block}
    .steps{background:#f0fdf4;border-radius:12px;padding:16px;text-align:left;margin-bottom:18px}
    .steps h3{color:#166534;font-size:13px;margin:0 0 10px;text-transform:uppercase;letter-spacing:.5px}
    .step{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-size:13.5px;color:#374151}
    .num{background:#25d366;color:white;border-radius:50%;width:22px;height:22px;min-width:22px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;margin-top:1px}
    .age{font-size:12px;color:#999;margin-bottom:12px}
    .btn{background:#25d366;color:white;border:none;border-radius:10px;padding:10px 28px;font-size:14px;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-block}
    .warn{background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:10px 14px;text-align:left;font-size:12.5px;color:#92400e;margin-top:16px}
  </style>
  <script>
    // Real-time live status checker
    const checkInterval = setInterval(() => {
      fetch('/whatsapp-status')
        .then(r => r.json())
        .then(data => {
          if (data && data.connected) {
            clearInterval(checkInterval);
            if (window.opener) {
              try { window.opener.postMessage({ type: 'WHATSAPP_CONNECTED' }, '*'); } catch(e){}
            }
            document.body.innerHTML = '<div style="background:white;border-radius:24px;padding:40px;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.1);max-width:400px;margin:auto;"><div style="font-size:64px;">✅</div><h1 style="color:#25d366;font-size:22px;margin:12px 0;">WhatsApp Connected!</h1><p style="color:#555;font-size:15px;">WhatsApp सफलतापूर्वक कनेक्ट हो गया है!<br>यह विंडो अपने-आप बंद हो रही है...</p></div>';
            setTimeout(() => { try { window.close(); } catch(e){} }, 2000);
          }
        })
        .catch(() => {});
    }, 1500);

    // Auto reload if QR is stale after 45 seconds
    setTimeout(() => location.reload(), 45000);
  </script>
</head>
<body>
  <div class="card">
    <div style="font-size:36px">📲</div>
    <h1>MKS Billing — WhatsApp Connect</h1>
    <div class="sub">नीचे दिए गए QR कोड को अपने फोन से स्कैन करें</div>
    <div class="qr-box"><img src="${qrDataUrl}" alt="WhatsApp QR Code"></div>
    <div class="steps">
      <h3>📱 Scan Karne Ka Tarika:</h3>
      <div class="step"><div class="num">1</div><span>Apne phone mein <strong>WhatsApp</strong> kholo</span></div>
      <div class="step"><div class="num">2</div><span><strong>Settings → Linked Devices → Link a Device</strong> par tap karo</span></div>
      <div class="step"><div class="num">3</div><span>Camera se <strong>upar diya QR code scan karo</strong></span></div>
      <div class="step"><div class="num">4</div><span>Scan hote hi yeh window auto-close ho jayegi ✅</span></div>
    </div>
    <div class="age">⏱ QR कोड एक्टिव है (लाइव ऑटो-डिटेक्ट चालू है)</div>
    <a href="/whatsapp-qr" class="btn">🔄 नया QR लोड करें</a>
    <div class="warn">⚡ जैसे ही आप फोन से स्कैन करेंगे, सॉफ्टवेयर अपने-आप कनेक्ट हो जाएगा!</div>
  </div>
</body>
</html>`);
  } catch (err) {
    res.status(500).send('QR generate karne mein error: ' + err.message);
  }
}

if (process.env.WHATSAPP_ENABLED === "true") {
  setTimeout(() => initWhatsAppClient(), 3000);
}

module.exports = { initWhatsAppClient, sendWhatsAppMessage, sendWhatsAppMedia, isWhatsAppReady, whatsappQrPageHandler };
