# Mini AI Gateway

## 1. Overview

Mini AI Gateway adalah layanan API yang menjadi perantara antara aplikasi dan berbagai AI provider.

Proyek ini dibuat sebagai **learning project untuk mengeksplorasi ElysiaJS + Bun**, sekaligus membangun fondasi yang nantinya dapat dikembangkan menjadi developer tool atau SaaS kecil.

Pada tahap awal, sistem menggunakan **Mock AI Provider**, sehingga tidak membutuhkan API AI berbayar.

---

## 2. Problem

Developer yang menggunakan beberapa AI provider harus berurusan dengan API, authentication, model, dan konfigurasi yang berbeda-beda.

AI Gateway bertujuan menyediakan **satu API sederhana** yang dapat digunakan aplikasi untuk berkomunikasi dengan AI.

---

## 3. Goal

Membuat gateway sederhana yang dapat:

* Menerima request dari aplikasi.
* Memproses request melalui satu API.
* Meneruskan request ke AI provider.
* Mengembalikan response ke aplikasi.
* Mengelola API key.
* Mencatat penggunaan API.
* Membatasi penggunaan API.

---

## 4. Target User

**Developer** yang ingin menggunakan AI melalui satu API yang konsisten.

---

## 5. Core Features

### API Gateway

Satu endpoint untuk berkomunikasi dengan AI.

### API Key

Developer dapat menggunakan API key untuk mengakses gateway.

### AI Provider

Sistem memiliki provider abstraction sehingga provider AI dapat ditambahkan atau diganti dengan mudah.

Versi awal menggunakan:

> Mock AI Provider

### Usage Tracking

Mencatat penggunaan API seperti jumlah request dan penggunaan model.

### Rate Limiting

Membatasi jumlah request agar API tidak digunakan secara berlebihan.

### API Documentation

Menyediakan dokumentasi API yang mudah dipahami developer.

---

## 6. User Flow

```text
Developer
   ↓
Mendapatkan API Key
   ↓
Mengirim request ke AI Gateway
   ↓
Gateway memproses request
   ↓
AI Provider
   ↓
Response
   ↓
Developer
```

---

## 7. MVP

Versi pertama cukup memiliki:

* API Gateway
* API Key
* Mock AI Provider
* Usage Tracking
* Rate Limiting
* API Documentation

**Belum perlu:**

* Dashboard
* Billing
* Subscription
* Multi-provider
* RAG
* Vector database
* Fitur AI yang kompleks

---

## 8. Future Development

Setelah MVP berhasil, proyek dapat dikembangkan menjadi:

1. Integrasi AI provider sungguhan.
2. Multi-provider dan model routing.
3. Streaming response.
4. Dashboard penggunaan.
5. Billing dan subscription.
6. Analytics.
7. Webhook.
8. Team dan organization.
9. Production deployment.

---

## 9. Success Criteria

MVP dianggap berhasil apabila developer dapat:

> Membuat API key → mengirim request ke AI Gateway → mendapatkan response AI → melihat penggunaan API.

Semua proses tersebut dapat berjalan secara lokal menggunakan **Bun + Elysia** tanpa membutuhkan AI API berbayar.

