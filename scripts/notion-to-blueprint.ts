/**
 * Notion CSV → Strategy Blueprint Converter
 *
 * Reads Notion-exported CSVs from scripts/notion-export/ and outputs
 * a valid StrategyBlueprint JSON file (pulley_blueprint.json).
 *
 * Processes all department project CSVs (Customer, Engineering, Finance,
 * IT, Legal, Marketing, Operations, Partnerships, Product, Revenue).
 *
 * Usage: npx tsx scripts/notion-to-blueprint.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(content: string): Record<string, string>[] {
  // Strip BOM
  const text = content.replace(/^\ufeff/, '');
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        current.push(field);
        field = '';
        if (ch === '\r') i++; // skip \n
        if (current.some(f => f.trim() !== '')) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  // Last field/row
  current.push(field);
  if (current.some(f => f.trim() !== '')) rows.push(current);

  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] ?? '').trim();
    });
    return obj;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip Notion URLs: "Name (https://www.notion.so/...)" → "Name" */
function cleanNotionUrl(value: string): string {
  return value.replace(/\s*\(https?:\/\/www\.notion\.so\/[^)]*\)/g, '').trim();
}

/** Split a Notion multi-relation field and clean each value.
 *  Handles names containing commas (e.g., "100% compliance (audit, GDPR, SOC1/2)") */
function splitRelation(value: string): string[] {
  if (!value) return [];
  // Match each "Name (https://www.notion.so/...)" entry as a whole unit,
  // so commas inside the name (e.g., "(audit, GDPR, SOC1/2)") aren't used as separators.
  const entries: string[] = [];
  const urlPattern = /(.+?)\s*\(https?:\/\/www\.notion\.so\/[^)]*\)/g;
  let match;
  while ((match = urlPattern.exec(value)) !== null) {
    const name = match[1].replace(/^,\s*/, '').trim();
    if (name) entries.push(name);
  }
  if (entries.length > 0) return entries;
  // Fallback: no Notion URLs present
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/** Parse dates like "June 1, 2026" or "January 15, 2026" → "2026-06-01" */
function parseNotionDate(dateStr: string): string {
  if (!dateStr) return '';
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Generate a slug ID from a string */
function slugId(prefix: string, name: string): string {
  return prefix + '_' + name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

// ─── CSV File Detection ───────────────────────────────────────────────────────

const CSV_DIR = path.join(__dirname, 'notion-export');

function findCSVFiles(): {
  objectives: string;
  companyKRs: string;
  deptKRs: string;
  projectFiles: { file: string; department: string }[];
  people: string;
  teams: string;
} {
  if (!fs.existsSync(CSV_DIR)) {
    throw new Error(`CSV directory not found: ${CSV_DIR}\nPlace Notion CSV exports in scripts/notion-export/`);
  }

  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  if (files.length === 0) {
    throw new Error(`No CSV files found in ${CSV_DIR}`);
  }

  // Auto-detect non-project CSVs by scanning column headers
  const detected: Record<string, string> = {};
  const signatureMap: Record<string, { required: string[]; key: string }> = {
    objectives: { required: ['Company Objective(s)'], key: 'objectives' },
    companyKRs: { required: ['Company Key Result'], key: 'companyKRs' },
    deptKRs: { required: ['Department Key Result(s)'], key: 'deptKRs' },
    people: { required: ['Person Name'], key: 'people' },
    teams: { required: ['Team Name'], key: 'teams' },
  };

  for (const file of files) {
    const content = fs.readFileSync(path.join(CSV_DIR, file), 'utf-8');
    const firstLine = content.replace(/^\ufeff/, '').split('\n')[0];

    for (const [, sig] of Object.entries(signatureMap)) {
      if (sig.required.every(col => firstLine.includes(col)) && !detected[sig.key]) {
        detected[sig.key] = file;
      }
    }
  }

  // Detect all project CSVs by filename pattern ("Projects <Department>.csv")
  const projectFiles = files
    .filter(f => f.startsWith('Projects '))
    .map(f => ({
      file: f,
      department: f.replace(/^Projects\s+/, '').replace(/\.csv$/, ''),
    }));

  const missing = ['objectives', 'companyKRs', 'deptKRs', 'people', 'teams']
    .filter(k => !detected[k]);
  if (missing.length > 0) {
    console.log('\nDetected files:', detected);
    throw new Error(`Could not auto-detect CSV files for: ${missing.join(', ')}\nFiles found: ${files.join(', ')}`);
  }
  if (projectFiles.length === 0) {
    throw new Error(`No project CSV files found (expected files named "Projects <Department>.csv")\nFiles found: ${files.join(', ')}`);
  }

  console.log('Detected CSV files:');
  for (const [key, file] of Object.entries(detected)) {
    console.log(`  ${key}: ${file}`);
  }
  console.log(`  projectFiles: ${projectFiles.map(p => `${p.file} (${p.department})`).join(', ')}`);

  return { ...detected, projectFiles } as any;
}

// ─── Main Conversion ──────────────────────────────────────────────────────────

function convert() {
  const csvFiles = findCSVFiles();

  // ─── Phase A: Parse all CSVs ─────────────────────────────────────────
  const readCSV = (file: string) =>
    parseCSV(fs.readFileSync(path.join(CSV_DIR, file), 'utf-8'));

  const objectivesData = readCSV(csvFiles.objectives);
  const companyKRsData = readCSV(csvFiles.companyKRs);
  const deptKRsData = readCSV(csvFiles.deptKRs);
  const peopleData = readCSV(csvFiles.people);
  const teamsData = readCSV(csvFiles.teams);

  // ─── Phase B: Build OKR Hierarchy ────────────────────────────────────

  // B1. Objectives
  const objectives = objectivesData.map((row, i) => {
    const name = cleanNotionUrl(row['Company Objective(s)'] || row['Name'] || '');
    const id = `O${i + 1}`;
    return {
      id,
      theme: 'Strategy',
      objective: name,
      description: row['Description'] || '',
      owner: cleanNotionUrl(row['DRI'] || 'Grant Oladipo'),
      time_horizon: row['Target Date'] ? parseNotionDate(row['Target Date']) : 'FY2026',
      priority: 'high' as const,
      status: 'in_progress' as const,
      progress: 0,
      key_results: [] as string[],
      _name: name, // internal lookup
    };
  });

  const objectiveByName = new Map(objectives.map(o => [o._name, o]));

  // B2. Company Key Results
  const keyResults = companyKRsData.map((row, i) => {
    const name = cleanNotionUrl(row['Company Key Result'] || row['Name'] || '');
    const objectiveLinks = splitRelation(row['Objectives'] || row['Company Objective(s)'] || '');

    // Find parent objective
    let objectiveId = objectives[0]?.id || 'O1';
    for (const link of objectiveLinks) {
      const obj = objectiveByName.get(link);
      if (obj) { objectiveId = obj.id; break; }
    }

    const id = `KR${i + 1}`;

    // Register this KR on the objective
    const parentObj = objectives.find(o => o.id === objectiveId);
    if (parentObj) parentObj.key_results.push(id);

    // Try to extract metric info from the name
    const numMatch = name.match(/\$?([\d,.]+[MKBmkb]?)/);
    const target = numMatch ? parseFloat(numMatch[1].replace(/[,]/g, '').replace(/[Mm]$/, '000000').replace(/[Kk]$/, '000').replace(/[Bb]$/, '000000000')) : 1;

    return {
      id,
      objective_id: objectiveId,
      description: name,
      detail: row['Description'] || '',
      metric: name,
      metric_type: name.includes('$') ? 'currency' as const : 'count' as const,
      baseline: 0,
      target,
      current: 0,
      progress: 0,
      owner: cleanNotionUrl(row['DRI'] || ''),
      status: 'in_progress',
      target_date: parseNotionDate(row['Target Date'] || ''),
      departmental_key_results: [] as any[],
      _name: name, // internal lookup
    };
  });

  const krByName = new Map(keyResults.map(kr => [kr._name, kr]));

  // B3. Department Key Results (all departments)
  // Two-level map: DKR name → department → DKR id (handles duplicate names like "No department key results")
  const dkrByNameDept = new Map<string, Map<string, string>>();
  let dkrIndex = 0;

  for (const row of deptKRsData) {
    const name = cleanNotionUrl(row['Department Key Result(s)'] || row['Department Key Results'] || row['Name'] || '');
    const dept = cleanNotionUrl(row['Department'] || '');

    dkrIndex++;
    const id = `DKR${dkrIndex}`;

    // Find parent Company KR
    const companyKRLinks = splitRelation(row['Company Key Result'] || row['Company Key Results'] || '');
    let parentKR = keyResults[0];
    for (const link of companyKRLinks) {
      const kr = krByName.get(link);
      if (kr) { parentKR = kr; break; }
    }

    // Extract metric from name
    const numMatch = name.match(/(\d[\d,.]*)/);
    const target = numMatch ? parseFloat(numMatch[1].replace(/,/g, '')) : 1;

    const dkr = {
      id,
      company_kr_id: parentKR.id,
      department: dept || 'Unknown',
      description: name,
      detail: row['Description'] || '',
      metric: name,
      metric_type: name.includes('$') ? 'currency' : 'count',
      baseline: 0,
      target,
      current: 0,
      progress: 0,
      owner: cleanNotionUrl(row['DRI'] || ''),
      status: 'in_progress',
      target_date: parseNotionDate(row['Target Date'] || ''),
      linked_projects: [] as string[],
    };

    parentKR.departmental_key_results.push(dkr);
    if (!dkrByNameDept.has(name)) dkrByNameDept.set(name, new Map());
    dkrByNameDept.get(name)!.set(dept, id);
  }

  // Build team name → member names lookup from Teams CSV (needed for inline project teams)
  const teamMembersByName = new Map<string, string[]>();
  for (const row of teamsData) {
    const name = cleanNotionUrl(row['Team Name'] || row['Name'] || '');
    const members = splitRelation(row['People'] || '');
    if (name) teamMembersByName.set(name, members);
  }

  // Build DKR ID → parent company KR ID lookup
  const dkrToCompanyKR = new Map<string, string>();
  for (const kr of keyResults) {
    for (const dkr of kr.departmental_key_results) {
      dkrToCompanyKR.set(dkr.id, kr.id);
    }
  }

  // ─── Phase C: Build Projects (all departments) ─────────────────────

  let projectIndex = 0;
  const projects: any[] = [];

  for (const { file, department: filenameDept } of csvFiles.projectFiles) {
    const projectRows = readCSV(file);

    for (const row of projectRows) {
      projectIndex++;
      const name = row['Project Name'] || row['Name'] || `Project ${projectIndex}`;
      const id = `P${projectIndex}`;

      // Department from CSV "Departments" column (parent org group), fallback to filename
      const department = cleanNotionUrl(row['Departments'] || '') || filenameDept;

      // Parse DKR links and resolve to parent company KR IDs for drives_krs
      const dkrLinks = splitRelation(row['Department Key Results'] || '');
      const companyKrIds = new Set<string>();
      for (const link of dkrLinks) {
        // Department-aware lookup: try exact dept match first, then any match
        const deptMap = dkrByNameDept.get(link);
        const dkrId = deptMap?.get(department) || (deptMap ? [...deptMap.values()][0] : undefined);
        if (dkrId) {
          // Register this project on the DKR's linked_projects
          for (const kr of keyResults) {
            for (const dkr of kr.departmental_key_results) {
              if (dkr.id === dkrId) {
                dkr.linked_projects.push(id);
              }
            }
          }
          // Map DKR to its parent company KR
          const ckrId = dkrToCompanyKR.get(dkrId);
          if (ckrId) companyKrIds.add(ckrId);
        }
      }

      // Fallback: use Company KR column directly
      if (companyKrIds.size === 0) {
        const ckrLinks = splitRelation(row['Company Key Result'] || '');
        for (const link of ckrLinks) {
          const kr = krByName.get(link);
          if (kr) companyKrIds.add(kr.id);
        }
      }

      const drivesKrs = [...companyKrIds];

      const teamMembers = splitRelation(row['People'] || '');
      const lead = cleanNotionUrl(row['DRI 2'] || row['DRI'] || teamMembers[0] || '');

      // Build inline teams from the Teams column (pure team membership only)
      const projectTeamNames = splitRelation(row['Teams'] || '');
      const inlineTeams = projectTeamNames
        .map(teamName => {
          const members = teamMembersByName.get(teamName);
          if (!members || members.length === 0) return null;
          return {
            id: slugId('T', `${teamName}_${id}`),
            name: teamName,
            project_id: id,
            department,
            member_ids: members,
          };
        })
        .filter(Boolean) as { id: string; name: string; project_id: string; department: string; member_ids: string[] }[];

      projects.push({
        id,
        name,
        drives_krs: drivesKrs,
        department,
        lead,
        team_members: teamMembers.filter(m => m !== lead),
        start_date: parseNotionDate(row['Start Date'] || ''),
        end_date: parseNotionDate(row['End Date'] || ''),
        status: 'not_started' as const,
        progress: 0,
        priority: 'medium' as const,
        description: row['Description'] || '',
        ...(inlineTeams.length > 0 ? { teams: inlineTeams } : {}),
      });
    }
  }

  // ─── Phase D: Build People & Teams ───────────────────────────────────

  const resources = peopleData.map((row, i) => {
    const name = cleanNotionUrl(row['Person Name'] || row['Person'] || row['Name'] || '');
    return {
      id: slugId('R', name || `person_${i}`),
      name,
      role: cleanNotionUrl(row['Job Title'] || row['Role'] || ''),
      department: cleanNotionUrl(row['Department'] || ''),
      skills: splitRelation(row['Skills'] || ''),
      availability: 1.0,
      utilization: 0,
      assigned_projects: [] as string[],
      cost_center: cleanNotionUrl(row['Department'] || ''),
      reports_to: null,
    };
  });

  // Assign projects to resources
  for (const proj of projects) {
    const allMembers = [proj.lead, ...proj.team_members];
    for (const member of allMembers) {
      const resource = resources.find(r => r.name === member);
      if (resource && !resource.assigned_projects.includes(proj.id)) {
        resource.assigned_projects.push(proj.id);
      }
    }
  }

  const teams = teamsData.map((row, i) => {
    const name = cleanNotionUrl(row['Team Name'] || row['Name'] || '');
    const members = splitRelation(row['People'] || '');
    const memberIds = members
      .map(m => resources.find(r => r.name === m)?.id)
      .filter(Boolean) as string[];

    return {
      id: slugId('T', name || `team_${i}`),
      name,
      project_id: '',
      department: '',
      member_ids: memberIds,
    };
  });

  // ─── Phase E: Assemble & Output ──────────────────────────────────────

  // Clean internal _name fields before output
  const cleanObjectives = objectives.map(({ _name, ...rest }) => rest);
  const cleanKeyResults = keyResults.map(({ _name, ...rest }) => rest);

  const blueprint = {
    metadata: {
      company_name: 'Pulley',
      company_stage: 'Series B',
      headcount: peopleData.length || 80,
      planning_period: 'FY2026',
      current_date: '2026-03-16',
      last_updated: '2026-03-16',
      currency: 'USD',
    },
    objectives: cleanObjectives,
    key_results: cleanKeyResults,
    projects,
    resources,
    teams,
    dependencies: [],
  };

  // Write output
  const outPath = path.join(__dirname, '..', 'pulley_blueprint.json');
  fs.writeFileSync(outPath, JSON.stringify(blueprint, null, 2));

  // Summary
  console.log('\n--- Blueprint Summary ---');
  console.log(`Objectives:        ${objectives.length}`);
  console.log(`Company KRs:       ${keyResults.length}`);
  console.log(`Dept KRs (All):    ${dkrIndex}`);
  console.log(`Projects (total):  ${projects.length}`);
  const deptCounts = new Map<string, number>();
  projects.forEach(p => deptCounts.set(p.department, (deptCounts.get(p.department) || 0) + 1));
  for (const [dept, count] of [...deptCounts.entries()].sort()) {
    console.log(`  ${dept}: ${count}`);
  }
  console.log(`People:            ${resources.length}`);
  console.log(`Teams:             ${teams.length}`);
  console.log(`\nOutput: ${outPath}`);

  // Linkage check
  const unlinked = projects.filter(p => p.drives_krs.length === 0);
  if (unlinked.length > 0) {
    console.log(`\nWARNING: ${unlinked.length} project(s) not linked to any DKR:`);
    unlinked.forEach(p => console.log(`  - ${p.name}`));
  }
}

convert();
