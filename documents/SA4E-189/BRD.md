# BRD - SA4E-189

## 1. Overview
Hot-Reload System — Extension FileSystemWatcher reactive agentics UI update
Story SA4E-189 thuộc Epic SA4E-181 Chat Module — OpenCode Parity + Agentic Config System
Priority: High
Status: Done

## 2. Business Requirements
Thay đổi files trong `.code-intel/agents/`, `.code-intel/steering/`, `.code-intel/hooks/`, `.code-intel/skills/` phải phản ánh ngay trong UI extension mà không cần reload Kiro.

## 3. Gap Reference HR1-HR4
- HR1: Agent/Steering/Hooks/Skills list UI không tự động cập nhật khi tạo/xóa file tạm thời
- HR2: FileSystemWatcher chưa được triển khai cho 4 nhóm agentics
- HR3: Thay đổi file không trigger refresh UI
- HR4: Danh sách chỉ cập nhật sau khi reload cửa sổ

## 4. Acceptance Criteria
- AC1: Tạo/sửa/xóa `.code-intel/agents/*.md` -> agent list UI cập nhật trong 300ms debounce
- AC2: Tạo/sửa/xóa `.code-intel/steering/*.md` -> steering list UI cập nhật trong 300ms debounce
- AC3: Tạo/sửa/xóa `.code-intel/hooks/*.md` và `.code-intel/skills/*.md` -> log reload và sẵn sàng refresh UI
- AC4: FileSystemWatcher triển khai trong `ChatStateManager` cho 4 folder
- AC5: Disposer đúng để tránh leak, watcher hủy khi dispose
- Không ảnh hưởng backend, debounce 300ms, không cần restart

## 5. Technical Notes
Triển khai `vscode.FileSystemWatcher` trong `src/chat-panel/ChatStateManager.ts`:
- `agents`: watch `.code-intel/agents/*.md` → `sendAgentsInfo()`
- `steering`: watch `.code-intel/steering/*.md` → `sendSteeringInfo()`
- `hooks`: watch `.code-intel/hooks/*.md`
- `skills`: watch `.code-intel/skills/*.md`
Debounce 300ms cho mỗi nhóm.

*Updated for .code-intel agentics hot-reload*

