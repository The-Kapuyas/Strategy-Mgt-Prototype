import React, { useState } from 'react';
import { Invitation } from '../types';
import { AcceptResult } from '../hooks/useInvitations';

interface InviteAcceptPageProps {
  token: string;
  getInvitationByToken: (token: string) => Invitation | undefined;
  onAccept: (token: string) => AcceptResult;
  onDecline: () => void;
}

const PulleyLogo = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2" />
    <path d="M12 8V12L15 15" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

type PageState = 'valid' | 'not_found' | 'expired' | 'revoked' | 'already_accepted' | 'accepted_success';

function getInitialState(inv: Invitation | undefined): PageState {
  if (!inv) return 'not_found';
  if (inv.revoked) return 'revoked';
  if (new Date(inv.expiresAt) < new Date()) return 'expired';
  if (inv.acceptedAt !== null) return 'already_accepted';
  return 'valid';
}

const ErrorCard: React.FC<{ title: string; detail: string }> = ({ title, detail }) => (
  <div className="text-center">
    <div className="flex justify-center mb-4">
      <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
    </div>
    <h2 className="text-xl font-semibold text-slate-900 mb-2">{title}</h2>
    <p className="text-slate-500 text-sm mb-6">{detail}</p>
    <button
      onClick={() => { window.location.href = window.location.origin; }}
      className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
    >
      Go to login
    </button>
  </div>
);

const InviteAcceptPage: React.FC<InviteAcceptPageProps> = ({
  token,
  getInvitationByToken,
  onAccept,
  onDecline,
}) => {
  const invitation = getInvitationByToken(token);
  const [pageState, setPageState] = useState<PageState>(() => getInitialState(invitation));
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = () => {
    setIsAccepting(true);
    const result = onAccept(token);
    if (result === 'ok') {
      setPageState('accepted_success');
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 1500);
    } else {
      setPageState(result);
      setIsAccepting(false);
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case 'not_found':
        return (
          <ErrorCard
            title="Invalid invitation link"
            detail="This invitation link is not valid. It may have been created in a different browser or the link is incorrect."
          />
        );
      case 'expired':
        return (
          <ErrorCard
            title="Invitation has expired"
            detail={`This invitation expired on ${invitation ? formatDate(invitation.expiresAt) : 'an unknown date'}. Please ask the workspace admin to send a new invite.`}
          />
        );
      case 'revoked':
        return (
          <ErrorCard
            title="Invitation has been revoked"
            detail="This invitation was revoked by the workspace admin. Please contact them for a new invite."
          />
        );
      case 'already_accepted':
        return (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Already accepted</h2>
            <p className="text-slate-500 text-sm mb-6">
              This invitation was accepted on {invitation?.acceptedAt ? formatDate(invitation.acceptedAt) : 'a previous date'}.
            </p>
            <button
              onClick={() => { window.location.href = window.location.origin; }}
              className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              Go to login
            </button>
          </div>
        );
      case 'accepted_success':
        return (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">You've joined!</h2>
            <p className="text-slate-500 text-sm">Redirecting to login...</p>
          </div>
        );
      case 'valid':
      default:
        return (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <PulleyLogo />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">You've been invited</h1>
            <p className="text-slate-600 mb-1">
              You've been invited to join
            </p>
            <p className="text-xl font-semibold text-indigo-700 mb-1">
              {invitation?.companyName || 'a workspace'}
            </p>
            <p className="text-slate-600 mb-6">on Pulley Strategy Workspace</p>

            <div className="bg-slate-50 rounded-xl px-4 py-3 text-left space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 w-16 shrink-0">Invite for</span>
                <span className="text-slate-800 font-medium truncate">{invitation?.recipientEmail}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 w-16 shrink-0">Expires</span>
                <span className="text-slate-800">{invitation ? formatDate(invitation.expiresAt) : '—'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
              >
                {isAccepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
              <button
                onClick={onDecline}
                className="w-full py-3 px-4 rounded-xl font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;
