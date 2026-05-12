
import React, { useRef, useState } from 'react';
import { Personnel } from '../types';
import { StrategyBlueprint, SimplifiedBlueprint } from '../types/strategyBlueprint';
import { ParsedBlueprint } from '../utils/blueprintParser';
import { parseStrategyDocument, isLLMParsingAvailable, ExtractedCompanyContext } from '../services/documentParser';

interface CompanyContext {
  description: string;
  industry: string;
  stage: string;
  goals: string;
  challenges: string;
}

interface WelcomeStepProps {
  companyName: string;
  setCompanyName: (name: string) => void;
  companyContext: CompanyContext;
  setCompanyContext: (context: CompanyContext) => void;
  personnel: Personnel[];
  setPersonnel: (personnel: Personnel[]) => void;
  onLoadBlueprint: (blueprint: StrategyBlueprint | SimplifiedBlueprint) => ParsedBlueprint | { error: string };
  blueprintLoaded: boolean;
  objectivesCount: number;
  onNext: () => void;
  onSkipToWorkspace?: () => void;
}

const parseCSV = (text: string): Personnel[] => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const personnel: Personnel[] = [];
  
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'employee name');
  const roleIdx = headers.findIndex(h => h === 'role' || h === 'title' || h === 'job title' || h === 'position');
  const deptIdx = headers.findIndex(h => h === 'department' || h === 'dept' || h === 'team');
  const skillsIdx = headers.findIndex(h => h === 'skills' || h === 'expertise' || h === 'competencies');
  const availabilityIdx = headers.findIndex(h => h === 'availability' || h === 'status' || h === 'capacity');
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'e-mail' || h === 'mail');
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length === 0 || !values[0]) continue;
    
    const name = nameIdx >= 0 ? values[nameIdx] : values[0];
    const role = roleIdx >= 0 ? values[roleIdx] : (values[1] || 'Team Member');
    const department = deptIdx >= 0 ? values[deptIdx] : (values[2] || 'General');
    
    personnel.push({
      id: `personnel-${i}-${Date.now()}`,
      name: name || `Person ${i}`,
      role: role || 'Team Member',
      department: department || 'General',
      skills: skillsIdx >= 0 && values[skillsIdx] ? values[skillsIdx].split(';').map(s => s.trim()) : undefined,
      availability: availabilityIdx >= 0 ? values[availabilityIdx] : undefined,
      email: emailIdx >= 0 ? values[emailIdx] : undefined,
    });
  }
  
  return personnel;
};

const WelcomeStep: React.FC<WelcomeStepProps> = ({ 
  companyName, 
  setCompanyName,
  companyContext,
  setCompanyContext,
  personnel, 
  setPersonnel,
  onLoadBlueprint,
  blueprintLoaded,
  objectivesCount,
  onNext,
  onSkipToWorkspace
}) => {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const blueprintInputRef = useRef<HTMLInputElement>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [isDraggingCSV, setIsDraggingCSV] = useState(false);
  const [isDraggingBlueprint, setIsDraggingBlueprint] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [blueprintStats, setBlueprintStats] = useState<{ objectives: number; keyResults: number; projects: number; personnel: number } | null>(null);
  const [showContextDetails, setShowContextDetails] = useState(false);
  const strategyDocsInputRef = useRef<HTMLInputElement>(null);
  const [strategyDocsLoaded, setStrategyDocsLoaded] = useState(false);
  const [parsingDocs, setParsingDocs] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [extractedConfidence, setExtractedConfidence] = useState<ExtractedCompanyContext['confidence'] | null>(null);

  // Handle strategy document upload with LLM-assisted parsing
  const handleStrategyDocUpload = async (files: FileList) => {
    setParsingDocs(true);
    setParseError(null);
    setExtractedConfidence(null);
    
    // Collect text from all files
    const fileTexts: string[] = [];
    
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        const text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve(evt.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
        fileTexts.push(text);
      }
    }
    
    if (fileTexts.length === 0) {
      setParsingDocs(false);
      setParseError('No valid .txt or .md files found');
      return;
    }
    
    // Combine all file contents
    const combinedText = fileTexts.join('\n\n---\n\n');
    
    // Check if LLM parsing is available
    if (isLLMParsingAvailable()) {
      try {
        // Use LLM-assisted parsing
        const result = await parseStrategyDocument(combinedText);
        
        if (result.success && result.data) {
          const { data } = result;
          
          // Fill company name if empty and extracted
          if (!companyName && data.companyName) {
            setCompanyName(data.companyName);
          }
          
          // Only update fields that were extracted with sufficient confidence
          setCompanyContext(prev => ({
            ...prev,
            description: data.description || prev.description,
            industry: data.industry || prev.industry,
            stage: data.stage || prev.stage,
            goals: data.goals || prev.goals,
            challenges: data.challenges || prev.challenges,
          }));
          
          setExtractedConfidence(data.confidence);
          setStrategyDocsLoaded(true);
        } else {
          setParseError(result.error || 'Could not extract information from document');
        }
      } catch (error) {
        console.error('LLM parsing failed:', error);
        setParseError('AI parsing failed. Please try again or enter information manually.');
      }
    } else {
      // Fallback: Just store the raw text in description
      setCompanyContext(prev => ({
        ...prev,
        description: prev.description 
          ? prev.description + '\n\n' + combinedText.substring(0, 2000)
          : combinedText.substring(0, 2000),
      }));
      setStrategyDocsLoaded(true);
    }
    
    setParsingDocs(false);
  };

  // CSV Upload handlers
  const handleCSVUpload = (file: File) => {
    setCsvError(null);
    if (!file.name.endsWith('.csv')) {
      setCsvError('Please upload a CSV file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setCsvError('No valid personnel data found in the CSV');
          return;
        }
        setPersonnel(parsed);
      } catch {
        setCsvError('Failed to parse CSV file');
      }
    };
    reader.onerror = () => setCsvError('Failed to read file');
    reader.readAsText(file);
  };

  // Blueprint Upload handlers
  const handleBlueprintUpload = (file: File) => {
    setBlueprintError(null);
    setBlueprintStats(null);
    
    if (!file.name.endsWith('.json')) {
      setBlueprintError('Please upload a JSON file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text) as StrategyBlueprint | SimplifiedBlueprint;
        const result = onLoadBlueprint(json);
        
        if ('error' in result) {
          setBlueprintError(result.error);
        } else {
          // Count items for stats
          let totalKRs = 0;
          let totalProjects = 0;
          result.objectives.forEach(obj => {
            totalKRs += obj.keyResults.length;
            obj.keyResults.forEach(kr => {
              totalProjects += kr.departmentalProjects?.length || 0;
              kr.departmentalKeyResults?.forEach(dkr => {
                totalProjects += dkr.departmentalProjects?.length || 0;
              });
            });
          });
          setBlueprintStats({
            objectives: result.objectives.length,
            keyResults: totalKRs,
            projects: totalProjects,
            personnel: result.personnel.length,
          });
        }
      } catch {
        setBlueprintError('Failed to parse JSON file. Please check the format.');
      }
    };
    reader.onerror = () => setBlueprintError('Failed to read file');
    reader.readAsText(file);
  };

  const handleCSVDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCSV(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCSVUpload(file);
  };

  const handleBlueprintDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingBlueprint(false);
    const file = e.dataTransfer.files[0];
    if (file) handleBlueprintUpload(file);
  };

  const clearPersonnel = () => {
    setPersonnel([]);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  const removePersonnel = (id: string) => {
    setPersonnel(personnel.filter(p => p.id !== id));
  };

  return (
    <div className="text-center max-w-3xl mx-auto flex flex-col items-center">
      <div className="bg-gradient-to-br from-brand-primary to-brand-secondary text-white p-4 rounded-2xl mb-6 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      </div>
      
      <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Welcome to your Strategy Workspace</h2>
      <p className="text-slate-600 mb-8 max-w-lg">Turn strategy ideas into a structured, actionable plan. Start from scratch or import an existing blueprint.</p>
      
      {/* Tab Switcher */}
      <div className="flex bg-slate-100 rounded-xl p-1 mb-8 w-full max-w-md">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'manual' 
              ? 'bg-white text-brand-primary shadow-sm' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Start Fresh
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'import' 
              ? 'bg-white text-brand-primary shadow-sm' 
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          Import Blueprint
        </button>
      </div>

      {activeTab === 'manual' ? (
        /* Manual Setup Tab */
        <div className="w-full max-w-lg space-y-6">
          {/* Company Name */}
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-2 text-left">
              What's your company's name?
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corporation"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
            />
          </div>

          {/* Strategy Documents Upload - LLM-assisted parsing */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 text-left">
              Upload strategy documents <span className="text-slate-400 font-normal">(AI-powered extraction)</span>
            </label>
            <input
              ref={strategyDocsInputRef}
              type="file"
              accept=".txt,.md"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  handleStrategyDocUpload(files);
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => strategyDocsInputRef.current?.click()}
              disabled={parsingDocs}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl text-sm transition-all ${
                parsingDocs
                  ? 'border-brand-primary bg-brand-light text-brand-primary cursor-wait'
                  : parseError
                    ? 'border-red-300 bg-red-50 text-red-700 hover:border-red-400'
                    : strategyDocsLoaded 
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400' 
                      : 'border-slate-300 hover:border-brand-primary text-slate-600 hover:text-brand-primary hover:bg-brand-light/30'
              }`}
            >
              {parsingDocs ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  AI is analyzing your documents...
                </>
              ) : parseError ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {parseError} - Click to retry
                </>
              ) : strategyDocsLoaded ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Documents analyzed - fields auto-filled
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Upload .txt or .md files (pitch deck, strategy doc, etc.)
                </>
              )}
            </button>
            
            {/* Extraction confidence indicators */}
            {strategyDocsLoaded && extractedConfidence && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Extraction Results</p>
                <div className="flex flex-wrap gap-2">
                  {extractedConfidence.companyName > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      extractedConfidence.companyName >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      Company {Math.round(extractedConfidence.companyName * 100)}%
                    </span>
                  )}
                  {extractedConfidence.description > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      extractedConfidence.description >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      Description {Math.round(extractedConfidence.description * 100)}%
                    </span>
                  )}
                  {extractedConfidence.industry > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      extractedConfidence.industry >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      Industry {Math.round(extractedConfidence.industry * 100)}%
                    </span>
                  )}
                  {extractedConfidence.stage > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      extractedConfidence.stage >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      Stage {Math.round(extractedConfidence.stage * 100)}%
                    </span>
                  )}
                  {extractedConfidence.goals > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      extractedConfidence.goals >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      Goals {Math.round(extractedConfidence.goals * 100)}%
                    </span>
                  )}
                  {extractedConfidence.challenges > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      extractedConfidence.challenges >= 0.7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      Challenges {Math.round(extractedConfidence.challenges * 100)}%
                    </span>
                  )}
                  {Object.values(extractedConfidence).every(c => c === 0) && (
                    <span className="text-xs text-slate-500 italic">No fields could be extracted - please fill manually</span>
                  )}
                </div>
              </div>
            )}
            
            {!strategyDocsLoaded && !parseError && (
              <p className="mt-1.5 text-xs text-slate-500 text-left">
                AI will extract company info, industry, stage, goals, and challenges
              </p>
            )}
          </div>

          {/* Company Description */}
          <div>
            <label htmlFor="companyDescription" className="block text-sm font-medium text-slate-700 mb-2 text-left">
              Describe your company <span className="text-slate-400 font-normal">(helps AI generate better suggestions)</span>
            </label>
            <textarea
              id="companyDescription"
              value={companyContext.description}
              onChange={(e) => setCompanyContext({ ...companyContext, description: e.target.value })}
              placeholder="e.g., We're a B2B SaaS company that helps enterprises automate their procurement workflows. We've raised Series A and are focused on expanding into new verticals..."
              rows={3}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all resize-none"
            />
          </div>

          {/* Additional Context - Expandable */}
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowContextDetails(!showContextDetails)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-slate-700">Add more context for smarter AI suggestions</span>
              </div>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 text-slate-400 transition-transform ${showContextDetails ? 'rotate-180' : ''}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {showContextDetails && (
              <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                {/* Industry & Stage */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5 text-left">Industry</label>
                    <input
                      type="text"
                      value={companyContext.industry}
                      onChange={(e) => setCompanyContext({ ...companyContext, industry: e.target.value })}
                      placeholder="e.g., FinTech, HealthTech"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5 text-left">Company Stage</label>
                    <select
                      value={companyContext.stage}
                      onChange={(e) => setCompanyContext({ ...companyContext, stage: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary bg-white"
                    >
                      <option value="">Select stage...</option>
                      <option value="Pre-seed">Pre-seed</option>
                      <option value="Seed">Seed</option>
                      <option value="Series A">Series A</option>
                      <option value="Series B">Series B</option>
                      <option value="Series C+">Series C+</option>
                      <option value="Growth">Growth</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>

                {/* Strategic Goals */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5 text-left">Key strategic goals this year</label>
                  <textarea
                    value={companyContext.goals}
                    onChange={(e) => setCompanyContext({ ...companyContext, goals: e.target.value })}
                    placeholder="e.g., Expand to European markets, Launch enterprise tier, Achieve $10M ARR..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary resize-none"
                  />
                </div>

                {/* Challenges */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5 text-left">Current challenges or focus areas</label>
                  <textarea
                    value={companyContext.challenges}
                    onChange={(e) => setCompanyContext({ ...companyContext, challenges: e.target.value })}
                    placeholder="e.g., Reducing churn, improving onboarding, scaling engineering team..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary resize-none"
                  />
                </div>

                {/* Context Preview */}
                {(companyContext.industry || companyContext.stage || companyContext.goals || companyContext.challenges) && (
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">AI will use this context:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {companyContext.industry && (
                        <span className="px-2 py-0.5 bg-brand-light text-brand-primary text-[10px] rounded-full">{companyContext.industry}</span>
                      )}
                      {companyContext.stage && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded-full">{companyContext.stage}</span>
                      )}
                      {companyContext.goals && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-full">Goals defined</span>
                      )}
                      {companyContext.challenges && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded-full">Challenges noted</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Team Roster Upload (Optional) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 text-left">
              Upload team roster <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-slate-500 text-left mb-3">
              Upload a CSV with your personnel for AI-powered talent suggestions.
            </p>
            
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => e.target.files?.[0] && handleCSVUpload(e.target.files[0])}
              className="hidden"
            />
            
            <div
              onDrop={handleCSVDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingCSV(true); }}
              onDragLeave={() => setIsDraggingCSV(false)}
              onClick={() => csvInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all duration-200
                ${isDraggingCSV 
                  ? 'border-brand-primary bg-brand-light/50 scale-[1.02]' 
                  : personnel.length > 0 
                    ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400' 
                    : 'border-slate-300 bg-slate-50 hover:border-brand-primary hover:bg-brand-light/30'
                }
              `}
            >
              {personnel.length > 0 ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-emerald-700">{personnel.length} team member{personnel.length !== 1 ? 's' : ''} loaded</p>
                    <p className="text-xs text-emerald-600">Click to replace or drag a new file</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-700">Drop CSV or click to browse</p>
                    <p className="text-xs text-slate-500">Name, Role, Department, Skills</p>
                  </div>
                </div>
              )}
            </div>
            
            {csvError && (
              <p className="text-red-500 text-xs mt-2 text-left flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {csvError}
              </p>
            )}

            {/* Personnel Preview */}
            {personnel.length > 0 && (
              <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Team Preview</span>
                  <button onClick={(e) => { e.stopPropagation(); clearPersonnel(); }} className="text-xs text-red-500 hover:text-red-700 font-medium">
                    Clear
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {personnel.slice(0, 5).map((person) => (
                    <div key={person.id} className="flex items-center justify-between px-4 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 group">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white text-[10px] font-bold">
                          {person.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-medium text-slate-800">{person.name}</p>
                          <p className="text-[10px] text-slate-500">{person.role}</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removePersonnel(person.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {personnel.length > 5 && (
                    <div className="px-4 py-1.5 text-center text-[10px] text-slate-500 bg-slate-50">
                      + {personnel.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Import Blueprint Tab */
        <div className="w-full max-w-lg space-y-6">
          {/* Company Name */}
          <div>
            <label htmlFor="companyNameImport" className="block text-sm font-medium text-slate-700 mb-2 text-left">
              What's your company's name?
            </label>
            <input
              id="companyNameImport"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Corporation"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
            />
            <p className="mt-1.5 text-xs text-slate-500 text-left">
              This may be overwritten if your blueprint contains a company name
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 text-left">
              Upload Strategy Blueprint
            </label>
            <p className="text-xs text-slate-500 text-left mb-3">
              Import a complete strategy blueprint JSON with objectives, key results, projects, and team resources.
            </p>
            
            <input
              ref={blueprintInputRef}
              type="file"
              accept=".json"
              onChange={(e) => e.target.files?.[0] && handleBlueprintUpload(e.target.files[0])}
              className="hidden"
            />
            
            <div
              onDrop={handleBlueprintDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingBlueprint(true); }}
              onDragLeave={() => setIsDraggingBlueprint(false)}
              onClick={() => blueprintInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200
                ${isDraggingBlueprint 
                  ? 'border-brand-primary bg-brand-light/50 scale-[1.02]' 
                  : blueprintLoaded 
                    ? 'border-emerald-300 bg-emerald-50 hover:border-emerald-400' 
                    : 'border-slate-300 bg-slate-50 hover:border-brand-primary hover:bg-brand-light/30'
                }
              `}
            >
              {blueprintLoaded && blueprintStats ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-base font-bold text-emerald-700">Blueprint Loaded Successfully!</p>
                      <p className="text-sm text-emerald-600">{companyName}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-white rounded-lg p-3 text-center border border-emerald-200">
                      <p className="text-xl font-bold text-brand-primary">{blueprintStats.objectives}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Objectives</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-emerald-200">
                      <p className="text-xl font-bold text-brand-primary">{blueprintStats.keyResults}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Key Results</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-emerald-200">
                      <p className="text-xl font-bold text-brand-primary">{blueprintStats.projects}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Projects</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center border border-emerald-200">
                      <p className="text-xl font-bold text-brand-primary">{blueprintStats.personnel}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">Team</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-emerald-600 text-center">Click to replace with another blueprint</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-light to-white border-2 border-brand-primary/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-semibold text-slate-700">Drop your JSON blueprint here</p>
                    <p className="text-sm text-slate-500 mt-1">or click to browse</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600">Objectives</span>
                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600">Key Results</span>
                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600">Projects</span>
                    <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-600">Resources</span>
                  </div>
                </div>
              )}
            </div>
            
            {blueprintError && (
              <p className="text-red-500 text-xs mt-2 text-left flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {blueprintError}
              </p>
            )}
          </div>

          {/* Blueprint Format Help */}
          <div className="bg-slate-50 rounded-xl p-4 text-left">
            <p className="text-xs font-semibold text-slate-700 mb-2">Supported JSON Formats:</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-medium text-slate-600 mb-1">Standard Format</p>
                <pre className="text-[10px] text-slate-600 bg-slate-100 p-2 rounded-lg overflow-x-auto">
{`{
  "metadata": {...},
  "objectives": [...],
  "key_results": [...],
  "projects": [...],
  "resources": [...]
}`}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-600 mb-1">Simplified Format</p>
                <pre className="text-[10px] text-slate-600 bg-slate-100 p-2 rounded-lg overflow-x-auto">
{`{
  "company": {...},
  "team": [...],
  "objectives": [
    { "key_results": [...],
      "projects": [...] }
  ]
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => {
          if (activeTab === 'import' && blueprintLoaded && onSkipToWorkspace) {
            onSkipToWorkspace();
          } else {
            onNext();
          }
        }}
        disabled={activeTab === 'manual' ? !companyName : !blueprintLoaded}
        className="mt-8 px-10 py-3.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed transition-all duration-200"
      >
        {activeTab === 'import' && blueprintLoaded 
          ? `Launch Strategy Workspace` 
          : "Let's Get Started"}
      </button>
    </div>
  );
};

export default WelcomeStep;
