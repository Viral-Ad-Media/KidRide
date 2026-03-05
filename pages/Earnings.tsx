
import React from 'react';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { Card } from '../components/UIComponents';
import { useNavigate } from 'react-router-dom';

export const Earnings = () => {
    const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-900">Earnings</h2>
        
        <div className="bg-[#3A77FF] rounded-2xl p-6 text-white shadow-lg shadow-blue-500/30">
            <p className="text-blue-100 font-medium mb-1">Current Balance</p>
            <h1 className="text-4xl font-bold mb-4">$84.50</h1>
            <div className="flex gap-3">
                <button className="flex-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm py-2 rounded-lg text-sm font-semibold transition-colors">
                    Cash Out
                </button>
                <button className="flex-1 bg-white text-[#3A77FF] py-2 rounded-lg text-sm font-bold shadow-sm">
                    View Details
                </button>
            </div>
        </div>

        <h3 className="font-bold text-gray-900 mt-6">Recent Activity</h3>
        <div className="space-y-3">
            {[1,2,3].map(i => (
                <Card key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900">Trip Payment</p>
                            <p className="text-xs text-gray-500">Today, 2:30 PM</p>
                        </div>
                    </div>
                    <span className="font-bold text-green-600">+$18.50</span>
                </Card>
            ))}
        </div>
    </div>
  );
};
