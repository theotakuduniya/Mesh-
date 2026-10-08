import React, { useState } from 'react';
import {
  Compass,
  ShieldCheck,
  FolderLock,
  Radio,
  Split,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Laptop,
  Lock,
} from 'lucide-react';
import { useMesh } from '../../context/MeshContext';

export const OnboardingModal: React.FC = () => {
  const { isOnboardingOpen, setIsOnboardingOpen, setIsDualModeOpen } = useMesh();
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOnboardingOpen) return null;

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mesh_onboarding_dismissed', 'true');
    }
    setIsOnboardingOpen(false);
  };

  const steps = [
    {
      title: 'Local-First Collaboration',
      subtitle: 'Zero Cloud · Same Local Network',
      icon: Compass,
      iconColor: 'text-blue-400',
      bgColor: 'bg-blue-600/10 border-blue-500/20',
      description:
        'Mesh transforms your local Wi-Fi or Ethernet network into a private collaboration space. Discover nearby desktop computers automatically via mDNS without user accounts or external cloud storage.',
      highlight: 'Unpaired devices cannot browse files or access storage.',
    },
    {
      title: 'Cryptographic Pairing',
      subtitle: 'Explicit Mutual Trust',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
      bgColor: 'bg-emerald-600/10 border-emerald-500/20',
      description:
        'Computers must pair explicitly before accessing shared resources. Both screens verify an identical 6-digit cryptographic safety code to prevent local spoofing.',
      highlight: 'Pairing only grants access to virtual spaces explicitly authorized by the owner.',
    },
    {
      title: 'Virtual Shared Space',
      subtitle: 'Filesystem Isolation Architecture',
      icon: FolderLock,
      iconColor: 'text-amber-400',
      bgColor: 'bg-amber-600/10 border-amber-500/20',
      description:
        'Connect real files and folders directly from your computer storage. Mesh indexes them locally and assigns safe virtual paths (e.g. /College or /Media). Your real disk paths are never exposed over LAN.',
      highlight: 'Pick real folders or files from your PC desktop with 1 click in Shared Space.',
    },
    {
      title: 'Direct Media Streaming',
      subtitle: 'Progressive Range Playback',
      icon: Radio,
      iconColor: 'text-purple-400',
      bgColor: 'bg-purple-600/10 border-purple-500/20',
      description:
        'Stream lecture videos and audio files directly between peers over high-speed WebRTC data channels. The media player requests progressive byte ranges so playback begins instantly without downloading full files.',
      highlight: 'Instant seek and play with live LAN bitrate telemetry.',
    },
    {
      title: 'Connecting Multiple Devices',
      subtitle: 'Zero Configuration Discovery',
      icon: Laptop,
      iconColor: 'text-cyan-400',
      bgColor: 'bg-cyan-600/10 border-cyan-500/20',
      description:
        'To collaborate across physical computers, simply open this web app URL on your other computer or mobile device. Both devices will discover each other automatically over the local network mesh.',
      highlight: 'You can also share your pairing link or enter peer IDs directly.',
    },
  ];

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#111319] border border-white/15 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="p-4 px-6 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-xs font-display">Mesh Guide</span>
            <span className="text-zinc-600">·</span>
            <span className="text-xs text-zinc-400 font-mono tabular-nums">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Content */}
        <div className="p-6 space-y-5">
          {/* Step Icon & Title */}
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${step.bgColor}`}>
              <Icon className={`w-6 h-6 ${step.iconColor}`} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {step.subtitle}
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight font-display mt-0.5">
                {step.title}
              </h2>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-zinc-300 leading-relaxed">
            {step.description}
          </p>

          {/* Key Principle / Highlight Box */}
          <div className="p-3 rounded-lg bg-zinc-900/80 border border-white/5 flex items-center gap-2.5 text-xs text-zinc-300">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-[11px] text-zinc-300">{step.highlight}</span>
          </div>

          {/* Dual Lab Quick Trigger commented out for production
          {isLast && (
            <div className="pt-1">
              <button onClick={() => { handleClose(); setIsDualModeOpen(true); }} className="...">Open Dual Node Lab Now</button>
            </div>
          )} */}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-zinc-950/60 border-t border-white/[0.04] flex items-center justify-between">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-6 bg-blue-500'
                    : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
                }`}
                title={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep((s) => s - 1)}
                className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white rounded-md transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            {isLast ? (
              <button
                onClick={handleClose}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>Get Started</span>
                <Check className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep((s) => s + 1)}
                className="px-4 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white rounded-md transition-colors flex items-center gap-1"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
