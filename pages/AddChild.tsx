import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, FileUpload } from '../components/UIComponents';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Child } from '../types';

export const AddChild = () => {
  const navigate = useNavigate();
  const { addChild } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    notes: '',
    photo: null as File | null
  });

  const handleSubmit = async () => {
    const newChild: Child = {
        id: `c-${Date.now()}`,
        name: formData.name,
        age: parseInt(formData.age),
        notes: formData.notes,
        // In a real app we'd upload the file and get a URL.
        // For demo, we use a placeholder if no photo or create a fake URL object
        photoUrl: formData.photo 
            ? URL.createObjectURL(formData.photo) 
            : `https://ui-avatars.com/api/?name=${formData.name}&background=random`
    };

    try {
      await addChild(newChild);
      navigate('/dashboard');
    } catch (error) {
      console.error('Unable to add child profile:', error);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-900">Add Child Profile</h2>
        </div>

        <div className="surface-card space-y-6 rounded-[30px] p-6 sm:p-8">
            <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center border-2 border-dashed border-blue-200">
                    <UserPlus size={32} className="text-[#3A77FF]" />
                </div>
            </div>

            <Input 
                label="Child's Name" 
                placeholder="e.g. Leo" 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
            />
            
            <Input 
                label="Age" 
                type="number"
                placeholder="e.g. 8" 
                value={formData.age}
                onChange={e => setFormData({...formData, age: e.target.value})}
            />

            <div className="w-full mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Medical Notes / Allergies</label>
                <textarea 
                    className="w-full rounded-xl border border-gray-200 p-4 focus:outline-none focus:border-[#3A77FF] min-h-[100px]"
                    placeholder="e.g. Peanut allergy, carries EpiPen..."
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                />
            </div>

            <FileUpload 
                label="Upload Photo" 
                onFileSelect={f => setFormData({...formData, photo: f})}
            />

            <Button fullWidth onClick={handleSubmit} disabled={!formData.name || !formData.age}>
                Save Profile
            </Button>
        </div>
    </div>
  );
};
