import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/UIComponents';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Child } from '../types';

export const AddChild = () => {
  const navigate = useNavigate();
  const { addChild } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    notes: ''
  });

  const handleSubmit = async () => {
    const newChild: Child = {
      id: `c-${Date.now()}`,
      name: formData.name.trim(),
      age: parseInt(formData.age, 10),
      notes: formData.notes.trim() || undefined
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
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-900">Add Child Profile</h2>
      </div>

      <div className="surface-card space-y-6 rounded-[30px] p-6 sm:p-8">
        <div className="mb-6 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-blue-200 bg-blue-50">
            <UserPlus size={32} className="text-[#3A77FF]" />
          </div>
        </div>

        <Input
          label="Child's Name"
          placeholder="e.g. Leo"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />

        <Input
          label="Age"
          type="number"
          placeholder="e.g. 8"
          value={formData.age}
          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
        />

        <div className="mb-4 w-full">
          <label className="mb-1 block text-sm font-medium text-gray-700">Medical Notes / Allergies</label>
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-gray-200 p-4 focus:border-[#3A77FF] focus:outline-none"
            placeholder="e.g. Peanut allergy, carries EpiPen..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-500">
          Child profiles are currently saved without photos.
        </div>

        <Button fullWidth onClick={handleSubmit} disabled={!formData.name.trim() || !formData.age.trim()}>
          Save Profile
        </Button>
      </div>
    </div>
  );
};
