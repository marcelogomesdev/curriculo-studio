import { createId } from "./utils.js";

const section = (type, title, column, order, items = [], settings = {}) => ({
  id: createId("section"), type, title, visible: true, column, order, settings, items, customFields: []
});

export function createDemoState() {
  const now = new Date().toISOString();
  return {
    version: 1,
    metadata: { id: createId("resume"), name: "Currículo de Marina Costa", createdAt: now, updatedAt: now },
    layout: { columns: 1, columnRatio: "35-65" },
    theme: {
      fontFamily: "Arial, sans-serif", fontSize: 14, lineHeight: 1.5,
      textColor: "#253044", titleColor: "#183b68", accentColor: "#2f6db1",
      subtitleColor: "#2f6db1", mutedColor: "#6b7789", linkColor: "#2f6db1", dividerColor: "#cfdae7",
      backgroundColor: "#ffffff", pagePadding: 18, sectionGap: 18, itemGap: 12,
      borderRadius: 0, showDividers: true, titleSize: 12, titleWeight: 700, titleTransform: "uppercase"
    },
    sections: [
      section("header", "Cabeçalho", 1, 0, [{ id: createId("item"), name: "Marina Costa", role: "Product Designer", email: "marina.costa@exemplo.com", phone: "+55 11 99999-0000", city: "São Paulo, SP", linkedin: "linkedin.com/in/marinacosta" }]),
      section("summary", "Resumo profissional", 1, 1, [{ id: createId("item"), text: "Product Designer com experiência em transformar problemas complexos em produtos digitais simples, acessíveis e orientados por dados. Atuação próxima a times de produto e engenharia, da descoberta à entrega." }]),
      section("experience", "Experiência profissional", 1, 2, [
        { id: createId("item"), title: "Product Designer Sênior", organization: "Aurora Tecnologia", period: "mar 2022 — atual", description: "Liderança de discovery, prototipação e evolução do design system de uma plataforma B2B usada por mais de 40 mil pessoas." },
        { id: createId("item"), title: "UX Designer", organization: "Estúdio Norte", period: "jan 2020 — fev 2022", description: "Pesquisa com usuários, desenho de jornadas e criação de interfaces para produtos financeiros e educacionais." }
      ]),
      section("education", "Formação", 1, 3, [{ id: createId("item"), title: "Bacharelado em Design", organization: "Universidade Metropolitana", period: "2016 — 2019", description: "Ênfase em design digital e interação humano-computador." }]),
      section("courses", "Cursos", 1, 4),
      section("certifications", "Certificações", 1, 5),
      section("projects", "Projetos", 1, 6),
      section("languages", "Idiomas", 1, 7, [{ id: createId("item"), title: "Inglês", description: "Avançado" }, { id: createId("item"), title: "Espanhol", description: "Intermediário" }]),
      section("skills", "Habilidades", 1, 8, [
        { id: createId("item"), title: "Product discovery", level: 4, category: "Produto", description: "" },
        { id: createId("item"), title: "Figma", level: 5, category: "Design", description: "" },
        { id: createId("item"), title: "Design systems", level: 4, category: "Design", description: "" }
      ])
    ]
  };
}

let resumeState = createDemoState();
let past = [], future = [], lastHistoryAt = 0;
export const getState = () => resumeState;
export function setState(nextState) { resumeState = nextState; past = []; future = []; lastHistoryAt = 0; }
export function updateState(mutator) {
  const now = Date.now();
  if (now - lastHistoryAt > 700) { past.push(structuredClone(resumeState)); if (past.length > 30) past.shift(); }
  lastHistoryAt = now;
  future = [];
  mutator(resumeState);
  resumeState.metadata.updatedAt = new Date().toISOString();
}
export function undoState() { if (!past.length) return false; future.push(structuredClone(resumeState)); resumeState = past.pop(); lastHistoryAt = 0; return true; }
export function redoState() { if (!future.length) return false; past.push(structuredClone(resumeState)); resumeState = future.pop(); lastHistoryAt = 0; return true; }
