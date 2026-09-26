import { FormEvent, useEffect, useRef, useState } from "react";
import { Check, ClipboardList, LogOut, Pencil, Plus, Sparkles, Trash2, UserRound, X } from "lucide-react";
import { BOOKINGS_UPDATED_EVENT, clearLegacyLocalData, getStoredBookings, saveBookings, savePages, type Booking, type MemorialPage } from "@/data/memorial";
import { approveRemoteBooking, deleteRemoteBooking, deleteRemotePage, getRemoteBookings, subscribeToRemoteBookings } from "@/data/supabase";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { supabase } from "@/lib/supabaseClient";

interface AdminDashboardProps { pages: MemorialPage[]; onPagesChange: (pages: MemorialPage[]) => void; }
type Draft = Omit<MemorialPage, "id">;
const emptyPage: Draft = { name: "", image: "", status: "available", instagram: "", facebook: "", tiktok: "", whatsapp: "", city: "كفر الشيخ", bio: "", prediction: "", visionChoice: "", questionTwo: "", questionThree: "", questionFour: "", predictionEra: "next" };
const statusLabels = { new: "جديد", contacted: "تم التواصل", approved: "تم الاعتماد", rejected: "مرفوض" };
const eraLabels = { next: "العصر الحالي", beforeTechnology: "العصر الماضي" };

export default function AdminDashboard({ pages, onPagesChange }: AdminDashboardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"bookings" | "pages">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyPage);
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    const verifyAdmin = async () => {
      if (!supabase) { if (active) setAuthLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (active) setAuthLoading(false); return; }
      const { data: admin, error: adminError } = await supabase.rpc("is_admin");
      if (active) { setAuthenticated(Boolean(admin) && !adminError); setAuthLoading(false); if (adminError || !admin) setError("هذا الحساب ليس ضمن مسؤولي النظام."); }
    };
    void verifyAdmin();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const load = async () => { const currentRequest = ++requestId.current; console.log("[Admin] Loading bookings.", { requestId: currentRequest }); const remote = await getRemoteBookings(); if (active && currentRequest === requestId.current) { setBookings(remote); console.log("[Admin] Bookings state updated.", { count: remote.length }); } };
    const reloadLocal = () => setBookings(getStoredBookings());
    const refresh = () => { if (document.visibilityState === "visible" && isSupabaseConfigured) void load(); };
    if (isSupabaseConfigured) void load(); else reloadLocal();
    const unsubscribe = isSupabaseConfigured ? subscribeToRemoteBookings(() => { console.log("[Admin] bookings Realtime event received."); void load(); }, () => { console.warn("[Admin] bookings Realtime connection issue; refetching."); void load(); }) : () => undefined;
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh); window.addEventListener(BOOKINGS_UPDATED_EVENT, reloadLocal);
    return () => { active = false; unsubscribe(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener(BOOKINGS_UPDATED_EVENT, reloadLocal); };
  }, [authenticated]);

  const login = async (event: FormEvent) => { event.preventDefault(); if (!supabase || !isSupabaseConfigured) { setError("Supabase غير مهيأ."); return; } setError(""); const { error: loginError } = await supabase.auth.signInWithPassword({ email, password }); if (loginError) { setError("البريد الإلكتروني أو كلمة المرور غير صحيحة."); return; } const { data: admin, error: adminError } = await supabase.rpc("is_admin"); if (adminError || !admin) { await supabase.auth.signOut(); setError("هذا الحساب ليس ضمن مسؤولي النظام."); return; } setAuthenticated(true); };
  const approve = async (booking: Booking) => {
    setApprovingId(booking.id); setError("");
    if (isSupabaseConfigured) {
      const result = await approveRemoteBooking(booking.id);
      if (result.error) { setError(`تعذر اعتماد الطلب: ${result.error.message}`); setApprovingId(null); return; }
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "approved" } : item));
      if (booking.page) onPagesChange([...pages.filter((item) => item.id !== booking.page), { id: booking.page, name: booking.name, image: booking.image ?? "", status: "featured", city: "كفر الشيخ", bio: booking.questionFour, prediction: booking.prediction, visionChoice: booking.questionTwo, predictionEra: booking.predictionEra, instagram: booking.instagram, facebook: booking.facebook, tiktok: booking.tiktok, whatsapp: booking.whatsapp }]);
      setApprovingId(null);
      const currentRequest = ++requestId.current;
      void getRemoteBookings().then((remote) => { if (currentRequest === requestId.current) setBookings(remote); });
      return;
    }
    setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "approved" } : item));
    saveBookings(bookings.map((item) => item.id === booking.id ? { ...item, status: "approved" } : item));
    setApprovingId(null);
  };
  const remove = async (booking: Booking) => {
    setDeletingId(booking.id); setError("");
    try {
      if (isSupabaseConfigured) {
        const result = await deleteRemoteBooking(booking.id);
        if (result.error) {
          setError(`تعذر حذف الطلب: ${result.error.message}`);
          return;
        }
      }

      setBookings((current) => current.filter((item) => item.id !== booking.id));
      if (booking.page) {
        const nextPages = pages.filter((item) => item.id !== booking.page);
        onPagesChange(nextPages);
        savePages(nextPages);
      }
    } catch (error) {
      console.error("[Admin] Failed to delete booking from UI.", error);
      setError("حدث خطأ أثناء حذف الطلب، يرجى المحاولة مرة أخرى.");
    } finally {
      setDeletingId(null);
      const currentRequest = ++requestId.current;
      if (isSupabaseConfigured) {
        void getRemoteBookings().then((remote) => { if (currentRequest === requestId.current) setBookings(remote.filter((item) => item.id !== booking.id)); });
      }
    }
  };
  const editPage = (page?: MemorialPage) => { setEditingId(page?.id ?? null); setDraft(page ? { ...page } : emptyPage); setOpen(true); };
  const savePage = (event: FormEvent) => { event.preventDefault(); if (!draft.name.trim() || !draft.prediction?.trim()) return; const id = editingId ?? Math.max(0, ...pages.map((item) => item.id)) + 1; const fixedDraft = { ...draft, city: "كفر الشيخ" }; onPagesChange(editingId ? pages.map((item) => item.id === editingId ? { ...fixedDraft, id } : item) : [...pages, { ...fixedDraft, id }]); setOpen(false); };
  const removePage = async (id: number) => {
    if (!window.confirm("هل تريد حذف هذه الصفحة؟")) return;
    setDeletingId(`page-${id}`); setError("");
    console.log("[Admin] removePage invoked.", {
      pageId: id,
      table: "pages",
      matchColumn: "page_number",
      isSupabaseConfigured,
    });

    try {
      if (isSupabaseConfigured) {
        const result = await deleteRemotePage(id);
        if (result.error) {
          setError(`تعذر حذف الصفحة: ${result.error.message}`);
          return;
        }
      }

      const nextPages = pages.filter((page) => page.id !== id);
      onPagesChange(nextPages);
      savePages(nextPages);
    } catch (error) {
      console.error("[Admin] Failed to delete page from UI.", error);
      setError("حدث خطأ أثناء حذف الصفحة، يرجى المحاولة مرة أخرى.");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) return <main dir="rtl" className="admin-shell flex min-h-screen items-center justify-center px-4"><div className="admin-login w-full max-w-md"><p>جارٍ التحقق من صلاحيات الدخول…</p></div></main>;
  if (!authenticated) return <main dir="rtl" className="admin-shell flex min-h-screen items-center justify-center px-4"><form onSubmit={login} className="admin-login w-full max-w-md"><div className="admin-emblem"><Sparkles /></div><h1>إدارة جيل 2026</h1><p>سجّل الدخول بحساب المسؤول.</p><input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="البريد الإلكتروني" autoComplete="email" /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="كلمة المرور" autoComplete="current-password" />{error && <strong className="admin-error">{error}</strong>}<button className="admin-primary"><Check /> دخول آمن</button></form></main>;
  return <main dir="rtl" className="admin-shell min-h-screen px-4 py-8 md:px-8"><div className="mx-auto max-w-6xl"><header className="admin-header"><div className="flex items-center gap-3"><div className="admin-emblem small"><Sparkles /></div><div><span>جيل 2026</span><h1>مركز إدارة الكتاب</h1></div></div><button onClick={() => { void supabase?.auth.signOut(); setAuthenticated(false); }} className="admin-secondary"><LogOut /> خروج</button></header>{error && <p className="admin-error">{error}</p>}<div className="admin-tabs"><button className={tab === "bookings" ? "active" : ""} onClick={() => setTab("bookings")}><ClipboardList /> طلبات الحجز <b>{bookings.filter((item) => item.status === "new").length}</b></button><button className={tab === "pages" ? "active" : ""} onClick={() => setTab("pages")}><UserRound /> صفحات الكتاب <b>{pages.length}</b></button></div>{tab === "bookings" ? <Bookings bookings={bookings} onApprove={approve} onDelete={remove} approvingId={approvingId} deletingId={deletingId} /> : <Pages pages={pages} open={open} draft={draft} editingId={editingId} onNew={() => editPage()} onEdit={editPage} onDelete={removePage} onClose={() => setOpen(false)} onSave={savePage} onField={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} />}</div></main>;
}

function Bookings({ bookings, onApprove, onDelete, approvingId, deletingId }: { bookings: Booking[]; onApprove: (booking: Booking) => void; onDelete: (booking: Booking) => void; approvingId: string | null; deletingId: string | null }) {
  return <section className="admin-content"><div className="admin-section-heading"><div><span>صندوق الاستقبال</span><h2>طلبات الحجز</h2></div><small>{bookings.length} طلب محفوظ</small></div>{bookings.length === 0 ? <div className="admin-empty"><ClipboardList /><h3>لا توجد حجوزات بعد</h3><p>ستظهر هنا كل الطلبات التي يرسلها المشتركون.</p></div> : <div className="booking-list">{bookings.map((booking) => <article className="booking-card" key={booking.id}><div className="booking-card-top"><div><span className="booking-date">{new Date(booking.createdAt).toLocaleString("ar-EG")}</span><h3>{booking.name}</h3></div><span className={`booking-status status-${booking.status}`}>{statusLabels[booking.status as keyof typeof statusLabels] ?? booking.status}</span></div><div className="booking-details">{booking.image && <img className="booking-person-image" src={booking.image} alt={`صورة ${booking.name}`} />}<span>رقم الصفحة: {booking.page ?? "غير محدد"}</span><span>المدينة: {booking.city || "غير مضافة"}</span><span>واتساب: {booking.whatsapp || "غير مضاف"}</span><span>إنستجرام: {booking.instagram || "غير مضاف"}</span><span>العصر المختار: {eraLabels[booking.predictionEra] ?? "غير محدد"}</span><span>طريقة الدفع: {booking.paymentMethod === "vodafone" ? "كاش" : booking.paymentMethod === "instapay" ? "إنستا باي" : "غير محددة"}</span><span>الرقم المرسل منه: {booking.paymentSender || "غير مضاف"}</span><span>الرقم المرسل إليه: {booking.paymentRecipient || "غير مضاف"}</span><span>رؤية شكل العالم: {booking.questionTwo || "غير مضافة"}</span><span>رؤية المستقبل: {booking.questionThree || booking.prediction || "غير مضافة"}</span><p>رؤية صاحب الصفحة: «{booking.prediction || "غير مضافة"}»</p><p>رسالة القارئ: «{booking.questionFour || "غير مضافة"}»</p><p>الإجابة عن سؤال العالم: «{booking.questionTwo || "غير مضافة"}»</p></div><div className="booking-actions">{booking.status !== "approved" && <button className="admin-primary" disabled={Boolean(approvingId || deletingId)} onClick={() => onApprove(booking)}><Check /> {approvingId === booking.id ? "جارٍ الاعتماد…" : "اعتماد وتخصيص صفحة"}</button>}<button className="admin-danger" disabled={Boolean(approvingId || deletingId)} onClick={() => onDelete(booking)}><Trash2 /> {deletingId === booking.id ? "جارٍ الحذف…" : "حذف"}</button></div></article>)}</div>}</section>;
}

function Pages({ pages, open, draft, editingId, onNew, onEdit, onDelete, onClose, onSave, onField }: { pages: MemorialPage[]; open: boolean; draft: Draft; editingId: number | null; onNew: () => void; onEdit: (page: MemorialPage) => void; onDelete: (id: number) => void; onClose: () => void; onSave: (event: FormEvent) => void; onField: (key: keyof Draft, value: string) => void }) {
  return <section className="admin-content"><div className="admin-section-heading"><div><span>الأرشيف العام</span><h2>صفحات الكتاب</h2></div><button className="admin-primary" onClick={onNew}><Plus /> صفحة جديدة</button></div><div className="admin-stats"><div><small>صفحات مكتملة</small><b>{pages.length}</b></div><div><small>صفحات متاحة</small><b>{1000 - pages.length}</b></div><div><small>رؤى محفوظة</small><b>{pages.filter((page) => page.prediction).length}</b></div></div>{open && <form onSubmit={onSave} className="admin-form"><div className="admin-form-heading"><div><span>ملف مشترك</span><h2>{editingId ? "تعديل الصفحة" : "إنشاء صفحة"}</h2></div><button type="button" onClick={onClose}><X /></button></div><div className="admin-grid"><label>الاسم<input value={draft.name} onChange={(event) => onField("name", event.target.value)} required /></label><label>الحالة<select value={draft.status} onChange={(event) => onField("status", event.target.value)}><option value="available">متاحة</option><option value="pending">قيد المراجعة</option><option value="featured">مميزة</option></select></label><label>المدينة<input value={draft.city ?? ""} onChange={(event) => onField("city", event.target.value)} /></label><label>العصر<select value={draft.predictionEra ?? "next"} onChange={(event) => onField("predictionEra", event.target.value)}><option value="next">العصر الحالي</option><option value="beforeTechnology">العصر الماضي</option></select></label><label>رابط الصورة<input value={draft.image} onChange={(event) => onField("image", event.target.value)} /></label><label>إنستجرام<input value={draft.instagram} onChange={(event) => onField("instagram", event.target.value)} /></label><label>واتساب<input value={draft.whatsapp} onChange={(event) => onField("whatsapp", event.target.value)} required /></label><label>رؤية شكل العالم<textarea value={draft.visionChoice ?? ""} onChange={(event) => onField("visionChoice", event.target.value)} /></label><label>نبذة شخصية<textarea value={draft.bio ?? ""} onChange={(event) => onField("bio", event.target.value)} /></label><label>رؤية العصر الحالي<textarea value={draft.prediction ?? ""} onChange={(event) => onField("prediction", event.target.value)} required /></label><label>المحور الأساسي في المستقبل<textarea value={draft.questionTwo ?? ""} onChange={(event) => onField("questionTwo", event.target.value)} /></label><label>رؤية المستقبل<textarea value={draft.questionThree ?? ""} onChange={(event) => onField("questionThree", event.target.value)} /></label><label>وجهة النظر في التكنولوجيا<textarea value={draft.questionFour ?? ""} onChange={(event) => onField("questionFour", event.target.value)} /></label></div><button className="admin-primary"><Check /> حفظ الصفحة</button></form>}<div className="page-admin-list">{pages.map((page) => <article className="page-admin-card" key={page.id}><div className="page-admin-header"><div><span className="page-number-badge">صفحة {page.id}</span><h3>{page.name || "غير مسمى"}</h3></div><span className={`page-status-badge status-${page.status}`}>{page.status === "pending" ? "قيد المراجعة" : page.status === "featured" ? "مميزة" : "متاحة"}</span></div><div className="page-admin-meta"><span>{page.city || "بدون مدينة"}</span><span>{page.instagram || "بدون إنستجرام"}</span><span>{page.whatsapp || "بدون واتساب"}</span></div><p className="page-admin-summary">{page.prediction || page.bio || "لا توجد رؤية مكتوبة بعد."}</p><div className="page-admin-actions"><button onClick={() => onEdit(page)} aria-label="تعديل"><Pencil /></button><button onClick={() => onDelete(page.id)} aria-label="حذف"><Trash2 /></button></div></article>)}</div></section>;
}
