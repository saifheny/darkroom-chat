import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { rtdb } from '../lib/firebase';
import { ref, set, push, get, serverTimestamp, onValue } from 'firebase/database';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LogOut, Plus, Clock, Terminal, ChevronRight } from 'lucide-react';
import { addMinutes } from 'date-fns';
import { stringToNumbers, numbersToString } from '../lib/utils';

export function Dashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [isCreating, setIsCreating] = useState(false);
  const [myRooms, setMyRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    const roomsRef = ref(rtdb, 'rooms');
    const unsub = onValue(roomsRef, (snapshot) => {
      if (snapshot.exists()) {
        const allRooms = snapshot.val();
        const userRooms = [];
        for (const [key, value] of Object.entries<any>(allRooms)) {
          if (value.creatorId === profile.userId || value.members?.[profile.userId]) {
             userRooms.push({ id: key, ...value, name: numbersToString(value.name) });
          }
        }
        // sort by newest
        userRooms.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
        setMyRooms(userRooms);
      }
    });
    return () => unsub();
  }, [profile]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsCreating(true);

    try {
      const roomsRef = ref(rtdb, 'rooms');
      const expiresAt = addMinutes(new Date(), minutes).getTime();
      
      const newRoomRef = push(roomsRef);
      await set(newRoomRef, {
        creatorId: profile.userId,
        name: stringToNumbers(roomName || 'Dark Room'),
        linkExpiresAt: expiresAt,
        createdAt: serverTimestamp(),
        members: {
          [profile.userId]: { joinedAt: serverTimestamp() }
        }
      });

      navigate(`/room/${newRoomRef.key}`);

    } catch (error) {
       console.error("Failed to create room:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen p-6 max-w-5xl mx-auto font-sans relative z-10 w-full overflow-hidden">
      <div className="absolute inset-x-0 -top-40 h-[500px] w-full bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none blur-3xl"></div>
      
      <header className="flex items-center justify-between py-6 mb-8 relative z-20">
        <div className="flex items-center gap-3">
           <Terminal className="w-6 h-6 text-orange-500" />
           <span className="font-mono font-bold tracking-wider text-white uppercase">Terminal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-full pl-1 pr-4 py-1 shadow-inner">
             {profile?.photoData ? (
               <img src={profile.photoData} alt="" className="w-8 h-8 rounded-full object-cover border border-neutral-700" />
             ) : (
               <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                 {profile?.displayName?.[0] || "?"}
               </div>
             )}
             <span className="text-sm font-medium text-neutral-300 truncate max-w-[100px]">{profile?.displayName}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => signOut()}>
            <LogOut className="w-5 h-5 text-neutral-500 hover:text-orange-500 transition-colors" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row gap-8 relative z-20 items-start">
         
         <div className="w-full md:w-1/2 p-8 rounded-[2rem] bg-[#0A0A0A]/90 border border-white/5 backdrop-blur-sm shadow-2xl relative overflow-hidden">
           <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50"></div>
           <div className="text-center mb-8">
             <h2 className="text-3xl font-black tracking-tight mb-3 text-white uppercase uppercase">Initialize Protocol</h2>
             <p className="text-neutral-500 text-sm">Create a secure container for encrypted dialogue.</p>
           </div>

           <form onSubmit={handleCreateRoom} className="space-y-6">
             <div className="space-y-2">
               <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest pl-4">Room Designation</label>
               <Input 
                 placeholder="e.g. Echo Base" 
                 value={roomName}
                 onChange={e => setRoomName(e.target.value)}
                 className="h-14 rounded-full px-6 bg-black border-neutral-800 text-white focus-visible:ring-orange-500/50 transition-all text-base"
               />
             </div>

             <div className="space-y-2">
               <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest pl-4">Expiration (Minutes)</label>
               <div className="relative">
                 <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
                 <Input 
                   type="number"
                   min="1"
                   max="1440"
                   value={minutes}
                   onChange={e => setMinutes(parseInt(e.target.value) || 1)}
                   className="h-14 rounded-full pl-14 pr-6 bg-black border-neutral-800 font-mono text-white focus-visible:ring-orange-500/50 transition-all text-base"
                 />
               </div>
             </div>

             <Button 
               type="submit" 
               className="w-full h-14 rounded-full bg-orange-600 text-black hover:bg-orange-500 text-lg font-bold tracking-widest uppercase group relative overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.3)] border border-white/20 transition-all hover:scale-[1.02]" 
               disabled={isCreating}
             >
               {isCreating ? 'Provisioning...' : (
                 <span className="flex items-center justify-center gap-2 relative z-10 text-white group-hover:text-black transition-colors">
                   <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                   Generate Link
                 </span>
               )}
             </Button>
           </form>
         </div>

         <div className="w-full md:w-1/2 p-8 rounded-[2rem] bg-[#050505]/90 border border-white/5 backdrop-blur-sm shadow-2xl relative overflow-hidden min-h-[400px] flex flex-col">
            <h3 className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold mb-6">Vault (Your Rooms)</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pb-safe pr-2">
               {myRooms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                    <Terminal className="w-10 h-10 text-neutral-600 mb-4" />
                    <p className="text-sm text-neutral-500 uppercase tracking-wider font-mono">No Active Transmissions</p>
                  </div>
               ) : (
                 myRooms.map(room => (
                   <div 
                     key={room.id}
                     onClick={() => navigate(`/room/${room.id}`)}
                     className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-orange-500/30 hover:bg-white/10 transition-all cursor-pointer group flex items-center justify-between"
                   >
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-medium text-base truncate pr-4">{room.name || 'Dark Room'}</p>
                        <p className="text-xs text-neutral-500 font-mono mt-1">
                          {room.creatorId === profile.userId ? <span className="text-emerald-500">Creator</span> : 'Member'}
                          {" • "}
                          {(room.linkExpiresAt && room.linkExpiresAt < Date.now()) ? <span className="text-red-500">Expired Link</span> : 'Active'}
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-black border border-white/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-orange-400 group-hover:text-black transition-colors text-neutral-400 shrink-0">
                         <ChevronRight className="w-4 h-4" />
                      </div>
                   </div>
                 ))
               )}
            </div>
         </div>

      </main>
    </div>
  );
}
