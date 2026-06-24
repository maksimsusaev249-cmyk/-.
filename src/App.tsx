import React, { useState, useEffect, useRef } from "react";
import { 
  Globe, 
  Settings, 
  Send, 
  X, 
  Users, 
  Shield, 
  Star, 
  LogOut,
  KeyRound,
  ArrowRight,
  ExternalLink,
  Monitor,
  Smartphone,
  Search,
  Home,
  HelpCircle,
  Check, 
  ChevronRight, 
  User, 
  Info, 
  Plus, 
  Trash2, 
  RefreshCw,
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
  Store,
  Tag,
  MessageSquare,
  Lock,
  ShoppingBag,
  ChevronDown,
  Menu,
  Calendar,
  Swords,
  MessageCircle,
} from "lucide-react";
const swordImg = "/images/item_sword.jpg";
const potionImg = "/images/item_potion.jpg";
const shieldImg = "/images/item_shield.jpg";
import { motion, AnimatePresence } from "motion/react";
import { auth, db, googleProvider, signInWithPopup, signOut } from "./firebase";
import { doc, getDocFromServer, getDoc, setDoc, serverTimestamp, collection, addDoc, getDocs, query, where, onSnapshot, deleteDoc, updateDoc, runTransaction, limit } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Leaderboard } from "./components/Leaderboard";
import { AdminConsole } from "./components/AdminConsole";
import { getApiUrl } from "./utils/api";
import vkBridge from "@vkontakte/vk-bridge";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (errInfo.error.includes("Quota exceeded")) {
    alert("Квота Firebase исчерпана. Пожалуйста, попробуйте снова завтра.");
  }
}


const playPurchaseSound = () => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const audioCtx = new Ctx();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch(e) {
    console.error("Audio playback error:", e);
  }
};


// --- TYPES & INTERFACES ---
interface Player {
  id: string;
  name: string;
  clan: string | null;
  coins: number;
  clicks: number;
  color: string;
  lastSeen: number;
  photoURL?: string;
  isOnline?: boolean;
  telegramId?: string | null;
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
  senderId?: string;
  senderName?: string;
}

interface ClickSparkle {
  id: number;
  x: number;
  y: number;
  text: string;
}

interface Quest {
  id: number;
  type: "clicks" | "coins";
  target: number;
  reward: number;
  desc: string;
}

const playNotificationReceivedChime = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First tone (higher-pitched double chime)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);

    // Second tone (slightly higher, delayed by 0.08s)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08); // D6
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.08);
    gain2.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.095);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.25);
  } catch (e) {}
};

const playNotificationReceivedClassic = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.15); // C6
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch (e) {}
};

const playNotificationReceivedTech = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.setValueAtTime(1500, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
};

const playNotificationSentPop = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {}
};

const playNotificationSentSwoosh = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(250, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.14);
    
    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {}
};

const playNotificationSentRetro = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
};

const playNotificationSound = (customSoundKey?: string, forcePlay = false) => {
  try {
    const soundOn = localStorage.getItem("gameSoundEnabledV12") !== "false";
    if (!soundOn && !forcePlay) return;

    const selected = customSoundKey || localStorage.getItem("gameReceivedSoundV1") || "iphone-sound-message";

    if (selected === "iphone-sound-message") {
      playNotificationReceivedChime();
    } else if (selected === "sine-synth") {
      playNotificationReceivedClassic();
    } else if (selected === "cyber-beep") {
      playNotificationReceivedTech();
    } else {
      playNotificationReceivedChime();
    }
  } catch (e) {
    // Audio context might be blocked if no user interaction yet, ignore
  }
};

const playSentSound = (customSoundKey?: string, forcePlay = false) => {
  try {
    const soundOn = localStorage.getItem("gameSoundEnabledV12") !== "false";
    if (!soundOn && !forcePlay) return;

    const selected = customSoundKey || localStorage.getItem("gameSentSoundV1") || "iphone-sent-message";

    if (selected === "iphone-sent-message") {
      playNotificationSentPop();
    } else if (selected === "iphone-message-swoosh") {
      playNotificationSentSwoosh();
    } else if (selected === "triangle-synth") {
      playNotificationSentRetro();
    } else {
      playNotificationSentPop();
    }
  } catch (e) {
    // Audio context might be blocked or ignored
  }
};

export default function App() {
  // --- VERSION STATE ---
  const [appVersion, setAppVersion] = useState<"pc" | "mobile" | null>(() => {
    const saved = localStorage.getItem("appVersion");
    return (saved as "pc" | "mobile") || null;
  });

  // --- CORE GAME STATES ---
  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.coins === "number" ? parsed.coins : 0;
      }
    } catch (e) {
      console.error("Failed to parse coins from gameDataV9", e);
    }
    return 0;
  });

  const [clickPowerLevel, setClickPowerLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.clickPowerLevel === "number" ? parsed.clickPowerLevel : 1;
      }
    } catch (e) {
      console.error("Failed to parse clickPowerLevel from gameDataV9", e);
    }
    return 1;
  });

  const [autoClickerLevel, setAutoClickerLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.autoClickerLevel === "number" ? parsed.autoClickerLevel : 0;
      }
    } catch (e) {
      console.error("Failed to parse autoClickerLevel from gameDataV9", e);
    }
    return 0;
  });

  const [energyLevel, setEnergyLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.energyLevel === "number" ? parsed.energyLevel : 1;
      }
    } catch (e) {
      console.error("Failed to parse energyLevel from gameDataV9", e);
    }
    return 1;
  });

  const [energy, setEnergy] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.energy === "number" ? parsed.energy : 100;
      }
    } catch (e) {
      console.error("Failed to parse energy from gameDataV9", e);
    }
    return 100;
  });

  const [maxEnergy, setMaxEnergy] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.maxEnergy === "number" ? parsed.maxEnergy : 100;
      }
    } catch (e) {
      console.error("Failed to parse maxEnergy from gameDataV9", e);
    }
    return 100;
  });

  const [regenRate, setRegenRate] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.regenRate === "number" ? parsed.regenRate : 1;
      }
    } catch (e) {
      console.error("Failed to parse regenRate from gameDataV9", e);
    }
    return 1;
  });

  const [totalClicks, setTotalClicks] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return typeof parsed.totalClicks === "number" ? parsed.totalClicks : 0;
      }
    } catch (e) {
      console.error("Failed to parse totalClicks from gameDataV9", e);
    }
    return 0;
  });

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.playerName || "Игрок";
      }
    } catch (e) {
      console.error("Failed to parse playerName from gameDataV9", e);
    }
    return "Игрок";
  });

  const [playerClan, setPlayerClan] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.playerClan || null;
      }
    } catch (e) {
      console.error("Failed to parse playerClan from gameDataV9", e);
    }
    return null;
  });

  const [playerId] = useState<string>(() => {
    const saved = localStorage.getItem("myPlayerIdV9");
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem("myPlayerIdV9", newId);
    return newId;
  });

  const [playerColor, setPlayerColor] = useState<string>("#e67e22");
  const [isSyncing, setIsSyncing] = useState(false);

  const [currentQuest, setCurrentQuest] = useState<Quest>(() => {
    try {
      const saved = localStorage.getItem("gameDataV9");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentQuest) return parsed.currentQuest;
      }
    } catch (e) {
      console.error("Failed to parse currentQuest from gameDataV9", e);
    }
    return { id: 1, type: "clicks", target: 100, reward: 100, desc: "Сделать 100 кликов" };
  });

  // --- SOCIAL NETWORKING STATES ---
  const [onlinePlayers, setOnlinePlayers] = useState<Player[]>([]);
  const [globalChatHistory, setGlobalChatHistory] = useState<ChatMessage[]>([]);
  const [clanChatHistory, setClanChatHistory] = useState<ChatMessage[]>([]);
  const [chatChannel, setChatChannel] = useState<"global" | "clan">("global");
  const [friendsList, setFriendsList] = useState<string[]>(() => {
    const saved = localStorage.getItem("gameFriendsV9");
    return saved ? JSON.parse(saved) : [];
  });

  const [mutedPlayers, setMutedPlayers] = useState<string[]>(() => {
    const saved = localStorage.getItem("gameMutedPlayersV9");
    return saved ? JSON.parse(saved) : [];
  });

  const mutedPlayersRef = useRef<string[]>(mutedPlayers);

  useEffect(() => {
    mutedPlayersRef.current = mutedPlayers;
    localStorage.setItem("gameMutedPlayersV9", JSON.stringify(mutedPlayers));
  }, [mutedPlayers]);

  // --- FRIEND CHAT (DIRECT MESSAGE) STATES ---
  const [directMessages, setDirectMessages] = useState<{ [friendId: string]: any[] }>(() => {
    const saved = localStorage.getItem("gameDirectMsgsV9");
    return saved ? JSON.parse(saved) : {};
  });
  const [activeFriendChatId, setActiveFriendChatId] = useState<string | null>(null);
  const activeFriendChatIdRef = useRef<string | null>(null);
  const isVKAuthInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    activeFriendChatIdRef.current = activeFriendChatId;
  }, [activeFriendChatId]);
  const [friendChatMessageText, setFriendChatMessageText] = useState("");

  useEffect(() => {
    localStorage.setItem("gameDirectMsgsV9", JSON.stringify(directMessages));
  }, [directMessages]);

  const ITEM_MAP = {
    sword: swordImg,
    potion: potionImg,
    shield: shieldImg,
    custom: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
  };

// --- INTERACTION STATES ---
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const timeOffsetRef = useRef<number>(0);
  const [realTime, setRealTime] = useState<string>("");
  const [isTimeSynced, setIsTimeSynced] = useState<boolean>(false);

  // Synchronize client clock with server time to support precise timing and prevent local clock manipulation
  useEffect(() => {
    let active = true;
    const syncClock = async () => {
      try {
        const start = Date.now();
        const res = await fetch(getApiUrl("/api/time"));
        const data = await res.json();
        const end = Date.now();
        // Calculate network roundtrip latency delay
        const roundTripDelay = (end - start) / 2;
        const serverTimeWithDelay = Number(data.serverTime) + roundTripDelay;
        const offset = serverTimeWithDelay - end;
        if (active) {
          setTimeOffset(offset);
          timeOffsetRef.current = offset;
          setIsTimeSynced(true);
          console.log(`[Time Sync] Clock synced with server. Offset: ${offset}ms.`);
        }
      } catch (err) {
        console.warn("[Time Sync] Could not sync with server time, using local system clock.", err);
        if (active) {
          // Immediately flag as synced on error to fallback to local device clock for offline calculations
          setIsTimeSynced(true);
        }
      }
    };

    // Safety timeout: if server sync doesn't complete in 2.5s, fallback to device time
    const fallbackTimeout = setTimeout(() => {
      if (active && !isTimeSynced) {
        setIsTimeSynced(true);
        console.warn("[Time Sync] Sync request timed out. Falling back to device time.");
      }
    }, 2500);

    syncClock();
    
    // Periodically re-sync clock every 5 minutes to prevent local drifts
    const resyncInterval = setInterval(syncClock, 300000);
    return () => {
      active = false;
      clearTimeout(fallbackTimeout);
      clearInterval(resyncInterval);
    };
  }, []);

  // Helper to format any date to Moscow timezone (UTC+3) to keep gameplay, chat and timers highly synchronized in player reference time
  const formatMoscowTime = (date?: Date, showSeconds: boolean = false): string => {
    try {
      const d = date || new Date(Date.now() + timeOffsetRef.current);
      return d.toLocaleTimeString("ru-RU", {
        timeZone: "Europe/Moscow",
        hour: "2-digit",
        minute: "2-digit",
        ...(showSeconds ? { second: "2-digit" } : {})
      });
    } catch (err) {
      const d = date || new Date(Date.now() + timeOffsetRef.current);
      return d.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        ...(showSeconds ? { second: "2-digit" } : {})
      });
    }
  };

  useEffect(() => {
    const updateTime = () => {
      setRealTime(formatMoscowTime(undefined, true));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const [clansMap, setClansMap] = useState<{ [key: string]: Player[] }>({});
  const [myFullClanMembers, setMyFullClanMembers] = useState<any[]>([]);
  const [isLoadingMyClanMembers, setIsLoadingMyClanMembers] = useState(false);
  const [clanVaultItems, setClanVaultItems] = useState<any[]>([]);
  const [isLoadingClanVault, setIsLoadingClanVault] = useState<boolean>(false);
  const [myClanActiveTab, setMyClanActiveTab] = useState<"players" | "vault">("players");
  const [activeMainTab, setActiveMainTab] = useState<"upgrades" | "quests" | "chat" | "shop" | "social" | "settings" | "clanwars">("upgrades");
  const [clanWarState, setClanWarState] = useState<any>({
    isWarActive: false,
    countdownSeconds: 0,
    triggeringClan: null,
    triggerThreshold: 10,
    clanProductionScores: {},
    clansWarPoints: {},
    lastWarWinner: null,
    lastWarWinnerReward: 5000,
    history: []
  });
  const [activeSocialTab, setActiveSocialTab] = useState<"players" | "clans" | "friends" | "leaderboard">("players");
  const [viewingProfile, setViewingProfile] = useState<Player | null>(null);
  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isWhitelistedRejected, setIsWhitelistedRejected] = useState(false);
  const [clanWarAttacksLeft, setClanWarAttacksLeft] = useState<number>(2);
  const [battleDamageEffects, setBattleDamageEffects] = useState<{ id: number; x: number; y: number; text: string }[]>([]);

  // --- MARKETPLACE / SHOP STATES ---
  const [activeShopTab, setActiveShopTab] = useState<"buy" | "sell">("buy");
  const [marketplaceListings, setMarketplaceListings] = useState<any[]>([]);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [purchasedListingId, setPurchasedListingId] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [viewingPlayerStore, setViewingPlayerStore] = useState<{id: string; name: string} | null>(null);
  const [newListingTitle, setNewListingTitle] = useState("");
  const [newListingDesc, setNewListingDesc] = useState("");
  const [newListingPrice, setNewListingPrice] = useState("");
  const [shopSearchQuery, setShopSearchQuery] = useState("");
  const [newListingImage, setNewListingImage] = useState<"sword" | "potion" | "shield" | "custom">("sword");
  const [customListingImage, setCustomListingImage] = useState("");
  const [isAddingListing, setIsAddingListing] = useState(false);
  const [activeSellingInventoryId, setActiveSellingInventoryId] = useState<string | null>(null);

  // Players refresh state
  const [isRefreshingPlayers, setIsRefreshingPlayers] = useState(false);

  // PC Launcher modal state
  const [isLauncherModalOpen, setIsLauncherModalOpen] = useState(false);
  const [launcherModalStep, setLauncherModalStep] = useState<"intro" | "instructions" | "downloading" | "success" | "canceled">("intro");

  // Torrent downloader simulator states
  const [torrentProgress, setTorrentProgress] = useState(0);
  const [torrentSpeed, setTorrentSpeed] = useState(14.8);
  const [torrentLogs, setTorrentLogs] = useState<string[]>(["Подключение к сидерам..."]);

  // Torrent downloader simulator engine
  useEffect(() => {
    if (launcherModalStep !== "downloading" || !isLauncherModalOpen) {
      return;
    }

    const logTemplates = [
      "Подключен пир из Москвы (скорость: 2.3 MB/s)",
      "Получен сегмент от сида g_genius",
      "Верификация хэш-суммы блока - Успех!",
      "Подключаем резервный трекер udp://tracker.co.ru:2710",
      "Синхронизация участников клана с ядром...",
      "Кулдаун сетевого буфера сброшен",
      "Скачивание текстур кликера и звуков звона монет...",
      "Добавлен новый пир: super_clicker_2026",
      "Оптимизация пиринговых трансляций для лучшего пинга"
    ];

    const interval = setInterval(() => {
      // Fluctuate speed slightly
      setTorrentSpeed(prev => {
        const fluctuation = (Math.random() - 0.5) * 1.5;
        const nextSpeed = Math.max(5.0, Math.min(65.0, prev + fluctuation));
        return parseFloat(nextSpeed.toFixed(1));
      });

      // Advance progress
      setTorrentProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        
        const speedFactor = torrentSpeed / 15.0; // scale progress rate with speed
        const step = Math.max(1, Math.floor(Math.random() * 3 + 1) * speedFactor);
        const next = Math.min(100, Math.floor(prev + step));
        
        if (next === 100) {
          setTorrentLogs(logs => [
            ...logs,
            `[${new Date().toLocaleTimeString()}] ✅ Раздача успешно загружена!`,
            `[${new Date().toLocaleTimeString()}] 🚀 Все компоненты верифицированы. Игра готова к запуску.`
          ]);
          addToast("⚡ Загрузка торрента завершена на 100%!");
        } else if (Math.random() < 0.4) {
          const randomTemplate = logTemplates[Math.floor(Math.random() * logTemplates.length)];
          setTorrentLogs(logs => {
            const nextLogs = [...logs, `[${new Date().toLocaleTimeString()}] ${randomTemplate}`];
            if (nextLogs.length > 5) {
              return nextLogs.slice(nextLogs.length - 5);
            }
            return nextLogs;
          });
        }
        return next;
      });
    }, 450);

    return () => clearInterval(interval);
  }, [launcherModalStep, isLauncherModalOpen, torrentSpeed]);

  // Account selection states
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [isAccountSwitching, setIsAccountSwitching] = useState(false);

  // Admin state
  const [isAdminConsoleOpen, setIsAdminConsoleOpen] = useState(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");

  // Custom UI Confirmation modal to replace blocked window.confirm inside iframes
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Shop Filters States
  const [shopCategory, setShopCategory] = useState<string>("all");
  const [shopSort, setShopSort] = useState<string>("newest");
  const [shopPriceMin, setShopPriceMin] = useState<string>("");
  const [shopPriceMax, setShopPriceMax] = useState<string>("");

  // Level Up Rewards States
  const [levelItems, setLevelItems] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("gameLevelItemsV12");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [lastClaimedLevel, setLastClaimedLevel] = useState<number>(() => {
    const saved = localStorage.getItem("gameLastClaimedLevelV12");
    return saved ? Number(saved) : 1;
  });

  const REWARD_DEFINITIONS = [
    { level: 2, title: "🪵 Простой Клик-Посох", desc: "Деревянный посох, наделенный слабой искрой силы. Можно выгодно продать на рынке лобби!", img: "sword", category: "weapons" },
    { level: 3, title: "🧪 Малое Зелье Бодрости", desc: "Быстро восстанавливает энергию кликера. Крайне востребовано среди новичков!", img: "potion", category: "potions" },
    { level: 4, title: "🛡️ Ржавый Щит Лобби", desc: "Обычный металлический щит. Защищает от случайных неудач.", img: "shield", category: "weapons" },
    { level: 5, title: "🎨 Магическая Сфера Творца", desc: "Сверкает чистым эфиром. Позволяет установить свой рисунок ценностью в миллионы коинов.", img: "custom", customImg: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", category: "custom" },
    { level: 6, title: "⚔️ Разящий Клик-Клинок", desc: "Стальной меч, выкованный для быстрых и решительных побед на рынке.", img: "sword", category: "weapons" },
    { level: 7, title: "🧪 Зелье Великого Разума", desc: "Загадочный нектар, наделенный небесной мудростью древних мастеров кликинга.", img: "potion", category: "potions" },
    { level: 8, title: "🛡️ Изумрудный Защитник", desc: "Редкий латный щит, инкрустированный чистейшим изумрудом и костями боссов.", img: "shield", category: "weapons" },
    { level: 9, title: "👑 Королевская Кокарда", desc: "Золотое украшение высочайшего сословия. Символизирует торговое признание.", img: "custom", customImg: "https://images.unsplash.com/photo-1590579491410-a434785fe334?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", category: "custom" },
    { level: 10, title: "🪐 Астральное Око", desc: "За гранью человеческого понимания. Светится космической силой Создателей.", img: "custom", customImg: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", category: "custom" }
  ];

  // Custom User Avatar States
  const [playerPhotoURL, setPlayerPhotoURL] = useState<string>(() => {
    const saved = localStorage.getItem("gameDataV9");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.playerPhotoURL || "https://api.dicebear.com/7.x/pixel-art/svg?seed=Lucky";
      } catch (e) {
        return "https://api.dicebear.com/7.x/pixel-art/svg?seed=Lucky";
      }
    }
    return "https://api.dicebear.com/7.x/pixel-art/svg?seed=Lucky";
  });
  const [customAvatarInput, setCustomAvatarInput] = useState("");

  const AVATAR_PRESETS = [
    { name: "Lucky (Пиксель-арт)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Lucky" },
    { name: "Sassy (Котик)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Sassy" },
    { name: "Shadow (Ниндзя)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Shadow" },
    { name: "Sparky (Робот)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Sparky" },
    { name: "Dragon (Ящер)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Dragon" },
    { name: "Viking (Воин)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Viking" },
    { name: "Panda (Панда)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Panda" },
    { name: "Angel (Ангел)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Angel" },
    { name: "Ghost (Призрак)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Ghost" },
    { name: "Champion (Корона)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Champion" },
    { name: "Magician (Маг)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Magician" },
    { name: "Phoenix (Жар-птица)", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Phoenix" }
  ];

  // Slide-up Bottom Sheet State
  const [activeBottomSheet, setActiveBottomSheet] = useState<"chat" | "quests" | "shop" | null>(null);

  // 24/7 Offline check Modal State
  const [offlineEarningsData, setOfflineEarningsData] = useState<{
    elapsedSeconds: number;
    coinsEarned: number;
    hours: number;
    mins: number;
    secs: number;
  } | null>(null);
  
  // --- GOOGLE AUTHENTICATION STATES ---
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const effectivePlayerId = currentUser?.uid || playerId;
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [syncProgress, setSyncProgress] = useState<number | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  // VK Bridge Initialization States
  const [vkInitStatus, setVkInitStatus] = useState<"idle" | "initializing" | "success" | "error" | "not_vk">("idle");
  const [vkInitError, setVkInitError] = useState<string | null>(null);

  // Safety timeout for auth loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthLoading) {
        console.warn("Auth initialization taking too long, forcing loading to false...");
        setIsAuthLoading(false);
      }
    }, 1200); // Optimized for ultra-fast startup (from 3500ms to 1200ms)
    return () => clearTimeout(timer);
  }, [isAuthLoading]);
  
  // --- TELEGRAM AUTHENTICATION STATES ---
  const [telegramCode, setTelegramCode] = useState("");
  const [isTelegramLoggingIn, setIsTelegramLoggingIn] = useState(false);
  const [botUsername, setBotUsername] = useState("MyTelegramGameBot");
  const [gameAuthCode, setGameAuthCode] = useState("");
  const [linkedTelegramId, setLinkedTelegramId] = useState<string | null>(null);
  
  // -- FORMS --
  const [editingName, setEditingName] = useState(playerName);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [clanSearchQuery, setClanSearchQuery] = useState("");
  const [customSearchResults, setCustomSearchResults] = useState<any[] | null>(null);
  const [isSearchingFirestore, setIsSearchingFirestore] = useState(false);
  
  // Clan state fields
  const [newClanName, setNewClanName] = useState("");
  const [newClanPassword, setNewClanPassword] = useState("");
  const [isClanPrivate, setIsClanPrivate] = useState(false);
  const [clansPrivacy, setClansPrivacy] = useState<{ name: string; isPrivate: boolean }[]>([]);
  
  // Trigger overlay modals without blocking iFrame alerts/confirms
  const [joiningClanWithPassword, setJoiningClanWithPassword] = useState<string | null>(null);
  const [enteredJoinPassword, setEnteredJoinPassword] = useState("");
  
  const [chatMessageText, setChatMessageText] = useState("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("gameSoundEnabledV12");
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [sentSoundKey, setSentSoundKey] = useState<string>(() => {
    return localStorage.getItem("gameSentSoundV1") || "iphone-sent-message";
  });

  const [receivedSoundKey, setReceivedSoundKey] = useState<string>(() => {
    return localStorage.getItem("gameReceivedSoundV1") || "iphone-sound-message";
  });

  // Keep localStorage synced whenever soundEnabled changes
  useEffect(() => {
    localStorage.setItem("gameSoundEnabledV12", JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("gameSentSoundV1", sentSoundKey);
  }, [sentSoundKey]);

  useEffect(() => {
    localStorage.setItem("gameReceivedSoundV1", receivedSoundKey);
  }, [receivedSoundKey]);

  const [toastHistory, setToastHistory] = useState<string[]>([]);
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(true);
  const [isLiquidGlass, setIsLiquidGlass] = useState<boolean>(() => {
    const saved = localStorage.getItem("gameLiquidGlass");
    return saved ? JSON.parse(saved) : false;
  });
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  const [swapPlayerId, setSwapPlayerId] = useState("");

  // --- LEVEL SCALE SYSTEM ---
  const getPlayerLevelInfo = (clicks: number) => {
    // Each level requires: L * (L + 1) * 35 total cumulative clicks
    let lvl = 1;
    while (clicks >= lvl * (lvl + 1) * 35) {
      lvl++;
    }
    const currentLvlThreshold = lvl === 1 ? 0 : (lvl - 1) * lvl * 35;
    const nextLvlThreshold = lvl * (lvl + 1) * 35;
    const progressInLvl = clicks - currentLvlThreshold;
    const neededInLvl = nextLvlThreshold - currentLvlThreshold;
    const pct = Math.min(100, Math.max(0, (progressInLvl / neededInLvl) * 100));
    
    // Generate text scale like (1★★----------2)
    const totalSteps = 10;
    const filledSteps = Math.round((pct / 100) * totalSteps);
    const stars = "★".repeat(Math.max(0, Math.min(totalSteps, filledSteps)));
    const dashes = "-".repeat(Math.max(0, Math.min(totalSteps, totalSteps - filledSteps)));
    const textScale = `(${lvl}${stars}${dashes}${lvl + 1})`;
    
    return { lvl, pct, textScale, progressInLvl, neededInLvl };
  };

  const lvlInfo = getPlayerLevelInfo(totalClicks);

  useEffect(() => {
    localStorage.setItem("gameLiquidGlass", JSON.stringify(isLiquidGlass));
  }, [isLiquidGlass]);

  // --- VISUAL & NETWORKING ---
  const [floatingTexts, setFloatingTexts] = useState<ClickSparkle[]>([]);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [networkConnected, setNetworkConnected] = useState(false);
  const [serverInstanceId, setServerInstanceId] = useState<string | null>(null);
  const [networkEventNotice, setNetworkEventNotice] = useState<string | null>(null);

  // --- REFS FOR ACTION STACK ---
  const socketRef = useRef<WebSocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const activeMainTabRef = useRef<"upgrades" | "quests" | "chat" | "shop" | "social" | "settings" | "clanwars">(activeMainTab);

  useEffect(() => {
    activeMainTabRef.current = activeMainTab;
  }, [activeMainTab]);

  useEffect(() => {
    if (activeMainTab === "social" && activeSocialTab === "clans" && playerClan) {
      setIsLoadingMyClanMembers(true);
      const q = query(collection(db, "users"), where("playerClan", "==", playerClan));
      getDocs(q).then((snap) => {
        const arr = snap.docs.map(d => ({id: d.id, ...d.data()}));
        setMyFullClanMembers(arr);
      }).catch(e => {
        console.error("Error fetching full clan members:", e);
      }).finally(() => {
        setIsLoadingMyClanMembers(false);
      });
    }
  }, [activeMainTab, activeSocialTab, playerClan]);

  useEffect(() => {
    if (playerClan) {
      setIsLoadingClanVault(true);
      const unsub = onSnapshot(doc(db, "clans", playerClan), (snap) => {
        if (snap.exists() && Array.isArray(snap.data().vault)) {
          setClanVaultItems(snap.data().vault);
        } else {
          setClanVaultItems([]);
        }
        setIsLoadingClanVault(false);
      }, (error) => {
        console.error("Error subscribing to clan vault:", error);
        setIsLoadingClanVault(false);
      });
      return () => unsub();
    } else {
      setClanVaultItems([]);
    }
  }, [playerClan]);

  // --- SAVE CORE PROGRESS ON CHANGES ---
  useEffect(() => {
    localStorage.setItem("gameDataV9", JSON.stringify({
      coins,
      clickPowerLevel,
      autoClickerLevel,
      energyLevel,
      energy,
      maxEnergy,
      regenRate,
      totalClicks,
      playerName,
      playerPhotoURL,
      playerClan,
      playerId,
      currentQuest,
      lastActiveTimestamp: Date.now() + timeOffsetRef.current
    }));
    localStorage.setItem("gameFriendsV9", JSON.stringify(friendsList));

    // Send status update to Server
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const tgId = linkedTelegramId || (currentUser?.email && currentUser.email.startsWith("tg_") ? String(currentUser.email.split("@")[0].replace("tg_", "")) : null);
      socketRef.current.send(JSON.stringify({
        type: "status_update",
        data: {
          id: effectivePlayerId,
          name: playerName,
          clan: playerClan,
          coins,
          clicks: totalClicks,
          photoURL: playerPhotoURL,
          telegramId: tgId || undefined,
          autoClickerLevel: autoClickerLevel
        }
      }));
    }
  }, [coins, clickPowerLevel, autoClickerLevel, energyLevel, energy, maxEnergy, regenRate, totalClicks, playerName, playerPhotoURL, playerClan, currentQuest, friendsList, currentUser, linkedTelegramId]);

  const saveToFirestoreRef = useRef<any>(null);
  useEffect(() => {
    saveToFirestoreRef.current = saveToFirestore;
  });

  // --- MULTIPLAYER WEBSOCKET CONNECTIVITY ---
  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    let connectTimeout: NodeJS.Timeout;
    let isUnmounted = false;

    function connect() {
      try {
        let wsUrl = "";
        const customApiUrl = (import.meta.env.VITE_API_URL as string) || "";
        if (customApiUrl) {
          const wsProtocol = customApiUrl.startsWith("https:") ? "wss:" : "ws:";
          const cleanHost = customApiUrl.replace(/^https?:\/\//i, "").replace(/\/$/, "");
          wsUrl = `${wsProtocol}//${cleanHost}/ws`;
        } else {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          wsUrl = `${protocol}//${window.location.host}/ws`;
        }
        
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (isUnmounted) {
            socket.close();
            return;
          }
          setNetworkConnected(true);
          const tgId = linkedTelegramId || (currentUser?.email && currentUser.email.startsWith("tg_") ? String(currentUser.email.split("@")[0].replace("tg_", "")) : null);
          // Register player
          socket.send(JSON.stringify({
            type: "register",
            data: {
              id: effectivePlayerId,
              name: playerName,
              clan: playerClan,
              coins,
              clicks: totalClicks,
              color: playerColor,
              telegramId: tgId || undefined,
              autoClickerLevel: autoClickerLevel,
              email: currentUser?.email || undefined
            }
          }));

          // Start heartbeat ping
          pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping" }));
            }
          }, 30000);
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            switch (message.type) {
              case "whitelist_rejected": {
                setIsWhitelistedRejected(true);
                break;
              }
              case "SYNC_START":
                setIsSyncing(true);
                break;
              case "SYNC_END":
                setIsSyncing(false);
                break;
              case "init": {
                const { players: serverPlayers, chatHistory, assignedColor, clanPrivacy, clanWarState: initWarState, marketplaceListings: serverListings, instanceId } = message.data;
                setOnlinePlayers(serverPlayers);
                setGlobalChatHistory(chatHistory || []);
                setPlayerColor(assignedColor);
                if (instanceId) {
                  setServerInstanceId(instanceId);
                }
                if (initWarState) {
                  setClanWarState(initWarState);
                }
                if (clanPrivacy) {
                  setClansPrivacy(clanPrivacy);
                }
                if (Array.isArray(serverListings)) {
                  setMarketplaceListings(serverListings);
                }
                break;
              }
              case "marketplace_update": {
                if (Array.isArray(message.data)) {
                  setMarketplaceListings(message.data);
                }
                break;
              }
              case "players_update": {
                const isLegacy = Array.isArray(message.data);
                const serverPlayersList: Player[] = isLegacy ? message.data : (message.data.players || []);
                const privacyList = isLegacy ? [] : (message.data.clanPrivacy || []);
                
                setOnlinePlayers(serverPlayersList);
                setClansPrivacy(privacyList);
                
                // Aggregate clans map dynamically based on connected players
                const localClans: { [key: string]: Player[] } = {};
                serverPlayersList.forEach((p) => {
                  if (p.clan) {
                    if (!localClans[p.clan]) localClans[p.clan] = [];
                    localClans[p.clan].push(p);
                  }
                });
                setClansMap(localClans);
                break;
              }
              case "create_clan_res": {
                const { success, clan, error } = message.data;
                if (success) {
                  setPlayerClan(clan);
                  addToast(`🏰 Клан "${clan}" успешно создан!`);
                  setNewClanName("");
                  setNewClanPassword("");
                  setIsClanPrivate(false);
                } else {
                  addToast(`⚠️ Ошибка: ${error || "Не удалось создать клан"}`);
                }
                break;
              }
              case "join_clan_res": {
                const { success, clan, error } = message.data;
                if (success) {
                  setPlayerClan(clan);
                  addToast(`⚔️ Вы успешно вступили в клан "${clan}"!`);
                  setJoiningClanWithPassword(null);
                  setEnteredJoinPassword("");
                } else {
                  addToast(`⚠️ Ошибка вступления: ${error || "Неверный пароль"}`);
                }
                break;
              }
              case "leave_clan_res": {
                const { success, error } = message.data;
                if (success) {
                  setPlayerClan(null);
                  addToast("❌ Вы успешно покинули клан.");
                } else {
                  addToast(`⚠️ Ошибка при выходе: ${error || "Неизвестная ошибка"}`);
                }
                break;
              }
              case "chat_msg_broadcast": {
                const newMsg: ChatMessage = message.data;
                const isHidden = document.hidden;
                
                // If sender is muted, ignore notifications entirely
                const isMuted = mutedPlayersRef.current.includes(newMsg.playerId);
                
                if (!isMuted && (activeMainTabRef.current !== "chat" || isHidden)) {
                  setHasUnreadChat(true);
                  if (newMsg.playerId !== effectivePlayerId) {
                    playNotificationSound();
                  }
                }
                
                // If this is from someone else and mentions our name, and sender is not muted
                if (
                  !isMuted &&
                  newMsg.playerId !== effectivePlayerId && 
                  newMsg.text && 
                  playerName && 
                  (newMsg.text.toLowerCase().includes(`@${playerName.toLowerCase()}`) || 
                   newMsg.text.toLowerCase().includes("@всем") || 
                   newMsg.text.toLowerCase().includes("@all"))
                ) {
                  addToast(`🔔 Вас упомянул ${newMsg.playerName} в чате: "${newMsg.text.slice(0, 30)}..."`);
                  playNotificationSound();
                }
                
                if (newMsg.isClanOnly) {
                  setClanChatHistory((prev) => {
                    // Deduplicate messages with same id
                    if (prev.some((m) => m.id === newMsg.id)) return prev;
                    const updated = [...prev, newMsg];
                    return updated.slice(-50);
                  });
                } else {
                  setGlobalChatHistory((prev) => {
                    // Deduplicate messages with same id
                    if (prev.some((m) => m.id === newMsg.id)) return prev;
                    const updated = [...prev, newMsg];
                    return updated.slice(-50); // Keep max 50 values
                  });
                }
                break;
              }
              case "direct_msg_broadcast": {
                const dm = message.data;
                // Secure check: only process direct messages meant for us
                if (!dm || (dm.senderId !== effectivePlayerId && dm.recipientId !== effectivePlayerId)) {
                  break;
                }
                const conversationWith = dm.senderId === effectivePlayerId ? dm.recipientId : dm.senderId;
                
                // If sender is muted, ignore notification triggers
                const isMuted = mutedPlayersRef.current.includes(dm.senderId);
                
                // Show notification if it's an incoming message and the chat isn't currently open, and they are not muted
                if (!isMuted && dm.recipientId && dm.recipientId === effectivePlayerId && (activeFriendChatIdRef.current !== dm.senderId || document.hidden)) {
                  playNotificationSound();
                  
                  if (activeFriendChatIdRef.current !== dm.senderId) {
                    addToast(`🤖 Уведомление: Новое ЛС от ${dm.senderName}`);
                  }
                }

                setDirectMessages((prev) => {
                  const currentConvo = prev[conversationWith] || [];
                  if (currentConvo.some((m: any) => m.id === dm.id)) return prev;
                  return {
                    ...prev,
                    [conversationWith]: [...currentConvo, dm].slice(-50),
                  };
                });
                break;
              }
              case "player_clicked": {
                const clickData = message.data;
                if (clickData.id !== effectivePlayerId) {
                  setNetworkEventNotice(`🚀 ${clickData.name} кликает вместе с вами! (+${clickData.power} 💰)`);
                }
                break;
              }
              case "request_save": {
                // Trigger full manual save sequence as requested by Telegram /save button!
                saveToFirestoreRef.current(auth.currentUser, true, true);
                break;
              }
              case "clan_war_update": {
                setClanWarState(message.data);
                break;
              }
            }
          } catch (err) {
            console.error("Failed to parse socket message:", err);
          }
        };

        socket.onclose = () => {
          setNetworkConnected(false);
          clearInterval(pingInterval);
          if (!isUnmounted) {
            // Auto reconnect after 3 seconds only if not unmounted
            connectTimeout = setTimeout(connect, 3000);
          }
        };

        socket.onerror = (err) => {
          console.error("WebSocket connection error:", err);
          socket.close();
        };

      } catch (err) {
        console.error("Failed to construct WebSocket:", err);
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      if (socketRef.current) {
        socketRef.current.close();
      }
      clearInterval(pingInterval);
      clearTimeout(connectTimeout);
    };
  }, [playerId, currentUser]);

  // --- AUTOMATIC SCALABLE CHAT SCROLL ---
  useEffect(() => {
    if (activeMainTab === "chat" && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [globalChatHistory, clanChatHistory, activeMainTab]);

  // --- DISAPPEAR NETWORK EVENT NOTICES ---
  useEffect(() => {
    if (networkEventNotice) {
      const timer = setTimeout(() => {
        setNetworkEventNotice(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [networkEventNotice]);

  // --- ENERGY RESTORATION SYSTEM ---
  const lastEnergyTickRef = useRef(Date.now());
  useEffect(() => {
    lastEnergyTickRef.current = Date.now();
    const doTick = () => {
      const now = Date.now();
      const elapsed = Math.max(0, now - lastEnergyTickRef.current);
      const ticks = Math.floor(elapsed / 1000);

      if (ticks > 0) {
        setEnergy((prev) => {
          if (prev < maxEnergy) {
            return Math.min(maxEnergy, prev + (regenRate * ticks));
          }
          return prev;
        });
        lastEnergyTickRef.current += ticks * 1000;
      }
    };

    const interval = setInterval(doTick, 1000);
    
    // Instantly catch up when returning to the game tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") doTick();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", doTick);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", doTick);
    };
  }, [maxEnergy, regenRate]);

  // --- AUTO CLICKER TICK ENGINE ---
  const lastAutoTickRef = useRef(Date.now());
  useEffect(() => {
    lastAutoTickRef.current = Date.now();
    if (autoClickerLevel > 0) {
      const doTick = () => {
        const now = Date.now();
        const elapsed = Math.max(0, now - lastAutoTickRef.current);
        const ticks = Math.floor(elapsed / 1000);

        if (ticks > 0) {
          const gain = Math.ceil(autoClickerLevel * 0.5) * ticks;
          setCoins((prev) => prev + gain);
          lastAutoTickRef.current += ticks * 1000;
        }
      };

      const autoInterval = setInterval(doTick, 1000);

      const handleVisibility = () => {
        if (document.visibilityState === "visible") doTick();
      };
      document.addEventListener("visibilitychange", handleVisibility);
      window.addEventListener("focus", doTick);

      return () => {
        clearInterval(autoInterval);
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("focus", doTick);
      };
    }
  }, [autoClickerLevel]);

  // --- SET TOTAL CLICKS STATE ---
  const triggerAudio = () => {
    if (!soundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const audioCtx = new Ctx();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(260 + (clickPowerLevel * 8), audioCtx.currentTime); // Pitch scales with power!
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      // In some sandboxed iframe environments AudioContext initialization is blocked until user interaction
    }
  };

  const handleManualClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (energy <= 0) {
      addToast("⚡ Нет энергии! Ждите восстановления.");
      return;
    }

    setEnergy((prev) => Math.max(0, prev - 1));
    const gain = clickPowerLevel;
    setCoins((prev) => prev + gain);
    setTotalClicks((prev) => prev + 1);

    // Get click positions for floating text
    let clickX = window.innerWidth / 2;
    let clickY = window.innerHeight / 2 - 100;

    if (e.type === "click") {
      const mouseEvent = e as React.MouseEvent;
      clickX = mouseEvent.clientX;
      clickY = mouseEvent.clientY;
    } else {
      const touchEvent = e as React.TouchEvent;
      if (touchEvent.touches && touchEvent.touches[0]) {
        clickX = touchEvent.touches[0].clientX;
        clickY = touchEvent.touches[0].clientY;
      }
    }

    // Spawn floating score indicators with random offset
    const randomOffX = clickX - 20 + Math.random() * 40;
    const randomOffY = clickY - 20 + Math.random() * 40;
    const newSparkleId = Date.now() + Math.random();

    setFloatingTexts((prev) => [
      ...prev,
      { id: newSparkleId, x: randomOffX, y: randomOffY, text: `+${gain}` }
    ]);

    // Send realtime action to Server
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "click_action",
        data: {
          id: effectivePlayerId,
          power: gain
        }
      }));
    }

    triggerAudio();

    // Fade out indicator
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((item) => item.id !== newSparkleId));
    }, 850);
  };

  // --- ACTIONS ---
  const addToast = React.useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text: msg }]);
    setToastHistory((prev) => [msg, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2000);
  }, []);

  // --- LEVEL UP REWARDS TRACKER & STORAGE PERSISTENCE ---
  useEffect(() => {
    localStorage.setItem("gameLevelItemsV12", JSON.stringify(levelItems));
  }, [levelItems]);

  useEffect(() => {
    localStorage.setItem("gameLastClaimedLevelV12", String(lastClaimedLevel));
  }, [lastClaimedLevel]);

  useEffect(() => {
    if (lvlInfo.lvl > lastClaimedLevel) {
      const newItems: any[] = [];
      for (let l = lastClaimedLevel + 1; l <= lvlInfo.lvl; l++) {
        const def = REWARD_DEFINITIONS.find(r => r.level === l);
        if (def) {
          newItems.push({
            id: `item_level_${l}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            level: l,
            title: def.title,
            desc: def.desc,
            img: def.img,
            customImg: def.customImg || "",
            category: def.category,
            acquiredAt: new Date().toLocaleString()
          });
        } else {
          const adjectives = ["Древний", "Легендарный", "Мистический", "Скрытый", "Утерянный", "Эфирный", "Имперский", "Божественный"];
          const nouns = ["Кристалл", "Амулет", "Рунический Камень", "Кольцо Силы", "Эликсир Судьбы", "Наплечник Титана", "Гримуар Тайн", "Грааль Силы"];
          const adj = adjectives[l % adjectives.length];
          const noun = nouns[l % nouns.length];
          const images = [
            "https://images.unsplash.com/photo-1547891654-e66ed7edd96c?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
            "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
            "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
            "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3"
          ];
          newItems.push({
            id: `item_level_${l}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            level: l,
            title: `⭐ ${adj} ${noun} ${l} ур.`,
            desc: `Величественный артефакт, выкованный из чистой звездной материи при переходе на уровень ${l}! Представляет огромную ценность на рынке лобби.`,
            img: "custom",
            customImg: images[l % images.length],
            category: "custom",
            acquiredAt: new Date().toLocaleString()
          });
        }
      }

      if (newItems.length > 0) {
        setLevelItems(prev => [...prev, ...newItems]);
        setLastClaimedLevel(lvlInfo.lvl);
        addToast(`🎁 Новые уровневые награды зачислены в ваш инвентарь Продажи!`);
      } else {
        setLastClaimedLevel(lvlInfo.lvl);
      }
    }
  }, [lvlInfo.lvl, lastClaimedLevel]);

  // --- 24/7 OFFLINE INCOME CHECKER ON LOAD ---
  useEffect(() => {
    if (!isTimeSynced) return; // Wait until clock synchronization is complete to guarantee precise hours
    const saved = localStorage.getItem("gameDataV9");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.autoClickerLevel && parsed.autoClickerLevel > 0 && parsed.lastActiveTimestamp) {
          const lastActive = Number(parsed.lastActiveTimestamp);
          const now = Date.now() + timeOffset;
          if (now > lastActive) {
            const elapsedSeconds = Math.floor((now - lastActive) / 1000);
            if (elapsedSeconds >= 15) {
              const offlineRate = Math.ceil(parsed.autoClickerLevel * 0.5);
              const coinsEarned = elapsedSeconds * offlineRate;
              if (coinsEarned > 0) {
                const hours = Math.floor(elapsedSeconds / 3600);
                const mins = Math.floor((elapsedSeconds % 3600) / 60);
                const secs = elapsedSeconds % 60;
                setOfflineEarningsData({
                  elapsedSeconds,
                  coinsEarned,
                  hours,
                  mins,
                  secs
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed offline calculation state build", err);
      }
    }
  }, [isTimeSynced, timeOffset]);

  const buyUpgrade = (type: "click" | "auto" | "energy") => {
    if (type === "click") {
      const price = Math.floor(50 * Math.pow(1.5, clickPowerLevel));
      if (coins >= price) {
        setCoins((prev) => prev - price);
        setClickPowerLevel((prev) => prev + 1);
        playPurchaseSound();
        addToast("💪 Сила клика повышена!");
      } else {
        addToast("💰 Мало монет для этого апгрейда!");
      }
    } else if (type === "auto") {
      const price = Math.floor(100 * Math.pow(1.6, autoClickerLevel));
      if (coins >= price) {
        setCoins((prev) => prev - price);
        setAutoClickerLevel((prev) => prev + 1);
        playPurchaseSound();
        addToast("🤖 Автокликер прокачан!");
      } else {
        addToast("💰 Мало монет для этого апгрейда!");
      }
    } else if (type === "energy") {
      const price = Math.floor(80 * Math.pow(1.5, energyLevel));
      if (coins >= price) {
        setCoins((prev) => prev - price);
        setEnergyLevel((prev) => prev + 1);
        setMaxEnergy((prev) => prev + 50);
        setRegenRate((prev) => prev + 1);
        setEnergy((prev) => prev + 50);
        playPurchaseSound();
        addToast("🔋 Энергия увеличена!");
      } else {
        addToast("💰 Мало монет для этого апгрейда!");
      }
    }
  };

  const chooseVersion = (type: "pc" | "mobile") => {
    setAppVersion(type);
    localStorage.setItem("appVersion", type);
  };

  // --- QUEST LOGIC ---
  const generateNewQuest = () => {
    const difficulty = 1 + (clickPowerLevel * 0.2) + (totalClicks / 1000);
    const types: ("clicks" | "coins")[] = ["clicks", "coins"];
    const type = types[Math.floor(Math.random() * types.length)];
    let target = 100;
    let reward = 100;
    let desc = "";

    if (type === "clicks") {
      target = Math.floor(100 * difficulty * 1.5);
      reward = Math.floor(target * 1.5);
      desc = `Сделать ${target} кликов`;
    } else {
      target = Math.floor(500 * difficulty * 2);
      reward = Math.floor(target * 0.5);
      desc = `Накопить ${target} монет`;
    }

    const newQuest: Quest = { id: Date.now(), type, target, reward, desc };
    setCurrentQuest(newQuest);
    addToast("📜 Сгенерировано новое задание!");
  };

  const claimQuestReward = () => {
    let completed = false;
    if (currentQuest.type === "clicks" && totalClicks >= currentQuest.target) completed = true;
    if (currentQuest.type === "coins" && coins >= currentQuest.target) completed = true;

    if (completed) {
      setCoins((prev) => prev + currentQuest.reward);
      addToast(`✅ Награда получена: +${currentQuest.reward} монет!`);
      setTimeout(generateNewQuest, 800);
    } else {
      addToast("❌ Задание еще не выполнено!");
    }
  };

  // --- IN LOBBY CHAT SENDER ---
  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatMessageText.trim();
    if (!text) return;
    
    // Command interception (Bot Command)
    if (text.toLowerCase() === "/уведомления" || text.toLowerCase() === "/notifications") {
      setChatMessageText("");
      setGlobalChatHistory(prev => {
        const botMsg: ChatMessage = {
          id: "bot_cmd_" + Date.now(),
          playerId: "SYSTEM_BOT",
          playerName: "🤖 Бот (Статус)",
          clan: null,
          text: `Последние уведомления и события чатов:
Проверьте раздел Социальная сеть -> Друзья, чтобы увидеть новые сообщения.
Активных диалогов: ${Object.keys(directMessages).filter(k => directMessages[k]?.length > 0).length}`,
          timestamp: formatMoscowTime(undefined, false),
          color: "#A0ABC0",
          isClanOnly: false
        };
        return [...prev, botMsg].slice(-50);
      });
      return;
    } else if (text.toLowerCase() === "/help" || text.toLowerCase() === "/помощь") {
      setChatMessageText("");
      setGlobalChatHistory(prev => {
        const botMsg: ChatMessage = {
          id: "bot_cmd_help_" + Date.now(),
          playerId: "SYSTEM_BOT",
          playerName: "🤖 Бот (Помощь)",
          clan: null,
          text: `Доступные команды бота:
• /уведомления (или /notifications) - посмотреть информацию о личных сообщениях.
• /помощь (или /help) - список команд.`,
          timestamp: formatMoscowTime(undefined, false),
          color: "#A0ABC0",
          isClanOnly: false
        };
        return [...prev, botMsg].slice(-50);
      });
      return;
    }

    const isClanOnly = chatChannel === "clan";
    if (isClanOnly && !playerClan) {
      addToast("⚠️ Сначала вступите в клан или создайте его!");
      return;
    }

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
       socketRef.current.send(JSON.stringify({
         type: "chat_msg",
         data: {
           playerId: effectivePlayerId,
           text: chatMessageText.trim(),
           isClanOnly
         }
       }));
      setChatMessageText("");
      playSentSound();
    } else {
      addToast("⚠️ Ошибка подключения. Сообщение не отправлено.");
    }
  };

  // --- GOOGLE AUTHENTICATION SYSTEM EFFECTS ---
  useEffect(() => {
    if (!auth) {
      console.error("Firebase Auth is not initialized. Check your configuration.");
      setIsAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsAuthLoading(false);
        
        if (!db) {
          console.error("Firestore DB is not initialized.");
          return;
        }

        try {
          const docRef = doc(db, "users", user.uid);
          let docSnap;
          try {
             docSnap = await getDoc(docRef);
          } catch (error) {
             console.warn("Could not fetch user document, proceeding with local data", error);
          }
          
          if (docSnap && docSnap.exists()) {
            const data = docSnap.data();
            const loadedCoins = typeof data.coins === "number" ? data.coins : 0;
            const loadedAutoLvl = typeof data.autoClickerLevel === "number" ? data.autoClickerLevel : 0;
            const lastActive = typeof data.lastActiveTimestamp === "number" ? data.lastActiveTimestamp : 0;

            // Calculate cloud offline earnings
            if (loadedAutoLvl > 0 && lastActive > 0) {
              const now = Date.now() + timeOffsetRef.current;
              if (now > lastActive) {
                const elapsedSeconds = Math.floor((now - lastActive) / 1000);
                if (elapsedSeconds >= 15) {
                  const offlineRate = Math.ceil(loadedAutoLvl * 0.5);
                  const coinsEarned = elapsedSeconds * offlineRate;
                  if (coinsEarned > 0) {
                    const hours = Math.floor(elapsedSeconds / 3600);
                    const mins = Math.floor((elapsedSeconds % 3600) / 60);
                    const secs = elapsedSeconds % 60;
                    setOfflineEarningsData({
                      elapsedSeconds,
                      coinsEarned,
                      hours,
                      mins,
                      secs
                    });
                  }
                }
              }
            }
            setCoins(loadedCoins);
            if (typeof data.clickPowerLevel === "number") setClickPowerLevel(data.clickPowerLevel);
            if (typeof data.autoClickerLevel === "number") setAutoClickerLevel(data.autoClickerLevel);
            if (typeof data.energyLevel === "number") setEnergyLevel(data.energyLevel);
            if (typeof data.energy === "number") setEnergy(data.energy);
            if (typeof data.maxEnergy === "number") setMaxEnergy(data.maxEnergy);
            if (typeof data.regenRate === "number") setRegenRate(data.regenRate);
            if (typeof data.totalClicks === "number") setTotalClicks(data.totalClicks);
            let resolvedPlayerName = data.playerName || "Игрок";
            const isGoogleUser = user.providerData?.some((p) => p.providerId === "google.com") || (user.email && !user.email.startsWith("tg_"));
            
            if (isGoogleUser && user.displayName && user.displayName !== data.playerName) {
              resolvedPlayerName = user.displayName;
              try {
                await setDoc(docRef, { playerName: user.displayName }, { merge: true });
              } catch (e) {
                console.warn("Could not update google name in Firestore", e);
              }
            } else if (typeof data.playerName === "string") {
              resolvedPlayerName = data.playerName;
            }

            setPlayerName(resolvedPlayerName);
            setEditingName(resolvedPlayerName);
            if (user.photoURL) {
              setPlayerPhotoURL(user.photoURL);
            } else if (data.photoURL) {
              setPlayerPhotoURL(data.photoURL);
            }
            if (data.levelItems && Array.isArray(data.levelItems)) {
              setLevelItems(data.levelItems);
            }
            if (typeof data.playerClan === "string" || data.playerClan === null) setPlayerClan(data.playerClan);
            if (data.currentQuest) setCurrentQuest(data.currentQuest);
            if (typeof data.notificationsEnabled === "boolean") {
              setNotificationsEnabled(data.notificationsEnabled);
            } else {
              setNotificationsEnabled(true);
            }

            if (data.telegramId) {
              setLinkedTelegramId(String(data.telegramId));
            } else {
              setLinkedTelegramId(null);
            }

            // Auto-link Telegram ID upon login immediately if they are logged in with Telegram
            const tgId = user.email && user.email.startsWith("tg_") ? String(user.email.split("@")[0].replace("tg_", "")) : null;
            if (tgId) {
              setLinkedTelegramId(tgId);
              if (data.telegramId !== tgId) {
                await setDoc(docRef, { telegramId: tgId, updatedAt: serverTimestamp() }, { merge: true });
              }
            }

            addToast("☁️ Прогресс загружен из Google Облака!");
            saveAccountToLocalList(
              user.uid,
              user.email,
              resolvedPlayerName,
              user.photoURL || data.photoURL || null,
              user.email?.startsWith("tg_") ? "telegram" : (user.email?.startsWith("vk_") ? "vk" : "google"),
              undefined,
              loadedCoins
            );
          } else {
            // First time login: we secure their existing client progress by syncing it to their new cloud account
            const tgId = user.email && user.email.startsWith("tg_") ? String(user.email.split("@")[0].replace("tg_", "")) : null;
            if (tgId) {
              setLinkedTelegramId(tgId);
            } else {
              setLinkedTelegramId(null);
            }
            let finalCoins = coins;
            let finalClickPower = clickPowerLevel;
            let finalAutoClicker = autoClickerLevel;
            let finalEnergyLevel = energyLevel;
            let finalTotalClicks = totalClicks;
            let finalPlayerName = user.displayName || playerName;

            // Check VK Cloud storage backup if first login under a VK ID
            if (user.email?.startsWith("vk_")) {
              try {
                const vkData = await vkBridge.send("VKWebAppStorageGet", {
                  keys: ["vk_game_coins", "vk_game_click_power", "vk_game_auto_clicker", "vk_game_energy_level", "vk_game_total_clicks", "vk_game_player_name"]
                });
                if (vkData && vkData.keys) {
                  const getVal = (keyName: string) => vkData.keys.find((k: any) => k.key === keyName)?.value;
                  const cloudCoins = getVal("vk_game_coins");
                  if (cloudCoins) {
                    finalCoins = parseInt(cloudCoins) || 0;
                    finalClickPower = parseInt(getVal("vk_game_click_power") || "1") || 1;
                    finalAutoClicker = parseInt(getVal("vk_game_auto_clicker") || "0") || 0;
                    finalEnergyLevel = parseInt(getVal("vk_game_energy_level") || "1") || 1;
                    finalTotalClicks = parseInt(getVal("vk_game_total_clicks") || "0") || 0;
                    finalPlayerName = getVal("vk_game_player_name") || finalPlayerName;
                    
                    // Update state variables locally
                    setCoins(finalCoins);
                    setClickPowerLevel(finalClickPower);
                    setAutoClickerLevel(finalAutoClicker);
                    setEnergyLevel(finalEnergyLevel);
                    setTotalClicks(finalTotalClicks);
                    setPlayerName(finalPlayerName);
                    setEditingName(finalPlayerName);
                    addToast("☁️ Прогресс восстановлен из Облака VK!");
                  }
                }
              } catch (vkStorageErr) {
                console.warn("Failed or skipped VK storage get:", vkStorageErr);
              }
            }

            if (user.photoURL) {
              setPlayerPhotoURL(user.photoURL);
            }

            await setDoc(docRef, {
              coins: finalCoins,
              clickPowerLevel: finalClickPower,
              autoClickerLevel: finalAutoClicker,
              energyLevel: finalEnergyLevel,
              energy,
              maxEnergy,
              regenRate,
              totalClicks: finalTotalClicks,
              playerName: finalPlayerName,
              photoURL: user.photoURL || playerPhotoURL || "",
              playerClan,
              levelItems,
              currentQuest,
              notificationsEnabled: true,
              ...(tgId ? { telegramId: tgId } : {}),
              updatedAt: serverTimestamp()
            });
            if (user.displayName) {
              setPlayerName(user.displayName);
              setEditingName(user.displayName);
            }
            addToast("💾 Прогресс привязан к аккаунту!");
            saveAccountToLocalList(
              user.uid,
              user.email,
              user.displayName || playerName,
              user.photoURL || null,
              user.email?.startsWith("tg_") ? "telegram" : (user.email?.startsWith("vk_") ? "vk" : "google"),
              undefined,
              coins
            );
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setCurrentUser(null);
        setLinkedTelegramId(null);
        setIsAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- CLAN VAULT TRANSACTIONS ---
  const handleDepositToVault = async (item: any) => {
    if (!effectivePlayerId || !playerClan) {
      addToast("⚠️ Ошибка: Вы должны быть в клане для использования сейфа");
      return;
    }
    
    addToast("📦 Передаем предмет в сейф клана...");
    try {
      const userRef = doc(db, "users", effectivePlayerId);
      const clanRef = doc(db, "clans", playerClan);
      
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const clanSnap = await transaction.get(clanRef);
        
        if (!userSnap.exists()) {
          throw new Error("Профиль игрока не найден");
        }
        
        const currentItems = userSnap.data().levelItems || [];
        const itemIdx = currentItems.findIndex((i: any) => i.id === item.id);
        if (itemIdx === -1) {
          throw new Error("Предмет отсутствует в вашем инвентаре");
        }
        
        const updatedUserItems = [...currentItems];
        updatedUserItems.splice(itemIdx, 1);
        
        const currentVault = clanSnap.exists() ? (clanSnap.data().vault || []) : [];
        const updatedVault = [...currentVault, {
          ...item,
          depositedBy: playerName || "Игрок",
          depositedById: effectivePlayerId,
          depositedAt: Date.now()
        }];
        
        transaction.update(userRef, { levelItems: updatedUserItems });
        if (clanSnap.exists()) {
          transaction.update(clanRef, { vault: updatedVault });
        } else {
          transaction.set(clanRef, { vault: updatedVault });
        }
      });

      // Update local state instantly and show toast
      setLevelItems(prev => prev.filter(i => i.id !== item.id));
      addToast("✅ Предмет успешно помещен в сейф клана!");
    } catch (err: any) {
      console.error("Vault deposit error:", err);
      addToast(`⚠️ Ошибка: ${err.message || "Не удалось сохранить"}`);
    }
  };

  const handleWithdrawFromVault = async (item: any) => {
    if (!effectivePlayerId || !playerClan) return;
    addToast("📦 Извлекаем предмет из сейфа...");
    try {
      const userRef = doc(db, "users", effectivePlayerId);
      const clanRef = doc(db, "clans", playerClan);
      
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const clanSnap = await transaction.get(clanRef);
        
        if (!userSnap.exists()) {
          throw new Error("Профиль игрока не найден");
        }
        if (!clanSnap.exists()) {
          throw new Error("Сейф клана пуст!");
        }
        
        const currentVault = clanSnap.data().vault || [];
        const itemIdx = currentVault.findIndex((i: any) => i.id === item.id);
        if (itemIdx === -1) {
          throw new Error("Этого предмета уже нет в сейфе");
        }
        
        const updatedVault = [...currentVault];
        updatedVault.splice(itemIdx, 1);
        
        const { depositedBy, depositedById, depositedAt, ...cleanedItem } = item;
        
        const currentUserItems = userSnap.data().levelItems || [];
        const updatedUserItems = [...currentUserItems, cleanedItem];
        
        transaction.update(userRef, { levelItems: updatedUserItems });
        transaction.update(clanRef, { vault: updatedVault });
      });

      // Update local state instantly and show toast
      setLevelItems(prev => [...prev, item]);
      addToast("✅ Вы успешно забрали предмет из сейфа!");
    } catch (err: any) {
      console.error("Vault withdraw error:", err);
      addToast(`⚠️ Ошибка: ${err.message || "Не удалось забрать"}`);
    }
  };

  // Sync to Firestore helper for triggering manually or on events
  const saveToFirestore = async (user = auth.currentUser, isManual = false, isFromTelegramBot = false, customCoins?: number) => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    
    try {
      const docRef = doc(db, "users", user.uid);
      const tgId = linkedTelegramId || (user.email && user.email.startsWith("tg_") ? String(user.email.split("@")[0].replace("tg_", "")) : null);
      
      if (isManual) {
        setSyncProgress(0);
        // We will increment progress up to 100% over 1.2 seconds
        // 10 increments of 10% every 120ms for super-fast responsiveness
        for (let p = 10; p <= 100; p += 10) {
          await new Promise((resolve) => setTimeout(resolve, 120));
          setSyncProgress(p);
        }
      }

      const coinsToSave = typeof customCoins === "number" ? customCoins : coins;

      // Save to Firestore after progress bar has completed (or immediately for autosave)
      await setDoc(docRef, {
        coins: coinsToSave,
        clickPowerLevel,
        autoClickerLevel,
        energyLevel,
        energy,
        maxEnergy,
        regenRate,
        totalClicks,
        playerName,
        playerClan,
        levelItems,
        currentQuest,
        notificationsEnabled,
        lastActiveTimestamp: Date.now() + timeOffsetRef.current,
        ...(tgId ? { telegramId: tgId } : {}),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Secondary sync to VK Cloud storage if they are a VK user
      if (user.email?.startsWith("vk_")) {
        syncWithVKCloud(coinsToSave);
      }

      if (isManual) {
        addToast("☁️ Облачное сохранение успешно! 💾");

        // Notify the Telegram Bot if they are a Telegram player and NOT triggered by the bot itself
        if (tgId && !isFromTelegramBot) {
          fetch(getApiUrl("/api/telegram-notify-save"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              telegramId: tgId,
              playerName: playerName,
              coins: coins,
              notificationsEnabled: notificationsEnabled
            })
          }).catch(err => console.error("Failed to trigger telegram notify-save:", err));
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // Periodic autosave every 60 seconds of play
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      saveToFirestore(currentUser);
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser, coins, clickPowerLevel, autoClickerLevel, energyLevel, energy, maxEnergy, regenRate, totalClicks, playerName, playerClan, currentQuest]);

  // Save or update an authenticated account in local storage
  const saveAccountToLocalList = (
    uid: string,
    email: string | null,
    displayName: string,
    photoURL: string | null,
    type: "telegram" | "google" | "vk",
    password?: string,
    coinsValue?: number
  ) => {
    try {
      const savedAccountsRaw = localStorage.getItem("gameSavedAccountsV1");
      let accounts = savedAccountsRaw ? JSON.parse(savedAccountsRaw) : [];
      if (!Array.isArray(accounts)) accounts = [];

      const existingIdx = accounts.findIndex((acc: any) => acc.uid === uid || (email && acc.email === email));
      const oldPass = existingIdx >= 0 ? accounts[existingIdx].password : undefined;
      let finalPassword = password || oldPass;
      if (type === "vk" && email && !finalPassword) {
        const vkUserId = email.replace("vk_", "").split("@")[0];
        finalPassword = `vk_pass_${vkUserId}`;
      }

      const accountData = {
        uid,
        email,
        displayName: displayName || email?.split("@")[0] || "Игрок",
        photoURL: photoURL || null,
        type,
        coins: typeof coinsValue === "number" ? coinsValue : 0,
        lastActive: Date.now(),
        ...(finalPassword ? { password: finalPassword } : {})
      };

      if (existingIdx >= 0) {
        accounts[existingIdx] = accountData;
      } else {
        accounts.push(accountData);
      }

      localStorage.setItem("gameSavedAccountsV1", JSON.stringify(accounts));
      setSavedAccounts(accounts);
    } catch (e) {
      console.error("Failed to save account to list:", e);
    }
  };

  // Delete/forget a saved account on this device
  const deleteSavedAccountFromList = (uid: string) => {
    try {
      const savedAccountsRaw = localStorage.getItem("gameSavedAccountsV1");
      if (!savedAccountsRaw) return;
      const parsed = JSON.parse(savedAccountsRaw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((acc: any) => acc.uid !== uid);
        localStorage.setItem("gameSavedAccountsV1", JSON.stringify(filtered));
        setSavedAccounts(filtered);
        addToast("🗑️ Аккаунт забыт на этом устройстве.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle selection of account from the list
  const handleSelectSavedAccount = async (account: any) => {
    if (isAccountSwitching) return;
    setIsAccountSwitching(true);
    sessionStorage.setItem("skipVKAutoLogin", "true");
    addToast(`🔄 Вход в аккаунт "${account.displayName}"...`);
    try {
      let finalPassword = account.password;
      if (account.type === "vk" && account.email && !finalPassword) {
        const vkUserId = account.email.replace("vk_", "").split("@")[0];
        finalPassword = `vk_pass_${vkUserId}`;
      }

      if ((account.type === "telegram" || account.type === "vk") && account.email && finalPassword) {
        await signInWithEmailAndPassword(auth, account.email, finalPassword);
        addToast(account.type === "vk" ? "🌐 Успешный вход под VK аккаунтом!" : "🤖 Успешный вход под Telegram аккаунтом!");
        setIsAccountSelectorOpen(false);
      } else if (account.type === "google") {
        setIsAccountSelectorOpen(false);
        await signInWithPopup(auth, googleProvider);
      } else {
        addToast("⚠️ Недостаточно данных для автоматического входа.");
      }
    } catch (err: any) {
      console.error("Account switch failed:", err);
      addToast(`❌ Ошибка входа: ${err.message || err}`);
    } finally {
      setIsAccountSwitching(false);
    }
  };

  // Load saved accounts from localStorage on component mount
  useEffect(() => {
    try {
      const savedAccountsRaw = localStorage.getItem("gameSavedAccountsV1");
      if (savedAccountsRaw) {
        const parsed = JSON.parse(savedAccountsRaw);
        if (Array.isArray(parsed)) {
          setSavedAccounts(parsed);
        }
      }
    } catch (err) {
      console.warn("Could not load saved accounts list", err);
    }
  }, []);

  // Auto-open account selector if there are saved accounts but nobody is logged in
  useEffect(() => {
    if (!isAuthLoading && !currentUser && savedAccounts.length > 0) {
      setIsAccountSelectorOpen(true);
    }
  }, [isAuthLoading, currentUser, savedAccounts.length]);

  // Google Sign-In Action Handlers
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error && (error.code === "auth/popup-closed-by-user" || error.message?.includes("popup-closed-by-user"))) {
        addToast("ℹ️ Авторизация отменена (окно было закрыто).");
      } else {
        addToast("⚠️ Ошибка авторизации Google.");
        console.error(error);
      }
    }
  };

  const handleGoogleSignOut = () => {
    setConfirmModal({
      isOpen: true,
      title: "Выход из аккаунта",
      message: "Вы действительно хотите выйти из своего аккаунта? Вы сможете быстро войти в него снова, используя список сохраненных аккаунтов.",
      confirmText: "Да, выйти",
      cancelText: "Отмена",
      onConfirm: () => {
        sessionStorage.setItem("skipVKAutoLogin", "true");
        setIsAuthLoading(true);
        setConfirmModal(null);
        signOut(auth);
      }
    });
  };

  const handleTelegramAuth = () => {
    // Only open the bot if not already polling
    window.open(`https://t.me/${botUsername}`, "_blank");
  };

  const handleTelegramCodeLogin_OLD = async () => {
    if (!telegramCode.trim()) {
      addToast("⚠️ Введите код авторизации!");
      return;
    }
    setIsTelegramLoggingIn(true);
    try {
      const res = await fetch(getApiUrl("/api/telegram-code-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: telegramCode.trim() })
      });
      const data = await res.json();
      if (data && data.success && data.email && data.password) {
        await performTelegramAuth(data.email, data.password, data.displayName || "", data.photoURL || "");
        setTelegramCode("");
      } else {
        addToast(`❌ ${data.error || "Ошибка авторизации по коду."}`);
      }
    } catch (err: any) {
      console.error("Telegram code login failed:", err);
      addToast(`⚠️ Ошибка: ${err?.message || "Ошибка подключения."}`);
    } finally {
      setIsTelegramLoggingIn(false);
    }
  };

  // --- TELEGRAM AUTHENTICATION CLIENT CODES ---
  useEffect(() => {
    let active = true;
    // 1. Fetch dynamic Telegram config with retry
    const fetchTelegramConfig = async (retries = 3, delay = 1000) => {
      try {
        const r = await fetch(getApiUrl("/api/telegram-config"));
        if (!active) return;
        const ct = r.headers.get("content-type");
        if (r.ok && ct && ct.includes("application/json")) {
          const data = await r.json();
          if (data && data.botUsername) {
            setBotUsername(data.botUsername);
          }
        } else if (retries > 0) {
          setTimeout(() => fetchTelegramConfig(retries - 1, delay * 1.5), delay);
        }
      } catch (err) {
        if (retries > 0 && active) {
          setTimeout(() => fetchTelegramConfig(retries - 1, delay * 2), delay);
        } else {
          console.warn("Telegram config fetch failed, using default.");
          setBotUsername("MyTelegramGameBot");
        }
      }
    };
    fetchTelegramConfig();

    // 2. Deep-checking automatic login if played inside a TG Mini App
    const checkTelegramMiniAppAutoLogin = async () => {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg && tg.initData) {
          console.log("Automatic Telegram Mini App login detected...");
          const res = await fetch(getApiUrl("/api/telegram-auth"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData: tg.initData })
          });
          const ct = res.headers.get("content-type");
          if (res.ok && ct && ct.includes("application/json")) {
            const result = await res.json();
            if (result && result.success && result.email && result.password) {
              await performTelegramAuth(result.email, result.password, result.displayName || "", result.photoURL || "");
              addToast("🤖 Автоматический вход через Telegram выполнен!");
            }
          }
        }
      } catch (err: any) {
        console.error("Auto login error inside TG Mini App:", err);
      }
    };
    checkTelegramMiniAppAutoLogin();

    return () => {
      active = false;
    };
  }, []);

  const requestNewGameAuthCode = async (retries = 3, delay = 1000) => {
    try {
      const res = await fetch(getApiUrl("/api/telegram-login-code"));
      const ct = res.headers.get("content-type");
      if (res.ok && ct && ct.includes("application/json")) {
        const data = await res.json();
        if (data && data.success && data.code) {
          setGameAuthCode(data.code);
        }
      } else if (retries > 0) {
        setTimeout(() => requestNewGameAuthCode(retries - 1, delay * 1.5), delay);
      }
    } catch (err) {
      if (retries > 0) {
        setTimeout(() => requestNewGameAuthCode(retries - 1, delay * 2), delay);
      } else {
        console.error("Failed to fetch game login code:", err);
      }
    }
  };

  useEffect(() => {
    if (!gameAuthCode) {
      if (!currentUser || !linkedTelegramId) {
        requestNewGameAuthCode();
      }
    }
  }, [currentUser, gameAuthCode, linkedTelegramId]);

  useEffect(() => {
    if (!gameAuthCode) return;
    if (linkedTelegramId) return; // already has linked telegram for this session

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/telegram-login-poll?code=${gameAuthCode}`));
        const ct = res.headers.get("content-type");
        if (!res.ok || !ct || !ct.includes("application/json")) {
          // Skip parsing if it's not a JSON response (e.g., server reloading or returning error page)
          return;
        }

        const data = await res.json();
        if (data && data.success) {
          if (data.resolved && data.user && data.user.id) {
            clearInterval(intervalId);
            const tgId = String(data.user.id);
            setLinkedTelegramId(tgId);

            if (currentUser) {
              const docRef = doc(db, "users", currentUser.uid);
              await setDoc(docRef, { telegramId: tgId, updatedAt: serverTimestamp() }, { merge: true });
              addToast("🎉 Telegram успешно привязан к вашему аккаунту!");
              
              // Notify the bot the link was successful
              fetch(getApiUrl("/api/telegram-notify-save"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telegramId: tgId,
                  playerName: playerName,
                  coins: coins,
                  notificationsEnabled: notificationsEnabled
                })
              }).catch(err => console.error("Failed to notify tg of merge linking:", err));
            } else if (data.email && data.password) {
              await performTelegramAuth(data.email, data.password, data.displayName || "", data.photoURL || "");
            }
            setGameAuthCode("");
          } else if (data.error) {
            clearInterval(intervalId);
            requestNewGameAuthCode();
          }
        }
      } catch (err: any) {
        // Suppress Failed to fetch network errors (expected during dev server restart)
        const errMsg = err?.message || String(err);
        if (errMsg.toLowerCase().includes("fetch")) {
          return;
        }
        console.error("Error polling telegram authorization:", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [gameAuthCode, currentUser, linkedTelegramId]);

  const performTelegramAuth = async (email: string, password: string, displayName: string, photoURL: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (credential.user) {
        await updateProfile(credential.user, {
          displayName: displayName || credential.user.displayName || "Telegram Player",
          photoURL: photoURL || credential.user.photoURL || ""
        });
        saveAccountToLocalList(
          credential.user.uid,
          email,
          displayName || credential.user.displayName || "Telegram Player",
          photoURL || credential.user.photoURL || "",
          "telegram",
          password,
          coins
        );
      }
    } catch (err: any) {
      if (
        err.code === "auth/user-not-found" || 
        err.code === "auth/invalid-credential" || 
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-login-credentials"
      ) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (credential.user) {
          await updateProfile(credential.user, {
            displayName: displayName || "Telegram Player",
            photoURL: photoURL || ""
          });
          saveAccountToLocalList(
            credential.user.uid,
            email,
            displayName || "Telegram Player",
            photoURL || "",
            "telegram",
            password,
            coins
          );
        }
      } else {
        throw err;
      }
    }
  };

  const performVKAuth = async (email: string, password: string, displayName: string, photoURL: string) => {
    if (isVKAuthInProgressRef.current) {
      console.log("VK Auth already in progress, skipping duplicate request.");
      return;
    }
    isVKAuthInProgressRef.current = true;
    try {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        if (credential.user) {
          await updateProfile(credential.user, {
            displayName: displayName || credential.user.displayName || "VK Player",
            photoURL: photoURL || credential.user.photoURL || ""
          });
          saveAccountToLocalList(
            credential.user.uid,
            email,
            displayName || credential.user.displayName || "VK Player",
            photoURL || credential.user.photoURL || "",
            "vk",
            password,
            coins
          );
        }
      } catch (err: any) {
        if (
          err.code === "auth/user-not-found" || 
          err.code === "auth/invalid-credential" || 
          err.code === "auth/wrong-password" ||
          err.code === "auth/invalid-login-credentials"
        ) {
          const credential = await createUserWithEmailAndPassword(auth, email, password);
          if (credential.user) {
            await updateProfile(credential.user, {
              displayName: displayName || "VK Player",
              photoURL: photoURL || ""
            });
            saveAccountToLocalList(
              credential.user.uid,
              email,
              displayName || "VK Player",
              photoURL || "",
              "vk",
              password,
              coins
            );
          }
        } else {
          throw err;
        }
      }
    } finally {
      isVKAuthInProgressRef.current = false;
    }
  };

  const initVKMiniApp = React.useCallback((skipAutoLoginIfAlreadyAuthenticated = true) => {
    const searchParams = new URLSearchParams(window.location.search);
    
    // Auto-detect version for VK
    const platform = searchParams.get("vk_platform");
    const storedAppVersion = localStorage.getItem("appVersion");
    if (!storedAppVersion && platform) {
      if (platform === "desktop_web" || platform === "web") {
        setAppVersion("pc");
        localStorage.setItem("appVersion", "pc");
      } else {
        setAppVersion("mobile");
        localStorage.setItem("appVersion", "mobile");
      }
    }

    const hasVkParams = Array.from(searchParams.keys()).some(k => k.startsWith("vk_") || k === "viewer_id" || k === "api_id");
    if (!hasVkParams) {
      setVkInitStatus("not_vk");
      return;
    }

    setVkInitStatus("initializing");
    setVkInitError(null);
    
    console.log("Initializing VK Bridge for Mini App context...");
    vkBridge.send("VKWebAppInit").then(() => {
      console.log("VK Bridge connection initialized successfully!");
      setVkInitStatus("success");
      
      // Notify VK that app is loaded and ready, hides the VK loading screen
      try {
        // @ts-ignore: VKWebAppAppReady might not be in the typescript definitions for this version
        vkBridge.send("VKWebAppAppReady");
      } catch (e) {
        console.warn("Failed to send AppReady event");
      }
      
      const vkUserId = searchParams.get("vk_user_id") || searchParams.get("viewer_id");
      const expectedVkEmail = vkUserId ? `vk_${vkUserId}@vk.com` : null;

      // Check if we are already logged in as this VK user to skip redundant toast/sign-in
      if (skipAutoLoginIfAlreadyAuthenticated && expectedVkEmail && auth?.currentUser?.email === expectedVkEmail) {
        console.log("VK Mini App: User already logged in as", expectedVkEmail, "- skipping auto login.");
        return;
      }

      if (sessionStorage.getItem("skipVKAutoLogin") === "true") {
        console.log("VK Mini App: skipVKAutoLogin flag detected in sessionStorage. Skipping auto login.");
        return;
      }
      
      if (hasVkParams) {
        // Automatically attempt to fetch user info and authorize if inside VK Mini App
        addToast("🌐 VK Mini App обнаружено! Вход...");
        
        // Do not block the whole UI with isAuthLoading. Just do it in background or let the user click if it fails.
        vkBridge.send("VKWebAppGetUserInfo").then(async (userInfo) => {
          if (userInfo && userInfo.id) {
            const vkEmail = `vk_${userInfo.id}@vk.com`;
            const vkPass = `vk_pass_${userInfo.id}`;
            const vkName = `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || `VK Player ${userInfo.id}`;
            const vkPhoto = userInfo.photo_200 || "";
            
            await performVKAuth(vkEmail, vkPass, vkName, vkPhoto);
            addToast(`👋 Добро пожаловать, ${vkName}!`);
          }
        }).catch((authErr) => {
          console.warn("Auto VK Auth failed or requires manual click:", authErr);
        });
      }
      
    }).catch((err: any) => {
      console.error("VK Bridge initialization failed:", err);
      setVkInitStatus("not_vk");
      setVkInitError(err?.error_data?.error_reason || err?.message || "Не удалось инициализировать VK Bridge");
    });
  }, [addToast]);

  // --- VK MINI APP AUTOMATIC INIT & DETECTION ---
  useEffect(() => {
    if (!isAuthLoading) {
      initVKMiniApp(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading]);

  const handleVKAuth = async () => {
    setIsAuthLoading(true);
    addToast("🌐 Инициализация VK Авторизации...");
    sessionStorage.removeItem("skipVKAutoLogin");
    try {
      let userInfo;
      try {
        userInfo = await vkBridge.send("VKWebAppGetUserInfo");
      } catch (bridgeError) {
        console.warn("VK Bridge simulation used:", bridgeError);
        // Если мы не внутри VK iframe, генерируем тестовый аккаунт
        if (!window.location.search.includes("vk_user_id") && !window.location.search.includes("viewer_id")) {
          const simulatedId = Math.floor(1000000 + Math.random() * 9000000);
          userInfo = {
            id: simulatedId,
            first_name: "VK Тестер",
            last_name: String(simulatedId).slice(0, 4),
            photo_200: "https://vk.com/images/camera_200.png"
          };
          addToast("🔧 Используется тестовый профиль (вне VK)");
        } else {
          throw bridgeError; // Бросаем реальную ошибку, если мы внутри VK но API не ответило
        }
      }
      
      if (userInfo && userInfo.id) {
        const vkEmail = `vk_${userInfo.id}@vk.com`;
        const vkPass = `vk_pass_${userInfo.id}`;
        const vkName = `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || `VK Player ${userInfo.id}`;
        const vkPhoto = userInfo.photo_200 || "";
        
        await performVKAuth(vkEmail, vkPass, vkName, vkPhoto);
        addToast(`👋 Успешный вход под VK аккаунтом: ${vkName}!`);
      } else {
        throw new Error("Не удалось получить данные профиля VK");
      }
    } catch (err: any) {
      console.error(err);
      addToast(`⚠️ Ошибка VK авторизации: ${err?.error_data?.error_reason || err?.message || err}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const syncWithVKCloud = async (customCoins?: number) => {
    try {
      if (currentUser?.email?.startsWith("vk_")) {
        const coinsToSave = typeof customCoins === "number" ? customCoins : coins;
        
        await Promise.all([
          vkBridge.send("VKWebAppStorageSet", { key: "vk_game_coins", value: String(coinsToSave) }),
          vkBridge.send("VKWebAppStorageSet", { key: "vk_game_click_power", value: String(clickPowerLevel) }),
          vkBridge.send("VKWebAppStorageSet", { key: "vk_game_auto_clicker", value: String(autoClickerLevel) }),
          vkBridge.send("VKWebAppStorageSet", { key: "vk_game_energy_level", value: String(energyLevel) }),
          vkBridge.send("VKWebAppStorageSet", { key: "vk_game_total_clicks", value: String(totalClicks) }),
          vkBridge.send("VKWebAppStorageSet", { key: "vk_game_player_name", value: playerName })
        ]);
        console.log("Progress successfully synchronized with VK Cloud storage.");
      }
    } catch (e) {
      console.warn("Sync skipped: not inside vk app scope or API unavailable.");
    }
  };

  const handleVKSignOut = () => {
    setConfirmModal({
      isOpen: true,
      title: "Выход из аккаунта",
      message: "Вы действительно хотите выйти из своего VK аккаунта? Вы сможете быстро войти в него снова, используя список сохраненных аккаунтов.",
      confirmText: "Да, выйти",
      cancelText: "Отмена",
      onConfirm: () => {
        sessionStorage.setItem("skipVKAutoLogin", "true");
        setIsAuthLoading(true);
        setConfirmModal(null);
        signOut(auth);
      }
    });
  };

  const handleTelegramCodeLogin = async () => {
    if (!telegramCode.trim()) {
      addToast("⚠️ Введите код авторизации!");
      return;
    }
    setIsTelegramLoggingIn(true);
    try {
      const res = await fetch(getApiUrl("/api/telegram-code-login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: telegramCode.trim() })
      });
      const data = await res.json();
      if (data && data.success && data.email && data.password) {
        await performTelegramAuth(data.email, data.password, data.displayName || "", data.photoURL || "");
        setTelegramCode("");
        // Close admin console on successful login
        setIsAdminConsoleOpen(false);
      } else {
        addToast(`❌ ${data.error || "Ошибка авторизации по коду."}`);
      }
    } catch (err: any) {
      console.error("Telegram code login failed:", err);
      if (err && err.code === "auth/operation-not-allowed") {
        addToast("⚠️ Включите метод Email/Password на вкладке Auth в консоли Firebase!");
      } else {
        addToast(`⚠️ Ошибка: ${err?.message || "Ошибка подключения к серверу."}`);
      }
    } finally {
      setIsTelegramLoggingIn(false);
    }
  };

  const handleTelegramSignOut = () => {
    setConfirmModal({
      isOpen: true,
      title: "Выход из аккаунта",
      message: "Вы действительно хотите выйти из своего Telegram аккаунта? Вы сможете быстро войти в него снова, используя список сохраненных аккаунтов.",
      confirmText: "Да, выйти",
      cancelText: "Отмена",
      onConfirm: () => {
        sessionStorage.setItem("skipVKAutoLogin", "true");
        setIsAuthLoading(true);
        setConfirmModal(null);
        signOut(auth);
      }
    });
  };

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    if (!currentUser) return;

    try {
      // 1. Update notification preference immediately
      const docRef = doc(db, "users", currentUser.uid);
      await setDoc(docRef, { notificationsEnabled: val, updatedAt: serverTimestamp() }, { merge: true });

      // 2. Notify the bot
      const tgId = currentUser.email && currentUser.email.startsWith("tg_") ? String(currentUser.email.split("@")[0].replace("tg_", "")) : null;
      if (tgId) {
        fetch(getApiUrl("/api/telegram-toggle-notifications"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            telegramId: tgId,
            enabled: val,
            playerName: playerName
          })
        }).catch(err => console.error("Failed to notify server about telegram notifications toggle:", err));
      }
      
      addToast(val ? "🔔 Уведомления включены!" : "🔕 Уведомления отключены.");
    } catch (err) {
      console.error("Failed to toggle notifications:", err);
      addToast("⚠️ Ошибка при изменении настроек уведомлений.");
    }
  };

  // --- P2P MARKETPLACE / SHOP FUNCTIONS ---
  useEffect(() => {
    if (!currentUser) {
      setMarketplaceListings([]);
      return;
    }
    try {
      const marketplaceCol = collection(db, "marketplace");
      const q = query(marketplaceCol, where("status", "==", "active"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
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
        setMarketplaceListings(items);
      }, (error) => {
        console.warn("Marketplace fetch/listen error:", error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to initialize marketplace listener:", e);
    }
  }, [currentUser]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      addToast("⚠️ Войдите в Google аккаунт, чтобы продавать предметы!");
      return;
    }
    const priceNum = Number(newListingPrice);
    if (!newListingTitle.trim()) {
      addToast("⚠️ Введите название предмета!");
      return;
    }
    if (newListingTitle.length > 50) {
      addToast("⚠️ Название предмета слишком длинное (макс. 50 символов)!");
      return;
    }
    if (!newListingDesc.trim()) {
      addToast("⚠️ Введите описание предмета!");
      return;
    }
    if (newListingDesc.length > 250) {
      addToast("⚠️ Описание слишком длинное (макс. 250 символов)!");
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      addToast("⚠️ Стоимость должна быть больше нуля!");
      return;
    }

    setIsSyncing(true);
    try {
      let resolvedImage = "";
      if (newListingImage === "custom") {
        resolvedImage = customListingImage.trim() || ITEM_MAP.custom;
      } else {
        resolvedImage = ITEM_MAP[newListingImage];
      }

      const listingData = {
        title: newListingTitle.trim(),
        description: newListingDesc.trim(),
        price: priceNum,
        sellerId: currentUser.uid,
        itemImage: resolvedImage,
        sellerName: playerName || currentUser.displayName || "Игрок",
        status: "active",
        createdAt: serverTimestamp()
      };
      
      const marketplaceCol = collection(db, "marketplace");
      await addDoc(marketplaceCol, listingData);
      
      if (activeSellingInventoryId) {
        const remainingItems = levelItems.filter(i => i.id !== activeSellingInventoryId);
        setLevelItems(remainingItems);
        setActiveSellingInventoryId(null);
        
        // Save remaining items to Firestore immediately to prevent items duplicating upon reload
        try {
          const userRef = doc(db, "users", currentUser.uid);
          await updateDoc(userRef, {
            levelItems: remainingItems,
            updatedAt: serverTimestamp()
          });
        } catch (dbErr) {
          console.warn("Failed to update inventory immediately inside publishListing:", dbErr);
        }
      }

      addToast("🏪 Предмет успешно выставлен на продажу!");
      setNewListingTitle("");
      setNewListingDesc("");
      setNewListingPrice("");
      setCustomListingImage("");
      setIsAddingListing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "marketplace");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCancelListing = async (listingId: string) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      const listingRef = doc(db, "marketplace", listingId);
      const userRef = doc(db, "users", currentUser.uid);

      await runTransaction(db, async (transaction) => {
        const listingSnap = await transaction.get(listingRef);
        const userSnap = await transaction.get(userRef);

        if (!listingSnap.exists()) {
          throw new Error("Этот лот не найден на рынке.");
        }

        const listingData = listingSnap.data();
        if (listingData.sellerId !== currentUser.uid) {
          throw new Error("Вы можете отменять только свои лоты.");
        }

        if (listingData.status !== "active") {
          throw new Error("Нельзя отменить лот, который уже куплен.");
        }

        // Reconstruct the item to be returned to the inventory
        const restoredItem: any = {
          id: `restored-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          title: listingData.title,
          desc: listingData.description || "Возвращено с рынка",
          img: listingData.itemImage && listingData.itemImage.startsWith("http") ? "custom" : listingData.itemImage || "sword",
          category: "purchased"
        };
        if (listingData.itemImage && listingData.itemImage.startsWith("http")) {
          restoredItem.customImg = listingData.itemImage;
        }

        const currentItems = userSnap.exists() && Array.isArray(userSnap.data().levelItems)
          ? userSnap.data().levelItems
          : levelItems;

        const updatedItems = [...currentItems, restoredItem];

        // Delete listing from marketplace
        transaction.delete(listingRef);

        // Update the seller document
        if (userSnap.exists()) {
          transaction.update(userRef, {
            levelItems: updatedItems,
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.set(userRef, {
            coins: coins,
            clickPowerLevel: clickPowerLevel || 1,
            autoClickerLevel: autoClickerLevel || 0,
            energyLevel: energyLevel || 1,
            energy: energy ?? 100,
            maxEnergy: maxEnergy ?? 100,
            regenRate: regenRate || 1,
            totalClicks: totalClicks || 0,
            playerName: playerName || "Игрок",
            playerClan: playerClan || null,
            levelItems: updatedItems,
            currentQuest: currentQuest || null,
            notificationsEnabled: notificationsEnabled !== false,
            updatedAt: serverTimestamp()
          });
        }

        // Update local state inside the transaction
        setLevelItems(updatedItems);
      });

      addToast("🏪 Предмет возвращен в ваш инвентарь!");
    } catch (err: any) {
      addToast(`❌ Ошибка отмены: ${err.message || err}`);
      console.error("Cancel listing error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleMessageSeller = (sellerId: string, sellerName: string, itemTitle: string) => {
    setActiveMainTab("social");
    setActiveSocialTab("friends");
    setActiveFriendChatId(sellerId);
    setFriendChatMessageText(`Привет! Я насчет предмета "${itemTitle}"... `);
    setSelectedListing(null);
    setIsShopOpen(false);
    addToast(`💬 Открыт личный чат с продавцом ${sellerName}!`);
  };

  const handleBuyItem = async (listing: any) => {
    if (!currentUser) {
      addToast("⚠️ Войдите в аккаунт, чтобы покупать предметы!");
      return;
    }
    if (listing.sellerId === currentUser.uid) {
      addToast("⚠️ Вы не можете купить собственный предмет!");
      return;
    }
    if (coins < listing.price) {
      addToast(`⚠️ Недостаточно монет! Требуется ${listing.price} 💰`);
      return;
    }

    setIsSyncing(true);
    try {
      const buyerRef = doc(db, "users", currentUser.uid);
      const sellerRef = doc(db, "users", listing.sellerId);
      const listingRef = doc(db, "marketplace", listing.id);

      const boughtItem: any = {
        id: `purchased-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        title: listing.title,
        desc: listing.description || "Куплено на рынке",
        img: listing.itemImage && listing.itemImage.startsWith("http") ? "custom" : listing.itemImage || "sword",
        category: "purchased"
      };
      if (listing.itemImage && listing.itemImage.startsWith("http")) {
        boughtItem.customImg = listing.itemImage;
      }

      await runTransaction(db, async (transaction) => {
        const buyerSnap = await transaction.get(buyerRef);
        const sellerSnap = await transaction.get(sellerRef);
        const listingSnap = await transaction.get(listingRef);

        if (!listingSnap.exists() || listingSnap.data().status !== "active") {
          throw new Error("Предмет уже продан или более не доступен.");
        }

        const currentBuyerCoins = buyerSnap.exists() ? (buyerSnap.data().coins || 0) : coins;
        if (currentBuyerCoins < listing.price) {
          throw new Error("Недостаточно монет на балансе в облаке.");
        }

        const currentBuyerItems = buyerSnap.exists() && Array.isArray(buyerSnap.data().levelItems)
          ? buyerSnap.data().levelItems
          : levelItems;

        const updatedBuyerItems = [...currentBuyerItems, boughtItem];

        // Update listing status
        transaction.update(listingRef, {
          status: "sold",
          buyerId: currentUser.uid,
          soldAt: serverTimestamp()
        });

        // Deduct coins and update levelItems for buyer atomically in Firestore
        if (buyerSnap.exists()) {
          transaction.update(buyerRef, {
            coins: currentBuyerCoins - listing.price,
            levelItems: updatedBuyerItems,
            updatedAt: serverTimestamp()
          });
        } else {
          transaction.set(buyerRef, {
            coins: currentBuyerCoins - listing.price,
            clickPowerLevel: clickPowerLevel || 1,
            autoClickerLevel: autoClickerLevel || 0,
            energyLevel: energyLevel || 1,
            energy: energy ?? 100,
            maxEnergy: maxEnergy ?? 100,
            regenRate: regenRate || 1,
            totalClicks: totalClicks || 0,
            playerName: playerName || "Игрок",
            playerClan: playerClan || null,
            levelItems: updatedBuyerItems,
            currentQuest: currentQuest || null,
            notificationsEnabled: notificationsEnabled !== false,
            updatedAt: serverTimestamp()
          });
        }

        // Credit seller atomically
        if (sellerSnap.exists()) {
          const currentSellerCoins = sellerSnap.data().coins || 0;
          transaction.update(sellerRef, {
            coins: currentSellerCoins + listing.price,
            updatedAt: serverTimestamp()
          });
        }
      });

      // Update states locally
      setCoins(prev => prev - listing.price);
      setLevelItems(prev => [...prev, boughtItem]);
      
      addToast(`🎉 Вы успешно купили "${listing.title}" за ${listing.price} комнов!`);
      
      setPurchasedListingId(listing.id);
      setIsBuying(true);
      
      // Attempt to log the trade to the Google sheet
      fetch(getApiUrl("/api/log-trade"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: currentUser.uid,
          sellerId: listing.sellerId,
          itemTitle: listing.title,
          price: listing.price
        })
      }).catch(err => console.error("Failed to log trade to sheet:", err));

      setTimeout(() => {
        setPurchasedListingId(null);
        setSelectedListing(null);
        setIsBuying(false);
      }, 1000);
      
    } catch (err: any) {
      addToast(`❌ Ошибка покупки: ${err.message || err}`);
      console.error("Purchase error details:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- GAME SYSTEM SETTINGS NAME ---
  const applySettingsName = () => {
    const trimmed = editingName.trim();
    if (trimmed) {
      setPlayerName(trimmed);
      addToast("👤 Ваше имя обновлено!");
      setIsSettingsOpen(false);
    }
  };

  const handleListingImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("⚠️ Пожалуйста, выберите изображение!");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast("⚠️ Файл слишком большой! Лимит 5МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgElement = new Image();
      imgElement.src = event.target?.result as string;
      
      imgElement.onload = () => {
        const MAX_SIZE = 150;
        let width = imgElement.width;
        let height = imgElement.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
          setCustomListingImage(compressedBase64);
          addToast("📸 Картинка успешно загружена!");
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("⚠️ Пожалуйста, выберите изображение!");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast("⚠️ Файл слишком большой! Лимит 5МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgElement = new Image();
      imgElement.src = event.target?.result as string;
      
      imgElement.onload = () => {
        const MAX_SIZE = 150;
        let width = imgElement.width;
        let height = imgElement.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
          setPlayerPhotoURL(compressedBase64);
          addToast("📸 Фото успешно прикреплено и оптимизировано!");
        } else {
          setPlayerPhotoURL(event.target?.result as string);
          addToast("📸 Фото успешно прикреплено!");
        }
      };
      
      imgElement.onerror = () => {
        setPlayerPhotoURL(event.target?.result as string);
        addToast("📸 Фото успешно прикреплено!");
      };
    };
    reader.readAsDataURL(file);
  };

  const handleResetProgress = () => {
    setConfirmModal({
      isOpen: true,
      title: "Сброс прогресса",
      message: "Вы действительно хотите сбросить весь игровой процесс? Это удалит ваш аккаунт из Firestore, очистит все локальные данные и выйдет из системы!",
      confirmText: "Да, сбросить всё",
      cancelText: "Отмена",
      onConfirm: async () => {
        try {
          if (currentUser) {
            // Delete user document from Firestore first so they are removed from active lists
            const userDocRef = doc(db, "users", currentUser.uid);
            try {
              await deleteDoc(userDocRef);
            } catch (err) {
              console.warn("Could not delete user doc from firestore", err);
            }
            
            // Forget this account from this device under savedAccounts
            try {
              const savedAccountsRaw = localStorage.getItem("gameSavedAccountsV1");
              if (savedAccountsRaw) {
                const parsed = JSON.parse(savedAccountsRaw);
                if (Array.isArray(parsed)) {
                  const filtered = parsed.filter((acc: any) => acc.uid !== currentUser.uid);
                  localStorage.setItem("gameSavedAccountsV1", JSON.stringify(filtered));
                  setSavedAccounts(filtered);
                }
              }
            } catch (e) {
              console.warn("Failed to clean up saved accounts in reset", e);
            }

            setIsAuthLoading(true);
            signOut(auth);
          }
          
          // Clear ALL local storage keys
          localStorage.removeItem("gameDataV9");
          localStorage.removeItem("myPlayerIdV9");
          localStorage.removeItem("gameFriendsV9");
          localStorage.removeItem("gameDirectMsgsV9");
          localStorage.removeItem("gameLevelItemsV12");
          localStorage.removeItem("gameLastClaimedLevelV12");
          localStorage.removeItem("gameLiquidGlass");
          
          addToast("🗑️ Прогресс игры успешно сброшен!");
          setIsSettingsOpen(false);
          setConfirmModal(null);
          
          // Wait 1 second to show toast, then reload for a fresh guest ID or clean login
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (error) {
          addToast("⚠️ Ошибка при сбросе.");
          console.error(error);
          setConfirmModal(null);
        }
      }
    });
  };

  // --- INDIVIDUAL FAMILY CLAN MANAGEMENT ---
  const handleCreateClan = () => {
    const name = newClanName.trim();
    if (!name) return;
    if (playerClan) {
      addToast("⚠️ Сначала покиньте ваш текущий клан!");
      return;
    }
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "create_clan",
        data: {
          id: effectivePlayerId,
          name,
          password: isClanPrivate ? newClanPassword : ""
        }
      }));
    } else {
      addToast("⚠️ Нет подключения к серверу.");
    }
  };

  const handleJoinClan = (clanName: string) => {
    if (playerClan) {
      addToast("⚠️ Сначала покиньте ваш текущий клан!");
      return;
    }
    
    const isPrivateClan = clansPrivacy.find(c => c.name === clanName)?.isPrivate;
    if (isPrivateClan) {
      setJoiningClanWithPassword(clanName);
      setEnteredJoinPassword("");
    } else {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "join_clan",
          data: { id: effectivePlayerId, clanName, password: "" }
        }));
      } else {
        addToast("⚠️ Нет подключения к серверу.");
      }
    }
  };

  const handleLeaveClan = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "leave_clan",
        data: { id: effectivePlayerId }
      }));
    } else {
      addToast("⚠️ Нет подключения к серверу.");
    }
  };

  const submitJoinPassword = () => {
    if (!joiningClanWithPassword) return;
    if (!enteredJoinPassword) {
      addToast("⚠️ Введите пароль клана!");
      return;
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "join_clan",
        data: {
          id: effectivePlayerId,
          clanName: joiningClanWithPassword,
          password: enteredJoinPassword
        }
      }));
    } else {
      addToast("⚠️ Нет подключения к серверу.");
    }
  };

  // --- FRIENDS ACTIONS ---
  const handleAddFriend = (id: string, name: string) => {
    if (id === effectivePlayerId) return;
    if (friendsList.includes(id)) {
      addToast("⭐ Игрок уже у вас в друзьях");
      return;
    }
    setFriendsList((prev) => [...prev, id]);
    addToast(`⭐ ${name} добавлен в друзья!`);
  };

  const handleRemoveFriend = (id: string) => {
    setFriendsList((prev) => prev.filter((fid) => fid !== id));
    addToast("Друг удален из списка");
    if (activeFriendChatId === id) {
      setActiveFriendChatId(null);
    }
  };

  const handleViewFriendProfile = (fid: string) => {
    const details = onlinePlayers.find((p) => p.id === fid);
    if (details) {
      setViewingProfile(details);
    } else {
      setViewingProfile({
        id: fid,
        name: "Игрок (офлайн)",
        clan: null,
        coins: 0,
        clicks: 0,
        color: "#aab3c4",
        isOnline: false,
        photoURL: ""
      } as any);
    }
  };

  const handleViewChatPlayerProfile = (id: string, name: string) => {
    if (id === "SYSTEM_BOT" || id === "system") return;
    const found = onlinePlayers.find(p => p.id === id);
    if (found) {
      setViewingProfile(found);
    } else {
      setViewingProfile({
        id: id,
        name: name,
        clan: null,
        coins: 0,
        clicks: 0,
        color: "#9b59b6",
        isOnline: false,
        photoURL: ""
      } as any);
    }
  };

  // --- SEND DIRECT MESSAGE TO FRIEND ---
  const sendDirectMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFriendChatId || !friendChatMessageText.trim()) return;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "direct_msg",
        data: {
          playerId: effectivePlayerId,
          recipientId: activeFriendChatId,
          text: friendChatMessageText.trim()
        }
      }));
      setFriendChatMessageText("");
      playSentSound();
    } else {
      addToast("⚠️ Ошибка подключения. Сообщение не отправлено.");
    }
  };

  // --- RENDER SELECTION SCREEN ---
  if (!appVersion) {
    return (
      <div id="versionScreen" className="fixed inset-0 bg-[#0a0f1e] flex items-center justify-center z-[10000] p-4 font-sans text-white">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#0f1829] rounded-[30px] p-8 text-center w-full max-w-sm border border-[#2c3e50]/60 shadow-2xl"
        >
          <img 
            src="/images/app_icon.jpg" 
            alt="Клик Клан" 
            className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg border border-amber-500/20"
          />
          <h2 className="text-3xl font-extrabold text-[#ffd966] mb-2 tracking-tight">Клик Клан</h2>
          <p className="text-sm text-gray-400 mb-8 font-medium">Выберите версию для оптимизации интерфейса</p>
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => chooseVersion("pc")} 
              className="py-4 px-6 bg-[#2c3e50] hover:bg-[#3d566e] transition-all duration-200 rounded-2xl text-lg font-bold shadow-lg flex items-center justify-center gap-2"
            >
              🖥️ ПК Версия
            </button>
            <button 
              onClick={() => chooseVersion("mobile")} 
              className="py-4 px-6 bg-[#e67e22] hover:bg-[#d35400] transition-all duration-200 rounded-2xl text-lg font-bold shadow-lg flex items-center justify-center gap-2"
            >
              📱 Мобильная
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const renderQuestsContent = () => {
    return (
      <div className="flex flex-col gap-3 h-full justify-between pb-1 text-white">
        <div className="bg-[#162239] rounded-2xl p-4 border border-[#e67e22]/30 flex flex-col gap-3.5 relative">
          <div>
            <span className="text-[11px] font-extrabold text-[#ffd966] block uppercase tracking-wider font-mono">📜 Текущее задание</span>
            <span className="text-base font-bold text-white mt-1 block">{currentQuest.desc}</span>
          </div>
          
          <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs">
            <span className="text-gray-400 font-semibold">Прогресс действия:</span>
            <span className="font-mono text-[#ffd966] font-bold">
              {currentQuest.type === "clicks" ? totalClicks : coins} / {currentQuest.target}
            </span>
          </div>
        </div>

        <div className="flex gap-2.5 mt-4">
          <button 
            type="button"
            onClick={claimQuestReward}
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm shadow-md transition-all border-none ${
              ((currentQuest.type === "clicks" ? totalClicks : coins) >= currentQuest.target)
                ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer animate-pulse"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
          >
            ЗАБРАТЬ {currentQuest.reward} 💰
          </button>
          <button 
            type="button"
            onClick={generateNewQuest}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-gray-300 transition-colors border-none cursor-pointer"
          >
            Сменить 🔄
          </button>
        </div>
      </div>
    );
  };

  const parseChatMessageText = (text: string) => {
    if (!text) return "";
    const mentionRegex = /@([a-zA-ZА-Яа-я0-9_ёЁ\-]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      const wholeMention = match[0];
      const username = match[1];
      
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }
      
      const isCurrentUser = username.toLowerCase() === playerName.toLowerCase() || username.toLowerCase() === "всем" || username.toLowerCase() === "all";
      
      parts.push(
        <span 
          key={matchIndex} 
          className={`px-1 rounded-md font-extrabold border select-all ${
            isCurrentUser 
              ? "bg-amber-500/35 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse" 
              : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
          }`}
        >
          {wholeMention}
        </span>
      );
      
      lastIndex = mentionRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  const renderChatContent = () => {
    return (
      <div className="flex flex-col h-full justify-between min-h-0 text-white">
        {/* Channel Selector */}
        <div className="grid grid-cols-2 gap-2 mb-2.5 p-1 bg-black/40 rounded-xl border border-white/5 text-[10px] font-black uppercase">
          <button
            type="button"
            onClick={() => setChatChannel("global")}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-none ${
              chatChannel === "global" ? "bg-[#34495e] text-white" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            🌐 Всеобщий
          </button>
          <button
            type="button"
            onClick={() => setChatChannel("clan")}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer border-none ${
              chatChannel === "clan" ? "bg-[#e67e22] text-white" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            🏰 Клан {playerClan ? `[${playerClan}]` : ""}
          </button>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-[300px] max-h-[400px] text-xs">
          {chatChannel === "clan" && !playerClan ? (
            <div className="text-center text-gray-400 my-auto py-6 px-4">
              <p className="font-extrabold text-[#ffd966] mb-1 text-[13px] uppercase tracking-wide">Вступите в Клан!</p>
              <p className="text-[11px] leading-relaxed text-gray-455">
                Создайте свой собственный клан или вступите в него в разделе <span className="text-[#e67e22] font-bold">{"Социальное меню → Кланы"}</span>, чтобы открыть этот зашифрованный чат!
              </p>
            </div>
          ) : chatChannel === "clan" ? (
            clanChatHistory.length === 0 ? (
              <div className="text-center text-gray-405 my-auto py-8">
                🛡️ В чате клана пока нет сообщений. Начните общение с союзниками!
              </div>
            ) : (
              clanChatHistory.map((m) => {
                const isSelf = m.playerId === effectivePlayerId;
                return (
                  <div 
                    key={m.id} 
                    className={`p-2 rounded-xl flex flex-col gap-0.5 max-w-[90%] ${
                      isSelf 
                        ? "bg-[#e67e22]/20 border border-[#e67e22]/30 self-end text-right" 
                        : "bg-slate-800/80 border border-white/5 self-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span 
                        style={{ color: m.color }} 
                        className="font-semibold cursor-pointer hover:underline block truncate max-w-[100px]"
                        onClick={() => handleViewChatPlayerProfile(m.playerId, m.playerName)}
                      >
                        {m.playerName}
                      </span>
                      <span className="text-gray-500 font-mono font-medium ml-auto">{m.timestamp}</span>
                    </div>
                    <p className="text-white font-medium select-text whitespace-pre-wrap break-all pr-1">{parseChatMessageText(m.text)}</p>
                  </div>
                );
              })
            )
          ) : (
            globalChatHistory.length === 0 ? (
              <div className="text-center text-gray-450 my-auto py-8">
                Никто еще не писал в чат лобби. Будьте первыми!
              </div>
            ) : (
              globalChatHistory
                .filter(m => !( (m.playerId === "SYSTEM_BOT" || m.playerId === "system") && m.text.includes("У вас новое сообщение от") ))
                .filter(m => !mutedPlayers.includes(m.playerId))
                .map((m) => {
                const isSelf = m.playerId === effectivePlayerId;
                const isSystem = m.playerId === "SYSTEM_BOT" || m.playerId === "system";
                return (
                  <div 
                    key={m.id} 
                    className={`p-3 rounded-xl flex flex-col gap-1.5 ${
                      isSelf 
                        ? "bg-blue-600/30 border border-blue-500/20 self-end text-right max-w-[90%]" 
                        : isSystem
                        ? "bg-gradient-to-r from-[#1d1b4a]/70 to-[#0e172a]/70 border border-[#e67e22]/60 text-indigo-100 self-center shadow-[0_0_15px_rgba(230,126,34,0.15)] w-full text-center"
                        : "bg-[#162239] border border-white/5 self-start max-w-[90%]"
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold ${
                      isSystem ? "justify-center text-[#ffbc6e]" : ""
                    }`}>
                      {!isSystem && (
                        <span className="px-1.5 py-0.5 rounded-md bg-black/20 text-indigo-300 font-mono">
                          {m.clan ? `[${m.clan}]` : "Игрок"}
                        </span>
                      )}
                      <span 
                        style={{ color: isSystem ? "#e67e22" : m.color }} 
                        className={`font-black cursor-pointer block truncate ${
                          isSystem ? "text-xs select-none font-sans font-black tracking-wider text-[#ffbc6e] uppercase" : "hover:underline max-w-[100px]"
                        }`}
                        onClick={() => {
                          if (!isSystem) {
                            handleViewChatPlayerProfile(m.playerId, m.playerName);
                          }
                        }}
                      >
                        {m.playerName}
                      </span>
                      <span className="text-gray-500 font-mono font-medium ml-auto">{m.timestamp}</span>
                    </div>
                    <p className={`text-white font-medium select-text whitespace-pre-wrap break-all pr-1 ${isSystem ? "text-[11px] leading-relaxed mx-auto text-center font-semibold text-gray-100 bg-black/10 py-1 px-2.5 rounded-lg border border-white/5" : ""}`}>
                      {parseChatMessageText(m.text)}
                    </p>
                    
                    {m.playerId === "SYSTEM_BOT" && (
                      <div className="flex gap-2 mt-2 w-full">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMainTab("social");
                            setActiveSocialTab("friends");
                            if (m.senderId) {
                              setActiveFriendChatId(m.senderId);
                            }
                            // Also automatically filter out this message locally so they don't have to clean it up
                            setGlobalChatHistory(prev => prev.filter(msg => msg.id !== m.id));
                          }}
                          className="flex-1 py-1.5 px-3 bg-[#e67e22] hover:bg-[#d35400] text-[10px] text-white font-extrabold rounded-lg cursor-pointer transition-all shadow flex items-center justify-center gap-1 border-none outline-none"
                        >
                          ✉️ Открыть диалог
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Filter out this message from globalChatHistory locally
                            setGlobalChatHistory(prev => prev.filter(msg => msg.id !== m.id));
                          }}
                          className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-[10px] text-gray-300 font-bold rounded-lg cursor-pointer transition-all border border-white/5 outline-none"
                        >
                          ❌ Скрыть
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Message control inputs */}
        <form onSubmit={sendChatMessage} className="mt-3 flex items-center gap-1.5 pt-2.5 border-t border-white/5">
          <input 
            type="text" 
            value={chatMessageText}
            onChange={(e) => setChatMessageText(e.target.value)}
            maxLength={150}
            placeholder={chatChannel === "clan" ? "Напишите союзникам..." : "Напишите в общий чат..."}
            className="flex-1 h-9 px-3 bg-slate-950 text-white rounded-xl text-xs border border-slate-800 outline-none focus:border-slate-600 font-sans"
          />
          <button 
            type="submit" 
            className={`w-9 h-9 flex items-center justify-center rounded-xl shadow-md cursor-pointer transition-colors border-none outline-none shrink-0 ${
              chatChannel === "clan" ? "bg-[#e67e22] hover:bg-[#d35400]" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </form>
      </div>
    );
  };

  const renderShopContent = () => {
    // Computed filtered listings inside the shop sheet handler
    const filteredListings = marketplaceListings
      .filter((listing) => {
        // 1. Search filter
        const matchesSearch = listing.title.toLowerCase().includes(shopSearchQuery.toLowerCase());
        
        // 2. Category filter
        let matchesCategory = true;
        if (shopCategory !== "all") {
          if (shopCategory === "custom") {
            const img = String(listing.itemImage);
            matchesCategory = !img.includes("item_sword") && !img.includes("item_potion") && !img.includes("item_shield");
          } else {
            // matches weapon/potions presets
            const imageStr = String(listing.itemImage);
            if (shopCategory === "weapons") {
              matchesCategory = imageStr.includes("item_sword") || imageStr.includes("item_shield");
            } else if (shopCategory === "potions") {
              matchesCategory = imageStr.includes("item_potion");
            }
          }
        }
        
        // 3. Min price
        const minPrice = Number(shopPriceMin);
        const matchesMin = !shopPriceMin || isNaN(minPrice) || listing.price >= minPrice;
        
        // 4. Max price
        const maxPrice = Number(shopPriceMax);
        const matchesMax = !shopPriceMax || isNaN(maxPrice) || listing.price <= maxPrice;
        
        return matchesSearch && matchesCategory && matchesMin && matchesMax;
      })
      .sort((a, b) => {
        if (shopSort === "price_asc") {
          return a.price - b.price;
        } else if (shopSort === "price_desc") {
          return b.price - a.price;
        } else {
          // newest
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        }
      });

    return (
      <div className="flex flex-col h-full min-h-0 text-[#aab7c4]">
        {/* Inner Shop sub-navigation */}
        <div className="flex bg-slate-950/45 p-1 rounded-xl border border-white/5 mb-3 select-none text-xs font-black uppercase shadow-inner">
          <button
            type="button"
            onClick={() => {
              setActiveShopTab("buy");
              setSelectedListing(null);
            }}
            className={`flex-1 py-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer border-none outline-none ${
              activeShopTab === "buy" ? "bg-[#e67e22] text-white font-extrabold shadow-md" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> КУПИТЬ ЛОТЫ
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveShopTab("sell");
              setSelectedListing(null);
            }}
            className={`flex-1 py-3 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer border-none outline-none ${
              activeShopTab === "sell" ? "bg-[#e67e22] text-white font-extrabold shadow-md" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            <Tag className="w-4 h-4" /> ПРОДАТЬ / ИНВЕНТАРЬ
          </button>
        </div>

        {activeShopTab === "buy" ? (
          /* --- BUY CONTAINER WITH REAL FILTERS --- */
          <div className="flex flex-col gap-2.5 min-h-0 flex-1">
            {/* Search and Category Filters */}
            <div className="flex flex-col gap-2.5 bg-[#0B1120] p-3 rounded-[16px] border border-white/5 shadow-lg">
              <input
                type="text"
                placeholder="Поиск лотов по названию..."
                value={shopSearchQuery}
                onChange={(e) => setShopSearchQuery(e.target.value)}
                className="w-full bg-[#040914] text-[11px] text-[#A0ABC0] p-2.5 rounded-[10px] border border-white/5 outline-none focus:border-[#5c4dff]/50 placeholder-[#57647e] font-sans"
              />
              
              <div className="grid grid-cols-3 gap-2 text-[10px] font-black uppercase mt-1">
                <button
                  type="button"
                  onClick={() => setShopCategory("all")}
                  className={`py-1.5 rounded-lg border transition-all text-center cursor-pointer ${
                    shopCategory === "all" ? "bg-[#5D42FF] border-transparent text-white shadow-[0_4px_15px_rgba(93,66,255,0.4)]" : "bg-[#0B1120] border-white/5 hover:border-white/10 text-[#718096]"
                  }`}
                >
                  Все
                </button>
                <button
                  type="button"
                  onClick={() => setShopCategory("weapons")}
                  className={`py-1.5 rounded-lg border transition-all text-center cursor-pointer ${
                    shopCategory === "weapons" ? "bg-[#5D42FF] border-transparent text-white shadow-[0_4px_15px_rgba(93,66,255,0.4)]" : "bg-[#0B1120] border-white/5 hover:border-white/10 text-[#718096]"
                  }`}
                >
                  ⚔️ Оружие/Щиты
                </button>
                <button
                  type="button"
                  onClick={() => setShopCategory("custom")}
                  className={`py-1.5 rounded-lg border transition-all text-center cursor-pointer ${
                    shopCategory === "custom" ? "bg-[#5D42FF] border-transparent text-white shadow-[0_4px_15px_rgba(93,66,255,0.4)]" : "bg-[#0B1120] border-white/5 hover:border-white/10 text-[#718096]"
                  }`}
                >
                  🎨 Свои
                </button>
              </div>

              <div className="h-px w-full bg-white/5 my-1"></div>

              {/* Sorting and Price restrictions */}
              <div className="grid grid-cols-2 gap-3 text-[9px] font-bold uppercase">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[#A0ABC0] font-mono text-[9px] tracking-wide">Сортировка</span>
                  <select
                    value={shopSort}
                    onChange={(e) => setShopSort(e.target.value)}
                    className="bg-[#040914] border border-white/5 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="newest">Сначала новые ⏱️</option>
                    <option value="price_asc">Дешевые 💰</option>
                    <option value="price_desc">Дорогие 💎</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[#A0ABC0] font-mono text-[9px] tracking-wide">Цена ( 💰 )</span>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      placeholder="Мин"
                      value={shopPriceMin}
                      onChange={(e) => setShopPriceMin(e.target.value)}
                      className="bg-[#040914] border border-white/5 rounded-lg px-2 py-1.5 text-[10px] w-full text-center outline-none focus:border-[#5c4dff]/50 font-mono text-white placeholder-[#B8860B]"
                    />
                    <span className="text-gray-700 self-center font-mono">-</span>
                    <input
                      type="number"
                      placeholder="Макс"
                      value={shopPriceMax}
                      onChange={(e) => setShopPriceMax(e.target.value)}
                      className="bg-[#040914] border border-white/5 rounded-lg px-2 py-1.5 text-[10px] w-full text-center outline-none focus:border-[#5c4dff]/50 font-mono text-white placeholder-[#B8860B]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Marketplace cards list */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-[300px]">
              {filteredListings.length === 0 ? (
                <div className="text-center text-gray-500 py-12 bg-black/10 rounded-2xl border border-white/5">
                  <Store className="w-9 h-9 text-gray-600 mx-auto mb-2 opacity-50" />
                  <p className="font-extrabold text-[12px] text-gray-400 uppercase tracking-wide">Ничего не найдено</p>
                  <p className="text-[10px] text-gray-500 mt-1">Попробуйте изменить ваши поисковые настройки.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {filteredListings.map((listing) => (
                    <div
                      key={listing.id}
                      onClick={() => setSelectedListing(listing)}
                      className="bg-[#162239] hover:bg-[#1f2d4a] transition-all rounded-xl p-3.5 flex justify-between items-center border border-white/5 cursor-pointer active:scale-[0.99] group shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center border border-white/5 shrink-0 overflow-hidden shadow-inner">
                          <img 
                            src={listing.itemImage} 
                            className="w-full h-full object-cover" 
                            onError={(e) => { (e.target as HTMLImageElement).src = ITEM_MAP.custom; }}
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-extrabold text-[#75c6ff] truncate group-hover:text-[#ffd966] transition-colors leading-tight">
                            {listing.title}
                          </span>
                          <span className="text-[10px] text-gray-400 block truncate mt-1">
                            Продавец: <span className="text-emerald-400 font-bold">{listing.sellerName}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                        <span className="px-3 py-1 bg-[#27ae60]/10 border border-[#27ae60]/20 rounded-xl text-[13px] font-black text-[#2ecc71] whitespace-nowrap shadow-sm font-mono">
                          {listing.price.toLocaleString()} 💰
                        </span>
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Подробнее →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* --- SELL CONTAINER (LEVEL REWARD INVENTORY + FORM) --- */
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0">
            {/* Level Reward items listing section */}
            <div className="bg-[#152033] border border-indigo-950/40 rounded-2xl p-3 flex flex-col gap-2">
              <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                <span className="text-[10px] text-[#ffd966] font-black uppercase tracking-wider flex items-center gap-1 font-mono">
                  🎒 ВАШИ УРОВНЕВЫЕ НАГРАДЫ ({levelItems.length})
                </span>
                <span className="text-[8.5px] font-mono text-gray-500">Повышайте уровень! 📈</span>
              </div>
              
              {levelItems.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold italic">Ваш инвентарь наград сейчас пуст.</p>
                  <p className="text-[9px] text-gray-500 mt-1 leading-normal">Каждый новый левел-ап дает эксклюзивный предмет, который вы можете прибыльно выставить на рынок лобби!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto scrollbar-thin">
                  {levelItems.map((item) => (
                    <div 
                      key={item.id} 
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                        activeSellingInventoryId === item.id ? "bg-amber-950/20 border-amber-500/40" : "bg-slate-950/40 border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-slate-950 overflow-hidden flex items-center justify-center border border-white/5 shrink-0">
                          <img 
                            src={item.img === "custom" ? item.customImg : ITEM_MAP[item.img as keyof typeof ITEM_MAP]} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-extrabold text-[#ffbc6e] truncate">{item.title}</span>
                          <span className="text-[8px] text-gray-400 truncate mt-0.5">{item.desc}</span>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSellingInventoryId(item.id);
                          setNewListingTitle(item.title.replace(/[^\w\sа-яА-ЯёЁ\-\[\]]/g, "").trim());
                          setNewListingDesc(item.desc);
                          setNewListingImage(item.img === "custom" ? "custom" : item.img);
                          if (item.img === "custom" && item.customImg) {
                            setCustomListingImage(item.customImg);
                          }
                          setIsAddingListing(true);
                          addToast(`📝 Выбран: "${item.title}". Укажите цену.`);
                        }}
                        className="py-1 px-3 bg-amber-600 hover:bg-amber-500 transition-colors text-[9px] font-black rounded-lg text-white uppercase shrink-0 cursor-pointer border-none shadow"
                      >
                        Выбрать 💰
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!isAddingListing ? (
              /* Sell Intro view */
              <div className="flex flex-col items-center py-4 text-center bg-black/10 rounded-2xl border border-white/5 p-4 mt-1.5">
                <Store className="w-10 h-10 text-[#e67e22]/40 mx-auto mb-1.5" />
                <p className="font-extrabold text-[#ffd966] text-xs uppercase tracking-wide">Создать Кастомный Лот</p>
                <p className="text-[9.5px] leading-relaxed text-gray-400 mt-1 max-w-sm">
                  Вы можете составить кастомное описание, загрузив в лобби свой собственный рисунок в качестве картинки!
                </p>
                
                <button
                  type="button"
                  onClick={() => {
                    setActiveSellingInventoryId(null);
                    setNewListingTitle("");
                    setNewListingDesc("");
                    setNewListingImage("sword");
                    setCustomListingImage("");
                    setIsAddingListing(true);
                  }}
                  className="py-2.5 px-6 bg-[#e67e22] hover:bg-[#d35400] transition-colors rounded-xl text-[10px] font-black text-white shadow-md uppercase tracking-wider outline-none border-none mt-4 cursor-pointer"
                >
                  + Создать Своё Лот-Письмо
                </button>
              </div>
            ) : (
              /* Add Listing Form view with custom images support */
              <form onSubmit={handleCreateListing} className="flex flex-col gap-2.5 p-3 bg-black/20 rounded-xl border border-white/5">
                <div className="flex justify-between items-center p-0.5 border-b border-white/5 pb-1.5">
                  <span className="text-[9.5px] text-amber-400 font-extrabold uppercase tracking-wider flex items-center gap-1 font-mono">
                    {activeSellingInventoryId ? "📦 Левел-награда выбран" : "📥 Кастомное предложение"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingListing(false)}
                    className="text-[9px] text-[#ff6b62] hover:text-white font-mono border-none bg-transparent cursor-pointer"
                  >
                    [Назад]
                  </button>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-indigo-400 font-black uppercase tracking-wider font-mono">Иконка Предмета</label>
                  <div className="flex gap-2">
                    {(Object.keys(ITEM_MAP) as Array<keyof typeof ITEM_MAP>).map(key => (
                      <button 
                        key={key}
                        type="button"
                        onClick={() => setNewListingImage(key)}
                        className={`w-9 h-9 rounded-lg border-2 p-0.5 flex overflow-hidden shrink-0 transition-all ${
                          newListingImage === key ? "border-amber-400 bg-amber-950/40" : "border-slate-800 bg-slate-950/60 hover:bg-slate-900"
                        }`}
                      >
                        <img 
                          src={key === "custom" && customListingImage ? customListingImage : ITEM_MAP[key]} 
                          className="w-full h-full object-cover" 
                          onError={(e) => { (e.target as HTMLImageElement).src = ITEM_MAP.custom }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {newListingImage === "custom" && (
                  <div className="flex flex-col gap-1.5 mt-0.5">
                    <span className="text-[9px] text-[#ffbc6e] font-bold font-mono uppercase tracking-wider">Прикрепить свою картинку 📸</span>
                    <div className="flex gap-1.5">
                      <input
                        type="file"
                        id="listing-image-upload"
                        accept="image/*"
                        onChange={handleListingImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="listing-image-upload"
                        className="flex-1 px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-dashed border-[#ffbc6e]/40 hover:border-[#ffbc6e]/80 text-[11px] font-black text-[#ffbc6e] rounded-lg cursor-pointer transition-all uppercase tracking-wider text-center"
                      >
                        Прикрепить фото / Выбрать файл 📎
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-indigo-400 font-black uppercase tracking-wider font-mono font-medium">Название предмета</label>
                  <input
                    type="text"
                    placeholder="Напр. Сверхпроводящий Чип, Амулет Заря"
                    maxLength={40}
                    required
                    value={newListingTitle}
                    onChange={(e) => setNewListingTitle(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs font-bold rounded-lg text-white placeholder-gray-700 outline-none focus:border-amber-600"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-indigo-400 font-black uppercase tracking-wider font-mono font-medium">Свойства / Описание лота</label>
                  <textarea
                    placeholder="Опишите свойства предмета..."
                    maxLength={180}
                    rows={2}
                    required
                    value={newListingDesc}
                    onChange={(e) => setNewListingDesc(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs font-semibold rounded-lg text-white placeholder-gray-700 outline-none focus:border-amber-600 resize-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-indigo-400 font-black uppercase tracking-wider font-mono font-medium">Стоимость (монеты 💰)</label>
                    <input
                      type="number"
                      placeholder="120"
                      min="1"
                      required
                      value={newListingPrice}
                      onChange={(e) => setNewListingPrice(e.target.value)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 text-xs font-black rounded-lg text-amber-400 outline-none focus:border-amber-600 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider font-mono block font-medium">Продавец</span>
                    <span className="px-3 py-1.5 bg-slate-900 border border-slate-800/60 text-xs font-extrabold rounded-lg text-emerald-400 truncate select-none leading-normal">
                      👤 {playerName}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-500 transition-colors text-xs font-black rounded-lg cursor-pointer text-white flex items-center justify-center gap-1 uppercase outline-none mt-1.5 border-none shadow w-full"
                >
                  🛍 Опубликовать на Рынке
                </button>
              </form>
            )}

            {/* Display seller's active listings */}
            {!isAddingListing && currentUser && (
              <div className="mt-4 border-t border-white/5 pt-3">
                <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest font-mono block mb-2">Ваши лоты на продаже</span>
                {marketplaceListings.filter((l) => l.sellerId === currentUser.uid).length === 0 ? (
                  <p className="text-[9px] text-gray-655 text-center font-semibold italic py-1">Вы ничего не продаете в данный момент.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 font-sans">
                    {marketplaceListings
                      .filter((l) => l.sellerId === currentUser.uid)
                      .map((myListing) => (
                        <div key={myListing.id} className="bg-slate-950/40 border border-white/5 rounded-lg p-2.5 flex justify-between items-center text-xs animate-fade-in">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="font-extrabold text-[#75c6ff] truncate text-[11px]">{myListing.title}</span>
                            <span className="text-[9.5px] text-[#2ecc71] font-bold font-mono mt-0.5">{myListing.price.toLocaleString()} 💰</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCancelListing(myListing.id)}
                            className="py-1 px-3 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/20 text-rose-400 text-[9.5px] font-black rounded-lg cursor-pointer transition-colors outline-none"
                          >
                            Снять ❌
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleRefreshPlayers = () => {
    setIsRefreshingPlayers(true);
    addToast("🔄 Обновление списка игроков...");
    
    // Explicitly send status update to trigger server broadcastPlayers()
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const tgId = linkedTelegramId || (currentUser?.email && currentUser.email.startsWith("tg_") ? String(currentUser.email.split("@")[0].replace("tg_", "")) : null);
      socketRef.current.send(JSON.stringify({
        type: "status_update",
        data: {
          id: effectivePlayerId,
          name: playerName,
          clan: playerClan,
          coins,
          clicks: totalClicks,
          photoURL: playerPhotoURL,
          telegramId: tgId || undefined,
          autoClickerLevel: autoClickerLevel
        }
      }));
    }
    
    setTimeout(() => {
      setIsRefreshingPlayers(false);
      addToast("✅ Список игроков успешно обновлен!");
    }, 850);
  };

  const handleSearchPlayers = async () => {
    if (!playerSearchQuery.trim()) {
      setCustomSearchResults(null);
      return;
    }
    setIsSearchingFirestore(true);
    addToast("🔍 Поиск игроков по всей базе...");
    try {
      const q = query(collection(db, "users"), limit(150));
      const snap = await getDocs(q);
      const allDbPlayers = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.playerName || data.name || data.displayName || "Без имени",
          coins: data.coins || 0,
          clan: data.playerClan || data.clan || null,
          photoURL: data.photoURL || null,
          isOnline: onlinePlayers.some(op => op.id === d.id)
        };
      });
      const queryLower = playerSearchQuery.toLowerCase();
      const filtered = allDbPlayers.filter(p => 
        p.id !== effectivePlayerId && 
        (p.name.toLowerCase().includes(queryLower) || (p.clan || "").toLowerCase().includes(queryLower))
      );
      setCustomSearchResults(filtered);
      if (filtered.length === 0) {
        addToast(`😟 Игроки по запросу "${playerSearchQuery}" не найдены`);
      } else {
        addToast(`✅ Найдено пользователей: ${filtered.length}`);
      }
    } catch (err) {
      console.error("Firestore global user search error:", err);
      // Fallback matching online players only
      const foundOnline = onlinePlayers.filter(p => 
        p.id !== effectivePlayerId && 
        p.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
      );
      setCustomSearchResults(foundOnline);
      addToast("⚠️ Ошибка; поиск выполнен по игрокам в сети");
    } finally {
      setIsSearchingFirestore(false);
    }
  };

  const renderSocialContent = () => {
    return (
      <div className="flex flex-col h-full min-h-0 text-[#aab7c4]">
        {/* Social navigation tabs */}
        <div className="grid grid-cols-4 gap-1 bg-slate-950/45 p-1 rounded-xl border border-white/5 mb-3 select-none text-[9px] font-black uppercase">
          <button
            type="button"
            onClick={() => {
              setActiveSocialTab("players");
              setPlayerSearchQuery("");
            }}
            className={`h-9 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer border-none outline-none ${
              activeSocialTab === "players" ? "bg-[#e67e22] text-white font-extrabold" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            <Users className="w-3.5 h-3.5" /> ИГРОКИ
          </button>
          <button
            type="button"
            onClick={() => setActiveSocialTab("clans")}
            className={`h-9 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer border-none outline-none ${
              activeSocialTab === "clans" ? "bg-[#e67e22] text-white font-extrabold" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> КЛАНЫ
          </button>
          <button
            type="button"
            onClick={() => setActiveSocialTab("friends")}
            className={`h-9 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer border-none outline-none ${
              activeSocialTab === "friends" ? "bg-[#e67e22] text-white font-extrabold" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            <Star className="w-3.5 h-3.5" /> ДРУЗЬЯ {friendsList.length > 0 ? `(${friendsList.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setActiveSocialTab("leaderboard")}
            className={`h-9 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer border-none outline-none ${
              activeSocialTab === "leaderboard" ? "bg-[#e67e22] text-white font-extrabold" : "text-gray-400 hover:text-white bg-transparent"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> ТОП-10
          </button>
        </div>

        {/* List wrap containers */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeSocialTab === "players" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="🔍 Поиск игрока..." 
                  value={playerSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPlayerSearchQuery(val);
                    if (val.trim() === "") {
                      setCustomSearchResults(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearchPlayers();
                    }
                  }}
                  className="flex-1 p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none focus:border-slate-500 font-sans"
                />
                <button
                  type="button"
                  onClick={handleSearchPlayers}
                  disabled={isSearchingFirestore}
                  className="px-3.5 bg-[#e67e22] hover:bg-[#d35400] active:scale-95 text-white rounded-xl transition-all border border-white/5 cursor-pointer flex items-center justify-center gap-1.5 font-bold text-xs disabled:opacity-50"
                  title="Найти игрока"
                >
                  <Search className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">Найти</span>
                </button>
                <button
                  type="button"
                  onClick={handleRefreshPlayers}
                  disabled={isRefreshingPlayers}
                  className="px-3.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-gray-300 rounded-xl transition-all border border-white/5 cursor-pointer flex items-center justify-center disabled:opacity-50"
                  title="Обновить список игроков"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingPlayers ? "animate-spin text-amber-400" : ""}`} />
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                {isSearchingFirestore ? (
                  <div className="text-gray-500 text-center py-10 text-xs animate-pulse">
                    🔍 Поиск игроков в базе данных...
                  </div>
                ) : (customSearchResults !== null ? (
                  customSearchResults.length === 0 ? (
                    <div className="text-gray-500 text-center py-10 text-xs text-amber-400 font-bold border border-white/5 bg-slate-950/20 rounded-2xl p-6">
                      🔍 Игроки по запросу "{playerSearchQuery}" не найдены в базе.
                    </div>
                  ) : (
                    customSearchResults.map((p) => {
                      const isFriend = friendsList.includes(p.id);
                      return (
                        <div key={p.id} className="bg-[#162239] border border-white/5 rounded-2xl p-3 flex flex-col gap-3.5 shadow-sm">
                          <div className="flex justify-between items-center px-0.5">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <div className="w-9 h-9 rounded-full bg-slate-950 flex items-center justify-center border border-white/10 shrink-0 overflow-hidden">
                                {p.photoURL ? (
                                  <img referrerPolicy="no-referrer" src={p.photoURL} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-5 h-5 text-gray-500" />
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-extrabold text-xs text-white truncate flex items-center gap-1.5 shrink-0">
                                  {p.name}
                                  <span className={`w-2 h-2 rounded-full ${p.isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-gray-500"} shrink-0`} title={p.isOnline ? "Онлайн" : "Офлайн"}></span>
                                </span>
                                <span className="text-[10px] text-[#aab3c4] mt-0.5 font-mono truncate">
                                  💰 {Math.floor(p.coins).toLocaleString()} | 🏰 {p.clan || "Без клана"}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              {isFriend && (
                                <span className="text-[8px] bg-slate-850 text-amber-300 font-black px-2 py-0.5 rounded-md border border-amber-500/10 shrink-0 uppercase tracking-wider font-mono">⭐ ДРУГ</span>
                              )}
                              <button
                                onClick={() => {
                                  setActiveMainTab("social");
                                  setActiveSocialTab("friends");
                                  setActiveFriendChatId(p.id);
                                }}
                                className="w-8 h-8 rounded-full bg-emerald-600/20 hover:bg-emerald-600/40 flex items-center justify-center cursor-pointer transition-colors border border-emerald-500/30"
                                title="Написать сообщение"
                              >
                                <MessageCircle className="w-4 h-4 text-emerald-400" />
                              </button>
                              <button
                                onClick={() => setViewingProfile(p)}
                                className="w-8 h-8 rounded-full bg-[#f1c40f]/20 hover:bg-[#f1c40f]/40 flex items-center justify-center cursor-pointer transition-colors border border-[#f1c40f]/30"
                                title="Профиль игрока"
                              >
                                <Menu className="w-4 h-4 text-[#f1c40f]" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  onlinePlayers.length === 0 ? (
                    <div className="text-gray-500 text-center py-10 text-xs animate-pulse">
                      Загрузка игроков лобби...
                    </div>
                  ) : (
                    (() => {
                      const filtered = onlinePlayers.filter(p => {
                        if (p.id === effectivePlayerId) return false;
                        const matches = p.name.toLowerCase().includes(playerSearchQuery.toLowerCase());
                        if (playerSearchQuery.trim() === "") {
                          return p.isOnline; // Only online players if search query is empty
                        }
                        return matches; // All players matching query (online or offline) if searching
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-gray-500 text-center py-10 text-xs text-amber-400 font-bold border border-white/5 bg-slate-950/20 rounded-2xl p-6">
                            🔍 Игроки по запросу "{playerSearchQuery}" не найдены.
                          </div>
                        );
                      }

                      return filtered.map((p) => {
                        const isFriend = friendsList.includes(p.id);
                        return (
                          <div key={p.id} className="bg-[#162239] border border-white/5 rounded-2xl p-3 flex flex-col gap-3.5 shadow-sm">
                            <div className="flex justify-between items-center px-0.5">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <div className="w-9 h-9 rounded-full bg-slate-950 flex items-center justify-center border border-white/10 shrink-0 overflow-hidden">
                                  {p.photoURL ? (
                                    <img referrerPolicy="no-referrer" src={p.photoURL} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 text-gray-500" />
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-extrabold text-xs text-white truncate flex items-center gap-1.5 shrink-0">
                                    {p.name}
                                    <span className={`w-2 h-2 rounded-full ${p.isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-gray-500"} shrink-0`} title={p.isOnline ? "Онлайн" : "Офлайн"}></span>
                                  </span>
                                  <span className="text-[10px] text-[#aab3c4] mt-0.5 font-mono truncate">
                                    💰 {Math.floor(p.coins).toLocaleString()} | 🏰 {p.clan || "Без клана"}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 shrink-0">
                                {isFriend && (
                                  <span className="text-[8px] bg-slate-850 text-amber-300 font-black px-2 py-0.5 rounded-md border border-amber-500/10 shrink-0 uppercase tracking-wider font-mono">⭐ ДРУГ</span>
                                )}
                                <button
                                  onClick={() => {
                                    setActiveMainTab("social");
                                    setActiveSocialTab("friends");
                                    setActiveFriendChatId(p.id);
                                  }}
                                  className="w-8 h-8 rounded-full bg-emerald-600/20 hover:bg-emerald-600/40 flex items-center justify-center cursor-pointer transition-colors border border-emerald-500/30"
                                  title="Написать сообщение"
                                >
                                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                                </button>
                                <button
                                  onClick={() => setViewingProfile(p)}
                                  className="w-8 h-8 rounded-full bg-[#f1c40f]/20 hover:bg-[#f1c40f]/40 flex items-center justify-center cursor-pointer transition-colors border border-[#f1c40f]/30"
                                  title="Профиль игрока"
                                >
                                  <Menu className="w-4 h-4 text-[#f1c40f]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )
                ))}
              </div>
            </div>
          )}

          {activeSocialTab === "clans" && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="🔍 Поиск клана по названию..." 
                  value={clanSearchQuery}
                  onChange={(e) => setClanSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addToast(`🔍 Поиск клана "${clanSearchQuery || "..."}"`);
                    }
                  }}
                  className="flex-1 p-2.5 rounded-xl border border-slate-800 bg-slate-950 text-white text-xs outline-none focus:border-slate-500 font-sans"
                />
                <button
                  type="button"
                  onClick={() => {
                    addToast(`🔍 Поиск клана "${clanSearchQuery || "..."}"`);
                  }}
                  className="px-3.5 bg-[#e67e22] hover:bg-[#d35400] active:scale-95 text-white rounded-xl transition-all border border-white/5 cursor-pointer flex items-center justify-center gap-1.5 font-bold text-xs"
                  title="Найти клан"
                >
                  <Search className="w-4 h-4 text-white" />
                  <span className="hidden sm:inline">Найти</span>
                </button>
              </div>

              {/* Creation Area */}
              {!playerClan && (
                <div className="bg-[#162239]/60 border border-[#e67e22]/20 rounded-2xl p-4 flex flex-col gap-3">
                  <span className="text-xs font-black text-[#ffbc6e] uppercase tracking-wider block">🏰 Основать новый клан</span>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Название клана..." 
                      value={newClanName}
                      onChange={(e) => setNewClanName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-white outline-none focus:border-slate-600 font-sans"
                    />
                    <button 
                      onClick={handleCreateClan}
                      className="px-4 py-2 bg-[#e67e22] hover:bg-[#d35400] text-xs font-black rounded-xl text-white transition-colors cursor-pointer border-none"
                    >
                      Создать ⚔️
                    </button>
                  </div>

                  {/* Privacy checkboxes & settings */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
                    <label className="flex items-center gap-2 cursor-pointer mt-1">
                      <input 
                        type="checkbox" 
                        checked={isClanPrivate} 
                        onChange={(e) => setIsClanPrivate(e.target.checked)}
                        className="w-3.5 h-3.5 accent-[#e67e22] cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">🔒 Сделать клан приватным</span>
                    </label>
                    {isClanPrivate && (
                      <input 
                        type="text" 
                        placeholder="Установите пароль входа..." 
                        value={newClanPassword}
                        onChange={(e) => setNewClanPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 text-[11px] text-[#ffbc6e] tracking-wide outline-none focus:border-[#e67e22] mt-1 font-sans"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* My Clan block block */}
              {playerClan && (
                <div className="bg-[#111c2e] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)] rounded-2xl p-4 flex flex-col gap-3.5 select-none">
                  {/* Clan Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                       Мой Клан: {playerClan}
                    </span>
                    <button 
                      onClick={handleLeaveClan}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer border-none outline-none"
                    >
                      Покинуть ✕
                    </button>
                  </div>

                  {/* Tabs matching the diagram: "игроки" and "предметы" under the 'тип клан' format */}
                  <div className="flex gap-2 bg-black/45 p-1 rounded-xl border border-white/5 self-start">
                    <button
                      onClick={() => setMyClanActiveTab("players")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none outline-none flex items-center gap-1.5 ${
                        myClanActiveTab === "players"
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                          : "text-gray-400 hover:text-white bg-transparent"
                      }`}
                    >
                      👤 Игроки
                    </button>
                    <button
                      onClick={() => setMyClanActiveTab("vault")}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none outline-none flex items-center gap-1.5 ${
                        myClanActiveTab === "vault"
                          ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                          : "text-gray-400 hover:text-white bg-transparent"
                      }`}
                    >
                      📦 Предметы
                    </button>
                  </div>

                  {/* Tab Contents: Players List */}
                  {myClanActiveTab === "players" && (
                    <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 animate-fade-in">
                      {isLoadingMyClanMembers ? (
                        <div className="text-xs text-gray-500 text-center py-4 animate-pulse uppercase tracking-wider font-bold">
                          Загрузка состава клана...
                        </div>
                      ) : myFullClanMembers.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-4">
                          Здесь пока пусто.
                        </div>
                      ) : (
                        [...myFullClanMembers].sort((a, b) => (b.coins || b.clicks || 0) - (a.coins || a.clicks || 0)).map(m => (
                          <div key={m.id} className="flex justify-between items-center bg-black/25 rounded-xl p-3 hover:bg-black/40 border border-white/5 transition-colors">
                            <span className="text-xs font-bold font-sans text-gray-200 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              {m.playerName || m.displayName || m.name || "Игрок"}
                              {m.id === effectivePlayerId ? <span className="ml-1 px-1.5 py-0.5 text-[8px] bg-emerald-600/30 text-emerald-400 rounded-md uppercase font-extrabold">Вы</span> : null}
                            </span>
                            <span className="text-xs font-mono font-bold text-[#f1c40f]">{Math.floor(m.coins || 0).toLocaleString()} 💰</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Tab Contents: Vault items & personal inventory deposit */}
                  {myClanActiveTab === "vault" && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                      {/* --- ОБЩИЙ СЕЙФ КЛАНА --- */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                            👜 ОБЩИЙ СЕЙФ:
                          </span>
                          <span className="text-[10px] bg-amber-500/10 text-amber-300 font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/20">
                            {clanVaultItems.length} предметов
                          </span>
                        </div>

                        {/* Grid layout of vault items styled exactly like the sketch cards */}
                        {isLoadingClanVault ? (
                          <div className="text-[11px] text-gray-500 text-center py-8 animate-pulse uppercase tracking-wider font-bold">
                            Синхронизация с сейфом...
                          </div>
                        ) : clanVaultItems.length === 0 ? (
                          <div className="text-[11px] text-gray-500 text-center py-6 bg-slate-950/45 border border-slate-900 rounded-xl px-4 leading-relaxed font-sans">
                            🛡️ Сейф пуст. Положите сюда ценные вещи из инвентаря, чтобы ими могли пользоваться коллеги по клану!
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                            {clanVaultItems.map((item, idx) => (
                              <div 
                                key={item.id || idx} 
                                className="bg-slate-950/40 border border-white/5 hover:border-amber-500/20 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all relative overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/5 rounded-full blur-sm -mr-3 -mt-3"></div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-black text-amber-100 truncate line-clamp-1">{item.name || item.title || "Предмет"}</span>
                                  <span className="text-[9px] text-[#ffbc6e] font-mono tracking-wider mt-1 font-bold">
                                    {item.productionRate ? `+${item.productionRate} 💰/сек` : ""} {item.multiplier ? `x${item.multiplier} Буст` : ""}
                                  </span>
                                  {item.depositedBy && (
                                    <span className="text-[8px] text-gray-400 mt-1 font-sans truncate leading-none block">
                                      👤 {item.depositedBy}
                                    </span>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => handleWithdrawFromVault(item)}
                                  className="w-full py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 rounded-lg font-black text-[10px] transition-all cursor-pointer shadow-sm border-none outline-none text-center"
                                >
                                  Взять 📥
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Deposit panel */}
                      <div className="pt-2.5 border-t border-white/5 flex flex-col gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                          🎒 ПОЛОЖИТЬ В СЕЙФ:
                        </span>
                        
                        <div className="bg-slate-950/20 border border-white/5 rounded-xl p-2 max-h-[140px] overflow-y-auto">
                          {levelItems.length === 0 ? (
                            <div className="text-[10px] text-gray-500 text-center py-4 font-sans">
                              Ваш личный инвентарь пуст. Купите вещи в Магазине!
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-1.5">
                              {levelItems.map((item) => (
                                <div key={item.id} className="bg-black/35 rounded-lg p-2.5 flex justify-between items-center gap-3 border border-white/5 hover:border-indigo-500/15 transition-colors">
                                  <div className="flex flex-col truncate">
                                    <span className="text-xs font-bold text-gray-300 truncate">{item.name || item.title}</span>
                                    <span className="text-[9px] text-emerald-400 font-mono font-bold mt-0.5">
                                      {item.productionRate ? `+${item.productionRate} 💰/сек` : ""} {item.multiplier ? `x${item.multiplier} Буст` : ""}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDepositToVault(item)}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-lg text-[9px] font-bold transition-all cursor-pointer shadow outline-none border-none shrink-0"
                                  >
                                    Положить 📤
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Clans listed dynamically from clansPrivacy to fully support offline search */}
              <div className="flex flex-col gap-3">
                {clansPrivacy.length === 0 ? (
                  <div className="text-center text-gray-500 my-8 py-4 text-xs font-medium">
                    Пока никто не основал ни одного клана. Станьте первыми!
                  </div>
                ) : (() => {
                  const filteredClans = clansPrivacy.filter(
                    c => c.name.toLowerCase().includes(clanSearchQuery.toLowerCase()) && c.name !== playerClan
                  );
                  if (filteredClans.length === 0) {
                    return (
                      <div className="text-gray-500 text-center py-10 text-xs text-amber-400 font-bold border border-white/5 bg-slate-950/20 rounded-2xl p-6">
                        🔍 Кланы по запросу "{clanSearchQuery}" не найдены.
                      </div>
                    );
                  }
                  return filteredClans.map((clan) => {
                    const clanName = clan.name;
                    const isPrivCl = clan.isPrivate;
                    const members = onlinePlayers.filter(p => p.clan === clanName);
                    const hasMeJoined = playerClan === clanName;
                    return (
                      <div key={clanName} className="border border-slate-800 bg-slate-900 rounded-2xl p-4 flex flex-col gap-3 shadow-md border-t-2 border-[#e67e22]/40">
                        <div className="flex justify-between items-center">
                          <span className="text-[#ffd966] font-black text-sm flex items-center gap-1.5">
                            🏰 {clanName} {isPrivCl ? "🔒" : "🌐"}
                          </span>
                          {hasMeJoined && (
                            <span className="text-[9px] bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold shadow-inner">
                              Мой Клан
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-1.5 border-t border-white/5 pt-2 text-xs">
                          {members.length === 0 ? (
                            <span className="text-[#aab3c4]/65 text-[10px] italic py-1 font-sans">В сети нет участников</span>
                          ) : (
                            members.map((m) => (
                              <div key={m.id} className="flex justify-between items-center text-gray-300 py-1 font-mono text-[11px]">
                                <span className="font-sans font-bold flex items-center gap-1">👤 {m.name} {m.id === effectivePlayerId ? "(Вы)" : ""}</span>
                                <span className="text-[#ffbc6e] font-semibold">{Math.floor(m.coins).toLocaleString()} 💰</span>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="pt-2 border-t border-white/5">
                          {!hasMeJoined ? (
                            <button 
                              onClick={() => handleJoinClan(clanName)}
                              className="w-full py-2.5 bg-[#27ae60] hover:bg-[#219653] text-[11px] font-black tracking-wider text-white rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1 border-none"
                            >
                              ВСТУПИТЬ В КЛАН {isPrivCl ? "🔒" : "⚔️"}
                            </button>
                          ) : (
                            <button 
                              onClick={handleLeaveClan}
                              className="w-full py-2.5 bg-red-650/25 border border-red-500/25 hover:bg-red-650 text-[11px] font-black text-rose-303 rounded-xl cursor-pointer transition-colors border-none"
                            >
                              ПОКИНУТЬ КЛАН ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {activeSocialTab === "friends" && (
            <div className="h-full">
              {activeFriendChatId ? (
                <div className="flex flex-col h-[380px] justify-between">
                  {/* Private Chat Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-[#ffd966] flex items-center gap-1.5">
                        💬 ЛС: {onlinePlayers.find((p) => p.id === activeFriendChatId)?.name || (friendsList.includes(activeFriendChatId) ? "Ваш Друг" : "Игрок")}
                      </span>
                      <span className="text-[9px] text-gray-405 mt-0.5 animate-pulse">
                        {onlinePlayers.find((p) => p.id === activeFriendChatId)?.isOnline 
                          ? <span className="text-emerald-400">● В сети (Онлайн)</span>
                          : <span className="text-gray-500">○ Офлайн / Не в сети</span>}
                      </span>
                    </div>
                    <button 
                      onClick={() => setActiveFriendChatId(null)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-705 text-gray-300 rounded-lg text-[10px] font-bold cursor-pointer transition-colors border-none outline-none"
                    >
                      ← К списку
                    </button>
                  </div>

                  {/* Dynamic Action Buttons in active chat */}
                  <div className="flex gap-2 mb-3 bg-black/20 p-2 rounded-xl border border-white/5 justify-between items-center select-none">
                    {!friendsList.includes(activeFriendChatId) ? (
                      <button
                        onClick={() => handleAddFriend(activeFriendChatId, onlinePlayers.find(p => p.id === activeFriendChatId)?.name || "Игрок")}
                        className="py-1.5 px-3 bg-emerald-600/30 border border-emerald-500/30 text-green-300 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center gap-1 border-none outline-none"
                      >
                        ➕ В Друзья
                      </button>
                    ) : (
                      <span className="text-[9px] text-amber-300 font-extrabold flex items-center gap-1">⭐ У вас в друзьях</span>
                    )}

                    {playerClan && !onlinePlayers.find(p => p.id === activeFriendChatId)?.clan && (
                      <button
                        onClick={() => {
                          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                            socketRef.current.send(JSON.stringify({
                              type: "direct_msg",
                              data: {
                                playerId: effectivePlayerId,
                                recipientId: activeFriendChatId,
                                text: `🏰 Привет! Вступай в мой клан "${playerClan}"! Давай кликать вместе!`
                              }
                            }));
                            addToast(`🏰 Приглашение отправлено!`);
                          }
                        }}
                        className="py-1.5 px-3 bg-amber-600/35 border border-amber-500/30 text-amber-300 hover:bg-amber-600 hover:text-white rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center gap-1 border-none outline-none"
                      >
                        ⚔️ Пригласить в Клан
                      </button>
                    )}
                    
                    {!playerClan && onlinePlayers.find(p => p.id === activeFriendChatId)?.clan && (
                      <button
                        onClick={() => handleJoinClan(onlinePlayers.find(p => p.id === activeFriendChatId)!.clan!)}
                        className="py-1.5 px-3 bg-indigo-650/30 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-600 hover:text-white rounded-lg text-[10px] font-black cursor-pointer transition-all flex items-center gap-1 border-none outline-none"
                      >
                        🏰 Клан {onlinePlayers.find(p => p.id === activeFriendChatId)!.clan!}
                      </button>
                    )}
                  </div>

                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 text-xs pb-2">
                    {(directMessages[activeFriendChatId] || []).length === 0 ? (
                      <div className="text-center text-gray-500 my-auto py-10">
                        Личный чат пуст. Отправьте сообщение первыми! ✨
                      </div>
                    ) : (
                      (directMessages[activeFriendChatId] || []).map((m: any) => {
                        const isSelf = m.senderId === effectivePlayerId;
                        return (
                          <div 
                            key={m.id} 
                            className={`p-2 rounded-xl flex flex-col gap-1 max-w-[85%] ${
                              isSelf 
                                ? "bg-amber-600/20 border border-amber-500/25 self-end text-right" 
                                : "bg-[#162239] border border-white/5 self-start"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-[9px] font-bold">
                              <span style={{ color: m.color }} className="font-semibold block truncate">
                                {m.senderName}
                              </span>
                              <span className="text-gray-500 font-mono text-[8px] ml-auto">{m.timestamp}</span>
                            </div>
                            <p className="text-white font-medium select-text whitespace-pre-wrap break-all pr-1 text-left">{m.text}</p>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Message Input Form */}
                  <form onSubmit={sendDirectMessage} className="pt-2.5 border-t border-white/5 flex items-center gap-1.5 mt-2">
                    <input 
                      type="text" 
                      value={friendChatMessageText}
                      onChange={(e) => setFriendChatMessageText(e.target.value)}
                      maxLength={150}
                      placeholder="Напишите сообщение..."
                      className="flex-1 h-10 px-3 bg-slate-950 text-white rounded-xl text-xs border border-slate-800 outline-none focus:border-slate-600 font-sans"
                    />
                    <button 
                      type="submit" 
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-600 hover:bg-amber-500 shadow-md cursor-pointer transition-colors border-none shrink-0"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {friendsList.length === 0 ? (
                    <div className="text-center text-gray-500 py-12 text-xs font-medium">
                      Список друзей пуст. Добавьте игроков во вкладке "Игроки" 😔
                    </div>
                  ) : (
                    friendsList.map((fid) => {
                      const details = onlinePlayers.find((p) => p.id === fid);
                      return (
                        <div key={fid} className="bg-[#162239] border border-white/5 rounded-2xl p-3 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-xs text-amber-300 flex items-center gap-1 font-sans">
                              ⭐ {details ? details.name : "Офлайн-друг"}
                            </span>
                            {details ? (
                              <span className="text-[10px] text-emerald-400 mt-1 font-mono font-bold tracking-wider">
                                ● В СЕТИ | {Math.floor(details.coins).toLocaleString()} 💰
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                                ● НЕ В СЕТИ
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleViewFriendProfile(fid)}
                              className="w-8 h-8 rounded-full bg-[#f1c40f]/20 hover:bg-[#f1c40f]/40 flex items-center justify-center cursor-pointer transition-colors border border-[#f1c40f]/30"
                              title="Меню друга"
                            >
                              <Menu className="w-4 h-4 text-[#f1c40f]" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {activeSocialTab === "leaderboard" && (
            <Leaderboard currentUserId={effectivePlayerId} addToast={addToast} />
          )}
        </div>
      </div>
    );
  };

  const renderClanWarsContent = () => {
    // If player is not in a clan, show elegant lock screen with direct links
    if (!playerClan) {
      return (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center font-sans gap-5">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-3xl shadow-[0_4px_15px_rgba(245,158,11,0.2)]">
            ⚔️
          </div>
          <div className="flex flex-col gap-1.5 max-w-sm">
            <h3 className="text-lg font-black uppercase text-amber-400 tracking-wider">
              Битва Кланов заблокирована
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Вы не состоите в клане! Клановое сражение доступно только доблестным воинам союзов. Вступите в клан или создайте свой прямо сейчас.
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setActiveSocialTab("clans");
              setActiveMainTab("social");
            }}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg border-none cursor-pointer scale-100 transition-all active:scale-95 flex items-center gap-2"
          >
            🛡️ Найти или Создать Клан
          </motion.button>
        </div>
      );
    }

    // Interactive countdown and war states
    const isWarActive = !!clanWarState?.isWarActive;
    const isCountingDown = !!clanWarState?.triggeringClan && !clanWarState?.isWarActive;
    const isPeaceful = !isWarActive && !isCountingDown;

    // Format countdown or left time (with seconds support!)
    const formatTimeLeft = (sec: number) => {
      const days = Math.floor(sec / 86400);
      const hours = Math.floor((sec % 86400) / 3600);
      const minutes = Math.floor((sec % 3600) / 60);
      const seconds = sec % 60;
      
      const parts = [];
      if (days > 0) parts.push(`${days}д`);
      if (hours > 0) parts.push(`${hours}ч`);
      if (minutes > 0 || (days === 0 && hours === 0)) parts.push(`${minutes}м`);
      parts.push(`${seconds}с`);
      return parts.join(" ");
    };

    // Calculate real-time battle details directly from server state
    const warPoints = clanWarState?.clansWarPoints || {};
    const scoresLeft = warPoints[playerClan || ""] || 0;
    
    // Find highest competing rival
    const otherClans = Object.entries(warPoints).filter(([name]) => name !== playerClan);
    let opponentClan = "ТЁМНЫЕ ВОЛКИ";
    let scoresRight = 0;
    const isOpponentBot = otherClans.length === 0 || otherClans.some(([name]) => name === "ТЁМНЫЕ ВОЛКИ" || name === "КРАСНЫЕ ДРАКОНЫ");
    
    if (otherClans.length > 0) {
      otherClans.sort((a, b) => (b[1] as number) - (a[1] as number));
      opponentClan = otherClans[0][0];
      scoresRight = otherClans[0][1] as number;
    }

    // Percentage calculation for comparison/progress bar
    const totalScore = scoresLeft + scoresRight;
    const percentageLeft = totalScore > 0 ? (scoresLeft / totalScore) * 100 : 50;

    const handleAttack = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isWarActive) {
        addToast("🕊️ Сражение сейчас неактивно! Подождите запуска битвы.");
        return;
      }
      if (clanWarAttacksLeft <= 0) {
        addToast("⚠️ Вы израсходовали все атаки на этот раунд!");
        return;
      }
      
      setClanWarAttacksLeft(prev => prev - 1);
      
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "clan_war_click",
          data: {
            playerId: effectivePlayerId,
            pointsContribution: clickPowerLevel * 10
          }
        }));
      }

      // Create interactive click effect
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.random() * (rect.width - 60) + 30;
      const y = Math.random() * (rect.height - 40) + 10;
      const randomText = [
        `💥 УДАР! +${clickPowerLevel * 10} ОЧКОВ`,
        `⚔️ КРИТ! +${clickPowerLevel * 20} ОЧКОВ`,
        `🔥 ВКОПИЛКУ! +${clickPowerLevel * 10}`,
        `⚡ ПЕРЕГРУЗКА!`,
        `🏹 УДАР В СЕРДЦЕ`
      ][Math.floor(Math.random() * 5)];
      
      const newEffect = {
        id: Date.now() + Math.random(),
        x,
        y,
        text: randomText
      };
      setBattleDamageEffects(prev => [...prev, newEffect]);
      
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([15, 10, 15]);
      }
      
      setTimeout(() => {
        setBattleDamageEffects(prev => prev.filter(eff => eff.id !== newEffect.id));
      }, 1000);
    };

    // Filter EXACTLY only the real members of this clan from online/synced players
    const myClanPlayers = onlinePlayers.filter(p => p.clan === playerClan);
    const displayLeaderboard = [...myClanPlayers];
    
    // Sort clan participants by their click metrics to show who contributed the most!
    displayLeaderboard.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));

    return (
      <div className="flex flex-col h-full min-h-0 text-white gap-3 select-none font-sans overflow-y-auto pb-4 pr-0.5 animate-fade-in">
        
        {/* HEADER BRANDING */}
        <div className="flex justify-between items-center bg-[#111827]/40 px-3 py-1.5 rounded-xl border border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">⚔️</span>
            <span className="text-sm font-black uppercase tracking-wider text-[#d2dff0]">Битвы Кланов</span>
          </div>
          <button 
            type="button" 
            onClick={() => addToast("ℹ️ Участвуйте в Битве Кланов со своим кланом. Спровоцируйте битву повышая добычу или нажав кнопку, затем усердно жмите 'Атаковать'!")}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer text-gray-400 hover:text-white"
          >
            i
          </button>
        </div>

        {/* DYNAMIC BATTLE HEADERS AND TIMERS */}
        <div className="bg-gradient-to-r from-[#111827]/80 via-[#1e293b]/90 to-[#111827]/80 border border-white/5 rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 shadow-[0_4px_20px_rgba(0,0,0,0.3)] text-center relative overflow-hidden shrink-0">
          {isWarActive ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <span className="text-xs text-red-400 font-black uppercase tracking-wider animate-pulse">🔥 ИДЕТ СРАЖЕНИЕ КЛАНОВ!</span>
              </div>
              <span className="text-[10px] text-gray-400 font-extrabold uppercase font-mono tracking-widest block">ДО КОНЦА БИТВЫ:</span>
              <span className="text-2xl font-black text-amber-400 block font-mono tracking-wider animate-pulse font-bold">
                {formatTimeLeft(clanWarState?.countdownSeconds || 0)}
              </span>
            </>
          ) : isCountingDown ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                <span className="text-xs text-amber-400 font-black uppercase tracking-wider">🚨 ПОДГОТОВКА К БИТВЕ</span>
              </div>
              <span className="text-[10px] text-gray-400 font-extrabold uppercase font-mono tracking-widest block">ДО ЗАПУСКА:</span>
              <span className="text-2xl font-black text-amber-500 block font-mono tracking-wider animate-pulse font-bold">
                {formatTimeLeft(clanWarState?.countdownSeconds || 0)}
              </span>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-400 font-black uppercase tracking-wider">🕊️ МИРНЫЙ ПЕРИОД</span>
              </div>
              <p className="text-[10px] text-gray-400 max-w-sm mt-0.5 leading-relaxed font-semibold">
                Копите мощь автокликеров! Достигните порога производства вашего клана в <span className="text-amber-400 font-bold">{clanWarState?.triggerThreshold || 10} 💰/сек</span> или мгновенно спровоцируйте конфликт вручную кнопкой ниже!
              </p>
              
              {/* Production Progress Indicator */}
              {(() => {
                const clanProd = myClanPlayers.reduce((acc, p) => acc + Math.ceil((p.autoClickerLevel || 0) * 0.5), 0);
                const target = clanWarState?.triggerThreshold || 10;
                const pct = Math.min(100, (clanProd / target) * 100);
                return (
                  <div className="w-full mt-2 flex flex-col gap-1.5 items-center">
                    <div className="flex justify-between w-full text-[10px] text-[#9ca3af] font-mono font-bold px-1 select-none">
                      <span>Производство: <span className="text-amber-400 font-black">{clanProd} 💰/сек</span></span>
                      <span>Цель: {target} 💰/сек</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden relative border border-white/5">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    
                    {/* Instant Manual Trigger Button */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                          socketRef.current.send(JSON.stringify({
                            type: "clan_war_boost_simulation",
                            data: {
                              clanName: playerClan,
                              amount: 15
                            }
                          }));
                          addToast("🚀 Вы спровоцировали Битву Кланов! Приготовьтесь к бою через 30 секунд!");
                        }
                      }}
                      className="mt-2.5 px-4 py-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 shadow-lg cursor-pointer border-none flex items-center justify-center gap-1"
                    >
                      ⚔️ Спровоцировать Конфликт (Битву вручную)
                    </motion.button>
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* VS HEAD-TO-HEAD LAYOUT */}
        <div className="grid grid-cols-11 items-center gap-1 bg-[#1e293b]/40 border border-white/5 rounded-3xl p-3.5 relative overflow-hidden shrink-0">
          <div className="absolute top-0 bottom-0 left-[50%] -translate-x-[50%] w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none" />
          
          {/* Left / Active Ally Clan */}
          <div className="col-span-5 flex flex-col items-center text-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg shadow-md">
              🦅
            </div>
            <div className="text-xs font-black truncate max-w-full text-blue-300 uppercase mt-1">
              {playerClan || "ЛЕГЕНДЫ"}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-amber-400 font-bold">
              🏆 {scoresLeft.toLocaleString()}
            </div>
            <div className="text-[9px] text-gray-400 font-mono mt-0.5 font-bold">
              Ряды бойцов: {displayLeaderboard.length} человек
            </div>
            
            <div className="mt-2 bg-blue-500/10 border border-blue-500/15 py-1 px-2 rounded-xl flex items-center gap-1">
              <span className="text-[9.5px] font-black tracking-wider text-blue-200">ВАШ ВКЛАД:</span>
              <span className="text-[10px] font-mono text-blue-400 font-black">💎 {Number(totalClicks).toLocaleString()}</span>
            </div>
          </div>

          {/* Versus Center Circle */}
          <div className="col-span-1 flex justify-center items-center">
            <span className="text-xl font-black italic select-none text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500 animate-pulse tracking-tighter">VS</span>
          </div>

          {/* Right / Opponent Clan */}
          <div className="col-span-5 flex flex-col items-center text-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-lg shadow-md">
              🐺
            </div>
            <div className="text-xs font-black truncate max-w-full text-orange-300 uppercase mt-1 flex flex-col items-center gap-0.5">
              <span>{opponentClan}</span>
              {isOpponentBot && (
                <span className="text-[8px] bg-orange-500/15 text-orange-400 font-extrabold px-1.5 py-0.5 rounded-md border border-orange-500/20 uppercase tracking-wider font-mono scale-[0.85] mt-0.5">
                  🤖 Бот-соперник
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-amber-400 font-bold">
              🏆 {scoresRight.toLocaleString()}
            </div>
            <div className="text-[9px] text-gray-400 font-mono mt-0.5 font-bold">
              Ряды бойцов: {isOpponentBot ? "8" : "15"} человек
            </div>

            <div className="mt-2 bg-orange-500/10 border border-orange-500/15 py-1 px-2 rounded-xl flex items-center gap-1">
              <span className="text-[9.5px] font-black tracking-wider text-orange-200 font-sans">ОЧКИ ВРАГА:</span>
              <span className="text-[10px] font-mono text-orange-400 font-black font-bold">💎 {scoresRight.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* PROGRESS WEIGHT BAR */}
        <div className="bg-black/30 border border-white/5 rounded-2xl p-2.5 flex flex-col gap-1.5 shrink-0">
          <div className="w-full bg-[#1b2535] rounded-full h-3 overflow-hidden relative border border-white/5 flex">
            {/* Split Progress indicators */}
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-sky-500 transition-all duration-500 rounded-l-full" 
              style={{ width: `${percentageLeft}%` }}
            />
            {/* Middle badge */}
            <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] z-10 w-5 h-5 rounded-full bg-amber-500 border border-amber-400 flex items-center justify-center text-[10px] text-black font-black shadow-md">
              🛡️
            </div>
            <div 
              className="h-full bg-gradient-to-r from-rose-600 to-red-500 transition-all duration-500 rounded-r-full flex-1"
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 px-1 font-bold">
            <span className="text-blue-400">{scoresLeft.toLocaleString()}</span>
            <span>Баланс Сил</span>
            <span className="text-red-400">{scoresRight.toLocaleString()}</span>
          </div>
        </div>

        {/* ACTIONS & OUTCOMES ROW */}
        <div className="grid grid-cols-2 gap-3 shrink-0">
          {/* LOOT BAG PANEL */}
          <div className="bg-[#111827]/60 border border-white/5 rounded-2xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] text-gray-400 font-extrabold uppercase font-mono tracking-wider">Награда союзу за победу</span>
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              <div className="bg-black/40 border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center text-center gap-0.5">
                <span className="text-xs">🏆</span>
                <span className="text-[9px] font-bold text-sky-400 font-mono">1</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center text-center gap-0.5">
                <span className="text-xs">💰</span>
                <span className="text-[9px] font-bold text-emerald-400 font-mono font-bold">+2.5M</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-lg p-1.5 flex flex-col items-center justify-center text-center gap-0.5">
                <span className="text-xs">🎁</span>
                <span className="text-[9px] font-bold text-purple-400 font-mono font-bold">Сундук</span>
              </div>
              <div className="bg-black/40 border border-white/5 rounded-lg p-1 flex flex-col items-center justify-center text-center gap-0.5 leading-none">
                <span className="text-xs">🎖️</span>
                <span className="text-[8px] font-sans text-amber-500 font-extrabold">Слава</span>
              </div>
            </div>
          </div>

          {/* ACTIVE ATTACKS CARD */}
          <div className="bg-gradient-to-b from-[#1c1824] to-[#0f0d14] border border-white/5 rounded-2xl p-2.5 flex flex-col justify-between relative overflow-hidden">
            <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 font-bold">
              <span>ВАШИ АТАКИ:</span>
              <span className="text-amber-400 font-black">{clanWarAttacksLeft} / 2</span>
            </div>
            <div className="text-[8px] text-gray-400 font-mono mt-0.5">
              Атаки обновляются ежедневно
            </div>

            {/* Giant attack trigger */}
            <div className="relative mt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleAttack}
                disabled={!isWarActive || clanWarAttacksLeft <= 0}
                className={`w-full py-2 rounded-xl text-center flex flex-col items-center justify-center font-black border-none cursor-pointer transition-all ${
                  isWarActive && clanWarAttacksLeft > 0 
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/25 font-bold hover:brightness-115 active:scale-95" 
                    : "bg-slate-800 text-gray-500 cursor-not-allowed opacity-50"
                }`}
              >
                <div className="flex items-center gap-1 text-[11px] font-black tracking-wider text-black">
                  {isWarActive ? "⚔️ АТАКОВАТЬ!" : isCountingDown ? "⏰ ОЖИДАНИЕ БОЯ" : "🕊️ МИРНЫЙ ПЕРИОД"}
                </div>
              </motion.button>

              {/* FLOATING TEXT POPUPS */}
              {battleDamageEffects.map((eff) => (
                <span 
                  key={eff.id} 
                  className="absolute animate-bounce-out pointer-events-none text-[11px] font-black text-rose-400 font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  style={{ left: eff.x, top: eff.y }}
                >
                  {eff.text}
                </span>
              ))}
            </div>

            <button 
              type="button"
              onClick={() => addToast(isWarActive ? "📺 Идет трансляция сражения! Кликайте изо всех сил!" : "📺 Поле битвы тихо... Войны нет.")}
              className="mt-1.5 w-full py-1 bg-[#1b2535] hover:bg-[#253248] text-gray-400 hover:text-white transition-all text-[9px] font-bold rounded-lg border border-white/5 cursor-pointer"
            >
              👁️ СМОТРЕТЬ БИТВУ
            </button>
          </div>
        </div>

        {/* BOTTOM TEAM HIGHLIGHTS */}
        <div className="bg-[#111827]/40 border border-white/5 rounded-2xl p-2.5 flex flex-col gap-1.5 min-h-0 flex-1">
          <div className="flex justify-between items-center text-[10px] font-extrabold uppercase font-mono tracking-wider">
            <span className="text-indigo-300">Состав участников вашего клана</span>
            <button 
              type="button" 
              onClick={() => addToast(`⭐ Всего в клане: ${displayLeaderboard.length} игроков!`)}
              className="text-[#3498db] text-[9.5px] font-black border-none bg-none flex hover:underline cursor-pointer"
            >
              СМОТРЕТЬ ВСЕХ &gt;
            </button>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto max-h-[140px] pr-1">
            {displayLeaderboard.length === 0 ? (
              <p className="text-center text-[11px] text-gray-500 py-3">Пока участников нет...</p>
            ) : (
              displayLeaderboard.map((player: any, index) => {
                const rank = index + 1;
                return (
                  <div 
                    key={player.id || rank} 
                    className={`flex justify-between items-center p-1.5 rounded-xl bg-black/25 border ${
                      player.id === effectivePlayerId ? "border-amber-400/40 bg-amber-400/5" : "border-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-black text-gray-500 w-3">
                        {rank}
                      </span>
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                        style={{ backgroundColor: `${player.color || "#e67e22"}22`, border: `1px solid ${player.color || "#e67e22"}` }}
                      >
                        {(player.name || "Игрок").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[11px] font-bold truncate max-w-[120px]" style={{ color: player.color }}>
                        {player.name || "Игрок"} {rank === 1 && "👑"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      Кликов: 💎 {Number(player.clicks || 0).toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsContent = () => {
    return (
      <div className="flex flex-col h-full min-h-0 text-white gap-4 font-sans select-none">
        
        {/* Google & Telegram Authentication Section */}
        <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
          <span className="text-[10px] text-[#aab3c4] font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
            ☁️ Облачное сохранение
          </span>
          
          {isAuthLoading ? (
            <div className="text-center text-xs text-gray-400 py-1 font-mono">Загрузка авторизации...</div>
          ) : currentUser ? (
            // --- AUTHENTICATED STATE ---
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="Avatar" 
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border border-amber-400/30 shadow-inner animate-fade-in" 
                  />
                ) : (
                  <div className={`w-9 h-9 rounded-full ${currentUser.email?.startsWith("tg_") ? "bg-[#3498db]/30 text-[#3498db]" : "bg-indigo-600/30 text-indigo-300"} flex items-center justify-center text-xs font-black animate-fade-in`}>
                    {currentUser.email?.startsWith("tg_") ? "TG" : (currentUser.displayName?.charAt(0) || "G")}
                  </div>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-black text-amber-300 truncate leading-tight">
                    {currentUser.displayName || (currentUser.email?.startsWith("tg_") ? "Чат-Игрок" : "Google Игрок")}
                  </span>
                </div>
              </div>
              
              {/* Notifications Toggle Switch */}
              <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded-xl border border-white/5 animate-fade-in">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#aab3c4]">Уведомления</span>
                    <span className={`text-[9px] font-mono font-black mt-0.5 ${notificationsEnabled ? "text-emerald-400" : "text-rose-400"}`}>
                      {notificationsEnabled ? "● ВКЛЮЧЕНЫ" : "○ ОТКЛЮЧЕНЫ"}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={notificationsEnabled}
                      onChange={(e) => handleToggleNotifications(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4.5 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:after:translate-x-3.5"></div>
                  </label>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-0.5">

                <button 
                  onClick={currentUser.email?.startsWith("tg_") ? handleTelegramSignOut : (currentUser.email?.startsWith("vk_") ? handleVKSignOut : handleGoogleSignOut)}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-755 transition-colors text-[10px] font-black rounded-lg cursor-pointer text-rose-300 border-none outline-none flex items-center justify-center h-full"
                >
                  Выйти
                </button>
              </div>

              {/* Telegram bot auth block */}
              {currentUser && !linkedTelegramId && (
                <div className="flex flex-col gap-2 bg-[#2c3e50]/20 p-3 rounded-xl border border-white/5 mt-2 animate-fade-in">
                  <span className="text-[9px] text-[#2cb2e0] font-black uppercase tracking-wider font-mono flex items-center gap-1 justify-center">
                    🤖 ВХОД ЧЕРЕЗ TELEGRAM БОТ
                  </span>
                  
                  <p className="text-[10px] text-gray-400 text-center leading-normal font-semibold">
                    Отправьте код ниже нашему Telegram-боту, и игра сразу выполнит автоматический вход под вашим аккаунтом!
                  </p>

                  <div className="flex flex-col items-center justify-center gap-2 bg-slate-950/60 py-3 px-4 rounded-xl border border-white/5">
                    {gameAuthCode ? (
                      <>
                        <span 
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(gameAuthCode);
                              addToast("📋 Код скопирован в буфер обмена!");
                            } catch(e) {}
                          }}
                          className="text-2xl font-black font-mono tracking-widest text-[#2cb2e0] hover:scale-105 active:scale-95 cursor-pointer bg-slate-950 px-5 py-2 rounded-lg border border-sky-950/50 block select-all"
                          title="Нажмите чтобы скопировать"
                        >
                          {gameAuthCode}
                        </span>
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[9px] text-emerald-400 font-bold font-mono tracking-wider animate-pulse uppercase flex items-center gap-1 mt-0.5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                            Ждем подтверждения...
                          </span>
                          <button
                            onClick={requestNewGameAuthCode}
                            className="text-[9px] text-gray-500 hover:text-white font-bold font-mono tracking-wider uppercase flex items-center gap-1"
                          >
                            🔄 Обновить
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-[10px] text-gray-500 font-mono animate-spin font-black">⚙️</span>
                        <span className="text-[10px] text-gray-500 font-mono uppercase font-black">Генерация кода...</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={`https://t.me/${botUsername || "MyTelegramGameBot"}?start=${gameAuthCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 bg-[#2cb2e0] hover:bg-[#39c4f3] text-wrap text-center transition-all text-[10px] font-black rounded-lg cursor-pointer text-white flex items-center justify-center gap-1 shadow-sm uppercase outline-none decoration-none text-center"
                  >
                    Открыть Чат с Ботом 💬
                  </a>
                </div>
              )}

              <hr className="border-white/5 my-3" />

              {/* Change Profile Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400 font-extrabold uppercase tracking-wide">Ваш логин/никнейм</label>
                <input 
                  type="text" 
                  value={editingName} 
                  onChange={(e) => setEditingName(e.target.value)}
                  className="p-3 bg-slate-950 border border-slate-800 text-xs rounded-xl outline-none focus:border-slate-500 text-white font-sans"
                />
                <button 
                  onClick={applySettingsName}
                  className="py-3 bg-indigo-600 hover:bg-indigo-500 transition-colors text-xs font-black rounded-xl cursor-pointer shadow-md text-white mt-1 border-none outline-none"
                >
                  Сохранить Имя 💾
                </button>
              </div>

              <hr className="border-white/5 mt-3" />

              {/* Change Avatar/Icon Selection Panel */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-extrabold uppercase tracking-wide">Ваш Аватар / Иконка</label>
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/50 bg-[#070b13] flex items-center justify-center">
                    <img src={playerPhotoURL} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/pixel-art/svg?seed=Lucky" }} />
                  </div>
                </div>
                
                <div className="flex gap-2 bg-black/25 p-2 rounded-xl border border-white/5 overflow-x-auto scrollbar-none scroll-smooth snap-x">
                  {AVATAR_PRESETS.map((av) => (
                    <button
                      key={av.name}
                      type="button"
                      onClick={() => {
                        setPlayerPhotoURL(av.url);
                        addToast(`🎨 Выбран аватар: ${av.name}`);
                      }}
                      className={`w-12 h-12 shrink-0 snap-center rounded-lg overflow-hidden border-2 transition-all p-0.5 outline-none ${
                        playerPhotoURL === av.url ? "border-amber-400 bg-amber-950/40 scale-95" : "border-transparent bg-slate-950/60 hover:bg-slate-900"
                      }`}
                      title={av.name}
                    >
                      <img src={av.url} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5 mt-0.5">
                  <span className="text-[9px] text-[#ffbc6e] font-bold font-mono uppercase tracking-wider">Загрузить свое фото / картинку 📸</span>
                  <div className="flex gap-1.5">
                    <input
                      type="file"
                      id="avatar-file-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="avatar-file-upload"
                      className="flex-1 px-3 py-2 bg-slate-950 hover:bg-slate-900 border border-dashed border-amber-500/40 hover:border-amber-500/80 text-[11px] font-black text-amber-300 rounded-lg cursor-pointer transition-all uppercase tracking-wider text-center"
                    >
                      Прикрепить фото / Выбрать файл 📎
                    </label>
                  </div>
                </div>
              </div>

              <hr className="border-white/5 mt-3" />

              {/* --- CHAT & GAME SOUND SETTINGS --- */}
              <div className="flex flex-col gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                <span className="text-[10px] text-[#ffbc6e] font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  🎵 Настройки звуков и эффектов
                </span>

                {/* Main sound toggle */}
                <div className="flex items-center justify-between py-1 text-sm font-semibold">
                  <span className="text-gray-300 text-xs">Общие звуковые эффекты:</span>
                  <button 
                    type="button"
                    onClick={() => {
                      setSoundEnabled(prev => !prev);
                      addToast(!soundEnabled ? "🔊 Звуки включены!" : "🔇 Звуки отключены");
                    }}
                    className={`p-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer font-bold border transition-all ${
                      soundEnabled 
                        ? "bg-slate-800 border-emerald-500/20 text-emerald-400" 
                        : "bg-slate-900 border-red-500/20 text-red-400"
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span className="text-xs">{soundEnabled ? "Вкл" : "Выкл"}</span>
                  </button>
                </div>

                <div className="border-t border-white/5 pt-2 flex flex-col gap-2">
                  {/* Sent Message Sound Selector */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400">Звук отправки сообщения:</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        { id: "iphone-sent-message", name: "iPhone Sent Sound 📤" },
                        { id: "iphone-message-swoosh", name: "iPhone Swoosh 💨" },
                        { id: "triangle-synth", name: "Синтезатор (Ретро) 👾" }
                      ].map((snd) => (
                        <div 
                          key={snd.id} 
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                            sentSoundKey === snd.id 
                              ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-extrabold" 
                              : "bg-slate-950/45 border-slate-800/40 text-gray-400 hover:text-white"
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1 py-0.5">
                            <input 
                              type="radio" 
                              name="sentSoundGroup"
                              checked={sentSoundKey === snd.id}
                              onChange={() => {
                                setSentSoundKey(snd.id);
                                playSentSound(snd.id, true);
                              }}
                              className="accent-amber-500 cursor-pointer"
                            />
                            <span>{snd.name}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => playSentSound(snd.id, true)}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer transition-colors border-none"
                            title="Прослушать"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Received Message Sound Selector */}
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] font-bold text-gray-400">Звук получения / уведомления:</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {[
                        { id: "iphone-sound-message", name: "iPhone Message Sound 🔔" },
                        { id: "sine-synth", name: "Синтезатор (Классический) 🎹" },
                        { id: "cyber-beep", name: "Кибер-сигнал ⚡" }
                      ].map((snd) => (
                        <div 
                          key={snd.id} 
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                            receivedSoundKey === snd.id 
                              ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-extrabold" 
                              : "bg-slate-950/45 border-slate-800/40 text-gray-400 hover:text-white"
                          }`}
                        >
                          <label className="flex items-center gap-2 cursor-pointer flex-1 py-0.5">
                            <input 
                              type="radio" 
                              name="receivedSoundGroup"
                              checked={receivedSoundKey === snd.id}
                              onChange={() => {
                                setReceivedSoundKey(snd.id);
                                playNotificationSound(snd.id, true);
                              }}
                              className="accent-amber-500 cursor-pointer"
                            />
                            <span>{snd.name}</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => playNotificationSound(snd.id, true)}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer transition-colors border-none"
                            title="Прослушать"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-white/5 mt-1" />

              {/* Toggle telegram notifications */}
              <div className="flex items-center justify-between py-1 text-sm font-semibold">
                <span className="text-gray-300 text-xs">Уведомления в Telegram:</span>
                <button 
                  type="button"
                  onClick={() => {
                    setTelegramNotificationsEnabled(prev => !prev);
                    addToast(!telegramNotificationsEnabled ? "🔔 Уведомления в Telegram включены!" : "🔕 Уведомления в Telegram отключены.");
                  }}
                  className={`p-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer font-bold border ${
                    telegramNotificationsEnabled 
                      ? "bg-slate-800 border-emerald-500/20 text-emerald-400" 
                      : "bg-slate-900 border-red-500/20 text-red-400"
                  }`}
                >
                  {telegramNotificationsEnabled ? <MessageSquare className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  <span className="text-xs">{telegramNotificationsEnabled ? "Вкл" : "Выкл"}</span>
                </button>
              </div>

              <hr className="border-white/5 mt-1" />

              {/* Toggle liquid glass design mode */}
              <div className="flex items-center justify-between py-1 text-sm font-semibold">
                <div className="flex flex-col">
                  <span className="text-gray-300 text-xs">📱 Жидкое стекло:</span>
                  <span className="text-[10px] text-[#ffbc6e] font-normal">Glassmorphism / Frost эффект</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsLiquidGlass(prev => !prev)}
                  className={`p-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-bold border transition-colors ${
                    isLiquidGlass 
                      ? "bg-amber-600/25 border-amber-400/40 text-amber-300 shadow-[0_0_12px_rgba(243,156,18,0.2)]" 
                      : "bg-slate-900 border-slate-700/30 text-gray-400"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-xs">{isLiquidGlass ? "Активно ✨" : "Выключено"}</span>
                </button>
              </div>

              <hr className="border-white/5 mt-1" />

              {/* Reset game database */}
              <div className="flex flex-col gap-2 mt-2">
                <button 
                  onClick={handleResetProgress}
                  className="py-3 bg-rose-600/20 border border-rose-500/20 hover:bg-rose-600 text-rose-300 text-xs font-black rounded-xl transition-colors cursor-pointer border-none outline-none"
                >
                  СБРОСИТЬ ВЕСЬ ПРОГРЕСС ИГРЫ 🗑️
                </button>
              </div>

              <hr className="border-white/5 my-3" />

              {/* Notification History */}
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-400 font-extrabold uppercase tracking-wide">Последние уведомления</label>
                <div className="flex flex-col gap-1 bg-black/20 p-2 rounded-xl border border-white/5">
                  {toastHistory.length > 0 ? toastHistory.map((toast, index) => (
                    <div key={index} className="text-[10px] text-gray-400 font-mono border-b border-white/5 pb-1 last:border-0 last:pb-0">
                      {index + 1}. {toast}
                    </div>
                  )) : <div className="text-[10px] text-gray-600 italic">Нет уведомлений</div>}
                </div>
              </div>

            </div>
          ) : (
            // --- UNAUTHENTICATED STATE IN SETTINGS ---
            <div className="flex flex-col gap-3">
              <p className="text-[10px] text-gray-400 leading-normal font-semibold">
                Войдите через Google или Telegram, чтобы привязать прогресс и сохранить ваши монеты!
              </p>
              <div className="flex gap-2 justify-center items-center mt-1 w-full">
                <button 
                  onClick={handleTelegramAuth} 
                  className="flex-1 py-3 bg-[#2481cc] hover:bg-[#1a6ea8] active:scale-95 text-white rounded-xl flex items-center justify-center transition-all shadow-md gap-2 border-none outline-none cursor-pointer text-xs font-bold"
                  title="Войти через Telegram"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.05-.21.05-.39-.14-.39-.14 0-.3.08-.47.19a322.9 322.9 0 0 1-5.18 3.51c-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                  TG
                </button>
                <button 
                  onClick={handleVKAuth} 
                  className="flex-1 py-3 bg-[#0077ff] hover:bg-[#0066ee] active:scale-95 text-white rounded-xl flex items-center justify-center transition-all shadow-md gap-2 border-none outline-none cursor-pointer text-xs font-bold"
                  title="Войти через VK"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="currentColor">
                    <path d="M6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z"/>
                  </svg>
                  VK
                </button>
                <button 
                  onClick={handleGoogleSignIn} 
                  className="flex-1 py-3 bg-white hover:bg-gray-100 active:scale-95 text-[#1a1f2c] rounded-xl flex items-center justify-center transition-all shadow-md gap-2 border-none outline-none cursor-pointer text-xs font-bold"
                  title="Войти через Google"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.57 2.77c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18c-.75 1.49-1.18 3.16-1.18 4.94s.43 3.45 1.18 4.94l3.66-2.85z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Google
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Switch Player by ID Section */}
        <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 animate-fade-in shadow-inner">
          <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
            🔑 Смена профиля по ID
          </span>
          <p className="text-[10px] text-gray-400 leading-normal font-semibold">
            Вы можете переключиться на другого игрока или восстановить доступ, введя специальный Player ID:
          </p>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Ваш текущий ID:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-white/5 select-all">{effectivePlayerId}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(effectivePlayerId);
                      addToast("📋 ID скопирован в буфер обмена!");
                    } catch (e) {}
                  }}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded cursor-pointer text-gray-300 border-none transition-colors"
                >
                  Копировать
                </button>
              </div>
            </div>
            
            <div className="flex gap-2 mt-1">
              <input 
                type="text"
                placeholder="Введите Player ID"
                value={swapPlayerId}
                onChange={(e) => setSwapPlayerId(e.target.value.toUpperCase().trim())}
                className="flex-1 p-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500/50 text-xs rounded-xl outline-none text-white font-mono"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!swapPlayerId.trim()) {
                    addToast("⚠️ Введите ID игрока!");
                    return;
                  }
                  if (swapPlayerId === effectivePlayerId) {
                    addToast("⚠️ Вы уже вошли под этим ID!");
                    return;
                  }
                  sessionStorage.setItem("skipVKAutoLogin", "true");
                  localStorage.setItem("myPlayerIdV9", swapPlayerId);
                  if (auth?.currentUser) {
                    try {
                      await signOut(auth);
                    } catch (e) {
                      console.error("Signout error during player swap:", e);
                    }
                  }
                  addToast("🔄 Переключение игрока... Страница перезагружается!");
                  setTimeout(() => {
                    window.location.reload();
                  }, 1200);
                }}
                className="px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center transition-all active:scale-95 border-none outline-none cursor-pointer"
              >
                Сменить 🔄
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Launcher Section */}
        <div className="flex flex-col gap-3 bg-black/25 p-4 rounded-2xl border border-white/5 animate-fade-in shadow-inner">
          <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
            🖥️ Игра на вашем компьютере
          </span>
          <p className="text-[10px] text-gray-400 leading-normal font-semibold">
            Хотите играть прямо с Рабочего Стола ПК с автоматическим ярлыком и быстрой загрузкой без лагов браузера?
          </p>
          <button 
            type="button"
            onClick={() => {
              setLauncherModalStep("intro");
              setIsLauncherModalOpen(true);
            }}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 hover:shadow-[0_0_15px_rgba(242,156,18,0.25)] text-[#0e1726] font-black rounded-xl text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] outline-none border-none cursor-pointer"
          >
            🖥️ ХОТИТЕ СКАЧАТЬ ИГРУ НА ПК?
          </button>
        </div>

        {/* VK Cloud Storage Integration Panel */}
        {currentUser?.email?.startsWith("vk_") && (
          <div className="flex flex-col gap-3 bg-[#0077ff]/10 p-4 rounded-2xl border border-[#0077ff]/20 animate-fade-in shadow-inner">
            <span className="text-[10px] text-sky-400 font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
              🌐 VK ОБЛАКО СИНХРОНИЗАЦИЯ
            </span>
            <p className="text-[10px] text-sky-250 leading-normal font-semibold">
              Ваш игровой прогресс автоматически дублируется во встроенное облачное хранилище VK Cloud Storage для 100% защиты ваших данных.
            </p>
            <button 
              type="button"
              onClick={async () => {
                try {
                  await syncWithVKCloud();
                  addToast("☁️ Резервная копия успешно создана в Облаке VK!");
                } catch(e) {
                  addToast("❌ Ошибка синхронизации с VK Облаком");
                }
              }}
              className="w-full py-3 bg-[#0077ff] hover:bg-[#0066ee] text-white font-black rounded-xl text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] outline-none border-none cursor-pointer"
            >
              🔄 Синхронизировать с Облаком VK
            </button>
          </div>
        )}

        {/* Dynamic Admin Panel Trigger Entry */}
        <div className="flex justify-center mt-2">
          <button 
            type="button"
            onClick={() => setIsAdminLoginModalOpen(true)}
            className="text-[9px] text-gray-700 hover:text-amber-500 transition-colors uppercase tracking-[0.3em] font-black cursor-pointer border-none bg-transparent"
          >
            ⚙️ Войти в Панель Админа
          </button>
        </div>

      </div>
    );
  };

  // Cost projections
  const clickUpgradePrice = Math.floor(50 * Math.pow(1.5, clickPowerLevel));
  const autoClickerPrice = Math.floor(100 * Math.pow(1.6, autoClickerLevel));
  const energyUpgradePrice = Math.floor(80 * Math.pow(1.5, energyLevel));

  if (isAuthLoading) {
    return (
      <div 
        className="min-h-[100dvh] w-screen flex flex-col items-center justify-center text-white p-6 font-sans relative overflow-hidden"
        style={{
          background: "radial-gradient(circle at center, #111a30 0%, #060914 100%)",
        }}
      >
        {/* Glow ambient effects */}
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2.5s' }}></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 relative z-10 max-w-sm text-center"
        >
          {/* Animated Loader Graphic */}
          <div className="relative w-24 h-24 flex items-center justify-center mb-2">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 animate-spin opacity-20 blur-sm [animation-duration:3s]"></div>
            <div className="absolute inset-1.5 rounded-2xl border-2 border-dashed border-amber-500/40 animate-spin [animation-duration:12s]"></div>
            <div className="text-3xl">⚔️</div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-black uppercase text-amber-500 tracking-tight">Клик Клан</h1>
            <p className="text-[10px] text-amber-400 font-mono tracking-[0.25em] uppercase font-bold animate-pulse">
              {vkInitStatus === "initializing" ? "Авторизация через VK..." : "Проверка авторизации..."}
            </p>
          </div>

          <div className="w-40 h-1 bg-white/5 rounded-full overflow-hidden mt-2 border border-white/[0.02] relative">
            <motion.div 
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
              initial={{ width: "10%" }}
              animate={{ width: "90%" }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5, ease: "easeInOut" }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <>
        <div className="min-h-[100dvh] w-screen flex items-center justify-center bg-[#060914] text-white p-4 font-sans relative overflow-hidden">
          {/* Ambient Background */}
          <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-8 items-center p-8 bg-[#0a0f1e] rounded-[32px] border border-white/5 shadow-2xl max-w-sm w-full relative z-10"
          >
            <div className="flex flex-col items-center gap-3 w-full relative">
              <h2 className="text-3xl font-black text-amber-500 tracking-tight">Клик Клан</h2>
              <p className="text-[13px] text-gray-400 font-medium text-center px-4 leading-tight">Войдите в аккаунт, чтобы продолжить игру!</p>
            </div>

            <div className="flex flex-col gap-4 w-full">
              <div className="relative">
                <input 
                  type="text" 
                  value={telegramCode}
                  onChange={(e) => setTelegramCode(e.target.value.toUpperCase())}
                  placeholder="Введите код из бота..."
                  className="w-full py-4 px-6 bg-black/40 text-white rounded-2xl text-sm font-bold border border-white/10 outline-none focus:border-amber-500/50 transition-all placeholder:text-gray-600"
                />
              </div>
              
              <button 
                onClick={handleTelegramCodeLogin} 
                disabled={isTelegramLoggingIn}
                className="w-full py-4 bg-[#2ecc71] hover:bg-[#27ae60] active:scale-[0.98] text-white rounded-2xl text-sm font-black transition-all shadow-lg disabled:opacity-50 cursor-pointer border-none"
              >
                {isTelegramLoggingIn ? "Вход..." : "Подтвердить код"}
              </button>

              <div className="grid grid-cols-1 gap-3 w-full">
                <button 
                  type="button"
                  onClick={() => setIsAccountSelectorOpen(true)}
                  className="w-full py-4 bg-[#1e293b] hover:bg-[#334155] text-white rounded-2xl text-xs font-black transition-all border border-white/5 active:scale-98 flex items-center justify-center gap-3 cursor-pointer shadow-md outline-none"
                >
                  <Users className="w-4 h-4 text-amber-500" />
                  Выбрать сохраненный аккаунт
                </button>

                <button 
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="w-full py-4 bg-slate-800/40 hover:bg-slate-800/60 text-gray-300 rounded-2xl text-[10px] font-black transition-all border border-white/5 active:scale-95 uppercase tracking-widest cursor-pointer outline-none flex items-center justify-center gap-3"
                >
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  Открыть в новой вкладке
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-5 items-center w-full">
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1 h-[1px] bg-white/5"></div>
                <span className="text-[9px] text-gray-600 font-black tracking-[0.2em] uppercase">или в один клик через</span>
                <div className="flex-1 h-[1px] bg-white/5"></div>
              </div>
              
              <div className="flex gap-5 justify-center items-center">
                <button 
                  onClick={handleTelegramAuth} 
                  className="w-14 h-14 bg-[#2481cc] hover:bg-[#1a6ea8] active:scale-90 text-white rounded-2xl flex items-center justify-center transition-all shadow-md cursor-pointer border-none outline-none"
                  title="Войти через Telegram"
                >
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.05-.21.05-.39-.14-.39-.14 0-.3.08-.47.19a322.9 322.9 0 0 1-5.18 3.51c-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.37.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                  </svg>
                </button>
                <button 
                  onClick={handleVKAuth} 
                  className="w-14 h-14 bg-[#0077ff] hover:bg-[#0066ee] active:scale-90 text-white rounded-2xl flex items-center justify-center transition-all shadow-md cursor-pointer border-none outline-none"
                  title="Войти через VK"
                >
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
                    <path d="M6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z"/>
                  </svg>
                </button>
                <button 
                  onClick={handleGoogleSignIn} 
                  className="w-14 h-14 bg-white hover:bg-gray-100 active:scale-90 text-black rounded-2xl flex items-center justify-center transition-all shadow-md cursor-pointer border-none outline-none"
                  title="Войти через Google"
                >
                  <svg viewBox="0 0 24 24" className="w-7 h-7">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31l3.57 2.77c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18c-.75 1.49-1.18 3.16-1.18 4.94s.43 3.45 1.18 4.94l3.66-2.85z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full mt-4 border-t border-white/5 pt-6">
              <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest text-center mb-1">Выберите версию для входа</span>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    setAppVersion("pc");
                    localStorage.setItem("appVersion", "pc");
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all border cursor-pointer ${
                    appVersion === "pc" 
                      ? "bg-amber-500 text-black border-amber-500" 
                      : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                  }`}
                >
                  <Monitor className="w-3 h-3" /> PC
                </button>
                <button 
                  onClick={() => {
                    setAppVersion("mobile");
                    localStorage.setItem("appVersion", "mobile");
                  }}
                  className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase transition-all border cursor-pointer ${
                    appVersion === "mobile" 
                      ? "bg-amber-500 text-black border-amber-500" 
                      : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                  }`}
                >
                  <Smartphone className="w-3 h-3" /> MOBILE
                </button>
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setIsAdminLoginModalOpen(true)}
              className="text-[9px] text-gray-700 hover:text-amber-500 transition-colors uppercase tracking-[0.3em] font-black cursor-pointer border-none bg-transparent mt-2"
            >
              Admin Panel
            </button>
          </motion.div>
        </div>

        {/* --- DYNAMIC MODALS AND CONSOLES AT AUTH ZONE --- */}
        {isAdminLoginModalOpen && (
          <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-4 z-[5000] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-sm bg-[#162239] border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-4 text-white"
            >
              <h3 className="text-sm font-black uppercase text-amber-500 text-center tracking-widest">Доступ Администратора</h3>
              <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest">Введите секретный код</p>
              <input 
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                autoFocus
                className="w-full py-3 px-4 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono text-xl tracking-[0.2em] outline-none focus:border-amber-500 transition-colors"
                placeholder="******"
              />
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsAdminLoginModalOpen(false)}
                  className="flex-1 py-3 text-xs bg-slate-800 hover:bg-slate-700 text-gray-400 rounded-xl cursor-pointer"
                >
                  Отмена
                </button>
                <button 
                  onClick={() => {
                    if (adminCode === "admin123") {
                      setIsAdminLoginModalOpen(false);
                      setIsAdminConsoleOpen(true);
                      setAdminCode("");
                    } else {
                      addToast("Неверный код доступа!");
                      setAdminCode("");
                    }
                  }}
                  className="flex-1 py-3 text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl cursor-pointer"
                >
                  Войти
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAdminConsoleOpen && (
          <AdminConsole onClose={() => setIsAdminConsoleOpen(false)} addToast={addToast} />
        )}

        {isAccountSelectorOpen && (
          <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-4 z-[4500] backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-[340px] bg-[#162239] border border-amber-500/30 rounded-[24px] p-5 shadow-2xl relative font-sans flex flex-col gap-4 text-white max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500 text-sm">👤</span>
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400">Сохраненные аккаунты</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsAccountSelectorOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 hover:text-white flex items-center justify-center text-gray-400 border-none outline-none cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              {/* List of accounts */}
              <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
                {savedAccounts.length === 0 ? (
                  <div className="text-center py-8 flex flex-col items-center gap-2">
                    <span className="text-3xl text-gray-600">📭</span>
                    <p className="text-[11px] text-gray-400 font-semibold leading-relaxed">
                      На этом устройстве пока нет сохраненных аккаунтов. Войдите сначала через Telegram или Google, чтобы профиль сохранился!
                    </p>
                  </div>
                ) : (
                  savedAccounts
                    .slice()
                    .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))
                    .map((account) => (
                      <div 
                        key={account.uid}
                        className="group flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-amber-500/20 rounded-xl transition-all relative overflow-hidden"
                      >
                        {/* Left side: Avatar + info */}
                        <div 
                          onClick={() => handleSelectSavedAccount(account)}
                          className="flex items-center gap-3 flex-1 cursor-pointer select-none py-1"
                        >
                          <div className="relative">
                            {account.photoURL ? (
                              <img 
                                src={account.photoURL} 
                                alt={account.displayName} 
                                className="w-10 h-10 rounded-xl object-cover border border-white/10"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/20 flex items-center justify-center text-sm font-black text-amber-400 font-mono">
                                {account.displayName ? account.displayName.slice(0, 2).toUpperCase() : "👤"}
                              </div>
                            )}
                            <span className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1 rounded-md text-white font-mono uppercase border border-[#162239] ${
                              account.type === "telegram" ? "bg-[#2481cc]" : (account.type === "vk" ? "bg-[#0077ff]" : "bg-[#ea4335]")
                            }`}>
                              {account.type === "telegram" ? "TG" : (account.type === "vk" ? "VK" : "G")}
                            </span>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-gray-100 group-hover:text-amber-400 transition-colors truncate max-w-[130px]">
                              {account.displayName}
                            </span>
                            <span className="text-[9.5px] font-bold font-mono text-emerald-400">
                              💰 {account.coins?.toLocaleString() || 0} 🪙
                            </span>
                          </div>
                        </div>

                        {/* Right side: Forget account button */}
                        <button 
                          type="button"
                          onClick={() => deleteSavedAccountFromList(account.uid)}
                          className="p-2 hover:bg-rose-500/10 rounded-lg text-gray-500 hover:text-rose-400 transition-all border-none outline-none cursor-pointer"
                          title="Забыть аккаунт"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                )}
              </div>

              {/* Footer switcher status */}
              {isAccountSwitching && (
                <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-amber-400 font-bold font-mono animate-pulse">
                  <span className="inline-block w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                  ВЫПОЛНЯЕТСЯ ВХОД...
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Toast notifications container */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[4000] max-w-xs w-full pointer-events-none px-4">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div 
                key={toast.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-emerald-600 text-white font-bold text-xs py-3.5 px-5 rounded-[20px] shadow-xl text-center border border-emerald-400/20 backdrop-blur-md"
              >
                {toast.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </>
    );
  }

  // --- SUB-REPRESENTATIONS FOR AUTOPINNING NAVIGATION/LAYOUTS ---
  const profileSection = (
    <div className="flex justify-between items-center bg-black/30 rounded-[20px] p-3 text-sm border border-white/5 shrink-0 select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-full overflow-hidden border border-amber-400/40 bg-slate-950 flex shadow-inner shrink-0">
          <img 
            src={playerPhotoURL} 
            className="w-full h-full object-cover" 
            onError={(e) => { (e.target as HTMLImageElement).src = "https://api.dicebear.com/7.x/pixel-art/svg?seed=Lucky"; }} 
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[#ffd966] font-extrabold text-[15px] flex items-center gap-1.5 leading-none truncate">
            {playerName}
          </span>
          <span className="text-[11px] text-[#9ca7b5] mt-1 font-medium leading-none truncate">
            {playerClan ? `🏰 [${playerClan}]` : "⚠️ Без клана"}
          </span>
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button 
          type="button"
          className="w-10 h-10 rounded-xl bg-[#2c3e50] hover:bg-[#34495e] transition-colors flex items-center justify-center text-sm font-bold shadow-md cursor-pointer border-none outline-none active:scale-95"
          onClick={() => setActiveMainTab("settings")}
          title="Настройки"
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );

  const energySection = (
    <div className="bg-black/20 rounded-[20px] p-3.5 relative border border-white/5 shrink-0 select-none">
      <div className="flex justify-between items-center text-xs text-[#bbd9ff] font-semibold mb-2 font-mono">
        <span>⚡ РЕЗЕРВ ЭНЕРГИИ</span>
        <span className="text-[#2ecc71]">{regenRate > 0 ? `+${regenRate}/сек` : ""}</span>
      </div>
      <div className="w-full bg-[#1e2a3a] rounded-full h-3.5 overflow-hidden p-0.5 relative">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${
            (energy / maxEnergy) < 0.2 
              ? "bg-gradient-to-r from-red-500 to-red-600 animate-pulse" 
              : "bg-gradient-to-r from-[#3498db] to-[#2980b9]"
          }`}
          style={{ width: `${(energy / maxEnergy) * 100}%` }}
        ></div>
      </div>
      <div className="flex justify-between items-center text-[11px] text-[#ffd966] mt-2 font-mono font-medium">
        <span>{Math.floor(energy)} / {maxEnergy}</span>
        <span className="opacity-80 text-[#8fa2be]">Клик: -1 ⚡</span>
      </div>
    </div>
  );

  const scoreSection = (
    <div className="text-center my-1 shrink-0 select-none">
      <div className="text-[11px] text-[#7f8c8d] uppercase tracking-wider font-extrabold font-mono">Ваш баланс</div>
      <div className="text-5xl font-black text-white mt-1 select-none font-mono drop-shadow-[0_4px_12px_rgba(255,255,255,0.1)]">
        {Math.floor(coins).toLocaleString()}
      </div>
    </div>
  );

  const clickAreaSection = (
    <div className="flex justify-center my-1 select-none shrink-0">
      <button 
        onTouchStart={handleManualClick}
        onClick={handleManualClick}
        disabled={energy <= 0}
        className={`w-[155px] h-[155px] rounded-full flex items-center justify-center relative select-none transition-transform duration-75 outline-none border-none cursor-pointer focus:ring-0 select-none touch-manipulation ${
          energy <= 0 ? "grayscale opacity-50 cursor-not-allowed scale-95" : "active:scale-95 active:translate-y-1"
        }`}
        style={{
          background: "radial-gradient(circle at 30% 30%, #ffaa44, #d35400)",
          boxShadow: energy <= 0 ? "none" : "0 8px 0 #a04000, 0 16px 24px rgba(0,0,0,0.45)",
        }}
      >
        <span className="text-6xl select-none pointer-events-none filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]">
          💎
        </span>
      </button>
    </div>
  );

  const levelProgressSection = (
    <div className="bg-black/20 rounded-[20px] p-3.5 relative border border-white/5 select-none text-sm shrink-0">
      <div className="flex justify-between items-center text-xs text-[#ffd966] font-extrabold mb-1.5 font-mono">
        <span>⭐ УРОВЕНЬ {lvlInfo.lvl}</span>
        <span className="text-[#aab3c4] text-[10px] font-bold">({lvlInfo.progressInLvl} / {lvlInfo.neededInLvl} кликов)</span>
      </div>
      
      <div className="w-full bg-[#1e2a3a] rounded-full h-3 overflow-hidden p-[1px] relative">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-[#e67e22] transition-all duration-300"
          style={{ width: `${lvlInfo.pct}%` }}
        ></div>
      </div>
      
      <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono font-medium mt-1.5 leading-none">
        <span>Прогресс до Уровня {lvlInfo.lvl + 1}</span>
        <span className="text-amber-400 font-bold">{Math.round(lvlInfo.pct)}%</span>
      </div>
    </div>
  );

  const activeTabContentSection = (
    <>
      {activeMainTab === "upgrades" && (
        <div className={`gap-2.5 ${appVersion === "pc" ? "grid grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in" : "flex flex-col animate-fade-in"}`}>
          {/* Click Upgrade Card */}
          <div className="bg-[#162239] rounded-xl p-2.5 flex justify-between items-center border border-white/5">
            <div className="flex flex-col min-w-0 pr-1">
              <span className="text-xs font-black text-[#ffbc6e] flex items-center gap-1 uppercase tracking-wide truncate">👊 Сила клика</span>
              <span className="text-[10px] text-[#aab7c4] mt-0.5 font-sans">Уровень {clickPowerLevel} (+1 монета/клик)</span>
            </div>
            <button 
              onClick={() => buyUpgrade("click")}
              disabled={coins < clickUpgradePrice}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-black transition-all shadow border-none outline-none shrink-0 ${
                coins >= clickUpgradePrice 
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer" 
                  : "bg-slate-800 text-gray-500 cursor-not-allowed opacity-50"
              }`}
            >
              {clickUpgradePrice.toLocaleString()} 💰
            </button>
          </div>

          {/* Autoclicker Upgrade Card */}
          <div className="bg-[#162239] rounded-xl p-2.5 flex justify-between items-center border border-white/5">
            <div className="flex flex-col flex-1 min-w-0 pr-1.5">
              <span className="text-xs font-black text-[#ffbc6e] flex items-center gap-1 uppercase tracking-wide truncate font-semibold">🤖 Автокликер 24/7</span>
              <span className="text-[10px] text-[#aab7c4] mt-0.5 truncate select-none leading-normal font-sans">
                Ур.{autoClickerLevel} (+{Math.ceil(autoClickerLevel * 0.5)} монеты/сек)
              </span>
            </div>
            <button 
              onClick={() => buyUpgrade("auto")}
              disabled={coins < autoClickerPrice}
              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-black transition-all shadow border-none outline-none shrink-0 ${
                coins >= autoClickerPrice 
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer" 
                  : "bg-slate-800 text-gray-500 cursor-not-allowed opacity-50"
              }`}
            >
              {autoClickerPrice.toLocaleString()} 💰
            </button>
          </div>
        </div>
      )}
      {activeMainTab === "quests" && renderQuestsContent()}
      {activeMainTab === "chat" && renderChatContent()}
      {activeMainTab === "shop" && renderShopContent()}
      {activeMainTab === "social" && renderSocialContent()}
      {activeMainTab === "settings" && renderSettingsContent()}
      {activeMainTab === "clanwars" && renderClanWarsContent()}
    </>
  );

  const bottomNavigationSection = (
    <div className="flex justify-between items-center bg-slate-950/60 p-1.5 rounded-xl gap-1 shrink-0 h-[70px] border border-white/10 select-none shadow-2xl relative z-20">
      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        onClick={() => setActiveMainTab("upgrades")}
        className={`touch-manipulation flex-1 flex flex-col items-center justify-center h-full rounded-lg transition-all cursor-pointer border-none outline-none bg-transparent py-1 ${
          activeMainTab === "upgrades"
            ? "text-white bg-[#e67e22] shadow-[0_4px_12px_rgba(230,126,34,0.4)]"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Sparkles className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-black tracking-wide leading-none">Улучшения</span>
      </motion.button>
      
      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        onClick={() => setActiveMainTab("quests")}
        className={`touch-manipulation flex-1 flex flex-col items-center justify-center h-full rounded-lg transition-all cursor-pointer border-none outline-none bg-transparent py-1 ${
          activeMainTab === "quests"
            ? "text-white bg-[#e67e22] shadow-[0_4px_12px_rgba(230,126,34,0.4)]"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Star className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-black tracking-wide leading-none">Квесты</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        onClick={() => setActiveMainTab("chat")}
        className={`touch-manipulation flex-1 flex flex-col items-center justify-center h-full rounded-lg transition-all cursor-pointer border-none outline-none bg-transparent py-1 ${
          activeMainTab === "chat"
            ? "text-white bg-[#e67e22] shadow-[0_4px_12px_rgba(230,126,34,0.4)]"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <MessageSquare className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-black tracking-wide leading-none">Чат</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        onClick={() => {
          setActiveSocialTab("players");
          setActiveMainTab("social");
        }}
        className={`touch-manipulation flex-1 flex flex-col items-center justify-center h-full rounded-lg transition-all cursor-pointer border-none outline-none bg-transparent py-1 ${
          activeMainTab === "social"
            ? "text-white bg-[#e67e22] shadow-[0_4px_12px_rgba(230,126,34,0.4)]"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Globe className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-black tracking-wide leading-none">Соц. сеть</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        onClick={() => setActiveMainTab("clanwars")}
        className={`touch-manipulation flex-1 flex flex-col items-center justify-center h-full rounded-lg transition-all cursor-pointer border-none outline-none bg-transparent py-1 ${
          activeMainTab === "clanwars"
            ? "text-white bg-[#e67e22] shadow-[0_4px_12px_rgba(230,126,34,0.4)]"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Swords className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-black tracking-wide leading-none">Битвы</span>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 450, damping: 18 }}
        onClick={() => setActiveMainTab("shop")}
        className={`touch-manipulation flex-1 flex flex-col items-center justify-center h-full rounded-lg transition-all cursor-pointer border-none outline-none bg-transparent py-1 ${
          activeMainTab === "shop"
            ? "text-white bg-[#e67e22] shadow-[0_4px_12px_rgba(230,126,34,0.4)]"
            : "text-gray-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Store className="w-5 h-5 mb-0.5" />
        <span className="text-[9px] font-black tracking-wide leading-none">Магазин</span>
      </motion.button>
    </div>
  );

  return (
    <div 
      className={`text-white font-sans flex items-center justify-center transition-all duration-300 relative overflow-hidden select-none ${
        appVersion === "pc" ? "p-4 w-screen h-screen md:p-8" : "p-2 w-screen h-[100dvh] pb-4"
      }`}
      style={{
        background: isLiquidGlass 
          ? "radial-gradient(circle at center, #111a30 0%, #060914 100%)" 
          : "linear-gradient(135deg, #0a0f1e, #0f172a)",
      }}
    >
      {isWhitelistedRejected && (
        <div className="fixed inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center z-[9999] backdrop-blur-xl animate-fade-in font-sans">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/35 flex items-center justify-center text-red-500 text-4xl shadow-[0_0_30px_rgba(239,68,68,0.2)] mb-6 animate-pulse">
            🔒
          </div>
          <h2 className="text-2xl font-black text-red-500 uppercase tracking-widest mb-3">
            Ограниченный доступ
          </h2>
          <p className="text-xs text-slate-350 leading-relaxed max-w-sm mb-6">
            Ваш аккаунт не обнаружен в Белом Списке игроков (в Google Таблице). Игра доступна только для авторизованных партнеров и тестировщиков.
          </p>
          <div className="bg-[#111a2e] px-4 py-2.5 rounded-xl border border-white/5 text-[11px] text-[#aab3c4] font-mono select-all flex items-center gap-2">
            <span>Telegram ID:</span>
            <span className="font-bold text-white">{linkedTelegramId || "Не подключен"}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-4 leading-normal">
            Если это ошибка, пожалуйста, обратитесь к администратору для добавления Вашего Telegram ID в белый список Google Таблицы.
          </p>
        </div>
      )}

      {isSyncing && (
        <div className="fixed top-4 right-4 z-[9999] bg-blue-900/80 text-blue-100 px-4 py-2 rounded-full border border-blue-500 backdrop-blur-sm animate-pulse text-sm font-medium">
           ⏳ Синхронизируется...
        </div>
      )}

      {/* Decorative ambient glowing lights behind the liquid glass to highlight refraction */}
      {isLiquidGlass && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[20%] left-[25%] w-64 h-64 bg-orange-500/20 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: "7s" }}></div>
          <div className="absolute bottom-[20%] right-[25%] w-72 h-72 bg-blue-600/25 rounded-full blur-[90px] animate-pulse" style={{ animationDuration: "9s" }}></div>
          <div className="absolute top-[50%] right-[15%] w-48 h-48 bg-emerald-500/15 rounded-full blur-[70px] animate-pulse" style={{ animationDuration: "12s" }}></div>
        </div>
      )}

      {/* Sparkles / floating text values of clicks */}
      {floatingTexts.map((f) => (
        <span 
          key={f.id}
          className="absolute font-black text-2xl select-none pointer-events-none text-white transition-all drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] z-[2000] animate-bounce"
          style={{
            left: f.x,
            top: f.y,
            textShadow: "0 0 10px rgba(255, 215, 0, 0.4)",
            animation: "floatUp 0.85s cubic-bezier(0.25, 1, 0.5, 1) forwards",
          }}
        >
          {f.text}
        </span>
      ))}

      {/* Primary container */}
      <div 
        id="gameContainer" 
        className={`w-full transition-all duration-500 relative overflow-hidden flex flex-col z-10 ${
          appVersion === "pc" 
            ? "max-w-[1240px] h-[92vh] max-h-[820px] p-6" 
            : "max-w-[430px] h-[94vh] max-h-[840px] p-4.5"
        } rounded-[28px] shadow-2xl ${
          isLiquidGlass 
            ? "border border-white/20 bg-white/[0.05]" 
            : "border border-white/10"
        }`}
        style={{
          background: isLiquidGlass 
            ? "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)" 
            : "rgba(15, 25, 45, 0.96)",
          backdropFilter: isLiquidGlass ? "blur(30px) saturate(160%)" : "blur(20px)",
          boxShadow: isLiquidGlass 
            ? "0 20px 50px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.25), inset 0 -1px 3px rgba(255, 255, 255, 0.05)" 
            : "0 10px 40px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Network & Realtime Ticking Clock Header */}
        <div className="absolute top-1.5 left-4 right-12 z-10 flex justify-between items-center pointer-events-none select-none">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-full bg-slate-905/60 border border-white/5 shadow-sm">
              <span className={`w-1 h-1 rounded-full ${isTimeSynced ? "bg-amber-400 animate-pulse" : "bg-zinc-650"}`}></span>
              <span className="text-[9px] text-[#ffd966] font-extrabold font-mono tracking-wider">
                {realTime || "00:00:00"}
              </span>
            </div>

            {/* VK Bridge Connection Indicator UI */}
            {vkInitStatus !== "not_vk" && vkInitStatus !== "idle" && (
              <button
                type="button"
                onClick={vkInitStatus === "error" ? () => { initVKMiniApp(); } : undefined}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border shadow-sm text-[8px] font-black font-mono tracking-wide pointer-events-auto select-none transition-all outline-none bg-transparent ${
                  vkInitStatus === "initializing"
                    ? "border-[#3498db]/20 text-[#3498db] animate-pulse"
                    : vkInitStatus === "success"
                    ? "border-emerald-500/20 text-emerald-400"
                    : "border-rose-500/30 text-rose-300 hover:bg-rose-950/40 cursor-pointer active:scale-95"
                }`}
                title={vkInitStatus === "error" ? `Ошибка VK: ${vkInitError || "Нажмите для повтора"}` : `VK Инициализация: ${vkInitStatus}`}
              >
                <span className={`w-1 h-1 rounded-full ${
                  vkInitStatus === "initializing"
                    ? "bg-blue-400 animate-bounce"
                    : vkInitStatus === "success"
                    ? "bg-emerald-400"
                    : "bg-rose-400 animate-pulse"
                }`}></span>
                <span>
                  {vkInitStatus === "initializing" && "VK..."}
                  {vkInitStatus === "success" && "VK: Ок"}
                  {vkInitStatus === "error" && "VK: Сбой (🔄)"}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-905/60 border border-white/5 shadow-sm" title="Server Instance ID">
            <span className={`w-1 h-1 rounded-full ${networkConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
            <span className="text-[8.5px] text-[#aab3c4] font-semibold tracking-wider font-mono uppercase flex items-center gap-1">
              {networkConnected ? "Online" : "Offline"}
              {networkConnected && serverInstanceId && <span className="opacity-50 font-bold ml-1">[{serverInstanceId}]</span>}
            </span>
          </div>
        </div>

        {/* Global Realtime notification banner */}
        <AnimatePresence>
          {networkEventNotice && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-900/80 border border-[#e67e22]/35 text-[#ffd966] text-[10.5px] font-bold py-1 px-2 mb-2 rounded-xl flex items-center justify-between shadow-inner"
            >
              <span>{networkEventNotice}</span>
              <button onClick={() => setNetworkEventNotice(null)} className="text-white/40 hover:text-white ml-2 text-xs border-none bg-transparent cursor-pointer">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Responsive Layout */}
        {appVersion === "pc" ? (
          <div className="flex flex-row gap-6 h-full min-h-0 overflow-hidden relative pt-3">
            {/* Left Column: Stats & Tapping */}
            <div className="w-[360px] flex flex-col gap-4 shrink-0 h-full overflow-y-auto pr-1">
              {profileSection}
              {energySection}
              {scoreSection}
              {clickAreaSection}
              {levelProgressSection}
            </div>

            {/* Right Column: Tab screen and docked nav */}
            <div className="flex-1 flex flex-col gap-4 min-w-0 h-full justify-between">
              {/* Content Panel */}
              <div className="flex-1 min-h-0 overflow-y-auto bg-black/25 rounded-[22px] p-4.5 border border-white/5 shadow-inner relative flex flex-col">
                {activeTabContentSection}
              </div>

              {/* Bottom Sticky Nav */}
              {bottomNavigationSection}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full min-h-0 overflow-hidden pt-3 justify-between">
            {/* Scrollable area for all game metrics and tabs, preserving original spacious scale */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 pb-3 scrollbar-none min-h-0">
              {profileSection}
              {energySection}
              {scoreSection}
              {clickAreaSection}
              {levelProgressSection}

              {/* Active Tab Content Panel */}
              <div className="bg-black/25 rounded-[22px] p-4.5 border border-white/5 shadow-inner flex flex-col shrink-0 min-h-[380px] relative">
                {activeTabContentSection}
              </div>
            </div>

            {/* Bottom menu stays permanently pinned at the bottom of the container */}
            <div className="pt-2 shrink-0">
              {bottomNavigationSection}
            </div>
          </div>
        )}
      </div>








      {/* Player Profile Dialog */}
      {viewingProfile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[3000] p-4 text-white">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0B1120] border border-white/10 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] relative"
          >
            <div className="h-24 bg-gradient-to-r from-indigo-900 via-[#1a0f2e] to-[#040914] relative">
              <button
                type="button"
                onClick={() => setViewingProfile(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer border-none z-10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="px-5 pb-5 relative flex-1 flex flex-col">
              <div className="w-20 h-20 rounded-2xl bg-slate-950 border-4 border-[#0B1120] shadow-xl flex items-center justify-center overflow-hidden absolute -top-10 left-5">
                {viewingProfile.photoURL ? (
                  <img src={viewingProfile.photoURL} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-gray-500" />
                )}
              </div>
              
              <div className="mt-12 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-white">{viewingProfile.name}</h3>
                  <span className={`w-2.5 h-2.5 rounded-full ${viewingProfile.isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-gray-500"}`} title={viewingProfile.isOnline ? "Онлайн" : "Офлайн"}></span>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#aab3c4]">Уровень {Math.floor(viewingProfile.clicks / 100) + 1}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-amber-400">💰 {Math.floor(viewingProfile.coins).toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                {(!currentUser || viewingProfile.id !== currentUser.uid) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMainTab("social");
                        setActiveSocialTab("friends");
                        setActiveFriendChatId(viewingProfile.id);
                        setViewingProfile(null);
                      }}
                      className="py-3 bg-[#1e293b] hover:bg-[#334155] border border-white/5 text-white text-xs font-black rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" /> Написать ЛС
                    </button>

                    {!friendsList.includes(viewingProfile.id) ? (
                      <button 
                        onClick={() => {
                          handleAddFriend(viewingProfile.id, viewingProfile.name);
                          setViewingProfile(null);
                        }}
                        className="py-3 bg-[#0d9488]/20 hover:bg-[#0d9488]/40 border border-[#0d9488]/40 text-[#2dd4bf] text-xs font-black rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-4 h-4" /> В Друзья
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          handleRemoveFriend(viewingProfile.id);
                          setViewingProfile(null);
                        }}
                        className="py-3 bg-[#3f2a33] hover:bg-[#4f323e] border border-[#ff6b6b]/30 text-[#ff8ba7] text-xs font-black rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> Удалить
                      </button>
                    )}

                    <button
                        onClick={() => {
                          if (mutedPlayers.includes(viewingProfile.id)) {
                            setMutedPlayers(mutedPlayers.filter(id => id !== viewingProfile.id));
                          } else {
                            setMutedPlayers([...mutedPlayers, viewingProfile.id]);
                          }
                          setViewingProfile(null);
                        }}
                        className={`py-3 border text-xs font-black rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                            mutedPlayers.includes(viewingProfile.id) 
                            ? "bg-amber-900/40 border-amber-500/30 text-amber-300"
                            : "bg-[#1e293b] hover:bg-[#334155] border-white/5 text-white"
                        }`}
                    >
                        <VolumeX className="w-4 h-4" /> {mutedPlayers.includes(viewingProfile.id) ? "Размутить" : "Замутить"}
                    </button>

                    <div className="py-3 bg-[#0f172a] border border-white/5 text-xs font-black rounded-2xl flex items-center justify-center gap-1.5 opacity-80 select-none">
                      <Shield className="w-4 h-4 text-gray-500" /> 
                      <span className={viewingProfile.clan ? "text-indigo-300" : "text-gray-500"}>{viewingProfile.clan || "Нет клана"}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setViewingPlayerStore({ id: viewingProfile.id, name: viewingProfile.name });
                        setActiveMainTab("shop");
                        setActiveShopTab("buy");
                        setShopCategory("all");
                        setViewingProfile(null);
                      }}
                      className="py-3 bg-[#4c1d95]/40 hover:bg-[#4c1d95]/60 border border-[#7c3aed]/30 text-[#c4b5fd] text-xs font-black rounded-2xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Store className="w-4 h-4" /> Магазин Игрока
                    </button>
                  </>
                ) : (
                  <>
                    <div className="col-span-2 py-3 bg-[#0f172a] border border-white/5 text-xs font-black rounded-2xl flex items-center justify-center gap-1.5 opacity-80 select-none">
                      <Shield className="w-4 h-4 text-emerald-400" /> 
                      <span className="text-emerald-300">Это ваш профиль</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Marketplace Item Details Dialog */}
      {selectedListing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[3000] p-4 text-white">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0f1829] rounded-[24px] border border-amber-500/30 p-5 w-full max-w-[360px] flex flex-col gap-4 shadow-2xl relative"
          >
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-white/5 pb-2.5">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#2980b9] font-black uppercase tracking-wider font-mono">ИГРОВОЙ АРТЕФАКТ 📦</span>
                <h4 className="text-sm font-black text-[#75c6ff] mt-0.5 leading-snug">{selectedListing.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer border-none"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Description utilities */}
            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 text-xs text-gray-300 leading-relaxed max-h-[120px] overflow-y-auto select-text">
              {selectedListing.description}
            </div>

            {/* Seller profile card */}
            <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 flex justify-between items-center gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] text-gray-500 font-extrabold uppercase tracking-wide">Продавец</span>
                <span className="text-xs font-bold text-emerald-400 mt-0.5 truncate">👤 {selectedListing.sellerName}</span>
              </div>
              
              <button
                type="button"
                onClick={() => handleMessageSeller(selectedListing.sellerId, selectedListing.sellerName, selectedListing.title)}
                className="py-1.5 px-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/20 text-blue-400 text-[10px] font-black rounded-lg cursor-pointer transition-all outline-none flex items-center gap-1 shrink-0"
                title="Написать в Лобби-Чат"
              >
                <MessageSquare className="w-3 h-3" /> Написать
              </button>
            </div>

            {/* Price indicator */}
            <div className="flex justify-between items-center px-1">
              <span className="text-xs text-gray-400 font-bold uppercase">Стоимость предложения:</span>
              <span className="text-lg font-black font-mono text-amber-400 bg-amber-950/40 px-3 py-1 rounded-xl border border-amber-900/35">
                {selectedListing.price.toLocaleString()} 💰
              </span>
            </div>

            {/* Form actions */}
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setSelectedListing(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-305 transition-all rounded-xl cursor-pointer select-none text-center outline-none border-none"
              >
                Назад
              </button>
              
              <motion.button
                whileTap={{ scale: currentUser?.uid === selectedListing.sellerId || isBuying || purchasedListingId === selectedListing.id ? 1 : 0.96 }}
                type="button"
                disabled={currentUser?.uid === selectedListing.sellerId || isBuying || purchasedListingId === selectedListing.id}
                onClick={() => handleBuyItem(selectedListing)}
                className={`flex-1 py-2.5 text-xs font-black transition-all rounded-xl cursor-pointer text-center outline-none border-none text-white shadow-md flex items-center justify-center gap-1.5 ${
                  currentUser?.uid === selectedListing.sellerId
                    ? "bg-slate-700 cursor-not-allowed opacity-40 text-gray-400"
                    : purchasedListingId === selectedListing.id
                      ? "bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.8)] scale-105"
                      : isBuying 
                        ? "bg-emerald-700 cursor-wait opacity-80"
                        : "bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_4px_15px_rgba(5,150,105,0.4)]"
                }`}
              >
                {currentUser?.uid === selectedListing.sellerId ? "Ваш лот" : purchasedListingId === selectedListing.id ? "✔️ Куплено!" : isBuying ? "⏳ Покупка..." : "Купить"}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Player Store View Dialog */}
      {viewingPlayerStore && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-3 z-[3000]">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-[340px] bg-[#162239] rounded-[24px] p-4 flex flex-col gap-4 border border-[#e67e22]/30 shadow-2xl overflow-y-auto max-h-[85vh] relative"
          >
            <button 
              onClick={() => setViewingPlayerStore(null)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-[14px] font-black text-[#ffbc6e] flex items-center gap-2 pr-6">
              <Store className="w-4 h-4 text-amber-500" />
              Товары игрока {viewingPlayerStore.name}
            </h2>
            
            <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
              {marketplaceListings.filter(l => l.sellerId === viewingPlayerStore.id).length === 0 ? (
                <div className="text-center text-gray-500 py-10 bg-black/20 rounded-2xl border border-white/5">
                  <Store className="w-8 h-8 mx-auto mb-2 opacity-40 text-gray-600" />
                  <p className="font-extrabold text-[12px] text-gray-400 uppercase tracking-wide">ПУСТО</p>
                  <p className="text-[10px] text-gray-500 mt-1">Этот игрок пока ничего не продает.</p>
                </div>
              ) : (
                marketplaceListings.filter(l => l.sellerId === viewingPlayerStore.id).map(listing => (
                  <div key={listing.id} className="bg-slate-950/40 hover:bg-slate-900 border border-white/5 rounded-xl p-3 flex flex-col gap-2 font-sans transition-colors cursor-pointer"
                       onClick={() => {
                         setViewingPlayerStore(null);
                         setSelectedListing(listing);
                       }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                        <img 
                          src={listing.itemImage} 
                          className="w-full h-full object-cover" 
                          onError={(e) => { (e.target as HTMLImageElement).src = ITEM_MAP.custom; }}
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-extrabold text-[#75c6ff] truncate">{listing.title}</span>
                        <span className="text-[9px] text-[#2ecc71] font-black font-mono tracking-wider mt-0.5">{listing.price.toLocaleString()} 💰</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <button
              onClick={() => setViewingPlayerStore(null)}
              className="py-2.5 bg-slate-800 hover:bg-slate-705 text-gray-300 text-xs font-bold rounded-xl cursor-pointer transition-colors border-none outline-none mt-2"
            >
              Закрыть
            </button>
          </motion.div>
        </div>
      )}

      {/* 24/7 Autoclicker Offline Earnings Modal */}
      {offlineEarningsData && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[3500] p-4 text-white">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#0f1829] rounded-[28px] border-2 border-amber-500/40 p-6 w-full max-w-[360px] flex flex-col gap-4 text-center shadow-[0_0_50px_rgba(243,156,18,0.15)] relative"
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-1 animate-pulse">
              <Zap className="w-8 h-8 text-amber-400" />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest font-mono">АВТОКЛИКЕР 24/7 СРАБОТАЛ! ⚡</span>
              <h3 className="text-lg font-black text-white">Ваш робот трудился, пока вы спали!</h3>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 flex flex-col gap-2 my-1">
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>Вас не было:</span>
                <span className="font-bold text-white font-mono">
                  {offlineEarningsData.hours > 0 ? `${offlineEarningsData.hours}ч ` : ""}
                  {offlineEarningsData.mins > 0 ? `${offlineEarningsData.mins}м ` : ""}
                  {offlineEarningsData.secs}с
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>Скорость автофарма:</span>
                <span className="font-bold text-emerald-400 font-mono">+{Math.ceil(autoClickerLevel * 0.5)} 💰/сек</span>
              </div>
              <hr className="border-white/5 my-1" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider font-mono">Добытые монеты</span>
                <span className="text-3xl font-black text-amber-400 font-mono mt-1">
                  +{offlineEarningsData.coinsEarned.toLocaleString()} 💰
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const totalClaimed = coins + offlineEarningsData.coinsEarned;
                setCoins(totalClaimed);
                addToast(`🔋 Автокликер принес вам +${offlineEarningsData.coinsEarned.toLocaleString()} 💰!`);
                setOfflineEarningsData(null);
                
                // Save immediately so state remains clean in localStorage
                const saved = localStorage.getItem("gameDataV9");
                if (saved) {
                  try {
                    const parsed = JSON.parse(saved);
                    parsed.coins = totalClaimed;
                    parsed.lastActiveTimestamp = Date.now() + timeOffsetRef.current;
                    localStorage.setItem("gameDataV9", JSON.stringify(parsed));
                  } catch (e) {
                    console.error("Failed to update coins in localStorage on offline claim", e);
                  }
                }

                // Immediately write to Firestore in the cloud so it is saved 24/7!
                if (currentUser) {
                  saveToFirestore(currentUser, false, false, totalClaimed);
                }
              }}
              className="py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-[#e67e22] hover:brightness-110 transition-all text-xs font-black rounded-2xl cursor-pointer text-slate-950 uppercase tracking-wider outline-none border-none shadow-[0_4px_12px_rgba(243,156,18,0.25)] select-none"
            >
              Забрать добычу 🪙
            </button>
          </motion.div>
        </div>
      )}

      {/* PC Launcher Dialog / Wizard */}
      {isLauncherModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-3 z-[4000] backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`w-full ${launcherModalStep === "downloading" ? "max-w-[460px]" : "max-w-[340px]"} bg-[#162239] rounded-[24px] p-5 flex flex-col gap-4 border border-amber-500/30 shadow-2xl overflow-y-auto max-h-[90vh] relative font-sans transition-all duration-300`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500 text-lg">🖥️</span>
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Установка на ПК</h3>
                <span className="text-[9px] text-[#2ecc71] font-mono uppercase tracking-wider font-bold">Официальный Лаунчер</span>
              </div>
            </div>

            {launcherModalStep === "intro" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <p className="text-xs text-gray-300 leading-relaxed font-semibold">
                  Хотите скачать игру на ПК для супер-быстрой работы, автозапуска и полноценного геймплея со своего Рабочего Стола?
                </p>
                
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-[#2ecc71] text-[10.5px] p-2.5 rounded-xl font-semibold leading-relaxed mb-1 cursor-pointer hover:bg-emerald-500/20 transition-all"
                  onClick={() => {
                    const currentUrl = window.location.href;
                    navigator.clipboard.writeText(currentUrl);
                    addToast("🔗 Ссылка на браузерную версию скопирована!");
                  }}
                >
                  🌐 Браузерная версия: <span className="underline opacity-80 break-all">{window.location.origin}</span>
                  <div className="text-[9px] mt-1 opacity-70">(Нажмите, чтобы скопировать ссылку)</div>
                </div>

                <div className="bg-slate-950/40 p-3 rounded-xl border border-white/5 flex flex-col gap-1.5 text-[10px] text-gray-400">
                  <span className="font-bold text-[#ffd966]">🔥 Что вы получите:</span>
                  <span>• Иконка и ярлык автозапуска на Рабочем столе</span>
                  <span>• Работает без лагов браузера и клиентов TG</span>
                  <span>• Полноценный скрипт моментального запуска</span>
                </div>
                <div className="flex gap-2.5 mt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      setLauncherModalStep("canceled");
                      addToast("❌ Установка лаунчера отклонена");
                    }} 
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold rounded-xl cursor-pointer transition-colors border-none outline-none"
                  >
                    Отклонить
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setLauncherModalStep("instructions")} 
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-all uppercase tracking-wider border-none outline-none"
                  >
                    Продолжить
                  </button>
                </div>
              </div>
            )}

            {launcherModalStep === "instructions" && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="bg-amber-500/10 border border-amber-500/20 text-[#ffd966] text-[10.5px] p-2.5 rounded-xl font-semibold leading-relaxed">
                  📢 Линк для скачивания лаунчера откроется в новой вкладке. После этого запустится торрент-загрузчик!
                </div>
                
                <div className="text-[10px] font-mono text-gray-300 flex flex-col gap-1.5 bg-black/25 p-3 rounded-xl border border-white/5 leading-relaxed font-sans">
                  <span className="text-amber-300 font-extrabold uppercase text-[9px] font-mono">Шаги установки (Проще простого!):</span>
                  <span>1. Скачайте ZIP-архив по кнопке ниже.</span>
                  <span>2. Распакуйте весь архив в новую папку на ПК.</span>
                  <span>3. Запустите файл <strong className="text-amber-400">УСТАНОВКА_ИГРЫ.bat</strong> в папке.</span>
                  <span>4. <strong className="text-emerald-400">Инсталлятор сам всё настроит:</strong> скачает платформу, создаст ярлык на Рабочем Столе и сразу запустит полноценную игру!</span>
                </div>

                <div className="flex flex-col gap-2.5 mt-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      window.open("/api/download-launcher", "_blank");
                      addToast("📥 Начинаем скачивание легкого инсталлятора...");
                      setLauncherModalStep("downloading");
                    }} 
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-black rounded-xl cursor-pointer transition-all uppercase tracking-wider border-none outline-none flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                  >
                    📥 СКАЧАТЬ ЛЕГКИЙ ИНСТАЛЛЯТОР И ПОДГОТОВИТЬ ZIP
                  </button>
                  
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => {
                        setLauncherModalStep("canceled");
                        addToast("❌ Установка лаунчера отменена");
                      }} 
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-gray-400 text-[10px] font-bold rounded-xl cursor-pointer transition-colors border-none outline-none"
                    >
                      Отклонить
                    </button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setLauncherModalStep("downloading");
                        addToast("🎉 Инициализация торрент-загрузчика!");
                      }} 
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black rounded-xl cursor-pointer transition-all uppercase tracking-wide border-none outline-none"
                    >
                      Открыть Загрузчик игры
                    </button>
                  </div>
                </div>
              </div>
            )}

            {launcherModalStep === "downloading" && (
              <div className="flex flex-col gap-4 animate-fade-in font-mono">
                {/* Simulated Torrent Top Bar */}
                <div className="bg-[#0f172a] border border-[#f39c12]/25 rounded-2xl p-3 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                    <span>Раздача: <strong className="text-amber-400">ClickClans_PC_Client_v2.5.torrent</strong></span>
                    <span className="text-[#2ecc71] font-black animate-pulse flex items-center gap-1">● РАСПРЕДЕЛЕННАЯ</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-200 font-bold">
                    <span>Общий размер: <span className="font-bold text-slate-400">1.24 GB</span></span>
                    <span className="text-cyan-400 font-black">{torrentSpeed} MB/s</span>
                  </div>
                </div>

                {/* Main Progress Indicator */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] font-black font-sans">
                    <span className="text-slate-300 uppercase tracking-wider">СКАЧИВАНИЕ PC-ЛАУНЧЕРА:</span>
                    <span className="text-[#2ecc71] font-mono">{torrentProgress}%</span>
                  </div>
                  
                  {/* Progress Glow Bar */}
                  <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-white/5 relative p-[2px]">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 via-[#2ecb71] to-indigo-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(46,203,113,0.4)]"
                      style={{ width: `${torrentProgress}%` }}
                    />
                  </div>
                  
                  {/* Peers / ETA Information */}
                  <div className="flex justify-between items-center text-[9px] text-gray-400 font-bold">
                    <span className="flex items-center gap-1">🟢 СИДЫ: <span className="text-emerald-400 font-black">142</span> / ПИРЫ: <span className="text-sky-400 font-black">34</span></span>
                    <span>ОСТАЛОСЬ: <span className="text-amber-400 font-black">{
                      torrentProgress >= 100 ? "Завершено" : `${Math.ceil((1240 * (100 - torrentProgress) / 1024) / (torrentSpeed || 1))} сек`
                    }</span></span>
                  </div>
                </div>

                {/* Piece Map Grid Layout utorrent Style */}
                <div className="flex flex-col gap-1">
                  <span className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest font-sans">СЕТКА КУСКОВ ТОРРЕНТА (PIECES MAP):</span>
                  <div className="bg-slate-950 p-2 rounded-xl border border-white/5 grid grid-cols-12 gap-1 max-h-[85px] overflow-hidden">
                    {Array.from({ length: 84 }).map((_, idx) => {
                      const isDownloaded = idx < Math.floor((torrentProgress / 100) * 84);
                      const isDownloading = idx === Math.floor((torrentProgress / 100) * 84);
                      return (
                        <div 
                          key={idx} 
                          className={`h-2 rounded-[1.5px] transition-all duration-150 ${
                            isDownloaded 
                              ? "bg-gradient-to-br from-[#2ecc71] to-[#27ae60]" 
                              : isDownloading 
                                ? "bg-amber-400 animate-pulse" 
                                : "bg-slate-800"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Individual Files Progress */}
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1.5 text-[9px] text-gray-300 font-medium">
                  <div className="flex justify-between items-center">
                    <span className="truncate max-w-[220px]">💻 clans_core_engine.exe (620 MB)</span>
                    <span className="text-[#2ecc71] font-bold font-mono">
                      {Math.min(100, Math.floor(torrentProgress * 1.2))}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="truncate max-w-[220px]">📦 game_asset_data.pack (540 MB)</span>
                    <span className="text-[#2ecc71] font-bold font-mono">
                      {Math.max(0, Math.min(100, Math.floor((torrentProgress - 30) * 1.43)))}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>🎶 audio_soundtrack.mp3 (64 MB)</span>
                    <span className="text-[#2ecc71] font-bold">100%</span>
                  </div>
                </div>

                {/* Console Log window */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-white/5 h-[72px] overflow-y-auto flex flex-col gap-0.5 text-[9px] text-gray-400">
                  {torrentLogs.map((log, i) => (
                    <div key={i} className="truncate select-none text-emerald-500/80">
                      {log}
                    </div>
                  ))}
                </div>

                {/* Seed Speed Booster button click integrated! */}
                {torrentProgress < 100 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTorrentSpeed(prev => parseFloat(Math.min(120.0, prev + 4.5).toFixed(1)));
                      setTorrentProgress(prev => Math.min(100, prev + 3));
                      setTorrentLogs(prev => {
                        const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] 🚀 ТУРБО-КЛИК: Скорость разогнана вождем клана`];
                        return newLogs.slice(newLogs.length - 5);
                      });
                      addToast("🚀 ТУРБО-КЛИК: +4.5 МБ/сек!");
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 animate-bounce cursor-pointer border-none outline-none select-none font-sans shadow-md"
                  >
                    ⚡ РАЗОГНАТЬ КЛИКАМИ (+4.5 MB/s)
                  </button>
                )}

                {/* Launch Client Button once reached 100% completed */}
                {torrentProgress >= 100 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLauncherModalStep("success");
                      addToast("🎉 Лаунчер Клик Клан успешно открыт!");
                    }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer uppercase tracking-widest border-none outline-none flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(46,203,113,0.3)] animate-pulse font-sans"
                  >
                    🎮 ЗАПУСТИТЬ ИГРУ ИЗ ЛАУНЧЕРА
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLauncherModalStep("canceled");
                        addToast("❌ Установка лаунчера отменена");
                      }}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-gray-400 text-[10px] font-bold rounded-xl cursor-pointer border-none outline-none font-sans"
                    >
                      Прервать установку
                    </button>
                  </div>
                )}
              </div>
            )}

            {launcherModalStep === "success" && (
              <div className="flex flex-col gap-3 py-2 text-center animate-fade-in">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 text-2xl mb-1 animate-bounce">
                  ✅
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Установка успешно завершена!</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                  Поздравляем с переходом на ПК версию! На вашем Рабочем Столе создана иконка запуска <strong className="text-amber-400">ИГРА КЛИКЕР</strong>. Теперь вы можете заходить в игру в один клик.
                </p>
                <button 
                  type="button" 
                  onClick={() => setIsLauncherModalOpen(false)} 
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl cursor-pointer transition-colors border-none outline-none uppercase tracking-wide mt-2"
                >
                  Закрыть окно
                </button>
              </div>
            )}

            {launcherModalStep === "canceled" && (
              <div className="flex flex-col gap-3 py-2 text-center animate-fade-in">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 text-2xl mb-1">
                  ❌
                </div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">Установка отклонена</h4>
                <p className="text-[10px] text-gray-400 leading-relaxed font-semibold">
                  Вы отклонили установку лаунчера. Вы всегда можете передумать и скачать ПК версию позже в разделе настроек.
                </p>
                <button 
                  type="button" 
                  onClick={() => setIsLauncherModalOpen(false)} 
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl cursor-pointer transition-colors border-none outline-none uppercase tracking-wide mt-2"
                >
                  Закрыть окно
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Custom confirmModal overlay */}
      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-4 z-[5000] backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            className="w-full max-w-[320px] bg-[#162239] border border-amber-500/30 rounded-[24px] p-6 text-center shadow-2xl relative font-sans flex flex-col gap-4 text-white"
          >
            <span className="text-3xl mx-auto animate-bounce">⚠️</span>
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">{confirmModal.title}</h3>
            <p className="text-[11px] text-gray-300 leading-relaxed font-semibold">{confirmModal.message}</p>
            <div className="flex gap-2.5 mt-2">
              <button 
                type="button" 
                onClick={() => setConfirmModal(null)} 
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-gray-400 text-xs font-bold rounded-xl cursor-pointer transition-colors border-none outline-none"
              >
                {confirmModal.cancelText || "Отмена"}
              </button>
              <button 
                type="button" 
                onClick={confirmModal.onConfirm} 
                className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-all uppercase tracking-wider border-none outline-none"
              >
                {confirmModal.confirmText || "Да"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isAdminLoginModalOpen && (
        <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-4 z-[5000] backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            className="w-full max-w-sm bg-[#162239] border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative flex flex-col gap-4 text-white"
          >
            <h3 className="text-sm font-black uppercase text-amber-500 text-center tracking-widest">Доступ Администратора</h3>
            <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest">Введите секретный код</p>
            <input 
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              autoFocus
              className="w-full py-3 px-4 bg-slate-900 border border-slate-700 rounded-xl text-center font-mono text-xl tracking-[0.2em] outline-none focus:border-amber-500 transition-colors"
              placeholder="******"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setIsAdminLoginModalOpen(false)}
                className="flex-1 py-3 text-xs bg-slate-800 hover:bg-slate-700 text-gray-400 rounded-xl cursor-pointer"
              >
                Отмена
              </button>
              <button 
                onClick={() => {
                  if (adminCode === "admin123") {
                    setIsAdminLoginModalOpen(false);
                    setIsAdminConsoleOpen(true);
                    setAdminCode("");
                  } else {
                    addToast("Неверный код доступа!");
                    setAdminCode("");
                  }
                }}
                className="flex-1 py-3 text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl cursor-pointer"
              >
                Войти
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isAdminConsoleOpen && (
        <AdminConsole onClose={() => setIsAdminConsoleOpen(false)} addToast={addToast} />
      )}

      {/* Account Selector Modal */}
      {isAccountSelectorOpen && (
        <div className="fixed inset-0 bg-black/92 flex items-center justify-center p-4 z-[4500] backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            className="w-full max-w-[340px] bg-[#162239] border border-amber-500/30 rounded-[24px] p-5 shadow-2xl relative font-sans flex flex-col gap-4 text-white max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500 text-sm">👤</span>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">Сохраненные аккаунты</span>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAccountSelectorOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 hover:text-white flex items-center justify-center text-gray-400 border-none outline-none cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* List of accounts */}
            <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 flex-1">
              {savedAccounts.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center gap-2">
                  <span className="text-3xl text-gray-600">📭</span>
                  <p className="text-[11px] text-gray-400 font-semibold leading-relaxed">
                    На этом устройстве пока нет сохраненных аккаунтов. Войдите сначала через Telegram или Google, чтобы профиль сохранился!
                  </p>
                </div>
              ) : (
                savedAccounts
                  .slice()
                  .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))
                  .map((account) => (
                    <div 
                      key={account.uid}
                      className="group flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-amber-500/20 rounded-xl transition-all relative overflow-hidden"
                    >
                      {/* Left side: Avatar + info */}
                      <div 
                        onClick={() => handleSelectSavedAccount(account)}
                        className="flex items-center gap-3 flex-1 cursor-pointer select-none py-1"
                      >
                        <div className="relative">
                          {account.photoURL ? (
                            <img 
                              src={account.photoURL} 
                              alt={account.displayName} 
                              className="w-10 h-10 rounded-xl object-cover border border-white/10"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/20 flex items-center justify-center text-sm font-black text-amber-400 font-mono">
                              {account.displayName ? account.displayName.slice(0, 2).toUpperCase() : "👤"}
                            </div>
                          )}
                          <span className={`absolute -bottom-1 -right-1 text-[8px] font-black px-1 rounded-md text-white font-mono uppercase border border-[#162239] ${
                            account.type === "telegram" ? "bg-[#2481cc]" : (account.type === "vk" ? "bg-[#0077ff]" : "bg-[#ea4335]")
                          }`}>
                            {account.type === "telegram" ? "TG" : (account.type === "vk" ? "VK" : "G")}
                          </span>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-gray-100 group-hover:text-amber-400 transition-colors truncate max-w-[130px]">
                            {account.displayName}
                          </span>
                          <span className="text-[9.5px] font-bold font-mono text-emerald-400">
                            💰 {account.coins?.toLocaleString() || 0} 🪙
                          </span>
                        </div>
                      </div>

                      {/* Right side: Forget account button */}
                      <button 
                        type="button"
                        onClick={() => deleteSavedAccountFromList(account.uid)}
                        className="p-2 hover:bg-rose-500/10 rounded-lg text-gray-500 hover:text-rose-400 transition-all border-none outline-none cursor-pointer"
                        title="Забыть аккаунт"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Footer switcher status */}
            {isAccountSwitching && (
              <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-amber-400 font-bold font-mono animate-pulse">
                <span className="inline-block w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
                ВЫПОЛНЯЕТСЯ ВХОД...
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Toast notifications container */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[4000] max-w-xs w-full pointer-events-none px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div 
              key={toast.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-emerald-600 text-white font-bold text-xs py-3.5 px-5 rounded-[20px] shadow-xl text-center border border-emerald-400/20 backdrop-blur-md"
            >
              {toast.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
