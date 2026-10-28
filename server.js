require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET. Copy .env.example to .env and configure it.");
  process.exit(1);
}

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["student", "admin"], default: "student" },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }]
}, { timestamps: true });

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subject: { type: String, required: true, trim: true, maxlength: 80 },
  teacher: { type: String, default: "فريق المنصة", maxlength: 80 },
  description: { type: String, default: "", maxlength: 1000 },
  coverColor: { type: String, default: "#2457d6" },
  published: { type: Boolean, default: true },
  lessons: [{
    title: { type: String, required: true, maxlength: 150 },
    videoUrl: { type: String, required: true, maxlength: 500 },
    duration: { type: String, default: "" }
  }]
}, { timestamps: true });

const codeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  usedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);
const Course = mongoose.model("Course", courseSchema);
const AccessCode = mongoose.model("AccessCode", codeSchema);

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code).trim().toUpperCase()).digest("hex");
}
function makeToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}
function safeUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role };
}
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "سجّل الدخول أولاً." });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "الحساب غير موجود." });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "انتهت الجلسة أو أن رمز الدخول غير صالح." });
  }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "هذه العملية للمسؤول فقط." });
  next();
}
function validVideoUrl(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) &&
      ["youtube.com", "www.youtube.com", "youtu.be", "player.vimeo.com", "vimeo.com"].includes(u.hostname);
  } catch { return false; }
}
function publicCourse(course) {
  return {
    id: course._id, title: course.title, subject: course.subject, teacher: course.teacher,
    description: course.description, coverColor: course.coverColor,
    lessonCount: course.lessons.length
  };
}

app.get("/api/health", (req, res) => res.json({ ok: true, service: "StudyHub" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || name.trim().length < 2) return res.status(400).json({ error: "اكتب اسمًا صحيحًا." });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "البريد الإلكتروني غير صحيح." });
    if (!password || password.length < 8) return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل." });
    if (await User.findOne({ email: email.toLowerCase().trim() })) return res.status(409).json({ error: "البريد الإلكتروني مسجل بالفعل." });
    const user = await User.create({
      name: name.trim(), email: email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(password, 12)
    });
    res.status(201).json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "حصل خطأ أثناء إنشاء الحساب." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const password = String(req.body?.password || "");
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "تعذر تسجيل الدخول الآن." });
  }
});

app.get("/api/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).populate("courses");
  res.json({ user: safeUser(user), courses: user.courses.map(publicCourse) });
});

app.get("/api/courses", async (req, res) => {
  const courses = await Course.find({ published: true }).sort({ createdAt: -1 });
  res.json(courses.map(publicCourse));
});

app.post("/api/codes/redeem", auth, async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9-]{8,40}$/.test(code)) return res.status(400).json({ error: "اكتب كودًا صحيحًا." });
    const item = await AccessCode.findOne({ codeHash: hashCode(code) });
    if (!item) return res.status(404).json({ error: "الكود غير صحيح أو غير موجود." });
    if (item.usedBy) return res.status(409).json({ error: "تم استخدام هذا الكود من قبل." });
    if (item.expiresAt && item.expiresAt < new Date()) return res.status(410).json({ error: "انتهت صلاحية هذا الكود." });
    const course = await Course.findById(item.course);
    if (!course || !course.published) return res.status(404).json({ error: "الكورس غير متاح حاليًا." });
    item.usedBy = req.user._id;
    item.usedAt = new Date();
    await item.save();
    await User.updateOne({ _id: req.user._id }, { $addToSet: { courses: course._id } });
    res.json({ message: "تم تفعيل الكورس بنجاح.", course: publicCourse(course) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "تعذر تفعيل الكود الآن." });
  }
});

app.get("/api/courses/:id", auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course || !course.published) return res.status(404).json({ error: "الكورس غير موجود." });
    const isEnrolled = req.user.role === "admin" || req.user.courses.some(id => id.toString() === course._id.toString());
    if (!isEnrolled) return res.status(403).json({ error: "هذا الكورس يحتاج إلى كود اشتراك مفعّل." });
    res.json({
      ...publicCourse(course),
      lessons: course.lessons.map((l, i) => ({ id: i, title: l.title, videoUrl: l.videoUrl, duration: l.duration }))
    });
  } catch {
    res.status(400).json({ error: "معرّف الكورس غير صحيح." });
  }
});

/* Admin API: protect with an admin account; do not expose .env or admin credentials. */
app.get("/api/admin/courses", auth, adminOnly, async (req, res) => {
  const courses = await Course.find().sort({ createdAt: -1 });
  res.json(courses);
});

app.post("/api/admin/courses", auth, adminOnly, async (req, res) => {
  try {
    const { title, subject, teacher, description, lessons = [] } = req.body || {};
    if (!title || !subject) return res.status(400).json({ error: "اسم الكورس والمادة مطلوبان." });
    if (!Array.isArray(lessons) || lessons.length > 100) return res.status(400).json({ error: "قائمة الدروس غير صحيحة." });
    for (const lesson of lessons) {
      if (!lesson.title || !validVideoUrl(lesson.videoUrl)) return res.status(400).json({ error: "كل درس يحتاج عنوانًا ورابط فيديو YouTube أو Vimeo صحيحًا." });
    }
    const course = await Course.create({ title, subject, teacher, description, lessons });
    res.status(201).json({ course: publicCourse(course) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "تعذر إنشاء الكورس." });
  }
});

app.post("/api/admin/codes", auth, adminOnly, async (req, res) => {
  try {
    const { courseId, count = 1 } = req.body || {};
    const amount = Number(count);
    if (!mongoose.isValidObjectId(courseId) || !await Course.findById(courseId)) return res.status(400).json({ error: "اختار كورسًا صحيحًا." });
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) return res.status(400).json({ error: "عدد الأكواد يجب أن يكون من 1 إلى 100." });
    const codes = [];
    for (let i = 0; i < amount; i++) {
      const code = crypto.randomBytes(8).toString("hex").toUpperCase();
      await AccessCode.create({ codeHash: hashCode(code), course: courseId });
      codes.push(code);
    }
    res.status(201).json({ codes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "تعذر إنشاء الأكواد." });
  }
});

async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) {
    console.warn("ADMIN_EMAIL/ADMIN_PASSWORD not set; admin account will not be created.");
    return;
  }
  if (password.length < 12 || password === "ChangeThisPassword123!") {
    console.warn("Set a unique ADMIN_PASSWORD of at least 12 characters in your environment before production.");
    return;
  }
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name: "مدير المنصة", email, passwordHash: await bcrypt.hash(password, 12), role: "admin"
    });
    console.log("Admin account created:", email);
  } else if (user.role !== "admin") {
    user.role = "admin";
    await user.save();
  }
}

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI in environment.");
  await mongoose.connect(process.env.MONGODB_URI);
  await seedAdmin();
  app.listen(PORT, () => console.log(`StudyHub running on port ${PORT}`));
}
start().catch(err => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});
