# 🤖 FB Messenger Bot & Web UI Dashboard (Koyeb Cloud Ready)

একটি আধুনিক, সুরক্ষিত, **Modular** এবং **Anti-Detection** ফিচার সম্বলিত Facebook Messenger Bot যা `@dongdev/fca-unofficial` (v4.x), Express.js এবং Web UI Dashboard সহ তৈরি।

---

## 🌐 Web UI Dashboard & Management

বোটের সাথে একটি **Web UI Dashboard** বিল্ট-ইন যুক্ত করা হয়েছে। এটি দিয়ে আপনি সরাসরি ব্রাউজার থেকে বোটের কুকি, কনফিগারেশন এবং লগস দেখতে ও আপডেট করতে পারবেন।

### 🌟 Dashboard এর সুবিধাসমূহ:
1. **AppState (Cookie) Live Refresh**: 
   - `appstate.json` কুকির মেয়াদ শেষ হয়ে গেলে সরাসরি ব্রাউজার থেকে পেস্ট বা ফাইল আপলোড করে সেশন রিলিজ/লাইভ রিস্টার্ট করতে পারবেন।
2. **Environment (.env) Configuration**:
   - বটের নাম (`BOT_NAME`), প্রিফিক্স (`COMMAND_PREFIX`), এডমিন আইডি (`SUPER_ADMIN_ID`), AI Prompt এবং পাসওয়ার্ড ব্রাউজার থেকেই পরিবর্তন করা যায়।
3. **Live Console Terminal**:
   - বটের কানেকশন স্ট্যাটাস, RAM/CPU মেমোরি এবং রিয়েল-টাইম টার্মিনাল লগস ব্রাউজারে দেখা যায়।
4. **Koyeb Health Probe (/health)**:
   - Koyeb ও অন্যান্য ক্লাউড প্ল্যাটফর্মে 24/7 বোট সচল রাখার জন্য হেলথ চেক প্রব এ্যন্ডপয়েন্ট।

---

## 🚀 Koyeb এ ফ্রিতে 24/7 হোস্ট করার নিয়ম (Step-by-Step)

### Step 1: GitHub এ কোড Push করুন
1. আপনার GitHub এ একটি Private বা Public Repository তৈরি করুন।
2. আপনার প্রজেক্টটি GitHub এ পুশ করুন। (Note: `.env` এবং `appstate.json` ফাইল `.gitignore` এ রাখা হয়েছে যাতে কুকি লিক না হয়)।

### Step 2: Koyeb এ অ্যাকাউন্ট খুলুন
1. [koyeb.com](https://www.koyeb.com) এ গিয়ে ফ্রী অ্যাকাউন্ট খুলুন।

### Step 3: Koyeb App ডিপ্লয় করুন
1. Koyeb Dashboard এ গিয়ে **Create Service** এ ক্লিক করুন।
2. **GitHub** সিলেক্ট করে আপনার Bot এর Repository পছন্দ করুন।
3. **Environment Variables** এ নিচের ভ্যারিয়েবলগুলো যোগ করুন:
   - `PORT`: `8080` (অথবা `3000`)
   - `WEB_ADMIN_PASSWORD`: `আপনার গোপন পাসওয়ার্ড`
   - `BOT_NAME`: `তাহমিদ`
   - `COMMAND_PREFIX`: `/`
   - `SUPER_ADMIN_ID`: `আপনার ফেসবুক আইডি`
   - `ONEHOP_API_KEYS`: `আপনার API কি`
4. **Health Check** অপশনে:
   - Path: `/health`
   - Protocol: `HTTP`
5. **Deploy** বাটনে ক্লিক করুন!

### Step 4: Web UI দিয়ে AppState যোগ করুন
1. ডিপ্লয় শেষ হলে Koyeb আপনাকে একটি পাবলিক URL দেবে (যেমন: `https://your-bot-name.koyeb.app`).
2. ব্রাউজারে উক্ত URL ওপেন করুন।
3. আপনার সেট করা `WEB_ADMIN_PASSWORD` দিয়ে লগইন করুন।
4. **AppState (Cookies)** ট্যাবে গিয়ে আপনার `appstate.json` পেস্ট করে **Save & Live Reload** এ ক্লিক করুন! আপনার বোট সাথে সাথে লাইভ অন হয়ে যাবে!

---

## 📁 প্রজেক্ট স্ট্রাকচার (Modular Architecture)

```text
.
├── bot.js                  # মেইন বোট ও ইভেন্ট লোডার
├── server/
│   └── dashboard.js        # Express Web UI Dashboard & Health Server
├── public/                 # Web Dashboard Frontend (HTML, CSS, JS)
│   ├── index.html          # Dashboard Single Page UI
│   ├── css/style.css       # Dark Glassmorphism CSS Theme
│   └── js/app.js           # Live Dashboard App Controller
├── commands/               # কমান্ডের জন্য ডেডিকেটেড ফোল্ডার
│   ├── ping.js             # /ping কমান্ড
│   ├── help.js             # /help কমান্ড
│   ├── ai.js               # AI অটোমেটিক উত্তর ও স্মার্ট চ্যাট
│   └── ...                 # অন্যান্য কমান্ডসমূহ
├── handlers/               # ডাইনামিক লোডারসমূহ
├── utils/                  # Anti-detection & AI Memory
├── fca-config.json         # FCA সিকিউরিটি ক্যাশিং
├── package.json            # প্রজেক্ট ডিপেনডেন্সি
├── .env.example            # এনভায়রনমেন্ট ভ্যারিয়েবল টেমপ্লেট
└── README.md               # গাইড ও নির্দেশিকা
```

---

## 🛡️ Anti-Detection ফিচারসমূহ

1. **Human Typing Simulation (`sendHumanReply`)**:
   - টাইপিং এনিমেশন সহ র‍্যান্ডম টাইপিং ডিলে যোগ করে।
2. **Auto Cookie Refresh**:
   - প্রতি ২০ মিনিট পর পর তাজা ফেসবুক সেশন কুকি `appstate.json` এ সেভ করে।
3. **Protected Cookie & Password Lock**:
   - পাসওয়ার্ড প্রোটেক্টেড ড্যাশবোর্ড প্যানেল।

---

## ⚙️ লোকাল পিসিতে সেটআপ

### Step 1: ডিপেনডেন্সি ইনস্টল
```bash
npm install
```

### Step 2: ড্যাশবোর্ড ও বোট চালু করুন
```bash
npm start
```
ব্রাউজারে ওপেন করুন: `http://localhost:3000` (Default password: `admin123`).
