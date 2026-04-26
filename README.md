# GRE Prep — Personal PWA

A minimal, offline-capable PWA for GRE practice. Verbal, Quant, and Analytical Writing. No accounts, no backend, no analytics. Progress stored in your browser only.

## What's included

- Full 4-screen app: Home · Set detail · Test mode · Review mode
- Calculator overlay for Quant (4-function + √, with memory)
- Mark-for-review, skip-and-return, question jump grid
- Score + breakdown by question type after each test
- AWA screen with auto-saving draft and model essay
- Offline support via service worker
- 1 starter set per subject (Verbal, Quant, AWA) demonstrating every question type

## Run it locally

PWAs need to be served over HTTP (not `file://`). Any static server works:

```bash
cd gre-app
python3 -m http.server 8000
# then open http://localhost:8000
```

Or `npx serve` if you have Node.

## Deploy (for home-screen install on your phone)

Pick one free host:

- **Vercel** — drag the folder into vercel.com, done.
- **Netlify** — drag-and-drop into app.netlify.com.
- **GitHub Pages** — push the folder, enable Pages in repo settings.
- **Cloudflare Pages** — connect a repo or direct upload.

You'll get a URL like `https://your-project.vercel.app`. Open it on your phone.

## Install to phone home screen

**iOS (Safari):** open the URL → Share button → "Add to Home Screen"
**Android (Chrome):** open the URL → menu (⋮) → "Install app" or "Add to Home screen"

The app will run full-screen with its own icon, just like a native app. It works offline after the first load.

## Adding new content

All content is JSON files in `content/`. To add a new set:

1. Copy an existing set file and rename it (e.g., `content/verbal/v02-hard.json`)
2. Edit the `id`, `title`, `difficulty`, and the `questions` array
3. Add an entry to `content/index.json` under the appropriate subject
4. Refresh the app — the new set appears on the home screen

### Spec per set

| Subject | Difficulty | Questions | Mix |
|---|---|---|---|
| Verbal | Mid | 12 | 4 TC · 4 SE · 4 RC (2 passages × 2 Q) |
| Verbal | Hard | 15 | 5 TC · 5 SE · 5 RC |
| Quant  | Mid | 12 | 6 QC · 4 PS · 1 NE · 1 MA |
| Quant  | Hard | 15 | 7 QC · 5 PS · 2 NE · 1 MA |

Target: 5 Mid + 5 Hard for each of Verbal and Quant (10 sets per subject). Plus 5 AWA prompts.

### Question schemas

**Text Completion** — `blanks` is 1, 2, or 3. Use `[[1]]`, `[[2]]`, `[[3]]` in the prompt as placeholders. `options` is an array of arrays (one per blank). `answer` is an array of correct words in blank order.

```json
{
  "id": "v01-q01",
  "type": "text_completion",
  "blanks": 2,
  "prompt": "The proposal was [[1]] by the committee, though some members expressed [[2]].",
  "options": [
    ["approved", "rejected", "tabled"],
    ["enthusiasm", "reservations", "indifference"]
  ],
  "answer": ["approved", "reservations"],
  "explanation": "..."
}
```

**Sentence Equivalence** — pick exactly 2 of 6. Use `[[1]]` as blank.

```json
{
  "type": "sentence_equivalence",
  "prompt": "Her response was [[1]] given the circumstances.",
  "options": ["measured", "restrained", "wild", ...],
  "answer": ["measured", "restrained"]
}
```

**Reading Comprehension**

```json
{
  "type": "reading_comprehension",
  "passage": "Paragraph 1...\n\nParagraph 2...",
  "prompt": "The primary purpose of the passage is to",
  "options": ["...", "...", "...", "...", "..."],
  "answer": "..."
}
```

**Problem Solving** — 5 options, one correct.

```json
{
  "type": "problem_solving",
  "prompt": "If 2x + 3 = 11, what is x?",
  "options": ["2", "3", "4", "5", "6"],
  "answer": "4"
}
```

**Quantitative Comparison** — answer is one of the four fixed strings.

```json
{
  "type": "quantitative_comparison",
  "prompt": "x > 0",
  "quantityA": "x + 1",
  "quantityB": "2x",
  "answer": "The relationship cannot be determined from the information given."
}
```

Valid answers for QC:
- `"Quantity A is greater."`
- `"Quantity B is greater."`
- `"The two quantities are equal."`
- `"The relationship cannot be determined from the information given."`

**Numeric Entry** — answer is a number as a string. User input is compared numerically.

```json
{
  "type": "numeric_entry",
  "prompt": "If 3x = 12, what is x?",
  "answer": "4",
  "unit": ""
}
```

**Multiple Answer** — pick all that apply. `answer` is an array (order-independent).

```json
{
  "type": "multiple_answer",
  "prompt": "Which are prime? Select all that apply.",
  "options": ["2", "4", "7", "9", "11"],
  "answer": ["2", "7", "11"]
}
```

**AWA** — one prompt + model essay.

```json
{
  "id": "awa02",
  "title": "AWA Prompt 2",
  "subject": "awa",
  "prompt": "The main statement to respond to.",
  "instructions": "Write a response in which...",
  "modelEssay": "Paragraph 1...\n\nParagraph 2...",
  "rubricNotes": "What a 6/6 essay does differently..."
}
```

## Updating after you add content

The service worker caches content with a network-first strategy, so new sets should appear on refresh. If changes don't show up:

1. Bump `CACHE_VERSION` in `sw.js` (e.g. `gre-v1` → `gre-v2`) and redeploy
2. On your phone, close the app and reopen it once; the new service worker activates

## Authoring workflow

1. Ask an AI to draft questions matching the schema and difficulty (specify Mid or Hard)
2. **Verify every question yourself** — check difficulty calibration against real ETS samples, verify answers are correct, verify explanations actually explain
3. Pad with curated questions from free sources (GregMat, Manhattan Prep forums, PrepScholar). Attribute in the explanation if you copy.
4. Save as a JSON file, add to `index.json`, deploy.

## Clearing progress

Open browser devtools → Application → Local Storage → delete keys starting with `gre.`

## License

Personal use. Content you add is your responsibility — don't redistribute copyrighted ETS questions.
