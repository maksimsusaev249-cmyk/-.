import express from "express";
import { createServer } from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import crypto from "crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import { google } from 'googleapis';
import AdmZip from "adm-zip";

function isValidGoogleSheetId(id: string | null | undefined): boolean {
  if (!id) return false;
  const trimmed = id.trim();
  // A valid Google Spreadsheet ID is usually 44 characters, let's enforce a length check and standard format
  return trimmed.length >= 20 && /^[a-zA-Z0-9-_]+$/.test(trimmed) && trimmed !== "∆Mr.";
}

async function appendToGoogleSheet(spreadsheetId: string, values: any[]) {
  if (!isValidGoogleSheetId(spreadsheetId)) {
    console.log(`Skipping append: "${spreadsheetId}" is not a valid Google Spreadsheet ID.`);
    return;
  }
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient as any });

  const currentYear = new Date().getFullYear().toString();
  let targetSheetName = currentYear;

  try {
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheet = sheetMeta.data.sheets?.find(s => s.properties?.title === currentYear);
    
    if (!existingSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: currentYear
              }
            }
          }]
        }
      });
    }
  } catch (err: any) {
    console.error("Failed to ensure year sheet exists, falling back to first sheet:", err.message);
    try {
      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      targetSheetName = sheetMeta.data.sheets?.[0]?.properties?.title || 'Sheet1';
    } catch(e) {
      targetSheetName = 'Sheet1';
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${targetSheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [values],
    },
  });
}

async function getGoogleSheetValues(spreadsheetId: string, range: string): Promise<any[][] | null> {
  if (!isValidGoogleSheetId(spreadsheetId)) {
    console.log(`Skipping read: "${spreadsheetId}" is not a valid Google Spreadsheet ID.`);
    return null;
  }
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient as any });
    
    let finalRange = range;
    if (range.startsWith('Sheet1!')) {
      const currentYear = new Date().getFullYear().toString();
      const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
      const existingSheet = sheetMeta.data.sheets?.find(s => s.properties?.title === currentYear);
      const targetSheetName = existingSheet ? currentYear : (sheetMeta.data.sheets?.[0]?.properties?.title || 'Sheet1');
      finalRange = range.replace('Sheet1!', `'${targetSheetName}'!`);
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: finalRange,
    });
    return res.data.values || null;
  } catch (err: any) {
    console.error(`Error reading Google Sheet values (${spreadsheetId}):`, err.message || err);
    return null;
  }
}

// Firebase Web SDK for Bot query bypass
import { initializeApp as initClientApp, getApps as getClientApps } from "firebase/app";
import { getAuth as getClientAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore as getClientFirestore, collection, query, where, limit, getDocs, doc, updateDoc, getDoc, onSnapshot, addDoc, serverTimestamp, setDoc, runTransaction } from "firebase/firestore";

// Load Firebase configuration
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } else {
    console.warn("WARNING: firebase-applet-config.json was not found in working directory!");
  }
} catch (configErr: any) {
  console.error("WARNING: Failed to read/parse firebase-applet-config.json:", configErr);
}

// Fallback to environment variables if config was not read or is incomplete
if (!firebaseConfig || !firebaseConfig.apiKey) {
  firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID || "",
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || "(default)",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  };
}

// Initialize client SDK for bot lookup to bypass IAM permissions issues
let botClientApp: any = null;
let botClientAuth: any = null;
let botClientDb: any = null;

if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    botClientApp = getClientApps().length
      ? getClientApps()[0]
      : initClientApp(firebaseConfig, "bot-client-app");
    botClientAuth = getClientAuth(botClientApp);
    botClientDb = getClientFirestore(botClientApp, firebaseConfig.firestoreDatabaseId || "(default)");
  } catch (initErr: any) {
    console.error("Failed to initialize client Firebase app:", initErr);
  }
} else {
  console.error("CRITICAL: Firebase config is empty or missing key! Core features depending on Firestore may fail.");
}

// Secure system-level bot authenticator helper to satisfy Firestore rules
async function getAuthenticatedDb() {
  if (!botClientAuth || !botClientDb) {
    console.error("Database connection properties are not configured!");
    return null;
  }
  if (botClientAuth.currentUser) {
    return botClientDb;
  }
  const botEmail = "system_bot_auth_user@telegram-clicker.game";
  const botPassword = "BotSuperSecretSystemPass123!_@";
  try {
    await signInWithEmailAndPassword(botClientAuth, botEmail, botPassword);
  } catch (err: any) {
    console.log("Firebase system bot signin failed, attempting to register system bot...", err.message || err);
    try {
      await createUserWithEmailAndPassword(botClientAuth, botEmail, botPassword);
    } catch (createErr: any) {
      if (createErr.code === "auth/email-already-in-use") {
        try {
          await signInWithEmailAndPassword(botClientAuth, botEmail, botPassword);
        } catch (retryErr) {
          console.error("Failed bot retry sign in:", retryErr);
        }
      } else {
        console.error("Failed to create system bot user:", createErr);
      }
    }
  }
  return botClientDb;
}

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    if (firebaseConfig && firebaseConfig.projectId) {
      initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin SDK initialized successfully.");
    } else {
      console.error("WARNING: firebaseConfig.projectId is missing. Cannot initialize Firebase Admin SDK.");
    }
  } catch (err) {
    console.error("Failed to initialize Firebase Admin SDK:", err);
  }
}

interface Player {
  id: string;
  name: string;
  clan: string | null;
  coins: number;
  clicks: number;
  color: string;
  lastSeen: number;
  isOnline: boolean;
  telegramId?: string | null;
  autoClickerLevel?: number;
  username?: string | null;
  sheetId?: string | null;
  notificationsEnabled?: boolean;
  clickPowerLevel?: number;
  email?: string | null;
  voiceSettings?: {
    globalAllowed?: boolean;
    disabledVoiceSenders?: string[];
  };
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  clan: string | null;
  text: string;
  timestamp: string;
  color: string;
  isClanOnly?: boolean;
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SERVER_INSTANCE_ID = crypto.randomBytes(4).toString("hex").toUpperCase();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const httpServer = createServer(app);

// Use a shared WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Connected players list in-memory
const players: Map<string, Player> = new Map();
// Latest 50 chat messages
const chatMessages: ChatMessage[] = [];

interface ClanConfig {
  name: string;
  password?: string;
  creatorId?: string;
  voiceEnabled?: boolean;
}
// Clan configs storing password details
const clansConfig: Map<string, ClanConfig> = new Map();

interface TGCodeData {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  createdAt: number;
}
const verificationCodes: Map<string, TGCodeData> = new Map();

interface ClientCodeData {
  code: string;
  telegramUser?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
    photo_url?: string;
  };
  resolved: boolean;
  createdAt: number;
}
const pendingClientCodes: Map<string, ClientCodeData> = new Map();

interface ClanWarHistoryRecord {
  winner: string;
  triggeringClan: string;
  points: { [clanName: string]: number };
  timestamp: number;
}

interface ClanWarState {
  isWarActive: boolean;
  countdownSeconds: number;
  triggeringClan: string | null;
  triggerThreshold: number;
  clanProductionScores: { [clanName: string]: number };
  clansWarPoints: { [clanName: string]: number };
  lastWarWinner: string | null;
  lastWarWinnerReward: number;
  history: ClanWarHistoryRecord[];
}

let isGameRunning = true;

let clanWarState: ClanWarState = {
  isWarActive: false,
  countdownSeconds: 0,
  triggeringClan: null,
  triggerThreshold: 10,
  clanProductionScores: {},
  clansWarPoints: {},
  lastWarWinner: null,
  lastWarWinnerReward: 5000,
  history: []
};

let clProductionSimBoost: { [clanName: string]: number } = {};

let currentMarketplaceListings: any[] = [];

async function listenToMarketplace() {
  try {
    const dbInstance = await getAuthenticatedDb();
    if (!dbInstance) {
      console.warn("[Marketplace Sync] Database not available, skipping listener.");
      return;
    }
    const marketplaceCol = collection(dbInstance, "marketplace");
    const q = query(marketplaceCol, where("status", "==", "active"));
    
    onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      // Sort items newest first
      items.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      currentMarketplaceListings = items;
      console.log(`[Marketplace Sync] Broadcasting ${items.length} active listings via WebSocket`);
      broadcast({
        type: "marketplace_update",
        data: items
      });
    }, (error) => {
      console.error("[Marketplace Sync] error in onSnapshot:", error);
    });
  } catch (err) {
    console.error("[Marketplace Sync] init failed:", err);
  }
}

let isHydrated = false;

async function syncUsersFromFirestore() {
  try {
    const dbInstance = await getAuthenticatedDb();
    if (!dbInstance) {
      console.warn("[Users Sync] Database not available, skipping hydration.");
      return;
    }
    const usersCol = collection(dbInstance, "users");
    
    console.log("[Users Sync] Subscribing to 'users' collection in Firestore 24/7...");
    onSnapshot(usersCol, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = change.doc.data();
        
        if (change.type === "added" || change.type === "modified") {
          const existing = players.get(id);
          
          players.set(id, {
            id: id,
            name: data.playerName || data.name || "Игрок",
            clan: data.playerClan || data.clan || null,
            coins: typeof data.coins === "number" ? data.coins : 0,
            clicks: typeof data.totalClicks === "number" ? data.totalClicks : (typeof data.clicks === "number" ? data.clicks : 0),
            color: existing?.color || data.color || getRandomColor(),
            lastSeen: data.lastActiveTimestamp || data.lastSeen || Date.now(),
            isOnline: existing?.isOnline ?? false,
            telegramId: data.telegramId || null,
            username: data.username || null,
            sheetId: data.sheetId || null,
            notificationsEnabled: data.notificationsEnabled !== false,
            clickPowerLevel: data.clickPowerLevel || 1,
            autoClickerLevel: typeof data.autoClickerLevel === "number" ? data.autoClickerLevel : 0
          });
        } else if (change.type === "removed") {
          players.delete(id);
        }
      });
      
      if (!isHydrated) {
        isHydrated = true;
        console.log(`[Users Sync] Initial hydration complete. Total players loaded: ${players.size}`);
      }
      
      // Update everyone with active stats and names
      broadcastPlayers();
    }, (error) => {
      console.error("[Users Sync] error in onSnapshot:", error);
    });
  } catch (err) {
    console.error("[Users Sync] Failed to initialize real-time user sync:", err);
  }
}

function ensureClanInConfig(clanName: string | null | undefined, playerId: string) {
  if (!clanName) return;
  const trimmed = clanName.trim();
  if (!trimmed) return;
  if (!clansConfig.has(trimmed)) {
    // Save to memory config assuming first seen member is the creator
    clansConfig.set(trimmed, {
      name: trimmed,
      creatorId: playerId,
      voiceEnabled: true
    });
    // Sync with Firestore
    getAuthenticatedDb().then((dbInstance) => {
      if (dbInstance) {
        const clanRef = doc(dbInstance, "clans", trimmed);
        getDoc(clanRef).then((snap) => {
          if (!snap.exists()) {
            setDoc(clanRef, {
              name: trimmed,
              creatorId: playerId,
              voiceEnabled: true
            }).catch((err) => console.error("[Ensure Clan Firestore Error]", err));
          } else {
            const data = snap.data();
            if (!data.creatorId) {
              updateDoc(clanRef, { creatorId: playerId }).catch(() => {});
            }
          }
        }).catch((err) => {
          console.error("Error checking clan doc in ensure:", err);
        });
      }
    });
  } else {
    // If it exists in clansConfig but lacks a creatorId, assign the current player
    const config = clansConfig.get(trimmed);
    if (config && !config.creatorId) {
      config.creatorId = playerId;
      clansConfig.set(trimmed, config);

      getAuthenticatedDb().then((dbInstance) => {
        if (dbInstance) {
          const clanRef = doc(dbInstance, "clans", trimmed);
          updateDoc(clanRef, { creatorId: playerId }).catch(() => {});
        }
      });
    }
  }
}

let isClansHydrated = false;

async function syncClansFromFirestore() {
  try {
    const dbInstance = await getAuthenticatedDb();
    if (!dbInstance) {
      console.warn("[Clans Sync] Database not available, skipping hydration.");
      return;
    }
    const clansCol = collection(dbInstance, "clans");
    
    console.log("[Clans Sync] Subscribing to 'clans' collection in Firestore...");
    onSnapshot(clansCol, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const name = change.doc.id;
        const data = change.doc.data();
        
        if (change.type === "added" || change.type === "modified") {
          clansConfig.set(name, {
            name: name,
            password: data.password || undefined,
            creatorId: data.creatorId || undefined,
            voiceEnabled: data.voiceEnabled !== false
          });
        } else if (change.type === "removed") {
          clansConfig.delete(name);
        }
      });
      
      if (!isClansHydrated) {
        isClansHydrated = true;
        console.log(`[Clans Sync] Initial hydration complete. Total clans loaded: ${clansConfig.size}`);
      }
      
      // Update everyone with active clan list details
      broadcastPlayers();
    }, (error) => {
      console.error("[Clans Sync] error in onSnapshot:", error);
    });
  } catch (err) {
    console.error("[Clans Sync] Failed to initialize real-time clan sync:", err);
  }
}

function broadcastClanWarState() {
  broadcast({
    type: "clan_war_update",
    data: clanWarState
  });
}

function getPlayerLevel(clicks: number) {
  let lvl = 1;
  while (clicks >= lvl * (lvl + 1) * 35) {
    lvl++;
  }
  return lvl;
}

function calculateClanProduction() {
  const scores: { [clanName: string]: number } = {};
  for (const player of players.values()) {
    if (player.clan) {
      if (!scores[player.clan]) {
        scores[player.clan] = 0;
      }
      const lvl = player.autoClickerLevel || 0;
      const cps = Math.ceil(lvl * 0.5) || 0;
      scores[player.clan] += cps;
    }
  }
  return scores;
}

// Memory-safe, instant, and double-fetch prevention lookup for Telegram players
function findSyncPlayerByTelegram(tgId: string | null | undefined, username?: string, firstName?: string) {
  if (!tgId && !username && !firstName) return null;
  const targetTgId = tgId ? String(tgId).trim() : null;
  const targetUsername = username ? String(username).toLowerCase().trim() : null;
  const targetPlayerName = firstName ? String(firstName).toLowerCase().trim() : null;
  
  for (const p of players.values()) {
    const dbTgId = p.telegramId ? String(p.telegramId).trim() : null;
    const dbUsername = p.username ? String(p.username).toLowerCase().trim() : null;
    const dbPlayerName = p.name ? String(p.name).toLowerCase().trim() : null;
    
    const isTgIdMatch = targetTgId && (dbTgId === targetTgId || dbTgId === String(Number(targetTgId)));
    const isUsernameMatch = targetUsername && dbUsername === targetUsername;
    const isPlayerNameMatch = targetPlayerName && dbPlayerName === targetPlayerName;

    if (isTgIdMatch || isUsernameMatch || isPlayerNameMatch) {
      return p;
    }
  }
  return null;
}

// Helper to broadcast data to all active websockets
function broadcast(data: any) {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function getClansPrivacyList() {
  return Array.from(clansConfig.entries()).map(([name, c]) => ({
    name,
    isPrivate: !!c.password,
    creatorId: c.creatorId,
    voiceEnabled: c.voiceEnabled !== false
  }));
}

function broadcastPlayers() {
  const playersList = Array.from(players.values()).map(p => ({
    ...p,
    isAdmin: isAdminId(p.id),
    isModerator: isModeratorId(p.id)
  }));
  broadcast({
    type: "players_update",
    data: {
      players: playersList,
      clanPrivacy: getClansPrivacyList()
    }
  });
}

// Color palettes for players in chat
const PLAYER_COLORS = [
  "#e67e22", // orange
  "#2ecc71", // green
  "#3498db", // blue
  "#9b59b6", // purple
  "#f1c40f", // yellow
  "#e74c3c", // red
  "#1abc9c", // turquoise
  "#fd79a8", // pink
  "#ffeaa7", // warm yellow
  "#a8e6cf", // mint
];

function getRandomColor() {
  return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

// Websocket logic
wss.on("connection", (ws: WebSocket) => {
  let connectedPlayerId: string | null = null;

  ws.on("message", (message: string) => {
    try {
      const event = JSON.parse(message);
      
      switch (event.type) {
        case "register": {
          const { id, name, clan, coins, clicks, color, telegramId, autoClickerLevel, email, whitelistApproved } = event.data;
          
          const proceedRegistration = () => {
            // If the socket was previously attached to a different ID (like a guest ID), remove it to prevent duplicates
            if (connectedPlayerId && connectedPlayerId !== id) {
              players.delete(connectedPlayerId);
            }
            
            connectedPlayerId = id;
            
            // Tag socket for connection checks
            (ws as any).playerId = id;
            (ws as any).clan = clan || null;
            (ws as any).telegramId = telegramId || null;
            
            const existingColor = players.get(id)?.color || color || getRandomColor();
            
            players.set(id, {
              id,
              name: name || "Игрок",
              clan: clan || null,
              coins: typeof coins === "number" ? coins : 0,
              clicks: typeof clicks === "number" ? clicks : 0,
              color: existingColor,
              lastSeen: Date.now(),
              isOnline: true,
              telegramId: telegramId || null,
              autoClickerLevel: typeof autoClickerLevel === "number" ? autoClickerLevel : 0,
              email: email || null,
              voiceSettings: players.get(id)?.voiceSettings || {
                globalAllowed: true,
                disabledVoiceSenders: []
              }
            });

            // Log in Google Sheets if applicable
            if (telegramId) {
              const matchedPlayer = findSyncPlayerByTelegram(telegramId);
              if (matchedPlayer && matchedPlayer.sheetId) {
                appendToGoogleSheet(matchedPlayer.sheetId, [id, name, coins, clicks, new Date().toISOString()]);
              }
            }

            // Send initial state: entire active player list and chat history and clan wars info
            ws.send(JSON.stringify({
              type: "init",
              data: {
                players: Array.from(players.values()).filter(p => p.isOnline),
                chatHistory: chatMessages,
                assignedColor: existingColor,
                clanPrivacy: getClansPrivacyList(),
                clanWarState: clanWarState,
                marketplaceListings: currentMarketplaceListings,
                instanceId: SERVER_INSTANCE_ID,
              },
            }));

            // Notify everyone about the updated list
            broadcastPlayers();
          };

          // Google Sheets Whitelist Verification
          if (masterSheetId && !whitelistApproved) {
            getGoogleSheetValues(masterSheetId, 'Sheet1!A1:Z550').then((values) => {
              if (values) {
                const flatValues = values.flat().filter(Boolean).map(v => String(v).trim().toLowerCase());
                
                // Whitelist terms to search
                const termsToCheck = [
                  id,
                  telegramId ? String(telegramId).trim() : null,
                  email ? String(email).trim().toLowerCase() : null,
                  name ? String(name).trim().toLowerCase() : null
                ].filter(Boolean) as string[];

                // If any of the user's details matches any value (or substring) in the sheet's raw values, allow them!
                const isWhitelisted = flatValues.some((cellVal) => {
                  return termsToCheck.some(term => {
                    return cellVal === term || cellVal.includes(term) || term.includes(cellVal);
                  });
                });

                if (!isWhitelisted) {
                  console.log(`Whitelist REJECTED for User: ${name} (ID: ${id}, TgID: ${telegramId}, Email: ${email})`);
                  ws.send(JSON.stringify({
                    type: "whitelist_rejected",
                    data: { message: "Доступ ограничен! Вы не добавлены в белый список (Google Таблица)." }
                  }));
                  return;
                }
              }
              proceedRegistration();
            }).catch((err) => {
              console.error("Whitelist check failed due to error, permitting player by fallback:", err);
              proceedRegistration();
            });
          } else {
            proceedRegistration();
          }
          break;
        }

        case "status_update": {
          const { id, name, clan, coins, clicks, telegramId, autoClickerLevel } = event.data;
          const player = players.get(id);
          if (player) {
            player.name = name || player.name;
            player.clan = clan || null;
            if (clan) {
              ensureClanInConfig(clan, id);
            }
            player.coins = typeof coins === "number" ? coins : player.coins;
            player.clicks = typeof clicks === "number" ? clicks : player.clicks;
            player.lastSeen = Date.now();
            player.telegramId = telegramId || player.telegramId;
            if (typeof autoClickerLevel === "number") {
              player.autoClickerLevel = autoClickerLevel;
            }
            
            players.set(id, player);
            
            // Keep socket properties in sync
            if (id === connectedPlayerId) {
              (ws as any).clan = clan || null;
              (ws as any).telegramId = telegramId || (ws as any).telegramId;
            }
            
            // Broadcast changes
            broadcastPlayers();
          }
          break;
        }

        case "click_action": {
          // A player clicked! Let's broadcast a small visual click effect event to make it feel super interactive
          const { id, power } = event.data;
          const player = players.get(id);
          if (player) {
            player.clicks += 1;
            player.coins += power;
            player.lastSeen = Date.now();
            players.set(id, player);

            broadcast({
              type: "player_clicked",
              data: {
                id,
                name: player.name,
                clan: player.clan,
                power,
                color: player.color,
                timestamp: Date.now(),
              },
            });

            // Periodically broadcast the aggregated players update to ensure counts match
            broadcastPlayers();
          }
          break;
        }

        case "clan_war_click": {
          const { playerId, pointsContribution } = event.data;
          const p = players.get(playerId);
          if (p && p.clan && clanWarState.isWarActive) {
            if (!clanWarState.clansWarPoints[p.clan]) {
              clanWarState.clansWarPoints[p.clan] = 0;
            }
            clanWarState.clansWarPoints[p.clan] += (pointsContribution || 1);
            
            // Reward some coins for active participation in clan wars!
            p.coins += (pointsContribution || 1);
            p.clicks += 1;
            players.set(playerId, p);
            
            // Save to Cloud Firestore so progress matches instantly and doesn't get lost
            getAuthenticatedDb().then((dbInstance) => {
              const userRef = doc(dbInstance, "users", playerId);
              updateDoc(userRef, {
                coins: p.coins,
                totalClicks: p.clicks,
                updatedAt: new Date()
              }).catch((err) => {
                console.error(`[War Click Doc Fail] Could not update user ${playerId} doc:`, err);
              });
            }).catch((err) => {
              console.error("[War Click DB Fail] Could not obtain DB instance:", err);
            });

            broadcastPlayers();
            broadcastClanWarState();
          }
          break;
        }

        case "clan_war_boost_simulation": {
          const { clanName, amount } = event.data;
          if (clanName) {
            clProductionSimBoost[clanName] = (clProductionSimBoost[clanName] || 0) + (amount || 5);
            broadcastClanWarState();
          }
          break;
        }

        case "chat_msg": {
          const { playerId: senderId, text, isClanOnly, voiceData, voiceDuration } = event.data;
          const player = players.get(senderId);
          if (player && ((text && text.trim()) || voiceData)) {
            // Check time restriction if sending voice to global lobby
            if (voiceData && !isClanOnly) {
              const moscowHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Moscow" })).getHours();
              if (!isHourInInterval(moscowHour, voiceStartHour, voiceEndHour)) {
                ws.send(JSON.stringify({
                  type: "chat_msg_error",
                  data: { error: `Голосовые сообщения в общем чате разрешены только с ${voiceStartHour}:00 до ${voiceEndHour}:00 по МСК!` }
                }));
                break;
              }
            }

            const timeStr = new Date().toLocaleTimeString("ru-RU", {
              timeZone: "Europe/Moscow",
              hour: "2-digit",
              minute: "2-digit",
            });

            const newMsg: any = {
              id: Math.random().toString(36).substring(2, 9),
              playerId: senderId,
              playerName: player.name,
              clan: player.clan,
              text: text ? text.substring(0, 150).trim() : "[Голосовое сообщение]",
              timestamp: timeStr,
              color: player.color,
              isClanOnly: !!isClanOnly,
              voiceData: voiceData || null,
              voiceDuration: typeof voiceDuration === "number" ? voiceDuration : null,
            };

            if (isClanOnly) {
              // Send ONLY to players of the exact same clan
              const playerClan = player.clan;
              if (playerClan) {
                const payload = JSON.stringify({
                  type: "chat_msg_broadcast",
                  data: newMsg,
                });
                wss.clients.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN && (client as any).clan === playerClan) {
                    client.send(payload);
                  }
                });
              }
            } else {
              // Standard Lobby msg
              chatMessages.push(newMsg);
              if (chatMessages.length > 50) {
                chatMessages.shift();
              }

              broadcast({
                type: "chat_msg_broadcast",
                data: newMsg,
              });

              // Process mentions (@all or specific players) in global chat for Telegram notifications
              const textContent = newMsg.text || "";
              const mentionRegex = /@([\w\u0400-\u04FF]+)/g;
              const matches = textContent.match(mentionRegex);
              if (matches && matches.length > 0) {
                const mentions = matches.map(m => m.substring(1).toLowerCase());
                const isMentionAll = mentions.some(m => ["all", "все", "всем", "everyone"].includes(m));

                if (isMentionAll) {
                  // Notify everyone who has linked their Telegram/VK (except the sender)
                  players.forEach((p) => {
                    if (p.id !== senderId && p.telegramId) {
                      const isVkTarget = (p.email && String(p.email).startsWith("vk_")) || 
                                         (p.username && String(p.username).startsWith("vk_")) ||
                                         String(p.id).startsWith("vk_");
                      if (isVkTarget) {
                        sendVkMessage(
                          Number(p.telegramId),
                          `📣 *Всеобщее упоминание от ${player.name} в чате:*\n\n"${textContent}"`
                        ).catch(err => console.error(`Failed to send VK @all notification to ${p.name}:`, err));
                      } else {
                        sendCleanBotMessage(
                          Number(p.telegramId),
                          `📣 *Всеобщее упоминание от ${player.name} в чате:* \n\n"${textContent}"`,
                          {
                            keepHistory: true,
                            reply_markup: {
                              inline_keyboard: [
                                [
                                  { text: "❌ Удалить", callback_data: "delete_this" },
                                  { text: "🧹 Удалить все", callback_data: "delete_all" }
                                ]
                              ]
                            }
                          }
                        ).catch(err => console.error(`Failed to send @all notification to ${p.name}:`, err));
                      }
                    }
                  });
                } else {
                  // Notify specific mentioned players
                  players.forEach((p) => {
                    if (p.id !== senderId && p.telegramId) {
                      const nameLower = p.name ? p.name.toLowerCase() : "";
                      const usernameLower = p.username ? p.username.toLowerCase() : "";
                      const firstWordOfName = nameLower.split(/\s+/)[0];

                      const isMatched = mentions.some(m => 
                        nameLower === m || 
                        usernameLower === m || 
                        firstWordOfName === m
                      );

                      if (isMatched) {
                        const isVkTarget = (p.email && String(p.email).startsWith("vk_")) || 
                                           (p.username && String(p.username).startsWith("vk_")) ||
                                           String(p.id).startsWith("vk_");
                        if (isVkTarget) {
                          sendVkMessage(
                            Number(p.telegramId),
                            `🔔 *Вас упомянул ${player.name} в общем чате:*\n\n"${textContent}"`
                          ).catch(err => console.error(`Failed to send VK mention notification to ${p.name}:`, err));
                        } else {
                          sendCleanBotMessage(
                            Number(p.telegramId),
                            `🔔 *Вас упомянул ${player.name} в общем чате:* \n\n"${textContent}"`,
                            {
                              keepHistory: true,
                              reply_markup: {
                                inline_keyboard: [
                                  [
                                    { text: "❌ Удалить", callback_data: "delete_this" },
                                    { text: "🧹 Удалить все", callback_data: "delete_all" }
                                  ]
                                ]
                              }
                            }
                          ).catch(err => console.error(`Failed to send mention notification to ${p.name}:`, err));
                        }
                      }
                    }
                  });
                }
              }
            }
          }
          break;
        }

        case "delete_chat_msg": {
          const { playerId, messageId } = event.data;
          const player = players.get(playerId);
          if (player && (isAdminId(playerId) || isModeratorId(playerId))) {
            const payload = JSON.stringify({
              type: "delete_chat_msg_broadcast",
              data: { messageId }
            });
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
              }
            });
          }
          break;
        }

        case "direct_msg": {
          const senderId = (ws as any).playerId;
          const { recipientId, text, voiceData, voiceDuration } = event.data;
          if (!senderId) {
            console.warn("[DirectMsg Fail] Sender socket is not registered!");
            break;
          }
          const player = players.get(senderId);
          if (player && ((text && text.trim()) || voiceData) && recipientId && recipientId !== "undefined" && recipientId !== "null") {
            const recipient = players.get(recipientId);
            
            // Check if recipient has blocked voice messages from sender
            if (voiceData && recipient) {
              const disabledSenders = recipient.voiceSettings?.disabledVoiceSenders || [];
              if (disabledSenders.includes(senderId)) {
                ws.send(JSON.stringify({
                  type: "direct_msg_error",
                  data: { recipientId, error: "Собеседник ограничил получение голосовых сообщений от вас." }
                }));
                break;
              }
            }

            const timeStr = new Date().toLocaleTimeString("ru-RU", {
              timeZone: "Europe/Moscow",
              hour: "2-digit",
              minute: "2-digit",
            });

            const newMsg = {
              id: Math.random().toString(36).substring(2, 9),
              senderId: senderId,
              senderName: player.name,
              recipientId: recipientId,
              text: text ? text.substring(0, 150).trim() : "[Голосовое сообщение]",
              timestamp: timeStr,
              color: player.color,
              voiceData: voiceData || null,
              voiceDuration: typeof voiceDuration === "number" ? voiceDuration : null,
            };

            const payload = JSON.stringify({
              type: "direct_msg_broadcast",
              data: newMsg
            });

            // Deliver to recipient socket if online and track if they have an active connection
            let hasActiveSocket = false;
            wss.clients.forEach((client) => {
              const clientPlayerId = (client as any).playerId;
              if (
                client.readyState === WebSocket.OPEN && 
                clientPlayerId && 
                clientPlayerId === recipientId
              ) {
                client.send(payload);
                hasActiveSocket = true;
              }
            });
 
            // Deliver back to sender socket
            ws.send(payload);
 
             // Notify recipient via Telegram or VK if offline (no active websocket socket open)
             if (recipient && recipient.telegramId && !hasActiveSocket) {
               const isVkRecipient = (recipient.email && String(recipient.email).startsWith("vk_")) || 
                                     (recipient.username && String(recipient.username).startsWith("vk_")) ||
                                     String(recipient.id).startsWith("vk_");
               
               if (isVkRecipient) {
                 const vkMessageText = `📩 *Новое личное сообщение от ${player.name}:*\n\n${newMsg.text}`;
                 sendVkMessage(Number(recipient.telegramId), vkMessageText).catch(err => 
                   console.error(`Failed to send VK DM notification to ${recipient.name}:`, err)
                 );
               } else {
                 sendCleanBotMessage(
                   Number(recipient.telegramId), 
                   `📩 *Новое личное сообщение от ${player.name}:*\n\n${newMsg.text}`,
                   {
                      keepHistory: true,
                      reply_markup: {
                        inline_keyboard: [
                          [
                            { text: "❌ Удалить это сообщение", callback_data: "delete_this" },
                            { text: "🧹 Удалить все уведомления", callback_data: "delete_all" }
                          ]
                        ]
                      }
                    }
                 );
               }
             }
          }
          break;
        }

        case "create_clan": {
          const { id, name, password, voiceEnabled } = event.data;
          const trimmedName = (name || "").trim();
          const player = players.get(id);
          if (trimmedName && player) {
            getAuthenticatedDb().then((dbInstance) => {
              if (dbInstance) {
                const clanRef = doc(dbInstance, "clans", trimmedName);
                setDoc(clanRef, {
                  name: trimmedName,
                  password: password ? password.trim() : "",
                  creatorId: id,
                  voiceEnabled: voiceEnabled !== false
                }, { merge: true }).catch((err) => {
                  console.error("[Create Clan Firestore Error]", err);
                });
              }
            });

            clansConfig.set(trimmedName, {
              name: trimmedName,
              password: password ? password.trim() : undefined,
              creatorId: id,
              voiceEnabled: voiceEnabled !== false
            });
            player.clan = trimmedName;
            players.set(id, player);

            if (id === connectedPlayerId) {
              (ws as any).clan = trimmedName;
            }

            ws.send(JSON.stringify({
              type: "create_clan_res",
              data: { success: true, clan: trimmedName }
            }));

            broadcastPlayers();
          } else {
            ws.send(JSON.stringify({
              type: "create_clan_res",
              data: { success: false, error: "Некорректное имя клана!" }
            }));
          }
          break;
        }

        case "join_clan": {
          const { id, clanName, password } = event.data;
          const player = players.get(id);
          if (player && clanName) {
            const config = clansConfig.get(clanName);
            if (config && config.password) {
              if (config.password !== (password || "").trim()) {
                ws.send(JSON.stringify({
                  type: "join_clan_res",
                  data: { success: false, error: "Неверный пароль клана! Попробуйте еще раз." }
                }));
                break;
              }
            }
            if (!config) {
              getAuthenticatedDb().then((dbInstance) => {
                if (dbInstance) {
                  const clanRef = doc(dbInstance, "clans", clanName);
                  setDoc(clanRef, {
                    name: clanName,
                    creatorId: id,
                    voiceEnabled: true
                  }, { merge: true }).catch((err) => {
                    console.error("[Join Clan New Config Firestore Error]", err);
                  });
                }
              });

              clansConfig.set(clanName, { 
                name: clanName,
                creatorId: id,
                voiceEnabled: true
              });
            }

            player.clan = clanName;
            players.set(id, player);

            if (id === connectedPlayerId) {
              (ws as any).clan = clanName;
            }

            ws.send(JSON.stringify({
              type: "join_clan_res",
              data: { success: true, clan: clanName }
            }));

            broadcastPlayers();
          } else {
            ws.send(JSON.stringify({
              type: "join_clan_res",
              data: { success: false, error: "Ошибка при вступлении в клан!" }
            }));
          }
          break;
        }

        case "update_clan_voice": {
          const { clanName, voiceEnabled, playerId } = event.data;
          let config = clansConfig.get(clanName);
          if (!config) {
            config = {
              name: clanName,
              creatorId: playerId,
              voiceEnabled: voiceEnabled !== false
            };
            clansConfig.set(clanName, config);
          }
          if (!config.creatorId) {
            config.creatorId = playerId;
            clansConfig.set(clanName, config);
          }
          
          if (config.creatorId === playerId) {
            config.voiceEnabled = voiceEnabled;
            clansConfig.set(clanName, config);

            getAuthenticatedDb().then((dbInstance) => {
              if (dbInstance) {
                const clanRef = doc(dbInstance, "clans", clanName);
                setDoc(clanRef, {
                  name: clanName,
                  creatorId: config.creatorId,
                  voiceEnabled: voiceEnabled
                }, { merge: true }).catch((err) => {
                  console.error("[Update Clan Voice Firestore Error]", err);
                });
              }
            });

            broadcastPlayers();
          }
          break;
        }

        case "leave_clan": {
          const { id } = event.data;
          const player = players.get(id);
          if (player) {
            player.clan = null;
            players.set(id, player);

            if (id === connectedPlayerId) {
              (ws as any).clan = null;
            }

            ws.send(JSON.stringify({
              type: "leave_clan_res",
              data: { success: true }
            }));

            broadcastPlayers();
          }
          break;
        }

        case "update_voice_privacy": {
          const { playerId, disabledVoiceSenders } = event.data;
          const player = players.get(playerId);
          if (player) {
            player.voiceSettings = {
              globalAllowed: true,
              disabledVoiceSenders: Array.isArray(disabledVoiceSenders) ? disabledVoiceSenders : []
            };
            players.set(playerId, player);
            broadcastPlayers();
          }
          break;
        }

        case "ping": {
          ws.send(JSON.stringify({ type: "pong" }));
          break;
        }

        case "register_admin_code": {
          const { code, playerId } = event.data || {};
          if (code && playerId) {
            adminVerificationCodes.set(String(code).trim(), String(playerId).trim());
            // Expire code after 5 minutes
            setTimeout(() => {
              if (adminVerificationCodes.get(String(code).trim()) === String(playerId).trim()) {
                adminVerificationCodes.delete(String(code).trim());
              }
            }, 5 * 60 * 1000);
          }
          break;
        }
      }
    } catch (err) {
      console.error("Failed to parse websocket message:", err);
    }
  });

  ws.on("close", () => {
    if (connectedPlayerId) {
      const player = players.get(connectedPlayerId);
      if (player) {
        // Safe check: If it's a transient guest player ID (length < 15), remove entirely from memory map upon disconnect
        if (connectedPlayerId.length < 15) {
          players.delete(connectedPlayerId);
        } else {
          player.isOnline = false;
          player.lastSeen = Date.now();
          players.set(connectedPlayerId, player);
        }
      }
      broadcastPlayers();
    }
  });
});

// Setup Upgrade path routing hook for standard websockets
httpServer.on("upgrade", (request, socket, head) => {
  try {
    const urlString = request.url || "";
    const pathname = urlString.split('?')[0];
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else if (process.env.NODE_ENV === "production") {
      socket.destroy();
    }
  } catch (err) {
    console.error("Upgrade error:", err);
    socket.destroy();
  }
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8629175241:AAE4T1QAns_SqkCMXnGRI-_mRHqChzET8p4";
const VK_BOT_TOKEN = process.env.VK_BOT_TOKEN || "";
const VK_GROUP_ID = process.env.VK_GROUP_ID || "";

const CONFIG_FILE = path.join(process.cwd(), "sheet_config.json");
let masterSheetId = "1p0G1C7BSjbIJKlDZgykDpRrMK4vg1hqoMC2pTKZwcoQ";
let admins: string[] = [];
let moderators: string[] = [];
let whitelistEnabled: boolean = true;
let whitelistCodes: string[] = ["777777", "123456", "000000", "111111", "999999", "666666", "222222", "333333"];
let voiceStartHour = 22;
let voiceEndHour = 7;

const adminVerificationCodes = new Map<string, string>();

function isAdminId(id: string | null | undefined): boolean {
  if (!id) return false;
  const target = id.toLowerCase().trim();
  if (admins.some(a => a.toLowerCase().trim() === target)) return true;
  
  // Also check if id is a player ID (Firebase UID) with a linked telegramId that matches
  const p = players.get(id);
  if (p) {
    if (p.telegramId) {
      const tgTarget = String(p.telegramId).toLowerCase().trim();
      if (admins.some(a => a.toLowerCase().trim() === tgTarget)) return true;
    }
    // Hardcode project owner as admin if email matches
    if (p.email === "maksimsusaev249@gmail.com") return true;
  }
  return false;
}

function isModeratorId(id: string | null | undefined): boolean {
  if (!id) return false;
  const target = id.toLowerCase().trim();
  if (moderators.some(m => m.toLowerCase().trim() === target)) return true;

  // Also check if id is a player ID (Firebase UID) with a linked telegramId that matches
  const p = players.get(id);
  if (p && p.telegramId) {
    const tgTarget = String(p.telegramId).toLowerCase().trim();
    if (moderators.some(m => m.toLowerCase().trim() === tgTarget)) return true;
  }
  return false;
}

function isHourInInterval(hour: number, start: number, end: number) {
  if (start <= end) {
    return hour >= start && hour < end;
  } else {
    return hour >= start || hour < end;
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      masterSheetId = data.masterSheetId || "1p0G1C7BSjbIJKlDZgykDpRrMK4vg1hqoMC2pTKZwcoQ";
      admins = data.admins || [];
      moderators = data.moderators || [];
      if (typeof data.whitelistEnabled === "boolean") {
        whitelistEnabled = data.whitelistEnabled;
      }
      if (data.whitelistCodes && Array.isArray(data.whitelistCodes)) {
        whitelistCodes = data.whitelistCodes;
      }
      if (typeof data.voiceStartHour === "number") {
        voiceStartHour = data.voiceStartHour;
      }
      if (typeof data.voiceEndHour === "number") {
        voiceEndHour = data.voiceEndHour;
      }
    }
  } catch (e) {
    console.error("Failed to read sheet config:", e);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify({ masterSheetId, admins, moderators, whitelistEnabled, whitelistCodes, voiceStartHour, voiceEndHour }, null, 2),
      "utf8"
    );
  } catch (e) {
    console.error("Failed to write sheet config:", e);
  }
}

loadConfig();

// Verification helper for Telegram Mini App initData
function verifyTelegramWebappSignature(token: string, initData: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    const keys = Array.from(params.keys())
      .filter((k) => k !== "hash")
      .sort();

    const dataCheckString = keys.map((key) => `${key}=${params.get(key)}`).join("\n");

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(token)
      .digest();

    const actualHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return actualHash === hash;
  } catch (error) {
    console.error("Error in verifyTelegramWebappSignature:", error);
    return false;
  }
}

// Verification helper for Telegram Login Widget
function verifyTelegramWidgetSignature(token: string, user: any): boolean {
  try {
    const hash = user.hash;
    if (!hash) return false;

    const dataCheckArr: string[] = [];
    const keys = Object.keys(user).filter((k) => k !== "hash").sort();
    for (const key of keys) {
      if (user[key] !== undefined && user[key] !== null) {
        dataCheckArr.push(`${key}=${user[key]}`);
      }
    }
    const dataCheckString = dataCheckArr.join("\n");

    const secretKey = crypto.createHash("sha256").update(token).digest();

    const actualHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    return actualHash === hash;
  } catch (error) {
    console.error("Error in verifyTelegramWidgetSignature:", error);
    return false;
  }
}

interface BotChatState {
  lastBotMessageId?: number;
  sentMessageIds?: number[];
  lastNotificationText?: string;
  supportMode?: boolean;
  supportDraft?: string[];
  keyboardPage?: number;
}
const botChatStates = new Map<number, BotChatState>();

async function getBotChatState(chatId: number): Promise<BotChatState> {
  let state = botChatStates.get(chatId);
  if (state) {
    if (!state.sentMessageIds || !Array.isArray(state.sentMessageIds)) {
      state.sentMessageIds = [];
    }
    return state;
  }
  try {
    const dbInstance = await getAuthenticatedDb();
    if (dbInstance) {
      const docRef = doc(dbInstance, "bot_chat_states", String(chatId));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as BotChatState;
        if (!data.sentMessageIds || !Array.isArray(data.sentMessageIds)) {
          data.sentMessageIds = [];
        }
        botChatStates.set(chatId, data);
        return data;
      }
    }
  } catch (err) {
    console.error("Error loading bot chat state from Firestore:", err);
  }
  const newState: BotChatState = { sentMessageIds: [] };
  botChatStates.set(chatId, newState);
  return newState;
}

async function saveBotChatState(chatId: number, state: BotChatState) {
  botChatStates.set(chatId, state);
  try {
    const dbInstance = await getAuthenticatedDb();
    if (dbInstance) {
      const docRef = doc(dbInstance, "bot_chat_states", String(chatId));
      await setDoc(docRef, state, { merge: true });
    }
  } catch (err) {
    console.error("Error saving bot chat state to Firestore:", err);
  }
}

function isStaff(chatId: string | number): boolean {
  const sId = String(chatId);
  return isAdminId(sId) || isModeratorId(sId);
}

function getKeyboardForUser(chatId: number, page: number = 1) {
  if (!isStaff(chatId)) {
    return {
      keyboard: [
        [{ text: "🎮 Играть!" }],
        [{ text: "👤 Мой Профиль" }, { text: "💾 Сохранить прогресс" }],
        [{ text: "🔑 Код для входа" }, { text: "🔔 Последнее уведомление" }],
        [{ text: "🧹 Очистить чат" }, { text: "💬 Поддержка" }],
        [{ text: "📊 Таблица" }, { text: "❓ Справка" }, { text: "👥 Персонал" }]
      ],
      resize_keyboard: true
    };
  }

  if (page === 2) {
    return {
      keyboard: [
        [{ text: "👥 Персонал" }, { text: "➕ Добавить админа" }],
        [{ text: "🛠️ Добавить модера" }, { text: "➖ Исключить кого-то" }],
        [{ text: "⚙️ Настройки Таблицы" }, { text: "👑 Как зайти в Админку?" }],
        [{ text: "⬅️ Меню Игрока" }]
      ],
      resize_keyboard: true
    };
  }

  return {
    keyboard: [
      [{ text: "🎮 Играть!" }],
      [{ text: "👤 Мой Профиль" }, { text: "💾 Сохранить прогресс" }],
      [{ text: "🔑 Код для входа" }, { text: "🔔 Последнее уведомление" }],
      [{ text: "🧹 Очистить чат" }, { text: "💬 Поддержка" }],
      [{ text: "📊 Таблица" }, { text: "❓ Справка" }, { text: "👥 Персонал" }],
      [{ text: "➡️ Админ-Меню" }]
    ],
    resize_keyboard: true
  };
}

// Default application layout custom main menu keyboard
const DEFAULT_KEYBOARD = {
  keyboard: [
    [
      { text: "🎮 Играть!" }
    ],
    [
      { text: "👤 Мой Профиль" },
      { text: "💾 Сохранить прогресс" }
    ],
    [
      { text: "🔑 Код для входа" },
      { text: "🔔 Последнее уведомление" }
    ],
    [
      { text: "🧹 Очистить чат" },
      { text: "💬 Поддержка" }
    ],
    [
      { text: "📊 Таблица" },
      { text: "❓ Справка" }
    ]
  ],
  resize_keyboard: true
};

async function deleteMessageSafe(chatId: number, messageId: number) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId
      })
    });
    // Remove from in-memory tracking as well
    const state = await getBotChatState(chatId);
    if (state) {
      let changed = false;
      if (state.sentMessageIds && state.sentMessageIds.includes(messageId)) {
        state.sentMessageIds = state.sentMessageIds.filter(id => id !== messageId);
        changed = true;
      }
      if (state.lastBotMessageId === messageId) {
        delete state.lastBotMessageId;
        changed = true;
      }
      if (changed) {
        await saveBotChatState(chatId, state);
      }
    }
  } catch (err) {
    // Ignore errors from missing permission or message already deleted
  }
}

async function sendCleanBotMessage(chatId: number, text: string, options: any = {}): Promise<any> {
  const state = await getBotChatState(chatId);
  if (!state.sentMessageIds) {
    state.sentMessageIds = [];
  }

  // Auto clean up old single message if we are not keeping history info
  if (state.lastBotMessageId && !options.keepHistory) {
    await deleteMessageSafe(chatId, state.lastBotMessageId);
  }

  // Cache notification content if it contains transaction details, message texts, etc.
  const isNotification = !!(options.keepHistory || text.includes("Сохранено") || text.includes("уведомление") || text.includes("сообщение") || text.includes("Прогресс"));
  if (isNotification) {
    state.lastNotificationText = text;
  }

  // Default to standard main menu keyboard if no customized reply_markup is passed in
  let finalReplyMarkup = options.reply_markup;
  if (finalReplyMarkup === undefined || finalReplyMarkup === DEFAULT_KEYBOARD) {
    const page = state.keyboardPage || 1;
    finalReplyMarkup = getKeyboardForUser(chatId, page);
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode || "Markdown",
        reply_markup: finalReplyMarkup,
        ...options
      })
    });
    const json = await res.json();
    if (json && json.ok && json.result) {
      const messageId = json.result.message_id;
      if (!options.keepHistory) {
        state.lastBotMessageId = messageId;
      }
      if (!state.sentMessageIds.includes(messageId)) {
        state.sentMessageIds.push(messageId);
      }
      await saveBotChatState(chatId, state);
      return json;
    }
  } catch (err) {
    console.error("Error sending clean bot message:", err);
  }
  return null;
}

const VK_DEFAULT_KEYBOARD = JSON.stringify({
  one_time: false,
  buttons: [
    [{ action: { type: "text", label: "🎮 Играть!" }, color: "positive" }]
  ]
});

async function sendVkMessage(peer_id: number, message: string, opts?: any) {
  try {
    const params = new URLSearchParams();
    params.set("peer_id", String(peer_id));
    params.set("message", message);
    params.set("random_id", String(Math.floor(Math.random() * 2000000000)));
    params.set("keyboard", opts?.keyboard || VK_DEFAULT_KEYBOARD);
    params.set("access_token", VK_BOT_TOKEN);
    params.set("v", "5.199");
    const resp = await fetch("https://api.vk.com/method/messages.send", { method: "POST", body: params });
    const data = await resp.json();
    console.log("VK response:", JSON.stringify(data));
  } catch(e) {
    console.error("VK msg error", e);
  }
}

async function startVkBotPolling() {
  if (!VK_BOT_TOKEN || !VK_GROUP_ID) return;
  console.log("Starting VK Bot Polling loop...");

  let vkLongPollVars = { server: "", key: "", ts: "" };
  try {
    const res = await fetch(`https://api.vk.com/method/groups.getLongPollServer?group_id=${VK_GROUP_ID}&access_token=${VK_BOT_TOKEN}&v=5.199`);
    const data = await res.json();
    if (data.response) vkLongPollVars = data.response;
  } catch(e) {}

  while (true) {
    try {
      if (!vkLongPollVars.server) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      const response = await fetch(`${vkLongPollVars.server}?act=a_check&key=${vkLongPollVars.key}&ts=${vkLongPollVars.ts}&wait=25`);
      const data = await response.json();
      
      if (data.failed) {
        const res = await fetch(`https://api.vk.com/method/groups.getLongPollServer?group_id=${VK_GROUP_ID}&access_token=${VK_BOT_TOKEN}&v=5.199`);
        const initData = await res.json();
        if (initData.response) vkLongPollVars = initData.response;
        continue;
      }
      vkLongPollVars.ts = data.ts;

      if (data.updates && data.updates.length > 0) {
        for (const update of data.updates) {
          if (update.type === "message_new" && update.object && update.object.message) {
            const msg = update.object.message;
            const peer_id = msg.peer_id;
            const text = (msg.text || "").trim();
            const from_id = msg.from_id;
            
            let mappedText = text;
            if (text === "🎮 Играть!") mappedText = "/play";
            else if (text === "👤 Мой Профиль") mappedText = "/profile";
            else if (text === "🔑 Код для входа") mappedText = "/code";
            else if (text === "🔔 Последнее уведомление") mappedText = "/last_notification";
            else if (text === "💾 Сохранить прогресс") mappedText = "/save";
            else if (text === "🧹 Очистить чат") mappedText = "/clear_chat";
            else if (text === "💬 Поддержка") mappedText = "/support";
            else if (text === "❓ Справка") mappedText = "/aide";
            else if (text === "📊 Таблица" || text.toLowerCase() === "таблица") mappedText = "/table";

            const upperMappedText = mappedText.toUpperCase();
            let potentialCode = "";
            if (upperMappedText.length === 6 && /^[A-Z0-9]{6}$/.test(upperMappedText)) {
              potentialCode = upperMappedText;
            }

            if (potentialCode) {
              if (pendingClientCodes.has(potentialCode)) {
                const codeData = pendingClientCodes.get(potentialCode)!;
                codeData.telegramUser = { id: String(from_id), username: `vk_${from_id}`, first_name: "VK", last_name: "Игрок" };
                codeData.resolved = true;
                await sendVkMessage(peer_id, "⏳ Секунду...");
                await new Promise((resolve) => setTimeout(resolve, 5000));
                
                let statsLine = "";
                Array.from(players.values()).forEach((p) => {
                  if (p.telegramId === String(from_id) || p.username === `vk_${from_id}`) {
                    statsLine = `📊 Ваш Аккаунт:\nУровень: ${p.clicks}\nМонеты: ${p.coins} 💰\n\n`;
                  }
                });
                await sendVkMessage(peer_id, `ура вы подключены, теперь у вас доступ к уведомлениям! 🎮\n\n${statsLine}✨ Ваш игровой профиль успешно синхронизирован!`);
              }
            } else if (mappedText.toLowerCase() === "/code" || mappedText.toLowerCase() === "войти" || mappedText.toLowerCase() === "login" || mappedText.toLowerCase() === "начать") {
              const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
              let code = "";
              for (let i = 0; i < 6; i++) code += characters.charAt(Math.floor(Math.random() * characters.length));
              verificationCodes.set(code, {
                id: String(from_id),
                username: `vk_${from_id}`,
                first_name: "Игрок",
                last_name: "VK",
                photo_url: "",
                createdAt: Date.now()
              });
              const codeMessage = `👋 *Привет, Игрок VK!* ✨\n\n🔑 Ваш одноразовый код для входа на сайте:\n👉 ${code} 👈\n\n🎮 *Удачной игры!*`;
              await sendVkMessage(peer_id, codeMessage);
            } else if (mappedText.toLowerCase() === "/play") {
              const inlineKbd = JSON.stringify({
                inline: true,
                buttons: [[{ action: { type: "open_link", link: process.env.APP_URL || "https://ais-pre-hp7aptrk5b2jplq55aftoy-728480963619.europe-west2.run.app", label: "🎮 Открыть Игру" } }]]
              });
              await sendVkMessage(peer_id, "🎮 *Погнали играть!*\n\nЗапускай игру прямо сейчас по ссылке:", { keyboard: inlineKbd });
            } else if (mappedText.toLowerCase() === "/clear_chat") {
              await sendVkMessage(peer_id, "🧹 *История чата очищена (визуально для бота)!*");
            } else if (mappedText.toLowerCase() === "/table" || mappedText.toLowerCase() === "/sheet" || mappedText.toLowerCase() === "таблица") {
              if (masterSheetId) {
                let sheetTabs: string[] = [];
                try {
                  const auth = new google.auth.GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
                  });
                  const authClient = await auth.getClient();
                  const sheets = google.sheets({ version: 'v4', auth: authClient as any });
                  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: masterSheetId });
                  sheetTabs = sheetMeta.data.sheets?.map(s => s.properties?.title || '').filter(Boolean) || [];
                } catch (e: any) {
                  console.error("Failed to fetch sheet tabs in VK:", e.message || e);
                }

                const sheetLink = `https://docs.google.com/spreadsheets/d/${masterSheetId}/edit`;
                let tabMsg = "";
                if (sheetTabs.length > 0) {
                  tabMsg = "\n\n📂 Доступные листы (вкладки по годам):\n" + sheetTabs.map(tab => `• 📅 ${tab} год`).join("\n");
                }
                await sendVkMessage(peer_id, `📊 *Google Таблицы*\n\nПерейдите по ссылке ниже, чтобы просмотреть таблицу по годам или заполнить её вручную:${tabMsg}\n\n👉 ${sheetLink}`);
              } else {
                await sendVkMessage(peer_id, "⚠️ Google Таблица еще не подключена администратором.");
              }
            }
            // Убираем фоллбэк (else). Если сервер не узнал команду, он просто промолчит,
            // а сообщение подхватит и обработает VK CXhub (например, FAQ или воронка).
          }
        }
      }
    } catch(e) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

let lastUpdateId = 0;
const processedUpdateIdsInMemory = new Set<number>();

async function startTelegramBotPolling() {
  console.log("Starting Telegram Bot Polling loop...");

  // Prevent multiple active bot polling loops by using a PID lock file
  const PID_FILE = "/tmp/telegram_bot_polling.pid";
  const currentPid = process.pid;
  try {
    if (fs.existsSync(PID_FILE)) {
      const oldPidStr = fs.readFileSync(PID_FILE, "utf8").trim();
      const oldPid = parseInt(oldPidStr, 10);
      if (oldPid && oldPid !== currentPid) {
        console.log(`Killing old bot polling process: ${oldPid}`);
        try {
          process.kill(oldPid, "SIGTERM");
          // Give it a tiny bit of time to release resources
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          // Process might already be dead or belong to a different user, ignore safely
        }
      }
    }
  } catch (err) {
    console.error("Error managing bot lock file:", err);
  }
  try {
    fs.writeFileSync(PID_FILE, String(currentPid), "utf8");
  } catch (err) {
    console.error("Error writing bot PID file:", err);
  }
  
  // Skip over old historical messages sent while the bot was offline or during a server restart
  try {
    const initRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=-1&limit=1`);
    const initData = await initRes.json();
    if (initData && initData.ok && Array.isArray(initData.result) && initData.result.length > 0) {
      lastUpdateId = initData.result[0].update_id;
      console.log(`Telegram polling initialized. Skipping historical messages. lastUpdateId set to: ${lastUpdateId}`);
    }
  } catch (e) {
    console.error("Failed to initialize lastUpdateId for Telegram bot skipping:", e);
  }

  while (true) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20 second timeout
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await response.json();
      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;

          // In-memory instant deduplication of Telegram updates to prevent double-processing
          if (processedUpdateIdsInMemory.has(update.update_id)) {
            continue;
          }
          processedUpdateIdsInMemory.add(update.update_id);
          // Prevent memory leaks by keeping the set history capped to latest 2000 items
          if (processedUpdateIdsInMemory.size > 2000) {
            const oldest = processedUpdateIdsInMemory.values().next().value;
            if (oldest !== undefined) {
              processedUpdateIdsInMemory.delete(oldest);
            }
          }

          try {
            const dbInstance = await getAuthenticatedDb();
            const lockRef = doc(dbInstance, "bot_locks", String(update.update_id));
            const isProcessed = await runTransaction(dbInstance, async (transaction) => {
              const lockDoc = await transaction.get(lockRef);
              if (lockDoc.exists()) {
                return true;
              }
              transaction.set(lockRef, { processedAt: Date.now() });
              return false;
            });

            if (isProcessed) {
              continue;
            }
          } catch (lockErr) {
            console.error("Lock error:", lockErr);
          }

          // Handle inline button Callback Queries (button click events)
          if (update.callback_query) {
            const callbackQuery = update.callback_query;
            const callbackData = callbackQuery.data;
            const chatId = callbackQuery.message?.chat?.id;
            const messageId = callbackQuery.message?.message_id;

            // Stop the loading spinner in the user's Telegram client right away
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: callbackQuery.id })
            }).catch(() => {});

            if (chatId && messageId) {
              if (callbackData === "delete_this") {
                await deleteMessageSafe(chatId, messageId);
              } else if (callbackData === "delete_all") {
                const state = await getBotChatState(chatId);
                if (state && state.sentMessageIds) {
                  const idsToDelete = [...state.sentMessageIds];
                  state.sentMessageIds = [];
                  await saveBotChatState(chatId, state);
                  await Promise.all(idsToDelete.map(id => deleteMessageSafe(chatId, id)));
                }
              } else if (callbackData?.startsWith("dismiss_admin_")) {
                const targetId = callbackData.replace("dismiss_admin_", "");
                const senderId = String(callbackQuery.from.id);
                if (admins.includes(senderId)) {
                  if (targetId === senderId && admins.length === 1) {
                    await sendCleanBotMessage(chatId, "⚠️ Вы не можете разжаловать себя, так как вы единственный администратор!");
                  } else {
                    admins = admins.filter(id => id !== targetId);
                    saveConfig();
                    await sendCleanBotMessage(chatId, `✅ Администратор с ID \`${targetId}\` успешно разжалован!`);
                  }
                } else {
                  await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора!");
                }
              } else if (callbackData?.startsWith("dismiss_mod_")) {
                const targetId = callbackData.replace("dismiss_mod_", "");
                const senderId = String(callbackQuery.from.id);
                if (admins.includes(senderId)) {
                  moderators = moderators.filter(id => id !== targetId);
                  saveConfig();
                  await sendCleanBotMessage(chatId, `✅ Модератор с ID \`${targetId}\` успешно разжалован!`);
                } else {
                  await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора!");
                }
              } else if (callbackData === "last_notification") {
                const state = await getBotChatState(chatId);
                const lastNots = state.lastNotificationText || "📭 У вас пока нет сохраненных уведомлений.";
                await sendCleanBotMessage(chatId, `🔔 *Последнее уведомление:*\n\n${lastNots}`, {
                  keepHistory: true,
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "❌ Удалить сообщение", callback_data: "delete_this" },
                        { text: "🧹 Очистить всё", callback_data: "delete_all" }
                      ]
                    ]
                  }
                });
              }
            }
            continue;
          }

          if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const text = update.message.text.trim();
            const from = update.message.from;

            // Clean the user's input messages immediately to keep the chat spotless
            await deleteMessageSafe(chatId, update.message.message_id);

            // Translate Keyboard Custom Button clicks back into standard commands
            let mappedText = text;
            const checkText = text.trim();
            let state = await getBotChatState(chatId);
            
            if (checkText === "❌ Отмена") {
              state.supportMode = false;
              state.supportDraft = [];
              await saveBotChatState(chatId, state);
              await sendCleanBotMessage(chatId, "❌ *Обращение в поддержку отменено.*", {
                reply_markup: DEFAULT_KEYBOARD
              });
              continue;
            }

            if (state.supportMode) {
              const userMessage = text.trim();
              if (userMessage) {
                // Instantly disable supportMode to prevent duplicate ticket submissions or race conditions
                state.supportMode = false;
                state.supportDraft = [];

                const tgId = String(from.id);
                const welcomeName = from.first_name || "Игрок";
                const username = from.username ? `@${from.username}` : "";

                // Automatically look up the registered player's in-game nickname!
                const existingPlayer = Array.from(players.values()).find(
                  (p) => p.telegramId === tgId || (p.username && p.username.toLowerCase() === from.username?.toLowerCase())
                );
                const displayName = existingPlayer ? `${existingPlayer.name} (ID: ${existingPlayer.id})` : welcomeName;

                try {
                  const dbInstance = await getAuthenticatedDb();
                  const supportRef = collection(dbInstance, "support_tickets");
                  await addDoc(supportRef, {
                    telegramId: tgId,
                    name: displayName,
                    username: username,
                    message: userMessage,
                    createdAt: Date.now(),
                    status: "open",
                    chatId: chatId,
                    isRead: false,
                    source: 'tg'
                  });

                  console.log(`Support ticket successfully logged for ${displayName}`);

                  const msg = `✅ *Сообщение отправлено!*\n\nВаше обращение доставлено администраторам. Пожалуйста, ожидайте ответа здесь в чате!`;
                  await sendCleanBotMessage(chatId, msg, {
                    reply_markup: DEFAULT_KEYBOARD
                  });
                } catch (dbErr: any) {
                  console.error("Failed to commit support ticket to firestore:", dbErr);
                  await sendCleanBotMessage(chatId, `❌ *Ошибка отправки обращения!*\n\nНе удалось доставить ваше сообщение администраторам. Пожалуйста, попробуйте еще раз.\n\nОшибка: ${dbErr.message || dbErr}`, {
                    reply_markup: DEFAULT_KEYBOARD
                  });
                }
              } else {
                await sendCleanBotMessage(chatId, "⚠️ *Вы не написали текст обращения.* Попробуйте еще раз или нажмите ❌ Отмена.", {
                  reply_markup: {
                    keyboard: [[{ text: "❌ Отмена" }]],
                    resize_keyboard: true,
                    is_persistent: true
                  }
                });
              }
              continue;
            }

            if (checkText === "🎮 Играть!") {
              mappedText = "/play";
            } else if (checkText === "👤 Мой Профиль") {
              mappedText = "/profile";
            } else if (checkText === "🔑 Код для входа") {
              mappedText = "/code";
            } else if (checkText === "🔔 Последнее уведомление") {
              mappedText = "/last_notification";
            } else if (checkText === "💾 Сохранить прогресс") {
              mappedText = "/save";
            } else if (checkText === "🧹 Очистить чат") {
              mappedText = "/clear_chat";
            } else if (checkText === "💬 Поддержка") {
              mappedText = "/support";
            } else if (checkText === "❓ Справка") {
              mappedText = "/aide";
            } else if (checkText === "📊 Таблица" || checkText.toLowerCase() === "таблица") {
              mappedText = "/table";
            } else if (checkText.includes("Админ-Меню")) {
              mappedText = "/admin_page2";
            } else if (checkText.includes("Меню Игрока") || checkText.includes("Игрок-Меню")) {
              mappedText = "/player_page1";
            } else if (checkText === "👥 Персонал") {
              mappedText = "/staff";
            } else if (checkText === "➕ Добавить админа") {
              mappedText = "/prompt_add_admin";
            } else if (checkText === "🛠️ Добавить модера") {
              mappedText = "/prompt_add_mod";
            } else if (checkText === "➖ Исключить кого-то") {
              mappedText = "/prompt_exclude";
            } else if (checkText === "⚙️ Настройки Таблицы") {
              mappedText = "/prompt_table";
            } else if (checkText === "👑 Как зайти в Админку?") {
              mappedText = "/help_admin";
            }

            const upperMappedText = mappedText.toUpperCase();

            // 1. Extract potential 6-character code (supports stand-alone or '/start CODE' format)
            let potentialCode = "";
            let hasStartPayload = false;
            if (upperMappedText.startsWith("/START ")) {
              hasStartPayload = true;
              const parts = mappedText.split(/\s+/);
              if (parts.length > 1) {
                potentialCode = parts[1].trim().toUpperCase();
              }
            } else if (upperMappedText.length === 6 && /^[A-Z0-9]{6}$/.test(upperMappedText)) {
              potentialCode = upperMappedText;
            }

            // 2. Check if it matches an active waiting authorization code from the game client
            if (potentialCode) {
              if (pendingClientCodes.has(potentialCode)) {
                const codeData = pendingClientCodes.get(potentialCode)!;
                const now = Date.now();
                if (now - codeData.createdAt <= 10 * 60 * 1000) {
                  // Link telegram user details
                  codeData.telegramUser = {
                    id: String(from.id),
                    username: from.username || "",
                    first_name: from.first_name || "",
                    last_name: from.last_name || ""
                  };
                  codeData.resolved = true;

                  // Send intermediate "⏳ Секунду..." message using clean helper
                  await sendCleanBotMessage(chatId, "⏳ Секунду...");

                  // Wait for 5 seconds
                  await new Promise((resolve) => setTimeout(resolve, 5000));

                  // Find in memory instead of slow duplicate database query
                  const tgId = String(from.id);
                  const matchedPlayer = findSyncPlayerByTelegram(tgId, from.username, from.first_name);

                  const welcomeName = from.first_name || "Игрок";
                  let statsLine = "";
                  if (matchedPlayer) {
                    statsLine = `👤 Игрок: *${matchedPlayer.name || welcomeName}*\n💰 Баланс: *${Math.floor(matchedPlayer.coins || 0).toLocaleString()}* монет\n🕹 Клик-Очки: *${matchedPlayer.clicks || 0}*\n\n`;
                  } else {
                    statsLine = `👤 Игрок: *${welcomeName}*\n\n`;
                  }

                  const finalSuccessMsg = `Ура! Вы подключены, теперь у вас есть доступ к уведомлениям! 🎮\n\n${statsLine}✨ Ваш игровой профиль успешно синхронизирован с Telegram!`;

                  await sendCleanBotMessage(chatId, finalSuccessMsg, {
                    reply_markup: DEFAULT_KEYBOARD
                  });
                  continue;
                }
              }

              // Code is invalid or expired/already used. Prevent double code fly past.
              const welcomeName = from.first_name || "Игрок";
              const errorMsg = `⚠️ *Этот авторизационный код недействителен или устарел!*\n\nПривет, ${welcomeName}! Возможно, вы уже заходили по этому коду.\n\n🔑 Чтобы зайти с нового устройства, нажмите на кнопку\n**«🔑 Код для входа»** на клавиатуре ниже, чтобы получить свежий одноразовый код!`;
              await sendCleanBotMessage(chatId, errorMsg, {
                reply_markup: DEFAULT_KEYBOARD
              });
              continue;
            }

            // 3. Check for commands or start
            if (mappedText.startsWith("/start") || mappedText.toLowerCase() === "войти" || mappedText.toLowerCase() === "login" || mappedText.toLowerCase() === "/login" || mappedText.toLowerCase() === "/code") {
              // Generate a 6-digit uppercase numeric code
              const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
              let code = "";
              for (let i = 0; i < 6; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
              }

              // Store code (valid for 10 minutes)
              verificationCodes.set(code, {
                id: String(from.id),
                username: from.username || "",
                first_name: from.first_name || "",
                last_name: from.last_name || "",
                photo_url: "",
                createdAt: Date.now()
              });

              // Clean up old codes
              const now = Date.now();
              verificationCodes.forEach((val, key) => {
                if (now - val.createdAt > 10 * 60 * 1000) {
                  verificationCodes.delete(key);
                }
              });

              const welcomeName = from.first_name || "Игрок";
              const userTgId = String(from.id);
              const codeMessage = `👋 *Привет, ${welcomeName}!* ✨\n\n📌 Ваш Telegram ID: \`${userTgId}\` *(нажмите, чтобы скопировать)*\n\n🎮 Чтобы мгновенно связать ваш игровой профиль и включить уведомления, откройте игру на сайте и нажмите кнопку **«Подключить Telegram»**!\n\n🔑 Или используйте этот одноразовый код для входа на сайте:\n👉 \`${code}\` 👈\n\n🎮 *Удачной игры!*`;

              await sendCleanBotMessage(chatId, codeMessage, {
                reply_markup: DEFAULT_KEYBOARD
              });
            } else if (mappedText.toLowerCase() === "/save" || mappedText.toLowerCase() === "save" || mappedText.toLowerCase() === "/сохранить" || mappedText.toLowerCase() === "сохранить" || mappedText.toLowerCase() === "/profile" || mappedText.toLowerCase() === "/профиль") {
              const tgId = String(from.id);

              // 1. Check if there are active WebSocket connections for this Telegram user to trigger real-time saving
              let hasActiveSession = false;
              wss.clients.forEach((client) => {
                const clientTgId = (client as any).telegramId;
                if (client.readyState === WebSocket.OPEN && typeof clientTgId === "string" && clientTgId && clientTgId === tgId) {
                  try {
                    client.send(JSON.stringify({ type: "SYNC_START" }));
                    client.send(JSON.stringify({ type: "request_save" }));
                    hasActiveSession = true;
                  } catch (err) {
                    console.error("Failed to send request_save message to ws client:", err);
                  }
                }
              });

              // Send intermediate "⏳ Загрузка..." message
              const initialWaitText = hasActiveSession
                ? "⏳ *Обнаружена активная сессия!* Обновляем данные..."
                : "⏳ *Поиск профиля в базе...*";

              await sendCleanBotMessage(chatId, initialWaitText);

              // Wait for completion
              if (hasActiveSession) {
                // Wait 7.5 seconds allowing the browser client's 6-second progress bar animation to complete and write to Firestore
                await new Promise(resolve => setTimeout(resolve, 7500));
              } else {
                // Short wait to ensure we fetch current database state
                await new Promise(resolve => setTimeout(resolve, 2000));
              }

              // Use findSyncPlayerByTelegram to obtain the hydrated player details without querying database
              const matchedPlayer = findSyncPlayerByTelegram(tgId, from.username, from.first_name);

              const welcomeName = from.first_name || "Игрок";
              let msg = "";
              if (matchedPlayer) {
                const isNotsEnabled = matchedPlayer.notificationsEnabled !== false;
                const notsStatusLine = isNotsEnabled ? "🟢 *Уведомления включены*" : "🔴 *Уведомления отключены*";
                msg = `🕹 *Ваш игровой профиль*\n\n👤 Игрок: *${matchedPlayer.name || welcomeName}*\n💰 Баланс: *${Math.floor(matchedPlayer.coins || 0).toLocaleString()}* монет\n🕹 Клик-Очки: *${matchedPlayer.clicks || 0}*\n⚡ Сила: *${matchedPlayer.clickPowerLevel || 1}*\n🤖 Автоклик: *${matchedPlayer.autoClickerLevel || 1}*\n\n⚙️ Статус: ${notsStatusLine}\n\n🟢 *Данные успешно найдены!* 🎮`;
              } else {
                msg = `🔍 *Профиль не найден*\n\nПривет, ${welcomeName}! Бот не смог найти привязанный аккаунт в базе данных.\n\nПожалуйста, убедитесь, что вы вошли в игру на сайте и привязали свой Telegram-аккаунт в меню настроек!`;
              }

              // Signal sync end
              wss.clients.forEach((client) => {
                const clientTgId = (client as any).telegramId;
                if (client.readyState === WebSocket.OPEN && typeof clientTgId === "string" && clientTgId && clientTgId === tgId) {
                  try {
                    client.send(JSON.stringify({ type: "SYNC_END" }));
                  } catch (err) {
                    console.error("Failed to send SYNC_END message to ws client:", err);
                  }
                }
              });

              await sendCleanBotMessage(chatId, msg);
            } else if (mappedText.toLowerCase() === "/aide" || mappedText.toLowerCase() === "aide" || mappedText.toLowerCase() === "/help") {
              const msg = `📚 *Справка по боту*\n\n/start - Регистрация или получение кода для входа\n/save - Сохранить игровой прогресс вручную\n/table - Получить ссылку на Google Таблицу\n/aide - Показать эту справку\n\n📋 *Команды Google Таблицы:*\n✍️ Просто напишите свое *имя* или *логин* (или команду \`/add имя\`), чтобы занести ваши игровые данные в общую Google Таблицу!\n\n🔧 *Для Администраторов:*\n⚙️ \`/set_table <id_таблицы>\` - Задать ID общей Google Таблицы\n➕ \`/add_admin <tg_id>\` - Назначить админа\n✏️ Напишите любое имя/логин игрока, чтобы добавить его в таблицу без ограничений!`;
              await sendCleanBotMessage(chatId, msg);
            } else if (mappedText.toLowerCase() === "/table" || mappedText.toLowerCase() === "/sheet" || mappedText.toLowerCase() === "таблица") {
              if (masterSheetId) {
                let sheetTabs: string[] = [];
                try {
                  const auth = new google.auth.GoogleAuth({
                    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
                  });
                  const authClient = await auth.getClient();
                  const sheets = google.sheets({ version: 'v4', auth: authClient as any });
                  const response = await sheets.spreadsheets.get({
                    spreadsheetId: masterSheetId,
                  });
                  if (response.data.sheets) {
                    sheetTabs = response.data.sheets
                      .map(s => s.properties?.title || "")
                      .filter(Boolean);
                  }
                } catch (err) {
                  console.error("Failed to fetch sheet tabs in telegram table cmd:", err);
                }

                const sheetLink = `https://docs.google.com/spreadsheets/d/${masterSheetId}/edit`;
                let tabMsg = "";
                const inline_keyboard: any[] = [];
                if (sheetTabs.length > 0) {
                  tabMsg = "\n\n📂 Доступные листы (вкладки по годам):\n" + sheetTabs.map(tab => `• 📅 ${tab} год`).join("\n");
                  const rows: any[] = [];
                  for (let i = 0; i < sheetTabs.length; i += 2) {
                    const row: any[] = [];
                    row.push({ text: `📅 ${sheetTabs[i]}`, url: sheetLink });
                    if (sheetTabs[i + 1]) {
                      row.push({ text: `📅 ${sheetTabs[i + 1]}`, url: sheetLink });
                    }
                    rows.push(row);
                  }
                  inline_keyboard.push(...rows);
                }
                inline_keyboard.push([{ text: "🔗 Открыть Google Таблицу", url: sheetLink }]);

                await sendCleanBotMessage(chatId, `📊 *Google Таблицы*\n\nНиже представлены ссылки на листы по годам для удобного просмотра и ручного редактирования:${tabMsg}`, {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: inline_keyboard
                  }
                });
              } else {
                await sendCleanBotMessage(chatId, "⚠️ Google Таблица еще не настроена администратором.");
              }
            } else if (mappedText.toLowerCase().startsWith("/mod_panel") || mappedText.toLowerCase().startsWith("/mod")) {
              const senderId = String(from.id);
              if (isModeratorId(senderId) || isAdminId(senderId)) {
                const code = mappedText.split(" ")[1]?.trim();
                if (code) {
                  const targetPlayerId = adminVerificationCodes.get(code);
                  if (targetPlayerId) {
                    const isSenderAdmin = isAdminId(senderId);
                    if (isSenderAdmin) {
                      if (!isAdminId(targetPlayerId)) {
                        admins.push(targetPlayerId);
                      }
                    } else {
                      if (!isModeratorId(targetPlayerId)) {
                        moderators.push(targetPlayerId);
                      }
                    }
                    saveConfig();
                    broadcastPlayers();
                    
                    const roleName = isSenderAdmin ? "Администратора" : "Модератора";
                    const msg = `🛡️ *Авторизация успешна*\n\nВаше игровое устройство (ID: \`${targetPlayerId}\`) успешно авторизовано в системе с правами *${roleName}*!\n\nПароль от консоли в игре:\n🔑 \`admin123\`\n\nИспользуйте его для входа.`;
                    await sendCleanBotMessage(chatId, msg, { parse_mode: "Markdown" });
                  } else {
                    await sendCleanBotMessage(chatId, `⚠️ Код \`${code}\` не найден или устарел. Пожалуйста, откройте окно входа в игре заново, чтобы получить свежий код.`, { parse_mode: "Markdown" });
                  }
                } else {
                  await sendCleanBotMessage(chatId, "⚠️ Пожалуйста, укажите код подтверждения из игры. Пример: `/mod 123456`", { parse_mode: "Markdown" });
                }
              } else {
                await sendCleanBotMessage(chatId, "❌ Эта команда доступна только модераторам!");
              }
            } else if (mappedText.startsWith("/set_table ")) {
              const sheetId = mappedText.split(" ")[1]?.trim();
              if (!sheetId) {
                await sendCleanBotMessage(chatId, "❌ Пожалуйста, укажите ID таблицы: `/set_table <sheet_id>`");
              } else {
                const senderId = String(from.id);
                // First ever configuration sets the first admin
                if (admins.length === 0) {
                  admins.push(senderId);
                }
                
                if (!admins.includes(senderId)) {
                  await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора для подключения таблицы!");
                } else {
                  masterSheetId = sheetId;
                  saveConfig();
                  const sheetLink = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
                  await sendCleanBotMessage(chatId, `✅ *Общая Google Таблица успешно настроена!*\n\nID: \`${sheetId}\`\n🔗 [Открыть таблицу](${sheetLink})\n\nТеперь вы можете добавлять данные игроков в таблицу, просто написав их имя/логин/ID, или введя команду:\n✍️ \`/add имя_или_логин\``, { parse_mode: "Markdown" });
                }
              }
            } else if (mappedText.toLowerCase() === "/help_admin" || mappedText.toLowerCase() === "/admin_help") {
              await sendCleanBotMessage(chatId, `👑 *Как открыть Админ-панель в игре?*\n\n1️⃣ **Привяжи Telegram**\nВ самой игре нажми кнопку **«Подключить Telegram»** и войди через этот аккаунт.\n\n2️⃣ **Открой Настройки**\nВ игре нажми на иконку шестеренки ⚙️.\n\n3️⃣ **Нажми кнопку**\nВ настройках появится яркая кнопка **«👑 Админ-панель»**. Нажми её!\n\n💡 *Если кнопки нет — проверь, привязан ли Telegram и есть ли ты в списке персонала (/staff).*`, { parse_mode: "Markdown" });
            } else if (mappedText === "/myid" || mappedText === "/my_id") {
              await sendCleanBotMessage(chatId, `👤 Ваш Telegram ID: \`${from.id}\`\n\nИспользуйте его, чтобы добавить себя в администраторы, если у вас есть права!`);
            } else if (mappedText.startsWith("/add_admin ") || mappedText.startsWith("/make_admin ") || mappedText.startsWith("/addadmin ")) {
              const senderId = String(from.id);
              // Allow adding if list is empty OR contains only placeholders OR sender is already admin
              const isEffectivelyEmpty = admins.length === 0 || (admins.length === 1 && admins[0] === "urhkdp1739");
              if (isEffectivelyEmpty || admins.includes(senderId)) {
                const targetId = mappedText.split(" ")[1]?.trim();
                if (targetId) {
                  if (isEffectivelyEmpty) {
                    admins = [targetId];
                  } else if (!admins.includes(targetId)) {
                    admins.push(targetId);
                  }
                  saveConfig();
                  await sendCleanBotMessage(chatId, `✅ Игрок с Telegram ID \`${targetId}\` успешно добавлен в администраторы бота!\n\n🎮 *Как открыть админ-панель в игре?*\n1. Откройте игру.\n2. Перейдите в раздел **«Настройки»** (иконка шестеренки).\n3. Если вы авторизованы через этот Telegram, вы увидите кнопку **«👑 Админ-панель»**!`, { parse_mode: "Markdown" });
                } else {
                  await sendCleanBotMessage(chatId, "❌ Пожалуйста, укажите Telegram ID: `/addadmin <id>`");
                }
              } else {
                await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора!");
              }
            } else if (mappedText.toLowerCase() === "/admin_page2") {
              const senderId = String(from.id);
              if (isStaff(senderId)) {
                state.keyboardPage = 2;
                await saveBotChatState(chatId, state);
                await sendCleanBotMessage(chatId, "📂 *Переход в панель администратора (Страница 2)*\n\nЗдесь вы можете управлять персоналом, добавлять модераторов, исключать кого-то или настраивать таблицы.", {
                  reply_markup: getKeyboardForUser(chatId, 2)
                });
              } else {
                await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора или модератора!");
              }
            } else if (mappedText.toLowerCase() === "/player_page1") {
              state.keyboardPage = 1;
              await saveBotChatState(chatId, state);
              await sendCleanBotMessage(chatId, "🎮 *Переход в главное меню (Страница 1)*\n\nПриятной игры!", {
                reply_markup: getKeyboardForUser(chatId, 1)
              });
            } else if (mappedText.toLowerCase() === "/staff" || mappedText.toLowerCase() === "/list_staff") {
              const senderId = String(from.id);
              const adminsList = admins.length > 0 ? admins.map(id => `• \`${id}\``).join("\n") : "_Нет_";
              const modsList = moderators.length > 0 ? moderators.map(id => `• \`${id}\``).join("\n") : "_Нет_";
              
              const inline_keyboard: any[] = [];
              if (admins.includes(senderId)) {
                // Only admins see the dismissal buttons
                if (admins.length > 0) {
                  admins.forEach(id => {
                    inline_keyboard.push([{ text: `❌ Разжаловать Админа (${id})`, callback_data: `dismiss_admin_${id}` }]);
                  });
                }
                if (moderators.length > 0) {
                  moderators.forEach(id => {
                    inline_keyboard.push([{ text: `❌ Разжаловать Модера (${id})`, callback_data: `dismiss_mod_${id}` }]);
                  });
                }
              }

              await sendCleanBotMessage(chatId, `👥 *Список персонала:*\n\n👑 *Администраторы:*\n${adminsList}\n\n🛠️ *Модераторы:*\n${modsList}`, {
                parse_mode: "Markdown",
                reply_markup: inline_keyboard.length > 0 ? { inline_keyboard } : undefined
              });
            } else if (mappedText.toLowerCase() === "/prompt_add_admin") {
              const senderId = String(from.id);
              if (admins.includes(senderId)) {
                await sendCleanBotMessage(chatId, "✍️ Чтобы назначить нового *администратора*, введите команду:\n`/addadmin <Telegram ID>`");
              } else {
                await sendCleanBotMessage(chatId, "❌ Изменять состав администраторов может только администратор!");
              }
            } else if (mappedText.toLowerCase() === "/prompt_add_mod") {
              const senderId = String(from.id);
              if (admins.includes(senderId)) {
                await sendCleanBotMessage(chatId, "✍️ Чтобы назначить нового *модератора*, введите команду:\n`/addmod <Telegram ID>`");
              } else {
                await sendCleanBotMessage(chatId, "❌ Назначать модераторов может только администратор!");
              }
            } else if (mappedText.toLowerCase() === "/prompt_exclude") {
              const senderId = String(from.id);
              if (admins.includes(senderId)) {
                await sendCleanBotMessage(chatId, "✍️ Чтобы *исключить (разжаловать)* администратора или модератора, отправьте соответствующую команду:\n\n❌ Разжаловать админа:\n`/removeadmin <Telegram ID>`\n\n❌ Разжаловать модератора:\n`/removemod <Telegram ID>`\n\n💡 Или нажмите на кнопку «👥 Персонал», чтобы увидеть кнопки быстрого удаления.");
              } else {
                await sendCleanBotMessage(chatId, "❌ Управлять персоналом может только администратор!");
              }
            } else if (mappedText.toLowerCase() === "/prompt_table") {
              const senderId = String(from.id);
              if (admins.includes(senderId)) {
                await sendCleanBotMessage(chatId, `⚙️ *Настройка Google Таблицы*\n\nТекущий ID таблицы: \`${masterSheetId || "не задан"}\`\n\nЧтобы подключить другую таблицу, отправьте команду:\n\`/set_table <ID_таблицы>\``);
              } else {
                await sendCleanBotMessage(chatId, "❌ Настраивать общую таблицу могут только администраторы!");
              }
            } else if (mappedText.startsWith("/add_mod ") || mappedText.startsWith("/addmod ")) {
              const senderId = String(from.id);
              if (admins.includes(senderId)) {
                const targetId = mappedText.split(" ")[1]?.trim();
                if (targetId) {
                  if (!moderators.includes(targetId)) {
                    moderators.push(targetId);
                    saveConfig();
                  }
                  await sendCleanBotMessage(chatId, `✅ Игрок с Telegram ID \`${targetId}\` успешно добавлен в модераторы бота!`);
                } else {
                  await sendCleanBotMessage(chatId, "❌ Пожалуйста, укажите Telegram ID: `/addmod <id>`");
                }
              } else {
                await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора!");
              }
            } else if (mappedText.startsWith("/del_admin ") || mappedText.startsWith("/remove_admin ") || mappedText.startsWith("/removeadmin ")) {
              const senderId = String(from.id);
              if (admins.includes(senderId)) {
                const targetId = mappedText.split(" ")[1]?.trim();
                if (targetId) {
                  if (targetId === senderId && admins.length === 1) {
                    await sendCleanBotMessage(chatId, "⚠️ Вы не можете разжаловать себя, так как вы единственный администратор!");
                  } else {
                    admins = admins.filter(id => id !== targetId);
                    saveConfig();
                    await sendCleanBotMessage(chatId, `✅ Администратор с Telegram ID \`${targetId}\` успешно разжалован!`);
                  }
                } else {
                  await sendCleanBotMessage(chatId, "❌ Пожалуйста, укажите Telegram ID: `/removeadmin <id>`");
                }
              } else {
                await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора!");
              }
            } else if (mappedText.startsWith("/del_mod ") || mappedText.startsWith("/remove_mod ") || mappedText.startsWith("/removemod ")) {
              const senderId = String(from.id);
              if (admins.includes(senderId)) {
                const targetId = mappedText.split(" ")[1]?.trim();
                if (targetId) {
                  moderators = moderators.filter(id => id !== targetId);
                  saveConfig();
                  await sendCleanBotMessage(chatId, `✅ Модератор с Telegram ID \`${targetId}\` успешно разжалован!`);
                } else {
                  await sendCleanBotMessage(chatId, "❌ Пожалуйста, укажите Telegram ID: `/del_mod <id>`");
                }
              } else {
                await sendCleanBotMessage(chatId, "❌ У вас нет прав администратора!");
              }
            } else if (mappedText.startsWith("/add ") || mappedText.startsWith("/add_player ") || (!mappedText.startsWith("/") && mappedText.trim().length > 0)) {
              // Extract the target search query. If it's a command, take everything post /add or /add_player.
              let targetSearch = mappedText.trim();
              if (mappedText.startsWith("/add ")) {
                targetSearch = mappedText.substring(5).trim();
              } else if (mappedText.startsWith("/add_player ")) {
                targetSearch = mappedText.substring(12).trim();
              }
              
              if (!targetSearch) {
                await sendCleanBotMessage(chatId, "❌ Пожалуйста, укажите имя, логин или ID игрока:\n`/add имя_или_логин`");
              } else {
                const senderId = String(from.id);
                const isStaffUser = isStaff(senderId);
                
                try {
                  // Use memory-safe Players Map lookups to find the user instantly with zero read cost and no double fetching!
                  let searchLower = targetSearch.toLowerCase();
                  if (searchLower.startsWith("@")) {
                    searchLower = searchLower.substring(1);
                  }
                  
                  let matchedPlayer: any = null;
                  for (const p of players.values()) {
                    const dbTgId = p.telegramId ? String(p.telegramId).trim() : "";
                    const dbUsername = p.username ? String(p.username).toLowerCase().trim() : "";
                    const dbPlayerName = p.name ? String(p.name).toLowerCase().trim() : "";
                    
                    if (dbTgId === searchLower || dbUsername === searchLower || dbPlayerName === searchLower) {
                      matchedPlayer = p;
                      break;
                    }
                  }
                  
                  if (!matchedPlayer) {
                    await sendCleanBotMessage(chatId, `🔍 *Профиль игрока "${targetSearch}" не найден*\n\nПожалуйста, убедитесь, что имя/логин введены верно и игрок зарегистрировался или вошел на сайте.`);
                  } else {
                    const dbTgId = matchedPlayer.telegramId ? String(matchedPlayer.telegramId).trim() : "";
                    const dbUsername = matchedPlayer.username ? `@${matchedPlayer.username}` : "нет юзернейма";
                    const dbPlayerName = matchedPlayer.name || "Игрок";
                    
                    // Access rules check: Admins can add anyone, players can only add themselves.
                    const isSelf = dbTgId === senderId || 
                                   (from.username && matchedPlayer.username && String(matchedPlayer.username).toLowerCase() === String(from.username).toLowerCase()) ||
                                   (from.first_name && matchedPlayer.name && String(matchedPlayer.name).toLowerCase() === String(from.first_name).toLowerCase());
                    
                    if (!isSelf && !isStaffUser) {
                      await sendCleanBotMessage(chatId, "⚠️ Вы можете добавлять в таблицу только собственный игровой профиль! Добавление других игроков в таблицу доступно только администраторам и модераторам.");
                    } else if (!masterSheetId) {
                      await sendCleanBotMessage(chatId, "⚠️ Google Таблица еще не подключена администратором.\nПожалуйста, настройте её с помощью команды `/set_table <id_таблицы>` перед добавлением игроков.");
                    } else {
                      // Attempt to write/append to sheet
                      const recordCoins = Math.floor(matchedPlayer.coins || 0);
                      const recordClicks = matchedPlayer.clicks || 0;
                      
                      try {
                        await appendToGoogleSheet(masterSheetId, [
                          new Date().toISOString(),
                          dbTgId || "нет ID",
                          dbUsername,
                          dbPlayerName,
                          recordCoins,
                          recordClicks
                        ]);
                        await sendCleanBotMessage(chatId, `✅ *Данные игрока успешно занесены в Google Таблицу!*\n\n👤 Игрок: *${dbPlayerName}*\n💰 Монеты: *${recordCoins.toLocaleString()}*\n🕹 Клик-Очки: *${recordClicks}*\n📱 Telegram: ${dbUsername}`);
                      } catch (sheetErr: any) {
                        console.error("Master sheet integration error appending row:", sheetErr);
                        const sheetLink = `https://docs.google.com/spreadsheets/d/${masterSheetId}/edit`;
                        await sendCleanBotMessage(chatId, `❌ Ошибка интеграции с Google Таблицей (возможно, проблема с правами доступа).\n\nВы можете занести данные вручную, перейдя по ссылке:\n👉 ${sheetLink}`);
                      }
                    }
                  }
                } catch (e: any) {
                  console.error("Firestore user search error in telegram bot lookup handler:", e);
                  await sendCleanBotMessage(chatId, "❌ Внутренняя ошибка поиска профиля в базе данных.");
                }
              }
            } else {
              // Standard fallback explanation info
              const welcomeName = from.first_name || "Игрок";
              const userTgId = String(from.id);
              const fallbackMsg = `👋 *Привет, ${welcomeName}!* \n\n📌 Ваш Telegram ID: \`${userTgId}\` *(нажмите, чтобы скопировать)*\n\nЧтобы связать свой игровой аккаунт и включить уведомления, пожалуйста, откройте игру на сайте и нажмите кнопку **«Подключить Telegram»**!\n\n💾 Отправьте /save, чтобы вручную сохранить прогресс и проверить актуальный баланс.\n📋 Или напишите ваше *имя* или *логин*, чтобы занести ваши данные в общую Google Таблицу!`;
              await sendCleanBotMessage(chatId, fallbackMsg);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error in Telegram Bot long polling:", err);
      // Delay retry on failure to avoid hitting limits
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    // Small sleep between polls
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Static files / Vite entry points
async function start() {
  // API Telegram Auth Endpoint
  app.post("/api/telegram-auth", async (req, res) => {
    try {
      const { initData, widgetData } = req.body;
      let telegramUser: any = null;

      if (initData) {
        const isValid = verifyTelegramWebappSignature(TELEGRAM_BOT_TOKEN, initData);
        if (!isValid) {
          return res.status(401).json({ success: false, error: "Invalid signature" });
        }
        
        const params = new URLSearchParams(initData);
        const userJson = params.get("user");
        if (userJson) {
          telegramUser = JSON.parse(userJson);
        }
      } else if (widgetData) {
        const isValid = verifyTelegramWidgetSignature(TELEGRAM_BOT_TOKEN, widgetData);
        if (!isValid) {
          return res.status(401).json({ success: false, error: "Invalid signature" });
        }
        telegramUser = widgetData;
      }

      if (!telegramUser || !telegramUser.id) {
        return res.status(400).json({ success: false, error: "Missing user identity" });
      }

      const telegramId = String(telegramUser.id);
      const username = telegramUser.username || "";
      const firstName = telegramUser.first_name || "";
      const lastName = telegramUser.last_name || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || `Telegram Player ${telegramId}`;
      const photoUrl = telegramUser.photo_url || "";

      const uid = `telegram_${telegramId}`;
      const email = `tg_${telegramId}@telegram-auth.game`;
      const securePassword = crypto
        .createHmac("sha256", TELEGRAM_BOT_TOKEN)
        .update(telegramId)
        .digest("hex");

      res.json({
        success: true,
        email: email,
        password: securePassword,
        displayName: fullName,
        photoURL: photoUrl,
        user: {
          uid: uid,
          id: telegramId,
          username: username,
          displayName: fullName,
          photoURL: photoUrl
        }
      });
    } catch (err: any) {
      console.error("Telegram auth API failure:", err);
      res.status(500).json({ success: false, error: err.message || "Internal server error" });
    }
  });

  // API Telegram Notify Save Endpoint (respects user status)
  app.post("/api/telegram-notify-save", async (req, res) => {
    try {
      const { telegramId, playerName, coins, notificationsEnabled } = req.body;
      if (!telegramId) {
        return res.status(400).json({ success: false, error: "Missing telegramId" });
      }

      // If notifications explicitly disabled, do not send messages to prevent annoyance
      if (notificationsEnabled === false) {
        return res.json({ success: true, message: "Notifications are disabled by user." });
      }

      const msg = `✅ *Ваш прогресс успешно синхронизирован!* 💾\n\n👤 Игрок: *${playerName || "Игрок"}*\n💰 Баланс: *${Math.floor(coins || 0).toLocaleString()}* монет\n\n🟢 *Вы подтверждены! Удачной игры!* 🎮`;

      await sendCleanBotMessage(Number(telegramId), msg, {
        keepHistory: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❌ Удалить это сообщение", callback_data: "delete_this" },
              { text: "🧹 Удалить все уведомления", callback_data: "delete_all" }
            ]
          ]
        }
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to send save notification over telegram:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Telegram Toggle Notifications
  app.post("/api/telegram-toggle-notifications", async (req, res) => {
    try {
      const { telegramId, enabled, playerName } = req.body;
      if (!telegramId) {
        return res.status(400).json({ success: false, error: "Missing telegramId" });
      }

      const chatIdNum = Number(telegramId);
      if (enabled) {
        const msg = `🔔 *Уведомления подключены, хорошей игры!* 🎮`;
        await sendCleanBotMessage(chatIdNum, msg, {
          keepHistory: true,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "❌ Удалить это сообщение", callback_data: "delete_this" },
                { text: "🧹 Удалить все уведомления", callback_data: "delete_all" }
              ]
            ]
          }
        });
      } else {
        const msg = `🔕 *Уведомления от бота отключены.* \n\nВы всегда можете включить их в настройках игры в любой момент.`;
        await sendCleanBotMessage(chatIdNum, msg, {
          keepHistory: true,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "❌ Удалить это сообщение", callback_data: "delete_this" },
                { text: "🧹 Удалить все уведомления", callback_data: "delete_all" }
              ]
            ]
          }
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to toggle notifications:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Telegram Support Reply endpoint
  app.post("/api/support-reply", async (req, res) => {
    try {
      const { chatId, message } = req.body;
      if (!chatId || !message) {
        return res.status(400).json({ success: false, error: "Missing parameters" });
      }

      const msg = `💬 *Ответ от Администратора*\n\n${message}`;
      await sendCleanBotMessage(Number(chatId), msg, {
        keepHistory: true, // we want them to see the reply
        reply_markup: DEFAULT_KEYBOARD
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Support reply failed:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Map to store temporary QR login tokens: token -> { uid, email, password, displayName, photoURL, createdAt }
  const qrLoginTokens = new Map<string, {
    uid: string;
    email: string;
    password?: string;
    displayName?: string;
    photoURL?: string;
    createdAt: number;
  }>();

  // API Telegram Verification Code Login Endpoint
  app.post("/api/generate-login-token", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, error: "Unauthorized" });
      }
      const idToken = authHeader.split("Bearer ")[1];
      const decoded = await getAuth().verifyIdToken(idToken);
      const uid = decoded.uid;
      const email = decoded.email || `${uid}@click-clan-temp.game`;
      const displayName = decoded.name || email.split("@")[0];
      const photoURL = decoded.picture || "";

      const { password } = req.body;
      let finalPassword = password;

      if (!finalPassword) {
        // Generate a temporary password if none is provided
        finalPassword = "qr_gen_pw_" + crypto.randomBytes(8).toString("hex");
        try {
          await getAuth().updateUser(uid, { password: finalPassword });
        } catch (updateErr: any) {
          console.error("Failed to set temporary password for QR login:", updateErr);
        }
      }

      // Generate random secure token
      const token = crypto.randomUUID();
      qrLoginTokens.set(token, {
        uid,
        email,
        password: finalPassword,
        displayName,
        photoURL,
        createdAt: Date.now()
      });

      // Cleanup old tokens (older than 5 mins)
      const now = Date.now();
      for (const [key, value] of qrLoginTokens.entries()) {
        if (now - value.createdAt > 300000) {
          qrLoginTokens.delete(key);
        }
      }

      res.json({ success: true, token });
    } catch (err: any) {
      console.error("Token generation error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/exchange-login-token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ success: false, error: "Токен обязателен." });
      }

      const tokenData = qrLoginTokens.get(token);
      if (!tokenData) {
        return res.status(404).json({ success: false, error: "Недействительный или просроченный токен." });
      }

      // Check expiration (5 minutes)
      if (Date.now() - tokenData.createdAt > 300000) {
        qrLoginTokens.delete(token);
        return res.status(410).json({ success: false, error: "Срок действия токена истек." });
      }

      // Single-use token: remove immediately
      qrLoginTokens.delete(token);

      res.json({
        success: true,
        email: tokenData.email,
        password: tokenData.password,
        displayName: tokenData.displayName || "Игрок",
        photoURL: tokenData.photoURL || ""
      });
    } catch (err: any) {
      console.error("Token exchange error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/telegram-code-login", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ success: false, error: "Код авторизации обязателен." });
      }

      const cleanCode = code.trim().toUpperCase();
      const codeData = verificationCodes.get(cleanCode);

      if (!codeData) {
        return res.status(400).json({ success: false, error: "Неверный или истекший код авторизации." });
      }

      // 10 minutes expiry check
      if (Date.now() - codeData.createdAt > 10 * 60 * 1000) {
        verificationCodes.delete(cleanCode);
        return res.status(400).json({ success: false, error: "Срок действия кода истек." });
      }

      // Consume valid code after a 30 second grace period to allow client retry cushion
      setTimeout(() => {
        verificationCodes.delete(cleanCode);
      }, 30000);

      const telegramId = codeData.id;
      const username = codeData.username;
      const uid = `telegram_${telegramId}`;
      const fullName = [codeData.first_name, codeData.last_name].filter(Boolean).join(" ") || `Telegram Player ${telegramId}`;

      const email = `tg_${telegramId}@telegram-auth.game`;
      const securePassword = crypto
        .createHmac("sha256", TELEGRAM_BOT_TOKEN)
        .update(telegramId)
        .digest("hex");

      res.json({
        success: true,
        email: email,
        password: securePassword,
        displayName: fullName,
        photoURL: "",
        user: {
          uid: uid,
          id: telegramId,
          username: username,
          displayName: fullName,
          photoURL: ""
        }
      });
    } catch (err: any) {
      console.error("Telegram verification code login API failure:", err);
      res.status(500).json({ success: false, error: err.message || "Ошибка сервера" });
    }
  });

  app.post("/api/log-trade", async (req, res) => {
    const { buyerId, sellerId, itemTitle, price } = req.body;
    try {
      const dbInstance = await getAuthenticatedDb();
      // Get seller sheet ID
      const sellerDoc = await getDoc(doc(dbInstance, "users", sellerId));
      if (sellerDoc.exists()) {
        const sellerSheetId = sellerDoc.data().sheetId;
        if (sellerSheetId) {
          await appendToGoogleSheet(sellerSheetId, [new Date().toISOString(), "Sale", itemTitle, price, buyerId]);
        }
      }
      
      // Get buyer sheet ID
      const buyerDoc = await getDoc(doc(dbInstance, "users", buyerId));
      if (buyerDoc.exists()) {
        const buyerSheetId = buyerDoc.data().sheetId;
        if (buyerSheetId) {
          await appendToGoogleSheet(buyerSheetId, [new Date().toISOString(), "Purchase", itemTitle, price, sellerId]);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Trade logging error:", error);
      res.status(500).json({ error: "Trade logging failed" });
    }
  });

  app.post("/api/sync-sheet", async (req, res) => {
    const { userId, coins, clicks, playerName } = req.body;
    try {
      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }
      const dbInstance = await getAuthenticatedDb();
      const userDoc = await getDoc(doc(dbInstance, "users", userId));
      if (userDoc.exists()) {
        const sheetId = userDoc.data().sheetId;
        if (sheetId) {
          await appendToGoogleSheet(sheetId, [userId, playerName || "Игрок", coins || 0, clicks || 0, new Date().toISOString()]);
          return res.json({ success: true, message: "Successfully synced to sheet" });
        }
      }
      res.json({ success: false, message: "No sheetId configured for user" });
    } catch (error) {
      console.error("Manual sheet sync error:", error);
      res.status(500).json({ error: "Manual sheet sync failed" });
    }
  });

  // Dynamic Telegram Bot config endpoint
  let botUsername = "";
  try {
    fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.ok && data.result) {
          botUsername = data.result.username;
          console.log(`Telegram Bot username fetched dynamically: @${botUsername}`);
        }
      })
      .catch((err) => {
        console.error("Async fetch of bot info failed:", err);
      });
  } catch (err) {
    console.error("Failed to trigger fetch of telegram bot info:", err);
  }

  app.get("/api/telegram-config", (req, res) => {
    res.json({ botUsername: botUsername || "MyTelegramGameBot" });
  });

  // API to generate a login code for the game client
  app.get("/api/telegram-login-code", (req, res) => {
    try {
      const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }

      pendingClientCodes.set(code, {
        code,
        resolved: false,
        createdAt: Date.now()
      });

      // Clean up old codes (>10 min)
      const now = Date.now();
      pendingClientCodes.forEach((val, key) => {
        if (now - val.createdAt > 10 * 60 * 1000) {
          pendingClientCodes.delete(key);
        }
      });

      res.json({ success: true, code });
    } catch (err: any) {
      console.error("Failed to generate login code:", err);
      res.status(500).json({ success: false, error: err.message || "Internal server error" });
    }
  });

  // API to poll and check if a user sent this code to the TG bot
  app.get("/api/telegram-login-poll", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ success: false, error: "Код обязателен." });
      }

      const upperCode = code.trim().toUpperCase();
      const codeData = pendingClientCodes.get(upperCode);

      if (!codeData) {
        return res.json({ success: true, resolved: false, error: "Код не найден или истек." });
      }

      // Check expiry (10 min)
      if (Date.now() - codeData.createdAt > 10 * 60 * 1000) {
        pendingClientCodes.delete(upperCode);
        return res.json({ success: true, resolved: false, error: "Время действия кода истекло." });
      }

      if (codeData.resolved && codeData.telegramUser) {
        const telegramId = codeData.telegramUser.id;
        const username = codeData.telegramUser.username;
        const uid = `telegram_${telegramId}`;
        const fullName = [codeData.telegramUser.first_name, codeData.telegramUser.last_name].filter(Boolean).join(" ") || `Telegram Player ${telegramId}`;

        const email = `tg_${telegramId}@telegram-auth.game`;
        const securePassword = crypto
          .createHmac("sha256", TELEGRAM_BOT_TOKEN)
          .update(telegramId)
          .digest("hex");

        // Consume the code so it can't be reused
        pendingClientCodes.delete(upperCode);

        return res.json({
          success: true,
          resolved: true,
          email: email,
          password: securePassword,
          displayName: fullName,
          photoURL: "",
          user: {
            uid: uid,
            id: telegramId,
            username: username,
            displayName: fullName,
            photoURL: ""
          }
        });
      }

      return res.json({ success: true, resolved: false });
    } catch (err: any) {
      console.error("Error polling client code:", err);
      res.status(500).json({ success: false, error: err.message || "Ошибка сервера" });
    }
  });

  // GET admin config settings
  app.get("/api/admin/config", (req, res) => {
    res.json({
      masterSheetId,
      admins,
      moderators,
      whitelistEnabled,
      whitelistCodes,
      voiceStartHour,
      voiceEndHour
    });
  });

  // Verify whitelist code
  app.post("/api/whitelist/verify", (req, res) => {
    const { code } = req.body;
    if (!whitelistEnabled) {
      return res.json({ success: true, valid: true });
    }
    if (whitelistCodes.includes(code)) {
      res.json({ success: true, valid: true });
    } else {
      res.json({ success: true, valid: false });
    }
  });

  // Get whitelist status
  app.get("/api/whitelist/status", (req, res) => {
    res.json({ enabled: whitelistEnabled });
  });

  // POST update admin config settings
  app.post("/api/admin/config", (req, res) => {
    try {
      const { masterSheetId: newSheetId, admins: newAdmins, moderators: newModerators, whitelistEnabled: newWhitelistEnabled, whitelistCodes: newWhitelistCodes, voiceStartHour: newVoiceStart, voiceEndHour: newVoiceEnd } = req.body;
      
      if (typeof newSheetId === "string") masterSheetId = newSheetId;
      if (Array.isArray(newAdmins)) admins = newAdmins;
      if (Array.isArray(newModerators)) moderators = newModerators;
      if (typeof newWhitelistEnabled === "boolean") whitelistEnabled = newWhitelistEnabled;
      if (Array.isArray(newWhitelistCodes)) whitelistCodes = newWhitelistCodes;
      if (typeof newVoiceStart === "number") voiceStartHour = newVoiceStart;
      if (typeof newVoiceEnd === "number") voiceEndHour = newVoiceEnd;
      
      saveConfig();
      res.json({ success: true, masterSheetId, admins, moderators, whitelistEnabled, whitelistCodes, voiceStartHour, voiceEndHour });
    } catch (err: any) {
      console.error("Failed to update config:", err);
      res.status(500).json({ success: false, error: err.message || "Ошибка обновления настроек" });
    }
  });

  // API Health endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", onlineCount: players.size });
  });

  app.get("/api/game-status", (req, res) => {
    res.json({ isRunning: isGameRunning });
  });

  app.post("/api/game-control", (req, res) => {
    const { action } = req.body;
    if (action === "start") {
      isGameRunning = true;
    } else if (action === "stop") {
      isGameRunning = false;
    } else {
      return res.status(400).json({ error: "Invalid action" });
    }
    res.json({ isRunning: isGameRunning });
  });

  // API path to fetch synchronized server time (timestamp)
  app.get("/api/time", (req, res) => {
    res.json({ serverTime: Date.now() });
  });

  // API to download pre-configured PC launcher with all source code zip
  app.get("/api/download-launcher", (req, res) => {
    try {
      console.log("[Launcher API] Generating launcher zip on-the-fly...");
      const zip = new AdmZip();
      
      // Root files to package
      const rootFiles = [
        "package.json",
        "server.ts",
        "desktop-main.cjs",
        "УСТАНОВКА_ИГРЫ.bat",
        "start.bat",
        "tsconfig.json",
        "vite.config.ts",
        "index.html",
        "metadata.json",
        "firestore.rules",
        "firebase-applet-config.json",
        ".env.example"
      ];

      for (const file of rootFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          zip.addLocalFile(filePath);
        }
      }

      // Add the entire src and public directories
      const srcPath = path.join(process.cwd(), "src");
      if (fs.existsSync(srcPath)) {
        zip.addLocalFolder(srcPath, "src");
      }
      
      const publicPath = path.join(process.cwd(), "public");
      if (fs.existsSync(publicPath)) {
        zip.addLocalFolder(publicPath, "public");
      }

      const zipBuffer = zip.toBuffer();
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=clicker-launcher.zip");
      res.send(zipBuffer);
    } catch (err: any) {
      console.error("[Launcher API] Failed to generate desktop launcher zip:", err);
      res.status(500).send("Ошибка создания лаунчера: " + (err.message || err));
    }
  });

  if (process.env.NODE_ENV !== "production") {
    // Development Mode
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    // Start background Firestore marketplace listener to sync listings with all players
    listenToMarketplace().catch((err) => {
      console.error("Marketplace listener routine failed:", err);
    });

    // Start background real-time user database synchronizer to support 24/7 clan battles and persistency
    syncUsersFromFirestore().catch((err) => {
      console.error("User db synchronizer routine failed:", err);
    });

    // Start background real-time clans config database synchronizer
    syncClansFromFirestore().catch((err) => {
      console.error("Clans db synchronizer routine failed:", err);
    });

    // Start background polling for Telegram Bot commands/login codes
    startTelegramBotPolling().catch((err) => {
      console.error("Bot polling routine crashed:", err);
    });

    // Start background polling for VK Bot commands
    startVkBotPolling().catch((err) => {
      console.error("VK Bot polling routine crashed:", err);
    });

    // Start background interval for Clan Wars checking and ticking (runs every 1 second)
    setInterval(() => {
      if (!isGameRunning) return;
      try {
        // 1. Calculate active clan production rates
        const realScores = calculateClanProduction();
        
        // Add active simulation boost offsets
        clanWarState.clanProductionScores = { ...realScores };
        for (const cl in clProductionSimBoost) {
          clanWarState.clanProductionScores[cl] = (clanWarState.clanProductionScores[cl] || 0) + clProductionSimBoost[cl];
        }
        
        // 2. Check current phase
        if (clanWarState.isWarActive) {
          if (clanWarState.countdownSeconds > 0) {
            clanWarState.countdownSeconds--;
            
            // Simulating real-time rival clicks and progress to make the battle a real live competition!
            const triggeringClan = clanWarState.triggeringClan || null;
            Object.keys(clanWarState.clansWarPoints).forEach(cName => {
              // Only simulate rivals (clans other than our triggering clan)
              if (cName !== triggeringClan) {
                const rivalTapPower = Math.floor(Math.random() * 250) + 120; // 120-370 points per second
                clanWarState.clansWarPoints[cName] = (clanWarState.clansWarPoints[cName] || 0) + rivalTapPower;
              }
            });
          } else {
            // War has concluded! Decide the victor
            clanWarState.isWarActive = false;
            
            let winnerClan: string | null = null;
            let maxPoints = -1;
            
            for (const clanName in clanWarState.clansWarPoints) {
              const pts = clanWarState.clansWarPoints[clanName] || 0;
              if (pts > maxPoints) {
                maxPoints = pts;
                winnerClan = clanName;
              } else if (pts === maxPoints && pts > 0) {
                // simple tie-breaker or multiple winners can be handled or left
              }
            }
            
            if (winnerClan && maxPoints > 0) {
              clanWarState.lastWarWinner = winnerClan;
              
              // Reward online members with coins and persist to Firestore
              for (const player of players.values()) {
                if (player.clan === winnerClan) {
                  player.coins += clanWarState.lastWarWinnerReward;
                  players.set(player.id, player);
                  
                  // Persist to Cloud Firestore so progress isn't lost (works 24/7)
                  getAuthenticatedDb().then((dbInstance) => {
                    const userRef = doc(dbInstance, "users", player.id);
                    updateDoc(userRef, {
                      coins: player.coins,
                      updatedAt: new Date()
                    }).catch((err) => {
                      console.error(`[Clan Reward Fail] Could not update coins in Firestore for user ${player.id}:`, err);
                    });
                  }).catch((err) => {
                    console.error("[Clan Reward DB Fail] Could not obtain DB instance:", err);
                  });
                }
              }
              
              // Record war history
              const warRecord = {
                winner: winnerClan,
                triggeringClan: clanWarState.triggeringClan || winnerClan,
                points: { ...clanWarState.clansWarPoints },
                timestamp: Date.now()
              };
              clanWarState.history.unshift(warRecord);
              if (clanWarState.history.length > 10) {
                clanWarState.history.pop();
              }
              
              // Push announcement into the public chat log
              const systemMsg = `⚔️ Битва Кланов завершена! Клан [${winnerClan}] одержал сокрушительную победу с результатом в ${maxPoints} очков! Соратники получают награду +${clanWarState.lastWarWinnerReward} 💰 монет!`;
              chatMessages.push({
                id: "sys_war_end_" + Date.now(),
                playerId: "system",
                playerName: "📜 СИСТЕМА",
                clan: null,
                text: systemMsg,
                timestamp: new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }),
                color: "#ff3e3e"
              });
              if (chatMessages.length > 50) chatMessages.shift();
            } else {
              clanWarState.lastWarWinner = null;
              const systemMsg = `⚔️ Битва Кланов завершилась вничью. Ни один клан не набрал боевых очков!`;
              chatMessages.push({
                id: "sys_war_end_" + Date.now(),
                playerId: "system",
                playerName: "📜 СИСТЕМА",
                clan: null,
                text: systemMsg,
                timestamp: new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }),
                color: "#9ca3af"
              });
              if (chatMessages.length > 50) chatMessages.shift();
            }
            
            // Clean up and enter peaceful target tracking again
            clanWarState.triggeringClan = null;
            clanWarState.countdownSeconds = 0;
            clanWarState.clansWarPoints = {};
            clProductionSimBoost = {};
            
            broadcastPlayers();
          }
          
          broadcastClanWarState();
        } else if (clanWarState.triggeringClan) {
          // We are in countdown phase
          if (clanWarState.countdownSeconds > 0) {
            clanWarState.countdownSeconds--;
          } else {
            // Countdown ended, start the war!
            clanWarState.isWarActive = true;
            clanWarState.countdownSeconds = 45; // 45 seconds of glorious tapping action
            clanWarState.clansWarPoints = {};
            
            // Seed all known clans into the war points system
            Object.keys(clanWarState.clanProductionScores).forEach(cl => {
              clanWarState.clansWarPoints[cl] = 0;
            });
            if (clanWarState.triggeringClan && !clanWarState.clansWarPoints[clanWarState.triggeringClan]) {
              clanWarState.clansWarPoints[clanWarState.triggeringClan] = 0;
            }

            // Ensure we ALWAYS have active rival clans to compete with!
            const triggeringClanName = clanWarState.triggeringClan || "ЛЕГЕНДЫ";
            const currentSeeded = Object.keys(clanWarState.clansWarPoints);
            const userOpponents = currentSeeded.filter(c => c !== triggeringClanName);
            
            // Determine if there is any player in the triggering clan with level <= 5
            const triggeringClanPlayers = Array.from(players.values()).filter(p => p.clan === triggeringClanName);
            const hasInitialLevelPlayer = triggeringClanPlayers.length === 0 || triggeringClanPlayers.some(p => {
              const lvl = getPlayerLevel(p.clicks || 0);
              return lvl <= 5;
            });

            if (userOpponents.length === 0 || hasInitialLevelPlayer) {
              // Seed our primary balanced rival bots!
              clanWarState.clansWarPoints["ТЁМНЫЕ ВОЛКИ"] = 0;
              clanWarState.clansWarPoints["КРАСНЫЕ ДРАКОНЫ"] = 0;
            }
            
            const startMsg = `⚔️ НАЧАЛАСЬ БИТВА КЛАНОВ! Кто покорит таблицу? Кликайте по боевой кнопке во вкладке «Битва Кланов» следующие 45 секунд, продвиньте свой клан!`;
            chatMessages.push({
              id: "sys_war_start_" + Date.now(),
              playerId: "system",
              playerName: "📜 СИСТЕМА",
              clan: null,
              text: startMsg,
              timestamp: new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }),
              color: "#e67e22"
            });
            if (chatMessages.length > 50) chatMessages.shift();
            
            broadcastPlayers();
          }
          
          broadcastClanWarState();
        } else {
          // Normal monitoring phase: look for any clan breaking target threshold
          for (const clName in clanWarState.clanProductionScores) {
            const prod = clanWarState.clanProductionScores[clName] || 0;
            if (prod >= clanWarState.triggerThreshold) {
              clanWarState.triggeringClan = clName;
              clanWarState.countdownSeconds = 30; // 30 seconds countdown to allow players to coordinate!
              clanWarState.clansWarPoints = {};
              
              const warnMsg = `🚨 Клан [${clName}] превысил лимит производства монет (${prod}/${clanWarState.triggerThreshold} 💰/сек) и инициировал Битву Кланов! До начала войны: 30 секунд! Приготовьтесь к бою!`;
              chatMessages.push({
                id: "sys_war_warn_" + Date.now(),
                playerId: "system",
                playerName: "📜 СИСТЕМА",
                clan: null,
                text: warnMsg,
                timestamp: new Date().toLocaleTimeString("ru-RU", { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }),
                color: "#e67e22"
              });
              if (chatMessages.length > 50) chatMessages.shift();
              
              broadcastPlayers();
              break;
            }
          }
          
          broadcastClanWarState();
        }
      } catch (e) {
        console.error("Timer loop error:", e);
      }
    }, 1000);
  });
}

start().catch((err) => {
  console.error("Failed to start fullstack server:", err);
});
