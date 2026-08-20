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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderInlineMarkdown(value) {
  const codeSpans = [];
  let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_, code) => {
    const index = codeSpans.push(`<code>${code}</code>`) - 1;
    return `\u0000${index}\u0000`;
  });

  html = html
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^\n]+?)__/g, "<strong>$1</strong>")
    .replace(/~~([^\n]+?)~~/g, "<del>$1</del>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1<em>$2</em>");

  return html.replace(/\u0000(\d+)\u0000/g, (_, index) => codeSpans[Number(index)]);
}

function renderMarkdown(value) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let paragraph = [];
  let listType = null;
  let code = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };

  for (const [lineIndex, line] of lines.entries()) {
    if (code !== null) {
      if (/^\s*```/.test(line)) {
        output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushParagraph(); closeList(); code = [];
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    const listItem = line.match(/^\s*([-+*]|\d+[.)])\s+(.+)$/);
    const quote = line.match(/^\s{0,3}>\s?(.*)$/);
    if (heading) {
      flushParagraph(); closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
    } else if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph(); closeList(); output.push("<hr>");
    } else if (listItem) {
      flushParagraph();
      const nextType = /^\d/.test(listItem[1]) ? "ol" : "ul";
      if (listType !== nextType) { closeList(); output.push(`<${nextType}>`); listType = nextType; }
      const taskItem = nextType === "ul" && listItem[2].match(/^\[([ xX])\]\s*(.*)$/);
      if (taskItem) {
        const checked = taskItem[1].toLowerCase() === "x" ? " checked" : "";
        output.push(`<li class="task-list-item"><input class="markdown-checkbox" type="checkbox" data-line="${lineIndex}" aria-label="Mark list item as completed"${checked}><span>${renderInlineMarkdown(taskItem[2])}</span></li>`);
      } else output.push(`<li>${renderInlineMarkdown(listItem[2])}</li>`);
    } else if (quote) {
      flushParagraph(); closeList(); output.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
    } else if (!line.trim()) {
      flushParagraph(); closeList();
    } else {
      closeList(); paragraph.push(line);
    }
  }

  if (code !== null) output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushParagraph(); closeList();
  return output.join("");
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
  card.querySelector(".task-text").innerHTML = renderMarkdown(task.text);
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
  const text = elements.text.value;
  if (!text.trim()) return elements.text.focus();
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
  const markdownCheckbox = event.target.closest(".markdown-checkbox");
  if (markdownCheckbox) {
    const newline = task.text.match(/\r\n|\r|\n/)?.[0] || "\n";
    const lines = task.text.split(/\r\n|\r|\n/);
    const lineIndex = Number(markdownCheckbox.dataset.line);
    if (lines[lineIndex] !== undefined) {
      lines[lineIndex] = lines[lineIndex].replace(
        /^(\s*[-+*]\s+\[)[ xX](\])/,
        `$1${markdownCheckbox.checked ? "x" : " "}$2`
      );
      task.text = lines.join(newline);
      saveTasks(); render(false);
    }
  } else if (event.target.closest(".complete-button")) {
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
