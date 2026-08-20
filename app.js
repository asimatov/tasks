const STORAGE_KEY = "quiet-list-tasks-v1";

const elements = {
  grid: document.querySelector("#cardGrid"),
  empty: document.querySelector("#emptyState"),
  dialog: document.querySelector("#taskDialog"),
  form: document.querySelector("#taskForm"),
  text: document.querySelector("#taskText"),
  tags: document.querySelector("#taskTags"),
  charCount: document.querySelector("#charCount"),
  dialogEyebrow: document.querySelector("#dialogEyebrow"),
  dialogTitle: document.querySelector("#dialogTitle"),
  template: document.querySelector("#cardTemplate")
};

let tasks = loadTasks();
let editingId = null;

function loadTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function normalizeTags(value) {
  return [...new Set(value.split(",").map(tag => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
}

function render(animate = true) {
  const visible = tasks
    .sort((a, b) => {
      const aTag = a.tags[0] || "\uffff";
      const bTag = b.tags[0] || "\uffff";
      return aTag.localeCompare(bTag, "en") || b.createdAt - a.createdAt;
    });

  elements.grid.replaceChildren();
  visible.forEach((task, index) => elements.grid.append(createCard(task, index, animate)));
  elements.grid.hidden = visible.length === 0;
  elements.empty.classList.toggle("visible", visible.length === 0);
}

function createCard(task, index, animate) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.classList.add(task.color);
  card.classList.toggle("animate-in", animate);
  card.classList.toggle("completed", task.completed);
  card.style.animationDelay = `${Math.min(index * 45, 250)}ms`;
  card.dataset.id = task.id;
  card.querySelector(".task-text").textContent = task.text;
  card.querySelector(".created-at").textContent = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(task.createdAt);
  const tagList = card.querySelector(".tag-list");
  if (task.tags.length) task.tags.forEach(tag => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tagList.append(span);
  });
  else {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = "no tag";
    tagList.append(span);
  }
  return card;
}

function openDialog(task = null) {
  editingId = task?.id ?? null;
  elements.form.reset();
  elements.text.value = task?.text ?? "";
  elements.tags.value = task?.tags.join(", ") ?? "";
  document.querySelector(`input[name="color"][value="${task?.color || "sand"}"]`).checked = true;
  elements.dialogEyebrow.textContent = task ? "Editing" : "New task";
  elements.dialogTitle.textContent = task ? "Edit card" : "Create a card";
  elements.charCount.textContent = elements.text.value.length;
  elements.dialog.showModal();
  setTimeout(() => elements.text.focus(), 50);
}

function closeDialog() { elements.dialog.close(); editingId = null; }

document.querySelector("#openCreateButton").addEventListener("click", () => openDialog());
document.querySelector("#emptyCreateButton").addEventListener("click", () => openDialog());
document.querySelector("#closeDialogButton").addEventListener("click", closeDialog);
document.querySelector("#cancelButton").addEventListener("click", closeDialog);
elements.text.addEventListener("input", () => elements.charCount.textContent = elements.text.value.length);
elements.dialog.addEventListener("click", event => {
  if (event.target === elements.dialog) closeDialog();
});

elements.form.addEventListener("submit", event => {
  event.preventDefault();
  const text = elements.text.value.trim();
  if (!text) return elements.text.focus();
  const data = {
    text,
    tags: normalizeTags(elements.tags.value),
    color: new FormData(elements.form).get("color")
  };
  const wasEditing = Boolean(editingId);
  if (wasEditing) tasks = tasks.map(task => task.id === editingId ? { ...task, ...data } : task);
  else tasks.push({ id: crypto.randomUUID(), ...data, completed: false, createdAt: Date.now() });
  saveTasks();
  closeDialog();
  render(!wasEditing);
});

elements.grid.addEventListener("click", event => {
  const card = event.target.closest(".task-card");
  if (!card) return;
  const task = tasks.find(item => item.id === card.dataset.id);
  if (event.target.closest(".complete-button")) {
    task.completed = !task.completed;
    saveTasks(); render(false);
  } else if (event.target.closest(".delete-button") && task.completed) {
    if (confirm("Delete this card?")) {
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks(); render(false);
    }
  } else openDialog(task);
});

render();
