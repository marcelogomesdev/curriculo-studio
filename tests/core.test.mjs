import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};

const { createDemoState, getState, setState, undoState, updateState } = await import("../js/state.js");
const { listResumes, loadBackup, loadResume, migrateResumeData, saveState, backupState } = await import("../js/storage.js");

const demo = createDemoState();
assert.equal(demo.version, 1);
assert.equal(demo.sections.length, 9);
assert.ok(demo.sections.some((section) => section.type === "header"));

const legacy = { version: 1, metadata: { id: "legacy", name: "Legado" }, layout: {}, theme: {}, sections: [{ id: "experience", type: "experience", items: [{ id: "item", activities: "Uma\nDuas" }], customFields: [] }, { id: "skills", type: "skills", items: [{ id: "old", values: ["Figma", "HTML"] }], customFields: [] }] };
const migrated = migrateResumeData(legacy);
assert.equal(migrated.layout.columnRatio, "35-65");
assert.equal(migrated.sections[0].items[0].description, "Uma\nDuas");
assert.equal(migrated.sections[0].items[0].descriptionBullets, true);
assert.equal("activities" in migrated.sections[0].items[0], false);
assert.deepEqual(migrated.sections[1].items.map((item) => item.title), ["Figma", "HTML"]);

setState(createDemoState());
const originalName = getState().metadata.name;
updateState((state) => { state.metadata.name = "Nome atualizado"; });
assert.equal(getState().metadata.name, "Nome atualizado");
assert.equal(undoState(), true);
assert.equal(getState().metadata.name, originalName);

const first = createDemoState();
first.metadata.id = "resume-a"; first.metadata.name = "Currículo A";
assert.equal(saveState(first), true);
const second = createDemoState();
second.metadata.id = "resume-b"; second.metadata.name = "Currículo B";
assert.equal(saveState(second), true);
assert.equal(listResumes().length, 2);
assert.equal(loadResume("resume-a").metadata.name, "Currículo A");
assert.equal(backupState(first), true);
assert.equal(loadBackup().metadata.id, "resume-a");

console.log("Core tests passed.");
