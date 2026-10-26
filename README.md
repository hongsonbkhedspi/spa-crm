# Spa CRM

Phần mềm quản lý khách cho spa: ghi nhận lượt khách, lịch hẹn, gói liệu trình, nhắc mỹ phẩm sắp hết, gửi khuyến mãi Zalo.
Chạy trực tiếp trên máy Windows đặt tại spa (không Docker), dữ liệu lưu trong PostgreSQL 15, dùng từ xa qua Cloudflare Tunnel.

Mục lục

1. [Cài đặt lần đầu](#1-cài-đặt-lần-đầu)
2. [Chạy app](#2-chạy-app)
3. [Tự chạy cùng Windows (Windows service)](#3-tự-chạy-cùng-windows)
4. [Chỉnh Windows để máy luôn sẵn sàng](#4-chỉnh-windows)
5. [Truy cập qua Internet (Cloudflare Tunnel)](#5-truy-cập-qua-internet-cloudflare-tunnel)
6. [Sao lưu tự động](#6-sao-lưu-tự-động)
7. [Khôi phục dữ liệu](#7-khôi-phục-dữ-liệu)
8. [Cài như app trên iPhone](#8-cài-như-app-trên-iphone)
9. [Quên mật khẩu chủ spa](#9-quên-mật-khẩu-chủ-spa)
10. [Lệnh thường dùng](#10-lệnh-thường-dùng)

---

## 1. Cài đặt lần đầu

### 1.1. Kiểm tra phần mềm có sẵn

Mở **PowerShell** và chạy:

```powershell
node -v          # phải ra v24.x
psql --version   # phải ra psql (PostgreSQL) 15.x
```

Nếu lệnh `psql` báo không tìm thấy: thêm thư mục `bin` của PostgreSQL vào PATH
(Start → gõ *environment* → *Edit the system environment variables* → *Environment Variables* → chọn `Path` → *Edit* → *New*):

```
C:\Program Files\PostgreSQL\15\bin
```

(Nếu PostgreSQL cài ở ổ khác thì dùng đúng đường dẫn đó, ví dụ `D:\Setup\PostgreSQL\15\bin`.) Đóng và mở lại PowerShell.

> Không nâng cấp Node hay PostgreSQL. App được làm cho Node 24 và PostgreSQL 15.

### 1.2. Tạo database

```powershell
psql -U postgres -c "CREATE DATABASE spa_crm;"
```

PostgreSQL chỉ cần nghe `localhost` (mặc định khi cài trên Windows). Không mở port 5432 ra ngoài.

### 1.3. Cấu hình `.env`

Chép `.env.example` thành `.env` rồi sửa:

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:MAT_KHAU@localhost:5432/spa_crm?schema=public` — thay mật khẩu user `postgres`. Mật khẩu có ký tự đặc biệt thì phải mã hoá, xem bên dưới. |
| `COOKIE_SECURE` | Để `true`. Chỉ đặt `false` khi thử nghiệm bằng `http://` qua IP khác `localhost`. |
| `BACKUP_PASSWORD` | Mật khẩu mã hoá bản sao lưu (xem mục 6) |
| `BACKUP_DIR` | Thư mục giữ bản sao lưu trên máy, ví dụ `D:\SpaCRM\backups` (nên ở ổ đĩa khác ổ cài Windows, xem mục 6.1) |
| `PG_BIN` | Thư mục `bin` của PostgreSQL 15 |

**Mật khẩu PostgreSQL có ký tự đặc biệt** (`@ # : / ? % & $ +` khoảng trắng…): trong `DATABASE_URL` phải viết dạng mã hoá, nếu không app và các script sao lưu sẽ hiểu sai địa chỉ máy chủ. Ví dụ mật khẩu `Spa@2026#x` phải viết thành `Spa%402026%23x`:

```
DATABASE_URL="postgresql://postgres:Spa%402026%23x@localhost:5432/spa_crm?schema=public"
```

Tự mã hoá mật khẩu bằng PowerShell (thay `Spa@2026#x` bằng mật khẩu thật):

```powershell
[uri]::EscapeDataString('Spa@2026#x')
```

Chỉ mã hoá trong `DATABASE_URL`. Khi đăng nhập pgAdmin hay `psql` bằng tay thì vẫn gõ mật khẩu gốc.

File `.env` chứa mật khẩu: không gửi cho ai, không đưa lên git.

### 1.4. Cài thư viện và tạo bảng

Trong thư mục app:

```powershell
npm install
npm run db:migrate
npm run db:seed      # (tuỳ chọn) thêm dữ liệu mẫu để thử
```

Xoá dữ liệu mẫu khi bắt đầu dùng thật: `npm run db:unseed` (chỉ xoá khách có ghi chú `[mẫu]` và danh mục mẫu chưa dùng).

## 2. Chạy app

```powershell
npm run build
npm start
```

Mở trình duyệt trên máy spa: <http://localhost:3000>.

- Lần đầu (database trống) app chuyển tới trang **Tạo tài khoản chủ spa**. Tạo xong, trang này bị khoá vĩnh viễn.
- Nhân viên được chủ spa thêm ở **Danh mục → Tài khoản**. Không có đăng ký công khai.

Có thể double-click `start.bat` thay cho hai lệnh trên (tự build nếu chưa build).

App chỉ nghe `127.0.0.1:3000`: máy khác trong mạng LAN **không** vào được bằng `http://<IP máy spa>:3000`. Muốn dùng từ máy khác/điện thoại thì đi qua Cloudflare Tunnel (mục 5).

Sau mỗi lần cập nhật mã nguồn: `npm install` → `npm run db:migrate` → `npm run build` → khởi động lại dịch vụ.

## 3. Tự chạy cùng Windows

Chạy app như Windows service bằng **NSSM** để máy khởi động lại là app tự chạy, không cần ai đăng nhập Windows.

1. Cài NSSM: `winget install NSSM.NSSM` (hoặc tải ở nssm.cc, chép `nssm.exe` vào `C:\Windows`).
2. Build app trước (`npm run build`).
3. Mở PowerShell **Run as administrator**, thay `D:\SpaCRM\app` bằng thư mục app:

```powershell
$app = "D:\SpaCRM\app"
nssm install SpaCRM "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next start -H 127.0.0.1 -p 3000"
nssm set SpaCRM AppDirectory $app
nssm set SpaCRM AppEnvironmentExtra NODE_ENV=production TZ=Asia/Ho_Chi_Minh
nssm set SpaCRM DisplayName "Spa CRM"
nssm set SpaCRM Start SERVICE_AUTO_START
New-Item -ItemType Directory -Force "$app\logs" | Out-Null
nssm set SpaCRM AppStdout "$app\logs\app.log"
nssm set SpaCRM AppStderr "$app\logs\app-error.log"
nssm set SpaCRM AppRotateFiles 1
nssm set SpaCRM AppRotateBytes 5000000
nssm start SpaCRM
```

- `AppDirectory` bắt buộc đúng thư mục app: app đọc file `.env` ở đó.
- Xem trạng thái: `nssm status SpaCRM`. Khởi động lại sau khi cập nhật: `nssm restart SpaCRM`.

## 4. Chỉnh Windows

- **Settings → System → Power**: *Sleep* = **Never**, tắt màn hình thì được, nhưng máy không được ngủ.
- Tắt Hibernate: PowerShell (admin) `powercfg /hibernate off`.
- Trong BIOS, bật tuỳ chọn tự bật lại khi có điện (*Restore on AC Power Loss* / *AC Back* = **Power On**) nếu máy có.
- Windows Update: đặt *Active hours* trùng giờ mở cửa để máy không tự khởi động lại giữa giờ làm.

## 5. Truy cập qua Internet (Cloudflare Tunnel)

Không mở port trên router. Cloudflare Tunnel tạo đường kết nối từ máy spa ra Cloudflare, điện thoại truy cập qua `https://crm.<domain>`.

1. Cần một tên miền quản lý DNS trên Cloudflare (tài khoản Free là đủ).
2. Vào **Zero Trust Dashboard → Networks → Tunnels → Create a tunnel** (loại *Cloudflared*), đặt tên `spa`.
   Chọn Windows, chép lệnh dashboard đưa ra và chạy trong PowerShell **Run as administrator**, dạng:
   ```powershell
   cloudflared.exe service install <TOKEN>
   ```
   Lệnh này cài `cloudflared` thành Windows service, tự chạy cùng máy.
3. Tab **Public Hostname → Add**: Subdomain `crm`, Domain `<domain>`, Service `HTTP` → `localhost:3000`.
4. **(Khuyến nghị) Bật Cloudflare Access** — lớp bảo vệ thứ hai trước trang đăng nhập của app:
   - **Access → Applications → Add an application → Self-hosted**, Application domain `crm.<domain>`.
   - **Session Duration: 1 month** (để điện thoại không phải nhập mã email liên tục).
   - Policy: *Allow*, Include → *Emails* → danh sách email của chủ spa và nhân viên.
   - Login method: **One-time PIN** (mã gửi qua email).
5. Thử từ điện thoại dùng 4G: mở `https://crm.<domain>` → nhập mã email (Access) → đăng nhập app.

Không dùng Quick Tunnel (`trycloudflare.com`) để vận hành thật vì địa chỉ thay đổi mỗi lần khởi động.

App đọc IP thật của người dùng từ header `CF-Connecting-IP` (dùng cho khoá đăng nhập sai 5 lần và danh sách phiên đăng nhập).

## 6. Sao lưu tự động

Cách làm: `pg_dump` → nén `.zip` bằng công cụ có sẵn của Windows → mã hoá AES-256 (cũng có sẵn trong Windows) thành file `.zip.enc` → lưu vào thư mục `BACKUP_DIR` **trên chính máy spa**. Không cần cài thêm phần mềm, không đẩy lên cloud.

Mỗi bản chỉ vài MB. Giữ tự động **30 bản gần nhất** cộng **bản ngày 1 của mỗi tháng trong 12 tháng**, tổng khoảng 42 bản, dưới 1 GB.

File `.zip.enc` **không mở được bằng double-click** (zip của Windows không đặt được mật khẩu, nên app mã hoá thêm một lớp). Muốn lấy dữ liệu ra thì dùng `scripts\restore.ps1` (mục 7) hoặc `scripts\decrypt-backup.ps1` kèm mật khẩu.

### 6.1. Chọn thư mục sao lưu

Đặt `BACKUP_DIR` trong `.env`, ví dụ `D:\SpaCRM\backups` (script tự tạo thư mục nếu chưa có).

**Lưu ý quan trọng:** bản sao lưu chỉ nằm trên máy spa, nên **không** cứu được dữ liệu nếu máy hỏng ổ cứng, bị mất trộm, cháy hoặc nhiễm mã độc tống tiền. Để an toàn hơn:

- Đặt `BACKUP_DIR` ở **ổ đĩa khác** với ổ cài Windows và PostgreSQL (ví dụ ổ cứng thứ hai, hoặc ổ cứng gắn ngoài cắm cố định).
- Định kỳ (ví dụ mỗi tuần) **chép thư mục `BACKUP_DIR` sang USB** và cất ở nơi khác (mang về nhà).

### 6.2. Đặt mật khẩu sao lưu

Đặt `BACKUP_PASSWORD` trong `.env`, rồi **ghi mật khẩu này ra giấy, cất riêng**.
Mất mật khẩu thì không ai mở được bản sao lưu, kể cả người làm phần mềm.

### 6.3. Lịch chạy hằng ngày

PowerShell **Run as administrator**, trong thư mục app:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-backup-task.ps1
```

Tạo tác vụ **SpaCRM Backup** chạy 23:00 mỗi ngày, chạy cả khi không ai đăng nhập Windows, tự chạy bù khi máy bật lại nếu lúc 23:00 máy tắt.
Đổi giờ: thêm `-At 22:30`.

### 6.4. Kiểm tra

Vào app: **Cài đặt → Sao lưu → Sao lưu ngay**. Sau ít phút trạng thái phải là **Thành công**, trang hiện tên file và thư mục, và trong `BACKUP_DIR` có file `spa_crm_<ngày>_<giờ>.zip.enc`.

- **Lỗi**: xem thông báo trên trang Sao lưu và file `backup.log` trong `BACKUP_DIR`.
- Trang **Hôm nay** hiện cảnh báo đỏ nếu quá 48 giờ không có bản sao lưu thành công.

Chạy tay từ dòng lệnh: `powershell -ExecutionPolicy Bypass -File scripts\backup.ps1`.

## 7. Khôi phục dữ liệu

### 7.1. Khôi phục trên chính máy spa

1. Dừng app: `nssm stop SpaCRM`.
2. Chọn file `.zip.enc` cần khôi phục trong `BACKUP_DIR` (hoặc trên USB đã chép ra).
3. Chạy:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 D:\SpaCRM\backups\spa_crm_2026-10-01_2300.zip.enc
   ```
   Gõ `CO` để xác nhận. Script giải mã bằng `BACKUP_PASSWORD` trong `.env` (không có thì hỏi), giải nén, rồi `pg_restore --clean` vào database trong `DATABASE_URL`. Sai mật khẩu hoặc file hỏng thì script dừng trước khi đụng vào database.
4. Bật lại app: `nssm start SpaCRM`.

Chỉ muốn lấy file ra (không khôi phục): `powershell -ExecutionPolicy Bypass -File scripts\decrypt-backup.ps1 <file.zip.enc>` → tạo file `.zip` thường cạnh đó, mở bằng Windows Explorer, bên trong là file `.dump` của `pg_dump`.

### 7.2. Diễn tập khôi phục (không đụng dữ liệu thật)

```powershell
psql -U postgres -c "CREATE DATABASE spa_crm_test;"
powershell -ExecutionPolicy Bypass -File scripts\restore.ps1 <file.zip.enc> -Database spa_crm_test
psql -U postgres -d spa_crm_test -c "SELECT (SELECT count(*) FROM customers) khach, (SELECT count(*) FROM visits) luot, (SELECT count(*) FROM customer_packages) goi;"
```

So các con số với database thật. Xong thì xoá: `psql -U postgres -c "DROP DATABASE spa_crm_test;"`.

### 7.3. Chuyển sang máy mới

1. Cài Node.js 24, PostgreSQL 15 (hoặc bản mới hơn).
2. Chép thư mục app (hoặc tải lại mã nguồn), tạo `.env` như mục 1.3 với **đúng `BACKUP_PASSWORD` cũ**.
3. Tạo database `spa_crm`, chạy `npm install` và `npm run db:migrate`.
4. Chép bản sao lưu mới nhất từ máy cũ (thư mục `BACKUP_DIR`) hoặc từ USB sang máy mới, rồi chạy `scripts\restore.ps1` như mục 7.1.
5. `npm run build`, cài lại Windows service (mục 3), Cloudflare Tunnel (mục 5, cài `cloudflared` với token cũ hoặc tạo tunnel mới), tác vụ sao lưu (mục 6).

## 8. Cài như app trên iPhone

1. Mở **Safari** (không dùng Chrome/Zalo), vào `https://crm.<domain>`, đăng nhập và tick **Ghi nhớ trên máy này** (giữ đăng nhập 30 ngày).
2. Bấm nút **Chia sẻ** (ô vuông có mũi tên lên, ở thanh dưới).
3. Kéo xuống, chọn **Thêm vào MH chính** (*Add to Home Screen*) → **Thêm**.
4. Mở app từ biểu tượng **Spa CRM** trên màn hình chính: chạy toàn màn hình, không có thanh địa chỉ.

<!-- Ảnh minh hoạ: chụp màn hình 3 bước trên iPhone và đặt vào docs/iphone-1.png, docs/iphone-2.png, docs/iphone-3.png -->

Nút **Gọi** mở trình gọi điện; nút **Zalo** mở thẳng app Zalo nếu đã cài.

## 9. Quên mật khẩu chủ spa

Trên máy spa, trong thư mục app:

```powershell
npm run reset-owner-password
```

Chọn tài khoản, nhập mật khẩu mới (tối thiểu 8 ký tự). Mọi thiết bị đang đăng nhập bằng tài khoản đó bị đăng xuất.
Nhân viên quên mật khẩu: chủ spa đặt lại ở **Danh mục → Tài khoản**.

## 10. Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Chạy chế độ phát triển (127.0.0.1:3000) |
| `npm run build` | Build bản chạy thật |
| `npm start` | Chạy bản đã build (127.0.0.1:3000) |
| `npm run lint` | Kiểm tra kiểu TypeScript |
| `npm run db:migrate` | Áp dụng migration vào database |
| `npm run db:migrate:dev` | Tạo migration mới khi sửa `prisma/schema.prisma` (chỉ dùng khi phát triển) |
| `npm run db:seed` / `npm run db:unseed` | Thêm / xoá dữ liệu mẫu |
| `npm run reset-owner-password` | Đặt lại mật khẩu chủ spa |
| `scripts\backup.ps1` | Sao lưu ngay |
| `scripts\restore.ps1 <file.zip.enc> [-Database ten_db]` | Khôi phục |
| `scripts\decrypt-backup.ps1 <file.zip.enc>` | Giải mã thành file `.zip` thường |
| `scripts\install-backup-task.ps1` | Tạo lịch sao lưu 23:00 |
