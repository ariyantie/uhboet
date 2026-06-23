// ========================
// SESSION MANAGEMENT SYSTEM
// ========================

const SESSION_FILE = './ubot_session.json';
const SESSION_BACKUP_DIR = './sessions_backup';

// Pastikan folder backup ada
if (!fs.existsSync(SESSION_BACKUP_DIR)) {
    fs.mkdirSync(SESSION_BACKUP_DIR, { recursive: true });
}

// Class untuk manage session
class SessionManager {
    constructor() {
        this.sessionData = null;
        this.client = null;
        this.isConnected = false;
    }

    // Simpan session ke file
    saveSession(sessionString, userId, userData = {}) {
        const session = {
            sessionString: sessionString,
            userId: userId,
            username: userData.username || null,
            firstName: userData.firstName || null,
            lastName: userData.lastName || null,
            phoneNumber: userData.phoneNumber || null,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            expiresAt: null // Telegram session tidak expire
        };

        // Simpan ke file utama
        fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
        
        // Backup dengan timestamp
        const backupFile = path.join(SESSION_BACKUP_DIR, `session_${Date.now()}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(session, null, 2));
        
        // Hapus backup lama (lebih dari 7 hari)
        this.cleanOldBackups();
        
        this.sessionData = session;
        console.log(chalk.green('✅ Session saved successfully'));
        return session;
    }

    // Load session dari file
    loadSession() {
        try {
            if (fs.existsSync(SESSION_FILE)) {
                const raw = fs.readFileSync(SESSION_FILE, 'utf8');
                const parsed = JSON.parse(raw);
                
                // Validasi session
                if (parsed.sessionString && parsed.sessionString.length > 0) {
                    this.sessionData = parsed;
                    console.log(chalk.blue(`📱 Loaded session for user: ${parsed.firstName || parsed.userId}`));
                    return parsed;
                }
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️ Failed to load session:', e.message));
            // Coba ambil dari backup terbaru
            return this.loadLatestBackup();
        }
        return null;
    }

    // Load dari backup terbaru
    loadLatestBackup() {
        try {
            const backups = fs.readdirSync(SESSION_BACKUP_DIR)
                .filter(f => f.startsWith('session_') && f.endsWith('.json'))
                .sort()
                .reverse();
            
            if (backups.length > 0) {
                const latestBackup = path.join(SESSION_BACKUP_DIR, backups[0]);
                const raw = fs.readFileSync(latestBackup, 'utf8');
                const parsed = JSON.parse(raw);
                console.log(chalk.blue(`📱 Loaded session from backup: ${parsed.firstName || parsed.userId}`));
                return parsed;
            }
        } catch (e) {
            console.log(chalk.red('❌ Failed to load backup:', e.message));
        }
        return null;
    }

    // Hapus backup lama
    cleanOldBackups() {
        try {
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const backups = fs.readdirSync(SESSION_BACKUP_DIR);
            
            backups.forEach(backup => {
                const backupPath = path.join(SESSION_BACKUP_DIR, backup);
                const stats = fs.statSync(backupPath);
                if (stats.mtimeMs < sevenDaysAgo) {
                    fs.unlinkSync(backupPath);
                    console.log(chalk.gray(`🗑️ Deleted old backup: ${backup}`));
                }
            });
        } catch (e) {
            console.log(chalk.gray('Failed to clean backups:', e.message));
        }
    }

    // Hapus session (logout)
    async deleteSession() {
        try {
            if (fs.existsSync(SESSION_FILE)) {
                fs.unlinkSync(SESSION_FILE);
            }
            this.sessionData = null;
            this.isConnected = false;
            console.log(chalk.yellow('🗑️ Session deleted'));
            return true;
        } catch (e) {
            console.log(chalk.red('Failed to delete session:', e.message));
            return false;
        }
    }

    // Cek session valid
    async validateSession(client) {
        if (!client || !this.sessionData) return false;
        
        try {
            const me = await client.getMe();
            if (me && me.id == this.sessionData.userId) {
                this.isConnected = true;
                console.log(chalk.green(`✅ Session valid: ${me.firstName}`));
                return true;
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️ Session expired or invalid:', e.message));
            this.isConnected = false;
        }
        return false;
    }

    // Update session info
    updateSessionInfo(userData) {
        if (this.sessionData) {
            this.sessionData.username = userData.username || this.sessionData.username;
            this.sessionData.firstName = userData.firstName || this.sessionData.firstName;
            this.sessionData.lastName = userData.lastName || this.sessionData.lastName;
            this.sessionData.lastUpdated = new Date().toISOString();
            
            fs.writeFileSync(SESSION_FILE, JSON.stringify(this.sessionData, null, 2));
            console.log(chalk.green('✅ Session info updated'));
        }
    }

    // Get session stats
    getSessionStats() {
        if (!this.sessionData) {
            return { exists: false };
        }
        
        return {
            exists: true,
            userId: this.sessionData.userId,
            username: this.sessionData.username,
            firstName: this.sessionData.firstName,
            createdAt: this.sessionData.createdAt,
            lastUpdated: this.sessionData.lastUpdated,
            isConnected: this.isConnected
        };
    }
}

// Inisialisasi session manager
const sessionManager = new SessionManager();

// ========================
// LOGIN TELEGRAM DENGAN SESSION
// ========================
async function loginToTelegram() {
    console.log(chalk.magenta('\n========================================='));
    console.log(chalk.cyan('         TELEGRAM USERBOT LOGIN          '));
    console.log(chalk.magenta('=========================================\n'));
    
    // Coba load session yang ada
    let savedSession = sessionManager.loadSession();
    let sessionString = savedSession?.sessionString || '';
    
    const stringSession = new StringSession(sessionString);
    const client = new TelegramClient(stringSession, API_ID, API_HASH, {
        connectionRetries: 5,
        useWSS: true,
        deviceModel: 'Ubuntu',
        systemVersion: '1.0',
        appVersion: '1.0',
        langCode: 'id'
    });
    
    // Setup event untuk login
    await client.start({
        phoneNumber: async () => {
            console.log(chalk.cyan('\n📱 Masukkan nomor Telegram Anda:'));
            console.log(chalk.gray('   Contoh: 628123456789\n'));
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            return new Promise((resolve) => {
                rl.question(chalk.yellow('➤ Nomor: '), (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });
        },
        
        phoneCode: async () => {
            console.log(chalk.cyan('\n📨 Masukkan kode verifikasi dari Telegram:'));
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            return new Promise((resolve) => {
                rl.question(chalk.yellow('➤ Kode: '), (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });
        },
        
        password: async () => {
            console.log(chalk.cyan('\n🔐 Masukkan password 2FA (jika ada):'));
            
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            return new Promise((resolve) => {
                rl.question(chalk.yellow('➤ Password: '), (answer) => {
                    rl.close();
                    resolve(answer.trim());
                });
            });
        },
        
        onError: (err) => {
            console.log(chalk.red('❌ Login error:'), err.message);
        }
    });
    
    // Dapatkan info user
    const me = await client.getMe();
    const userData = {
        username: me.username,
        firstName: me.firstName,
        lastName: me.lastName,
        phoneNumber: me.phone
    };
    
    // Simpan session
    const sessionStringSaved = client.session.save();
    sessionManager.saveSession(sessionStringSaved, me.id, userData);
    
    console.log(chalk.green('\n✅ ========================================='));
    console.log(chalk.green(`✅ LOGIN BERHASIL!`));
    console.log(chalk.green(`✅ Nama: ${me.firstName} ${me.lastName || ''}`));
    console.log(chalk.green(`✅ Username: @${me.username || 'tidak ada'}`));
    console.log(chalk.green(`✅ User ID: ${me.id}`));
    console.log(chalk.green('✅ =========================================\n'));
    
    return client;
}

// ========================
// PERINTAH MANAJEMEN SESSION
// ========================
async function handleSessionCommand(chatId, fromId, args, replyToMsgId = null) {
    if (!isOwner(fromId)) {
        await sendMessage(chatId, '❌ Hanya owner yang bisa menggunakan perintah ini!', null, replyToMsgId);
        return;
    }
    
    const subCommand = args[0]?.toLowerCase();
    
    switch (subCommand) {
        case 'info':
            const stats = sessionManager.getSessionStats();
            if (!stats.exists) {
                await sendMessage(chatId, '📭 *Tidak ada session yang tersimpan*', null, replyToMsgId);
                return;
            }
            
            const message = `📊 *INFORMASI SESSION*\n\n` +
                `👤 *User ID:* \`${stats.userId}\`\n` +
                `📛 *Nama:* ${stats.firstName || '-'}\n` +
                `🔖 *Username:* @${stats.username || '-'}\n` +
                `🔗 *Status:* ${stats.isConnected ? '✅ Terhubung' : '❌ Terputus'}\n` +
                `📅 *Dibuat:* ${new Date(stats.createdAt).toLocaleString('id-ID')}\n` +
                `🔄 *Update:* ${new Date(stats.lastUpdated).toLocaleString('id-ID')}`;
            
            await sendMessage(chatId, message, null, replyToMsgId);
            break;
            
        case 'clear':
        case 'delete':
        case 'logout':
            await sessionManager.deleteSession();
            await sendMessage(chatId, '✅ *Session berhasil dihapus*\n\nGunakan `.login` untuk login ulang.', null, replyToMsgId);
            break;
            
        case 'backup':
            const backupInfo = await createSessionBackup();
            await sendMessage(chatId, backupInfo, null, replyToMsgId);
            break;
            
        case 'renew':
            await sendMessage(chatId, '🔄 *Memperbaharui session...*\n\nBot akan restart dalam 3 detik.', null, replyToMsgId);
            setTimeout(() => {
                process.exit(0);
            }, 3000);
            break;
            
        default:
            await sendMessage(chatId, 
                `📋 *PERINTAH SESSION*\n\n` +
                `• \`.session info\` - Lihat info session\n` +
                `• \`.session logout\` - Hapus session (logout)\n` +
                `• \`.session backup\` - Backup session manual\n` +
                `• \`.session renew\` - Restart dan renew session\n\n` +
                `📌 *Catatan:* Session tersimpan otomatis di folder \`sessions_backup/\``,
                null, replyToMsgId);
            break;
    }
}

// Buat backup manual
async function createSessionBackup() {
    try {
        if (!fs.existsSync(SESSION_FILE)) {
            return '❌ Tidak ada session yang tersimpan.';
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(SESSION_BACKUP_DIR, `session_manual_${timestamp}.json`);
        
        fs.copyFileSync(SESSION_FILE, backupFile);
        
        // Hapus backup manual lama (> 30 hari)
        const backups = fs.readdirSync(SESSION_BACKUP_DIR);
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        backups.forEach(backup => {
            const backupPath = path.join(SESSION_BACKUP_DIR, backup);
            const stats = fs.statSync(backupPath);
            if (stats.mtimeMs < thirtyDaysAgo && backup.includes('manual')) {
                fs.unlinkSync(backupPath);
            }
        });
        
        return `✅ *Backup session dibuat*\n\n📁 Lokasi: \`${backupFile}\`\n⏰ Waktu: ${new Date().toLocaleString('id-ID')}`;
    } catch (e) {
        return `❌ Gagal backup: ${e.message}`;
    }
}

// Auto backup session setiap 6 jam
setInterval(() => {
    if (fs.existsSync(SESSION_FILE)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(SESSION_BACKUP_DIR, `session_auto_${timestamp}.json`);
        fs.copyFileSync(SESSION_FILE, backupFile);
        console.log(chalk.gray(`🔄 Auto backup session: ${backupFile}`));
    }
}, 6 * 60 * 60 * 1000);

// Monitor session health
async function monitorSessionHealth() {
    setInterval(async () => {
        if (sessionManager.client && sessionManager.isConnected) {
            try {
                await sessionManager.client.getMe();
                sessionManager.isConnected = true;
            } catch (e) {
                console.log(chalk.yellow('⚠️ Session health check failed:', e.message));
                sessionManager.isConnected = false;
                
                // Coba reconnect
                try {
                    await sessionManager.client.connect();
                    console.log(chalk.green('✅ Session reconnected'));
                    sessionManager.isConnected = true;
                } catch (reconnectErr) {
                    console.log(chalk.red('❌ Failed to reconnect:', reconnectErr.message));
                }
            }
        }
    }, 5 * 60 * 1000); // Cek setiap 5 menit
}

// Export untuk digunakan di file lain
module.exports = {
    sessionManager,
    loginToTelegram,
    handleSessionCommand,
    createSessionBackup,
    monitorSessionHealth
};