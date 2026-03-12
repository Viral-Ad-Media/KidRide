import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, FileUpload, CameraCapture, VerificationPhotos } from '../components/UIComponents';
import { ArrowLeft, Car, ShieldCheck, CheckCircle, AlertCircle, Home } from 'lucide-react';
import { getDefaultRouteForUser, useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/api';
import { UserRole } from '../types';

export const DriverSignup = () => {
  const navigate = useNavigate();
  const { user, register, submitDriverApplication } = useAuth();
  const requiresAccountCreation = !user;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    ssn: '',
    password: '',
    make: '',
    model: '',
    year: '',
    color: '',
    plate: '',
    licenseDoc: null as File | null,
    insuranceDoc: null as File | null,
    registrationDoc: null as File | null,
    verificationPhotos: null as VerificationPhotos | null
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormData((current) => ({
      ...current,
      fullName: current.fullName || user.name,
      email: current.email || user.email,
      phone: current.phone || ''
    }));
  }, [user]);

  const isStep1Valid =
    formData.phone.trim() !== '' &&
    formData.ssn.trim() !== '' &&
    (!requiresAccountCreation ||
      (
        formData.fullName.trim() !== '' &&
        formData.email.trim() !== '' &&
        formData.password.trim() !== ''
      ));

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
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const handleFileSelect = (field: keyof typeof formData, file: File) => {
    setFormData((current) => ({ ...current, [field]: file }));
  };

  const handlePhotosCaptured = (photos: VerificationPhotos) => {
    setFormData((current) => ({ ...current, verificationPhotos: photos }));
  };

  const handleNext = () => {
    setError(null);

    if (step === 1 && isStep1Valid) {
      setStep(2);
    }

    if (step === 2 && isStep2Valid) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((current) => current - 1);
  };

  const handleSubmit = async () => {
    if (!isStep3Valid) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (requiresAccountCreation) {
        await register({
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
          role: UserRole.DRIVER
        });
      }

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

      setSubmitted(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof ApiError
          ? submissionError.message
          : 'Driver application submission failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleExit = () => {
    if (step > 1) {
      handleBack();
      return;
    }

    if (user?.role === UserRole.PARENT) {
      navigate('/profile');
      return;
    }

    navigate('/drive');
  };

  if (submitted) {
    const successDestination = user?.role === UserRole.PARENT ? '/profile' : (user ? getDefaultRouteForUser(user) : '/driver-dashboard');

    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <CheckCircle size={48} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Application Received!</h1>
        <p className="text-gray-600 max-w-sm mb-8">
          Your application has been submitted. We are processing your background check and will update your account status once review is complete.
        </p>
        <Button onClick={() => navigate(successDestination)} className="flex items-center gap-2">
          <Home size={20} />
          {user?.role === UserRole.PARENT ? 'Return to Profile' : 'Open Driver Dashboard'}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 border-b border-gray-100 p-4">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <button onClick={handleExit} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Driver Application</h1>
            <p className="text-xs text-gray-500">Step {step} of 3</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">
        {step === 1 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 text-[#3A77FF] rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Let&apos;s get you verified</h2>
              <p className="text-gray-500 mt-2">
                {requiresAccountCreation
                  ? 'Create your driver account and start the verification process.'
                  : 'Continue your verification using the account you are already signed into.'}
              </p>
            </div>

            <div className="space-y-4">
              {requiresAccountCreation ? (
                <>
                  <Input
                    label="Full Name"
                    placeholder="e.g. Jane Doe"
                    value={formData.fullName}
                    onChange={(event) => handleInputChange('fullName', event.target.value)}
                    autoComplete="name"
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="jane@example.com"
                    value={formData.email}
                    onChange={(event) => handleInputChange('email', event.target.value)}
                    autoComplete="email"
                  />
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Create a secure password"
                    value={formData.password}
                    onChange={(event) => handleInputChange('password', event.target.value)}
                    autoComplete="new-password"
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-950">{user?.name}</p>
                  <p className="mt-1 text-sm text-blue-700">{user?.email}</p>
                </div>
              )}

              <Input
                label="Phone Number"
                type="tel"
                placeholder="(555) 123-4567"
                value={formData.phone}
                onChange={(event) => handleInputChange('phone', event.target.value)}
                autoComplete="tel"
              />
              <Input
                label="Social Security Number (SSN)"
                type="text"
                placeholder="XXX-XX-XXXX"
                value={formData.ssn}
                onChange={(event) => handleInputChange('ssn', event.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="pt-4">
              <Button fullWidth onClick={handleNext} disabled={!isStep1Valid}>
                Next: Vehicle Details
              </Button>
              {!isStep1Valid && (
                <p className="text-center text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                  <AlertCircle size={12} />
                  {requiresAccountCreation
                    ? 'Name, email, password, phone, and SSN are required'
                    : 'Phone number and SSN are required'}
                </p>
              )}
            </div>
          </div>
        )}

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
                onChange={(event) => handleInputChange('make', event.target.value)}
              />
              <Input
                label="Vehicle Model"
                placeholder="e.g. Sienna"
                value={formData.model}
                onChange={(event) => handleInputChange('model', event.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Year"
                  placeholder="2020"
                  value={formData.year}
                  onChange={(event) => handleInputChange('year', event.target.value)}
                />
                <Input
                  label="Color"
                  placeholder="Silver"
                  value={formData.color}
                  onChange={(event) => handleInputChange('color', event.target.value)}
                />
              </div>
              <Input
                label="License Plate"
                placeholder="ABC-1234"
                value={formData.plate}
                onChange={(event) => handleInputChange('plate', event.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="pt-4">
              <Button fullWidth onClick={handleNext} disabled={!isStep2Valid}>
                Next: Documents
              </Button>
              {!isStep2Valid && (
                <p className="text-center text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                  <AlertCircle size={12} />
                  All vehicle fields are required
                </p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Final Step</h2>
              <p className="text-gray-500 mt-2">Upload documents and verify identity.</p>
            </div>

            <div className="space-y-4">
              <FileUpload
                label="Driver&apos;s License (Front)"
                onFileSelect={(file) => handleFileSelect('licenseDoc', file)}
              />
              <FileUpload
                label="Vehicle Insurance"
                onFileSelect={(file) => handleFileSelect('insuranceDoc', file)}
              />
              <FileUpload
                label="Vehicle Registration"
                onFileSelect={(file) => handleFileSelect('registrationDoc', file)}
              />

              <div className="border-t border-gray-100 pt-4">
                <CameraCapture onCapture={handlePhotosCaptured} />
                {formData.verificationPhotos && (
                  <p className="text-center text-xs text-green-600 mt-2 flex items-center justify-center gap-1 font-medium">
                    <CheckCircle size={12} />
                    3D photos captured
                  </p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-600">
                <p>By submitting, you agree to a background check performed by our third-party provider.</p>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="pt-4">
              <Button fullWidth onClick={handleSubmit} disabled={!isStep3Valid || loading}>
                {loading
                  ? (requiresAccountCreation ? 'Creating account and submitting...' : 'Submitting application...')
                  : 'Submit Application'}
              </Button>
              {!isStep3Valid && (
                <p className="text-center text-xs text-red-400 mt-2 flex items-center justify-center gap-1">
                  <AlertCircle size={12} />
                  All documents and photos are required
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
