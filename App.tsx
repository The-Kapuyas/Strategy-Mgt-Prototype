import React, { useState, useCallback, useMemo, useEffect } from 'react';
import OnboardingStepper from './components/OnboardingStepper';
import WelcomeStep from './components/WelcomeStep';
import ObjectivesStep from './components/ObjectivesStep';
import KeyResultsStep from './components/KeyResultsStep';
import InviteStep from './components/InviteStep';
import WorkspaceView from './components/WorkspaceView';
import CheckInPrepView from './components/CheckInPrepView';
import SettingsPage from './components/SettingsPage';
import TopNav, { type TopLevelPage } from './components/common/TopNav';
import { Objective, Personnel, Dependency } from './types';
import { StrategyBlueprint, SimplifiedBlueprint } from './types/strategyBlueprint';
import { CheckInBrief, LeaderUpdatesBrief } from './types/checkin';
import { APP_CONFIG } from './constants';
import { parseBlueprint, validateBlueprint, ParsedBlueprint } from './utils/blueprintParser';
import ProfileMenu from './components/common/ProfileMenu';
import InviteAcceptPage from './components/InviteAcceptPage';
import { useInvitations } from './hooks/useInvitations';
import demoBlueprintJson from './demo_blueprint.json';

// Start with empty objectives - users will add their own via AI suggestions or manually
const initialObjectives: Objective[] = [];

// Company context for AI suggestions
export interface CompanyContext {
  description: string;
  industry: string;
  stage: string;
  goals: string;
  challenges: string;
}

const initialCompanyContext: CompanyContext = {
  description: '',
  industry: '',
  stage: '',
  goals: '',
  challenges: '',
};

const App: React.FC = () => {
  const { invitations, createInvitation, revokeInvitation, acceptInvitation, getInvitationByToken } = useInvitations();

  const inviteToken = useMemo(
    () => new URLSearchParams(window.location.search).get('invite'),
    []
  );

  const [currentStep, setCurrentStep] = useState(4);
  const [companyName, setCompanyName] = useState(APP_CONFIG.COMPANY_NAME_DEFAULT);
  const [companyContext, setCompanyContext] = useState<CompanyContext>(initialCompanyContext);
  const [objectives, setObjectives] = useState<Objective[]>(initialObjectives);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [blueprintLoaded, setBlueprintLoaded] = useState(false);
  const [activeBlueprintKey, setActiveBlueprintKey] = useState<string>('demo');
  const [checkInBrief, setCheckInBrief] = useState<CheckInBrief | undefined>(undefined);
  const [leaderUpdates, setLeaderUpdates] = useState<LeaderUpdatesBrief | undefined>(undefined);
  const [activePage, setActivePage] = useState<TopLevelPage>(() => {
    try {
      const stored = localStorage.getItem('pulley-default-landing-page');
      if (stored === 'blueprint' || stored === 'checkin-prep') return stored;
    } catch {}
    return 'blueprint';
  });

  // Handler for loading a strategy blueprint (supports both standard and simplified formats)
  const handleLoadBlueprint = useCallback((blueprint: StrategyBlueprint | SimplifiedBlueprint): ParsedBlueprint | { error: string } => {
    if (!validateBlueprint(blueprint)) {
      return { error: 'Invalid blueprint format. Please check the JSON structure.' };
    }

    try {
      const parsed = parseBlueprint(blueprint);
      setCompanyName(parsed.companyName);
      setObjectives(parsed.objectives);
      setPersonnel(parsed.personnel);
      if (parsed.dependencies.length > 0) {
        setDependencies(parsed.dependencies);
      }
      if (parsed.checkInBrief) {
        setCheckInBrief(parsed.checkInBrief);
      }
      if (parsed.leaderUpdates) {
        setLeaderUpdates(parsed.leaderUpdates);
      }
      setBlueprintLoaded(true);
      return parsed;
    } catch (err) {
      return { error: 'Failed to parse blueprint. Please check the file format.' };
    }
  }, []);

  useEffect(() => {
    handleLoadBlueprint(demoBlueprintJson as any);
  }, [handleLoadBlueprint]);

  const nextStep = useCallback(() => {
    if (currentStep < APP_CONFIG.TOTAL_STEPS) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleNavigateToBlueprint = useCallback((view?: string) => {
    setActivePage('blueprint');
    // TODO: pass initialView to WorkspaceView if needed
  }, []);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <WelcomeStep 
            companyName={companyName} 
            setCompanyName={setCompanyName}
            companyContext={companyContext}
            setCompanyContext={setCompanyContext}
            personnel={personnel} 
            setPersonnel={setPersonnel} 
            onLoadBlueprint={handleLoadBlueprint}
            blueprintLoaded={blueprintLoaded}
            objectivesCount={objectives.length}
            onNext={nextStep}
            onSkipToWorkspace={() => setCurrentStep(4)} 
          />
        );
      case 1:
        return (
          <ObjectivesStep 
            objectives={objectives} 
            setObjectives={setObjectives} 
            onNext={nextStep} 
            onBack={prevStep} 
            companyName={companyName}
            companyContext={companyContext}
          />
        );
      case 2:
        return (
          <KeyResultsStep 
            objectives={objectives} 
            setObjectives={setObjectives} 
            onNext={nextStep} 
            onBack={prevStep} 
            companyName={companyName}
            companyContext={companyContext}
          />
        );
      case 3:
        return (
          <InviteStep 
            onNext={nextStep} 
            onBack={prevStep} 
            companyName={companyName}
            companyContext={companyContext}
            priorities={objectives} 
            setPriorities={setObjectives}
            personnel={personnel}
          />
        );
      case 4:
        return null; // Rendered separately with TopNav layout
      default:
        return (
          <WelcomeStep 
            companyName={companyName} 
            setCompanyName={setCompanyName}
            companyContext={companyContext}
            setCompanyContext={setCompanyContext}
            personnel={personnel} 
            setPersonnel={setPersonnel} 
            onLoadBlueprint={handleLoadBlueprint}
            blueprintLoaded={blueprintLoaded}
            objectivesCount={objectives.length}
            onNext={nextStep}
            onSkipToWorkspace={() => setCurrentStep(4)}
          />
        );
    }
  };

  const AppLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
      <circle cx="12" cy="12" r="10" stroke="#4f46e5" strokeWidth="2" />
      <path d="M12 8V12L15 15" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  // Show invite acceptance page if an invite token is present in the URL
  if (inviteToken) {
    return (
      <InviteAcceptPage
        token={inviteToken}
        getInvitationByToken={getInvitationByToken}
        onAccept={acceptInvitation}
        onDecline={() => { window.location.href = window.location.origin; }}
      />
    );
  }

  // Workspace layout with TopNav (step 4)
  if (currentStep >= 4) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
        <TopNav activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-grow flex flex-col items-center p-4 sm:p-6 lg:p-8">
          <div className="w-full">
            {activePage === 'blueprint' && (
              <WorkspaceView
                priorities={objectives}
                setObjectives={setObjectives}
                companyName={companyName}
                personnel={personnel}
                setPersonnel={setPersonnel}
                dependencies={dependencies}
                setDependencies={setDependencies}
              />
            )}
            {activePage === 'checkin-prep' && (
              <CheckInPrepView
                objectives={objectives}
                setObjectives={setObjectives}
                companyName={companyName}
                personnel={personnel}
                checkInBrief={checkInBrief}
                leaderUpdates={leaderUpdates}
                onNavigateToBlueprint={handleNavigateToBlueprint}
                dependencies={dependencies}
              />
            )}
            {activePage === 'settings' && (
              <SettingsPage
                personnel={personnel}
                setPersonnel={setPersonnel}
                invitations={invitations}
                onCreateInvitation={(email) => createInvitation(email, companyName)}
                onRevokeInvitation={revokeInvitation}
                onLoadBlueprint={handleLoadBlueprint}
                activeBlueprintKey={activeBlueprintKey}
                setActiveBlueprintKey={setActiveBlueprintKey}
                onStartOnboarding={() => {
                  setBlueprintLoaded(false);
                  setObjectives([]);
                  setPersonnel([]);
                  setDependencies([]);
                  setCheckInBrief(undefined);
                  setLeaderUpdates(undefined);
                  setCompanyName(APP_CONFIG.COMPANY_NAME_DEFAULT);
                  setCompanyContext(initialCompanyContext);
                  setCurrentStep(0);
                }}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  // Onboarding layout (steps 0-3)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <AppLogo />
          <h1 className="text-xl font-bold text-slate-900">{APP_CONFIG.APP_TITLE}</h1>
        </div>
        <ProfileMenu />
      </header>

      <main className="w-full flex-grow flex flex-col items-center">
        <div className="w-full max-w-2xl mb-8">
          <OnboardingStepper currentStep={currentStep} totalSteps={4} />
        </div>
        <div className="w-full">
          {renderStep()}
        </div>
      </main>
    </div>
  );
};

export default App;
