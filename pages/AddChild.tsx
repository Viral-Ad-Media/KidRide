import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ConfirmModal, Input } from '../components/UIComponents';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Child } from '../types';

/** Adds a child, or edits/removes one when opened at /edit-child/:id. */
export const AddChild = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, addChild, updateChild, removeChild } = useAuth();
  const existing = id ? user?.children?.find((child) => child.id === id) : undefined;
  const isEdit = !!id;
  const [formData, setFormData] = useState({ name: '', age: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (existing) setFormData({ name: existing.name, age: String(existing.age), notes: existing.notes || '' });
  }, [existing?.id]);

  const handleSubmit = async () => {
    const age = parseInt(formData.age, 10);
    if (!formData.name.trim()) { setError('Enter your child\'s name.'); return; }
    if (!Number.isFinite(age) || age <= 0 || age > 18) { setError('Enter an age between 1 and 18.'); return; }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && existing) {
        await updateChild(existing.id, { name: formData.name.trim(), age, notes: formData.notes.trim() });
      } else {
        const newChild: Child = { id: `c-${Date.now()}`, name: formData.name.trim(), age, notes: formData.notes.trim() || undefined };
        await addChild(newChild);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this child profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!existing) return;
    setRemoving(true);
    try {
      await removeChild(existing.id);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this child profile.');
      setConfirmingRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  if (isEdit && !existing) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <p className="text-slate-600">This child profile could not be found.</p>
        <Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Child Profile' : 'Add Child Profile'}</h2>
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

        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <Button fullWidth onClick={() => void handleSubmit()} disabled={saving || !formData.name.trim() || !formData.age.trim()}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Profile'}
        </Button>
        {isEdit && (
          <button type="button" onClick={() => setConfirmingRemove(true)} className="w-full rounded-full py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
            Remove this child
          </button>
        )}
      </div>

      <ConfirmModal
        open={confirmingRemove}
        title={`Remove ${existing?.name || 'this child'}?`}
        body="Their profile is removed from your account. Past rides stay in your ride history. You cannot remove a child while they have a ride in progress."
        confirmLabel="Remove child"
        tone="danger"
        busy={removing}
        onConfirm={() => void confirmRemove()}
        onClose={() => setConfirmingRemove(false)}
      />
    </div>
  );
};
