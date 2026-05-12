import { useState, useEffect } from 'react';
import { Invitation } from '../types';

const STORAGE_KEY = 'pulley-invitations';

function generateToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadFromStorage(): Invitation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Invitation[];
  } catch {}
  return [];
}

export type AcceptResult = 'ok' | 'expired' | 'revoked' | 'already_accepted' | 'not_found';

export function useInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>(() => loadFromStorage());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invitations));
    } catch {}
  }, [invitations]);

  function createInvitation(recipientEmail: string, companyName: string): Invitation {
    const now = new Date();
    const invitation: Invitation = {
      token: generateToken(),
      recipientEmail,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: null,
      revoked: false,
      companyName,
    };
    setInvitations(prev => [...prev, invitation]);
    return invitation;
  }

  function revokeInvitation(token: string): void {
    setInvitations(prev =>
      prev.map(inv => (inv.token === token ? { ...inv, revoked: true } : inv))
    );
  }

  function acceptInvitation(token: string): AcceptResult {
    const inv = invitations.find(i => i.token === token);
    if (!inv) return 'not_found';
    if (inv.revoked) return 'revoked';
    if (new Date(inv.expiresAt) < new Date()) return 'expired';
    if (inv.acceptedAt !== null) return 'already_accepted';

    setInvitations(prev =>
      prev.map(i => (i.token === token ? { ...i, acceptedAt: new Date().toISOString() } : i))
    );
    return 'ok';
  }

  function getInvitationByToken(token: string): Invitation | undefined {
    return invitations.find(i => i.token === token);
  }

  return { invitations, createInvitation, revokeInvitation, acceptInvitation, getInvitationByToken };
}
