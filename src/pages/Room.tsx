import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { rtdb } from '../lib/firebase';
import { ref, get, set, push, remove, onValue, serverTimestamp } from 'firebase/database';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Mic, Send, Image as ImageIcon, Reply, Trash2, ShieldAlert, Check, X, Download, Maximize2, Square } from 'lucide-react';
import { stringToNumbers, numbersToString } from '../lib/utils';
import { GoogleGenAI } from '@google/genai';

const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Audio Recorder Hook
function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };
        // stop tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioBase64(null);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
       mediaRecorderRef.current.stop();
       setIsRecording(false);
     }
     setAudioBase64(null);
  };

  return { isRecording, startRecording, stopRecording, cancelRecording, audioBase64, setAudioBase64 };
}


export function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [room, setRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [membersCache, setMembersCache] = useState<Record<string, any>>({});
  
  // States for join requests
  const [isPending, setIsPending] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  
  // States for input
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('00:00:00');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isRecording, startRecording, stopRecording, cancelRecording, audioBase64, setAudioBase64 } = useAudioRecorder();

  // Selected images to send
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  // Full screen image viewer
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording, selectedImages, audioBase64]);

  useEffect(() => {
      if (!room?.linkExpiresAt) return;
      const interval = setInterval(() => {
          const diff = room.linkExpiresAt - Date.now();
          if (diff <= 0) {
              setTimeLeft('EXPIRED');
              clearInterval(interval);
          } else {
              const hours = Math.floor(diff / (1000 * 60 * 60));
              const mins = Math.floor((diff / 1000 / 60) % 60);
              const secs = Math.floor((diff / 1000) % 60);
              setTimeLeft(`${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`);
          }
      }, 1000);
      return () => clearInterval(interval);
  }, [room]);

  const copyLink = () => {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
  };

  // Setup Room & Auth
  useEffect(() => {
    if (!roomId || !profile) return;
    
    let isMounted = true;
    let unsubMessages: any = null;
    let unsubJoinRequests: any = null;

    const setupRoom = async () => {
      try {
        const roomRef = ref(rtdb, `rooms/${roomId}`);
        const roomSnap = await get(roomRef);
        
        if (!roomSnap.exists()) {
          setError('Room does not exist.');
          return;
        }

        const roomData = roomSnap.val();
        
        // Members check / join logic
        const amIMember = !!roomData.members?.[profile.userId];
        const amICreator = roomData.creatorId === profile.userId;
        
        if (amIMember || amICreator) {
           setIsMember(true);
           if (isMounted) setRoom({ id: roomId, ...roomData, name: numbersToString(roomData.name) });
        } else {
           // Not a member
           const reqRef = ref(rtdb, `rooms/${roomId}/joinRequests/${profile.userId}`);
           const reqSnap = await get(reqRef);
           if (reqSnap.exists()) {
              setIsPending(true);
           } else {
              setIsMember(false);
              setIsPending(false);
           }
           if (isMounted) setRoom({ id: roomId, ...roomData, name: numbersToString(roomData.name) });
           return;
        }

        // Fetch users cache
        const usersSnap = await get(ref(rtdb, 'users'));
        if (usersSnap.exists()) {
          const userMap: Record<string, any> = {};
          for (const [uid, u] of Object.entries<any>(usersSnap.val())) {
             userMap[uid] = {
                displayName: numbersToString(u.displayName),
                photoData: numbersToString(u.photoData) 
             };
          }
          if (isMounted) setMembersCache(userMap);
        }

        // Realtime Messages
        const msgsRef = ref(rtdb, `rooms/${roomId}/messages`);
        unsubMessages = onValue(msgsRef, (snapshot) => {
          if (!isMounted) return;
          const msgs: any[] = [];
          if (snapshot.exists()) {
             snapshot.forEach(child => {
                const data = child.val();
                msgs.push({
                   id: child.key,
                   senderId: data.senderId,
                   type: data.type,
                   text: data.text ? numbersToString(data.text) : '', 
                   mediaData: data.mediaData ? numbersToString(data.mediaData) : '', 
                   mediaList: data.mediaList ? data.mediaList.map((m:string) => numbersToString(m)) : [],
                   createdAt: data.createdAt
                });
             });
          }
          msgs.sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0));
          setMessages(msgs);
        });

        // Realtime Join Requests for Creator
        if (amICreator) {
           const requestsRef = ref(rtdb, `rooms/${roomId}/joinRequests`);
           unsubJoinRequests = onValue(requestsRef, (snapshot) => {
              if (!isMounted) return;
              const reqs: any[] = [];
              if (snapshot.exists()) {
                 snapshot.forEach(child => {
                    reqs.push({ userId: child.key, ...child.val() });
                 });
              }
              setJoinRequests(reqs);
           });
        }

      } catch (err) {
        console.error(err);
        setError('Error accessing room.');
      }
    };

    setupRoom();

    return () => {
      isMounted = false;
      if (typeof unsubMessages === 'function') unsubMessages();
      if (typeof unsubJoinRequests === 'function') unsubJoinRequests();
    };
  }, [roomId, profile, isMember]);

  const requestToJoin = async () => {
    if (!roomId || !profile || !room) return;
    const expiresAt = room.linkExpiresAt;
    if (Date.now() > expiresAt && room.creatorId !== profile.userId) {
       setError('Link has expired.');
       return;
    }
    
    const reqRef = ref(rtdb, `rooms/${roomId}/joinRequests/${profile.userId}`);
    await set(reqRef, { requestedAt: serverTimestamp() });
    setIsPending(true);
  };

  const approveRequest = async (userId: string) => {
     await set(ref(rtdb, `rooms/${roomId}/members/${userId}`), { joinedAt: serverTimestamp() });
     await remove(ref(rtdb, `rooms/${roomId}/joinRequests/${userId}`));
  };

  const rejectRequest = async (userId: string) => {
     await remove(ref(rtdb, `rooms/${roomId}/joinRequests/${userId}`));
  };

  const handleSendMessage = async (e?: React.FormEvent, forceType?: string) => {
    if (e) e.preventDefault();
    if (!roomId || !profile) return;
    
    let isText = false;
    let isImages = false;
    let isAudio = false;

    if (forceType) {
       if (forceType === 'audio') isAudio = true;
    } else {
       if (selectedImages.length > 0) isImages = true;
       else if (inputText.trim()) isText = true;
       else if (audioBase64) isAudio = true;
    }

    if (!isText && !isImages && !isAudio) return;

    setIsSubmitting(true);
    let textToSend = inputText.trim();
    let mediaDataToSend = '';
    let mediaListToSend: string[] = [];
    let msgType = 'text';

    if (isText) {
       msgType = 'text';
       setInputText('');
    } else if (isImages) {
       msgType = 'image';
       mediaListToSend = [...selectedImages];
       setSelectedImages([]);
    } else if (isAudio) {
       msgType = 'audio';
       mediaDataToSend = audioBase64 || '';
       setAudioBase64(null);
    }

    try {
      const msgsRef = ref(rtdb, `rooms/${roomId}/messages`);
      const newMsgRef = push(msgsRef);
      await set(newMsgRef, {
        senderId: profile.userId,
        type: msgType,
        text: stringToNumbers(textToSend),     
        mediaData: stringToNumbers(mediaDataToSend), 
        mediaList: mediaListToSend.map(s => stringToNumbers(s)),
        createdAt: serverTimestamp(),
      });

      if (isText && textToSend.toLowerCase().includes('@ai')) {
        invokeAI(textToSend);
      }
    } catch (err) {
       console.error("Failed to send message:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const invokeAI = async (prompt: string) => {
    try {
       const response = await aiClient.models.generateContent({
         model: 'gemini-3.1-pro-preview',
         contents: prompt,
       });
       const aiText = response.text || "I remain quiet...";
       const aiMsgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
       await set(aiMsgRef, {
         senderId: profile!.userId,
         type: 'ai',
         text: stringToNumbers(aiText),
         mediaData: '',
         mediaList: [],
         createdAt: serverTimestamp()
       });
    } catch (err) {
       console.error("AI invocation failed", err);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newImgs: string[] = [];
    let count = 0;
    const maxFiles = Math.min(files.length, 4 - selectedImages.length);
    if (maxFiles <= 0) return;

    for (let i = 0; i < maxFiles; i++) {
        const file = files[i];
        if (file.size > 800000) {
            alert(`File ${file.name} is too large (max ~800KB). Skipping.`);
            continue;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            newImgs.push(reader.result as string);
            count++;
            if (count === maxFiles) {
                setSelectedImages(prev => [...prev, ...newImgs].slice(0, 4));
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const deleteMessage = async (msgId: string) => {
    try {
      await remove(ref(rtdb, `rooms/${roomId}/messages/${msgId}`));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteChat = async () => {
    if (!window.confirm("Are you sure you want to delete all messages?")) return;
    try {
       await remove(ref(rtdb, `rooms/${roomId}/messages`));
    } catch(err) {
       console.error(err);
    }
  };
  
  const handleDownloadImage = (dataUrl: string) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "image.png";
      a.click();
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-6 bg-black text-neutral-200 font-sans">
        <div className="text-center p-8 border border-red-900/50 bg-red-950/10 rounded-[2rem] max-w-sm backdrop-blur-md">
           <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
           <p className="text-xl font-bold tracking-widest uppercase mb-2 text-white">{error}</p>
           <Button onClick={() => navigate('/dashboard')} variant="outline" className="mt-8 border-red-900/50 hover:bg-red-900/20 rounded-full h-12 px-8 uppercase tracking-widest text-xs font-bold text-white">Return to Vault</Button>
        </div>
      </div>
    );
  }

  if (!room) return <div className="h-screen bg-black" />;

  const isCreator = profile?.userId === room.creatorId;

  if (!isMember) {
     return (
        <div className="flex flex-col h-screen bg-black items-center justify-center text-center p-6 space-y-6 font-sans relative overflow-hidden">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/20 via-black to-black animate-pulse pointer-events-none"></div>
           <div className="w-24 h-24 rounded-full border border-orange-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.2)] bg-black z-10">
               <ShieldAlert className="w-10 h-10 text-orange-500" />
           </div>
           
           <div className="z-10 bg-[#0A0A0A]/90 border border-white/5 p-8 rounded-[2rem] backdrop-blur-md max-w-md w-full shadow-2xl">
               <h1 className="text-xl font-black uppercase tracking-widest text-white mb-2">Access Restricted</h1>
               <p className="text-neutral-500 text-sm mb-8 leading-relaxed">
                  This is an encrypted room ({room.name}). You must request clearance from the creator to enter.
               </p>
               
               {isPending ? (
                   <div className="p-4 border border-orange-500/50 bg-orange-950/20 rounded-xl">
                      <p className="text-orange-500 font-bold tracking-widest uppercase text-sm">Request Pending...</p>
                      <p className="text-xs text-orange-500/70 mt-2">Waiting for creator approval.</p>
                   </div>
               ) : (
                   <Button onClick={requestToJoin} className="w-full h-14 rounded-full bg-orange-600 text-black hover:bg-orange-500 font-bold uppercase tracking-widest text-sm shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-transform hover:scale-[1.02]">
                       Request Access
                   </Button>
               )}
               
               <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mt-4 w-full h-12 rounded-full text-neutral-400 hover:text-white uppercase tracking-widest text-xs">
                  Cancel
               </Button>
           </div>
        </div>
     );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-black text-white font-sans overflow-hidden relative">
      
      {fullScreenImage && (
          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center">
              <div className="absolute top-4 right-4 flex gap-4">
                  <Button onClick={() => handleDownloadImage(fullScreenImage)} variant="outline" className="rounded-full bg-white/5 border-white/10 hover:bg-white/20">
                      <Download className="w-5 h-5 text-white" />
                  </Button>
                  <Button onClick={() => setFullScreenImage(null)} variant="outline" className="rounded-full bg-white/5 border-white/10 hover:bg-white/20">
                      <X className="w-5 h-5 text-white" />
                  </Button>
              </div>
              <img src={fullScreenImage} className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg" />
          </div>
      )}

      {/* Left Sidebar */}
      <div className="w-64 border-r border-white/10 hidden md:flex flex-col bg-[#050505] shrink-0 relative z-20">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold mb-8">Terminal</h1>
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-200 p-[1px] shrink-0">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden text-xs">
                    {membersCache[room.creatorId]?.photoData ? (
                        <img src={membersCache[room.creatorId].photoData} className="w-full h-full object-cover" />
                    ) : (
                        membersCache[room.creatorId]?.displayName?.[0] || '?'
                    )}
                </div>
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate text-white">{membersCache[room.creatorId]?.displayName || 'Unknown'}</p>
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold">Room Creator</p>
              </div>
            </div>
            
            {Object.keys(room.members || {})
                .filter(id => id !== room.creatorId)
                .map((id: string) => (
                <div key={`side-${id}`} className="flex items-center space-x-3 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xs shrink-0 overflow-hidden">
                    {membersCache[id]?.photoData ? (
                        <img src={membersCache[id].photoData} className="w-full h-full object-cover" />
                    ) : (
                        membersCache[id]?.displayName?.[0] || '?'
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm truncate text-white max-w-[120px]">{membersCache[id]?.displayName || 'Unknown'}</p>
                    <p className="text-[10px] text-gray-500 uppercase font-mono">Participant</p>
                  </div>
                </div>
            ))}
          </div>
        </div>
        
        {isCreator && joinRequests.length > 0 && (
           <div className="p-6 border-b border-white/5 flex-col space-y-4 max-h-[200px] overflow-y-auto bg-orange-950/10">
               <h2 className="text-[10px] uppercase tracking-[0.2em] text-orange-500 font-bold">Clearance Requests ({joinRequests.length})</h2>
               {joinRequests.map(req => {
                   const uinfo = membersCache[req.userId] || { displayName: 'Unknown' };
                   return (
                       <div key={req.userId} className="flex flex-col gap-2 p-3 bg-white/5 border border-white/5 rounded-xl">
                          <p className="text-xs font-semibold truncate w-full text-white">{uinfo.displayName}</p>
                          <div className="flex gap-2">
                             <Button onClick={() => approveRequest(req.userId)} size="sm" className="h-7 w-full bg-emerald-600 hover:bg-emerald-500 text-black rounded text-[10px] uppercase tracking-widest"><Check className="w-3 h-3 mr-1"/> Allow</Button>
                             <Button onClick={() => rejectRequest(req.userId)} size="sm" variant="outline" className="h-7 w-full border-red-500/50 text-red-500 hover:bg-red-900/30 rounded text-[10px] uppercase tracking-widest"><X className="w-3 h-3"/></Button>
                          </div>
                       </div>
                   );
               })}
           </div>
        )}

        <div className="mt-auto p-6">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold">Auto-Delete Target</p>
            <p className="text-xl font-black font-mono text-orange-500 tracking-tighter">{timeLeft}</p>
          </div>
        </div>
      </div>
      
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden min-w-0 bg-[#020202]">
         {/* HEADER */}
         <div className="h-16 md:h-20 border-b border-white/5 flex items-center justify-between px-4 md:px-10 shrink-0 z-20 bg-black/80 backdrop-blur-md">
           <div className="flex items-center space-x-3 md:space-x-4">
             <button onClick={() => navigate('/dashboard')} className="md:hidden w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white mr-1 transition-colors bg-white/5 rounded-full">
               <Reply className="w-4 h-4" />
             </button>
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981] shrink-0 animate-pulse"></div>
             <span className="text-xs md:text-sm font-black tracking-widest uppercase truncate text-white">{room.name || `#${room.id.slice(0,4)}`}</span>
           </div>
           <div className="flex items-center space-x-4 md:space-x-6 shrink-0">
             <button onClick={copyLink} className="hidden md:block text-xs text-gray-400 hover:text-white uppercase tracking-widest font-bold transition-colors">Share Link</button>
             {isCreator && (
                 <button onClick={deleteChat} className="px-4 py-2 bg-red-950/30 border border-red-500/30 text-red-500 text-[10px] md:text-xs uppercase tracking-widest font-bold hover:bg-red-900/50 transition-colors rounded-full">Purge</button>
             )}
           </div>
         </div>

         {/* MESSAGES */}
         <div className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden flex flex-col space-y-8 relative z-10 w-full max-w-4xl mx-auto">
           {messages.length === 0 && (
             <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 my-10 font-mono">
               <ShieldAlert className="w-16 h-16 text-orange-500 mb-6 opacity-80" />
               <p className="text-sm uppercase tracking-[0.3em] text-white font-bold mb-2">Encrypted Channel Established</p>
               <p className="text-gray-500 text-xs tracking-widest">Awaiting transmission...</p>
             </div>
           )}
           {messages.map((msg) => {
             const isMe = msg.senderId === profile?.userId;
             const senderInfo = membersCache[msg.senderId] || { displayName: 'Unknown', photoData: '' };
             const isAI = msg.type === 'ai';
             
             const timeLabel = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
             const nameLabel = isAI ? 'Neural Core' : (isMe ? 'Me' : senderInfo.displayName);

             return (
               <div key={msg.id} className={`w-full flex ${isMe && !isAI ? 'justify-end' : 'justify-start'} group relative`}>
                 <div className={`max-w-[95%] md:max-w-2xl flex flex-col ${isMe && !isAI ? 'items-end' : 'items-start'}`}>
                    <p className={`text-[10px] uppercase text-gray-500 tracking-widest mb-2 flex items-center gap-2 ${isMe && !isAI ? 'flex-row-reverse' : ''}`}>
                        {isAI && <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1]"></span>}
                        <span className="font-bold text-gray-400">{nameLabel}</span> 
                        <span className="opacity-50">• {timeLabel}</span>
                    </p>
                    
                    <div className="relative group">
                        
                        {/* Text Messages: Large font, no strict container */}
                        {msg.type === 'text' && (
                            <div dir="auto" className={`text-xl md:text-[1.6rem] leading-snug whitespace-pre-wrap ${isMe && !isAI ? 'text-white text-right' : 'text-gray-300 text-left'}`}>
                                {msg.text}
                            </div>
                        )}

                        {/* Audio Messages: Minimal integrated look */}
                        {msg.type === 'audio' && (
                            <div className="flex items-center gap-4 bg-transparent mt-1">
                               <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg ${isMe ? 'bg-orange-600 text-black' : 'bg-white/10 text-white border border-white/20'}`}>
                                  <Mic className="w-5 h-5 opacity-90" />
                               </div>
                               <audio src={msg.mediaData} controls className={`h-12 w-64 ${isMe ? 'opacity-100' : 'opacity-80 grayscale'}`} />
                            </div>
                        )}

                        {/* Image Messages: Grid layout without frames */}
                        {msg.type === 'image' && msg.mediaList && msg.mediaList.length > 0 && (
                            <div className={`grid gap-1 mt-2 w-full max-w-[320px] md:max-w-[480px] ${msg.mediaList.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                {msg.mediaList.map((imgUrl: string, i: number) => (
                                    <div key={i} onClick={() => setFullScreenImage(imgUrl)} className="relative group/img cursor-pointer aspect-square rounded-2xl md:rounded-3xl overflow-hidden bg-white/5">
                                        <img src={imgUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-[1.03]" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                            <Maximize2 className="w-6 h-6 text-white drop-shadow-md" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Hover Delete Button for Creator */}
                        {isCreator && (
                            <button onClick={() => deleteMessage(msg.id)} className={`absolute top-0 ${isMe && !isAI ? '-left-12' : '-right-12'} opacity-0 md:group-hover:opacity-100 transition-all p-2 text-gray-600 hover:text-red-500 bg-black/80 rounded-full backdrop-blur-md`}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                 </div>
               </div>
             );
           })}
           <div ref={messagesEndRef} className="pb-32 md:pb-40" />
         </div>

         {/* Bottom Action Area (Input & Controls) */}
         <div className="absolute bottom-0 w-full bg-gradient-to-t from-black via-black/95 to-transparent pt-12 pb-4 md:pb-8 px-4 md:px-10 z-30 pointer-events-none">
           
           {/* Preview selected images */}
           {selectedImages.length > 0 && (
              <div className="pointer-events-auto flex items-center gap-2 mb-4 overflow-x-auto pb-2 pl-4 max-w-2xl mx-auto">
                 {selectedImages.map((src, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-2xl border border-white/20 overflow-hidden shrink-0 shadow-lg">
                       <img src={src} className="w-full h-full object-cover" />
                       <button onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 hover:bg-red-500/80">
                         <X className="w-3 h-3 text-white" />
                       </button>
                    </div>
                 ))}
                 <Button onClick={() => handleSendMessage()} disabled={isSubmitting} className="h-16 w-16 rounded-[1.5rem] bg-orange-600 hover:bg-orange-500 text-black shrink-0 font-bold uppercase tracking-widest text-[10px]">
                    Send
                 </Button>
              </div>
           )}

           <form onSubmit={e => handleSendMessage(e)} className="pointer-events-auto flex items-end w-full max-w-4xl mx-auto gap-2 md:gap-4 relative">
             <div className="flex space-x-1 md:space-x-2 shrink-0 bg-white/5 backdrop-blur-md p-1 md:p-1.5 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-xl">
               <label className="w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-full hover:bg-white/10 cursor-pointer text-gray-400 hover:text-orange-400 transition-colors">
                 <ImageIcon className="w-6 h-6 md:w-7 md:h-7" />
                 <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageSelect} />
               </label>
             </div>

             <div className="flex-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-[1.5rem] md:rounded-[2rem] px-5 md:px-6 py-2 flex flex-col justify-center transition-all focus-within:border-orange-500/50 focus-within:bg-white/10 min-h-[56px] md:min-h-[64px] shadow-xl relative overflow-hidden">
                {isRecording ? (
                   <div className="flex items-center w-full justify-between animate-in fade-in slide-in-from-bottom-2 px-2">
                       <div className="flex items-center gap-4">
                           <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_#ef4444]"></div>
                           <span className="text-red-400 font-mono tracking-widest text-sm uppercase font-bold">Recording Audio</span>
                           {/* Simulated wave line for visual flair */}
                           <div className="hidden md:flex gap-1 ml-4 items-center">
                              <div className="w-1 h-3 bg-red-500/50 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                              <div className="w-1 h-6 bg-red-500/50 rounded-full animate-bounce" style={{animationDelay: '100ms'}}></div>
                              <div className="w-1 h-4 bg-red-500/50 rounded-full animate-bounce" style={{animationDelay: '200ms'}}></div>
                              <div className="w-1 h-7 bg-red-500/50 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                           </div>
                       </div>
                       <Button type="button" onClick={cancelRecording} variant="ghost" size="icon" className="hover:bg-red-500/20 text-red-400 rounded-full h-10 w-10">
                           <X className="w-6 h-6" />
                       </Button>
                   </div>
                ) : (
                    <input 
                        dir="auto"
                        disabled={isSubmitting || selectedImages.length > 0}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        className="bg-transparent border-none outline-none w-full text-lg md:text-xl placeholder:text-gray-600 text-white leading-tight" 
                        placeholder="Transmit message... (@ai)" 
                        type="text" 
                    />
                )}
             </div>
             
             {/* Dynamic Action Button: Send Text/Images vs Mic Record vs Stop Audio */}
             <div className="shrink-0 bg-white/5 backdrop-blur-md p-1 md:p-1.5 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-xl">
               {isRecording && !audioBase64 ? (
                   <Button type="button" onClick={stopRecording} className="w-12 h-12 md:w-14 md:h-14 bg-red-600 hover:bg-red-500 flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all">
                       <Square className="w-5 h-5 text-black fill-black" />
                   </Button>
               ) : audioBase64 ? (
                   <Button type="button" onClick={() => handleSendMessage(undefined, 'audio')} disabled={isSubmitting} className="w-12 h-12 md:w-14 md:h-14 bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-in zoom-in">
                       <Send className="w-6 h-6 text-black ml-1" />
                   </Button>
               ) : inputText.trim() || selectedImages.length > 0 ? (
                   <Button type="submit" disabled={isSubmitting} className="w-12 h-12 md:w-14 md:h-14 bg-white hover:bg-orange-500 flex items-center justify-center rounded-full shadow-xl transition-colors group">
                       <Send className="w-6 h-6 text-black transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform ml-1" />
                   </Button>
               ) : (
                   <Button type="button" onClick={startRecording} className="w-12 h-12 md:w-14 md:h-14 bg-transparent hover:bg-white/10 flex items-center justify-center rounded-full transition-all group">
                       <Mic className="w-6 h-6 md:w-7 md:h-7 text-gray-400 group-hover:text-orange-500" />
                   </Button> 
               )}
             </div>
           </form>
         </div>

      </div>

    </div>
  );
}
