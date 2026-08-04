const STORAGE_KEY = "curriculo-studio:v1";
const WORKSPACE_KEY = "curriculo-studio:workspace:v1";
const BACKUP_KEY = "curriculo-studio:last-backup:v1";

function readWorkspace() { try { const data = JSON.parse(localStorage.getItem(WORKSPACE_KEY)); return data?.version === 1 && Array.isArray(data.resumes) ? data : null; } catch { return null; } }
function writeWorkspace(workspace) { localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace)); }

export function saveState(state) {
  try { const workspace = readWorkspace() || { version: 1, activeResumeId: state.metadata.id, resumes: [] }; const record = { id: state.metadata.id, name: state.metadata.name || "Meu currículo", updatedAt: state.metadata.updatedAt, createdAt: state.metadata.createdAt, data: state }; const index = workspace.resumes.findIndex((resume) => resume.id === record.id); if (index >= 0) workspace.resumes[index] = record; else workspace.resumes.push(record); workspace.activeResumeId = record.id; writeWorkspace(workspace); localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
  catch (error) { console.warn("Não foi possível salvar o currículo.", error); return false; }
}

export function loadState() {
  try {
    const workspace = readWorkspace();
    if (workspace) return migrateResumeData(workspace.resumes.find((resume) => resume.id === workspace.activeResumeId)?.data || workspace.resumes[0]?.data);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return migrateResumeData(data);
  } catch (error) { console.warn("Dados locais inválidos foram ignorados.", error); return null; }
}

export function listResumes() { const workspace = readWorkspace(); return workspace?.resumes.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })) || []; }
export function loadResume(id) { return migrateResumeData(readWorkspace()?.resumes.find((resume) => resume.id === id)?.data); }
export function removeResume(id) { const workspace = readWorkspace(); if (!workspace || workspace.resumes.length <= 1) return false; workspace.resumes = workspace.resumes.filter((resume) => resume.id !== id); if (workspace.activeResumeId === id) workspace.activeResumeId = workspace.resumes[0].id; writeWorkspace(workspace); return true; }
export function backupState(state) { try { localStorage.setItem(BACKUP_KEY, JSON.stringify(state)); return true; } catch { return false; } }
export function loadBackup() { try { return migrateResumeData(JSON.parse(localStorage.getItem(BACKUP_KEY))); } catch { return null; } }

export function migrateResumeData(data) {
  if (!data || !Array.isArray(data.sections)) return null;
  data.version = 1; data.layout ||= { columns: 1, columnRatio: "35-65" }; data.layout.columnRatio ||= "35-65";
  data.sections.forEach((section, index) => { section.visible ??= true; section.column ??= 1; section.order ??= index; section.settings ||= {}; section.customFields ||= []; section.items ||= []; section.items.forEach((item) => { item.customFields ||= []; item.visibleFields ||= {}; if (section.type === "header") item.photoSettings ||= { shape: "round", size: 84, borderWidth: 0, borderColor: "#2f6db1", position: "right" }; if (section.type === "experience") { item.remote ??= false; item.current ??= false; item.activities = Array.isArray(item.activities) ? item.activities.map((activity, activityIndex) => typeof activity === "string" ? ({ id: `activity-migrated-${activityIndex}-${Date.now()}`, text: activity }) : activity) : String(item.activities || "").split("\n").filter(Boolean).map((text, activityIndex) => ({ id: `activity-migrated-${activityIndex}-${Date.now()}`, text })); item.technologies ||= ""; item.projectLink ||= ""; } if (section.type === "education") item.current ??= false; if (section.type === "projects") item.images ||= []; if (section.type === "languages") { item.level ||= ""; item.customLevel ||= ""; item.certificate ||= ""; } if (section.type === "certifications") item.noExpiry ??= false; }); });
  data.sections.filter((section) => section.type === "skills").forEach((section) => {
    if (section.items.length === 1 && Array.isArray(section.items[0]?.values)) section.items = section.items[0].values.map((title, index) => ({ id: `skill-migrated-${index}-${Date.now()}`, title, level: "", category: "", description: "", customFields: [] }));
  });
  return data;
}

export function clearState() { localStorage.removeItem(STORAGE_KEY); }
