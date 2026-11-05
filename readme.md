# RES Stock Value Breakdown

Upload this week's StockZure export (.xlsx). The app returns the Exco breakdown workbook:

- **SUMMARY**: value per category, stock age (dead / slow / moving), high value, equipment left out
- **PTA Current Stock**: the full list with a Category column
- **One tab per category**, e.g. Power Cable, Cable Containment, Terminations, Protection & Switchgear
- **PTA HIGH Value**: items with a unit price of R5,000 or more
- **Dead & Slow Stock**: items whose quantity hasn't changed in 12+ months (dead) or 6+ months (slow), with an Action dropdown: Use on project / Return to supplier / Sell / Transfer to CPT / Write off / Keep
- **Data Checks**: R0 prices, duplicate barcodes and equipment, for tidying up in StockZure

Everything runs in the browser. Stock files are never uploaded anywhere, and the app costs nothing to run.

## Files to upload to GitHub

```
index.html
app.js
README.md
exceljs.min.js
```

All four files go in the main (root) folder. There are no sub-folders.

**Do NOT upload** the history backup file (`RES stock history - starting point (Jan + Jun 2025).json`). It holds stock data. Keep it on your laptop or OneDrive.

## Put it online (free)

**Option A: GitHub Pages**

Free GitHub Pages needs a *public* repo. The code contains no stock data, so a public repo is fine.

1. Create a new repo, e.g. `RhinoEnergyDavidWH/res-stock-breakdown` (Public).
2. Click *Add file → Upload files*. Drag in `index.html`, `app.js`, `README.md` and `exceljs.min.js` together. Commit.
3. Go to *Settings → Pages → Build and deployment*. Set Source to "Deploy from a branch", Branch to `main`, folder `/ (root)`, then Save.
4. After a minute or two the app is live at `https://rhinoenergydavidwh.github.io/res-stock-breakdown/`.

**Option B: Render static site**

This keeps the repo private. You already use Render for GRV.

1. Upload the same files to a *private* repo.
2. On Render, choose *New → Static Site*, pick the repo, leave the Build Command empty and set Publish directory to `.`.

## First time on a device

1. Open the app.
2. Under **History**, tap **Restore backup** and choose `RES stock history - starting point (Jan + Jun 2025).json`.

That loads the Jan 2025 and Jun 2025 stock lists, so dead stock can be worked out straight away.

## Every week

1. Export the stock list from StockZure.
2. Upload it to the app. Check the stock date (it's picked up from the file name if the date is in it).
3. If anything shows under **Needs Review**, choose a category. The app remembers your choice.
4. Tap **Download Exco Excel**. This also saves the week to history.
5. Every month or so, tap **Download backup** and keep that file safe.

## Notes

- History is stored in this browser on this device. Clearing browser data deletes it, so keep backups.
- To move to another device, use Download backup there and Restore backup on the new device.
- Slow/dead means the quantity stayed **exactly the same** across the saved stock lists. Weekly history makes this more accurate over time.
- Change the high value limit, the slow/dead months and the address under **Settings**.
- Write-downs or disposals of dead stock must be approved by Finance (CA(SA)).

This tool was developed with the assistance of an AI agent under the direction of qualified RES personnel.
