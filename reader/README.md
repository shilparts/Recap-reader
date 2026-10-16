# Recap Reader (Android companion, first version)

A small web app that keeps copies of your Recap projects on the phone and works offline. It reads the `.recap.json` file made by **Continue project → Transfer project** on the PC. It only reads; editing stays on the PC.

What it shows: next action, goal and progress first, then approved decisions, open tasks and questions. Rejected options, proposals, AI statements and superseded decisions each have their own section. Unreviewed findings and ignored sources are never shown. Every project shows when it was exported, so an old copy can't be mistaken for the current state. **Copy handoff** and **Share** send the handoff to an AI app.

Storage: projects are kept in the phone browser's own storage (IndexedDB). Nothing is uploaded. Adding a newer file of the same project replaces the older copy; an older file is refused.

## Try it on the PC

Start Recap and open http://127.0.0.1:4173/reader/.

## Put it on the phone

Android only installs web apps from an `https://` address, so the reader needs to be hosted once. The free option is GitHub Pages: publish this folder together with `handoff.js` and `project-transfer.js` (the reader loads them from the folder above). The page holds no project data, so it can be public. Open the address in Chrome on the phone, choose **Add to Home screen**, then add project files from the phone's Downloads.

A Play Store app (via Capacitor, same code) can come later; the store's one-time US$25 fee is the only cost.
