import { createDemoState, getState, redoState, setState, undoState, updateState } from "./state.js";
import { backupState, clearState, listResumes, loadBackup, loadResume, loadState, migrateResumeData, removeResume, saveState } from "./storage.js";
import { renderEditor } from "./render-editor.js";
import { renderPreview } from "./render-preview.js";
import { createId, debounce } from "./utils.js";

let activeTab = "content";
let zoom = 80;
let dialogOpener = null;
let openSectionIds = new Set();
let sectionOpenStateInitialized = false;
const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function dateDialogPicker(key, value = "") { const [year = "", month = ""] = String(value).split("-"); return `<label class="date-picker date-picker--dialog">${key === "start" ? "Início" : "Término"}<div class="date-picker__months">${monthNames.map((name, index) => `<button type="button" data-action="select-dialog-month" data-date-dialog-key="${key}" data-month="${String(index + 1).padStart(2,"0")}" class="${month === String(index + 1).padStart(2,"0") ? "is-selected" : ""}">${name}</button>`).join("")}</div><input id="date-dialog-${key}" type="hidden" value="${value}"><input class="date-picker__year" data-dialog-year="${key}" inputmode="numeric" placeholder="Ano (ex. 2026)" value="${year}"></label>`; }
const persisted = loadState();
if (persisted) setState(persisted);
if (!listResumes().length) saveState(getState());

function renderEditorKeepingSections() {
  const currentCards = [...document.querySelectorAll("#editor-content .section-card")];
  if (currentCards.length) {
    openSectionIds = new Set(currentCards.filter((card) => card.classList.contains("is-open")).map((card) => card.dataset.sectionCard));
    sectionOpenStateInitialized = true;
  }
  renderEditor(getState(), activeTab);
  const nextCards = [...document.querySelectorAll("#editor-content .section-card")];
  if (sectionOpenStateInitialized) nextCards.forEach((card) => {
    const isOpen = openSectionIds.has(card.dataset.sectionCard);
    card.classList.toggle("is-open", isOpen);
    card.querySelector(".section-card__header")?.setAttribute("aria-expanded", String(isOpen));
  });
  else if (nextCards.length) {
    openSectionIds = new Set(nextCards.filter((card) => card.classList.contains("is-open")).map((card) => card.dataset.sectionCard));
    sectionOpenStateInitialized = true;
  }
}
function renderAll() { renderEditorKeepingSections(); renderPreview(getState()); updateZoom(); updateResumeSelector(); }
function updateResumeSelector() { const selector = document.querySelector("#resume-selector"); if (!selector) return; selector.innerHTML = listResumes().map((resume) => `<option value="${resume.id}">${resume.name}</option>`).join(""); selector.value = getState().metadata.id; }

function updateZoom() {
  document.querySelector("#resume-preview").style.transform = `scale(${zoom / 100})`;
  document.querySelector("#zoom-value").value = `${zoom}%`;
}
function toast(message) {
  const node = document.createElement("div"); node.className = "toast"; node.textContent = message;
  document.querySelector("#toast-region").append(node); setTimeout(() => node.remove(), 2600);
}
function askDialog({ title, message = "", value = "", label = "Nome", confirmLabel = "Confirmar", input = false, danger = false }) {
  const dialog = document.querySelector("#app-dialog");
  const field = document.querySelector("#app-dialog-field");
  const textInput = document.querySelector("#app-dialog-input");
  document.querySelector("#app-dialog-title").textContent = title;
  document.querySelector("#app-dialog-message").textContent = message;
  document.querySelector("#app-dialog-label").textContent = label;
  document.querySelector("#app-dialog-confirm").textContent = confirmLabel;
  document.querySelector("#app-dialog-confirm").classList.toggle("button--danger", danger);
  field.hidden = !input; textInput.value = value;
  dialogOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return new Promise((resolve) => {
    const close = () => { dialog.removeEventListener("close", close); const result = dialog.returnValue === "confirm" ? (input ? textInput.value.trim() : true) : null; dialogOpener?.focus(); dialogOpener = null; resolve(result); };
    dialog.addEventListener("close", close); dialog.showModal();
    if (input) setTimeout(() => textInput.focus(), 0);
  });
}
function persist(message = "Salvo automaticamente") {
  const ok = saveState(getState());
  const status = document.querySelector("#save-status"); if (status) status.textContent = ok ? message : "Não foi possível salvar";
}
const autoSave = debounce(() => persist(), 450);

function createItemFor(section) {
  const id = createId("item");
  const base = { id, title: "Novo item", customFields: [], visibleFields: {} };
  if (section.type === "skills") return { ...base, title: "", subtitle: "Novo grupo", tags: "" };
  if (section.type === "languages") return { ...base, title: "Novo idioma", level: "", date: "", description: "" };
  if (section.type === "experience") return { ...base, title: "Novo cargo", organization: "", city: "", state: "", country: "", remote: false, start: "", end: "", current: false, projectLink: "", description: "", descriptionBullets: false };
  if (section.type === "education") return { ...base, title: "Nova formação", degree: "", organization: "", city: "", state: "", country: "", start: "", end: "", current: false, certificate: "", link: "", description: "" };
  if (section.type === "courses") return { ...base, title: "Novo curso", organization: "", hours: "", date: "", description: "" };
  if (section.type === "certifications") return { ...base, title: "Nova certificação", organization: "", date: "", description: "" };
  if (section.type === "projects") return { ...base, title: "Novo projeto", subtitle: "", site: "", projectLink: "", date: "", images: [], description: "" };
  if (section.type === "awards") return { ...base, title: "", subtitle: "", organization: "", city: "", date: "", description: "" };
  if (section.type === "strengths") return { ...base, title: "", subtitle: "", description: "" };
  if (section.type === "volunteering") return { ...base, title: "", subtitle: "", city: "", description: "" };
  if (section.type === "references") return { ...base, title: "", phone: "", organization: "", description: "" };
  return { ...base, organization: "", period: "", description: "" };
}

function cloneSection(section) {
  const clone = structuredClone(section);
  clone.id = createId("section");
  clone.title = `${section.title} (cópia)`;
  const cloneFields = (fields = []) => fields.map((field) => ({ ...field, id: createId("field") }));
  clone.items = clone.items.map((item) => ({ ...item, id: createId("item"), customFields: cloneFields(item.customFields), activities: Array.isArray(item.activities) ? item.activities.map((activity) => ({ ...activity, id: createId("activity") })) : item.activities }));
  clone.customFields = cloneFields(clone.customFields);
  return clone;
}

function normalizeOrder(state) {
  state.sections.forEach((section, index) => { section.order = index; });
}

function downloadJson() { const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "meu-curriculo.json"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); }
function importErrors(data) {
  const errors = [];
  if (!data || typeof data !== "object") return ["O arquivo não contém um projeto válido."];
  if (data.version !== 1) errors.push("A versão do projeto não é compatível.");
  if (!data.metadata || typeof data.metadata.id !== "string" || !data.metadata.id) errors.push("Metadados do currículo ausentes.");
  if (!data.layout || typeof data.layout !== "object") errors.push("Configurações de layout ausentes.");
  if (!data.theme || typeof data.theme !== "object") errors.push("Configurações visuais ausentes.");
  if (!Array.isArray(data.sections) || !data.sections.length) errors.push("Nenhuma categoria foi encontrada.");
  else data.sections.forEach((section, index) => {
    if (!section || typeof section.id !== "string" || !section.id) errors.push(`Categoria ${index + 1} sem identificador.`);
    if (!section || typeof section.type !== "string" || !section.type) errors.push(`Categoria ${index + 1} sem tipo.`);
    if (!Array.isArray(section?.items)) errors.push(`Itens inválidos na categoria ${index + 1}.`);
    if (section?.customFields !== undefined && !Array.isArray(section.customFields)) errors.push(`Campos personalizados inválidos na categoria ${index + 1}.`);
  });
  return errors;
}
function isValidState(data) { return importErrors(data).length === 0; }
function reorderItems(state, sectionId, fromId, toId) { const items = state.sections.find((section) => section.id === sectionId)?.items; if (!items || fromId === toId) return; const from = items.findIndex((item) => item.id === fromId), to = items.findIndex((item) => item.id === toId); if (from < 0 || to < 0) return; const [item] = items.splice(from, 1); items.splice(to, 0, item); }

function createCustomField(label, type) {
  return { id: createId("field"), label, type, value: type === "checkbox" ? false : "", placeholder: "", visible: true, required: false, order: 0 };
}

function validateInput(input) {
  const value = input.value.trim(); let message = "";
  if (value && input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = "Informe um e-mail válido.";
  if (value && input.type === "url" && !/^(https?:\/\/)?[^\s.]+\.[^\s]+/i.test(value)) message = "Informe um link válido.";
  if (["end", "expires"].includes(input.dataset.itemKey)) { const item = getState().sections.find((section) => section.id === input.dataset.sectionId)?.items.find((entry) => entry.id === input.dataset.itemId); const initial = input.dataset.itemKey === "expires" ? item?.issued : item?.start; if (value && initial && value < initial) message = input.dataset.itemKey === "expires" ? "A validade não pode ser anterior à emissão." : "O término não pode ser anterior ao início."; }
  input.setAttribute("aria-invalid", String(Boolean(message)));
  let error = input.parentElement?.querySelector(".field-error");
  if (!error && message) { error = document.createElement("small"); error.className = "field-error"; input.insertAdjacentElement("afterend", error); }
  if (error) { error.textContent = message; error.hidden = !message; }
  return !message;
}

document.addEventListener("click", async (event) => {
  if (!event.target.closest(".font-picker")) document.querySelectorAll(".font-picker__menu").forEach((menu) => { menu.hidden = true; menu.previousElementSibling?.setAttribute("aria-expanded", "false"); });
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    activeTab = tab.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((node) => { node.classList.toggle("is-active", node === tab); node.setAttribute("aria-selected", node === tab); });
    renderEditorKeepingSections(); return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "apply-original-template") { updateState((state) => { Object.assign(state.theme, { template: "original", fontFamily: "Arial, sans-serif", fontSize: 14, lineHeight: 1.5, accentColor: "#2f6db1", titleColor: "#183b68", subtitleColor: "#2f6db1", textColor: "#253044", mutedColor: "#6b7789", linkColor: "#2f6db1", dividerColor: "#cfdae7", backgroundColor: "#ffffff", pagePadding: 18, sectionGap: 18, itemGap: 12, titleSize: 12, titleWeight: 700, titleTransform: "uppercase", borderRadius: 0, showDividers: true, dividerWidth: 1 }); state.layout.columns = 1; state.layout.columnRatio = "35-65"; state.sections.forEach((section) => { section.column = 1; }); }); renderAll(); autoSave(); toast("Modelo Original aplicado."); return; }
  if (action === "apply-compact-template") { updateState((state) => { Object.assign(state.theme, { template: "compact", fontFamily: "Arial, sans-serif", fontSize: 11.5, lineHeight: 1.3, accentColor: "#1687d1", titleColor: "#173a5a", subtitleColor: "#1687d1", textColor: "#344556", mutedColor: "#607080", linkColor: "#1687d1", dividerColor: "#2681bd", backgroundColor: "#ffffff", pagePadding: 11, sectionGap: 10, itemGap: 6, titleSize: 10, titleWeight: 800, titleTransform: "uppercase", borderRadius: 0, showDividers: true, dividerWidth: 2, contrastMode: "darkHeader" }); state.layout.columns = 2; state.layout.columnRatio = "60-40"; state.sections.forEach((section) => { section.column = ["summary", "skills", "languages", "strengths", "certifications", "awards"].includes(section.type) ? 2 : 1; }); }); renderAll(); autoSave(); toast("Modelo Compacto Executivo aplicado."); return; }
  if (action === "apply-executive-template") { updateState((state) => { Object.assign(state.theme, { template: "sidebar-right", fontFamily: "Arial, sans-serif", fontSize: 11.5, lineHeight: 1.32, accentColor: "#35a0e8", titleColor: "#173a5a", subtitleColor: "#1687d1", textColor: "#344556", mutedColor: "#5e6f7e", linkColor: "#1687d1", dividerColor: "#d7e0e7", backgroundColor: "#ffffff", pagePadding: 12, sectionGap: 11, itemGap: 7, titleSize: 10, titleWeight: 800, titleTransform: "uppercase", borderRadius: 0, showDividers: true, dividerWidth: 1 }); state.layout.columns = 2; state.layout.columnRatio = "65-35"; state.sections.forEach((section) => { section.column = ["summary", "skills", "languages", "strengths", "certifications", "awards"].includes(section.type) ? 2 : 1; }); }); renderAll(); autoSave(); toast("Modelo Executivo aplicado."); return; }
  if (action === "apply-sidebar-template") { updateState((state) => { Object.assign(state.theme, { template: "sidebar", fontFamily: "Arial, sans-serif", fontSize: 12, lineHeight: 1.35, accentColor: "#2c88c9", titleColor: "#173a5a", subtitleColor: "#2c88c9", textColor: "#3d4855", mutedColor: "#586778", linkColor: "#2c88c9", dividerColor: "#b7c7d5", backgroundColor: "#ffffff", pagePadding: 12, sectionGap: 13, itemGap: 9, titleSize: 11, titleWeight: 800, titleTransform: "uppercase", borderRadius: 0, showDividers: true, dividerWidth: 1 }); state.layout.columns = 2; state.layout.columnRatio = "35-65"; state.sections.forEach((section) => { section.column = ["summary", "skills", "languages", "strengths", "certifications"].includes(section.type) ? 1 : 2; }); }); renderAll(); autoSave(); toast("Modelo Barra lateral aplicado."); return; }
  if (action === "apply-analyst-template") { updateState((state) => { Object.assign(state.theme, { template: "analyst", fontFamily: "Arial, sans-serif", fontSize: 13, lineHeight: 1.35, accentColor: "#1687ff", titleColor: "#111111", subtitleColor: "#1687ff", textColor: "#353535", mutedColor: "#4b4b4b", linkColor: "#1687ff", dividerColor: "#111111", backgroundColor: "#ffffff", pagePadding: 14, sectionGap: 14, itemGap: 9, titleSize: 12, titleWeight: 800, titleTransform: "uppercase", borderRadius: 0, showDividers: true, dividerWidth: 3 }); state.layout.columns = 2; state.layout.columnRatio = "60-40"; state.sections.forEach((section) => { section.column = ["summary", "skills", "projects", "languages"].includes(section.type) ? 2 : 1; }); }); renderAll(); autoSave(); toast("Modelo Analista aplicado."); return; }
  if (action === "select-birthday-day" || action === "select-birthday-month") { const header = getState().sections.find((section) => section.type === "header")?.items[0]; const [year = "", month = "", day = ""] = String(header?.birthdate || "").split("-"); const nextDay = action === "select-birthday-day" ? event.target.dataset.day : (day || "01"); const nextMonth = action === "select-birthday-month" ? event.target.dataset.month : (month || "01"); updateState((state) => { const item = state.sections.find((section) => section.type === "header")?.items[0]; if (item) item.birthdate = `${year || "1990"}-${nextMonth}-${nextDay}`; }); event.target.closest(".birthday-picker__days, .birthday-picker__months")?.querySelectorAll("button").forEach((button) => button.classList.toggle("is-selected", button === event.target)); if (action === "select-birthday-month") event.target.closest(".birthday-picker__month-menu")?.removeAttribute("open"); renderPreview(getState()); autoSave(); return; }
  if (action === "apply-birthday") { renderAll(); autoSave(); return; }
  if (action === "select-dialog-month") { const { dateDialogKey: key, month } = event.target.dataset; const hidden = document.querySelector(`#date-dialog-${key}`), year = document.querySelector(`[data-dialog-year="${key}"]`)?.value || new Date().getFullYear(); if (hidden) hidden.value = `${year}-${month}`; event.target.closest(".date-picker__months")?.querySelectorAll("button").forEach((button) => button.classList.toggle("is-selected", button === event.target)); return; }
  if (action === "select-item-month") { const { sectionId, itemId, itemKey, month } = event.target.dataset; updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (!item) return; const [year = new Date().getFullYear()] = String(item[itemKey] || "").split("-"); item[itemKey] = `${year}-${month}`; }); renderAll(); autoSave(); return; }
  if (action === "clear-item-date") { const { sectionId, itemId, itemKey } = event.target.dataset; updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) item[itemKey] = ""; }); renderAll(); autoSave(); toast("Data removida."); return; }
  if (action === "toggle-course-preview-field") { const { sectionId, itemId, itemKey } = event.target.dataset; updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) { const section = state.sections.find((entry) => entry.id === sectionId); if (!section) return; section.settings.visibleFields ||= {}; const visible = section.settings.visibleFields[itemKey] === false; section.settings.visibleFields[itemKey] = visible; section.items.forEach((entry) => { entry.visibleFields ||= {}; entry.visibleFields[itemKey] = !visible; }); } }); renderAll(); autoSave(); return; }
  if (action === "toggle-description-bullets") { const { sectionId, itemId } = event.target.closest("[data-action]").dataset; updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) item.descriptionBullets = !item.descriptionBullets; }); renderAll(); autoSave(); toast("Destaque dos parágrafos atualizado."); return; }
  if (action === "set-summary-alignment") { const { sectionId, alignment } = event.target.closest("[data-action]").dataset; if (!["left", "center", "right", "justify"].includes(alignment)) return; updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId && entry.type === "summary"); if (section) section.settings.textAlign = alignment; }); renderAll(); autoSave(); return; }
  if (action === "cycle-language-level") { const { sectionId, itemId } = event.target.dataset; updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) item.level = (Number(item.level) + 1) % 6; }); renderAll(); autoSave(); return; }
  if (action === "toggle-font-picker") { const picker = event.target.closest(".font-picker"); const menu = picker?.querySelector(".font-picker__menu"); const open = menu?.hidden; document.querySelectorAll(".font-picker__menu").forEach((entry) => { entry.hidden = true; entry.previousElementSibling?.setAttribute("aria-expanded", "false"); }); if (menu) { menu.hidden = !open; picker.querySelector(".font-picker__trigger")?.setAttribute("aria-expanded", String(open)); if (open) menu.focus(); } return; }
  if (action === "select-font") { const value = event.target.dataset.fontValue; updateState((state) => { state.theme.fontFamily = value; }); renderAll(); autoSave(); return; }
  if (action === "apply-palette" && event.target.dataset.palette === "analista") { updateState((state) => Object.assign(state.theme, { accentColor: "#1687ff", titleColor: "#111111", subtitleColor: "#1687ff", textColor: "#353535", mutedColor: "#4b4b4b", linkColor: "#1687ff", dividerColor: "#111111", backgroundColor: "#ffffff" })); renderAll(); autoSave(); toast("Paleta Analista aplicada."); return; }
  if (action === "apply-palette" && event.target.dataset.palette === "vermelho") { updateState((state) => Object.assign(state.theme, { accentColor: "#C62828", titleColor: "#8E1B1B", subtitleColor: "#C62828", textColor: "#2F2525", mutedColor: "#745C5C", linkColor: "#C62828", dividerColor: "#E6C3C3", backgroundColor: "#FFFFFF" })); renderAll(); autoSave(); toast("Paleta vermelha aplicada."); return; }
  if (action === "apply-palette") { const palette = { marinho: ["#1E3A8A", "#172554", "#263445"], grafite: ["#374151", "#111827", "#374151"], preto: ["#171717", "#000000", "#262626"], verde: ["#047857", "#065F46", "#26352F"], roxo: ["#6D28D9", "#4C1D95", "#312E3B"], laranja: ["#C2410C", "#9A3412", "#3B302A"], eletrico: ["#2563EB", "#1E3A8A", "#263445"], vinho: ["#9D3B4A", "#6F2634", "#332B2C"], pastel: ["#7C6FAF", "#5F557F", "#45404D"] }[event.target.dataset.palette]; if (palette) { updateState((state) => Object.assign(state.theme, { accentColor: palette[0], titleColor: palette[1], subtitleColor: palette[0], textColor: palette[2], mutedColor: "#6b7789", linkColor: palette[0], dividerColor: "#cfdae7", backgroundColor: event.target.dataset.palette === "pastel" ? "#FFFCF7" : "#ffffff" })); renderAll(); autoSave(); toast("Paleta aplicada."); return; } }
  if (action === "apply-palette") { const palettes = { marinho: { accentColor: "#1E3A8A", titleColor: "#172554", textColor: "#263445", backgroundColor: "#ffffff" }, grafite: { accentColor: "#374151", titleColor: "#111827", textColor: "#374151", backgroundColor: "#ffffff" }, preto: { accentColor: "#171717", titleColor: "#000000", textColor: "#262626", backgroundColor: "#ffffff" }, verde: { accentColor: "#047857", titleColor: "#065F46", textColor: "#26352F", backgroundColor: "#ffffff" }, roxo: { accentColor: "#6D28D9", titleColor: "#4C1D95", textColor: "#312E3B", backgroundColor: "#ffffff" }, laranja: { accentColor: "#C2410C", titleColor: "#9A3412", textColor: "#3B302A", backgroundColor: "#ffffff" }, eletrico: { accentColor: "#2563EB", titleColor: "#1E3A8A", textColor: "#263445", backgroundColor: "#ffffff" }, vinho: { accentColor: "#9D3B4A", titleColor: "#6F2634", textColor: "#332B2C", backgroundColor: "#ffffff" }, pastel: { accentColor: "#7C6FAF", titleColor: "#5F557F", textColor: "#45404D", backgroundColor: "#FFFCF7" } }; updateState((state) => Object.assign(state.theme, palettes[event.target.dataset.palette])); renderAll(); autoSave(); toast("Paleta aplicada."); return; }
  if (action === "inline-header-edit") { document.querySelector('[data-inline-key="name"]')?.focus(); return; }
  if (action === "inline-add-item") { const sectionId = event.target.dataset.sectionId; updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.items.push(createItemFor(section)); }); renderAll(); autoSave(); toast("Novo item adicionado."); return; }
  if (action === "edit-inline-value") { const { sectionId, itemId, inlineKey: key } = event.target.dataset; const item = getState().sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (!item) return; document.querySelector("#inline-dialog-section").value = sectionId; document.querySelector("#inline-dialog-item").value = itemId; document.querySelector("#inline-dialog-key").value = key; document.querySelector("#inline-dialog-title").textContent = "Editar link"; document.querySelector("#inline-dialog-label").firstChild.textContent = "URL"; document.querySelector("#inline-dialog-value").value = item[key] || ""; document.querySelector("#inline-dialog").showModal(); return; }
  if (action === "edit-inline-date") { const { sectionId, itemId } = event.target.dataset; const item = getState().sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (!item) return; document.querySelector("#date-dialog-section").value = sectionId; document.querySelector("#date-dialog-item").value = itemId; document.querySelector("#date-dialog-start").value = item.start || ""; document.querySelector("#date-dialog-end").value = item.end || ""; document.querySelector("#date-dialog-current").checked = Boolean(item.current); document.querySelector("#date-dialog").showModal(); return; }
  if (action === "inline-create-section") { const sourceId = event.target.dataset.sectionId; const type = event.target.dataset.sectionType; const titles = { experience: "Experiência profissional", education: "Formação", courses: "Cursos", projects: "Projetos", certifications: "Certificações", languages: "Idiomas", skills: "Habilidades", awards: "Prêmios", volunteering: "Voluntariado", references: "Referências", strengths: "Pontos fortes", custom: "Nova categoria" }; updateState((state) => { const index = state.sections.findIndex((section) => section.id === sourceId); const section = { id: createId("section"), type, title: titles[type], visible: true, column: state.sections[index]?.column || 1, order: 0, settings: {}, items: [], customFields: [] }; section.items.push(createItemFor(section)); state.sections.splice(index + 1, 0, section); normalizeOrder(state); }); renderAll(); autoSave(); toast("Seção adicionada e pronta para editar."); return; }
  if (action === "inline-delete-item") { const { sectionId, itemId } = event.target.dataset; if (!await askDialog({ title: "Excluir item", message: "Somente este item será removido.", confirmLabel: "Excluir", danger: true })) return; updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.items = section.items.filter((item) => item.id !== itemId); }); renderAll(); autoSave(); toast("Item excluído."); return; }
  if (action === "inline-section-settings") { const sectionId = event.target.dataset.sectionId; const section = getState().sections.find((entry) => entry.id === sectionId); if (!section) return; activeTab = "content"; openSectionIds.add(sectionId); sectionOpenStateInitialized = true; renderEditorKeepingSections(); const card = document.querySelector(`[data-section-card="${sectionId}"]`); card?.scrollIntoView({ behavior: "smooth", block: "start" }); toast("Configure os campos visíveis desta seção no painel avançado."); return; }
  if (action === "inline-toggle-section") { const sectionId = event.target.dataset.sectionId; updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.visible = !section.visible; }); renderAll(); autoSave(); toast("Visibilidade da seção atualizada."); return; }
  if (action === "inline-delete-section") { const sectionId = event.target.dataset.sectionId; if (!await askDialog({ title: "Excluir seção", message: "A seção e seus itens serão removidos.", confirmLabel: "Excluir", danger: true })) return; updateState((state) => { state.sections = state.sections.filter((section) => section.id !== sectionId || section.type === "header"); normalizeOrder(state); }); renderAll(); autoSave(); toast("Seção excluída."); return; }
  if (action === "inline-add-section") { const sourceId = event.target.dataset.sectionId; const type = await askDialog({ title: "Adicionar seção", message: "Digite: experiência, formação, curso, projeto, certificação, idioma, habilidade ou personalizada.", value: "experiência", label: "Tipo da seção", confirmLabel: "Adicionar", input: true }); if (!type) return; const types = { "experiência": ["experience", "Experiência profissional"], "formação": ["education", "Formação"], "curso": ["courses", "Cursos"], "projeto": ["projects", "Projetos"], "certificação": ["certifications", "Certificações"], "idioma": ["languages", "Idiomas"], "habilidade": ["skills", "Habilidades"], "personalizada": ["custom", "Nova categoria"] }; const selected = types[type.toLowerCase()]; if (!selected) { toast("Tipo de seção não reconhecido."); return; } updateState((state) => { const index = state.sections.findIndex((section) => section.id === sourceId); state.sections.splice(index + 1, 0, { id: createId("section"), type: selected[0], title: selected[1], visible: true, column: state.sections[index]?.column || 1, order: 0, settings: {}, items: [], customFields: [] }); normalizeOrder(state); }); renderAll(); autoSave(); toast("Seção adicionada."); return; }
  if (action === "toggle-mobile-topbar") { const topbar = event.target.closest(".topbar"); const expanded = !topbar?.classList.contains("is-expanded"); topbar?.classList.toggle("is-expanded", expanded); const button = event.target.closest("[data-action]"); button?.setAttribute("aria-expanded", String(expanded)); return; }
  if (action === "show-editor" || action === "show-preview") { const preview = action === "show-preview"; document.body.classList.toggle("mobile-preview", preview); document.body.classList.toggle("mobile-editor", !preview); document.querySelectorAll(".mobile-view-switch button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.action === action))); return; }
  if (action === "toggle-section") {
    const card = event.target.closest(".section-card"); card.classList.toggle("is-open"); event.target.closest("button").setAttribute("aria-expanded", card.classList.contains("is-open"));
  } else if (action === "save") { persist("Projeto salvo agora"); toast("Projeto salvo no navegador."); }
  else if (action === "reset") { if (!await askDialog({ title: "Restaurar exemplo", message: "As alterações atuais deste currículo serão substituídas.", confirmLabel: "Restaurar", danger: true })) return; clearState(); setState(createDemoState()); renderAll(); persist(); toast("Exemplo inicial restaurado."); }
  else if (action === "preview-pdf") { const dialog = document.querySelector("#pdf-preview-dialog"); const source = document.querySelector("#resume-preview"); const target = document.querySelector("#pdf-preview-content"); if (!dialog || !source || !target) return; target.className = source.className; target.dataset.template = source.dataset.template; target.innerHTML = source.innerHTML; dialog.showModal(); }
  else if (action === "close-pdf-preview") document.querySelector("#pdf-preview-dialog")?.close();
  else if (action === "print") window.print();
  else if (action === "remove-item-logo") { const { sectionId, itemId } = event.target.dataset; updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) delete item.logo; }); renderAll(); autoSave(); }
  else if (action === "new-resume") { const name = await askDialog({ title: "Novo currículo", message: "Informe um nome para identificá-lo.", value: "Novo currículo", label: "Nome do currículo", confirmLabel: "Criar", input: true }); if (!name) return; const next = createDemoState(); next.metadata.name = name; setState(next); persist("Novo currículo criado"); renderAll(); }
  else if (action === "rename-resume") { const name = await askDialog({ title: "Renomear currículo", value: getState().metadata.name, label: "Novo nome", confirmLabel: "Salvar", input: true }); if (!name) return; updateState((state) => { state.metadata.name = name; }); persist("Currículo renomeado"); renderAll(); }
  else if (action === "duplicate-resume") { const copy = structuredClone(getState()); const now = new Date().toISOString(); copy.metadata = { ...copy.metadata, id: createId("resume"), name: `${copy.metadata.name} (cópia)`, createdAt: now, updatedAt: now }; setState(copy); persist("Currículo duplicado"); renderAll(); toast("Cópia criada."); }
  else if (action === "delete-resume") { const resumes = listResumes(); if (resumes.length <= 1) { toast("Mantenha ao menos um currículo."); return; } if (!await askDialog({ title: "Excluir currículo", message: `Excluir “${getState().metadata.name}”? Esta ação não pode ser desfeita.`, confirmLabel: "Excluir", danger: true })) return; const currentId = getState().metadata.id; removeResume(currentId); const next = listResumes()[0]; const state = loadResume(next.id); if (state) { setState(state); renderAll(); toast("Currículo excluído."); } }
  else if (action === "remove-photo") { updateState((state) => { const header = state.sections.find((section) => section.type === "header")?.items[0]; if (header) delete header.photo; }); renderAll(); autoSave(); toast("Foto removida."); }
  else if (action === "add-item-custom-field") {
    const { sectionId, itemId } = event.target.dataset; const label = await askDialog({ title: "Novo campo do item", value: "Novo campo", label: "Nome do campo", confirmLabel: "Continuar", input: true }); if (!label) return; const type = await askDialog({ title: "Tipo do campo", message: "Use: texto, texto longo, data, número, link, e-mail, telefone ou caixa de seleção.", value: "texto", label: "Tipo", confirmLabel: "Criar", input: true }); const types = { "texto": "text", "texto longo": "longtext", "data": "month", "número": "number", "link": "url", "e-mail": "email", "telefone": "tel", "caixa de seleção": "checkbox" }; if (!types[type?.toLowerCase()]) { toast("Tipo não reconhecido."); return; }
    updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); const fieldType = types[type.toLowerCase()]; if (item) { item.customFields ||= []; item.customFields.push({ id: createId("field"), label, type: fieldType, value: fieldType === "checkbox" ? false : "", visible: true }); } });
    renderAll(); autoSave(); toast("Campo do item criado.");
  } else if (action === "delete-item-custom-field") {
    const { sectionId, itemId, itemCustomFieldId } = event.target.dataset;
    updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) item.customFields = (item.customFields || []).filter((field) => field.id !== itemCustomFieldId); });
    renderAll(); autoSave();
  } else if (action === "toggle-item-custom-field") {
    const { sectionId, itemId, itemCustomFieldId } = event.target.dataset;
    updateState((state) => { const field = state.sections.find((section) => section.id === sectionId)?.items.find((item) => item.id === itemId)?.customFields?.find((field) => field.id === itemCustomFieldId); if (field) field.visible = field.visible === false; });
    renderAll(); autoSave();
  } else if (action === "duplicate-item-custom-field") {
    const { sectionId, itemId, itemCustomFieldId } = event.target.dataset;
    updateState((state) => { const fields = state.sections.find((section) => section.id === sectionId)?.items.find((item) => item.id === itemId)?.customFields; const index = fields?.findIndex((field) => field.id === itemCustomFieldId) ?? -1; if (fields && index >= 0) fields.splice(index + 1, 0, { ...structuredClone(fields[index]), id: createId("field"), label: `${fields[index].label} (cópia)` }); });
    renderAll(); autoSave();
  } else if (action === "move-item-custom-field-up" || action === "move-item-custom-field-down") {
    const { sectionId, itemId, itemCustomFieldId } = event.target.dataset;
    updateState((state) => { const fields = state.sections.find((section) => section.id === sectionId)?.items.find((item) => item.id === itemId)?.customFields; const index = fields?.findIndex((field) => field.id === itemCustomFieldId) ?? -1; const next = action === "move-item-custom-field-up" ? index - 1 : index + 1; if (fields && next >= 0 && next < fields.length) [fields[index], fields[next]] = [fields[next], fields[index]]; });
    renderAll(); autoSave();
  } else if (action === "undo") { if (undoState()) { renderAll(); persist("Alteração desfeita"); } else toast("Não há alterações para desfazer."); }
  else if (action === "redo") { if (redoState()) { renderAll(); persist("Alteração refeita"); } else toast("Não há alterações para refazer."); }
  else if (action === "export-json") { downloadJson(); toast("Backup exportado."); }
  else if (action === "import-json") document.querySelector("#import-file").click();
  else if (action === "restore-backup") { const backup = loadBackup(); if (!backup) { toast("Nenhum backup automático disponível."); return; } if (!await askDialog({ title: "Restaurar backup", message: "O currículo atual será substituído pelo backup criado antes da última importação.", confirmLabel: "Restaurar", danger: true })) return; setState(backup); renderAll(); persist("Backup restaurado"); toast("Backup restaurado com sucesso."); }
  else if (action === "add-custom-field") {
    const sectionId = event.target.dataset.sectionId;
    const label = await askDialog({ title: "Novo campo personalizado", value: "Novo campo", label: "Nome do campo", confirmLabel: "Continuar", input: true });
    if (!label) return;
    const type = await askDialog({ title: "Tipo do campo", message: "Use: texto, texto longo, data, número, link, e-mail, telefone, lista, caixa de seleção ou título.", value: "texto", label: "Tipo", confirmLabel: "Criar", input: true });
    const types = { "texto": "text", "texto longo": "longtext", "data": "date", "número": "number", "link": "link", "e-mail": "email", "telefone": "phone", "lista": "list", "caixa de seleção": "checkbox", "título": "title" };
    if (!types[type?.toLowerCase()]) { toast("Tipo não reconhecido. Campo não criado."); return; }
    updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.customFields.push(createCustomField(label, types[type.toLowerCase()])); });
    renderAll(); autoSave(); toast("Campo personalizado criado.");
  } else if (action === "toggle-custom-field") {
    const { sectionId, customFieldId } = event.target.dataset;
    updateState((state) => { const field = state.sections.find((entry) => entry.id === sectionId)?.customFields.find((entry) => entry.id === customFieldId); if (field) field.visible = !field.visible; });
    renderAll(); autoSave();
  } else if (action === "delete-custom-field") {
    const { sectionId, customFieldId } = event.target.dataset;
    updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.customFields = section.customFields.filter((field) => field.id !== customFieldId); });
    renderAll(); autoSave(); toast("Campo personalizado excluído.");
  } else if (action === "move-custom-field-up" || action === "move-custom-field-down") {
    const { sectionId, customFieldId } = event.target.dataset;
    updateState((state) => { const fields = state.sections.find((entry) => entry.id === sectionId)?.customFields; const index = fields?.findIndex((field) => field.id === customFieldId) ?? -1; const next = action === "move-custom-field-up" ? index - 1 : index + 1; if (fields && next >= 0 && next < fields.length) [fields[index], fields[next]] = [fields[next], fields[index]]; });
    renderAll(); autoSave(); toast("Campo movido.");
  } else if (action === "duplicate-custom-field") {
    const { sectionId, customFieldId } = event.target.dataset;
    updateState((state) => { const fields = state.sections.find((entry) => entry.id === sectionId)?.customFields; const index = fields?.findIndex((field) => field.id === customFieldId) ?? -1; if (fields && index >= 0) fields.splice(index + 1, 0, { ...structuredClone(fields[index]), id: createId("field"), label: `${fields[index].label} (cópia)` }); });
    renderAll(); autoSave(); toast("Campo duplicado.");
  } else if (action === "create-section") {
    const title = await askDialog({ title: "Nova categoria", value: "Nova categoria", label: "Nome da categoria", confirmLabel: "Criar", input: true });
    if (!title) return;
    updateState((state) => {
      state.sections.push({ id: createId("section"), type: "custom", title, visible: true, column: 1, order: state.sections.length, settings: {}, items: [], customFields: [] });
    });
    renderAll(); autoSave(); toast("Categoria criada.");
  } else if (action === "rename-section") {
    const sectionId = event.target.dataset.sectionId;
    const section = getState().sections.find((entry) => entry.id === sectionId);
    const title = await askDialog({ title: "Renomear categoria", value: section?.title || "", label: "Nome da categoria", confirmLabel: "Salvar", input: true });
    if (!title) return;
    updateState((state) => { const target = state.sections.find((entry) => entry.id === sectionId); if (target) target.title = title; });
    renderAll(); autoSave(); toast("Categoria renomeada.");
  } else if (action === "toggle-visibility") {
    const sectionId = event.target.dataset.sectionId;
    updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.visible = !section.visible; });
    renderAll(); autoSave(); toast("Visibilidade da categoria atualizada.");
  } else if (action === "duplicate-section") {
    const sectionId = event.target.dataset.sectionId;
    updateState((state) => {
      const index = state.sections.findIndex((entry) => entry.id === sectionId);
      if (index >= 0) state.sections.splice(index + 1, 0, cloneSection(state.sections[index]));
      normalizeOrder(state);
    });
    renderAll(); autoSave(); toast("Categoria duplicada.");
  } else if (action === "delete-section") {
    const sectionId = event.target.dataset.sectionId;
    const section = getState().sections.find((entry) => entry.id === sectionId);
    if (!section || !await askDialog({ title: "Excluir categoria", message: `Excluir “${section.title}”? Os itens dela também serão removidos.`, confirmLabel: "Excluir", danger: true })) return;
    updateState((state) => { state.sections = state.sections.filter((entry) => entry.id !== sectionId); normalizeOrder(state); });
    renderAll(); autoSave(); toast("Categoria excluída.");
  } else if (action === "move-section-up" || action === "move-section-down") {
    const sectionId = event.target.dataset.sectionId;
    updateState((state) => {
      const index = state.sections.findIndex((entry) => entry.id === sectionId);
      const nextIndex = action === "move-section-up" ? index - 1 : index + 1;
      if (index >= 0 && nextIndex >= 0 && nextIndex < state.sections.length) [state.sections[index], state.sections[nextIndex]] = [state.sections[nextIndex], state.sections[index]];
      normalizeOrder(state);
    });
    renderAll(); autoSave();
  } else if (action === "move-section-column") {
    const sectionId = event.target.dataset.sectionId;
    updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.column = section.column === 1 ? 2 : 1; });
    renderAll(); autoSave(); toast("Categoria movida de coluna.");
  } else if (action === "add-item") {
    const sectionId = event.target.closest("[data-section-id]")?.dataset.sectionId || event.target.dataset.sectionId;
    updateState((state) => {
      const section = state.sections.find((entry) => entry.id === sectionId);
      if (section) section.items.push(createItemFor(section));
    });
    renderAll(); autoSave(); toast("Item adicionado.");
  } else if (action === "delete-item") {
    const { sectionId, itemId } = event.target.dataset;
    if (!await askDialog({ title: "Excluir item", message: "Este item será removido do currículo.", confirmLabel: "Excluir", danger: true })) return;
    updateState((state) => {
      const section = state.sections.find((entry) => entry.id === sectionId);
      if (section) section.items = section.items.filter((item) => item.id !== itemId);
    });
    renderAll(); autoSave(); toast("Item excluído.");
  } else if (action === "move-item-up" || action === "move-item-down") {
    const { sectionId, itemId } = event.target.dataset;
    updateState((state) => { const items = state.sections.find((section) => section.id === sectionId)?.items; const index = items?.findIndex((item) => item.id === itemId) ?? -1; const next = action === "move-item-up" ? index - 1 : index + 1; if (items && next >= 0 && next < items.length) [items[index], items[next]] = [items[next], items[index]]; });
    renderAll(); autoSave();
  }
  else if (action === "move-activity-up" || action === "move-activity-down") {
    const { sectionId, itemId, activityId } = event.target.dataset;
    updateState((state) => { const activities = state.sections.find((section) => section.id === sectionId)?.items.find((item) => item.id === itemId)?.activities; const index = activities?.findIndex((activity) => activity.id === activityId) ?? -1; const next = action === "move-activity-up" ? index - 1 : index + 1; if (activities && next >= 0 && next < activities.length) [activities[index], activities[next]] = [activities[next], activities[index]]; });
    renderAll(); autoSave();
  }
  else if (action === "duplicate-activity" || action === "delete-activity") {
    const { sectionId, itemId, activityId } = event.target.dataset;
    updateState((state) => { const activities = state.sections.find((section) => section.id === sectionId)?.items.find((item) => item.id === itemId)?.activities; const index = activities?.findIndex((activity) => activity.id === activityId) ?? -1; if (!activities || index < 0) return; if (action === "delete-activity") activities.splice(index, 1); else activities.splice(index + 1, 0, { ...structuredClone(activities[index]), id: createId("activity") }); });
    renderAll(); autoSave(); toast(action === "delete-activity" ? "Atividade excluída." : "Atividade duplicada.");
  }
  else if (action === "move-technology-up" || action === "move-technology-down" || action === "delete-technology") {
    const { sectionId, itemId, technologyIndex } = event.target.dataset;
    updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (!item) return; const technologies = String(item.technologies || "").split(",").map((value) => value.trim()).filter(Boolean); const index = Number(technologyIndex); if (!technologies[index]) return; if (action === "delete-technology") technologies.splice(index, 1); else { const next = action === "move-technology-up" ? index - 1 : index + 1; if (next >= 0 && next < technologies.length) [technologies[index], technologies[next]] = [technologies[next], technologies[index]]; } item.technologies = technologies.join(", "); });
    renderAll(); autoSave(); toast(action === "delete-technology" ? "Tecnologia excluída." : "Tecnologia reordenada.");
  }
  else if (action === "move-project-image-up" || action === "move-project-image-down" || action === "remove-project-image") {
    const { sectionId, itemId, imageIndex } = event.target.dataset;
    updateState((state) => { const images = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId)?.images; const index = Number(imageIndex); if (!images?.[index]) return; if (action === "remove-project-image") images.splice(index, 1); else { const next = action === "move-project-image-up" ? index - 1 : index + 1; if (next >= 0 && next < images.length) [images[index], images[next]] = [images[next], images[index]]; } });
    renderAll(); autoSave(); toast(action === "remove-project-image" ? "Imagem removida." : "Imagem reordenada.");
  }
  else if (action === "zoom-in") { zoom = Math.min(150, zoom + 10); updateZoom(); }
  else if (action === "zoom-out") { zoom = Math.max(40, zoom - 10); updateZoom(); }
});

document.querySelector("#editor-content").addEventListener("input", (event) => {
  const { path, theme, layout, sectionId, itemId, itemKey, skillsValues, customFieldId, sectionSetting, itemCustomFieldId, headerVisibility, headerPhotoSetting, itemVisibility } = event.target.dataset;
  if (event.target.dataset.birthdayYear) updateState((state) => { const item = state.sections.find((section) => section.type === "header")?.items[0]; if (!item) return; const [, month = "01", day = "01"] = String(item.birthdate || "").split("-"); item.birthdate = event.target.value ? `${event.target.value.replace(/\D/g, "").slice(0, 4)}-${month}-${day}` : ""; });
  else if (event.target.dataset.dateYear) updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (!item) return; const month = String(item[itemKey] || "").split("-")[1] || "01"; item[itemKey] = event.target.value ? `${event.target.value.replace(/\D/g, "").slice(0, 4)}-${month}` : ""; });
  else if (path) {
    const [type, key] = path.split(".");
    updateState((state) => { const section = state.sections.find((entry) => entry.type === type); section.items[0][key] = event.target.value; });
  } else if (theme) updateState((state) => { state.theme[theme] = event.target.type === "range" ? Number(event.target.value) : event.target.type === "checkbox" ? event.target.checked : event.target.value; });
  else if (layout) updateState((state) => { state.layout[layout] = layout === "columns" ? Number(event.target.value) : event.target.value; });
  else if (itemId && itemKey) updateState((state) => {
    const section = state.sections.find((entry) => entry.id === sectionId);
    const item = section?.items.find((entry) => entry.id === itemId);
    if (item) item[itemKey] = event.target.type === "checkbox" ? event.target.checked : itemKey === "activities" ? event.target.value.split("\n").map((text) => text.trim()).filter(Boolean).map((text, index) => ({ id: createId(`activity-${index}`), text })) : event.target.value;
  });
  else if (skillsValues !== undefined) updateState((state) => {
    const section = state.sections.find((entry) => entry.id === sectionId);
    if (section?.items[0]) section.items[0].values = event.target.value.split("\n").map((value) => value.trim()).filter(Boolean);
  });
  else if (customFieldId) updateState((state) => {
    const field = state.sections.find((entry) => entry.id === sectionId)?.customFields.find((entry) => entry.id === customFieldId);
    if (field) field.value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
  });
  else if (sectionSetting) updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (section) section.settings[sectionSetting] = event.target.type === "checkbox" ? event.target.checked : event.target.value; });
  else if (itemCustomFieldId) updateState((state) => { const field = state.sections.find((section) => section.id === sectionId)?.items.find((item) => item.id === itemId)?.customFields?.find((entry) => entry.id === itemCustomFieldId); if (field) field.value = event.target.type === "checkbox" ? event.target.checked : event.target.value; });
  else if (headerVisibility) updateState((state) => { const header = state.sections.find((section) => section.type === "header")?.items[0]; if (header) { header.visibleFields ||= {}; header.visibleFields[headerVisibility] = event.target.checked; } });
  else if (headerPhotoSetting) updateState((state) => { const header = state.sections.find((section) => section.type === "header")?.items[0]; if (header) { header.photoSettings ||= {}; header.photoSettings[headerPhotoSetting] = event.target.type === "range" ? Number(event.target.value) : event.target.value; } });
  else if (itemVisibility) updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) { item.visibleFields ||= {}; item.visibleFields[itemVisibility] = event.target.checked; } });
  else return;
  renderPreview(getState()); updateProgress(); autoSave();
  if (theme === "fontFamily") { const preview = document.querySelector(".font-preview"); if (preview) preview.style.fontFamily = event.target.value; }
  if (event.target.matches("[data-summary-input]")) { const counter = document.querySelector("[data-summary-count]"); if (counter) counter.textContent = `${event.target.value.length} caracteres`; }
  validateInput(event.target);
  if (event.target.type === "range") { const rangeLabel = event.target.closest("label"); const valueNode = rangeLabel?.querySelector("[data-range-value]"); if (valueNode) valueNode.textContent = event.target.value; }
});

document.querySelector("#editor-content").addEventListener("touchmove", (event) => {
  if (event.target.matches('input[type="range"][data-header-photo-setting]')) event.preventDefault();
}, { passive: false });

document.querySelector("#editor-content").addEventListener("dragstart", (event) => { const card = event.target.closest(".section-card"); const dragSource = event.target.closest(".section-card__header, [data-draggable-item], [data-draggable-activity], [data-draggable-technology]"); if (card && !dragSource) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
document.querySelector("#editor-content").addEventListener("pointerdown", (event) => { if (!event.target.matches('input[type="range"][data-header-photo-setting]')) return; event.stopPropagation(); event.target.setPointerCapture?.(event.pointerId); }, true);
document.querySelector("#editor-content").addEventListener("dragstart", (event) => { const activity = event.target.closest("[data-draggable-activity]"), technology = event.target.closest("[data-draggable-technology]"), item = event.target.closest("[data-draggable-item]"), section = event.target.closest(".section-card"); if (activity) event.dataTransfer.setData("application/x-resume-activity", JSON.stringify(activity.dataset)); else if (technology) event.dataTransfer.setData("application/x-resume-technology", JSON.stringify(technology.dataset)); else if (item) event.dataTransfer.setData("application/x-resume-item", JSON.stringify({ sectionId: item.dataset.sectionId, itemId: item.dataset.itemId })); else if (section) event.dataTransfer.setData("application/x-resume-section", section.dataset.sectionCard); });
document.querySelector("#editor-content").addEventListener("dragover", (event) => event.preventDefault());
document.querySelector("#editor-content").addEventListener("drop", (event) => { event.preventDefault(); const targetActivity = event.target.closest("[data-draggable-activity]"), targetTechnology = event.target.closest("[data-draggable-technology]"), targetItem = event.target.closest("[data-draggable-item]"), targetSection = event.target.closest(".section-card"); const activityData = event.dataTransfer.getData("application/x-resume-activity"), technologyData = event.dataTransfer.getData("application/x-resume-technology"), itemData = event.dataTransfer.getData("application/x-resume-item"), sectionData = event.dataTransfer.getData("application/x-resume-section"); if (activityData && targetActivity) { const source = JSON.parse(activityData); if (source.sectionId === targetActivity.dataset.sectionId && source.itemId === targetActivity.dataset.itemId) updateState((state) => { const activities = state.sections.find((section) => section.id === source.sectionId)?.items.find((item) => item.id === source.itemId)?.activities; const from = activities?.findIndex((activity) => activity.id === source.activityId), to = activities?.findIndex((activity) => activity.id === targetActivity.dataset.activityId); if (activities && from >= 0 && to >= 0) { const [moved] = activities.splice(from, 1); activities.splice(to, 0, moved); } }); } else if (technologyData && targetTechnology) { const source = JSON.parse(technologyData); if (source.sectionId === targetTechnology.dataset.sectionId && source.itemId === targetTechnology.dataset.itemId) updateState((state) => { const item = state.sections.find((section) => section.id === source.sectionId)?.items.find((entry) => entry.id === source.itemId); const values = String(item?.technologies || "").split(",").map((value) => value.trim()).filter(Boolean); const from = Number(source.technologyIndex), to = Number(targetTechnology.dataset.technologyIndex); if (item && from >= 0 && to >= 0) { const [moved] = values.splice(from, 1); values.splice(to, 0, moved); item.technologies = values.join(", "); } }); } else if (itemData && targetItem) { const source = JSON.parse(itemData); if (source.sectionId === targetItem.dataset.sectionId) updateState((state) => reorderItems(state, source.sectionId, source.itemId, targetItem.dataset.itemId)); } else if (sectionData && targetSection) updateState((state) => { const from = state.sections.findIndex((section) => section.id === sectionData), to = state.sections.findIndex((section) => section.id === targetSection.dataset.sectionCard); if (from >= 0 && to >= 0 && from !== to) { const [moved] = state.sections.splice(from, 1); state.sections.splice(to, 0, moved); normalizeOrder(state); } }); else return; renderAll(); autoSave(); toast("Ordem atualizada."); });
document.querySelector("#resume-preview").addEventListener("dragstart", (event) => { const section = event.target.closest("[data-preview-section]"); if (!section) return; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-resume-preview-section", section.dataset.previewSection); });
document.querySelector("#resume-preview").addEventListener("dragover", (event) => { if (event.dataTransfer.types.includes("application/x-resume-preview-section")) event.preventDefault(); });
document.querySelector("#resume-preview").addEventListener("drop", (event) => { const sourceId = event.dataTransfer.getData("application/x-resume-preview-section"); if (!sourceId) return; event.preventDefault(); const target = event.target.closest("[data-preview-section]"); const column = event.target.closest(".resume-column"); updateState((state) => { const source = state.sections.find((section) => section.id === sourceId); if (!source) return; if (column) source.column = [...column.parentElement.children].indexOf(column) + 1; if (target && target.dataset.previewSection !== sourceId) { const from = state.sections.findIndex((section) => section.id === sourceId), to = state.sections.findIndex((section) => section.id === target.dataset.previewSection); if (from >= 0 && to >= 0) { const [moved] = state.sections.splice(from, 1); state.sections.splice(to, 0, moved); } } normalizeOrder(state); }); renderAll(); autoSave(); toast("Categoria movida na prévia."); });
document.querySelector("#editor-content").addEventListener("change", (event) => { if (!event.target.matches("[data-photo-input]")) return; const file = event.target.files?.[0]; if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { toast("Selecione uma imagem de até 5 MB."); return; } const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 500 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); const photo = canvas.toDataURL("image/jpeg", .86); updateState((state) => { const header = state.sections.find((section) => section.type === "header")?.items[0]; if (header) header.photo = photo; }); renderPreview(getState()); autoSave(); toast("Foto atualizada."); }; image.src = reader.result; }; reader.readAsDataURL(file); });
document.querySelector("#editor-content").addEventListener("change", (event) => { if (!event.target.matches("[data-item-image-input]")) return; const file = event.target.files?.[0], { sectionId, itemId } = event.target.dataset; if (!file || !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { toast("Selecione uma imagem de até 2 MB."); return; } const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 160 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) item.logo = canvas.toDataURL("image/jpeg", .84); }); renderPreview(getState()); autoSave(); toast("Logotipo atualizado."); }; image.src = reader.result; }; reader.readAsDataURL(file); });
document.querySelector("#editor-content").addEventListener("change", (event) => { if (!event.target.matches("[data-project-images]")) return; const { sectionId, itemId } = event.target.dataset; const files = Array.from(event.target.files || []).slice(0, 3); if (!files.length || files.some((file) => !file.type.startsWith("image/") || file.size > 2 * 1024 * 1024)) { toast("Use até 3 imagens válidas de no máximo 2 MB."); return; } Promise.all(files.map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 320 / Math.max(image.width, image.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", .82)); }; image.src = reader.result; }; reader.readAsDataURL(file); }))).then((images) => { updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) item.images = images; }); renderAll(); autoSave(); toast("Imagens do projeto atualizadas."); }); });
document.querySelector("#import-file").addEventListener("change", (event) => { const file = event.target.files?.[0]; if (!file || !/\.json$/i.test(file.name)) { toast("Selecione um arquivo JSON válido."); return; } const reader = new FileReader(); reader.onload = async () => { try { const data = JSON.parse(reader.result); const errors = importErrors(data); if (errors.length) { toast(`Importação recusada: ${errors[0]}`); return; } if (!await askDialog({ title: "Importar currículo", message: "Um backup automático será criado antes de substituir o currículo atual.", confirmLabel: "Importar" })) return; backupState(getState()); const normalized = migrateResumeData(structuredClone(data)); if (!normalized) throw new Error("Migração inválida"); setState(normalized); renderAll(); persist("Projeto importado"); toast("Projeto importado com sucesso."); } catch { toast("Não foi possível ler o JSON. O currículo atual foi preservado."); } }; reader.readAsText(file); event.target.value = ""; });

document.querySelector("#resume-selector").addEventListener("change", (event) => { const resume = loadResume(event.target.value); if (resume) { setState(resume); renderAll(); toast("Currículo alternado."); } });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { document.querySelectorAll(".font-picker__menu").forEach((menu) => { menu.hidden = true; menu.previousElementSibling?.setAttribute("aria-expanded", "false"); }); }
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.target.matches("input, textarea, select")) return;
  if (event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) { if (redoState()) { renderAll(); persist("Alteração refeita"); } } else if (undoState()) { renderAll(); persist("Alteração desfeita"); } }
  if (event.key.toLowerCase() === "y") { event.preventDefault(); if (redoState()) { renderAll(); persist("Alteração refeita"); } }
});

renderAll();

document.querySelector("#resume-preview").addEventListener("blur", (event) => { const target = event.target.closest("[data-inline-key]"); if (!target) return; const { inlineKey: key, inlineSectionId: sectionId, inlineItemId: itemId } = target.dataset; const value = target.textContent.trim(); if (!sectionId) return; updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (!section) return; if (key === "sectionTitle") { section.title = value || section.title; return; } const item = section.items.find((entry) => entry.id === itemId); if (!item) return; if (key === "details") return; item[key] = value; }); renderAll(); autoSave(); }, true);
document.querySelector("#resume-preview").addEventListener("keydown", (event) => { const target = event.target.closest("[data-inline-key]"); if (!target || event.key !== "Enter" || event.shiftKey) return; event.preventDefault(); if (target.dataset.inlineKey === "description") { document.execCommand("insertText", false, "\n• "); return; } target.blur(); });
document.querySelector("#date-dialog").addEventListener("close", () => { const dialog = document.querySelector("#date-dialog"); if (dialog.returnValue !== "confirm") return; const sectionId = document.querySelector("#date-dialog-section").value, itemId = document.querySelector("#date-dialog-item").value; const start = document.querySelector("#date-dialog-start").value.trim(), end = document.querySelector("#date-dialog-end").value.trim(), current = document.querySelector("#date-dialog-current").checked; const period = /^\d{4}-(0[1-9]|1[0-2])$/; if ((start && !period.test(start)) || (end && !period.test(end))) { toast("Use o formato AAAA-MM, por exemplo 2026-01."); return; } if (start && end && end < start) { toast("O término não pode ser anterior ao início."); return; } updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (!item) return; item.start = start; item.end = end; item.current = current; item.period = ""; }); renderAll(); autoSave(); toast("Período atualizado."); });
document.querySelector("#date-dialog").addEventListener("toggle", (event) => { const dialog = event.currentTarget; if (!dialog.open) return; const row = dialog.querySelector(".field-row"); const start = document.querySelector("#date-dialog-start")?.value || "", end = document.querySelector("#date-dialog-end")?.value || ""; if (row) row.innerHTML = `${dateDialogPicker("start", start)}${dateDialogPicker("end", end)}`; });
document.querySelector("#date-dialog").addEventListener("input", (event) => { const key = event.target.dataset.dialogYear; if (!key) return; const hidden = document.querySelector(`#date-dialog-${key}`); const month = hidden?.value.split("-")[1] || "01"; if (hidden) hidden.value = event.target.value ? `${event.target.value.replace(/\D/g, "").slice(0, 4)}-${month}` : ""; });
document.querySelector("#inline-dialog").addEventListener("close", () => { const dialog = document.querySelector("#inline-dialog"); if (dialog.returnValue !== "confirm") return; const sectionId = document.querySelector("#inline-dialog-section").value, itemId = document.querySelector("#inline-dialog-item").value, key = document.querySelector("#inline-dialog-key").value, value = document.querySelector("#inline-dialog-value").value.trim(); updateState((state) => { const item = state.sections.find((section) => section.id === sectionId)?.items.find((entry) => entry.id === itemId); if (item) item[key] = value; }); renderAll(); autoSave(); });
document.querySelector("#resume-preview").addEventListener("change", (event) => { const input = event.target.closest("[data-inline-section-setting], [data-inline-field-visibility], [data-inline-header-visibility]"); if (!input) return; if (input.dataset.inlineHeaderVisibility) { updateState((state) => { const header = state.sections.find((section) => section.type === "header")?.items[0]; if (header) { header.visibleFields ||= {}; header.visibleFields[input.dataset.inlineHeaderVisibility] = input.checked; } }); renderAll(); autoSave(); return; } const sectionId = input.dataset.sectionId; updateState((state) => { const section = state.sections.find((entry) => entry.id === sectionId); if (!section) return; if (input.dataset.inlineFieldVisibility) { section.settings.visibleFields ||= {}; section.settings.visibleFields[input.dataset.inlineFieldVisibility] = input.checked; if (section.type === "courses") section.items.forEach((item) => { item.visibleFields ||= {}; item.visibleFields[input.dataset.inlineFieldVisibility] = input.checked; }); } else section.settings[input.dataset.inlineSectionSetting] = input.checked; }); renderAll(); autoSave(); });
