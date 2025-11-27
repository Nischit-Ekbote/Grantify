# 📋 Grantify

A modern Kanban board with drag-and-drop task management. Built with React, TypeScript, Rust, and MongoDB.

## ✨ Features

- Drag & drop tasks between columns
- Create, edit, and delete tasks
- Three columns: To Do, Active, Completed
- Real-time synchronization with backend
- Clean, responsive design with Tailwind CSS

## 🏗️ Tech Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS, @dnd-kit  
**Backend:** Rust, Actix-web, MongoDB

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Rust 1.70+
- MongoDB

### Installation

1. **Setup Backend**
```bash
cd backend
cargo run
```
Backend runs on `http://localhost:8080`

2. **Setup Frontend**
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

3. **Environment Variables**
Create `.env` in the root:
```env
VITE_API_URL=http://localhost:8080/api
MONGODB_URI=mongodb://localhost:27017
DATABASE_NAME=kanban_db
PORT=8080
```

## 📖 Usage

- **Add Task:** Type task name and press Enter or click Add
- **Move Task:** Drag and drop between columns
- **Edit Task:** Click the edit icon (✏️)
- **Delete Task:** Click the delete icon (✕)

## 🔌 API Endpoints

- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## 📦 Build & Deploy

```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && cargo build --release
```

**Live:** https://grantify-delta.vercel.app  
**Backend API:** https://grantify-y0g7.onrender.com/api
