import { escapeHtml, getInitials, normalizeUrl } from "./utils.js";

function inlineText(value, { sectionId, itemId = "", key, tag = "span", className = "" } = {}) {
  if (tag === "a") return `<a class="${className}" href="${escapeHtml(normalizeUrl(value))}" target="_blank" rel="noopener noreferrer">${escapeHtml(value || "")}</a>`;
  const attrs = `contenteditable="true" spellcheck="true" data-inline-key="${key}" data-inline-section-id="${sectionId}" data-inline-item-id="${itemId}" aria-label="Editar ${key}"`;
  return `<${tag} class="inline-edit ${className}" ${attrs}>${escapeHtml(value || "")}</${tag}>`;
}
function formatPeriod(value) { const match = String(value || "").match(/^(\d{4})-(\d{2})$/); if (!match) return value || ""; return `${["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][Number(match[2]) - 1]} ${match[1]}`; }
function contactValue(key, value, hint, sectionId, itemId) {
  const social = { linkedin: "in", github: "GH", whatsapp: "WA" };
  if (!value) return inlineText(hint, { sectionId, itemId, key });
  if (!social[key]) return inlineText(value, { sectionId, itemId, key });
  const href = key === "whatsapp" ? `https://wa.me/${String(value).replace(/\D/g, "")}` : normalizeUrl(value);
  return `<a class="contact-social contact-social--${key}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${key}"><span aria-hidden="true">${social[key]}</span>${escapeHtml(value)}</a>`;
}

function renderStandardItem(item, section) {
  const sectionId = section.id;
  const show = (key) => item.visibleFields?.[key] !== false && section.settings?.visibleFields?.[key] !== false;
  const hints = { experience: { title: "Seu cargo", organization: "Onde você trabalhou", city: "Cidade, Estado, País", description: "Conte o que você fazia e os resultados que alcançou.", technologies: "Tecnologias utilizadas" }, education: { title: "Nome do curso", organization: "Instituição de ensino", city: "Cidade, Estado, País", description: "Inclua informações relevantes sobre sua formação." }, courses: { title: "Nome do curso", organization: "Plataforma ou instituição", description: "Descreva o que você aprendeu." }, certifications: { title: "Nome da certificação", organization: "Organização emissora", description: "Inclua detalhes da credencial." }, projects: { title: "Nome do projeto", organization: "Cliente ou organização", city: "Local do projeto", description: "Explique o problema, sua participação e o resultado.", technologies: "Tecnologias utilizadas" }, languages: { title: "Idioma", description: "Nível e observações" }, skills: { title: "Habilidade", description: "Contexto ou especialidade" }, interests: { title: "Interesse", description: "Conte um interesse relevante." }, achievements: { title: "Conquista", description: "Descreva o resultado alcançado." }, awards: { title: "Prêmio", organization: "Instituição responsável", description: "Explique o reconhecimento." }, volunteering: { title: "Atuação voluntária", organization: "Organização", description: "Descreva sua contribuição." }, references: { title: "Nome da referência", organization: "Cargo e empresa", description: "Contato ou relação profissional." }, strengths: { title: "Ponto forte", description: "Explique como você aplica essa qualidade." }, quote: { title: "Citação", description: "Uma frase que represente seu trabalho." }, timeline: { title: "Marco importante", description: "Conte um momento da sua trajetória." }, custom: { title: "Título", organization: "Subtítulo", description: "Adicione uma descrição." } }[section.type] || {};
  const period = item.period || [formatPeriod(item.start || item.issued), item.current ? (item.degree ? "Em andamento" : "Atual") : formatPeriod(item.end || (item.noExpiry ? "" : item.expires))].filter(Boolean).join(" — ") || item.date || "";
  const location = `${[item.city, item.state, item.country].filter(Boolean).join(", ")}${item.remote ? ([item.city, item.state, item.country].filter(Boolean).length ? " — Remoto" : "Remoto") : ""}`;
  const technologies = (item.technologies || "").split(",").map((value) => value.trim()).filter(Boolean);
  const activities = Array.isArray(item.activities) ? item.activities.map((activity) => activity.text || activity).filter(Boolean) : (item.activities || "").split("\n").map((value) => value.trim()).filter(Boolean);
  const detailParts = [["degree", item.degree], ["level", section.type === "languages" ? item.customLevel : (item.customLevel || item.level)], ["city", location], ["hours", item.hours], ["certificate", item.certificate], ["credential", item.credential], ["team", item.team], ["client", item.client]].filter(([, value]) => value);
  const languageStars = section.type === "languages" ? `<button type="button" class="language-stars" data-action="cycle-language-level" data-section-id="${sectionId}" data-item-id="${item.id}" aria-label="Alterar nível do idioma" title="Clique para alterar o nível">${Number(item.level) ? `${"★".repeat(Math.min(5, Number(item.level)))}${"☆".repeat(Math.max(0, 5 - Number(item.level)))}` : "Definir estrelas"}</button>` : "";
  const custom = (item.customFields || []).filter((field) => field.visible !== false && field.value).map((field) => `<p class="resume-custom-field"><strong>${escapeHtml(field.label)}:</strong> ${escapeHtml(field.value)}</p>`).join("");
  return `<article class="resume-item"><div class="item-inline-tools"><button type="button" data-action="inline-delete-item" data-section-id="${sectionId}" data-item-id="${item.id}" aria-label="Excluir este item">Excluir Item</button></div>
    <div class="resume-item__top">${item.logo && show("logo") ? `<img class="resume-item-logo" src="${escapeHtml(item.logo)}" alt="Logotipo">` : ""}${inlineText(item.title || hints.title || "Novo item", { sectionId, itemId: item.id, key: "title", tag: "h3" })}${show("start") ? `<button type="button" class="inline-date resume-meta" data-action="edit-inline-date" data-section-id="${sectionId}" data-item-id="${item.id}" aria-label="Editar período">${escapeHtml(period || "Selecione o período")}</button>` : ""}</div>
    ${show("organization") ? inlineText(item.organization || hints.organization || "Organização", { sectionId, itemId: item.id, key: "organization", tag: "p", className: "resume-subtitle" }) : ""}
    ${show("city") ? `<p class="resume-description">${detailParts.length ? detailParts.map(([key, value]) => inlineText(value, { sectionId, itemId: item.id, key, className: "inline-detail" })).join(" · ") : inlineText(hints.city || "Cidade, Estado, País", { sectionId, itemId: item.id, key: "city", className: "inline-detail" })}${languageStars}</p>` : ""}${show("description") ? inlineText(item.description || hints.description || "Adicione uma descrição.", { sectionId, itemId: item.id, key: "description", tag: "p", className: "resume-description" }) : ""}${[["projectLink",item.projectLink,"Projeto"],["link",item.link,"Link"],["credentialLink",item.credentialLink,"Credencial"],["github",item.github,"GitHub"],["site",item.site,"Site"]].filter(([,link]) => link).map(([key,link,label]) => inlineText(link, { sectionId, itemId: item.id, key, tag: "a", className: "resume-link" })).join(" ")}${show("technologies") ? `<p class="technology-list" contenteditable="true" data-inline-key="technologies" data-inline-section-id="${sectionId}" data-inline-item-id="${item.id}" aria-label="Editar tecnologias">${escapeHtml(technologies.join(" · ") || hints.technologies || "Tecnologias")}</p>` : ""}${activities.length && show("activities") ? `<ul class="resume-list">${activities.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>` : ""}${(item.images || []).length ? `<div class="project-images">${item.images.map((image) => `<img src="${escapeHtml(image)}" alt="Imagem do projeto">`).join("")}</div>` : ""}${custom}
  </article>`;
}

function renderSection(section) {
  if (!section.visible || section.type === "header") return "";
  let body = "";
  if (section.type === "summary") body = inlineText(section.items[0]?.text || "", { sectionId: section.id, itemId: section.items[0]?.id, key: "text", tag: "p", className: "resume-summary" });
  else if (section.type === "skills") {
    const skills = section.items.filter((item) => item.title);
    const display = section.settings.display || "tags";
    const level = (item) => Math.max(0, Math.min(5, Number(item.level) || 0));
    if (display === "list") body = `<ul class="resume-list">${skills.map((item) => `<li>${escapeHtml(item.title)}${item.level ? ` — nível ${level(item)} de 5` : ""}</li>`).join("")}</ul>`;
    else if (display === "bars" || display === "dots") body = `<div class="skill-level-list">${skills.map((item) => `<div class="skill-level"><span>${escapeHtml(item.title)}</span>${level(item) ? `<span class="skill-meter skill-meter--${display}" aria-label="${level(item)} de 5"><i style="--level:${level(item)}"></i></span>` : ""}</div>`).join("")}</div>`;
    else if (display === "stars") body = `<div class="skill-level-list">${skills.map((item) => `<div class="skill-level"><span>${escapeHtml(item.title)}</span>${level(item) ? `<span aria-label="${level(item)} de 5">${"★".repeat(level(item))}${"☆".repeat(5 - level(item))}</span>` : ""}</div>`).join("")}</div>`;
    else body = `<div class="skill-list">${skills.map((item) => `<span class="skill-tag">${escapeHtml(item.title)}</span>`).join("")}</div>`;
  }
  else body = section.items.length ? section.items.map((item) => renderStandardItem(item, section)).join("") : `<p class="empty-section">Adicione conteúdo a esta seção.</p>`;
  const customFields = (section.customFields || []).filter((field) => field.visible && (field.value || field.type === "checkbox")).map((field) => field.type === "title" ? `<h3 class="resume-custom-title">${escapeHtml(field.value || field.label)}</h3>` : `<p class="resume-custom-field"><strong>${escapeHtml(field.label)}:</strong> ${field.type === "checkbox" ? (field.value ? "Sim" : "Não") : escapeHtml(field.value)}</p>`).join("");
  const sectionStyle = "";
  const titleStyle = "";
  const addMenu = [["experience","Experiência"],["education","Formação"],["courses","Curso"],["projects","Projeto"],["certifications","Certificação"],["languages","Idioma"],["skills","Habilidade"],["interests","Interesses"],["achievements","Conquistas"],["awards","Prêmios"],["volunteering","Voluntariado"],["references","Referências"],["strengths","Pontos fortes"],["quote","Citação"],["timeline","Meu tempo"],["custom","Categoria personalizada"]].map(([type,label]) => `<button type="button" data-action="inline-create-section" data-section-id="${section.id}" data-section-type="${type}">${label}</button>`).join("");
  const fieldLabels = { experience: [["title","Cargo"],["organization","Empresa"],["city","Local"],["start","Data"],["remote","Remoto"],["technologies","Tecnologias"],["description","Descrição"],["projectLink","Links"],["logo","Logo"]], education: [["title","Curso"],["degree","Grau"],["organization","Instituição"],["city","Local"],["start","Data"],["description","Descrição"]], projects: [["title","Projeto"],["technologies","Tecnologias"],["description","Descrição"],["projectLink","Links"]] }[section.type] || [["title","Título"],["description","Descrição"]];
  const settingsCard = `<details class="section-settings-menu"><summary aria-label="Escolher campos exibidos">⚙ Campos</summary><div><strong>Exibir</strong>${fieldLabels.map(([key,label]) => `<label><input type="checkbox" data-inline-field-visibility="${key}" data-section-id="${section.id}" ${section.settings.visibleFields?.[key] !== false ? "checked" : ""}> ${label}</label>`).join("")}<label><input type="checkbox" data-inline-section-setting="showTitle" data-section-id="${section.id}" ${section.settings.showTitle !== false ? "checked" : ""}> Título da seção</label></div></details>`;
  const compact = ["languages", "skills", "courses", "certifications"].includes(section.type) && section.items.length >= 4 ? " resume-section--compact" : "";
  return `<section class="resume-section${compact}" draggable="true" data-preview-section="${section.id}" style="${sectionStyle}"><div class="section-inline-tools" aria-label="Ações da seção"><button type="button" class="section-drag-handle section-action-label" aria-label="Segure e arraste para mover a seção" title="Segure e arraste para mover">↕ Mover</button><button type="button" class="section-action-label" data-action="inline-add-item" data-section-id="${section.id}" aria-label="Adicionar mais um item nesta seção" title="Adicionar mais um item nesta seção">+ Item</button><details class="section-add-menu"><summary aria-label="Adicionar uma nova seção abaixo" title="Adicionar nova seção">+ Seção</summary><div>${addMenu}</div></details>${settingsCard}<button type="button" class="section-action-label section-action-label--danger" data-action="inline-delete-section" data-section-id="${section.id}" aria-label="Excluir seção">Excluir Seção</button></div>${section.settings.showTitle === false ? "" : inlineText(section.title, { sectionId: section.id, key: "sectionTitle", tag: "h2" })}${body}${customFields}</section>`;
}

export function applyTheme(state) {
  const root = document.documentElement.style;
  const { theme } = state;
  root.setProperty("--resume-font-family", theme.fontFamily);
  root.setProperty("--resume-font-size", `${theme.fontSize}px`);
  root.setProperty("--resume-line-height", theme.lineHeight);
  root.setProperty("--resume-text-color", theme.textColor);
  root.setProperty("--resume-title-color", theme.titleColor);
  root.setProperty("--resume-accent-color", theme.accentColor);
  root.setProperty("--resume-subtitle-color", theme.subtitleColor || theme.accentColor);
  root.setProperty("--resume-muted-color", theme.mutedColor || "#6b7789");
  root.setProperty("--resume-link-color", theme.linkColor || theme.accentColor);
  root.setProperty("--resume-background", theme.backgroundColor);
  root.setProperty("--resume-page-padding", `${theme.pagePadding}mm`);
  root.setProperty("--resume-section-gap", `${theme.sectionGap}px`);
  root.setProperty("--resume-item-gap", `${theme.itemGap}px`);
  root.setProperty("--resume-title-size", `${theme.titleSize || 12}px`);
  root.setProperty("--resume-radius", `${theme.borderRadius || 0}px`);
  root.setProperty("--resume-divider", theme.showDividers === false ? "transparent" : (theme.dividerColor || "#cfdae7"));
  root.setProperty("--resume-title-weight", theme.titleWeight || 700);
  root.setProperty("--resume-title-transform", theme.titleTransform || "uppercase");
  root.setProperty("--resume-accent-soft", theme.colorIntensity === "solid" ? theme.accentColor : `color-mix(in srgb, ${theme.accentColor} 12%, white)`);
  root.setProperty("--resume-header-bg", theme.contrastMode === "darkHeader" ? theme.titleColor : "transparent");
  root.setProperty("--resume-sidebar-color", theme.sidebarColor || "#173a5a");
}

export function renderPreview(state) {
  applyTheme(state);
  const target = document.querySelector("#resume-preview");
  target.dataset.template = state.theme.template || "";
  const header = state.sections.find((entry) => entry.type === "header")?.items[0] || {};
  const visible = header.visibleFields || {}; const show = (key) => visible[key] !== false;
  const headerFields = (state.sections.find((entry) => entry.type === "header")?.customFields || []).filter((field) => field.visible && field.value).map((field) => `<span>${escapeHtml(field.label)}: ${escapeHtml(field.value)}</span>`).join("");
  const sections = state.sections.filter((entry) => entry.type !== "header").sort((a,b) => a.order - b.order);
  const columnOne = sections.filter((entry) => entry.column === 1).map(renderSection).join("");
  const columnTwo = sections.filter((entry) => entry.column === 2).map(renderSection).join("");
  const photoSettings = { shape: "round", size: 84, borderWidth: 0, borderColor: "#2f6db1", position: "right", ...(header.photoSettings || {}) };
  const photoStyle = `width:${photoSettings.size}px;height:${photoSettings.size}px;border:${photoSettings.borderWidth}px solid ${photoSettings.borderColor};border-radius:${photoSettings.shape === "round" ? "50%" : "0"};`;
  const photo = header.photo ? `<img class="resume-avatar resume-avatar--photo" style="${photoStyle}" src="${escapeHtml(header.photo)}" alt="Foto de ${escapeHtml(header.name || "perfil")}">` : `<div class="resume-avatar" style="${photoStyle}" aria-label="Iniciais de ${escapeHtml(header.name || "seu nome")}">${getInitials(header.name)}</div>`;
  const headerSection = state.sections.find((entry) => entry.type === "header");
  const headerLabels = { name: "Nome", role: "Cargo", email: "E-mail", phone: "Telefone", whatsapp: "WhatsApp", city: "Cidade", state: "Estado", country: "País", nationality: "Nacionalidade", birthdate: "Data de nascimento", linkedin: "LinkedIn", github: "GitHub", portfolio: "Portfólio", site: "Site", customLink: "Link personalizado", photo: "Foto" };
  const headerControls = `<div class="section-inline-tools header-inline-tools" aria-label="Ações do cabeçalho"><details class="section-settings-menu section-settings-menu--header"><summary aria-label="Escolher campos do cabeçalho">⚙</summary><div><strong>Exibir no cabeçalho</strong>${Object.entries(headerLabels).map(([key,label]) => `<label>${label}<input type="checkbox" data-inline-header-visibility="${key}" ${visible[key] !== false ? "checked" : ""}></label>`).join("")}</div></details><button type="button" data-action="inline-header-edit" aria-label="Editar cabeçalho">✎</button></div>`;
  const headerMarkup = `<header class="resume-header resume-header--photo-${photoSettings.position}">${headerControls}
    <div>${show("name") ? inlineText(header.name || "Seu nome", { sectionId: headerSection?.id, itemId: header.id, key: "name", tag: "h1" }) : ""}${show("role") ? inlineText(header.role || "Cargo pretendido", { sectionId: headerSection?.id, itemId: header.id, key: "role", tag: "p", className: "resume-role" }) : ""}
    <div class="contact-list">${[["email",header.email,"Seu e-mail"],["phone",header.phone,"Seu telefone"],["whatsapp",header.whatsapp,"Seu WhatsApp"],["city",header.city,"Sua cidade"],["state",header.state,"Seu estado"],["country",header.country,"Seu país"],["nationality",header.nationality,"Sua nacionalidade"],["linkedin",header.linkedin,"Seu LinkedIn"],["github",header.github,"Seu GitHub"],["portfolio",header.portfolio,"Seu portfólio"],["site",header.site,"Seu site"],["customLink",header.customLink,"Link personalizado"],["birthdate",header.birthdate,"Data de nascimento"]].filter(([key]) => show(key)).map(([key,value,hint]) => contactValue(key, value, hint, headerSection?.id, header.id)).join("")}${headerFields}</div></div>
    ${show("photo") ? photo : ""}
  </header>`;
  const columnsMarkup = `<div class="resume-columns" data-columns="${state.layout.columns}" style="--column-ratio:${(state.layout.columnRatio || "35-65").replace("-", "fr ")}fr">
    <div class="resume-column">${columnOne}</div>${state.layout.columns === 2 ? `<div class="resume-column">${columnTwo}</div>` : ""}
  </div>`;
  target.innerHTML = state.theme.template === "sidebar"
    ? `<div class="sidebar-template"><aside class="sidebar-template__panel">${columnOne}</aside><main class="sidebar-template__content">${headerMarkup}${columnTwo}</main></div>`
    : state.theme.template === "sidebar-right"
      ? `<div class="sidebar-template sidebar-template--right"><main class="sidebar-template__content">${headerMarkup}${columnOne}</main><aside class="sidebar-template__panel">${columnTwo}</aside></div>`
    : `${headerMarkup}${columnsMarkup}`;
  const guidance = new Set(["Seu nome", "Cargo pretendido", "Seu e-mail", "Seu telefone", "Seu WhatsApp", "Sua cidade", "Seu estado", "Seu país", "Sua nacionalidade", "Seu LinkedIn", "Seu GitHub", "Seu portfólio", "Seu site", "Link personalizado", "Seu cargo", "Onde você trabalhou", "Cidade, Estado, País", "Conte o que você fazia e os resultados que alcançou.", "Nome do curso", "Instituição de ensino", "Inclua informações relevantes sobre sua formação.", "Plataforma ou instituição", "Descreva o que você aprendeu.", "Nome da certificação", "Organização emissora", "Inclua detalhes da credencial.", "Nome do projeto", "Cliente ou organização", "Local do projeto", "Explique o problema, sua participação e o resultado.", "Idioma", "Nível e observações", "Habilidade", "Contexto ou especialidade", "Tecnologias", "Selecione o período", "Novo item", "Nova habilidade", "Novo idioma", "Novo cargo", "Nova formação", "Novo curso", "Nova certificação", "Novo projeto"]);
  target.querySelectorAll(".inline-edit, .technology-list, .inline-date").forEach((node) => { if (guidance.has(node.textContent.trim())) node.classList.add("resume-placeholder"); });
  target.querySelectorAll("[data-preview-section]").forEach((section) => { section.draggable = false; const handle = section.querySelector(".section-drag-handle"); if (handle) handle.draggable = true; });
}
