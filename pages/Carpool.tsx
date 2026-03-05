import React from 'react';
import { Card, Button, Badge } from '../components/UIComponents';
import { MOCK_CARPOOLS } from '../constants';
import { ArrowLeft, Clock, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Carpool = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-bold">Team Carpools</h2>
            </div>
            <button className="text-[#3A77FF] text-sm font-semibold">Filters</button>
        </div>

        <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
                type="text" 
                placeholder="Search games, teams, or schools" 
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-200 focus:border-[#3A77FF] focus:outline-none"
            />
        </div>

        <div className="space-y-4">
            {MOCK_CARPOOLS.map(offer => (
                <Card key={offer.id}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <img src={offer.parentPhoto} className="w-12 h-12 rounded-full object-cover" />
                            <div>
                                <h4 className="font-bold text-gray-900">{offer.parentName}</h4>
                                <Badge type="team" />
                            </div>
                        </div>
                        <div className="text-right">
                             <span className="block text-2xl font-bold text-[#3A77FF]">${offer.pricePerSeat}</span>
                             <span className="text-xs text-gray-500">per seat</span>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                             <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                             {offer.eventName}
                        </div>
                        <div className="flex items-start gap-3 text-sm text-gray-600">
                            <Clock size={16} className="mt-0.5 shrink-0" />
                            <span>Departs {offer.departureTime}</span>
                        </div>
                        <div className="flex items-start gap-3 text-sm text-gray-600">
                            <MapPin size={16} className="mt-0.5 shrink-0" />
                            <span>{offer.fromLocation} to {offer.toLocation}</span>
                        </div>
                    </div>

                    <Button variant="secondary" fullWidth onClick={() => alert('Booking simulation: Seat reserved!')}>
                        Book Seat ({offer.seatsAvailable} left)
                    </Button>
                </Card>
            ))}
        </div>
    </div>
  );
};
