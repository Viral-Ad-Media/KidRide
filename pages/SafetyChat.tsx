
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ShieldAlert, Phone, Users, ChevronRight, ArrowLeft, Plus, X, AlertTriangle } from 'lucide-react';
import { generateSafetyResponse } from '../services/geminiService';
import { Button, Card, Input } from '../components/UIComponents';
import { useNavigate } from 'react-router-dom';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TrustedContact {
    id: string;
    name: string;
    phone: string;
    relation: string;
}

const MOCK_CONTACTS: TrustedContact[] = [
    { id: '1', name: 'Mom', phone: '(555) 123-4567', relation: 'Parent' },
    { id: '2', name: 'Uncle Joe', phone: '(555) 987-6543', relation: 'Relative' },
];

export const SafetyChat = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<'menu' | 'chat' | 'contacts'>('menu');
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(3);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm the KidRide Safety Assistant. Ask me anything about verifying drivers, carpool rules, or trip safety." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Contacts State
  const [contacts, setContacts] = useState(MOCK_CONTACTS);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });

  // SOS Logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (sosActive && sosCountdown > 0) {
        interval = setInterval(() => {
            setSosCountdown(prev => prev - 1);
        }, 1000);
    } else if (sosActive && sosCountdown === 0) {
        // Trigger simulation
        alert("EMERGENCY ALERT SIMULATION: Location sent to Trusted Contacts and 911.");
        setSosActive(false);
        setSosCountdown(3);
    }
    return () => clearInterval(interval);
  }, [sosActive, sosCountdown]);

  const handleSosClick = () => {
    if (sosActive) {
        setSosActive(false);
        setSosCountdown(3);
    } else {
        setSosActive(true);
    }
  };

  // Chat Logic
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages, view]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);
    const response = await generateSafetyResponse(userMsg);
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setIsTyping(false);
  };

  const handleAddContact = () => {
      if (newContact.name && newContact.phone) {
          setContacts([...contacts, { ...newContact, id: Date.now().toString() }]);
          setNewContact({ name: '', phone: '', relation: '' });
          setShowAddContact(false);
      }
  };

  // --- RENDER VIEWS ---

  if (view === 'chat') {
      return (
        <div className="flex flex-col h-[calc(100vh-140px)]">
            <div className="bg-white p-4 border-b border-gray-100 shadow-sm flex items-center gap-3">
                <button onClick={() => setView('menu')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <Bot className="text-[#3A77FF]" /> Safety Assistant
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
                        msg.role === 'user' 
                        ? 'bg-[#3A77FF] text-white rounded-br-none' 
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
                    }`}>
                        {msg.content}
                    </div>
                </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></span>
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-gray-100">
                <div className="flex gap-2">
                    <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask a safety question..." 
                        className="flex-1 h-12 px-4 rounded-xl border border-gray-200 focus:outline-none focus:border-[#3A77FF]"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={isTyping}
                        className="w-12 h-12 bg-[#3A77FF] rounded-xl flex items-center justify-center text-white hover:bg-blue-600 disabled:opacity-50"
                    >
                        <Send size={20} />
                    </button>
                </div>
            </div>
        </div>
      );
  }

  if (view === 'contacts') {
      return (
          <div className="space-y-6 animate-fade-in">
             <div className="flex items-center gap-4">
                <button onClick={() => setView('menu')} className="p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-bold text-gray-900">Trusted Contacts</h2>
            </div>

            <div className="space-y-4">
                {contacts.map(contact => (
                    <Card key={contact.id} className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold">
                                {contact.name[0]}
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900">{contact.name}</h4>
                                <p className="text-xs text-gray-500">{contact.relation} • {contact.phone}</p>
                            </div>
                        </div>
                        <button className="text-red-400 p-2 hover:bg-red-50 rounded-full"><X size={16} /></button>
                    </Card>
                ))}

                {showAddContact ? (
                    <Card className="border-2 border-[#3A77FF] bg-blue-50/50">
                        <h4 className="font-bold text-sm mb-3">Add New Contact</h4>
                        <div className="space-y-3">
                            <Input placeholder="Name" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
                            <Input placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                            <Input placeholder="Relation (e.g. Neighbor)" value={newContact.relation} onChange={e => setNewContact({...newContact, relation: e.target.value})} />
                            <div className="flex gap-2">
                                <Button onClick={handleAddContact} className="flex-1 h-10">Save</Button>
                                <Button variant="secondary" onClick={() => setShowAddContact(false)} className="flex-1 h-10">Cancel</Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <Button variant="secondary" fullWidth onClick={() => setShowAddContact(true)} className="border-dashed">
                        <Plus size={20} className="mr-2" /> Add Trusted Contact
                    </Button>
                )}
            </div>
          </div>
      );
  }

  // DEFAULT: MENU VIEW
  return (
    <div className="space-y-6">
       <h2 className="text-2xl font-bold text-gray-900">Safety Center</h2>

       {/* SOS BUTTON */}
       <div className="flex justify-center py-4">
           <button 
              onClick={handleSosClick}
              className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-200 ${
                  sosActive ? 'bg-red-600 scale-105' : 'bg-red-500 hover:bg-red-600 active:scale-95'
              }`}
           >
              {sosActive && (
                  <span className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping"></span>
              )}
              <ShieldAlert size={48} className="text-white mb-2" />
              <span className="text-white font-bold text-xl">
                  {sosActive ? `SENDING ${sosCountdown}` : 'SOS'}
              </span>
              <span className="text-white/80 text-xs mt-1 font-medium">
                  {sosActive ? 'Tap to Cancel' : 'Emergency'}
              </span>
           </button>
       </div>
       <p className="text-center text-xs text-gray-500 px-8">
           Pressing SOS will immediately share your live location with 911 and your Trusted Contacts.
       </p>

       <div className="grid grid-cols-2 gap-4 mt-8">
           <Card onClick={() => setView('contacts')} className="flex flex-col items-center justify-center py-6 gap-3 hover:border-green-200 hover:bg-green-50 transition-colors">
               <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                   <Users size={24} />
               </div>
               <div className="text-center">
                   <h3 className="font-bold text-gray-900">Trusted Contacts</h3>
                   <p className="text-xs text-gray-500">Manage who gets notified</p>
               </div>
           </Card>

           <Card onClick={() => setView('chat')} className="flex flex-col items-center justify-center py-6 gap-3 hover:border-blue-200 hover:bg-blue-50 transition-colors">
               <div className="w-12 h-12 bg-blue-100 text-[#3A77FF] rounded-full flex items-center justify-center">
                   <Bot size={24} />
               </div>
               <div className="text-center">
                   <h3 className="font-bold text-gray-900">Safety Assistant</h3>
                   <p className="text-xs text-gray-500">24/7 AI Help Support</p>
               </div>
           </Card>
       </div>

       <Card className="bg-yellow-50 border-yellow-100">
           <div className="flex gap-3">
               <AlertTriangle className="text-yellow-600 shrink-0" />
               <div>
                   <h4 className="font-bold text-yellow-800 text-sm">Safety Tip of the Day</h4>
                   <p className="text-xs text-yellow-700 mt-1">
                       Always verify the Trip Code and Safe Word with your driver before entering the vehicle.
                   </p>
               </div>
           </div>
       </Card>
    </div>
  );
};
