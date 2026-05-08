import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Camera, ShieldAlert } from 'lucide-react';

export function Welcome() {
  const { signIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (profile && !loading) {
      navigate('/dashboard');
    }
  }, [profile, loading, navigate]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1000000) {
        alert('File size must be under 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await signIn(name, photo);
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="relative flex flex-col justify-center items-center min-h-screen p-4 md:p-8 bg-black overflow-hidden font-sans w-full">
      
      {/* Animated Background */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/40 via-black to-black animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-1/4 left-1/4 w-[40vw] h-[40vw] bg-orange-600/10 blur-[100px] rounded-full mix-blend-screen animate-blob"></div>
        <div className="absolute top-3/4 right-1/4 w-[50vw] h-[50vw] bg-rose-600/10 blur-[120px] rounded-full mix-blend-screen animate-blob animation-delay-2000"></div>
      </div>
      
      {/* Content Container */}
      <div className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 z-10 relative">

        <div className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left space-y-6">
          <div className="w-16 h-16 rounded mb-2 border border-white/10 flex items-center justify-center bg-white/5 shadow-[0_0_30px_rgba(249,115,22,0.3)] shrink-0">
             <ShieldAlert className="w-8 h-8 text-orange-500" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500 tracking-tighter uppercase leading-tight">
            Encrypted <br className="hidden md:block"/> Terminal
          </h1>
          <p className="text-neutral-400 text-sm md:text-base max-w-sm tracking-wide leading-relaxed">
            Initialize your neural connection. Create temporary rooms, share data, and auto-destruct when finished. 
            All transmissions encoded.
          </p>
        </div>

        <div className="w-full md:w-[450px] p-8 md:p-10 rounded-[2rem] bg-[#0A0A0A]/80 border border-white/5 shadow-2xl backdrop-blur-xl relative">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-orange-500/20 to-transparent rounded-[2rem] blur opacity-50 z-[-1]"></div>
          
          <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-widest text-center">Registration</h2>
          <p className="text-xs text-neutral-500 mb-8 text-center uppercase tracking-widest">Establish Identity</p>

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-28 h-28 rounded-full bg-black border border-white/10 overflow-hidden group flex items-center justify-center shadow-inner cursor-pointer hover:border-orange-500/50 transition-colors">
                {photo ? (
                  <img src={photo} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center">
                    <Camera className="w-8 h-8 text-neutral-700 transition-colors group-hover:text-orange-500" />
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handlePhotoUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">Upload Visage</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono ml-4">Alias</label>
              <Input 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Designation..." 
                maxLength={40}
                required
                className="h-14 rounded-full px-6 bg-black border-white/10 text-white placeholder:text-neutral-700 text-sm focus-visible:ring-orange-500/50"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 rounded-full bg-white text-black hover:bg-orange-500 hover:text-white transition-all text-sm font-bold uppercase tracking-widest disabled:opacity-50" 
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Authenticating...' : 'Enter Hub'}
            </Button>
          </form>
        </div>

      </div>
    </div>
  );
}

