# MKS Billing Software

Clean, full-stack POS and Billing software built with Angular frontend and Node.js/Express backend.

---

## 📁 Project Folder Structure

```
mks_billing_softwer/
├── frontend/                     # Angular 19 Frontend Application
├── server/                       # Node.js & Express Backend REST API
├── desktop_launcher/             # Desktop Integration & 1-Click Launchers
│   ├── launchers/               # Core Windows launch scripts (.bat / .vbs)
│   │   ├── MKS_Billing_Software.bat
│   │   ├── MKS_Billing_Software.vbs
│   │   ├── MKS_POS_Billing_Counter.bat
│   │   └── MKS_POS_Billing_Counter.vbs
│   ├── tools/                   # Shortcut & Icon generator utilities
│   │   ├── Create_Desktop_Shortcut.bat
│   │   ├── create_shortcut.ps1
│   │   ├── clean_desktop.ps1
│   │   ├── create_ico.ps1
│   │   └── find_image.ps1
│   └── assets/                  # Icon files
│       └── mks_logo.ico
├── package.json                  # Root npm scripts & workspace configuration
└── README.md                     # Project documentation
```

---

## 🚀 How to Run the Application

### 1. Launching from Desktop (Recommended for POS Operators)
- Double-click **`MKS Admin Console`** or **`MKS POS Billing Counter`** shortcuts on your Desktop.
- If shortcuts are missing, run:
  ```powershell
  npm run create-shortcut
  ```

### 2. Launching from Terminal / IDE
- **Start Backend Server:**
  ```bash
  npm run start:server
  ```
- **Start Frontend POS Application:**
  ```bash
  npm run start:frontend
  ```
- **Install All Dependencies:**
  ```bash
  npm run install:all
  ```
