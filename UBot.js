// UBot.js - Telegram UserBot (UBot) version
// Menggunakan akun Telegram user (bukan bot token)

console.clear();

require('./setting');
require('./ApiKeys-BotTele.js');

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const chalk = require('chalk');
const QRCode = require('qrcode');
const readline = require('readline');

// ========================
// KONFIGURASI API ID & API HASH (dari my.telegram.org)
// ========================
const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
const API_HASH = process.env.TELEGRAM_API_HASH || '';

if (!API_ID || !API_HASH) {
    console.error(chalk.red('❌ TELEGRAM_API_ID dan TELEGRAM_API_HASH harus diisi di file .env'));
    process.exit(1);
}

// Session file untuk menyimpan login
const SESSION_FILE = './ubot_session.json';

// ========================
// CONFIG / GLOBAL
// ========================
global.domain = process.env.PTERO_DOMAIN || global.domain;
global.apikey = process.env.PTERO_APIKEY || global.apikey;
global.egg = Number(process.env.PTERO_EGG) || 15;
global.nestid = Number(process.env.PTERO_NESTID) || 5;
global.loc = Number(process.env.PTERO_LOC) || 1;

// Owner IDs (Telegram user IDs)
const OWNER_IDS = (process.env.OWNER_IDS || '').split(',').filter(Boolean).map(s => s.trim());

// DB file
const DB_PATH = path.join(__dirname, 'database_ubot.json');
let db = {
    users: {},
    orders: {},
    topups: {},
    sessions: {},
    meta: {},
    cfd: {
        blacklist: [],
        settings: {
            enabled: true,
            delayMs: 200
        }
    },
    chatHistory: {}
};

// ========================
// LOAD / SAVE DB
// ========================
function loadDb() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            db = { ...db, ...parsed };
            // Ensure cfd exists
            if (!db.cfd) {
                db.cfd = { blacklist: [], settings: { enabled: true, delayMs: 200 } };
            }
            if (!db.cfd.blacklist) db.cfd.blacklist = [];
            if (!db.cfd.settings) db.cfd.settings = { enabled: true, delayMs: 200 };
            if (!db.chatHistory) db.chatHistory = {};
            console.log(chalk.green('✅ Database loaded.'));
        } else {
            console.log(chalk.yellow('📁 Database not found, creating new.'));
            fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        }
    } catch (e) {
        console.error(chalk.red('Failed to load DB:'), e.message || e);
    }
}

function saveDb() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error(chalk.red('Failed to save DB:'), e.message || e);
    }
}

loadDb();

// ========================
// UTIL FUNCTIONS
// ========================
function toRupiah(n = 0) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function genOrderId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isOwner(id) {
    if (!id) return false;
    return OWNER_IDS.includes(String(id));
}

function getSession(chatId) {
    return db.sessions[chatId];
}

function setSession(chatId, sessionData) {
    db.sessions[chatId] = {
        ...sessionData,
        lastUpdated: Date.now()
    };
    saveDb();
}

function clearSession(chatId) {
    delete db.sessions[chatId];
    saveDb();
}

// Clean expired sessions
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    Object.keys(db.sessions).forEach(chatId => {
        if (now - (db.sessions[chatId].lastUpdated || 0) > 30 * 60 * 1000) {
            delete db.sessions[chatId];
            cleaned++;
        }
    });
    if (cleaned > 0) {
        saveDb();
        console.log(`Cleaned ${cleaned} expired sessions`);
    }
}, 10 * 60 * 1000);

// ========================
// TELEGRAM CLIENT
// ========================
let client = null;
let me = null;

// Fungsi untuk mengirim pesan
async function sendMessage(chatId, text, buttons = null) {
    try {
        if (buttons && buttons.inline_keyboard) {
            await client.sendMessage(chatId, { 
                message: text, 
                buttons: buttons.inline_keyboard,
                parseMode: 'markdown'
            });
        } else {
            await client.sendMessage(chatId, { 
                message: text, 
                parseMode: 'markdown'
            });
        }
    } catch (err) {
        console.error('Send message error:', err);
    }
}

async function sendPhoto(chatId, photoBuffer, caption, buttons = null) {
    try {
        await client.sendFile(chatId, { file: photoBuffer, caption, parseMode: 'markdown' });
        if (buttons && buttons.inline_keyboard) {
            await client.sendMessage(chatId, { 
                message: 'Pilih aksi:', 
                buttons: buttons.inline_keyboard,
                parseMode: 'markdown'
            });
        }
    } catch (err) {
        console.error('Send photo error:', err);
        await sendMessage(chatId, caption);
    }
}

function inlineKeyboard(buttons) {
    return { inline_keyboard: buttons };
}

// ========================
// FUNGSI BLACKLIST
// ========================

async function addToBlacklist(chatId, fromId, targetChatId, replyToMsgId = null) {
    if (!isOwner(fromId)) {
        await sendMessage(chatId, '❌ Hanya owner!');
        return false;
    }
    
    if (!db.cfd.blacklist.includes(targetChatId)) {
        db.cfd.blacklist.push(targetChatId);
        saveDb();
        
        let chatName = targetChatId;
        try {
            const entity = await client.getEntity(Number(targetChatId));
            chatName = entity.title || entity.firstName || targetChatId;
        } catch (e) {}
        
        await sendMessage(chatId, `✅ *Ditambahkan ke Blacklist*\n\n${chatName}\nID: ${targetChatId}`);
        return true;
    } else {
        await sendMessage(chatId, `⚠️ *Sudah ada di blacklist*\n\n${targetChatId}`);
        return false;
    }
}

async function removeFromBlacklist(chatId, fromId, targetChatId, replyToMsgId = null) {
    if (!isOwner(fromId)) {
        await sendMessage(chatId, '❌ Hanya owner!');
        return false;
    }
    
    const index = db.cfd.blacklist.indexOf(targetChatId);
    if (index !== -1) {
        db.cfd.blacklist.splice(index, 1);
        saveDb();
        
        let chatName = targetChatId;
        try {
            const entity = await client.getEntity(Number(targetChatId));
            chatName = entity.title || entity.firstName || targetChatId;
        } catch (e) {}
        
        await sendMessage(chatId, `✅ *Dihapus dari Blacklist*\n\n${chatName}\nID: ${targetChatId}`);
        return true;
    } else {
        await sendMessage(chatId, `⚠️ *Tidak ditemukan di blacklist*\n\n${targetChatId}`);
        return false;
    }
}

async function listBlacklist(chatId, fromId, replyToMsgId = null) {
    if (!isOwner(fromId)) {
        await sendMessage(chatId, '❌ Hanya owner!');
        return;
    }
    
    const blacklist = db.cfd.blacklist || [];
    
    if (blacklist.length === 0) {
        await sendMessage(chatId, '📋 *BLACKLIST CFD*\n\nBelum ada chat yang diblokir.');
        return;
    }
    
    let message = '📋 *DAFTAR BLACKLIST CFD*\n\n';
    
    for (let i = 0; i < blacklist.length; i++) {
        const chatIdB = blacklist[i];
        let chatName = chatIdB;
        try {
            const entity = await client.getEntity(Number(chatIdB));
            chatName = entity.title || entity.firstName || chatIdB;
        } catch (e) {}
        
        message += `${i+1}. ${chatName}\n   \`${chatIdB}\`\n\n`;
    }
    
    message += `\n📌 *Command:*\n`;
    message += `• .addbl <chatId> - Tambah blacklist\n`;
    message += `• .delbl <chatId> - Hapus blacklist\n`;
    message += `• .listbl - Lihat blacklist`;
    
    await sendMessage(chatId, message);
}

// ========================
// AUTO RECORD CHAT HISTORY
// ========================

async function updateChatHistory(chatId, chatType, chatTitle = '') {
    db.chatHistory[String(chatId)] = {
        id: String(chatId),
        type: chatType,
        title: chatTitle,
        lastActive: Date.now()
    };
    saveDb();
}

async function syncChatHistory(chatId = null, fromId = null, replyToMsgId = null) {
    if (fromId && !isOwner(fromId)) {
        if (chatId) await sendMessage(chatId, '❌ Hanya owner!');
        return;
    }
    
    if (chatId) {
        await sendMessage(chatId, '🔄 *Sync Chat History*\n\nMengambil daftar semua chat dari Telegram...');
    }
    
    console.log(chalk.yellow('🔄 Syncing chat history from Telegram...'));
    
    const dialogs = await client.getDialogs({});
    let groupCount = 0;
    let privateCount = 0;
    
    db.chatHistory = {};
    
    for (const dialog of dialogs) {
        const chatIdDialog = String(dialog.id);
        let chatType = 'private';
        let chatTitle = dialog.name || '';
        
        if (dialog.isGroup || dialog.isChannel) {
            chatType = 'group';
        }
        
        db.chatHistory[chatIdDialog] = {
            id: chatIdDialog,
            type: chatType,
            title: chatTitle,
            lastActive: Date.now()
        };
        
        if (chatType === 'group') groupCount++;
        else privateCount++;
    }
    
    saveDb();
    console.log(chalk.green(`✅ Synced: ${groupCount} groups, ${privateCount} private chats`));
    
    if (chatId) {
        await sendMessage(chatId, 
            `✅ *Sync Selesai!*\n\n` +
            `📊 Total chat tersimpan:\n` +
            `   ├ 👥 Grup: ${groupCount}\n` +
            `   └ 👤 Private: ${privateCount}`);
    }
    
    return { groupCount, privateCount };
}

// ========================
// CORE CFD FUNCTION
// ========================

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cfdType1(pesan, originalChatId) {
    const chatHistory = db.chatHistory || {};
    const blacklist = db.cfd?.blacklist || [];
    const delayMs = db.cfd?.settings?.delayMs || 200;
    
    let successCount = 0;
    let failCount = 0;
    let blockedCount = 0;
    let blacklistedCount = 0;
    
    for (const [chatIdTarget, chat] of Object.entries(chatHistory)) {
        if (String(chatIdTarget) === String(originalChatId)) continue;
        if (chat.type !== 'group') continue;
        
        if (blacklist.includes(chatIdTarget)) {
            blacklistedCount++;
            continue;
        }
        
        try {
            await client.sendMessage(Number(chatIdTarget), {
                message: pesan,
                parseMode: 'markdown'
            });
            successCount++;
            await delay(delayMs);
        } catch (err) {
            failCount++;
            if (err.message?.includes('blocked')) blockedCount++;
            console.log(`❌ Gagal kirim ke ${chat.title || chatIdTarget}:`, err.message);
        }
    }
    
    return { successCount, failCount, blockedCount, blacklistedCount };
}

async function cfdType2(pesan, originalChatId) {
    const chatHistory = db.chatHistory || {};
    const blacklist = db.cfd?.blacklist || [];
    const delayMs = db.cfd?.settings?.delayMs || 200;
    
    let successCount = 0;
    let failCount = 0;
    let groupCount = 0;
    let privateCount = 0;
    let blockedCount = 0;
    let blacklistedCount = 0;
    
    for (const [chatIdTarget, chat] of Object.entries(chatHistory)) {
        if (String(chatIdTarget) === String(originalChatId)) continue;
        
        if (blacklist.includes(chatIdTarget)) {
            blacklistedCount++;
            continue;
        }
        
        try {
            await client.sendMessage(Number(chatIdTarget), {
                message: pesan,
                parseMode: 'markdown'
            });
            successCount++;
            if (chat.type === 'group') groupCount++;
            else privateCount++;
            await delay(delayMs);
        } catch (err) {
            failCount++;
            if (err.message?.includes('blocked')) blockedCount++;
        }
    }
    
    return { successCount, failCount, groupCount, privateCount, blockedCount, blacklistedCount };
}

async function handleCFD(chatId, fromId, type, replyToMsgId = null) {
    if (!isOwner(fromId)) {
        await sendMessage(chatId, '❌ *Akses Ditolak*\n\nFitur CFD hanya untuk owner!');
        return;
    }
    
    if (db.cfd?.settings?.enabled === false) {
        await sendMessage(chatId, '⚠️ *CFD Dinonaktifkan*\n\nFitur CFD sedang dimatikan oleh owner.');
        return;
    }
    
    if (!replyToMsgId) {
        await sendMessage(chatId, 
            '⚠️ *Cara Pakai CFD*\n\n' +
            '1️⃣ Balas pesan yang ingin di-share\n' +
            '2️⃣ Ketik `.cfd1` atau `.cfd2`\n\n' +
            '📌 *.cfd1* → Share ke semua GRUP\n' +
            '📌 *.cfd2* → Share ke GRUP + PV\n\n' +
            '🔧 *Command Blacklist:*\n' +
            '• `.addbl <chatId>` - Blokir chat\n' +
            '• `.delbl <chatId>` - Hapus blokir\n' +
            '• `.listbl` - Lihat blacklist\n' +
            '• `.synccf` - Sync chat history');
        return;
    }
    
    let repliedMessage = null;
    try {
        repliedMessage = await client.getMessages(chatId, { ids: replyToMsgId });
        repliedMessage = repliedMessage[0];
    } catch (err) {
        console.error('Gagal ambil pesan:', err);
    }
    
    if (!repliedMessage || !repliedMessage.message) {
        await sendMessage(chatId, '❌ Gagal mengambil pesan yang di-reply!');
        return;
    }
    
    const pengirim = repliedMessage.sender?.firstName || 'User';
    const username = repliedMessage.sender?.username ? `@${repliedMessage.sender.username}` : '';
    const pesanAsli = repliedMessage.message;
    const waktu = new Date().toLocaleString('id-ID');
    
    const pesanBroadcast = `📢 *CFD BROADCAST (Type ${type})*\n\n` +
        `📝 *Pesan:*\n${pesanAsli}\n\n` +
        `👤 *Dari:* ${pengirim} ${username}\n` +
        `⏰ *Waktu:* ${waktu}\n\n` +
        `_Pesan ini dikirim otomatis oleh sistem._`;
    
    const chatHistory = db.chatHistory || {};
    const blacklist = db.cfd?.blacklist || [];
    let totalTarget = 0;
    let totalBlacklisted = 0;
    
    for (const [id, chat] of Object.entries(chatHistory)) {
        if (String(id) === String(chatId)) continue;
        if (type === '1' && chat.type !== 'group') continue;
        if (blacklist.includes(id)) {
            totalBlacklisted++;
            continue;
        }
        totalTarget++;
    }
    
    await sendMessage(chatId, 
        `⏳ *MEMULAI CFD TYPE ${type}*\n\n` +
        `📨 Target: ${totalTarget} chat\n` +
        `🚫 Blacklisted: ${totalBlacklisted}\n\n` +
        `_Proses bisa memakan waktu beberapa menit._`);
    
    let result;
    if (type === '1') {
        result = await cfdType1(pesanBroadcast, String(chatId));
        await sendMessage(chatId,
            `✅ *CFD TYPE 1 SELESAI*\n\n` +
            `📨 Berhasil: ${result.successCount} grup\n` +
            `❌ Gagal: ${result.failCount}\n` +
            `🚫 Terblokir: ${result.blockedCount}\n` +
            `⛔ Blacklist: ${result.blacklistedCount}\n\n` +
            `_Pesan telah dikirim ke semua grup yang tersedia._`);
    } else {
        result = await cfdType2(pesanBroadcast, String(chatId));
        await sendMessage(chatId,
            `✅ *CFD TYPE 2 SELESAI*\n\n` +
            `📨 Berhasil: ${result.successCount}\n` +
            `   ├ 👥 Grup: ${result.groupCount}\n` +
            `   └ 👤 Private: ${result.privateCount}\n` +
            `❌ Gagal: ${result.failCount}\n` +
            `🚫 Terblokir: ${result.blockedCount}\n` +
            `⛔ Blacklist: ${result.blacklistedCount}\n\n` +
            `_Pesan telah dikirim ke semua chat yang tersedia._`);
    }
}

async function listChatHistory(chatId, fromId, replyToMsgId = null) {
    if (!isOwner(fromId)) {
        await sendMessage(chatId, '❌ Hanya owner!');
        return;
    }
    
    const chatHistory = db.chatHistory || {};
    const groups = Object.values(chatHistory).filter(c => c.type === 'group');
    const privates = Object.values(chatHistory).filter(c => c.type === 'private');
    const blacklist = db.cfd?.blacklist || [];
    
    let message = `📊 *DAFTAR CHAT TERSIMPAN*\n\n`;
    message += `👥 *GRUP (${groups.length}):*\n`;
    for (let i = 0; i < Math.min(groups.length, 30); i++) {
        const isBL = blacklist.includes(groups[i].id) ? ' ⛔' : '';
        message += `${i+1}. ${groups[i].title || groups[i].id}${isBL}\n`;
        message += `   \`${groups[i].id}\`\n`;
    }
    if (groups.length > 30) message += `   ...dan ${groups.length - 30} lainnya\n`;
    
    message += `\n👤 *PRIVATE (${privates.length}):*\n`;
    for (let i = 0; i < Math.min(privates.length, 15); i++) {
        const isBL = blacklist.includes(privates[i].id) ? ' ⛔' : '';
        message += `${i+1}. ${privates[i].title || privates[i].id}${isBL}\n`;
        message += `   \`${privates[i].id}\`\n`;
    }
    if (privates.length > 15) message += `   ...dan ${privates.length - 15} lainnya\n`;
    
    message += `\n📌 *Command:*\n`;
    message += `• .addbl <chatId> - Blacklist chat\n`;
    message += `• .delbl <chatId> - Unblacklist\n`;
    message += `• .synccf - Sync ulang history`;
    
    await sendMessage(chatId, message);
}

// ========================
// PANEL FUNCTIONS
// ========================

const ramOptions = {
    ram_1gb: { ram: 1000, disk: 1000, cpu: 40, harga: 1000 },
    ram_2gb: { ram: 2000, disk: 2000, cpu: 60, harga: 2000 },
    ram_3gb: { ram: 3000, disk: 3000, cpu: 80, harga: 3000 },
    ram_4gb: { ram: 4000, disk: 4000, cpu: 100, harga: 4000 },
    ram_unli: { ram: 0, disk: 0, cpu: 0, harga: 8000 },
};

async function createPanel(chatId, data) {
    try {
        const username = data.username;
        const email = `${username}@no-reply.local`;
        const password = `${username}${Math.floor(Math.random() * 9000 + 1000)}`;
        
        let panelUserId = 1;
        try {
            const userResp = await axios.post(`${global.domain}/api/application/users`, {
                email, username, first_name: username, last_name: 'Panel', password
            }, {
                headers: { Authorization: `Bearer ${global.apikey}`, 'Content-Type': 'application/json' }
            });
            panelUserId = userResp.data.attributes.id || panelUserId;
        } catch (e) {
            console.warn('Create user failed, using default:', e?.message);
        }
        
        let allocationId;
        const allocResponse = await axios.get(`${global.domain}/api/application/nodes/${global.loc}/allocations`, {
            headers: { Authorization: `Bearer ${global.apikey}` }
        });
        const availableAlloc = allocResponse.data.data.find(a => a.attributes.assigned === false);
        if (!availableAlloc) throw new Error('No available port');
        allocationId = availableAlloc.attributes.id;
        
        const serverData = {
            name: `${username}-panel`,
            user: Number(panelUserId),
            egg: Number(global.egg),
            docker_image: 'ghcr.io/parkervcp/yolks:nodejs_18',
            startup: 'npm start',
            environment: { NODE_VERSION: '18', USER_UPLOAD: '0', AUTO_UPDATE: '0' },
            skip_scripts: false,
            feature_limits: { databases: 1, backups: 1 },
            limits: { memory: Number(data.ram), swap: 0, disk: Number(data.disk), io: 500, cpu: Number(data.cpu) },
            allocation: { default: allocationId, additional: [] },
            deployment: { locations: [Number(global.loc)], dedicated_ip: false, port_range: [] },
            start_on_completion: true
        };
        
        await axios.post(`${global.domain}/api/application/servers`, serverData, {
            headers: { Authorization: `Bearer ${global.apikey}`, 'Content-Type': 'application/json' }
        });
        
        const ramText = data.ram === 0 ? 'Unlimited' : `${data.ram}MB`;
        const diskText = data.disk === 0 ? 'Unlimited' : `${data.disk}MB`;
        const cpuText = data.cpu === 0 ? 'Unlimited' : `${data.cpu}%`;
        
        const keyboard = inlineKeyboard([
            [{ text: '🔗 Login Panel', url: global.domain }],
            [{ text: '🔙 Kembali ke Menu', callback_data: 'back_to_menu' }]
        ]);
        
        await sendMessage(chatId,
            `✅ *PANEL BERHASIL DIBUAT!*\n\n` +
            `Detail Akun:\nUsername: ${username}\nPassword: ${password}\nEmail: ${email}\n\n` +
            `Detail Server:\nRAM: ${ramText}\nDisk: ${diskText}\nCPU: ${cpuText}\n\n` +
            `Login URL: ${global.domain}`,
            keyboard);
    } catch (err) {
        console.error('PANEL ERROR:', err?.response?.data || err?.message);
        await sendMessage(chatId, `❌ Gagal membuat panel: ${err?.message || 'Unknown error'}`);
        throw err;
    }
}

async function handleBuypanel(chatId, fromId, args) {
    const userId = String(fromId);
    db.users[userId] = db.users[userId] || { saldo: 0 };
    
    if (!args || args.length === 0) {
        setSession(chatId, { step: 'waiting_username', user: fromId });
        await sendMessage(chatId, 'Masukkan username untuk panel baru:', 
            inlineKeyboard([[{ text: '🔙 Kembali ke Menu', callback_data: 'back_to_menu' }]]));
        return;
    }
    
    const username = String(args[0]).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!username) {
        await sendMessage(chatId, '❌ Username tidak valid.');
        return;
    }
    
    db.users[userId].temp_username = username;
    saveDb();
    
    const keyboard = inlineKeyboard([
        [{ text: 'RAM 1GB - Rp1.000', callback_data: 'ram_1gb' }],
        [{ text: 'RAM 2GB - Rp2.000', callback_data: 'ram_2gb' }],
        [{ text: 'RAM 3GB - Rp3.000', callback_data: 'ram_3gb' }],
        [{ text: 'RAM 4GB - Rp4.000', callback_data: 'ram_4gb' }],
        [{ text: 'RAM Unlimited - Rp8.000', callback_data: 'ram_unli' }],
        [{ text: '🔙 Kembali', callback_data: 'back_to_menu' }]
    ]);
    await sendMessage(chatId, `Pilih RAM untuk username *${username}*:`, keyboard);
}

async function handleRamSelection(chatId, fromId, ramKey) {
    const userId = String(fromId);
    db.users[userId] = db.users[userId] || { saldo: 0 };
    const user = db.users[userId];
    const usn = user.temp_username;
    
    if (!usn) {
        await sendMessage(chatId, '❌ Session expired. Silakan mulai ulang dengan /buypanel');
        return;
    }
    
    const dts = ramOptions[ramKey];
    if (!dts) return;
    
    user.pending = {
        username: usn,
        harga: dts.harga,
        ram: dts.ram,
        disk: dts.disk,
        cpu: dts.cpu
    };
    saveDb();
    
    const ramText = dts.ram === 0 ? 'Unlimited' : `${dts.ram}MB`;
    const keyboard = inlineKeyboard([
        [{ text: '💳 Bayar Saldo', callback_data: 'pay_saldo' }],
        [{ text: '📱 Bayar QRIS', callback_data: 'pay_qris' }],
        [{ text: '🔙 Kembali', callback_data: 'back_to_menu' }]
    ]);
    await sendMessage(chatId, `RAM: ${ramText}\nHarga: ${toRupiah(dts.harga)}\n\nPilih pembayaran:`, keyboard);
}

async function handlePaySaldo(chatId, fromId) {
    const userId = String(fromId);
    db.users[userId] = db.users[userId] || { saldo: 0 };
    const user = db.users[userId];
    
    if (!user.pending) {
        await sendMessage(chatId, '❌ Tidak ada transaksi yang sedang berlangsung.');
        return;
    }
    
    if (user.saldo < user.pending.harga) {
        const keyboard = inlineKeyboard([
            [{ text: '💵 Topup Saldo', callback_data: 'topup_saldo' }],
            [{ text: '🔙 Kembali', callback_data: 'back_to_menu' }]
        ]);
        await sendMessage(chatId, `Saldo tidak cukup.\nButuh: ${toRupiah(user.pending.harga)}\nSaldo Anda: ${toRupiah(user.saldo)}`, keyboard);
        return;
    }
    
    user.saldo -= user.pending.harga;
    const orderId = genOrderId();
    db.orders[orderId] = {
        id: orderId,
        user_id: userId,
        ...user.pending,
        metode: 'saldo',
        status: 'processing',
        created_at: Date.now()
    };
    saveDb();
    
    await sendMessage(chatId, '✅ Pembayaran berhasil.\nMembuat panel...');
    try {
        await createPanel(chatId, user.pending);
        delete user.pending;
        saveDb();
    } catch (err) {
        console.error('Create panel failed:', err);
        await sendMessage(chatId, '❌ Gagal membuat panel. Hubungi admin.');
    }
}

async function handleStart(chatId, fromId, firstName) {
    const keyboard = inlineKeyboard([
        [{ text: '📦 Order', callback_data: 'menu_order' }],
        [{ text: '🖥️ Buy Panel', callback_data: 'menu_buypanel' }],
        [{ text: '💰 Cek Saldo', callback_data: 'menu_saldo' }],
        [{ text: '💳 Topup', callback_data: 'menu_topup' }],
        [{ text: '📜 Riwayat Topup', callback_data: 'menu_cek_topup' }]
    ]);
    if (isOwner(fromId)) {
        keyboard.inline_keyboard.push([{ text: '👑 Menu Owner', callback_data: 'menu_owner' }]);
    }
    await sendMessage(chatId, `👋 Hai *${firstName}*!\nSelamat datang di Panel & PPOB UBot.\nPilih layanan di bawah:`, keyboard);
}

async function handleSaldo(chatId, fromId) {
    const userId = String(fromId);
    db.users[userId] = db.users[userId] || { saldo: 0 };
    const keyboard = inlineKeyboard([
        [{ text: '💳 Topup Saldo', callback_data: 'topup_saldo' }],
        [{ text: '🔄 Refresh', callback_data: 'refresh_saldo' }],
        [{ text: '🔙 Kembali ke Menu', callback_data: 'back_to_menu' }]
    ]);
    await sendMessage(chatId, `*SALDO AKUN*\n\nSaldo Anda: ${toRupiah(db.users[userId].saldo)}`, keyboard);
}

async function handleTopup(chatId, fromId) {
    const keyboard = inlineKeyboard([
        [{ text: 'Rp5.000', callback_data: 'topup_5000' }, { text: 'Rp10.000', callback_data: 'topup_10000' }],
        [{ text: 'Rp20.000', callback_data: 'topup_20000' }, { text: 'Rp50.000', callback_data: 'topup_50000' }],
        [{ text: 'Rp100.000', callback_data: 'topup_100000' }, { text: 'Lainnya', callback_data: 'topup_custom' }],
        [{ text: '🔙 Kembali', callback_data: 'back_to_menu' }]
    ]);
    await sendMessage(chatId, 'Pilih nominal topup:', keyboard);
}

async function processTopup(chatId, fromId, nominal) {
    if (!global.pay?.apikey && !process.env.PAY_APIKEY) {
        await sendMessage(chatId, '❌ Payment gateway belum dikonfigurasi.');
        return;
    }
    if (nominal < 2000) {
        await sendMessage(chatId, 'Minimal topup Rp2.000');
        return;
    }
    
    try {
        const create = await axios.get(`https://ciaatopup.my.id/h2h/deposit/create?nominal=${nominal}&metode=${global.pay?.metode || 'qris'}`, {
            headers: { 'X-APIKEY': global.pay?.apikey || process.env.PAY_APIKEY }
        });
        
        if (!create.data || !create.data.success) {
            await sendMessage(chatId, '❌ Gagal membuat pembayaran. Silakan coba lagi.');
            return;
        }
        
        const pay = create.data.data;
        const qrBuffer = await QRCode.toBuffer(pay.qr_string, { width: 300 });
        const topupId = genOrderId();
        
        db.topups[pay.id] = {
            user_id: String(fromId),
            nominal: nominal,
            status: 'pending',
            created_at: Date.now(),
            topup_id: topupId,
            type: 'saldo_topup'
        };
        saveDb();
        
        const keyboard = inlineKeyboard([
            [{ text: '🔄 Cek Status', callback_data: `cek_topup_${pay.id}` }],
            [{ text: '🔙 Kembali ke Menu', callback_data: 'back_to_menu' }]
        ]);
        
        await sendPhoto(chatId, qrBuffer, 
            `💳 *TOPUP SALDO*\n\nNominal: ${toRupiah(nominal)}\nMetode: QRIS\nID: ${topupId}\n\nScan QR code untuk pembayaran.`,
            keyboard);
    } catch (err) {
        console.error('Topup error:', err);
        await sendMessage(chatId, '❌ Error saat membuat topup.');
    }
}

async function checkPendingPayments() {
    try {
        const pendingTopups = Object.entries(db.topups).filter(([id, t]) => t.status === 'pending');
        for (const [trxId, topup] of pendingTopups) {
            try {
                const check = await axios.get(`https://ciaatopup.my.id/h2h/deposit/status?id=${trxId}`, {
                    headers: { 'X-APIKEY': global.pay?.apikey || process.env.PAY_APIKEY }
                });
                if (check.data?.success && check.data.data?.status?.toLowerCase() === 'success') {
                    topup.status = 'success';
                    if (topup.type === 'saldo_topup') {
                        const userId = String(topup.user_id);
                        db.users[userId] = db.users[userId] || { saldo: 0 };
                        db.users[userId].saldo += topup.nominal;
                        if (client) {
                            await sendMessage(Number(userId), `✅ TOPUP TERKONFIRMASI!\nNominal: ${toRupiah(topup.nominal)}\nSaldo: ${toRupiah(db.users[userId].saldo)}`);
                        }
                    }
                    saveDb();
                }
            } catch (err) {
                console.error('Check payment error:', err?.message);
            }
        }
    } catch (err) {
        console.error('Pending payments error:', err);
    }
}

// ========================
// TELEGRAM CLIENT INIT & LOGIN
// ========================
async function loginToTelegram() {
    let sessionData = null;
    if (fs.existsSync(SESSION_FILE)) {
        try {
            sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
            console.log(chalk.blue('📱 Found saved session, reconnecting...'));
        } catch (e) {
            console.log(chalk.yellow('⚠️ Failed to parse session file, will create new session.'));
        }
    }
    
    const stringSession = new StringSession(sessionData?.sessionString || '');
    client = new TelegramClient(stringSession, API_ID, API_HASH, { connectionRetries: 5 });
    
    await client.start({
        phoneNumber: async () => {
            console.log(chalk.cyan('\n📱 Masukkan nomor Telegram Anda (contoh: 628123456789):'));
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            return new Promise(resolve => {
                rl.question('Nomor: ', (answer) => {
                    rl.close();
                    resolve(answer);
                });
            });
        },
        phoneCode: async () => {
            console.log(chalk.cyan('📨 Masukkan kode verifikasi yang dikirim ke Telegram Anda:'));
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            return new Promise(resolve => {
                rl.question('Kode: ', (answer) => {
                    rl.close();
                    resolve(answer);
                });
            });
        },
        password: async () => {
            console.log(chalk.cyan('🔐 Masukkan password 2FA (jika ada):'));
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            return new Promise(resolve => {
                rl.question('Password: ', (answer) => {
                    rl.close();
                    resolve(answer);
                });
            });
        },
        onError: (err) => console.log(chalk.red('Login error:'), err),
    });
    
    me = await client.getMe();
    console.log(chalk.green(`✅ Login berhasil sebagai: ${me.firstName} (${me.username || me.id})`));
    
    // Save session
    const sessionString = client.session.save();
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ sessionString, userId: me.id, date: new Date() }, null, 2));
    
    // Initial sync chat history
    await syncChatHistory();
    
    return client;
}

// ========================
// MAIN BOT LOOP
// ========================
async function main() {
    console.log(chalk.magenta('========================================='));
    console.log(chalk.cyan('         UBOT TELEGRAM - USERBOT          '));
    console.log(chalk.magenta('========================================='));
    
    await loginToTelegram();
    
    console.log(chalk.green('🤖 Bot is running... Waiting for messages\n'));
    
    // Listen for messages
    client.addEventHandler(async (event) => {
        try {
            if (event.className !== 'UpdateNewMessage') return;
            const message = event.message;
            if (!message || message.out || !message.message) return;
            
            const chatId = message.chatId;
            const fromId = String(message.senderId?.value || message.fromId?.value);
            const text = message.message || '';
            
            // Auto record chat history
            try {
                const entity = await client.getEntity(chatId);
                const chatType = entity.className === 'Channel' ? 'group' : 'private';
                const chatTitle = entity.title || entity.firstName || 'Unknown';
                await updateChatHistory(chatId, chatType, chatTitle);
            } catch (e) {}
            
            // Get firstName for display
            let firstName = 'User';
            try {
                const sender = await client.getEntity(Number(fromId));
                firstName = sender.firstName || 'User';
            } catch (e) {}
            
            // Handle commands
            if (text === '/start') {
                await handleStart(chatId, fromId, firstName);
            } else if (text.startsWith('/buypanel')) {
                const args = text.split(' ').slice(1);
                await handleBuypanel(chatId, fromId, args);
            } else if (text === '/saldo') {
                await handleSaldo(chatId, fromId);
            } else if (text === '/topup') {
                await handleTopup(chatId, fromId);
            } else if (text === '/menu') {
                await handleStart(chatId, fromId, firstName);
            } else if (text === '.cfd1' || text === '.cfd1@') {
                const replyToMsgId = message.replyTo?.msgId;
                await handleCFD(chatId, fromId, '1', replyToMsgId);
            } else if (text === '.cfd2' || text === '.cfd2@') {
                const replyToMsgId = message.replyTo?.msgId;
                await handleCFD(chatId, fromId, '2', replyToMsgId);
            } else if (text === '.synccf' || text === '.synccfd') {
                await syncChatHistory(chatId, fromId);
            } else if (text === '.listcfd' || text === '.listcf') {
                await listChatHistory(chatId, fromId);
            } else if (text === '.listbl') {
                await listBlacklist(chatId, fromId);
            } else if (text.startsWith('.addbl ')) {
                const targetId = text.split(' ')[1];
                if (targetId) {
                    await addToBlacklist(chatId, fromId, targetId);
                } else {
                    await sendMessage(chatId, '📝 *Add Blacklist*\n\nGunakan: `.addbl <chatId>`');
                }
            } else if (text.startsWith('.delbl ')) {
                const targetId = text.split(' ')[1];
                if (targetId) {
                    await removeFromBlacklist(chatId, fromId, targetId);
                } else {
                    await sendMessage(chatId, '📝 *Delete Blacklist*\n\nGunakan: `.delbl <chatId>`');
                }
            } else {
                // Handle session text input
                const session = getSession(chatId);
                if (session) {
                    if (session.step === 'waiting_username' && text !== 'Kembali ke Menu') {
                        const username = String(text).toLowerCase().replace(/[^a-z0-9_-]/g, '');
                        if (username) {
                            const userId = String(session.user);
                            db.users[userId] = db.users[userId] || { saldo: 0 };
                            db.users[userId].temp_username = username;
                            clearSession(chatId);
                            saveDb();
                            
                            const keyboard = inlineKeyboard([
                                [{ text: 'RAM 1GB - Rp1.000', callback_data: 'ram_1gb' }],
                                [{ text: 'RAM 2GB - Rp2.000', callback_data: 'ram_2gb' }],
                                [{ text: 'RAM 3GB - Rp3.000', callback_data: 'ram_3gb' }],
                                [{ text: 'RAM 4GB - Rp4.000', callback_data: 'ram_4gb' }],
                                [{ text: 'RAM Unlimited - Rp8.000', callback_data: 'ram_unli' }],
                                [{ text: '🔙 Kembali', callback_data: 'back_to_menu' }]
                            ]);
                            await sendMessage(chatId, `Pilih RAM untuk username *${username}*:`, keyboard);
                        }
                    } else if (session.step === 'waiting_topup_custom') {
                        const nominal = Number(String(text).replace(/\D/g, ''));
                        clearSession(chatId);
                        saveDb();
                        await processTopup(chatId, fromId, nominal);
                    }
                }
            }
        } catch (err) {
            console.error('Message handler error:', err);
        }
    });
    
    // Listen for callback queries (button presses)
    client.addEventHandler(async (event) => {
        try {
            if (event.className !== 'UpdateBotCallbackQuery') return;
            const callback = event.query;
            const data = callback.data.toString();
            const chatId = callback.chatId;
            const fromId = String(callback.senderId?.value);
            const messageId = callback.msgId;
            
            await callback.answer();
            
            // Handle callbacks
            if (data === 'back_to_menu') {
                let firstName = 'User';
                try {
                    const sender = await client.getEntity(Number(fromId));
                    firstName = sender.firstName || 'User';
                } catch (e) {}
                await handleStart(chatId, fromId, firstName);
            } else if (data === 'menu_order') {
                await sendMessage(chatId, '📦 *ORDER*\n\nGunakan format: /order 08123456789');
            } else if (data === 'menu_buypanel') {
                await handleBuypanel(chatId, fromId, []);
            } else if (data === 'menu_saldo') {
                await handleSaldo(chatId, fromId);
            } else if (data === 'menu_topup') {
                await handleTopup(chatId, fromId);
            } else if (data === 'menu_cek_topup') {
                const userId = String(fromId);
                const userTopups = Object.entries(db.topups).filter(([id, t]) => t.user_id === userId && t.type === 'saldo_topup').slice(-5);
                if (userTopups.length === 0) {
                    await sendMessage(chatId, 'Belum ada riwayat topup.');
                } else {
                    let msg = '📜 *RIWAYAT TOPUP*\n\n';
                    userTopups.forEach(([id, topup], idx) => {
                        const status = topup.status === 'success' ? '✅ Berhasil' : '⏳ Pending';
                        msg += `${idx+1}. ${toRupiah(topup.nominal)} - ${status}\n`;
                    });
                    await sendMessage(chatId, msg);
                }
            } else if (data === 'topup_saldo') {
                await handleTopup(chatId, fromId);
            } else if (data === 'refresh_saldo') {
                await handleSaldo(chatId, fromId);
            } else if (data === 'topup_5000') {
                await processTopup(chatId, fromId, 5000);
            } else if (data === 'topup_10000') {
                await processTopup(chatId, fromId, 10000);
            } else if (data === 'topup_20000') {
                await processTopup(chatId, fromId, 20000);
            } else if (data === 'topup_50000') {
                await processTopup(chatId, fromId, 50000);
            } else if (data === 'topup_100000') {
                await processTopup(chatId, fromId, 100000);
            } else if (data === 'topup_custom') {
                setSession(chatId, { step: 'waiting_topup_custom', user: fromId });
                await sendMessage(chatId, 'Masukkan nominal topup (minimal Rp2.000):');
            } else if (data === 'pay_saldo') {
                await handlePaySaldo(chatId, fromId);
            } else if (data === 'pay_qris') {
                await sendMessage(chatId, '🚧 Fitur QRIS sedang dalam pengembangan.');
            } else if (data.startsWith('ram_')) {
                await handleRamSelection(chatId, fromId, data);
            } else if (data.startsWith('cek_topup_')) {
                const trxId = data.replace('cek_topup_', '');
                const topup = db.topups[trxId];
                if (!topup) {
                    await sendMessage(chatId, 'Data topup tidak ditemukan.');
                    return;
                }
                try {
                    const check = await axios.get(`https://ciaatopup.my.id/h2h/deposit/status?id=${trxId}`, {
                        headers: { 'X-APIKEY': global.pay?.apikey || process.env.PAY_APIKEY }
                    });
                    if (check.data?.success && check.data.data?.status?.toLowerCase() === 'success') {
                        topup.status = 'success';
                        const userId = String(fromId);
                        db.users[userId] = db.users[userId] || { saldo: 0 };
                        db.users[userId].saldo += topup.nominal;
                        saveDb();
                        await sendMessage(chatId, `✅ TOPUP BERHASIL!\nNominal: ${toRupiah(topup.nominal)}\nSaldo sekarang: ${toRupiah(db.users[userId].saldo)}`);
                    } else {
                        await sendMessage(chatId, '⏳ Topup masih menunggu pembayaran.');
                    }
                } catch (err) {
                    await sendMessage(chatId, '❌ Error cek status topup.');
                }
            } else if (data === 'menu_owner') {
                if (isOwner(fromId)) {
                    const keyboard = inlineKeyboard([
                        [{ text: '📊 Statistik', callback_data: 'owner_stats' }],
                        [{ text: '👥 List User', callback_data: 'owner_users' }],
                        [{ text: '💰 Tambah Saldo', callback_data: 'owner_add_saldo' }],
                        [{ text: '🔙 Kembali', callback_data: 'back_to_menu' }]
                    ]);
                    await sendMessage(chatId, '👑 *MENU OWNER*\n\nPilih aksi:', keyboard);
                }
            } else if (data === 'owner_stats') {
                if (isOwner(fromId)) {
                    const totalUsers = Object.keys(db.users).length;
                    const totalOrders = Object.keys(db.orders).length;
                    const totalTopups = Object.keys(db.topups).length;
                    await sendMessage(chatId, 
                        `📊 *STATISTIK BOT*\n\n` +
                        `👤 Total User: ${totalUsers}\n` +
                        `📦 Total Order: ${totalOrders}\n` +
                        `💳 Total Topup: ${totalTopups}`);
                }
            } else if (data === 'owner_users') {
                if (isOwner(fromId)) {
                    const users = Object.entries(db.users).slice(0, 10);
                    let msg = '👥 *DAFTAR USER*\n\n';
                    users.forEach(([id, user], idx) => {
                        msg += `${idx+1}. ID: ${id}\n   Saldo: ${toRupiah(user.saldo || 0)}\n\n`;
                    });
                    msg += `Total: ${Object.keys(db.users).length} user`;
                    await sendMessage(chatId, msg);
                }
            }
        } catch (err) {
            console.error('Callback handler error:', err);
        }
    });
    
    // Start checking pending payments
    setInterval(checkPendingPayments, 30 * 1000);
    
    console.log(chalk.green('✅ UBot siap digunakan!'));
}

// ========================
// START
// ========================
main().catch(err => {
    console.error(chalk.red('Fatal error:'), err);
    process.exit(1);
});