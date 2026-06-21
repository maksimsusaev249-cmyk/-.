import React, { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc, deleteDoc, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../utils/firebaseUtils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, BarChart, Bar, Cell, Legend } from "recharts";
import { Users, LayoutDashboard, Settings2, Trash2, ShieldAlert, Award, ArrowLeft, MessageSquare, Store, CheckCircle, Clock, Send, AlertCircle, RefreshCw } from "lucide-react";

interface AdminConsoleProps {
  onClose: () => void;
  addToast: (msg: string) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onClose, addToast }) => {
  const [activeTab, setActiveTab] = useState<"dashboard" | "players" | "actions" | "support" | "store">("dashboard");
  const [players, setPlayers] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Support section UI states
  const [supportFilter, setSupportFilter] = useState<"all" | "open" | "closed">("open");
  const [replyTexts, setReplyTexts] = useState<{ [ticketId: string]: string }>({});
  const [sendingReplies, setSendingReplies] = useState<{ [ticketId: string]: boolean }>({});

  // Player deep-dive analysis states
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [editCoinsAmount, setEditCoinsAmount] = useState<string>("");
  const [editClanName, setEditClanName] = useState<string>("");
  const [editAutoClickerLevel, setEditAutoClickerLevel] = useState<string>("");
  const [editMultiClickLevel, setEditMultiClickLevel] = useState<string>("");

  // Confirmation modal state to support non-blocking actions inside sandboxed iframes
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Load Players from DB
  const fetchPlayers = async () => {
    setIsLoading(true);
    try {
      let snap;
      try {
        snap = await getDocs(collection(db, "users"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "users");
        return;
      }
      const pData: any[] = [];
      snap.forEach((d) => {
        pData.push({ id: d.id, ...d.data() });
      });
      pData.sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0));
      setPlayers(pData);

      // fetch support tickets
      let supportSnap;
      try {
        supportSnap = await getDocs(collection(db, "support_tickets"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "support_tickets");
        return;
      }
      const tData: any[] = [];
      supportSnap.forEach((d) => {
        tData.push({ id: d.id, ...d.data() });
      });
      tData.sort((a, b) => {
        const timeA = b.createdAt?.toMillis ? b.createdAt.toMillis() : (Number(b.createdAt) || 0);
        const timeB = a.createdAt?.toMillis ? a.createdAt.toMillis() : (Number(a.createdAt) || 0);
        return timeA - timeB;
      });
      setSupportTickets(tData);

      // fetch marketplace
      let marketSnap;
      try {
        marketSnap = await getDocs(collection(db, "marketplace"));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, "marketplace");
        return;
      }
      const mData: any[] = [];
      marketSnap.forEach((d) => {
        mData.push({ id: d.id, ...d.data() });
      });
      mData.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now()) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now()));
      setMarketplaceListings(mData);

    } catch (e) {
      console.error(e);
      addToast("Ошибка загрузки данных администрирования.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupportReply = async (ticketId: string, chatIdOrTelegramId: number, replyText: string) => {
    if (!replyText.trim()) return;
    setSendingReplies(prev => ({ ...prev, [ticketId]: true }));
    try {
      const res = await fetch("/api/support-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatIdOrTelegramId, message: replyText })
      });
      if (res.ok) {
        try {
          await updateDoc(doc(db, "support_tickets", ticketId), {
            status: "closed",
            isRead: true,
            adminReply: replyText,
            answeredAt: serverTimestamp()
          });
        } catch (dbErr) {
          handleFirestoreError(dbErr, OperationType.UPDATE, `support_tickets/${ticketId}`);
        }
        addToast("Ответ успешно отправлен пользователю!");
        setReplyTexts(prev => {
          const updated = { ...prev };
          delete updated[ticketId];
          return updated;
        });
      } else {
        const errorData = await res.json().catch(() => ({}));
        addToast(`Ошибка отправки сообщения (API): ${errorData.error || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      addToast("Ошибка сети при отправке ответа");
    } finally {
      setSendingReplies(prev => ({ ...prev, [ticketId]: false }));
    }
  };

  const handleToggleTicketStatus = async (ticketId: string, currentStatus: string) => {
    try {
      const targetStatus = currentStatus === "open" ? "closed" : "open";
      await updateDoc(doc(db, "support_tickets", ticketId), {
        status: targetStatus
      });
      addToast(`Статус обращения изменен на ${targetStatus === "open" ? "Открыто" : "Закрыто"}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `support_tickets/${ticketId}`);
      addToast("Ошибка при изменении статуса");
    }
  };

  const handleDeleteTicket = (ticketId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Удалить обращение",
      message: "Вы уверены, что хотите удалить это обращение навсегда из базы данных?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "support_tickets", ticketId));
          addToast("Обращение успешно удалено");
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `support_tickets/${ticketId}`);
          addToast("Ошибка при удалении обращения");
        }
      }
    });
  };

  const handleDeleteListing = (listingId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Удалить предмет",
      message: "Вы уверены, что хотите удалить этот предмет из магазина навсегда (документ будет уделён)?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "marketplace", listingId));
          addToast("Предмет удален из маркета");
          fetchPlayers();
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `marketplace/${listingId}`);
          addToast("Ошибка удаления предмета");
        }
      }
    });
  };

  const [newStoreItemTitle, setNewStoreItemTitle] = useState("");
  const [newStoreItemPrice, setNewStoreItemPrice] = useState("");

  const handleCreateListing = async () => {
    if (!newStoreItemTitle || !newStoreItemPrice) return;
    try {
      const listingData = {
        title: newStoreItemTitle,
        description: "Официальный предмет Администрации. Владение им – гордость!",
        price: Number(newStoreItemPrice),
        itemImage: "custom",
        customImg: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
        sellerId: "admin",
        sellerName: "АДМИНИСТРАТОР",
        status: "active",
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "marketplace"), listingData);
      addToast("Официальный лот добавлен на рынок!");
      setNewStoreItemTitle("");
      setNewStoreItemPrice("");
      fetchPlayers();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "marketplace");
      addToast("Ошибка добавления лота");
    }
  };

  useEffect(() => {
    // Setup real-time listeners so we don't even have to press refresh!
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const pData: any[] = [];
      snap.forEach((d) => {
        pData.push({ id: d.id, ...d.data() });
      });
      pData.sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0));
      setPlayers(pData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    const unsubTickets = onSnapshot(collection(db, "support_tickets"), (snap) => {
      const tData: any[] = [];
      snap.forEach((d) => {
        tData.push({ id: d.id, ...d.data() });
      });
      tData.sort((a, b) => {
        const timeA = b.createdAt?.toMillis ? b.createdAt.toMillis() : (Number(b.createdAt) || 0);
        const timeB = a.createdAt?.toMillis ? a.createdAt.toMillis() : (Number(a.createdAt) || 0);
        return timeA - timeB;
      });
      setSupportTickets(tData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "support_tickets");
    });

    const unsubMarket = onSnapshot(collection(db, "marketplace"), (snap) => {
      const mData: any[] = [];
      snap.forEach((d) => {
        mData.push({ id: d.id, ...d.data() });
      });
      mData.sort((a, b) => {
        const timeA = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || Date.now());
        const timeB = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || Date.now());
        return timeA - timeB;
      });
      setMarketplaceListings(mData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "marketplace");
    });

    // Also run initial fetch to be safe
    fetchPlayers();

    return () => {
      unsubUsers();
      unsubTickets();
      unsubMarket();
    };
  }, []);

  // Stats
  const totalPlayers = players.length;
  const totalCoinsInEconomy = players.reduce((acc, p) => acc + (p.coins || 0), 0);
  const totalClicksAcrossPlayers = players.reduce((acc, p) => acc + (p.totalClicks || 0), 0);

  // Mock Graph Data generated from players
  const activityData = [
    { name: "Пн", activity: Math.floor(totalClicksAcrossPlayers * 0.1) },
    { name: "Вт", activity: Math.floor(totalClicksAcrossPlayers * 0.15) },
    { name: "Ср", activity: Math.floor(totalClicksAcrossPlayers * 0.2) },
    { name: "Чт", activity: Math.floor(totalClicksAcrossPlayers * 0.12) },
    { name: "Пт", activity: Math.floor(totalClicksAcrossPlayers * 0.3) },
    { name: "Сб", activity: Math.floor(totalClicksAcrossPlayers * 0.05) },
    { name: "Вс", activity: Math.floor(totalClicksAcrossPlayers * 0.08) },
  ];

  // Clan Stats Aggregation
  const clansStats = React.useMemo(() => {
    const map: { [clanName: string]: { name: string; memberCount: number; totalCoins: number; totalClicks: number } } = {};
    players.forEach(p => {
      if (p.clan) {
        const cName = p.clan.trim();
        if (cName) {
          if (!map[cName]) {
            map[cName] = { name: cName, memberCount: 0, totalCoins: 0, totalClicks: 0 };
          }
          map[cName].memberCount += 1;
          map[cName].totalCoins += (p.coins || 0);
          map[cName].totalClicks += (p.totalClicks || 0);
        }
      }
    });
    return Object.values(map).sort((a, b) => b.memberCount - a.memberCount);
  }, [players]);

  const totalClans = clansStats.length;

  // Top 5 Players by Coins
  const topPlayersByCoins = React.useMemo(() => {
    return [...players]
      .sort((a, b) => (b.coins || 0) - (a.coins || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.playerName || p.displayName || "Игрок",
        coins: Math.floor(p.coins || 0),
        clicks: p.totalClicks || 0,
      }));
  }, [players]);

  // Top 5 Players by Clicks
  const topPlayersByClicks = React.useMemo(() => {
    return [...players]
      .sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0))
      .slice(0, 5)
      .map(p => ({
        name: p.playerName || p.displayName || "Игрок",
        clicks: p.totalClicks || 0,
        coins: Math.floor(p.coins || 0),
      }));
  }, [players]);

  // Averages for Player Comparison
  const playerAverages = React.useMemo(() => {
    if (players.length === 0) return { coins: 0, clicks: 0, autoClicker: 0, multiClick: 0 };
    const sumCoins = players.reduce((sum, p) => sum + (p.coins || 0), 0);
    const sumClicks = players.reduce((sum, p) => sum + (p.totalClicks || 0), 0);
    const sumAuto = players.reduce((sum, p) => sum + (p.autoClickerLevel || 0), 0);
    const sumMulti = players.reduce((sum, p) => sum + (p.multiClickLevel || 0), 0);
    
    return {
      coins: Math.round(sumCoins / players.length),
      clicks: Math.round(sumClicks / players.length),
      autoClicker: parseFloat((sumAuto / players.length).toFixed(1)),
      multiClick: parseFloat((sumMulti / players.length).toFixed(1))
    };
  }, [players]);

  // Admin Actions
  const handleGiveCoins = async (id: string, amount: number) => {
    try {
      await updateDoc(doc(db, "users", id), {
        coins: amount
      });
      addToast(`Выдано ${amount} монет игроку!`);
      fetchPlayers();
    } catch (err) {
      addToast("Ошибка выдачи");
    }
  };

  const handleDeletePlayer = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Удалить игрока",
      message: "Вы уверены, что хотите удалить этого игрока из базы насовсем? Все его данные будут стерты.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, "users", id));
          addToast("Игрок удален");
          fetchPlayers();
        } catch (err) {
          addToast("Ошибка удаления");
        }
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-[#0a0f18] z-[9999] flex flex-col text-white font-sans overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="h-14 border-b border-indigo-500/20 bg-[#111827] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-indigo-400" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-500" />
            <h1 className="text-sm font-black tracking-widest text-indigo-100">КОНСОЛЬ АДМИНИСТРАТОРА</h1>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-48 bg-[#0b101c] border-r border-indigo-500/10 flex flex-col gap-1 p-3">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-none outline-none cursor-pointer ${activeTab === "dashboard" ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:bg-white/5"}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Графики
          </button>
          <button 
            onClick={() => setActiveTab("players")}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-none outline-none cursor-pointer ${activeTab === "players" ? "bg-indigo-600/20 text-indigo-400" : "text-gray-400 hover:bg-white/5"}`}
          >
            <Users className="w-4 h-4" /> Игроки
          </button>
          <button 
            onClick={() => setActiveTab("actions")}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-none outline-none cursor-pointer ${activeTab === "actions" ? "bg-rose-500/20 text-rose-400" : "text-gray-400 hover:bg-white/5"}`}
          >
            <Settings2 className="w-4 h-4" /> Управление
          </button>
          <button 
            onClick={() => setActiveTab("support")}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-none outline-none cursor-pointer ${activeTab === "support" ? "bg-amber-500/20 text-amber-400" : "text-gray-400 hover:bg-white/5"}`}
          >
            <MessageSquare className="w-4 h-4" /> Поддержка
          </button>
          <button 
            onClick={() => setActiveTab("store")}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border-none outline-none cursor-pointer ${activeTab === "store" ? "bg-amber-500/20 text-amber-400" : "text-gray-400 hover:bg-white/5"}`}
          >
            <Store className="w-4 h-4" /> Магазин
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#070b12]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-indigo-400 font-mono animate-pulse">Загрузка данных...</div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <div className="flex flex-col gap-6 animate-fade-in">
                  {/* Stat Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[#111827] border border-white/5 p-4 rounded-2xl flex flex-col gap-1">
                      <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Всего игроков</span>
                      <span className="text-2xl font-black text-indigo-400">{totalPlayers}</span>
                    </div>
                    <div className="bg-[#111827] border border-white/5 p-4 rounded-2xl flex flex-col gap-1">
                      <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Экономика (Монеты)</span>
                      <span className="text-2xl font-black text-amber-400">{totalCoinsInEconomy.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#111827] border border-white/5 p-4 rounded-2xl flex flex-col gap-1">
                      <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Всего кликов</span>
                      <span className="text-2xl font-black text-emerald-400">{totalClicksAcrossPlayers.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#111827] border border-white/5 p-4 rounded-2xl flex flex-col gap-1">
                      <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Всего кланов</span>
                      <span className="text-2xl font-black text-[#e67e22]">{totalClans}</span>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col gap-4 h-[300px]">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest">Активность игроков (синтетическая)</h3>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activityData}>
                          <defs>
                            <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                          <XAxis dataKey="name" stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="activity" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorAct)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Clans Statistics / Charts & Table */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Clan Members Chart */}
                    <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col gap-4 h-[350px]">
                      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                        🏰 ЧИСЛЕННОСТЬ КЛАНОВ (ИГРОКОВ В КАЖДОМ КЛАНЕ)
                      </h3>
                      {totalClans === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-medium text-xs font-mono">
                          Нет активных кланов для отображения
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={clansStats} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                              <XAxis dataKey="name" stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis stroke="#718096" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1a202c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                labelStyle={{ color: '#f39c12', fontWeight: 'bold' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '10px' }} />
                              <Bar name="Количество игроков" dataKey="memberCount" radius={[6, 6, 0, 0]}>
                                {clansStats.map((entry, index) => {
                                  // Assign alternate warm amber/orange colors for the modern theme
                                  const colors = ["#e67e22", "#f39c12", "#d35400", "#f1c40f", "#e74c3c"];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Clan Economic & Clicks Power Table/Summary */}
                    <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col gap-4 h-[350px] overflow-hidden">
                      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                        ⭐ АНАЛИТИКА АКТИВНОСТИ КЛАНОВ
                      </h3>
                      {totalClans === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-medium text-xs font-mono">
                          Здесь появится список кланов при их создании
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto">
                          <table className="w-full text-left text-xs text-gray-300">
                            <thead className="bg-[#1f2937] text-gray-400 uppercase font-bold sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-[10px]">Клан</th>
                                <th className="px-3 py-2 text-[10px] text-center">Игроков</th>
                                <th className="px-3 py-2 text-[10px] text-right">Баланс</th>
                                <th className="px-3 py-2 text-[10px] text-right">Клики</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                              {clansStats.map((c) => (
                                <tr key={c.name} className="hover:bg-white/5 transition-colors">
                                  <td className="px-3 py-2.5 font-bold text-slate-200">🏰 {c.name}</td>
                                  <td className="px-3 py-2.5 text-center font-semibold text-amber-400">{c.memberCount} чел.</td>
                                  <td className="px-3 py-2.5 text-right font-mono text-emerald-400">{Math.floor(c.totalCoins).toLocaleString()}</td>
                                  <td className="px-3 py-2.5 text-right font-mono text-indigo-400">{c.totalClicks.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Players Analytics Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Players by Coins */}
                    <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col gap-4 h-[350px]">
                      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                        💰 ТОП-5 ИГРОКОВ ПО БАЛАНСУ МОНЕТ
                      </h3>
                      {topPlayersByCoins.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-medium text-xs font-mono">
                          Нет игроков для отображения
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topPlayersByCoins} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                              <XAxis dataKey="name" stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1a202c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                labelStyle={{ color: '#2ecc71', fontWeight: 'bold' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '10px' }} />
                              <Bar name="Баланс монет" dataKey="coins" radius={[6, 6, 0, 0]}>
                                {topPlayersByCoins.map((entry, index) => {
                                  const colors = ["#2ecc71", "#27ae60", "#1abc9c", "#16a085", "#34495e"];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Top Players by Clicks */}
                    <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col gap-4 h-[350px]">
                      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
                        ⚡ ТОП-5 ИГРОКОВ ПО КЛИКАМ
                      </h3>
                      {topPlayersByClicks.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 font-medium text-xs font-mono">
                          Нет игроков для отображения
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topPlayersByClicks} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                              <XAxis dataKey="name" stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                              <YAxis stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1a202c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                                labelStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '10px' }} />
                              <Bar name="Количество кликов" dataKey="clicks" radius={[6, 6, 0, 0]}>
                                {topPlayersByClicks.map((entry, index) => {
                                  const colors = ["#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#475569"];
                                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                })}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "players" && (() => {
                if (selectedPlayerId) {
                  const p = players.find(x => x.id === selectedPlayerId);
                  if (!p) {
                    return (
                      <div className="flex flex-col items-center justify-center gap-4 bg-[#111827] text-gray-400 p-12 rounded-2xl border border-white/5 animate-fade-in">
                        <AlertCircle className="w-12 h-12 text-rose-500 animate-bounce" />
                        <span className="text-sm font-bold">Игрок не найден или был удален</span>
                        <button 
                          onClick={() => setSelectedPlayerId(null)} 
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer border-none outline-none transition-colors"
                        >
                          Вернуться к списку
                        </button>
                      </div>
                    );
                  }

                  // Data for individual comparison charts
                  const compData = [
                    { name: "Монеты (тыс)", "Этот игрок": Math.round((p.coins || 0) / 1000), "Все в среднем": Math.round(playerAverages.coins / 1000) },
                    { name: "Клики", "Этот игрок": p.totalClicks || 0, "Все в среднем": playerAverages.clicks },
                  ];

                  const levelData = [
                    { name: "Автокликер (ур)", "Этот игрок": p.autoClickerLevel || 0, "Все в среднем": playerAverages.autoClicker },
                    { name: "Мультиклик (ур)", "Этот игрок": p.multiClickLevel || 0, "Все в среднем": playerAverages.multiClick },
                  ];

                  const handleDirectUpdate = async (field: string, val: any) => {
                    try {
                      await updateDoc(doc(db, "users", p.id), {
                        [field]: val,
                        updatedAt: serverTimestamp()
                      });
                      addToast(`Параметр "${field}" у ${p.playerName || "игрока"} успешно обновлен!`);
                      fetchPlayers();
                    } catch (err) {
                      console.error(err);
                      addToast("Ошибка записи в Firestore.");
                    }
                  };

                  const handleDirectWipe = () => {
                    setConfirmModal({
                      isOpen: true,
                      title: "Сбросить прогресс игрока",
                      message: `Вы действительно хотите ПОЛНОСТЬЮ обнулить прогресс ${p.playerName || "игрока"}? Баланс монет станет 0, уровни улучшений сбросятся.`,
                      onConfirm: async () => {
                        try {
                          await updateDoc(doc(db, "users", p.id), {
                            coins: 0,
                            totalClicks: 0,
                            autoClickerLevel: 0,
                            multiClickLevel: 0,
                            levelItems: [],
                            updatedAt: serverTimestamp()
                          });
                          addToast("Прогресс игрока успешно сброшен!");
                          setSelectedPlayerId(null);
                          fetchPlayers();
                        } catch (err) {
                          addToast("Не удалось сбросить прогресс");
                        }
                      }
                    });
                  };

                  return (
                    <div className="flex flex-col gap-5 animate-fade-in pb-10 font-sans">
                      {/* Control Header & Back Button */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#111827] border border-white/5 p-4 rounded-2xl">
                        <div className="flex flex-col gap-1">
                          <button 
                            onClick={() => setSelectedPlayerId(null)} 
                            className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-extrabold text-xs bg-transparent border-none outline-none cursor-pointer p-0 w-fit mb-1.5 align-middle"
                          >
                            <ArrowLeft className="w-4 h-4" /> ВЕРНУТЬСЯ К СПИСКУ ИГРОКОВ
                          </button>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-base font-black text-white uppercase tracking-tight">АНАЛИЗ ИГРОКА: {p.playerName || p.displayName || "Без имени"}</h2>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">UID: {p.id}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button 
                            onClick={handleDirectWipe}
                            className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-950 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-black tracking-wider uppercase cursor-pointer"
                          >
                            ☠️ СБРОСИТЬ ПРОГРЕСС
                          </button>
                          <button 
                            onClick={() => handleDeletePlayer(p.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black tracking-wider uppercase cursor-pointer flex items-center gap-1 border-none"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> УДАЛИТЬ ИЗ БД
                          </button>
                        </div>
                      </div>

                      {/* Analytical Summary Cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-[#111827] border border-white/5 p-4 rounded-xl flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Баланс монет</span>
                          <span className="text-xl font-black text-amber-400 font-mono">{Math.floor(p.coins || 0).toLocaleString()} 💰</span>
                          <span className="text-[9px] text-gray-500 font-semibold leading-normal">
                            Ср. по серверу: {Math.floor(playerAverages.coins).toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-[#111827] border border-white/5 p-4 rounded-xl flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Всего кликов</span>
                          <span className="text-xl font-black text-indigo-400 font-mono">{(p.totalClicks || 0).toLocaleString()}</span>
                          <span className="text-[9px] text-gray-500 font-semibold leading-normal">
                            Ср. по серверу: {playerAverages.clicks.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-[#111827] border border-white/5 p-4 rounded-xl flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Состоит в Клане</span>
                          <span className="text-xl font-black text-[#e67e22] truncate">{p.clan || "БЕЗ КЛАНА"}</span>
                          <span className="text-[9px] text-gray-500 font-semibold leading-normal">
                            ID Telegram: {p.telegramId || "Не привязан"}
                          </span>
                        </div>
                        <div className="bg-[#111827] border border-white/5 p-4 rounded-xl flex flex-col gap-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Дата регистрации</span>
                          <span className="text-[11px] font-bold text-gray-300 leading-relaxed mt-1.5 truncate">
                            {p.lastLogin ? new Date(p.lastLogin).toLocaleDateString() : "Не зафиксировано"}
                          </span>
                          <span className="text-[9px] text-gray-500 font-semibold leading-normal">
                            Время: {p.lastLogin ? new Date(p.lastLogin).toLocaleTimeString() : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Visual Charts Component / Comparative Graphs */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Economic Comparative Chart */}
                        <div className="bg-[#111827] border border-white/5 p-4 rounded-2xl flex flex-col gap-3 h-[280px]">
                          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            📊 СРАВНЕНИЕ АКТИВНОСТИ И ЭКОНОМИКИ
                          </h3>
                          <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={compData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                                <XAxis dataKey="name" stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                <Bar name="Данный игрок" dataKey="Этот игрок" fill="#818cf8" radius={[4, 4, 0, 0]} />
                                <Bar name="Другие в среднем" dataKey="Все в среднем" fill="#4b5563" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Upgrades Levels Chart */}
                        <div className="bg-[#111827] border border-white/5 p-4 rounded-2xl flex flex-col gap-3 h-[280px]">
                          <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            ⚡ СРАВНЕНИЕ УРОВНЕЙ УЛУЧШЕНИЙ
                          </h3>
                          <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={levelData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                                <XAxis dataKey="name" stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#718096" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                <Bar name="Данный игрок" dataKey="Этот игрок" fill="#f39c12" radius={[4, 4, 0, 0]} />
                                <Bar name="Другие в среднем" dataKey="Все в среднем" fill="#4b5563" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Action Tool panel / Interactive Admin Modifiers for the Player */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        {/* Quick DB State Editors */}
                        <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
                          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5 text-indigo-400">
                            ⚙️ РЕДАКТИРОВАНИЕ ПОКАЗАТЕЛЕЙ ИГРОКА
                          </h3>
                          
                          {/* Item form 1: Coins */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-400 font-bold uppercase">Установить баланс монет 💰</label>
                            <div className="flex gap-2">
                              <input 
                                type="number"
                                value={editCoinsAmount}
                                onChange={(e) => setEditCoinsAmount(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-amber-400/40"
                              />
                              <button 
                                onClick={() => {
                                  const num = parseInt(editCoinsAmount);
                                  if (!isNaN(num)) {
                                    handleDirectUpdate("coins", num);
                                  } else {
                                    addToast("Введите корректное число");
                                  }
                                }}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer border-none font-sans"
                              >
                                Обновить
                              </button>
                            </div>
                            {/* Fast Presets */}
                            <div className="flex gap-1.5 mt-1">
                              <button 
                                onClick={() => {
                                  const current = p.coins || 0;
                                  handleDirectUpdate("coins", current + 10000);
                                  setEditCoinsAmount((current + 10000).toString());
                                }} 
                                className="text-[9px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md text-gray-300 font-semibold border-none cursor-pointer"
                              >
                                +10К монет
                              </button>
                              <button 
                                onClick={() => {
                                  const current = p.coins || 0;
                                  handleDirectUpdate("coins", current + 100000);
                                  setEditCoinsAmount((current + 100000).toString());
                                }} 
                                className="text-[9px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded-md text-gray-300 font-semibold border-none cursor-pointer"
                              >
                                +100К монет
                              </button>
                              <button 
                                onClick={() => {
                                  const current = Math.max(0, (p.coins || 0) - 50000);
                                  handleDirectUpdate("coins", current);
                                  setEditCoinsAmount(current.toString());
                                }} 
                                className="text-[9px] bg-rose-950/20 hover:bg-rose-955/40 px-2 py-1 rounded-md text-rose-400 border border-rose-500/10 cursor-pointer"
                              >
                                -50К монет
                              </button>
                            </div>
                          </div>

                          {/* Item form 2: Clan */}
                          <div className="flex flex-col gap-1 mt-2">
                            <label className="text-[10px] text-gray-400 font-bold uppercase">Установить Клан 🏰</label>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                placeholder="Введите название клана или пустоту"
                                value={editClanName}
                                onChange={(e) => setEditClanName(e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none focus:border-[#e67e22]/40"
                              />
                              <button 
                                onClick={() => {
                                  const cleanName = editClanName.trim();
                                  handleDirectUpdate("clan", cleanName || null);
                                }}
                                className="px-4 py-2 bg-[#e67e22] hover:bg-[#d35400] text-white text-xs font-black rounded-xl cursor-pointer border-none font-sans"
                              >
                                Обновить
                              </button>
                            </div>
                            {p.clan && (
                              <button 
                                onClick={() => {
                                  handleDirectUpdate("clan", null);
                                  setEditClanName("");
                                }}
                                className="text-[9px] text-rose-400 bg-transparent border-none outline-none text-left cursor-pointer hover:underline font-bold w-fit mt-1"
                              >
                                Выгнать игрока из текущего клана насовсем
                              </button>
                            )}
                          </div>

                          {/* Item form 3: Levels */}
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-gray-400 font-bold uppercase">Автокликер (Ур.) 🤖</label>
                              <div className="flex gap-1.5">
                                <input 
                                  type="number"
                                  value={editAutoClickerLevel}
                                  onChange={(e) => setEditAutoClickerLevel(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs font-bold text-white outline-none"
                                />
                                <button 
                                  onClick={() => {
                                    const num = parseInt(editAutoClickerLevel);
                                    if (!isNaN(num)) handleDirectUpdate("autoClickerLevel", num);
                                  }}
                                  className="px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg border-none cursor-pointer"
                                >
                                  OK
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] text-gray-400 font-bold uppercase">Мультиклик (Ур.) 🖱️</label>
                              <div className="flex gap-1.5">
                                <input 
                                  type="number"
                                  value={editMultiClickLevel}
                                  onChange={(e) => setEditMultiClickLevel(e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs font-bold text-white outline-none"
                                />
                                <button 
                                  onClick={() => {
                                    const num = parseInt(editMultiClickLevel);
                                    if (!isNaN(num)) handleDirectUpdate("multiClickLevel", num);
                                  }}
                                  className="px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg border-none cursor-pointer"
                                >
                                  OK
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Player Inventory Log */}
                        <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col gap-3">
                          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-1.5 text-indigo-400 font-sans">
                            🗡️ КУПЛЕННОЕ СНАРЯЖЕНИЕ И ПРЕДМЕТЫ ({p.levelItems?.length || 0})
                          </h3>
                          
                          {(!p.levelItems || p.levelItems.length === 0) ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-1.5 p-6 bg-slate-950/30 rounded-xl border border-white/5">
                              <Store className="w-8 h-8 text-slate-700" />
                              <span className="text-[11px] font-mono">Активное снаряжение отсутствует</span>
                            </div>
                          ) : (
                            <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 flex flex-col gap-2">
                              {p.levelItems.map((item: any, index: number) => {
                                return (
                                  <div key={index} className="bg-slate-950 p-2.5 rounded-xl border border-white/5 flex items-center justify-between font-mono text-[10.5px]">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">🗡️</span>
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-200">{item.title || item.name || "Предмет"}</span>
                                        <span className="text-[8.5px] text-gray-500">ID: {item.id || "N/A"}</span>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 text-right items-center">
                                      <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                        {item.autoClickBonus ? `+${item.autoClickBonus} 💰/сек` : `Бонус: ${item.damage || 1}`}
                                      </span>
                                      <button 
                                        onClick={() => {
                                          const filteredItems = p.levelItems.filter((_: any, i: number) => i !== index);
                                          handleDirectUpdate("levelItems", filteredItems);
                                        }}
                                        title="Изъять предмет"
                                        className="p-1 text-rose-400/60 hover:text-rose-400 bg-transparent border-none cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                }

                // Default players list table representation
                return (
                  <div className="flex flex-col gap-4 animate-fade-in font-sans">
                    <div className="flex justify-between items-center bg-[#111827] p-4 rounded-2xl border border-white/5">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">База данных игроков</h3>
                      <p className="text-[11px] text-gray-400 font-medium">
                        Обнаружено: <strong className="text-indigo-400">{players.length} игроков</strong>. Кликните для глубокого анализа
                      </p>
                    </div>

                    <div className="overflow-x-auto bg-[#111827] border border-white/5 rounded-2xl">
                      <table className="w-full text-left text-xs text-gray-300">
                        <thead className="bg-[#1f2937] text-gray-400 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-4 py-3">ID / Telegram</th>
                            <th className="px-4 py-3">Имя</th>
                            <th className="px-4 py-3">Баланс</th>
                            <th className="px-4 py-3">Клики</th>
                            <th className="px-4 py-3">Клан</th>
                            <th className="px-4 py-3 text-center">Действия</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {players.map(p => (
                            <tr key={p.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 font-mono text-[10px] text-gray-500">
                                {p.id.substring(0, 8)}...<br/>
                                {p.telegramId && <span className="text-[#3b82f6]">TG: {p.telegramId}</span>}
                              </td>
                              <td className="px-4 py-3 font-bold text-white">
                                <button 
                                  onClick={() => {
                                    setSelectedPlayerId(p.id);
                                    setEditCoinsAmount(Math.floor(p.coins || 0).toString());
                                    setEditClanName(p.clan || "");
                                    setEditAutoClickerLevel((p.autoClickerLevel || 0).toString());
                                    setEditMultiClickLevel((p.multiClickLevel || 0).toString());
                                  }}
                                  className="text-left font-bold text-white hover:text-indigo-400 transition-colors bg-transparent border-none outline-none cursor-pointer p-0 font-sans"
                                >
                                  {p.playerName || p.displayName || "Игрок"}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-amber-400 font-bold">{Math.floor(p.coins || 0).toLocaleString()} 💰</td>
                              <td className="px-4 py-3 font-mono">{p.totalClicks || 0}</td>
                              <td className="px-4 py-3 truncate max-w-[120px]">{p.clan || "—"}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => {
                                    setSelectedPlayerId(p.id);
                                    setEditCoinsAmount(Math.floor(p.coins || 0).toString());
                                    setEditClanName(p.clan || "");
                                    setEditAutoClickerLevel((p.autoClickerLevel || 0).toString());
                                    setEditMultiClickLevel((p.multiClickLevel || 0).toString());
                                  }}
                                  className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-[10px] font-black rounded-lg cursor-pointer transition-colors border-none uppercase tracking-wide py-1.5"
                                >
                                  Анализ 📊
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {activeTab === "actions" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                  {players.map(p => (
                    <div key={p.id} className="bg-[#111827] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="font-bold text-white uppercase">{p.playerName || "Игрок"}</span>
                          <span className="text-[10px] text-gray-500 font-mono">{p.id}</span>
                        </div>
                        <span className="bg-amber-500/20 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md">Баланс: {Math.floor(p.coins||0)}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleGiveCoins(p.id, (p.coins || 0) + 100000)}
                          className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border-none outline-none"
                        >
                          + 100K 💰
                        </button>
                        <button 
                          onClick={() => handleGiveCoins(p.id, 0)}
                          className="flex-1 py-2 bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer border-none outline-none"
                        >
                          Обнулить 💸
                        </button>
                        <button 
                          onClick={() => handleDeletePlayer(p.id)}
                          className="w-10 flex items-center justify-center bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg transition-colors cursor-pointer border-none outline-none"
                          title="Удалить насовсем"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "support" && (() => {
                const openCount = supportTickets.filter(t => t.status === "open" || !t.status).length;
                const closedCount = supportTickets.filter(t => t.status === "closed").length;
                const totalCount = supportTickets.length;

                const filteredTickets = supportTickets.filter(t => {
                  const status = t.status || "open";
                  if (supportFilter === "open") return status === "open";
                  if (supportFilter === "closed") return status === "closed";
                  return true;
                });

                return (
                  <div className="flex flex-col gap-6 animate-fade-in pb-12">
                    {/* Header with Stats & Actions */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111827] border border-white/5 p-4 rounded-2xl">
                      <div className="flex flex-col gap-1">
                        <h2 className="text-sm font-black text-indigo-400 tracking-wider uppercase flex items-center gap-2">
                          <MessageSquare className="w-5 h-5 text-indigo-400" />
                          Панель Поддержки
                        </h2>
                        <p className="text-xs text-gray-400">Управление обращениями пользователей через бота (команда /support)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={fetchPlayers} 
                          disabled={isLoading}
                          className="flex items-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-50 px-3 py-2 rounded-xl text-white font-bold transition-all cursor-pointer border border-white/10"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isLoading ? "animate-spin" : ""}`} />
                          <span>Обновить список</span>
                        </button>
                      </div>
                    </div>

                    {/* Stats counters */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button 
                        onClick={() => setSupportFilter("open")}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 select-none outline-none ${supportFilter === "open" ? "bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/25" : "bg-[#111827] border-white/5 hover:border-white/10"}`}
                      >
                        <div className="flex items-center justify-between text-rose-400">
                          <span className="text-[10px] font-bold uppercase tracking-wider">Ожидают ответа</span>
                          <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-2xl font-black text-rose-400 mt-1">{openCount}</span>
                      </button>

                      <button 
                        onClick={() => setSupportFilter("closed")}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 select-none outline-none ${supportFilter === "closed" ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/25" : "bg-[#111827] border-white/5 hover:border-white/10"}`}
                      >
                        <div className="flex items-center justify-between text-emerald-400">
                          <span className="text-[10px] font-bold uppercase tracking-wider">Решенные тикеты</span>
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <span className="text-2xl font-black text-emerald-400 mt-1">{closedCount}</span>
                      </button>

                      <button 
                        onClick={() => setSupportFilter("all")}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 select-none outline-none ${supportFilter === "all" ? "bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/25" : "bg-[#111827] border-white/5 hover:border-white/10"}`}
                      >
                        <div className="flex items-center justify-between text-indigo-400">
                          <span className="text-[10px] font-bold uppercase tracking-wider">Всего обращений</span>
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <span className="text-2xl font-black text-indigo-400 mt-1">{totalCount}</span>
                      </button>
                    </div>

                    {/* Support Tickets Queue */}
                    <div className="flex flex-col gap-4">
                      {filteredTickets.length === 0 ? (
                        <div className="bg-[#111827]/40 border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500 mb-2">
                            <CheckCircle className="w-6 h-6 text-indigo-400/50" />
                          </div>
                          <span className="text-gray-300 font-bold text-sm">Список пуст</span>
                          <span className="text-gray-500 text-xs">
                            {supportFilter === "open" ? "Все обращения успешно обработаны!" : "Информации с таким фильтром не найдено."}
                          </span>
                        </div>
                      ) : (
                        filteredTickets.map((t) => {
                          const ticketId = t.id;
                          const targetChatId = Number(t.chatId || t.telegramId);
                          const isTicketOpen = (t.status || "open") === "open";
                          const isSending = sendingReplies[ticketId] || false;
                          const replyValue = replyTexts[ticketId] || "";

                          return (
                            <div 
                              key={ticketId} 
                              className={`bg-[#111827] border rounded-2xl p-5 flex flex-col gap-4 transition-all hover:border-indigo-500/20 ${!isTicketOpen ? "opacity-75" : "shadow-lg shadow-black/10"}`}
                            >
                              {/* Card Header Info */}
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold font-mono">
                                    {(t.name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-gray-100 text-sm">{t.name || "Пользователь"}</span>
                                      {t.username && (
                                        <span className="text-xs text-indigo-400 font-mono">@{t.username}</span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-mono mt-0.5">
                                      ID: {t.telegramId || "—"} • {t.createdAt ? new Date(Number(t.createdAt)).toLocaleString() : "Неизвестная дата"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isTicketOpen ? (
                                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black tracking-wider px-2 py-1 rounded-lg uppercase">
                                      Новое
                                    </span>
                                  ) : (
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black tracking-wider px-2 py-1 rounded-lg uppercase">
                                      Решено
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Inquiry Message content */}
                              <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                {t.message || <span className="italic text-gray-500">Без текста сообщения</span>}
                              </div>

                              {/* Completed Reply Display */}
                              {!isTicketOpen && t.adminReply && (
                                <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-4 flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-400/80 uppercase tracking-widest leading-none">
                                    <span>Ваш ответ:</span>
                                    {t.answeredAt && (
                                      <span className="text-[9px] lowercase opacity-70">
                                        {t.answeredAt.toMillis ? new Date(t.answeredAt.toMillis()).toLocaleString() : "Отвечено"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-indigo-100 leading-relaxed italic whitespace-pre-wrap">
                                    {t.adminReply}
                                  </p>
                                </div>
                              )}

                              {/* Action Bar / Form Reply */}
                              <div className="h-px bg-white/5 my-1" />

                              <div className="flex flex-col gap-3">
                                {isTicketOpen ? (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex gap-2 relative items-center">
                                      <textarea 
                                        rows={2}
                                        placeholder="Напишите официальный ответ пользователю в Telegram..."
                                        value={replyValue}
                                        onChange={(e) => setReplyTexts(prev => ({ ...prev, [ticketId]: e.target.value }))}
                                        disabled={isSending || !targetChatId}
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-500 font-sans outline-none focus:border-indigo-500/50 resize-none transition-colors"
                                      />
                                    </div>
                                    <div className="flex justify-between items-center gap-2 mt-1">
                                      <div className="text-[10px] text-gray-500">
                                        {!targetChatId && (
                                          <span className="text-rose-400 font-mono">⚠️ Чат ID отсутствует! Ответ в бота невозможен.</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          onClick={() => handleToggleTicketStatus(ticketId, "open")}
                                          className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/10"
                                        >
                                          Mark Solved
                                        </button>
                                        <button
                                          onClick={() => handleSupportReply(ticketId, targetChatId, replyValue)}
                                          disabled={isSending || !replyValue.trim() || !targetChatId}
                                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold rounded-xl cursor-pointer text-xs flex items-center gap-2 transition-all active:scale-95 border-none outline-none"
                                        >
                                          {isSending ? (
                                            <>
                                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                              <span>Отправка...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Send className="w-3.5 h-3.5" />
                                              <span>Отправить ответ</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500">Обращение решено. Вы можете переоткрыть его при необходимости.</span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleToggleTicketStatus(ticketId, "closed")}
                                        className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg font-bold transition-colors cursor-pointer border border-indigo-500/10 text-[11px]"
                                      >
                                        Открыть повторно
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTicket(ticketId)}
                                        className="w-8 h-8 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer border border-rose-500/10 text-[11px]"
                                        title="Удалить навсегда"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              {activeTab === "store" && (
                <div className="flex flex-col gap-6 animate-fade-in pb-10">
                  <div className="bg-[#111827] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                    <h2 className="text-sm font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                      <Store className="w-5 h-5" /> 
                      Добавить Официальный Лот
                    </h2>
                    <p className="text-xs text-gray-400">Предмет будет продаваться от имени "АДМИНИСТРАТОР".</p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Название лота (например: Корона Создателя)"
                        value={newStoreItemTitle}
                        onChange={(e) => setNewStoreItemTitle(e.target.value)}
                        className="flex-[2] bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-sans outline-none focus:border-amber-500"
                      />
                      <input 
                        type="number"
                        placeholder="Цена (коины)"
                        value={newStoreItemPrice}
                        onChange={(e) => setNewStoreItemPrice(e.target.value)}
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-sans outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={handleCreateListing}
                        className="px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl cursor-pointer text-xs"
                      >
                        Запостить
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-black text-white/50 tracking-widest uppercase mb-1">Все лоты на рынке</h2>
                    {marketplaceListings.length === 0 ? (
                      <div className="text-gray-500 font-mono text-center mt-5">Рынок пуст</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {marketplaceListings.map((l) => (
                          <div key={l.id} className="bg-[#111827] border border-white/5 rounded-xl p-3 flex justify-between items-center group hover:border-white/10 transition-colors">
                            <div className="flex flex-col min-w-0 pr-4">
                              <span className="font-bold text-[#75c6ff] text-sm truncate">{l.title}</span>
                              <div className="flex items-center gap-2 text-xs font-mono mt-1">
                                <span className="text-amber-400">{Number(l.price).toLocaleString()} 💰</span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-400 truncate">Продавец: {l.sellerName || "—"}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteListing(l.id)}
                              className="w-10 h-10 flex shrink-0 items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg cursor-pointer border-none outline-none transition-colors border border-rose-500/20"
                              title="Удалить лот (без возврата)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {confirmModal && confirmModal.isOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-white/10 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 shadow-2xl relative animate-scale-up">
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">{confirmModal.title}</h3>
            <p className="text-xs text-gray-300 leading-relaxed font-semibold">{confirmModal.message}</p>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-white/10"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none"
              >
                Да, продолжить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
