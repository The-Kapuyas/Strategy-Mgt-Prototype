import React, { useState, useRef } from 'react';
import { Personnel, Invitation } from '../types';
import { type TopLevelPage } from './common/TopNav';
import { StrategyBlueprint, SimplifiedBlueprint } from '../types/strategyBlueprint';
import { ParsedBlueprint } from '../utils/blueprintParser';
import demoBlueprintJson from '../demo_blueprint.json';
import pulleyBlueprintJson from '../pulley_blueprint.json';

type SettingsTab = 'team' | 'profile' | 'users' | 'integrations' | 'audit' | 'customization';

const NAV_GROUPS: { label: string; items: { key: SettingsTab; label: string }[] }[] = [
  { label: 'Account', items: [{ key: 'profile', label: 'User Profile' }, { key: 'users', label: 'User Management' }] },
  { label: 'Admin', items: [{ key: 'integrations', label: 'Integrations' }, { key: 'audit', label: 'Audit Log' }] },
  { label: 'Workspace', items: [{ key: 'team', label: 'Team' }, { key: 'customization', label: 'Customization' }] },
];

interface SettingsPageProps {
  personnel: Personnel[];
  setPersonnel: (personnel: Personnel[]) => void;
  invitations: Invitation[];
  onCreateInvitation: (recipientEmail: string) => Invitation;
  onRevokeInvitation: (token: string) => void;
  onLoadBlueprint: (blueprint: StrategyBlueprint | SimplifiedBlueprint) => ParsedBlueprint | { error: string };
  activeBlueprintKey: string;
  setActiveBlueprintKey: (key: string) => void;
  onStartOnboarding: () => void;
}

// ── Team ──────────────────────────────────────────────────────
const TeamSection: React.FC<{ personnel: Personnel[]; setPersonnel: (p: Personnel[]) => void }> = ({ personnel, setPersonnel }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDepartment, setNewDepartment] = useState('');
  const [newSkills, setNewSkills] = useState('');
  const [newAvailability, setNewAvailability] = useState('Full-time');
  const [newEmail, setNewEmail] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    const member: Personnel = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: newName.trim(),
      role: newRole.trim(),
      department: newDepartment.trim(),
      skills: newSkills.trim() ? newSkills.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      availability: newAvailability || undefined,
      email: newEmail.trim() || undefined,
    };
    setPersonnel([...personnel, member]);
    setNewName('');
    setNewRole('');
    setNewDepartment('');
    setNewSkills('');
    setNewAvailability('Full-time');
    setNewEmail('');
    setShowAddForm(false);
  };

  const handleRemove = (id: string) => {
    setPersonnel(personnel.filter(p => p.id !== id));
  };

  // Derive unique departments for display
  const departments = [...new Set(personnel.map(p => p.department).filter(Boolean))];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Team</h2>
          <p className="text-sm text-slate-500">
            Manage team members and roles that appear in your strategy blueprint.
            {personnel.length > 0 && (
              <span className="ml-1 text-slate-400">
                {personnel.length} member{personnel.length !== 1 ? 's' : ''}
                {departments.length > 0 && ` across ${departments.length} department${departments.length !== 1 ? 's' : ''}`}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add member
        </button>
      </div>

      {/* Add Member Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">New team member</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <input
                type="text"
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                placeholder="e.g. Senior Engineer"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
              <input
                type="text"
                value={newDepartment}
                onChange={e => setNewDepartment(e.target.value)}
                placeholder="e.g. Engineering"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Availability</label>
              <select
                value={newAvailability}
                onChange={e => setNewAvailability(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="50%">50%</option>
                <option value="25%">25%</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Skills (comma-separated)</label>
              <input
                type="text"
                value={newSkills}
                onChange={e => setNewSkills(e.target.value)}
                placeholder="e.g. React, TypeScript, Design"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Team Table */}
      {personnel.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Department</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Skills</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Availability</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {personnel.map((person) => (
                <tr key={person.id} className="border-b border-slate-50 last:border-0 group">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-slate-900 font-medium whitespace-nowrap">{person.name}</p>
                      {person.email && <p className="text-xs text-slate-400 mt-0.5">{person.email}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{person.role || '—'}</td>
                  <td className="px-4 py-3">
                    {person.department ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 whitespace-nowrap">
                        {person.department}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {person.skills && person.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {person.skills.slice(0, 3).map(skill => (
                          <span key={skill} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 whitespace-nowrap">
                            {skill}
                          </span>
                        ))}
                        {person.skills.length > 3 && (
                          <span className="text-xs text-slate-400">+{person.skills.length - 3}</span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{person.availability || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemove(person.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50"
                      title="Remove member"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm font-medium text-slate-700 mb-1">No team members yet</p>
          <p className="text-sm text-slate-500">Add members manually or import them from a blueprint JSON file.</p>
        </div>
      )}
    </div>
  );
};

// ── User Profile ──────────────────────────────────────────────
const UserProfileSection: React.FC = () => (
  <div>
    <h2 className="text-lg font-semibold text-slate-900 mb-1">User Profile</h2>
    <p className="text-sm text-slate-500 mb-6">Manage your account details and preferences.</p>

    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      <div className="p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-semibold text-xl flex items-center justify-center shrink-0">
          A
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">Admin</p>
          <p className="text-sm text-slate-500">admin@company.com</p>
        </div>
      </div>

      <div className="p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Full name</label>
        <input
          type="text"
          defaultValue="Admin"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
        <input
          type="email"
          defaultValue="admin@company.com"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
        <input
          type="text"
          defaultValue="Admin"
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <div className="p-5">
        <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
          Save
        </button>
      </div>
    </div>
  </div>
);

// ── User Management ───────────────────────────────────────────
interface UserManagementSectionProps {
  invitations: Invitation[];
  onCreateInvitation: (recipientEmail: string) => Invitation;
  onRevokeInvitation: (token: string) => void;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const UserManagementSection: React.FC<UserManagementSectionProps> = ({
  invitations,
  onCreateInvitation,
  onRevokeInvitation,
}) => {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isValidEmail = EMAIL_RE.test(emailInput.trim());

  const handleOpenForm = () => {
    setShowInviteForm(true);
    setEmailInput('');
    setEmailError('');
    setGeneratedLink(null);
    setCopySuccess(false);
  };

  const handleCloseForm = () => {
    setShowInviteForm(false);
    setEmailInput('');
    setEmailError('');
    setGeneratedLink(null);
    setCopySuccess(false);
  };

  const handleGenerateLink = () => {
    const email = emailInput.trim();
    if (!EMAIL_RE.test(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    const invitation = onCreateInvitation(email);
    const link = `${window.location.origin}${window.location.pathname}?invite=${invitation.token}`;
    setGeneratedLink(link);
    setEmailError('');
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopySuccess(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleInviteAnother = () => {
    setEmailInput('');
    setEmailError('');
    setGeneratedLink(null);
    setCopySuccess(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">User Management</h2>
          <p className="text-sm text-slate-500">Manage workspace members and their permissions.</p>
        </div>
        {!showInviteForm && (
          <button
            onClick={handleOpenForm}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Invite user
          </button>
        )}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          {generatedLink === null ? (
            <>
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Invite a user</h3>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-600 mb-1">Email address *</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => { setEmailInput(e.target.value); if (emailError) setEmailError(''); }}
                  onBlur={() => { if (emailInput && !isValidEmail) setEmailError('Please enter a valid email address.'); }}
                  placeholder="invitee@company.com"
                  className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateLink}
                  disabled={!isValidEmail}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Generate link
                </button>
                <button
                  onClick={handleCloseForm}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Invite link generated</h3>
              <p className="text-xs text-slate-500 mb-4">Copy and share this link with <span className="font-medium text-slate-700">{emailInput.trim()}</span>. It expires in 7 days.</p>
              <div className="flex items-center gap-2 mb-3">
                <input
                  readOnly
                  value={generatedLink}
                  className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-mono select-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  onFocus={e => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    copySuccess
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy link
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleInviteAnother}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Invite another
                </button>
                <button
                  onClick={handleCloseForm}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Active Users */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active users</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Email</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-3.5 text-slate-900 font-medium">You</td>
                <td className="px-5 py-3.5 text-slate-500">admin@company.com</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                    Owner
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 text-emerald-600 text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Invitations */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Invitations</h3>
        {invitations.length > 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Recipient Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Expires</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Accepted</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Revoked</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => {
                  const canRevoke = !inv.revoked && inv.acceptedAt === null;
                  return (
                    <tr key={inv.token} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-3.5 text-slate-800 font-medium">{inv.recipientEmail}</td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{formatShortDate(inv.createdAt)}</td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">{formatShortDate(inv.expiresAt)}</td>
                      <td className="px-4 py-3.5">
                        {inv.acceptedAt !== null ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {formatShortDate(inv.acceptedAt)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {inv.revoked ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-600">
                            Revoked
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {canRevoke && (
                          <button
                            onClick={() => onRevokeInvitation(inv.token)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-slate-700 mb-1">No invitations yet</p>
            <p className="text-sm text-slate-500">Invite a user to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Integrations ──────────────────────────────────────────────
const INTEGRATIONS = [
  { name: 'Slack', description: 'Get check-in reminders and strategy updates in Slack.', connected: false },
  { name: 'Jira', description: 'Sync key results with Jira issues and epics.', connected: false },
  { name: 'Google Sheets', description: 'Import and export strategy data via Google Sheets.', connected: false },
  { name: 'Linear', description: 'Link initiatives to Linear projects and cycles.', connected: false },
];

const IntegrationsSection: React.FC = () => (
  <div>
    <h2 className="text-lg font-semibold text-slate-900 mb-1">Integrations</h2>
    <p className="text-sm text-slate-500 mb-6">Connect third-party tools and services to your workspace.</p>

    <div className="flex flex-col gap-3">
      {INTEGRATIONS.map((integration) => (
        <div
          key={integration.name}
          className="bg-white rounded-xl border border-slate-200 p-5 flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-medium text-slate-900">{integration.name}</p>
            <p className="text-sm text-slate-500 mt-0.5">{integration.description}</p>
          </div>
          <button className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shrink-0">
            Connect
          </button>
        </div>
      ))}
    </div>
  </div>
);

// ── Audit Log ─────────────────────────────────────────────────
const AuditLogSection: React.FC = () => (
  <div>
    <h2 className="text-lg font-semibold text-slate-900 mb-1">Audit Log</h2>
    <p className="text-sm text-slate-500 mb-6">Review activity and changes across the workspace.</p>

    <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm font-medium text-slate-700 mb-1">No activity yet</p>
      <p className="text-sm text-slate-500">Workspace activity will appear here once actions are taken.</p>
    </div>
  </div>
);

// ── Customization ────────────────────────────────────────────
const BUNDLED_BLUEPRINTS: { key: string; label: string; description: string; data: any }[] = [
  { key: 'demo', label: 'Novacraft (Demo)', description: 'Series B AI automation company — full OKR, projects, check-in data.', data: demoBlueprintJson },
  { key: 'pulley', label: 'Pulley', description: 'Equity management platform — real company blueprint.', data: pulleyBlueprintJson },
];

const LANDING_PAGE_OPTIONS: { value: TopLevelPage; label: string; description: string }[] = [
  { value: 'checkin-prep', label: 'Check-in Prep', description: 'Start with your check-in preparation view.' },
  { value: 'blueprint', label: 'Strategy Blueprint', description: 'Start with your strategy blueprint workspace.' },
];

const BLUEPRINT_VIEW_OPTIONS: { key: string; label: string }[] = [
  { key: 'explorer', label: 'Strategy Map' },
  { key: 'tree', label: 'Tree View' },
  { key: 'allocation', label: 'Allocation' },
  { key: 'assignments', label: 'Capacity' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'cards', label: 'Cards' },
  { key: 'department', label: 'Department' },
];

const DEFAULT_VIEWS = ['explorer', 'tree'];

const getStoredVisibleViews = (): string[] => {
  try {
    const stored = localStorage.getItem('workspace-visible-views');
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      if (parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_VIEWS;
};

interface CustomizationSectionProps {
  onLoadBlueprint: (blueprint: StrategyBlueprint | SimplifiedBlueprint) => ParsedBlueprint | { error: string };
  activeBlueprintKey: string;
  setActiveBlueprintKey: (key: string) => void;
  onStartOnboarding: () => void;
}

const CustomizationSection: React.FC<CustomizationSectionProps> = ({ onLoadBlueprint, activeBlueprintKey, setActiveBlueprintKey, onStartOnboarding }) => {
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSwitchBlueprint = (key: string) => {
    const bp = BUNDLED_BLUEPRINTS.find(b => b.key === key);
    if (!bp) return;
    setBlueprintError(null);
    const result = onLoadBlueprint(bp.data);
    if ('error' in result) {
      setBlueprintError(result.error);
      return;
    }
    setActiveBlueprintKey(key);
    setUploadedName(null);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBlueprintError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const result = onLoadBlueprint(json);
        if ('error' in result) {
          setBlueprintError(result.error);
          return;
        }
        setActiveBlueprintKey('uploaded');
        setUploadedName(file.name);
      } catch {
        setBlueprintError('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [defaultPage, setDefaultPage] = useState<TopLevelPage>(() => {
    try {
      const stored = localStorage.getItem('pulley-default-landing-page');
      if (stored === 'blueprint' || stored === 'checkin-prep') return stored;
    } catch {}
    return 'blueprint';
  });

  const [visibleViews, setVisibleViews] = useState<string[]>(getStoredVisibleViews);

  const [showAssessment, setShowAssessment] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pulley-show-assessment') === 'true';
    } catch {}
    return false;
  });

  const [showStatusOverride, setShowStatusOverride] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pulley-show-status-override') === 'true';
    } catch {}
    return false;
  });

  const handlePageChange = (value: TopLevelPage) => {
    setDefaultPage(value);
    localStorage.setItem('pulley-default-landing-page', value);
  };

  const toggleView = (key: string) => {
    setVisibleViews(prev => {
      const next = prev.includes(key)
        ? prev.filter(v => v !== key)
        : [...prev, key];
      if (next.length === 0) return prev;
      localStorage.setItem('workspace-visible-views', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Customization</h2>
      <p className="text-sm text-slate-500 mb-6">Configure workspace appearance and behavior.</p>

      {/* Active blueprint */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 mb-6">
        <div className="p-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">Active blueprint</label>
          <p className="text-sm text-slate-500 mb-3">Switch between pre-loaded blueprints, upload your own, or start fresh.</p>
          <div className="flex flex-col gap-2">
            {BUNDLED_BLUEPRINTS.map(bp => (
              <label
                key={bp.key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  activeBlueprintKey === bp.key
                    ? 'border-indigo-300 bg-indigo-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="active-blueprint"
                  value={bp.key}
                  checked={activeBlueprintKey === bp.key}
                  onChange={() => handleSwitchBlueprint(bp.key)}
                  className="mt-0.5 h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{bp.label}</p>
                  <p className="text-sm text-slate-500">{bp.description}</p>
                </div>
              </label>
            ))}
            {uploadedName && (
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  activeBlueprintKey === 'uploaded'
                    ? 'border-indigo-300 bg-indigo-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="active-blueprint"
                  value="uploaded"
                  checked={activeBlueprintKey === 'uploaded'}
                  readOnly
                  className="mt-0.5 h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{uploadedName}</p>
                  <p className="text-sm text-slate-500">Uploaded blueprint</p>
                </div>
              </label>
            )}
          </div>
          {blueprintError && (
            <p className="mt-2 text-sm text-red-600">{blueprintError}</p>
          )}
          <div className="flex items-center gap-3 mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Upload JSON
            </button>
            <button
              onClick={onStartOnboarding}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              Create new blueprint
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {/* Default landing page */}
        <div className="p-5">
          <label className="block text-sm font-medium text-slate-700 mb-3">Default landing page</label>
          <div className="flex flex-col gap-2">
            {LANDING_PAGE_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  defaultPage === option.value
                    ? 'border-indigo-300 bg-indigo-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="default-landing-page"
                  value={option.value}
                  checked={defaultPage === option.value}
                  onChange={() => handlePageChange(option.value)}
                  className="mt-0.5 h-4 w-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{option.label}</p>
                  <p className="text-sm text-slate-500">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Visible views in Strategy Blueprint */}
        <div className="p-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">Visible views</label>
          <p className="text-sm text-slate-500 mb-3">Choose which views appear in the Strategy Blueprint page.</p>
          <div className="flex flex-col gap-1">
            {BLUEPRINT_VIEW_OPTIONS.map(view => (
              <label
                key={view.key}
                className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={visibleViews.includes(view.key)}
                  onChange={() => toggleView(view.key)}
                  disabled={visibleViews.length === 1 && visibleViews.includes(view.key)}
                  className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-sm text-slate-900">{view.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Assessment button */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700">Assessment button</label>
              <p className="text-sm text-slate-500 mt-0.5">Show the AI Assessment button on the Strategy Blueprint page.</p>
            </div>
            <button
              onClick={() => {
                const next = !showAssessment;
                setShowAssessment(next);
                localStorage.setItem('pulley-show-assessment', String(next));
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showAssessment ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showAssessment ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Status override */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700">Status override</label>
              <p className="text-sm text-slate-500 mt-0.5">Allow manually changing the AI-suggested status on check-in items.</p>
            </div>
            <button
              onClick={() => {
                const next = !showStatusOverride;
                setShowStatusOverride(next);
                localStorage.setItem('pulley-show-status-override', String(next));
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showStatusOverride ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showStatusOverride ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Settings Page ─────────────────────────────────────────────
const SettingsPage: React.FC<SettingsPageProps> = ({ personnel, setPersonnel, invitations, onCreateInvitation, onRevokeInvitation, onLoadBlueprint, activeBlueprintKey, setActiveBlueprintKey, onStartOnboarding }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const renderContent = () => {
    switch (activeTab) {
      case 'team':
        return <TeamSection personnel={personnel} setPersonnel={setPersonnel} />;
      case 'profile':
        return <UserProfileSection />;
      case 'users':
        return (
          <UserManagementSection
            invitations={invitations}
            onCreateInvitation={onCreateInvitation}
            onRevokeInvitation={onRevokeInvitation}
          />
        );
      case 'integrations':
        return <IntegrationsSection />;
      case 'audit':
        return <AuditLogSection />;
      case 'customization':
        return <CustomizationSection onLoadBlueprint={onLoadBlueprint} activeBlueprintKey={activeBlueprintKey} setActiveBlueprintKey={setActiveBlueprintKey} onStartOnboarding={onStartOnboarding} />;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex gap-0 min-h-[calc(100vh-8rem)]">
      {/* Left Sidebar */}
      <nav className="w-52 shrink-0 pr-6 border-r border-slate-200 pt-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">{group.label}</h2>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ key, label }) => (
                <li key={key}>
                  <button
                    onClick={() => setActiveTab(key)}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer
                      ${activeTab === key
                        ? 'bg-slate-100 text-slate-900 font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 pl-8 pt-2">
        {renderContent()}
      </main>
    </div>
  );
};

export default SettingsPage;
