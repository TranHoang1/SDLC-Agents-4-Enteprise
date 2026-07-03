# Hướng dẫn Publish Extension

## Chuẩn bị chung

1. **Tạo icon** — file PNG 128x128px, đặt tại `resources/icon.png`
2. **Cập nhật `package.json`** — thay `your-publisher-id` bằng publisher ID thực
3. **Tạo CHANGELOG.md** (optional nhưng recommended)

---

## A. Publish lên Open VSX (cho Kiro IDE)

Kiro IDE dùng Open VSX registry (https://open-vsx.org) làm mặc định.

### Bước 1: Tạo account trên Open VSX

1. Truy cập https://open-vsx.org
2. Đăng nhập bằng GitHub account
3. Vào Settings → Access Tokens → Create new token
4. Lưu token (chỉ hiện 1 lần)

### Bước 2: Install ovsx CLI

```bash
npm install -g ovsx
```

### Bước 3: Package extension

```bash
cd kiro-sdlc-agents
npx vsce package
# Tạo file: kiro-sdlc-agents-1.0.0.vsix
```

### Bước 4: Tạo Namespace

```bash
ovsx create-namespace <YOUR_PUBLISHER_ID> -p <YOUR_OPENVSX_TOKEN>
```

> **Lưu ý:** Chỉ cần chạy 1 lần. Namespace phải trùng với `publisher` trong `package.json`.

### Bước 5: Publish

```bash
ovsx publish kiro-sdlc-agents-1.0.0.vsix -p <YOUR_OPENVSX_TOKEN>
```

### Bước 5: Verify

- Truy cập https://open-vsx.org/extension/your-publisher-id/kiro-sdlc-agents
- Mở Kiro IDE → Extensions → Search "Kiro SDLC Agents"

---

## B. Publish lên VS Code Marketplace

### Bước 1: Tạo Azure DevOps Organization

1. Truy cập https://dev.azure.com
2. Đăng nhập Microsoft account
3. Tạo Organization (nếu chưa có)

### Bước 2: Tạo Personal Access Token (PAT)

1. Azure DevOps → User Settings → Personal Access Tokens
2. New Token:
   - Name: `vsce-publish`
   - Organization: All accessible organizations
   - Scopes: Custom → Marketplace → Check "Manage"
   - Expiration: 1 year
3. Copy token (chỉ hiện 1 lần)

### Bước 3: Tạo Publisher

1. Truy cập https://marketplace.visualstudio.com/manage
2. Create Publisher:
   - ID: `your-publisher-id` (phải match package.json)
   - Display Name: "Your Name"
3. Verify email

### Bước 4: Install vsce CLI

```bash
npm install -g @vscode/vsce
```

### Bước 5: Login

```bash
vsce login your-publisher-id
# Paste PAT token khi được hỏi
```

### Bước 6: Package & Publish

```bash
cd kiro-sdlc-agents
vsce package
# Tạo file: kiro-sdlc-agents-1.0.0.vsix

vsce publish
# Hoặc publish trực tiếp (không cần package trước)
```

### Bước 7: Verify

- Truy cập https://marketplace.visualstudio.com/items?itemName=your-publisher-id.kiro-sdlc-agents
- Mở VS Code → Extensions → Search "Kiro SDLC Agents"

---

## C. Publish lên CẢ HAI (recommended)

```bash
# 1. Package
npx vsce package

# 2. Publish to VS Code Marketplace
vsce publish

# 3. Publish to Open VSX (for Kiro)
ovsx publish kiro-sdlc-agents-1.0.0.vsix -p <OPENVSX_TOKEN>
```

---

## CI/CD Auto-Publish (GitHub Actions)

Tạo `.github/workflows/publish.yml`:

```yaml
name: Publish Extension
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npx vsce package
      
      # VS Code Marketplace
      - run: npx vsce publish -p ${{ secrets.VSCE_PAT }}
      
      # Open VSX (Kiro)
      - run: npx ovsx publish *.vsix -p ${{ secrets.OVSX_TOKEN }}
```

Secrets cần set trong GitHub repo:
- `VSCE_PAT` — Azure DevOps Personal Access Token
- `OVSX_TOKEN` — Open VSX Access Token

---

## Checklist trước khi publish

- [ ] `package.json` có đủ: publisher, repository, license, icon, description
- [ ] Icon 128x128 PNG tồn tại tại `resources/icon.png`
- [ ] README.md có screenshots/GIFs demo
- [ ] CHANGELOG.md có version history
- [ ] `npm run compile` thành công (zero errors)
- [ ] `npx vsce package` tạo .vsix thành công
- [ ] Test install .vsix locally trước khi publish
- [ ] Version number đúng (semver)

---

## Update version

```bash
# Bump patch (1.0.0 → 1.0.1)
npx vsce publish patch

# Bump minor (1.0.0 → 1.1.0)
npx vsce publish minor

# Bump major (1.0.0 → 2.0.0)
npx vsce publish major
```
