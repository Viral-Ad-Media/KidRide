import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Users, ArrowLeft, Plus, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { generateSafetyResponse } from '../services/geminiService';
import { Button, Card, Input } from '../components/UIComponents';

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

export const SafetyChat = () => {
  const [view, setView] = useState<'menu' | 'chat' | 'contacts'>('menu');
  const [sosNotice, setSosNotice] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm the KidRide Safety Assistant. Ask me anything about verifying drivers, carpool rules, or trip safety." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, view]);

  const handleSend = async () => {
    if (!input.trim()) {
      return;
    }

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    const response = await generateSafetyResponse(userMsg);
    setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    setIsTyping(false);
  };

  const handleAddContact = () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      return;
    }

    setContacts((prev) => [
      ...prev,
      {
        ...newContact,
        id: Date.now().toString(),
        name: newContact.name.trim(),
        phone: newContact.phone.trim(),
        relation: newContact.relation.trim()
      }
    ]);
    setNewContact({ name: '', phone: '', relation: '' });
    setShowAddContact(false);
  };

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
  };

  const handleSosClick = () => {
    setSosNotice('Emergency dispatch and live location sharing are not connected in this build. Call local emergency services directly if you need immediate help.');
  };

  if (view === 'chat') {
    return (
      <div className="flex h-[calc(100vh-140px)] flex-col">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white p-4 shadow-sm">
          <button onClick={() => setView('menu')} className="rounded-full p-2 hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Bot className="text-[#3A77FF]" /> Safety Assistant
          </h2>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                  msg.role === 'user'
                    ? 'rounded-br-none bg-[#3A77FF] text-white'
                    : 'rounded-bl-none border border-gray-200 bg-white text-gray-800 shadow-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-none border border-gray-200 bg-white p-4 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                <span className="delay-100 h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                <span className="delay-200 h-2 w-2 animate-bounce rounded-full bg-gray-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-100 bg-white p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
              placeholder="Ask a safety question..."
              className="h-12 flex-1 rounded-xl border border-gray-200 px-4 focus:border-[#3A77FF] focus:outline-none"
            />
            <button
              onClick={() => void handleSend()}
              disabled={isTyping}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3A77FF] text-white hover:bg-blue-600 disabled:opacity-50"
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
          <button onClick={() => setView('menu')} className="rounded-full p-2 hover:bg-gray-100">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-bold text-gray-900">Trusted Contacts</h2>
        </div>

        <div className="space-y-4">
          {contacts.map((contact) => (
            <Card key={contact.id} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 font-bold text-green-600">
                  {contact.name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{contact.name}</h4>
                  <p className="text-xs text-gray-500">{contact.relation || 'Trusted contact'} • {contact.phone}</p>
                </div>
              </div>
              <button onClick={() => handleRemoveContact(contact.id)} className="rounded-full p-2 text-red-400 hover:bg-red-50">
                <X size={16} />
              </button>
            </Card>
          ))}

          {contacts.length === 0 && !showAddContact && (
            <Card className="text-center">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-green-50 text-green-600">
                <Users size={24} />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-950">No trusted contacts yet</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Add the people you want ready before contact tools are connected to the app.
              </p>
            </Card>
          )}

          {showAddContact ? (
            <Card className="border-2 border-[#3A77FF] bg-blue-50/50">
              <h4 className="mb-3 text-sm font-bold">Add New Contact</h4>
              <div className="space-y-3">
                <Input placeholder="Name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
                <Input placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
                <Input placeholder="Relation (e.g. Neighbor)" value={newContact.relation} onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })} />
                <div className="flex gap-2">
                  <Button onClick={handleAddContact} className="h-10 flex-1">Save</Button>
                  <Button variant="secondary" onClick={() => setShowAddContact(false)} className="h-10 flex-1">Cancel</Button>
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Safety Center</h2>

      <div className="flex justify-center py-4">
        <button
          onClick={handleSosClick}
          className="flex h-40 w-40 flex-col items-center justify-center rounded-full bg-red-500 shadow-xl transition-all duration-200 hover:bg-red-600 active:scale-95"
        >
          <ShieldAlert size={48} className="mb-2 text-white" />
          <span className="text-xl font-bold text-white">SOS</span>
          <span className="mt-1 text-xs font-medium text-white/80">Emergency</span>
        </button>
      </div>

      <p className="px-8 text-center text-xs text-gray-500">
        Emergency dispatch and location sharing are not connected in this build. Use local emergency services if you need immediate help.
      </p>

      {sosNotice && (
        <Card className="border-red-100 bg-red-50">
          <p className="text-sm text-red-700">{sosNotice}</p>
        </Card>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4">
        <Card onClick={() => setView('contacts')} className="flex flex-col items-center justify-center gap-3 py-6 transition-colors hover:border-green-200 hover:bg-green-50">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <Users size={24} />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-gray-900">Trusted Contacts</h3>
            <p className="text-xs text-gray-500">Manage who should be ready to help</p>
          </div>
        </Card>

        <Card onClick={() => setView('chat')} className="flex flex-col items-center justify-center gap-3 py-6 transition-colors hover:border-blue-200 hover:bg-blue-50">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-[#3A77FF]">
            <Bot size={24} />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-gray-900">Safety Assistant</h3>
            <p className="text-xs text-gray-500">AI safety guidance</p>
          </div>
        </Card>
      </div>

      <Card className="border-yellow-100 bg-yellow-50">
        <div className="flex gap-3">
          <AlertTriangle className="shrink-0 text-yellow-600" />
          <div>
            <h4 className="text-sm font-bold text-yellow-800">Safety Tip of the Day</h4>
            <p className="mt-1 text-xs text-yellow-700">
              Always verify the trip code and safe word with your driver before entering the vehicle.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
