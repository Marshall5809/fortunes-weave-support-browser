# Fortune's Weave Support Archive — CSV Edition

## Data files
- `data/characters.csv` — roster + portrait mappings
- `data/supports.csv` — support relationships
- `data/growths.csv` — personal growths + Mu's Signs of Growth variant
- `data/classes.csv` — class tiers and class growth modifiers
- `data/recruitment.csv` — recruitment information
- `data/abilities.csv` — personal abilities
- `data/gifts.csv` — loved/really-liked gifts
- `data/preferences.csv` — likes and interests

## Recommended workflow
1. Clone the repo once.
2. Open the repo folder in VS Code.
3. Edit the file you need.
4. Open Source Control (`Ctrl+Shift+G`).
5. Review changes.
6. Enter a commit message and click Commit.
7. Click Sync Changes / Push.
8. GitHub Pages redeploys automatically.

You do not re-upload the entire project every time.

## Local testing
Because CSV files are loaded with `fetch()`, run a local server:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Keep all portrait `.webp` files in `portraits/` and class icons in `class-icons/`.


## Portrait folder

All character portrait images now belong in:

```text
portraits/
```

Examples:

```text
portraits/eshmel.webp
portraits/honghua.webp
portraits/cai.webp
```

Do not keep character portraits in the repository root anymore.
