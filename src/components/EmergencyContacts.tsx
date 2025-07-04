import { useState } from "react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  priority: 'high' | 'medium' | 'low';
}

export function EmergencyContacts() {
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: '1',
      name: 'Emergency Services',
      phone: '911',
      role: 'Emergency Response',
      priority: 'high'
    },
    {
      id: '2',
      name: 'Fire Department',
      phone: '911',
      role: 'Fire Emergency',
      priority: 'high'
    },
    {
      id: '3',
      name: 'Police Department',
      phone: '911',
      role: 'Police Emergency',
      priority: 'high'
    }
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    role: '',
    priority: 'medium' as const
  });

  const handleCall = (phone: string, name: string) => {
    if (phone) {
      window.open(`tel:${phone}`);
      toast.success(`Calling ${name}...`);
    }
  };

  const handleSMS = (phone: string, name: string) => {
    if (phone) {
      window.open(`sms:${phone}`);
      toast.success(`Opening SMS to ${name}...`);
    }
  };

  const handleEmail = (email: string, name: string) => {
    if (email) {
      window.open(`mailto:${email}`);
      toast.success(`Opening email to ${name}...`);
    }
  };

  const addContact = () => {
    if (!newContact.name || !newContact.phone) {
      toast.error("Name and phone are required");
      return;
    }

    const contact: Contact = {
      id: Date.now().toString(),
      ...newContact
    };

    setContacts([...contacts, contact]);
    setNewContact({ name: '', phone: '', email: '', role: '', priority: 'medium' });
    setShowAddForm(false);
    toast.success("Contact added");
  };

  const removeContact = (id: string) => {
    setContacts(contacts.filter(c => c.id !== id));
    toast.success("Contact removed");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">📞 Emergency Contacts</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showAddForm ? "Cancel" : "Add Contact"}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Name"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Role"
              value={newContact.role}
              onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={newContact.priority}
              onChange={(e) => setNewContact({ ...newContact, priority: e.target.value as any })}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
            <button
              onClick={addContact}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Add Contact
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {contacts.map((contact) => (
          <div key={contact.id} className="border rounded-lg p-4 hover:bg-gray-50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-semibold text-lg">{contact.name}</h4>
                <p className="text-gray-600">{contact.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs border ${getPriorityColor(contact.priority)}`}>
                  {contact.priority.toUpperCase()}
                </span>
                {contact.id !== '1' && contact.id !== '2' && contact.id !== '3' && (
                  <button
                    onClick={() => removeContact(contact.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleCall(contact.phone, contact.name)}
                className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-1"
              >
                📞 Call
              </button>
              <button
                onClick={() => handleSMS(contact.phone, contact.name)}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
              >
                💬 SMS
              </button>
              {contact.email && (
                <button
                  onClick={() => handleEmail(contact.email!, contact.name)}
                  className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-1"
                >
                  ✉️ Email
                </button>
              )}
            </div>
            
            <div className="mt-2 text-sm text-gray-600">
              <div>📞 {contact.phone}</div>
              {contact.email && <div>✉️ {contact.email}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}