// Display-facing profile shape for the web client.
// Mirrors the fields the Android `dbProfileToMockProfile` adapter exposes,
// sourced from the shared Firestore `profiles/{uid}` documents (DbProfile).
export type ActivityStatus = 'active-this-week' | 'active-recently' | 'paused';

export interface Profile {
  id: string;
  name: string;
  age: number;
  city: string;
  state?: string;
  profession: string;
  education: string;
  religion: string;
  height?: string;
  bio: string;
  family: string;
  lookingFor: string;
  photo: string;        // photos[0] — primary
  photos: string[];
  traits: string[];
  lifestyle: string[];
  verifiedFields: string[];
  activityStatus: ActivityStatus;
  maritalStatus?: string;
  motherTongue?: string;
  subcaste?: string;
  isPremium: boolean;
  prompt?: { question: string; answer: string };
  createdAt: number;
}

// Mirrors Firestore DbConversation (conversations/{id}).
export interface Conversation {
  id: string;
  participants: string[];
  introductionId: string;
  status: 'active' | 'archived';
  lastMessage?: { text: string; senderId: string; sentAt: number };
  unreadCounts: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

// Mirrors Firestore DbMessage (conversations/{id}/messages/{id}).
export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  readBy: string[];
  deleted: boolean;
}
