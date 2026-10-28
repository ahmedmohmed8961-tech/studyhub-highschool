const $ = (s) => document.querySelector(s);
const state = { token: localStorage.getItem("studyhub_token") || "", user: null, authMode: "login", courses: [] };
const subjectIcons = { "اللغة العربية":"📚", "اللغة الإنجليزية":"🇬🇧", "الرياضيات":"📐", "الفيزياء":"⚡", "الكيمياء":"🧪", "الأحياء":"🧬", "التاريخ":"🏛️", "الجغرافيا":"🌍" };
const colors = ["#2457d6", "#6c3fc4", "#087f8c", "#b35a1e", "#27744e", "#8e3e76"];
function esc(v="") { return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function api(path, options={}) {
  const headers = { "Content-Type":"application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "حصل خطأ غير متوقع.");
  return data;
}
function message(el, text, error=false) { el.textContent = text; el.classList.toggle("error", error); }
function setLoggedIn(user) {
  state.user = user;
  $("#accountArea").innerHTML = user
    ? `<span class="user-label">أهلاً، ${esc(user.name)}</span><button class="button secondary" id="logoutBtn">خروج</button>`
    : `<button class="button secondary" id="showLogin">دخول / حساب جديد</button>`;
  $("#logoutBtn")?.addEventListener("click", logout);
  $("#showLogin")?.addEventListener("click", openAuth);
  $("#adminPanel").hidden = user?.role !== "admin";
}
function logout() {
  state.token = ""; state.user = null;
  localStorage.removeItem("studyhub_token");
  setLoggedIn(null); $("#myCourses").innerHTML = '<div class="muted">سجّل الدخول لعرض كورساتك.</div>';
  $("#redeemMessage").textContent = ""; loadCourses();
}
function openAuth() { $("#authMessage").textContent = ""; $("#authDialog").showModal(); }
function chooseAuthMode(mode) {
  state.authMode = mode;
  $("#loginTab").classList.toggle("active", mode === "login");
  $("#registerTab").classList.toggle("active", mode === "register");
  $("#nameField").hidden = mode !== "register";
  $("#authName").required = mode === "register";
  $("#authTitle").textContent = mode === "login" ? "أهلاً بعودتك" : "حساب طالب جديد";
  $("#authSubtitle").textContent = mode === "login" ? "سجّل دخولك لمتابعة كورساتك" : "أنشئ حسابك وابدأ رحلتك";
  $("#authSubmit").textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب";
  $("#authPassword").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("#authMessage").textContent = "";
}
async function loadCourses() {
  const grid = $("#courseGrid");
  try {
    state.courses = await api("/api/courses");
    if (!state.courses.length) {
      grid.innerHTML = '<div class="empty">لسه مفيش كورسات منشورة. المسؤول يقدر يضيف كورسات من خلال واجهة الإدارة.</div>';
      return;
    }
    grid.innerHTML = state.courses.map((c, i) => `
      <article class="course-card">
        <div class="course-cover" style="--cover:${esc(c.coverColor || colors[i % colors.length])}">
          <span>${subjectIcons[c.subject] || "🎓"}</span><span>${c.lessonCount} درس</span>
        </div>
        <div class="course-info"><h3>${esc(c.title)}</h3><p>${esc(c.description || `كورس ${c.subject} للثانوية العامة`)}</p>
          <div class="course-meta"><span>${esc(c.teacher || "فريق المنصة")}</span><button class="button small" data-course="${esc(c.id)}">عرض الكورس</button></div>
        </div>
      </article>`).join("");
    grid.querySelectorAll("[data-course]").forEach(btn => btn.addEventListener("click", () => openCourse(btn.dataset.course)));
  } catch (e) { grid.innerHTML = `<div class="empty">${esc(e.message)}<br>تأكد من إعداد قاعدة البيانات وتشغيل السيرفر.</div>`; }
}
async function refreshMe() {
  if (!state.token) return;
  try {
    const data = await api("/api/me");
    setLoggedIn(data.user);
    $("#myCourses").innerHTML = data.courses.length ? data.courses.map(c => `
      <div class="my-course"><span>${esc(c.title)}</span><button class="button small" data-enrolled="${esc(c.id)}">ابدأ المذاكرة</button></div>`).join("") : '<div class="muted">لسه مفعّلتش أي كورس. استخدم كود الاشتراك.</div>';
    $("#myCourses").querySelectorAll("[data-enrolled]").forEach(b => b.addEventListener("click", () => openCourse(b.dataset.enrolled)));
  } catch { logout(); }
}
async function openCourse(id) {
  if (!state.token) { openAuth(); message($("#authMessage"), "سجّل الدخول أولاً عشان تفتح الكورس.", true); return; }
  try {
    const course = await api(`/api/courses/${encodeURIComponent(id)}`);
    $("#lessonPanel").hidden = false;
    $("#lessonCourseTitle").textContent = course.title;
    $("#videoWrap").hidden = true; $("#videoFrame").innerHTML = "";
    $("#lessonList").innerHTML = course.lessons.length ? course.lessons.map(l => `
      <div class="lesson-row"><div><strong>${esc(l.title)}</strong><div class="muted">${esc(l.duration || "محاضرة فيديو")}</div></div><button class="button small" data-video="${l.id}">مشاهدة</button></div>`).join("") : '<div class="empty">لا توجد دروس مضافة لهذا الكورس حتى الآن.</div>';
    $("#lessonList").querySelectorAll("[data-video]").forEach(b => b.addEventListener("click", () => {
      const lesson = course.lessons.find(l => l.id === Number(b.dataset.video));
      const embed = toEmbedUrl(lesson.videoUrl);
      if (!embed) { alert("الرابط غير مدعوم. استخدم YouTube أو Vimeo."); return; }
      $("#videoFrame").innerHTML = `<iframe src="${esc(embed)}" title="${esc(lesson.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
      $("#videoWrap").hidden = false;
      $("#videoWrap").scrollIntoView({ behavior:"smooth", block:"start" });
    }));
    $("#lessonPanel").scrollIntoView({ behavior:"smooth", block:"start" });
  } catch (e) { alert(e.message); }
}
function toEmbedUrl(raw) {
  try {
    const u = new URL(raw);
    if (["youtube.com","www.youtube.com"].includes(u.hostname)) {
      if (u.pathname === "/watch" && u.searchParams.get("v")) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.searchParams.get("v"))}`;
      if (u.pathname.startsWith("/embed/")) return `https://www.youtube-nocookie.com${u.pathname}`;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.split("/")[2])}`;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}`;
    if (u.hostname === "player.vimeo.com" && u.pathname.startsWith("/video/")) return u.href;
    if (u.hostname === "vimeo.com") return `https://player.vimeo.com/video/${encodeURIComponent(u.pathname.split("/").filter(Boolean)[0])}`;
  } catch {}
  return "";
}
$("#showLogin").addEventListener("click", openAuth);
$("#loginTab").addEventListener("click", () => chooseAuthMode("login"));
$("#registerTab").addEventListener("click", () => chooseAuthMode("register"));
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const mode = state.authMode;
  const body = { email: $("#authEmail").value, password: $("#authPassword").value };
  if (mode === "register") body.name = $("#authName").value;
  try {
    const data = await api(`/api/auth/${mode === "login" ? "login" : "register"}`, { method:"POST", body:JSON.stringify(body) });
    state.token = data.token; localStorage.setItem("studyhub_token", data.token);
    setLoggedIn(data.user); $("#authDialog").close(); e.target.reset();
    await refreshMe();
  } catch (err) { message($("#authMessage"), err.message, true); }
});
$("#redeemForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!state.token) { openAuth(); message($("#authMessage"), "سجّل الدخول أولاً لتفعيل الكود.", true); return; }
  try {
    const data = await api("/api/codes/redeem", { method:"POST", body:JSON.stringify({ code:$("#redeemCode").value }) });
    message($("#redeemMessage"), data.message);
    $("#redeemCode").value = "";
    await refreshMe(); await loadCourses();
  } catch (err) { message($("#redeemMessage"), err.message, true); }
});
$("#refreshCourses").addEventListener("click", loadCourses);
$("#closeLesson").addEventListener("click", () => { $("#lessonPanel").hidden = true; $("#videoFrame").innerHTML = ""; });
$("#adminCourses").addEventListener("click", async () => {
  try { const d = await api("/api/admin/courses"); $("#adminOutput").textContent = JSON.stringify(d, null, 2); }
  catch (e) { $("#adminOutput").textContent = e.message; }
});
$("#adminCodes").addEventListener("click", async () => {
  const courseId = prompt("أدخل معرّف الكورس (Course ID) من نتيجة عرض الكورسات:");
  if (!courseId) return;
  const count = Number(prompt("عدد الأكواد المطلوبة (1 إلى 100):", "10"));
  try {
    const d = await api("/api/admin/codes", { method:"POST", body:JSON.stringify({ courseId, count }) });
    $("#adminOutput").textContent = "احتفظ بالأكواد في مكان آمن؛ لن نعرضها مرة أخرى تلقائيًا.\n\n" + d.codes.join("\n");
  } catch (e) { $("#adminOutput").textContent = e.message; }
});
$("#year").textContent = new Date().getFullYear();
$("#footerBrand").textContent = $("#brandName").textContent;
(async () => {
  chooseAuthMode("login");
  await loadCourses();
  if (state.token) await refreshMe();
})();
