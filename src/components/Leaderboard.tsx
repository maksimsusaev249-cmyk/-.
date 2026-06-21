import React, { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Trophy, RefreshCw, Shield, Zap } from "lucide-react";

interface LeaderboardPlayer {
  id: string;
  playerName: string;
  totalClicks: number;
  playerClan?: string | null;
  coins?: number;
  telegramUsername?: string;
  telegramPhotoUrl?: string;
}

interface LeaderboardProps {
  currentUserId: string | null;
  addToast: (msg: string) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ currentUserId, addToast }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "users"),
        orderBy("totalClicks", "desc"),
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      const playersList: LeaderboardPlayer[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        playersList.push({
          id: doc.id,
          playerName: data.playerName || "Безымянный Игрок",
          totalClicks: typeof data.totalClicks === "number" ? data.totalClicks : 0,
          playerClan: data.playerClan || null,
          coins: typeof data.coins === "number" ? data.coins : 0,
          telegramUsername: data.telegramUsername || undefined,
          telegramPhotoUrl: data.telegramPhotoUrl || undefined,
        });
      });
      setLeaderboard(playersList);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
      setError("Не удалось загрузить рейтинг игроков.");
      addToast("⚠️ Ошибка загрузки таблицы лидеров.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-2xl">👑</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-slate-400 font-mono text-sm font-bold w-6 text-center">#{rank}</span>;
  };

  return (
    <div className="flex flex-col h-full gap-3 font-sans text-white">
      {/* Banner / Header */}
      <div className="bg-[#162239] border border-white/5 rounded-2xl p-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/15">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-black text-amber-300">Таблица Лидеров</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Топ-10 кликеров по кликам</p>
          </div>
        </div>

        <button
          onClick={fetchLeaderboard}
          disabled={isLoading}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-gray-300 rounded-xl transition-all border border-white/5 cursor-pointer disabled:opacity-50"
          title="Обновить"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-amber-400" : ""}`} />
        </button>
      </div>

      {/* Leaderboard content */}
      <div className="flex-1 overflow-y-auto max-h-[55vh] flex flex-col gap-2 pr-1">
        {isLoading && leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
            <span className="text-xs font-semibold">Загрузка рейтинга...</span>
          </div>
        ) : error ? (
          <div className="text-center text-rose-300 bg-rose-550/10 border border-rose-500/20 py-8 px-4 rounded-xl text-xs font-semibold">
            {error}
            <button 
              onClick={fetchLeaderboard}
              className="mt-3 block mx-auto px-4 py-1.5 bg-rose-600 text-white rounded-lg cursor-pointer hover:bg-rose-500 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            Таблица лидеров пуста. Будьте первым!
          </div>
        ) : (
          leaderboard.map((player, idx) => {
            const isSelf = player.id === currentUserId;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                  isSelf
                    ? "bg-amber-600/15 border-amber-500/40 shadow-inner"
                    : "bg-[#162239]/80 border-white/5 hover:border-white/10"
                }`}
              >
                {/* Left side: Rank + Nickname */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 flex justify-center items-center shrink-0">
                    {getRankBadge(idx + 1)}
                  </div>
                  
                  {/* Telegram Avatar picture */}
                  {player.telegramPhotoUrl ? (
                    <img 
                      src={player.telegramPhotoUrl} 
                      alt="TG Avatar" 
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full border border-sky-400/30 shrink-0 shadow" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                      {player.playerName.charAt(0)}
                    </div>
                  )}

                  <div className="flex flex-col min-w-0 flex-1">
                    <span 
                      className={`text-sm font-extrabold truncate flex items-center gap-1.5 ${
                        isSelf ? "text-amber-300" : "text-slate-100"
                      }`}
                    >
                      {player.playerName}
                      {isSelf && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider scale-95 origin-left shrink-0">
                          Вы
                        </span>
                      )}
                    </span>
                    
                    {/* Clan of user & Telegram Link badge */}
                    <div className="flex items-center gap-2 mt-0.5 min-w-0 flex-wrap">
                      {player.playerClan ? (
                        <span className="text-[10px] text-blue-400 font-extrabold tracking-wide flex items-center gap-1 min-w-0 truncate">
                          <Shield className="w-3 h-3 text-blue-400 shrink-0" /> {player.playerClan}
                        </span>
                      ) : (
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                          Без клана
                        </span>
                      )}
                      
                      {player.telegramUsername && (
                        <span className="text-[9px] text-sky-400 font-bold truncate">
                          @{player.telegramUsername}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Click score */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-sm font-black text-amber-400 flex items-center gap-1 font-mono">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    {player.totalClicks.toLocaleString()}
                  </span>
                  {player.coins !== undefined && player.coins > 0 && (
                    <span className="text-[10px] text-emerald-400 font-semibold font-mono mt-0.5">
                      {Math.floor(player.coins).toLocaleString()} 💰
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
