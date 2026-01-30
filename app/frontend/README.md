<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

```
frontend
├─ 📁components
│  ├─ 📄Header.tsx
│  └─ 📄Sidebar.tsx
├─ 📁lib
│  └─ 📄utils.ts
├─ 📁views
│  ├─ 📁worker
│  │  └─ 📄WorkerView.tsx
│  ├─ 📄AttendanceManagement.tsx
│  ├─ 📄BaseManagement.tsx
│  ├─ 📄DashboardView.tsx
│  ├─ 📄JobManagement.tsx
│  ├─ 📄LoginView.tsx
│  ├─ 📄PayrollView.tsx
│  └─ 📄WorkerManagement.tsx
├─ 📄.gitignore
├─ 📄App.tsx
├─ 📄index.html
├─ 📄index.tsx
├─ 📄metadata.json
├─ 📄package.json
├─ 📄README.md
├─ 📄tsconfig.json
├─ 📄types.ts
└─ 📄vite.config.ts
```