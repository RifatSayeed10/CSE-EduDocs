import React from "react";
import { MessageSquare, Send, User, MessageCircle, AlertCircle, RefreshCw, Bell, BellRing } from "lucide-react";
import { api } from "../lib/api";
import { User as UserType } from "../types";

interface ChatViewProps {
  currentUser: UserType | null;
}

interface ChatPartner {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  message: string;
  timestamp?: string;
  createdAt?: string;
}

// Synthetic sound generators using Web Audio API to prevent broken .mp3 fetches
const playIncomingSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Play dual harmonic chime (classic premium alert)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5

    osc2.frequency.setValueAtTime(659.25, now); // E5
    osc2.frequency.exponentialRampToValueAtTime(1109.73, now + 0.12); // C#6

    gainNode.gain.setValueAtTime(0.12, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.warn("Audio Context playback blocked:", err);
  }
};

const playOutgoingSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.setValueAtTime(320, now + 0.05);

    gainNode.gain.setValueAtTime(0.04, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch (err) {}
};

export default function ChatView({ currentUser }: ChatViewProps) {
  const [users, setUsers] = React.useState<ChatPartner[]>([]);
  const [selectedUser, setSelectedUser] = React.useState<ChatPartner | null>(null);
  const [chats, setChats] = React.useState<ChatMessage[]>([]);
  const [newMsg, setNewMsg] = React.useState("");
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [loadingChats, setLoadingChats] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [alertToast, setAlertToast] = React.useState<{ message: string; sender: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = React.useState(true);

  // Unread tracker store in localStorage per user
  const [lastReadTimes, setLastReadTimes] = React.useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`chat_last_read_${currentUser?.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  // Load chat partners
  const loadUsers = async () => {
    if (!currentUser) return;
    setLoadingUsers(true);
    try {
      const allUsers = await api.getChatUsers();
      // Filter out self
      const partners = allUsers.filter(u => u.id !== currentUser.id);
      setUsers(partners);
      
      // Select first user automatically if none is selected
      if (partners.length > 0 && !selectedUser) {
        setSelectedUser(partners[0]);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to retrieve companion nodes for conversation.");
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load chat history with background delta checking for new incoming items
  const loadChats = async (isFirstLoad = false) => {
    if (!currentUser) return;
    if (isFirstLoad) setLoadingChats(true);
    try {
      const directChats = await api.getChats();
      
      setChats(prevChats => {
        // If there are new chats from someone else, trigger the alert & sound & optional toast!
        if (!isFirstLoad && prevChats.length > 0 && directChats.length > prevChats.length) {
          const prevIds = new Set(prevChats.map(m => m.id));
          const freshMessage = directChats.find(
            msg => msg.senderId !== currentUser.id && !prevIds.has(msg.id)
          );
          if (freshMessage) {
            if (soundEnabled) {
              playIncomingSound();
            }
            // Show the top screen WhatsApp toast notification
            setAlertToast({ message: freshMessage.message, sender: freshMessage.senderName });
            const timer = setTimeout(() => setAlertToast(null), 4000);
          }
        }
        return directChats;
      });
    } catch (err) {
      console.error(err);
    } finally {
      if (isFirstLoad) setLoadingChats(false);
    }
  };

  // Polling hook to bring down direct live updates periodically (Fast 2s poll)
  React.useEffect(() => {
    loadUsers();
    loadChats(true);
    
    const interval = setInterval(() => {
      loadChats(false);
    }, 2000);

    return () => clearInterval(interval);
  }, [currentUser, soundEnabled]);

  // Update last read of selectedUser conversation
  React.useEffect(() => {
    if (selectedUser && currentUser) {
      setLastReadTimes(prev => {
        const updatedReadMap = { ...prev, [selectedUser.id]: Date.now() };
        try {
          localStorage.setItem(`chat_last_read_${currentUser.id}`, JSON.stringify(updatedReadMap));
        } catch (err) {}
        return updatedReadMap;
      });
    }
  }, [selectedUser, chats, currentUser]);

  // Handle selected partner change
  React.useEffect(() => {
    scrollToBottom();
  }, [selectedUser, chats]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Determine if there is any unread message from a user
  const isUserUnread = (partnerId: string) => {
    const lastRead = lastReadTimes[partnerId] || 0;
    return chats.some(
      msg => {
        if (msg.senderId !== partnerId || msg.receiverId !== currentUser?.id) return false;
        const timeVal = msg.timestamp || msg.createdAt;
        if (!timeVal) return false;
        const parsedTime = new Date(timeVal).getTime();
        return !isNaN(parsedTime) && parsedTime > lastRead;
      }
    );
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newMsg.trim() || sending) return;

    const messageToSend = newMsg.trim();
    setNewMsg("");
    setSending(true);

    try {
      if (soundEnabled) {
        playOutgoingSound();
      }
      await api.sendChatMessage(selectedUser.id, messageToSend);
      // Immediate local insert to maintain seamless experience before polling fetches it
      const optimisticMsg: ChatMessage = {
        id: "opt_" + Math.random().toString(36).substring(2, 9),
        senderId: currentUser!.id,
        senderName: currentUser!.name,
        receiverId: selectedUser.id,
        message: messageToSend,
        timestamp: new Date().toISOString()
      };
      setChats(prev => [...prev, optimisticMsg]);
      scrollToBottom();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to deliver message payload.");
    } finally {
      setSending(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="rounded-sm border border-stone-200 bg-white p-12 text-center space-y-4 max-w-lg mx-auto">
        <MessageCircle className="h-12 w-12 text-brand-600 mx-auto" />
        <h3 className="font-serif text-lg font-bold text-stone-900">Sign in to Start Converging</h3>
        <p className="text-xs text-stone-500 font-light">
          Secure real-time scholar transmission requires authorized credentials matching the system registry.
        </p>
      </div>
    );
  }

  // Filter conversations with chosen classmate or professor
  const activeConversation = chats.filter(
    (msg) =>
      (msg.senderId === currentUser.id && msg.receiverId === selectedUser?.id) ||
      (msg.senderId === selectedUser?.id && msg.receiverId === currentUser.id)
  );

  return (
    <div className="rounded-sm border border-stone-200 bg-white shadow-3xs overflow-hidden h-[calc(100vh-220px)] min-h-[500px] flex page-transition-enter page-transition-enter-active relative">
      
      {/* Dynamic Screen Alert Toast for new background messages */}
      {alertToast && (
        <div className="fixed top-5 right-5 z-[1000] max-w-sm rounded-sm border border-stone-300 bg-white p-4 shadow-md flex items-center gap-3 select-none">
          <div className="relative flex h-3.5 w-3.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </div>
          <div className="text-left shrink-0 max-w-[200px]">
            <span className="block text-xs font-bold text-stone-900 truncate">{alertToast.sender}</span>
            <p className="text-[10px] text-stone-500 mt-0.5 truncate">{alertToast.message}</p>
          </div>
          <button 
            onClick={() => setAlertToast(null)}
            className="text-[10px] font-bold text-brand-600 hover:text-brand-800 cursor-pointer pl-2.5 border-l border-stone-200 ml-auto"
          >
            Read
          </button>
        </div>
      )}

      {/* 1. Scholar Directory Panel (Left Side) */}
      <div className="w-1/3 border-r border-stone-200 flex flex-col bg-stone-50/50">
        <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between select-none">
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900">Conversations</h3>
            <span className="text-[9px] text-stone-500 font-mono tracking-wide uppercase">
              Authenticated Port Nodes
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Audio Toggle control */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-1.5 rounded-sm border transition-all cursor-pointer ${
                soundEnabled 
                  ? "bg-brand-50 text-brand-600 border-brand-100/50" 
                  : "bg-stone-100 text-stone-400 border-stone-200"
              }`}
              title={soundEnabled ? "Mute alert audio clips" : "Enable alert audio clips"}
            >
              {soundEnabled ? (
                <BellRing className="h-3.5 w-3.5 text-brand-600" />
              ) : (
                <Bell className="h-3.5 w-3.5 text-stone-400" />
              )}
            </button>
            <button 
              onClick={() => { loadUsers(); loadChats(true); }}
              className="p-1.5 rounded-sm border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors cursor-pointer"
              title="Refresh active relays"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Directory scrolling search users */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {loadingUsers && users.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Querying active user arrays...
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-405">
              No other scholars found registered. Register additional users to mock mutual messaging.
            </div>
          ) : (
            users.map((u) => {
              const unread = isUserUnread(u.id);
              const isActive = selectedUser?.id === u.id;
              
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className={`w-full flex items-center gap-3 rounded-sm p-3 text-left transition-all border relative ${
                    isActive
                      ? "bg-brand-500 text-white border-brand-600 shadow-3xs"
                      : unread
                        ? "bg-emerald-50 border-emerald-300 shadow-3xs"
                        : "bg-white hover:bg-stone-100 border-stone-200"
                  }`}
                  id={`chat-user-${u.id}`}
                >
                  <div className={`p-2 rounded-sm text-center relative shrink-0 ${
                    isActive ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600"
                  }`}>
                    <User className="h-4.5 w-4.5" />
                    {unread && !isActive && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="block text-xs font-bold truncate">{u.name}</span>
                      <span className={`text-[7px] px-1.5 py-0.5 rounded-sm font-mono uppercase font-extrabold tracking-wider shrink-0 ${
                        isActive
                          ? "bg-white/20 text-white"
                          : unread
                            ? "bg-emerald-600 text-white shadow-3xs"
                            : "bg-brand-50 text-brand-700"
                      }`}>
                        {unread && !isActive ? "NEW MESSAGE" : u.role}
                      </span>
                    </div>
                    <span className={`block text-[10px] truncate ${
                      isActive ? "text-brand-100" : "text-stone-500"
                    }`}>
                      {u.email}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
        
        {/* Personal identification footer */}
        <div className="p-3 bg-white border-t border-stone-200 flex items-center gap-3 text-left select-none">
          <div className="h-8 w-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs select-none">
            {currentUser.name[0]}
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-bold text-stone-800 leading-none truncate">{currentUser.name}</span>
            <span className="text-[9px] text-emerald-600 font-mono font-bold uppercase tracking-wider block mt-0.5">
              RELAY ON • {currentUser.role}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Chat Conversation Box (Right Side) */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedUser ? (
          <>
            {/* Active Partner Header */}
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50 select-none">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-sm bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs border border-brand-200">
                  {selectedUser.name[0]}
                </div>
                <div>
                  <h4 className="font-serif text-xs font-bold text-stone-850">{selectedUser.name}</h4>
                  <p className="text-[10px] text-stone-500 font-mono">
                    Direct scholarly channel • Role: <span className="font-bold text-brand-600 uppercase">{selectedUser.role}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Scrolling dialog list */}
            <div className="flex-1 p-5 overflow-y-auto bg-stone-50/20 space-y-4">
              {activeConversation.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 space-y-2 select-none">
                  <MessageSquare className="h-10 w-10 text-stone-300 stroke-1" />
                  <p className="text-xs">No direct relays written. Send a message to initiate communication.</p>
                </div>
              ) : (
                activeConversation.map((msg) => {
                  const isMe = msg.senderId === currentUser.id;
                  const timeVal = msg.timestamp || msg.createdAt;
                  let displayTime = "Just now";
                  if (timeVal) {
                    const parsedDate = new Date(timeVal);
                    if (!isNaN(parsedDate.getTime())) {
                      displayTime = parsedDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    }
                  }
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[75%] select-text animate-fadeIn ${
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400 mb-1 select-none">
                        <span>{msg.senderName}</span>
                        <span>•</span>
                        <span>{displayTime}</span>
                      </div>
                      <div
                        className={`rounded-sm px-4 py-2.5 text-xs font-medium shadow-3xs leading-relaxed ${
                          isMe
                            ? "bg-brand-500 text-white rounded-tr-none border border-brand-600"
                            : "bg-white border border-stone-200 text-stone-850 rounded-tl-none"
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Error notifications */}
            {errorMsg && (
              <div className="mx-4 mt-2 flex items-start gap-2 rounded-sm bg-red-50 p-2 text-red-700 text-[11px] font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span>{errorMsg}</span>
                <button onClick={() => setErrorMsg("")} className="ml-auto font-bold cursor-pointer hover:underline">Dismiss</button>
              </div>
            )}

            {/* Input Message Container */}
            <form onSubmit={handleSendMessage} className="p-3.5 border-t border-stone-200 flex items-center gap-3">
              <input
                type="text"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder={`Send encrypted relay message to ${selectedUser.name}...`}
                className="flex-1 rounded-sm border border-stone-200 px-4 py-3 text-xs outline-none focus:border-brand-500 font-medium"
              />
              <button
                type="submit"
                disabled={!newMsg.trim() || sending}
                className="rounded-sm bg-brand-500 hover:bg-brand-600 text-white p-3 transition-all cursor-pointer disabled:bg-stone-250 disabled:cursor-not-allowed shadow-3xs"
                title="Transmit update"
              >
                <Send className="h-4.5 w-4.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-stone-400 select-none space-y-3">
            <MessageSquare className="h-12 w-12 text-stone-350 stroke-1" />
            <p className="text-xs">Select or register a conversant companion to begin dialog relay.</p>
          </div>
        )}
      </div>

    </div>
  );
}
