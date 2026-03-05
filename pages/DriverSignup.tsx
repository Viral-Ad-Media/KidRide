import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, FileUpload, CameraCapture, VerificationPhotos } from '../components/UIComponents';
import { ArrowLeft, Car, ShieldCheck, CheckCircle, AlertCircle, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const DriverSignup = () => {
  const navigate = useNavigate();
  const { submitDriverApplication } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  
  // Unified form state
  const [formData, setFormData] = useState({
    // Step 1
    fullName: '',
    email: '',
    phone: '',
    ssn: '',
    password: '',
    // Step 2
    make: '',
    model: '',
    year: '',
    color: '',
    plate: '',
    // Step 3
    licenseDoc: null as File | null,
    insuranceDoc: null as File | null,
    registrationDoc: null as File | null,
    verificationPhotos: null as VerificationPhotos | null
  });

  // Validation Logic
  const isStep1Valid = 
    formData.fullName.trim() !== '' && 
    formData.email.trim() !== '' && 
    formData.phone.trim() !== '' && 
    formData.ssn.trim() !== '' &&
    formData.password.trim() !== '';

  const isStep2Valid = 
    formData.make.trim() !== '' && 
    formData.model.trim() !== '' && 
    formData.year.trim() !== '' && 
    formData.color.trim() !== '' && 
    formData.plate.trim() !== '';

  const isStep3Valid = 
    formData.licenseDoc !== null && 
    formData.insuranceDoc !== null && 
    formData.registrationDoc !== null && 
    formData.verificationPhotos !== null;

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (field: keyof typeof formData, file: File) => {
    setFormData(prev => ({ ...prev, [field]: file }));
  };

  const handlePhotosCaptured = (photos: VerificationPhotos) => {
    setFormData(prev => ({ ...prev, verificationPhotos: photos }));
  };

  const handleNext = () => {
    if (step === 1 && isStep1Valid) setStep(2);
    if (step === 2 && isStep2Valid) setStep(3);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    if (!isStep3Valid) return;
    setLoading(true);
    try {
      await submitDriverApplication({
        phone: formData.phone,
        vehicle: {
          make: formData.make,
          model: formData.model,
          year: formData.year,
          color: formData.color,
          plate: formData.plate
        }
      });
      setLoading(false);
      setSubmitted(true);
    } catch (error) {
      console.error('Driver application submission failed:', error);
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Application Received!</h1>
        <p className="text-gray-600 max-w-sm mb-8">
          Your application has been successfully submitted. We are processing your background check. You will receive a notification once the check is completed and your application is approved.
        </p>
        <Button onClick={() => navigate('/')} className="flex items-center gap-2">
           <Home size={20} /> Return Home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-100 p-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button onClick={() => step === 1 ? navigate('/') : handleBack()} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <div>
             <h1 className="text-lg font-bold text-gray-900">Driver Application</h1>
             <p className="text-xs text-gray-500">Step {step} of 3</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">
        
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 text-[#3A77FF] rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Let's get you verified</h2>
                <p className="text-gray-500 mt-2">Join our community of trusted drivers.</p>
            </div>

            <div className="space-y-4">
                <Input 
                    label="Full Name" 
                    placeholder="e.g. Jane Doe" 
                    value={formData.fullName} 
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                />
                <Input 
                    label="Email Address" 
                    type="email" 
                    placeholder="jane@example.com" 
                    value={formData.email} 
                    onChange={(e) => handleInputChange('email', e.target.value)}
                />
                <Input 
                    label="Phone Number" 
                    type="tel" 
                    placeholder="(555) 123-4567" 
                    value={formData.phone} 
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                />
                <Input 
                    label="Social Security Number (SSN)" 
                    type="text" 
                    placeholder="XXX-XX-XXXX" 
                    value={formData.ssn} 
                    onChange={(e) => handleInputChange('ssn', e.target.value)}
                />
                <Input 
                    label="Password" 
                    type="password" 
                    placeholder="Create a secure password" 
                    value={formData.password} 
                    onChange={(e) => handleInputChange('password', e.target.value)}
                />
            </div>
            
            <div className="pt-4">
                <Button fullWidth onClick={handleNext} disabled={!isStep1Valid}>
                    Next: Vehicle Details
                </Button>
                {!isStep1Valid && (
                    <p className="text-center text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                        <AlertCircle size={12}/> All fields are required
                    </p>
                )}
            </div>
          </div>
        )}

        {/* Step 2: Vehicle Info */}
        {step === 2 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 text-[#3A77FF] rounded-full flex items-center justify-center mx-auto mb-4">
                    <Car size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Your Vehicle</h2>
                <p className="text-gray-500 mt-2">What will you be driving?</p>
            </div>

            <div className="space-y-4">
                <Input 
                    label="Vehicle Make" 
                    placeholder="e.g. Toyota" 
                    value={formData.make}
                    onChange={(e) => handleInputChange('make', e.target.value)}
                />
                <Input 
                    label="Vehicle Model" 
                    placeholder="e.g. Sienna" 
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-4">
                    <Input 
                        label="Year" 
                        placeholder="2020" 
                        value={formData.year}
                        onChange={(e) => handleInputChange('year', e.target.value)}
                    />
                    <Input 
                        label="Color" 
                        placeholder="Silver" 
                        value={formData.color}
                        onChange={(e) => handleInputChange('color', e.target.value)}
                    />
                </div>
                <Input 
                    label="License Plate" 
                    placeholder="ABC-1234" 
                    value={formData.plate}
                    onChange={(e) => handleInputChange('plate', e.target.value)}
                />
            </div>

            <div className="pt-4">
                <Button fullWidth onClick={handleNext} disabled={!isStep2Valid}>
                    Next: Documents
                </Button>
                {!isStep2Valid && (
                    <p className="text-center text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                        <AlertCircle size={12}/> All fields are required
                    </p>
                )}
            </div>
          </div>
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <div className="animate-fade-in space-y-6">
             <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Final Step</h2>
                <p className="text-gray-500 mt-2">Upload documents & verify identity.</p>
            </div>

            <div className="space-y-4">
                <FileUpload 
                    label="Driver's License (Front)" 
                    onFileSelect={(f) => handleFileSelect('licenseDoc', f)} 
                />
                <FileUpload 
                    label="Vehicle Insurance" 
                    onFileSelect={(f) => handleFileSelect('insuranceDoc', f)} 
                />
                <FileUpload 
                    label="Vehicle Registration" 
                    onFileSelect={(f) => handleFileSelect('registrationDoc', f)} 
                />
                
                <div className="border-t border-gray-100 pt-4">
                    <CameraCapture onCapture={handlePhotosCaptured} />
                    {formData.verificationPhotos && (
                        <p className="text-center text-xs text-green-600 mt-2 flex items-center justify-center gap-1 font-medium">
                            <CheckCircle size={12}/> 3D Photos Captured
                        </p>
                    )}
                </div>

                <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600">
                    <p>By submitting, you agree to a background check performed by our third-party provider.</p>
                </div>
            </div>

            <div className="pt-4">
                <Button fullWidth onClick={handleSubmit} disabled={!isStep3Valid || loading}>
                    {loading ? 'Submitting Application...' : 'Submit Application'}
                </Button>
                {!isStep3Valid && (
                    <p className="text-center text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                        <AlertCircle size={12}/> All documents and photos are required
                    </p>
                )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
