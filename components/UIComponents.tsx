
import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, Users, Crown, Upload, CheckCircle, Camera, RefreshCw, XCircle, ArrowRight, Check } from 'lucide-react';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyle = "min-h-[52px] rounded-[18px] px-6 text-sm font-semibold tracking-[-0.01em] transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgba(29,111,255,0.35)] disabled:cursor-not-allowed disabled:opacity-55";
  const variants = {
    primary: "border border-transparent bg-[linear-gradient(135deg,#1257db_0%,#1d6fff_58%,#66b8ff_100%)] text-white shadow-[0_18px_36px_rgba(29,111,255,0.24)] hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(29,111,255,0.3)]",
    secondary: "border border-slate-200 bg-white/82 text-slate-800 shadow-[0_14px_28px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50",
    destructive: "border border-transparent bg-[linear-gradient(135deg,#ef4444_0%,#f97316_100%)] text-white shadow-[0_18px_36px_rgba(239,68,68,0.18)] hover:-translate-y-0.5",
    ghost: "border border-transparent bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, className = '', ...props }) => {
  return (
    <div className="w-full mb-4">
      {label && <label className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>}
      <input 
        className={`h-[54px] w-full rounded-[18px] border border-slate-200 bg-white/88 px-4 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-all placeholder:text-slate-400 focus:border-[#1d6fff] focus:outline-none focus:ring-4 focus:ring-[rgba(29,111,255,0.12)] ${className}`}
        {...props}
      />
    </div>
  );
};

// --- File Upload ---
interface FileUploadProps {
    label: string;
    onFileSelect?: (file: File) => void;
}
export const FileUpload: React.FC<FileUploadProps> = ({ label, onFileSelect }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = React.useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFileName(file.name);
            if (onFileSelect) {
                onFileSelect(file);
            }
        }
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange}
            />
            <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors cursor-pointer group ${fileName ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-[#3A77FF] hover:bg-blue-50'}`}
            >
                {fileName ? (
                    <>
                        <CheckCircle size={24} className="mb-2 text-green-500" />
                        <span className="text-xs font-medium text-green-700 truncate max-w-full px-4">{fileName}</span>
                    </>
                ) : (
                    <>
                        <Upload size={24} className="mb-2 text-gray-400 group-hover:text-[#3A77FF]" />
                        <span className="text-xs text-gray-400 group-hover:text-[#3A77FF]">Click to upload</span>
                    </>
                )}
            </div>
        </div>
    );
};

// --- Camera Capture (3D Verification) ---
export interface VerificationPhotos {
    front: string;
    left: string;
    right: string;
}

interface CameraCaptureProps {
    onCapture?: (photos: VerificationPhotos) => void;
}

type CaptureStep = 'intro' | 'front' | 'left' | 'right' | 'review';

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [step, setStep] = useState<CaptureStep>('intro');
    const [photos, setPhotos] = useState<Partial<VerificationPhotos>>({});
    const [error, setError] = useState<string | null>(null);

    const startCamera = async () => {
        try {
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user' } 
            });
            setStream(mediaStream);
            setStep('front');
            // Delay to allow video element to mount
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            }, 100);
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Could not access camera. Please allow camera permissions.");
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const captureCurrentStep = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            if (context) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageDataUrl = canvas.toDataURL('image/jpeg');
                
                if (step === 'front') {
                    setPhotos(prev => ({ ...prev, front: imageDataUrl }));
                    setStep('left');
                } else if (step === 'left') {
                    setPhotos(prev => ({ ...prev, left: imageDataUrl }));
                    setStep('right');
                } else if (step === 'right') {
                    setPhotos(prev => ({ ...prev, right: imageDataUrl }));
                    setStep('review');
                    stopCamera();
                }
            }
        }
    };

    const confirmPhotos = () => {
        if (photos.front && photos.left && photos.right && onCapture) {
            onCapture(photos as VerificationPhotos);
        }
    };

    const retakeAll = () => {
        setPhotos({});
        startCamera();
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [stream]);

    // Instructions based on step
    const getInstruction = () => {
        switch(step) {
            case 'front': return "Look Straight Ahead";
            case 'left': return "Turn Head Left";
            case 'right': return "Turn Head Right";
            default: return "";
        }
    };

    return (
        <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">Live 3D Verification</label>
            
            <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 relative aspect-[3/4] max-h-[400px] flex flex-col items-center justify-center">
                
                {step === 'intro' && (
                    <div className="flex flex-col items-center gap-3 p-4 text-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-[#3A77FF] mb-2">
                            <Camera size={32} />
                        </div>
                        <h3 className="font-semibold text-gray-900">Liveness Check</h3>
                        <p className="text-xs text-gray-500 max-w-[220px]">
                            We need 3 photos: Front, Left, and Right views of your face.
                        </p>
                        <Button type="button" onClick={startCamera} className="mt-2 h-10 text-sm">
                            Start Camera
                        </Button>
                    </div>
                )}

                {(step === 'front' || step === 'left' || step === 'right') && (
                     <div className="relative w-full h-full bg-black">
                        <video 
                           ref={videoRef} 
                           autoPlay 
                           playsInline 
                           muted
                           className="w-full h-full object-cover transform scale-x-[-1]" 
                       />
                       <canvas ref={canvasRef} className="hidden" />
                       
                       {/* Instruction Overlay */}
                       <div className="absolute top-6 left-0 right-0 text-center">
                           <span className="bg-black/50 text-white px-4 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                               {getInstruction()}
                           </span>
                       </div>

                       <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                           <button 
                               onClick={captureCurrentStep}
                               className="bg-white p-1 rounded-full border-4 border-gray-200/50 hover:scale-105 transition-transform"
                           >
                               <div className="w-16 h-16 bg-white border-4 border-[#3A77FF] rounded-full"></div>
                           </button>
                       </div>
                   </div>
                )}

                {step === 'review' && (
                    <div className="w-full h-full p-4 flex flex-col items-center justify-center bg-white">
                        <div className="grid grid-cols-3 gap-2 w-full mb-6">
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                                <img src={photos.front} className="w-full h-full object-cover" />
                                <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">Front</span>
                            </div>
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                                <img src={photos.left} className="w-full h-full object-cover" />
                                <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">Left</span>
                            </div>
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                                <img src={photos.right} className="w-full h-full object-cover" />
                                <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">Right</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 w-full">
                            <Button onClick={confirmPhotos} className="w-full h-10 text-sm flex items-center justify-center gap-2">
                                <Check size={16} /> Confirm Photos
                            </Button>
                            <button onClick={retakeAll} className="text-sm text-gray-500 hover:text-gray-800 flex items-center justify-center gap-2">
                                <RefreshCw size={14} /> Retake All
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
        </div>
    );
};


// --- Select ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
}

export const Select: React.FC<SelectProps> = ({ label, children, className = '', ...props }) => {
    return (
      <div className="w-full mb-4">
        {label && <label className="mb-2 block text-sm font-semibold text-slate-700">{label}</label>}
        <div className="relative">
            <select 
            className={`h-[54px] w-full appearance-none rounded-[18px] border border-slate-200 bg-white/88 px-4 text-slate-900 transition-all focus:border-[#1d6fff] focus:outline-none focus:ring-4 focus:ring-[rgba(29,111,255,0.12)] ${className}`}
            {...props}
            >
            {children}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
      </div>
    );
};

// --- Card ---
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`surface-card rounded-[28px] p-5 sm:p-6 ${onClick ? 'cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(15,23,42,0.1)]' : ''} ${className}`}
    >
      {children}
    </div>
  );
};

// --- Badges ---
export const Badge: React.FC<{ type: 'verified' | 'gold' | 'team' }> = ({ type }) => {
  if (type === 'verified') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-[#26C281]">
        <ShieldCheck size={12} className="mr-1" /> Verified
      </span>
    );
  }
  if (type === 'gold') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-yellow-100 text-yellow-700">
        <Crown size={12} className="mr-1" /> Gold Verified
      </span>
    );
  }
  if (type === 'team') {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-orange-100 text-[#FFA93A]">
        <Users size={12} className="mr-1" /> Team Parent
      </span>
    );
  }
  return null;
};

// --- Status Chip ---
export const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  let colorClass = "bg-gray-100 text-gray-600";
  let label = status.replace(/_/g, ' ');

  if (['driver_assigned', 'driver_arrived_at_pickup'].includes(status)) {
    colorClass = "bg-blue-100 text-[#3A77FF]";
  } else if (['child_picked_up'].includes(status)) {
    colorClass = "bg-green-100 text-[#26C281]";
  } else if (['searching_driver'].includes(status)) {
    colorClass = "bg-orange-100 text-[#FFA93A] animate-pulse";
  }

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${colorClass}`}>
      {label}
    </span>
  );
};
