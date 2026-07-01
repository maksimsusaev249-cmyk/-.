const fs = require('fs');

const content = fs.readFileSync('src/App.tsx', 'utf8');

const startStr = "  const renderSettingsContent = () => {";
const endStr = "  // Cost projections";

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find boundaries.");
  process.exit(1);
}

const newRenderSettingsContent = `  const renderSettingsContent = () => {
    if (!activeSettingsTab) {
      return (
        <div className="flex flex-col h-full min-h-0 text-white gap-3 font-sans select-none overflow-y-auto pb-4 px-2 scrollbar-none">
          <div className="flex flex-col gap-2 mt-2">
             <button onClick={() => setActiveSettingsTab("profile")} className="bg-slate-900 hover:bg-slate-800 p-3 rounded-xl border border-white/5 flex items-center justify-between transition-colors">
               <div className="flex items-center gap-3">
                 <span className="text-xl">👤</span>
                 <div className="flex flex-col text-left">
                   <span className="text-xs font-bold text-gray-200">Профиль</span>
                   <span className="text-[9px] text-gray-500">Авторизация, логин, QR-код</span>
                 </div>
               </div>
               <span className="text-gray-600">❯</span>
             </button>
             
             <button onClick={() => setActiveSettingsTab("sounds")} className="bg-slate-900 hover:bg-slate-800 p-3 rounded-xl border border-white/5 flex items-center justify-between transition-colors">
               <div className="flex items-center gap-3">
                 <span className="text-xl">🎵</span>
                 <div className="flex flex-col text-left">
                   <span className="text-xs font-bold text-gray-200">Звуки и уведомления</span>
                   <span className="text-[9px] text-gray-500">Эффекты, микрофон, Telegram</span>
                 </div>
               </div>
               <span className="text-gray-600">❯</span>
             </button>
             
             <button onClick={() => setActiveSettingsTab("themes")} className="bg-slate-900 hover:bg-slate-800 p-3 rounded-xl border border-white/5 flex items-center justify-between transition-colors">
               <div className="flex items-center gap-3">
                 <span className="text-xl">🎨</span>
                 <div className="flex flex-col text-left">
                   <span className="text-xs font-bold text-gray-200">Темы оформления</span>
                   <span className="text-[9px] text-gray-500">Жидкое стекло, цвета</span>
                 </div>
               </div>
               <span className="text-gray-600">❯</span>
             </button>
             
             <button onClick={() => setActiveSettingsTab("notifications")} className="bg-slate-900 hover:bg-slate-800 p-3 rounded-xl border border-white/5 flex items-center justify-between transition-colors">
               <div className="flex items-center gap-3">
                 <span className="text-xl">🔔</span>
                 <div className="flex flex-col text-left">
                   <span className="text-xs font-bold text-gray-200">Последние уведомления</span>
                   <span className="text-[9px] text-gray-500">История сообщений</span>
                 </div>
               </div>
               <span className="text-gray-600">❯</span>
             </button>
             
             <button onClick={() => setActiveSettingsTab("launcher")} className="bg-slate-900 hover:bg-slate-800 p-3 rounded-xl border border-white/5 flex items-center justify-between transition-colors">
               <div className="flex items-center gap-3">
                 <span className="text-xl">🖥️</span>
                 <div className="flex flex-col text-left">
                   <span className="text-xs font-bold text-gray-200">Игра на ПК</span>
                   <span className="text-[9px] text-gray-500">Установить ярлык</span>
                 </div>
               </div>
               <span className="text-gray-600">❯</span>
             </button>

             <button onClick={() => setActiveSettingsTab("reset")} className="bg-rose-950/40 hover:bg-rose-950/60 p-3 rounded-xl border border-rose-500/20 flex items-center justify-between transition-colors mt-2">
               <div className="flex items-center gap-3">
                 <span className="text-xl">🗑️</span>
                 <div className="flex flex-col text-left">
                   <span className="text-xs font-bold text-rose-400">Сброс прогресса</span>
                   <span className="text-[9px] text-rose-500/70">Удалить все данные</span>
                 </div>
               </div>
               <span className="text-rose-500/40">❯</span>
             </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full min-h-0 text-white gap-4 font-sans select-none overflow-y-auto pb-4 pr-1 scrollbar-none">
        
        {/* Sub-tab Header */}
        <div className="flex items-center gap-2 mb-1 sticky top-0 bg-slate-950/90 backdrop-blur-md p-2 rounded-xl z-10 border border-white/5 shadow-md">
          <button 
            type="button"
            onClick={() => setActiveSettingsTab(null)} 
            className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border-none outline-none cursor-pointer active:scale-95 shrink-0"
          >
            <span className="text-white text-xs">◀</span>
          </button>
          <span className="text-xs font-black flex-1 text-center pr-8 uppercase tracking-wider text-amber-500">
            {activeSettingsTab === "profile" && "Профиль"}
            {activeSettingsTab === "sounds" && "Звуки и уведомления"}
            {activeSettingsTab === "themes" && "Темы"}
            {activeSettingsTab === "notifications" && "Уведомления"}
            {activeSettingsTab === "reset" && "Сброс"}
            {activeSettingsTab === "launcher" && "Игра на ПК"}
          </span>
        </div>

        {/* PROFILE TAB */}
        {activeSettingsTab === "profile" && (
          <div className="flex flex-col gap-4 px-1">
            <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
              <span className="text-[10px] text-[#aab3c4] font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
                ☁️ Облачное сохранение
              </span>
              
              {isAuthLoading ? (
                <div className="text-center text-xs text-gray-400 py-1 font-mono">Загрузка авторизации...</div>
              ) : currentUser ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    {currentUser.photoURL ? (
                      <img 
                        src={currentUser.photoURL} 
                        alt="Avatar" 
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full border border-amber-400/30 shadow-inner animate-fade-in" 
                      />
                    ) : (
                      <div className={\`w-9 h-9 rounded-full \${currentUser.email?.startsWith("tg_") ? "bg-[#3498db]/30 text-[#3498db]" : "bg-indigo-600/30 text-indigo-300"} flex items-center justify-center text-xs font-black animate-fade-in\`}>
                        {currentUser.email?.startsWith("tg_") ? "TG" : (currentUser.displayName?.charAt(0) || "G")}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-black text-amber-300 truncate leading-tight">
                        {currentUser.displayName || (currentUser.email?.startsWith("tg_") ? "Чат-Игрок" : "Google Игрок")}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <button 
                      onClick={currentUser.email?.startsWith("tg_") ? handleTelegramSignOut : (currentUser.email?.startsWith("vk_") ? handleVKSignOut : handleGoogleSignOut)}
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 transition-colors text-[10px] font-black rounded-lg cursor-pointer text-rose-300 border-none outline-none flex items-center justify-center h-full"
                    >
                      Выйти
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] text-gray-400 leading-normal font-semibold">
                    Войдите через Google или Telegram, чтобы привязать прогресс и сохранить ваши монеты!
                  </p>
                  <div className="flex gap-2 justify-center items-center mt-1 w-full">
                    <button 
                      onClick={handleTelegramAuth} 
                      className="flex-1 py-3 bg-[#2481cc] hover:bg-[#1a6ea8] active:scale-95 text-white rounded-xl flex items-center justify-center transition-all shadow-md gap-2 border-none outline-none cursor-pointer text-xs font-bold"
                    >
                      TG
                    </button>
                    <button 
                      onClick={handleVKAuth} 
                      className="flex-1 py-3 bg-[#0077ff] hover:bg-[#0066ee] active:scale-95 text-white rounded-xl flex items-center justify-center transition-all shadow-md gap-2 border-none outline-none cursor-pointer text-xs font-bold"
                    >
                      VK
                    </button>
                    <button 
                      onClick={handleGoogleSignIn} 
                      className="flex-1 py-3 bg-white hover:bg-gray-100 active:scale-95 text-[#1a1f2c] rounded-xl flex items-center justify-center transition-all shadow-md gap-2 border-none outline-none cursor-pointer text-xs font-bold"
                    >
                      Google
                    </button>
                  </div>
                </div>
              )}
            </div>

            {currentUser && !linkedTelegramId && (
              <div className="flex flex-col gap-2 bg-[#2c3e50]/20 p-3 rounded-xl border border-white/5 animate-fade-in">
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
                          className="text-[9px] text-gray-500 hover:text-white font-bold font-mono tracking-wider uppercase flex items-center gap-1 border-none bg-transparent cursor-pointer"
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
                  href={\`https://t.me/\${botUsername || "MyTelegramGameBot"}?start=\${gameAuthCode}\`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-[#2cb2e0] hover:bg-[#39c4f3] text-wrap text-center transition-all text-[10px] font-black rounded-lg cursor-pointer text-white flex items-center justify-center gap-1 shadow-sm uppercase outline-none decoration-none"
                >
                  Открыть Чат с Ботом 💬
                </a>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mt-2">
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

            <div className="flex flex-col gap-2 bg-black/30 p-3 rounded-xl border border-white/5 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#aab3c4]">Войти на другом устройстве</span>
                  <span className="text-[9px] font-mono font-black mt-0.5 text-gray-400">Сгенерировать QR-код</span>
                </div>
                <button
                  onClick={generateLoginQrToken}
                  disabled={isGeneratingLoginQr}
                  className="py-1.5 px-3 bg-indigo-600/80 hover:bg-indigo-500 transition-colors text-[10px] font-black rounded-lg text-white disabled:opacity-50 border-none outline-none cursor-pointer"
                >
                  {isGeneratingLoginQr ? "Создание..." : "Создать"}
                </button>
              </div>
              {loginQrToken && (
                <div className="mt-2 bg-white p-2 rounded-xl flex items-center justify-center border border-white/10 mx-auto animate-fade-in">
                  <img
                    src={\`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=\${encodeURIComponent(\`login_token=\${loginQrToken}\`)}\`}
                    alt="Login QR Code"
                    className="w-32 h-32 object-contain"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-3">
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
                      addToast(\`🎨 Выбран аватар: \${av.name}\`);
                    }}
                    className={\`w-12 h-12 shrink-0 snap-center rounded-lg overflow-hidden border-2 transition-all p-0.5 outline-none cursor-pointer \${
                      playerPhotoURL === av.url ? "border-amber-400 bg-amber-950/40 scale-95" : "border-transparent bg-slate-950/60 hover:bg-slate-900"
                    }\`}
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

            <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 mt-3">
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
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(effectivePlayerId);
                          addToast("📋 ID скопирован в буфер обмена!");
                        } catch(e) {}
                      }}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-gray-400 transition-colors border-none outline-none cursor-pointer"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1 mt-1">
                  <input 
                    type="text"
                    placeholder="Введите ID другого профиля..."
                    value={transferPlayerIdInput}
                    onChange={(e) => setTransferPlayerIdInput(e.target.value)}
                    className="p-2 bg-slate-900 border border-slate-700 text-xs rounded-lg outline-none focus:border-amber-500 text-white font-mono"
                  />
                  <button 
                    onClick={() => {
                      if (transferPlayerIdInput.trim() && transferPlayerIdInput.trim() !== effectivePlayerId) {
                        switchPlayerProfile(transferPlayerIdInput.trim());
                      }
                    }}
                    disabled={!transferPlayerIdInput.trim() || transferPlayerIdInput.trim() === effectivePlayerId}
                    className="py-2 bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 transition-colors text-xs font-black rounded-lg cursor-pointer border border-amber-500/30 outline-none disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                  >
                    Сменить 🔄
                  </button>
                </div>
              </div>
            </div>

            {currentUser?.email?.startsWith("vk_") && (
              <div className="flex flex-col gap-3 bg-[#0077ff]/10 p-4 rounded-2xl border border-[#0077ff]/20 mt-3">
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
                      if (currentUser) {
                        await saveToFirestoreRef.current(currentUser, true);
                      } else {
                        await syncWithVKCloud();
                        addToast("☁️ Резервная копия успешно создана в Облаке VK!");
                      }
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

            <div className="flex justify-center mt-4 pb-2">
              <button 
                type="button"
                onClick={() => setIsAdminLoginModalOpen(true)}
                className="text-[10px] text-gray-600 hover:text-amber-500 transition-colors uppercase tracking-[0.2em] font-black cursor-pointer border-none bg-transparent"
              >
                ⚙️ Войти в Панель Админа
              </button>
            </div>
          </div>
        )}

        {/* SOUNDS AND NOTIFICATIONS TAB */}
        {activeSettingsTab === "sounds" && (
          <div className="flex flex-col gap-4 px-1">
            <div className="flex items-center justify-between bg-black/30 px-3 py-3 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#aab3c4]">Общие уведомления</span>
                  <span className={\`text-[10px] font-mono font-black mt-0.5 \${notificationsEnabled ? "text-emerald-400" : "text-rose-400"}\`}>
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
                  <div className="w-10 h-6 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4"></div>
                </label>
            </div>

            <div className="flex items-center justify-between bg-black/30 px-3 py-3 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#aab3c4]">Уведомления в Telegram</span>
                  <span className={\`text-[10px] font-mono font-black mt-0.5 \${telegramNotificationsEnabled ? "text-emerald-400" : "text-rose-400"}\`}>
                    {telegramNotificationsEnabled ? "● ВКЛЮЧЕНЫ" : "○ ОТКЛЮЧЕНЫ"}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={telegramNotificationsEnabled}
                    onChange={(e) => {
                      setTelegramNotificationsEnabled(e.target.checked);
                      addToast(e.target.checked ? "🔔 Уведомления в Telegram включены!" : "🔕 Уведомления в Telegram отключены.");
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:after:translate-x-4"></div>
                </label>
            </div>

            <div className="flex flex-col gap-2 bg-black/30 px-3 py-3 rounded-xl border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-[#aab3c4]">Микрофон</span>
                  <span className="text-[10px] font-mono font-black mt-0.5 text-gray-400">
                    {micDevices.length > 0 ? "Выберите устройство" : "Нажмите для проверки доступа"}
                  </span>
                </div>
                {micDevices.length === 0 && (
                  <button
                    onClick={async () => {
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        stream.getTracks().forEach(track => track.stop());
                        addToast("✅ Доступ к микрофону получен!");
                        if (navigator.mediaDevices.enumerateDevices) {
                          const devices = await navigator.mediaDevices.enumerateDevices();
                          const audioInputs = devices.filter(device => device.kind === 'audioinput');
                          setMicDevices(audioInputs);
                          if (audioInputs.length > 0 && !selectedMicId) {
                            setSelectedMicId(audioInputs[0].deviceId);
                            safeSetItem("selectedMicId", audioInputs[0].deviceId);
                          }
                        }
                      } catch (err) {
                        addToast("❌ Нет доступа к микрофону. Проверьте настройки браузера.");
                      }
                    }}
                    className="py-1.5 px-3 bg-slate-700 hover:bg-slate-600 transition-colors text-[10px] font-black rounded-lg text-white border-none outline-none cursor-pointer"
                  >
                    Разрешить
                  </button>
                )}
              </div>
              {micDevices.length > 0 && (
                <select
                  value={selectedMicId}
                  onChange={(e) => {
                    setSelectedMicId(e.target.value);
                    safeSetItem("selectedMicId", e.target.value);
                  }}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 mt-2 text-[11px] font-bold text-slate-300 outline-none focus:border-indigo-500/50 transition-colors"
                >
                  {micDevices.map((device, idx) => (
                    <option key={device.deviceId || idx} value={device.deviceId}>
                      {device.label || \`Микрофон \${idx + 1}\`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-xl border border-white/5 mt-2">
              <span className="text-xs text-[#ffbc6e] font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
                🎵 Звуковые эффекты
              </span>
              <div className="flex items-center justify-between py-1 text-sm font-semibold">
                <span className="text-gray-300 text-xs">Общие звуки игры:</span>
                <button 
                  type="button"
                  onClick={() => {
                    setSoundEnabled(prev => !prev);
                    addToast(!soundEnabled ? "🔊 Звуки включены!" : "🔇 Звуки отключены");
                  }}
                  className={\`p-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer font-bold border transition-all \${
                    soundEnabled 
                      ? "bg-slate-800 border-emerald-500/20 text-emerald-400" 
                      : "bg-slate-900 border-red-500/20 text-red-400"
                  }\`}
                >
                  {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  <span className="text-xs">{soundEnabled ? "Вкл" : "Выкл"}</span>
                </button>
              </div>

              <div className="border-t border-white/5 pt-3 flex flex-col gap-3 mt-1">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-gray-400">Звук отправки сообщения:</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: "iphone-sent-message", name: "iPhone Sent Sound 📤" },
                      { id: "iphone-message-swoosh", name: "iPhone Swoosh 💨" },
                      { id: "triangle-synth", name: "Синтезатор (Ретро) 👾" }
                    ].map((snd) => (
                      <div 
                        key={snd.id} 
                        className={\`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs transition-all \${
                          sentSoundKey === snd.id 
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-extrabold" 
                            : "bg-slate-950/45 border-slate-800/40 text-gray-400 hover:text-white"
                        }\`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 py-0.5">
                          <input 
                            type="radio" 
                            name="sentSoundGroup"
                            checked={sentSoundKey === snd.id}
                            onChange={() => {
                              setSentSoundKey(snd.id);
                              playSentSound(snd.id, true);
                            }}
                            className="accent-amber-500 cursor-pointer w-4 h-4"
                          />
                          <span>{snd.name}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => playSentSound(snd.id, true)}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer transition-colors border-none"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <span className="text-[11px] font-bold text-gray-400">Звук получения / уведомления:</span>
                  <div className="grid grid-cols-1 gap-1.5">
                    {[
                      { id: "iphone-sound-message", name: "iPhone Message Sound 🔔" },
                      { id: "sine-synth", name: "Синтезатор (Классический) 🎹" },
                      { id: "cyber-beep", name: "Кибер-сигнал ⚡" }
                    ].map((snd) => (
                      <div 
                        key={snd.id} 
                        className={\`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs transition-all \${
                          receivedSoundKey === snd.id 
                            ? "bg-amber-500/10 border-amber-500/40 text-amber-300 font-extrabold" 
                            : "bg-slate-950/45 border-slate-800/40 text-gray-400 hover:text-white"
                        }\`}
                      >
                        <label className="flex items-center gap-2.5 cursor-pointer flex-1 py-0.5">
                          <input 
                            type="radio" 
                            name="receivedSoundGroup"
                            checked={receivedSoundKey === snd.id}
                            onChange={() => {
                              setReceivedSoundKey(snd.id);
                              playNotificationSound(snd.id, true);
                            }}
                            className="accent-amber-500 cursor-pointer w-4 h-4"
                          />
                          <span>{snd.name}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => playNotificationSound(snd.id, true)}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white cursor-pointer transition-colors border-none"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* THEMES TAB */}
        {activeSettingsTab === "themes" && (
          <div className="flex flex-col gap-4 px-1">
            <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5">
              <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5 font-mono mb-2">
                🎨 Визуальные темы
              </span>
              
              <div className="flex items-center justify-between bg-black/30 px-3 py-3 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-gray-300 text-xs font-bold">Жидкое стекло (Glassmorphism)</span>
                  <span className="text-[9px] text-[#ffbc6e] font-normal mt-0.5">Прозрачные эффекты интерфейса</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsLiquidGlass(prev => !prev)}
                  className={\`p-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer font-bold border transition-colors border-none outline-none \${
                    isLiquidGlass 
                      ? "bg-amber-600/25 border-amber-400/40 text-amber-300 shadow-[0_0_12px_rgba(243,156,18,0.2)]" 
                      : "bg-slate-900 border-slate-700/30 text-gray-400"
                  }\`}
                >
                  <Sparkles className={\`w-4 h-4 \${isLiquidGlass ? 'text-amber-400' : 'text-gray-500'}\`} />
                  <span className="text-[10px]">{isLiquidGlass ? "ВКЛ" : "ВЫКЛ"}</span>
                </button>
              </div>

              <div className="flex flex-col gap-2 mt-2">
                <span className="text-[11px] font-bold text-gray-400">Цветовая тема:</span>
                <div className="grid grid-cols-1 gap-2">
                  <button className="flex items-center justify-between p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-left border-none outline-none">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-900 border border-gray-600"></span>
                      <span className="text-xs font-bold text-amber-300">Тёмная (По умолчанию)</span>
                    </div>
                    <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Активна</span>
                  </button>
                  <button className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/50 text-left opacity-60 border-none outline-none cursor-not-allowed">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-gray-200 border border-gray-300"></span>
                      <span className="text-xs font-bold text-gray-400">Светлая</span>
                    </div>
                    <span className="text-[9px] text-gray-500">В разработке</span>
                  </button>
                  <button className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-900/50 text-left opacity-60 border-none outline-none cursor-not-allowed">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-gradient-to-br from-slate-900 to-gray-200 border border-gray-500"></span>
                      <span className="text-xs font-bold text-gray-400">Системная</span>
                    </div>
                    <span className="text-[9px] text-gray-500">В разработке</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS HISTORY TAB */}
        {activeSettingsTab === "notifications" && (
          <div className="flex flex-col gap-4 px-1 h-full">
            <div className="flex flex-col gap-2 h-full">
              <label className="text-xs text-gray-400 font-extrabold uppercase tracking-wide px-1">История событий</label>
              <div className="flex flex-col gap-1 bg-black/20 p-2 rounded-xl border border-white/5 min-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                {toastHistory.length > 0 ? toastHistory.map((toast, index) => (
                  <div key={index} className="text-[10px] text-gray-400 font-mono border-b border-white/5 pb-2 pt-1 last:border-0 last:pb-0">
                    <span className="text-gray-600 mr-2">{index + 1}.</span> {toast}
                  </div>
                )) : (
                  <div className="text-[10px] text-gray-600 italic h-full flex items-center justify-center p-8">
                    Нет уведомлений за текущую сессию
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RESET TAB */}
        {activeSettingsTab === "reset" && (
          <div className="flex flex-col gap-4 px-1">
            <div className="flex flex-col gap-3 bg-rose-950/20 p-4 rounded-2xl border border-rose-500/20">
              <span className="text-[12px] text-rose-500 font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
                ⚠️ Опасная зона
              </span>
              <p className="text-[11px] text-gray-400 leading-relaxed font-semibold mt-1">
                Сброс удалит весь ваш прогресс, включая монеты, инвентарь и уровень. 
                Это действие <span className="text-rose-400 font-black">НЕЛЬЗЯ ОТМЕНИТЬ</span>. 
                Убедитесь, что вы действительно хотите начать игру заново.
              </p>
              
              <button 
                onClick={handleResetProgress}
                className="py-4 mt-4 bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600 hover:text-white text-rose-400 text-xs font-black rounded-xl transition-colors cursor-pointer outline-none"
              >
                СБРОСИТЬ ВЕСЬ ПРОГРЕСС 🗑️
              </button>
            </div>
          </div>
        )}

        {/* LAUNCHER TAB */}
        {activeSettingsTab === "launcher" && (
          <div className="flex flex-col gap-4 px-1">
            <div className="flex flex-col gap-3 bg-black/25 p-4 rounded-2xl border border-white/5 animate-fade-in shadow-inner">
              <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1.5 font-mono">
                🖥️ Игра на вашем компьютере
              </span>
              <p className="text-[11px] text-gray-400 leading-normal font-semibold mt-1">
                Хотите играть прямо с Рабочего Стола ПК с автоматическим ярлыком и быстрой загрузкой без лагов браузера?
              </p>
              <button 
                type="button"
                onClick={() => {
                  setLauncherModalStep("intro");
                  setIsLauncherModalOpen(true);
                }}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 hover:shadow-[0_0_15px_rgba(242,156,18,0.25)] text-[#0e1726] font-black rounded-xl text-[11px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98] outline-none border-none cursor-pointer mt-3"
              >
                УСТАНОВИТЬ ЯРЛЫК НА ПК 🖥️
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
`;

const finalContent = content.substring(0, startIndex) + newRenderSettingsContent + "\n" + content.substring(endIndex);

fs.writeFileSync('src/App.tsx', finalContent, 'utf8');
console.log('Successfully replaced renderSettingsContent');
