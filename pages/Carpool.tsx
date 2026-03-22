import React from 'react';
import { Card, Button } from '../components/UIComponents';
import { ArrowLeft, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Carpool = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="mb-2 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-100">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-xl font-bold">Team Carpools</h2>
      </div>

      <Card className="text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-blue-50 text-[#3A77FF]">
          <Users size={28} />
        </div>
        <h3 className="mt-5 text-2xl font-bold text-slate-950">No live carpool offers available</h3>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
          This board stays empty until verified parents or team organizers publish real ride offers.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate('/book')} className="sm:w-auto">
            Book a Standard Ride
          </Button>
          <Button variant="secondary" onClick={() => navigate('/dashboard')} className="sm:w-auto">
            Return to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
};
