# Task List

A simple task tracker built with plain HTML, CSS and JavaScript.

## Run

Open `index.html` in a browser. To run it through a local server, use:

```powershell
python -m http.server 8080
```

Then open http://localhost:8080.

Cards are saved locally in the browser (`localStorage`).

## Supported Markdown

Card text is stored as the original Markdown and rendered only when the card is displayed.

- Headings from `# Heading` through `###### Heading`
- Bold text: `**bold**` or `__bold__`
- Italic text: `*italic*` or `_italic_`
- Strikethrough text: `~~done~~`
- Inline code: `` `const value = 1` ``
- Fenced code blocks using three backticks
- Blockquotes: `> Quoted text`
- Bulleted lists using `-`, `+`, or `*`
- Numbered lists such as `1. First item`
- Interactive task lists:
  - `- [ ] Not completed`
  - `- [x] Completed`
- Links: `[OpenAI](https://openai.com)`
- Images: `![Description](https://example.com/image.png)`
- Horizontal rules using `---`, `***`, or `___`
- Paragraphs and line breaks

Clicking a task-list checkbox updates `[ ]` to `[x]` (or back again) in the saved Markdown source.

Raw HTML is escaped rather than rendered. Links and images support only `http://` and `https://` URLs.
