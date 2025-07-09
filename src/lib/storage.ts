import { v4 as uuidv4 } from 'uuid';

// Types
export interface User {
  _id: string;
  name: string;
  email: string;
  createdAt: number;
}

export interface Session {
  _id: string;
  name: string;
  creatorId: string;
  active: boolean;
  createdAt: number;
  shareCode: string;
  participantCount: number;
  isAdmin: boolean;
  alertTypes: AlertType[];
}

export interface AlertType {
  id: string;
  label: string;
  color: string;
  emoji: string;
  category?: string;
  sound?: string;
}

export interface Participant {
  _id: string;
  sessionId: string;
  userId: string;
  role: string;
  joinedAt: number;
}

export interface Location {
  _id: string;
  sessionId: string;
  userId: string;
  location: {
    lat: number;
    lng: number;
  };
  timestamp: number;
  accuracy?: number;
}

export interface Alert {
  _id: string;
  sessionId: string;
  createdBy: string;
  type: string;
  message?: string;
  createdAt: number;
  acknowledged: string[];
  location?: {
    lat: number;
    lng: number;
  };
  priority?: string;
}

export interface Geofence {
  _id: string;
  sessionId: string;
  name: string;
  type: 'safe_zone' | 'restricted_zone' | 'alert_zone';
  shape: 'circle' | 'polygon';
  center?: {
    lat: number;
    lng: number;
  };
  radius?: number;
  coordinates?: Array<{
    lat: number;
    lng: number;
  }>;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  description?: string;
  active: boolean;
  createdAt: number;
  createdBy: string;
}

export interface Message {
  _id: string;
  sessionId: string;
  userId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'system' | 'alert';
  userName: string;
}

// Storage keys
const STORAGE_KEYS = {
  CURRENT_USER: 'emergency_app_current_user',
  USERS: 'emergency_app_users',
  SESSIONS: 'emergency_app_sessions',
  PARTICIPANTS: 'emergency_app_participants',
  LOCATIONS: 'emergency_app_locations',
  ALERTS: 'emergency_app_alerts',
  GEOFENCES: 'emergency_app_geofences',
  MESSAGES: 'emergency_app_messages',
};

// Utility functions
function getFromStorage<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to storage:', error);
  }
}

function generateShareCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Default alert types
const DEFAULT_ALERT_TYPES: AlertType[] = [
  { id: "emergency", label: "Emergency", color: "bg-red-600", emoji: "🚨", category: "critical" },
  { id: "medical", label: "Medical", color: "bg-red-500", emoji: "🏥", category: "critical" },
  { id: "fire", label: "Fire", color: "bg-orange-600", emoji: "🔥", category: "critical" },
  { id: "help", label: "Need Help", color: "bg-yellow-600", emoji: "🆘", category: "assistance" },
  { id: "safe", label: "I'm Safe", color: "bg-green-600", emoji: "✅", category: "status" },
];

// Storage API
export class StorageAPI {
  // User management
  static getCurrentUser(): User | null {
    try {
      const userData = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  static setCurrentUser(user: User): void {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
  }

  static signIn(email: string, password: string, name?: string): User {
    const users = getFromStorage<User>(STORAGE_KEYS.USERS);
    let user = users.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim());

    if (!user) {
      // Create new user (sign up)
      if (!name) {
        throw new Error('Name is required to create a new account');
      }
      
      user = {
        _id: uuidv4(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        createdAt: Date.now(),
      };
      users.push(user);
      saveToStorage(STORAGE_KEYS.USERS, users);
      console.log('New user created:', user);
    } else {
      // Existing user (sign in)
      // For simplicity, we're not actually checking passwords in this demo
      // In a real app, you'd verify the password here
      console.log('Existing user signed in:', user);
    }

    this.setCurrentUser(user);
    return user;
  }

  static signInAnonymous(): User {
    try {
      const user: User = {
        _id: uuidv4(),
        name: `Anonymous User ${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        email: `anonymous_${Date.now()}@temp.com`,
        createdAt: Date.now(),
      };

      const users = getFromStorage<User>(STORAGE_KEYS.USERS);
      users.push(user);
      saveToStorage(STORAGE_KEYS.USERS, users);
      this.setCurrentUser(user);
      
      console.log('Anonymous user created successfully:', user);
      return user;
    } catch (error) {
      console.error('Error creating anonymous user:', error);
      throw new Error('Failed to create anonymous user account');
    }
  }

  static signOut(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // Session management
  static createSession(name: string, userId: string): Session {
    const sessionId = uuidv4();
    const shareCode = generateShareCode();
    
    const session: Session = {
      _id: sessionId,
      name,
      creatorId: userId,
      active: true,
      createdAt: Date.now(),
      shareCode,
      participantCount: 1,
      isAdmin: true,
      alertTypes: DEFAULT_ALERT_TYPES,
    };

    // Save session
    const sessions = getFromStorage<Session>(STORAGE_KEYS.SESSIONS);
    sessions.push(session);
    saveToStorage(STORAGE_KEYS.SESSIONS, sessions);

    // Add creator as participant
    const participant: Participant = {
      _id: uuidv4(),
      sessionId,
      userId,
      role: 'Admin',
      joinedAt: Date.now(),
    };

    const participants = getFromStorage<Participant>(STORAGE_KEYS.PARTICIPANTS);
    participants.push(participant);
    saveToStorage(STORAGE_KEYS.PARTICIPANTS, participants);

    return session;
  }

  static joinByCode(shareCode: string, userId: string): string {
    const sessions = getFromStorage<Session>(STORAGE_KEYS.SESSIONS);
    const session = sessions.find(s => s.shareCode === shareCode && s.active);

    if (!session) {
      throw new Error('Session not found or inactive');
    }

    // Check if already a participant
    const participants = getFromStorage<Participant>(STORAGE_KEYS.PARTICIPANTS);
    const existingParticipant = participants.find(p => 
      p.sessionId === session._id && p.userId === userId
    );

    if (existingParticipant) {
      return session._id;
    }

    // Add as participant
    const participant: Participant = {
      _id: uuidv4(),
      sessionId: session._id,
      userId,
      role: 'Member',
      joinedAt: Date.now(),
    };

    participants.push(participant);
    saveToStorage(STORAGE_KEYS.PARTICIPANTS, participants);

    // Update participant count
    session.participantCount++;
    saveToStorage(STORAGE_KEYS.SESSIONS, sessions);

    return session._id;
  }

  static listSessions(userId: string): Session[] {
    const participants = getFromStorage<Participant>(STORAGE_KEYS.PARTICIPANTS);
    const userParticipations = participants.filter(p => p.userId === userId);
    
    const sessions = getFromStorage<Session>(STORAGE_KEYS.SESSIONS);
    
    return userParticipations.map(participation => {
      const session = sessions.find(s => s._id === participation.sessionId);
      if (!session) return null;

      const sessionParticipants = participants.filter(p => p.sessionId === session._id);
      
      return {
        ...session,
        participantCount: sessionParticipants.length,
        isAdmin: participation.role === 'Admin',
      };
    }).filter(Boolean) as Session[];
  }

  // Location management
  static updateLocation(sessionId: string, userId: string, location: { lat: number; lng: number }, accuracy?: number): void {
    const locations = getFromStorage<Location>(STORAGE_KEYS.LOCATIONS);
    
    // Remove old location for this user in this session
    const filteredLocations = locations.filter(l => 
      !(l.sessionId === sessionId && l.userId === userId)
    );

    // Add new location
    const newLocation: Location = {
      _id: uuidv4(),
      sessionId,
      userId,
      location,
      timestamp: Date.now(),
      accuracy,
    };

    filteredLocations.push(newLocation);
    saveToStorage(STORAGE_KEYS.LOCATIONS, filteredLocations);
  }

  static getSessionLocations(sessionId: string): Array<{
    userId: string;
    name: string;
    role: string;
    location?: { lat: number; lng: number };
    lastSeen?: number;
    accuracy?: number;
  }> {
    const participants = getFromStorage<Participant>(STORAGE_KEYS.PARTICIPANTS);
    const sessionParticipants = participants.filter(p => p.sessionId === sessionId);
    
    const locations = getFromStorage<Location>(STORAGE_KEYS.LOCATIONS);
    const users = getFromStorage<User>(STORAGE_KEYS.USERS);

    return sessionParticipants.map(participant => {
      const user = users.find(u => u._id === participant.userId);
      const location = locations.find(l => 
        l.sessionId === sessionId && l.userId === participant.userId
      );

      return {
        userId: participant.userId,
        name: user?.name || 'Unknown',
        role: participant.role,
        location: location?.location,
        lastSeen: location?.timestamp,
        accuracy: location?.accuracy,
      };
    });
  }

  // Alert management
  static sendAlert(sessionId: string, userId: string, type: string, message?: string): void {
    const alert: Alert = {
      _id: uuidv4(),
      sessionId,
      createdBy: userId,
      type,
      message,
      createdAt: Date.now(),
      acknowledged: [],
    };

    const alerts = getFromStorage<Alert>(STORAGE_KEYS.ALERTS);
    alerts.push(alert);
    saveToStorage(STORAGE_KEYS.ALERTS, alerts);
  }

  static getSessionAlerts(sessionId: string): Array<Alert & { createdByUser: { name: string; email: string } | null }> {
    const alerts = getFromStorage<Alert>(STORAGE_KEYS.ALERTS);
    const sessionAlerts = alerts.filter(a => a.sessionId === sessionId);
    const users = getFromStorage<User>(STORAGE_KEYS.USERS);

    return sessionAlerts.map(alert => {
      const user = users.find(u => u._id === alert.createdBy);
      return {
        ...alert,
        createdByUser: user ? {
          name: user.name,
          email: user.email,
        } : null,
      };
    }).sort((a, b) => b.createdAt - a.createdAt);
  }

  static acknowledgeAlert(alertId: string, userId: string): void {
    const alerts = getFromStorage<Alert>(STORAGE_KEYS.ALERTS);
    const alert = alerts.find(a => a._id === alertId);
    
    if (alert && !alert.acknowledged.includes(userId)) {
      alert.acknowledged.push(userId);
      saveToStorage(STORAGE_KEYS.ALERTS, alerts);
    }
  }

  // Geofence management
  static createGeofence(data: Omit<Geofence, '_id' | 'createdAt'>): string {
    const geofence: Geofence = {
      ...data,
      _id: uuidv4(),
      createdAt: Date.now(),
    };

    const geofences = getFromStorage<Geofence>(STORAGE_KEYS.GEOFENCES);
    geofences.push(geofence);
    saveToStorage(STORAGE_KEYS.GEOFENCES, geofences);

    return geofence._id;
  }

  static getSessionGeofences(sessionId: string): Geofence[] {
    const geofences = getFromStorage<Geofence>(STORAGE_KEYS.GEOFENCES);
    return geofences.filter(g => g.sessionId === sessionId);
  }

  static deleteGeofence(geofenceId: string): void {
    const geofences = getFromStorage<Geofence>(STORAGE_KEYS.GEOFENCES);
    const filteredGeofences = geofences.filter(g => g._id !== geofenceId);
    saveToStorage(STORAGE_KEYS.GEOFENCES, filteredGeofences);
  }

  // Message management
  static sendMessage(sessionId: string, userId: string, content: string, type: 'text' | 'system' | 'alert' = 'text'): void {
    const users = getFromStorage<User>(STORAGE_KEYS.USERS);
    const user = users.find(u => u._id === userId);

    const message: Message = {
      _id: uuidv4(),
      sessionId,
      userId,
      content,
      timestamp: Date.now(),
      type,
      userName: user?.name || 'Unknown User',
    };

    const messages = getFromStorage<Message>(STORAGE_KEYS.MESSAGES);
    messages.push(message);
    saveToStorage(STORAGE_KEYS.MESSAGES, messages);
  }

  static getSessionMessages(sessionId: string, limit: number = 50): Message[] {
    const messages = getFromStorage<Message>(STORAGE_KEYS.MESSAGES);
    return messages
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  }

  // Update alert types
  static updateAlertTypes(sessionId: string, alertTypes: AlertType[]): void {
    const sessions = getFromStorage<Session>(STORAGE_KEYS.SESSIONS);
    const session = sessions.find(s => s._id === sessionId);
    
    if (session) {
      session.alertTypes = alertTypes;
      saveToStorage(STORAGE_KEYS.SESSIONS, sessions);
    }
  }
}