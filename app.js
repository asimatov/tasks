const STORAGE_KEY = "quiet-list-tasks-v1";

const elements = {
  grid: document.querySelector("#cardGrid"),
  tagFilters: document.querySelector("#tagFilters"),
  template: document.querySelector("#cardTemplate")
};

let tasks = loadTasks();
let editingId = null;
let isCreating = false;
let sortBy = "tags";
let sortDirection = "asc";
let draggedCard = null;
let suppressCardClickUntil = 0;
const activeTags = new Set();
const colors = [
  "sand", "coral", "sage", "sky", "lilac", "cream", "blush", "peach",
  "mint", "mist", "lavender", "stone", "rose", "butter", "olive", "aqua",
  "denim", "mauve", "apricot", "pistachio", "ice", "periwinkle", "taupe", "lemon"
];
const priorities = ["high", "medium", "low"];

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

function render(animate = true, animateReorder = false) {
  const previousPositions = animateReorder
    ? new Map([...elements.grid.querySelectorAll(".task-card")].map(card => [card.dataset.id, card.getBoundingClientRect()]))
    : null;
  const draft = isCreating ? tasks.find(task => task.id === editingId) : null;
  renderTagFilters();
  const visible = tasks
    .filter(task => task !== draft && (!activeTags.size || task.tags.some(tag => activeTags.has(tag))))
    .sort((a, b) => {
      if (!sortBy) return 0;
      let result = 0;
      if (sortBy === "priority") {
        const rank = { high: 3, medium: 2, low: 1 };
        result = (rank[a.priority || "medium"] - rank[b.priority || "medium"]);
      } else if (sortBy === "date") {
        result = a.createdAt - b.createdAt;
      } else {
        const aTag = a.tags[0] || "\uffff";
        const bTag = b.tags[0] || "\uffff";
        result = aTag.localeCompare(bTag, "en");
      }
      return result * (sortDirection === "asc" ? 1 : -1) || b.createdAt - a.createdAt;
    });

  elements.grid.replaceChildren();
  visible.forEach((task, index) => elements.grid.append(createCard(task, index, animate)));
  if (draft) elements.grid.append(createCard(draft, visible.length, false));
  else elements.grid.append(createGhostCard());
  elements.grid.hidden = false;

  if (previousPositions && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    elements.grid.querySelectorAll(".task-card").forEach(card => {
      const previous = previousPositions.get(card.dataset.id);
      if (!previous) return;
      const current = card.getBoundingClientRect();
      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;
      if (!deltaX && !deltaY) return;
      card.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)`, zIndex: 2 },
          { transform: "translate(0, 0)", zIndex: 2 }
        ],
        { duration: 480, easing: "cubic-bezier(.22, 1, .36, 1)" }
      );
    });
  }
}

function renderTagFilters() {
  const tags = [...new Set(tasks.flatMap(task => task.tags))].sort((a, b) => a.localeCompare(b, "en"));
  [...activeTags].forEach(tag => { if (!tags.includes(tag)) activeTags.delete(tag); });
  elements.tagFilters.replaceChildren(...tags.map(tag => {
    const button = document.createElement("button");
    button.className = `tag-filter${activeTags.has(tag) ? " active" : ""}`;
    button.type = "button";
    button.dataset.tag = tag;
    button.textContent = tag;
    button.setAttribute("aria-pressed", String(activeTags.has(tag)));
    return button;
  }));
  elements.tagFilters.hidden = tags.length === 0;
}

function updateSortControls() {
  document.querySelectorAll(".sort-button").forEach(button => {
    const active = button.dataset.sort === sortBy;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.querySelector(".sort-direction").textContent = active ? (sortDirection === "asc" ? "↑" : "↓") : "";
  });
}

function saveManualOrder() {
  const ids = [...elements.grid.querySelectorAll(".task-card")].map(card => card.dataset.id);
  const byId = new Map(tasks.map(task => [task.id, task]));
  const visibleIds = new Set(ids);
  const orderedVisible = ids.map(id => byId.get(id)).filter(Boolean);
  let visibleIndex = 0;
  tasks = tasks.map(task => visibleIds.has(task.id) ? orderedVisible[visibleIndex++] : task);
  sortBy = null;
  saveTasks();
  updateSortControls();
}

function createGhostCard() {
  const ghost = document.createElement("button");
  ghost.className = "ghost-card";
  ghost.type = "button";
  ghost.setAttribute("aria-label", "Create a new card");
  ghost.innerHTML = `<span class="ghost-plus" aria-hidden="true">+</span><span>New card</span>`;
  return ghost;
}

function createCard(task, index, animate) {
  const card = elements.template.content.firstElementChild.cloneNode(true);
  card.classList.add(task.color);
  card.classList.toggle("animate-in", animate);
  card.classList.toggle("completed", task.completed);
  card.style.animationDelay = `${Math.min(index * 45, 250)}ms`;
  card.dataset.id = task.id;
  card.draggable = task.id !== editingId;
  if (task.id === editingId) return createEditor(card, task);
  card.querySelector(".task-text").innerHTML = renderMarkdown(task.text);
  card.querySelector(".created-at").textContent = new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(task.createdAt);
  const priority = task.priority || "medium";
  const badge = card.querySelector(".priority-badge");
  badge.innerHTML = `<span class="priority-icon ${priority}" aria-hidden="true"></span>`;
  badge.className = `priority-badge ${priority}`;
  badge.title = `${priority} priority`;
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

function createEditor(card, task) {
  card.classList.add("editing");
  card.innerHTML = `<form class="card-editor">
    <div class="editor-topline">
      <div class="compact-field color-picker"><span>Color</span>
        <input name="color" type="hidden" value="${task.color}">
        <button class="color-picker-toggle" type="button" aria-label="Choose card color" aria-expanded="false"><span class="color-dot ${task.color}"></span><span class="picker-chevron">⌄</span></button>
        <div class="color-palette" hidden>${colors.map(color => `<button class="color-choice${color === task.color ? " selected" : ""}" type="button" data-color="${color}" aria-label="${color}" title="${color}"><span class="color-dot ${color}"></span></button>`).join("")}</div>
      </div>
      <div class="compact-field priority-field"><span>Priority</span>
        <input name="priority" type="hidden" value="${task.priority || "medium"}">
        <button class="priority-picker-toggle" type="button" aria-label="Choose priority" aria-expanded="false"><span class="priority-icon ${task.priority || "medium"}"></span><span class="picker-chevron">⌄</span></button>
        <div class="priority-palette" hidden>${priorities.map(priority => `<button class="priority-choice${priority === (task.priority || "medium") ? " selected" : ""}" type="button" data-priority="${priority}" aria-label="${priority} priority" title="${priority}"><span class="priority-icon ${priority}"></span></button>`).join("")}</div>
      </div>
    </div>
    <label class="editor-field"><span>Tags</span><input name="tags" type="text" maxlength="120" value="${escapeHtml(task.tags.join(", "))}" placeholder="work, personal, urgent"></label>
    <label class="editor-field editor-text"><span class="editor-label">Task <small class="char-count">${task.text.length}/1000</small></span><textarea name="text" maxlength="1000" placeholder="What needs to be done?" required>${escapeHtml(task.text)}</textarea></label>
    <label class="status-toggle"><input name="completed" type="checkbox"${task.completed ? " checked" : ""}> Completed</label>
    <div class="editor-actions"><button class="editor-cancel" type="button">Cancel</button><button class="editor-save" type="submit">Save</button></div>
  </form>`;
  requestAnimationFrame(() => {
    const editor = card.querySelector(".card-editor");
    const gridRect = elements.grid.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    if (cardRect.left + editor.offsetWidth > gridRect.right) card.classList.add("editor-align-right");
    card.querySelector("textarea").focus();
  });
  return card;
}

function startCreate() {
  if (isCreating) return elements.grid.querySelector("textarea")?.focus();
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const draft = { id: crypto.randomUUID(), text: "", tags: [], color: randomColor, priority: "medium", completed: false, createdAt: Date.now() };
  tasks.push(draft);
  editingId = draft.id;
  isCreating = true;
  render(false);
}

function cancelEdit() {
  if (isCreating) tasks = tasks.filter(task => task.id !== editingId);
  editingId = null;
  isCreating = false;
  render(false);
}

elements.grid.addEventListener("click", event => {
  if (event.target.closest(".ghost-card")) startCreate();
});

document.querySelector(".sort-controls").addEventListener("click", event => {
  const button = event.target.closest(".sort-button");
  if (!button) return;
  if (sortBy === button.dataset.sort) sortDirection = sortDirection === "asc" ? "desc" : "asc";
  else {
    sortBy = button.dataset.sort;
    sortDirection = "asc";
  }
  updateSortControls();
  render(false, true);
});

elements.tagFilters.addEventListener("click", event => {
  const button = event.target.closest(".tag-filter");
  if (!button) return;
  if (activeTags.has(button.dataset.tag)) activeTags.delete(button.dataset.tag);
  else activeTags.add(button.dataset.tag);
  render(false, true);
});

elements.grid.addEventListener("click", event => {
  const card = event.target.closest(".task-card");
  if (!card) return;
  if (Date.now() < suppressCardClickUntil) return;
  const task = tasks.find(item => item.id === card.dataset.id);
  if (isCreating && task.id !== editingId) {
    tasks = tasks.filter(item => item.id !== editingId);
    editingId = null;
    isCreating = false;
  }
  const editor = event.target.closest(".card-editor");
  if (editor) {
    const pickerToggle = event.target.closest(".color-picker-toggle");
    const colorChoice = event.target.closest(".color-choice");
    const priorityToggle = event.target.closest(".priority-picker-toggle");
    const priorityChoice = event.target.closest(".priority-choice");
    if (pickerToggle) {
      const palette = editor.querySelector(".color-palette");
      palette.hidden = !palette.hidden;
      pickerToggle.setAttribute("aria-expanded", String(!palette.hidden));
    } else if (colorChoice) {
      const color = colorChoice.dataset.color;
      editor.elements.color.value = color;
      editor.querySelector(".color-picker-toggle .color-dot").className = `color-dot ${color}`;
      editor.querySelectorAll(".color-choice").forEach(choice => choice.classList.toggle("selected", choice === colorChoice));
      const palette = editor.querySelector(".color-palette");
      palette.hidden = true;
      editor.querySelector(".color-picker-toggle").setAttribute("aria-expanded", "false");
      colors.forEach(name => card.classList.remove(name));
      card.classList.add(color);
    } else if (priorityToggle) {
      const palette = editor.querySelector(".priority-palette");
      palette.hidden = !palette.hidden;
      priorityToggle.setAttribute("aria-expanded", String(!palette.hidden));
    } else if (priorityChoice) {
      const priority = priorityChoice.dataset.priority;
      editor.elements.priority.value = priority;
      editor.querySelector(".priority-picker-toggle .priority-icon").className = `priority-icon ${priority}`;
      editor.querySelectorAll(".priority-choice").forEach(choice => choice.classList.toggle("selected", choice === priorityChoice));
      const palette = editor.querySelector(".priority-palette");
      palette.hidden = true;
      editor.querySelector(".priority-picker-toggle").setAttribute("aria-expanded", "false");
    } else if (event.target.closest(".editor-cancel")) cancelEdit();
    return;
  }
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
  } else {
    editingId = task.id;
    isCreating = false;
    render(false);
  }
});

elements.grid.addEventListener("input", event => {
  if (!event.target.matches('.card-editor textarea[name="text"]')) return;
  event.target.closest(".editor-text").querySelector(".char-count").textContent = `${event.target.value.length}/1000`;
});

elements.grid.addEventListener("dragstart", event => {
  const card = event.target.closest(".task-card:not(.editing)");
  if (!card) return event.preventDefault();
  draggedCard = card;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", card.dataset.id);
});

elements.grid.addEventListener("dragover", event => {
  if (!draggedCard) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  const target = event.target.closest(".task-card:not(.dragging)");
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const sameRow = event.clientY >= rect.top && event.clientY <= rect.bottom;
  const insertBefore = sameRow
    ? event.clientX < rect.left + rect.width / 2
    : event.clientY < rect.top + rect.height / 2;
  elements.grid.insertBefore(draggedCard, insertBefore ? target : target.nextSibling);
});

elements.grid.addEventListener("drop", event => {
  if (!draggedCard) return;
  event.preventDefault();
  saveManualOrder();
});

elements.grid.addEventListener("dragend", () => {
  if (!draggedCard) return;
  draggedCard.classList.remove("dragging");
  draggedCard = null;
  suppressCardClickUntil = Date.now() + 250;
});

elements.grid.addEventListener("submit", event => {
  const form = event.target.closest(".card-editor");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const text = data.get("text");
  if (!text.trim()) return form.elements.text.focus();
  const wasCreating = isCreating;
  tasks = tasks.map(task => task.id === editingId ? {
    ...task,
    text,
    tags: normalizeTags(data.get("tags")),
    color: data.get("color"),
    priority: data.get("priority"),
    completed: data.has("completed")
  } : task);
  saveTasks();
  editingId = null;
  isCreating = false;
  render(false, wasCreating);
});

render();
