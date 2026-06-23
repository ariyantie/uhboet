// setting.js - Versi Lengkap untuk Telegraf (Telegram Bot)

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// ========================
// LOAD ENV (jika ada)
// ========================
try {
    require('dotenv').config();
} catch (e) {
    // dotenv tidak wajib
}

// ========================
// KONFIGURASI BOT
// ========================

// Identitas Bot
global.pairing = "FANZ4YOU"; // 8 huruf/angka (untuk WhatsApp)
global.owner = ['6281401937065']; // Nomor owner WhatsApp
global.namaBot = "LOYN ENJINER";
global.namaOwner = "Fanz4You";
global.linkch = "https://whatsapp.com/channel/0029VbC0rKfLSmbcWPgKDe3D";
global.linkgc = "https://chat.whatsapp.com/";

// Foto & Media Message
global.thumbnail = './_menu.jpg';
global.thumbnail2 = "https://files.catbox.moe/ljheih.jpeg";
global.video = "https://files.catbox.moe/ufe3h2.mp4";
global.audio = "https://f.top4top.io/m_3719jcr8e4.mp3";

// ========================
// GLOBAL REGISTER
// ========================
global.register = false; // default aktif

// ========================
// PAYMENT CONFIGURATION
// ========================
global.teks = "jangan lupa kirim bukti transfernya kak";
global.namadana = "Fanx";
global.namagopay = "--";
global.namaovo = "-";
global.dana = "6281401937065"; // isi no dana
global.ovo = "-"; // isi no ovo
global.gopay = "--"; // isi no gopay
global.qris = "---"; // isi url qris

// ========================
// TELEGRAM CONFIGURATION
// ========================
global.token = "-"; // Bot Token Telegram (isi dengan token bot dari @BotFather)
global.owntg = "8177058501"; // ID Telegram owner (nomor Telegram, tanpa @)

// Grup Garansi Panel (opsional)
global.linkgc_tele = "-"; // Link grup Telegram

// ========================
// PTERODACTYL PANEL API (Server 1)
// ========================
global.egg = "15"; // Egg ID
global.nestid = "5"; // nest ID
global.loc = "1"; // Location ID
global.domain = "https://rian.pterodaytl.my.id";
global.apikey = "ptla_U0L2ZG065HuACNBrzm6lK3KWROezVnRBGs7B2eEDJtS"; // ptla key
global.capikey = "ptlc_J5yvIz5xN0eONWpxCuFeE2jZ0G0tnSscIchSmg9jwsW"; // ptlc key

// ========================
// PTERODACTYL PANEL API (Server 2 - Opsional)
// ========================
global.eggV2 = "15";
global.nestidV2 = "5";
global.locV2 = "1";
global.domainV2 = "https";
global.apikeyV2 = "ptla";
global.capikeyV2 = "ptlc";

// ========================
// VPS PROVIDER API (cVPS, Linode, dll)
// ========================
global.doToken = "APIKEY"; // DigitalOcean Token
global.linodeToken = "APIKEY"; // Linode Token

// ========================
// LIMIT USER
// ========================
global.setlimit = 100;

// ========================
// PAYMENT GATEWAY API (ciaatopup)
// ========================
global.baseurl = "https://ciaatopup.my.id";
global.pay = {
    apikey: "CiaaTopUp_ylddpmphwjwq4rb2",
    fee: 300,
    metode: "QRISFAST",
    expired: Date.now() + (30 * 60 * 1000), // 30 menit
    expiredMs: 30 * 60 * 1000
};

// ========================
// MESSAGES
// ========================
global.mess = {
    owner: "Maaf hanya untuk owner bot",
    prem: "Maaf hanya untuk pengguna premium",
    admin: "Maaf hanya untuk admin group",
    botadmin: "Maaf bot harus dijadikan admin",
    group: "Maaf hanya dapat digunakan di dalam group",
    private: "Silahkan gunakan fitur di private chat",
};

// ========================
// EMOTICON / STYLE
// ========================
global.vircsetz = ['☼', '✘', '✦', '✧', '❀', '○', '⏣', '♧', '々', '〆', '✎'];

// ========================
// GAME CONFIGURATION
// ========================
global.gamewaktu = 60; // Game waktu dalam detik

// Game state containers
global.suit = {};
global.tictactoe = {};
global.petakbom = {};
global.kuis = {};
global.siapakahaku = {};
global.asahotak = {};
global.susunkata = {};
global.caklontong = {};
global.family100 = {};
global.tebaklirik = {};
global.tebaklagu = {};
global.tebakgambar2 = {};
global.tebakkimia = {};
global.tebakkata = {};
global.tebakkalimat = {};
global.tebakbendera = {};
global.tebakanime = {};
global.kuismath = {};

// ========================
// RPG EMOTICON FUNCTION
// ========================
global.rpg = {
    emoticon(string) {
        string = string.toLowerCase();
        let emot = {
            level: '📊',
            limit: '🎫',
            health: '❤️',
            exp: '✨',
            atm: '💳',
            money: '💰',
            bank: '🏦',
            potion: '🥤',
            diamond: '💎',
            common: '📦',
            uncommon: '🛍️',
            mythic: '🎁',
            legendary: '🗃️',
            superior: '💼',
            pet: '🔖',
            trash: '🗑',
            armor: '🥼',
            sword: '⚔️',
            makanancentaur: "🥗",
            makanangriffin: "🥙",
            makanankyubi: "🍗",
            makanannaga: "🍖",
            makananpet: "🥩",
            makananphonix: "🧀",
            pickaxe: '⛏️',
            fishingrod: '🎣',
            wood: '🪵',
            rock: '🪨',
            string: '🕸️',
            horse: '🐴',
            cat: '🐱',
            dog: '🐶',
            fox: '🦊',
            robo: '🤖',
            petfood: '🍖',
            iron: '⛓️',
            gold: '🪙',
            emerald: '❇️',
            upgrader: '🧰',
            bibitanggur: '🌱',
            bibitjeruk: '🌿',
            bibitapel: '☘️',
            bibitmangga: '🍀',
            bibitpisang: '🌴',
            anggur: '🍇',
            jeruk: '🍊',
            apel: '🍎',
            mangga: '🥭',
            pisang: '🍌',
            botol: '🍾',
            kardus: '📦',
            kaleng: '🏮',
            plastik: '📜',
            gelas: '🧋',
            chip: '♋',
            umpan: '🪱',
            naga: "🐉",
            phonix: "🦅",
            kyubi: "🦊",
            griffin: "🦒",
            centaur: "🎠",
            skata: '🧩'
        };
        let results = Object.keys(emot).map(v => [v, new RegExp(v, 'gi')]).filter(v => v[1].test(string));
        if (!results.length) return '';
        else return emot[results[0][0]];
    }
};

// ========================
// FORMATTER FUNCTIONS
// ========================
global.toRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
};

global.formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

global.randomNumber = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

// ========================
// VALIDATION & LOGGING
// ========================
console.log(chalk.cyan('\n╔═══════════════════════════════════════╗'));
console.log(chalk.cyan('║     🔧 LOADING CONFIGURATION...       ║'));
console.log(chalk.cyan('╚═══════════════════════════════════════╝\n'));

console.log(chalk.green('📱 Bot Name:'), chalk.yellow(global.namaBot));
console.log(chalk.green('👤 Owner:'), chalk.yellow(global.namaOwner));
console.log(chalk.green('📢 Channel:'), chalk.yellow(global.linkch || 'Not set'));
console.log(chalk.green('👥 Group:'), chalk.yellow(global.linkgc || 'Not set'));

console.log(chalk.green('\n💳 Payment Config:'));
console.log(chalk.white(`   • API Key: ${global.pay.apikey.substring(0, 15)}...`));
console.log(chalk.white(`   • Method: ${global.pay.metode}`));
console.log(chalk.white(`   • Fee: ${global.pay.fee}`));

console.log(chalk.green('\n🖥️ Pterodactyl Config:'));
console.log(chalk.white(`   • Domain: ${global.domain}`));
console.log(chalk.white(`   • Egg ID: ${global.egg}`));
console.log(chalk.white(`   • Nest ID: ${global.nestid}`));
console.log(chalk.white(`   • Location: ${global.loc}`));

console.log(chalk.green('\n🎮 Games Config:'));
console.log(chalk.white(`   • Game Time: ${global.gamewaktu} seconds`));
console.log(chalk.white(`   • Active Games: 20+`));

console.log(chalk.cyan('\n╔═══════════════════════════════════════╗'));
console.log(chalk.cyan('║     ✅ CONFIGURATION LOADED!          ║'));
console.log(chalk.cyan('╚═══════════════════════════════════════╝\n'));

// ========================
// EXPORT FUNCTIONS
// ========================
module.exports = {
    // Get all config
    getAll: () => ({
        bot: {
            name: global.namaBot,
            owner: global.namaOwner,
            ownerNumber: global.owner,
            channel: global.linkch,
            group: global.linkgc
        },
        payment: {
            dana: global.dana,
            ovo: global.ovo,
            gopay: global.gopay,
            qris: global.qris,
            apiKey: global.pay.apikey,
            method: global.pay.metode
        },
        pterodactyl: {
            domain: global.domain,
            apikey: global.apikey,
            egg: global.egg,
            nestid: global.nestid,
            loc: global.loc
        },
        limits: {
            default: global.setlimit
        }
    }),
    
    // Update config runtime
    update: (key, value) => {
        if (global.hasOwnProperty(key)) {
            global[key] = value;
            console.log(chalk.green(`✅ Updated ${key} = ${value}`));
            return true;
        }
        return false;
    },
    
    // Reload from file
    reload: () => {
        delete require.cache[require.resolve(__filename)];
        const newConfig = require(__filename);
        console.log(chalk.green('✅ Config reloaded!'));
        return newConfig;
    }
};

// ========================
// AUTO WATCH FILE CHANGES (development)
// ========================
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(chalk.yellow(`\n⚠️ ${__filename} changed!`));
    console.log(chalk.yellow('🔄 Please restart bot to apply changes.\n'));
    delete require.cache[file];
});