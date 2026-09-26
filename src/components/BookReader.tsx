import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Crown, Instagram, MapPin, Menu, MessageCircle, Search, Sparkles, X } from "lucide-react";
import BookingExperience from "./BookingExperience";
import { getStoredBookings, MEMORIAL_LIMIT, type MemorialPage, type PredictionEra } from "@/data/memorial";
import { castPageVote, getPageVotes, subscribeToPageVotes } from "@/data/supabase";

interface BookReaderProps { pages: MemorialPage[]; }
interface ProfilePage { number: number; person?: MemorialPage; }
const pageNumber = (value: number) => value.toLocaleString("ar-EG", { minimumIntegerDigits: 3, useGrouping: false });
const eraLabels: Record<PredictionEra, string> = { next: "العصر الحالي", beforeTechnology: "العصر الماضي" };
const INTRO_PAGE = 1;
const FIRST_NAME_PAGE = 2;
const BACK_COVER_PAGE = MEMORIAL_LIMIT + FIRST_NAME_PAGE;
const FINAL_COVER_PAGE = BACK_COVER_PAGE + 1;
const instagramUrl = (value: string) => value.trim().startsWith("http") ? value.trim() : `https://instagram.com/${value.trim().replace(/^@/, "")}`;
const facebookUrl = (value: string) => value.trim().startsWith("http") ? value.trim() : `https://facebook.com/${value.trim().replace(/^@/, "")}`;
const tiktokUrl = (value: string) => value.trim().startsWith("http") ? value.trim() : `https://tiktok.com/@${value.trim().replace(/^@/, "")}`;
const pageUrl = (pageNumber: number) => { const url = new URL(window.location.origin); url.searchParams.set("page", String(pageNumber)); return url.toString(); };

export default function BookReader({ pages: entries }: BookReaderProps) {
  const [page, setPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [entered, setEntered] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingPage, setBookingPage] = useState<number>();
  const [searchMessage, setSearchMessage] = useState("");
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [, refreshBookings] = useState(0);
  const pages = useMemo<ProfilePage[]>(() => Array.from({ length: MEMORIAL_LIMIT }, (_, index) => ({ number: index + 1, person: entries.find((entry) => entry.id === index + 1) })), [entries]);
  const namePage = page - FIRST_NAME_PAGE + 1;
  const current = pages[namePage - 1];
  const pendingBooking = page >= FIRST_NAME_PAGE && page < BACK_COVER_PAGE ? getStoredBookings().find((booking) => booking.page === namePage && booking.status !== "approved" && booking.status !== "rejected") : undefined;
  const pageIsPending = current?.person?.status === "pending" || Boolean(pendingBooking);
  const remaining = Math.max(0, MEMORIAL_LIMIT - entries.filter((entry) => entry.status !== "pending").length);
  const goTo = useCallback((next: number) => setPage(Math.max(0, Math.min(FINAL_COVER_PAGE, next))), []);
  const readerStatus = page === 0 ? "الغلاف" : page === INTRO_PAGE ? "المقدمة" : page === BACK_COVER_PAGE ? "الخاتمة" : page === FINAL_COVER_PAGE ? "غلاف النهاية" : `صفحة ${namePage.toLocaleString("ar-EG")} من ${MEMORIAL_LIMIT.toLocaleString("ar-EG")}`;
  const whatsapp = (number: string, name: string) => { const digits = number.replace(/\D/g, ""); const international = digits.startsWith("20") ? digits : digits.startsWith("0") ? `20${digits.slice(1)}` : `20${digits}`; return `https://wa.me/${international}?text=${encodeURIComponent(`أرغب في معرفة المزيد عن ${name} من كتاب جيل 2026`)}`; };
  const jumpToSearch = () => { const query = search.trim(); if (!query) { setSearchMessage("اكتب اسمًا أو رقم صفحة للبحث."); return; } const pageQuery = Number(query.replace(/[^0-9]/g, "")); const result = entries.find((entry) => entry.name.includes(query) || entry.instagram.toLowerCase().includes(query.toLowerCase())); if (pageQuery >= 1 && pageQuery <= MEMORIAL_LIMIT) { goTo(pageQuery + FIRST_NAME_PAGE - 1); setMenuOpen(false); return; } if (result) { goTo(result.id + FIRST_NAME_PAGE - 1); setMenuOpen(false); } else setSearchMessage("لم نعثر على صفحة بهذا الاسم بعد."); };
  useEffect(() => { const query = Number(new URLSearchParams(window.location.search).get("page")); const internalQuery = query >= 2 && query <= MEMORIAL_LIMIT ? query + FIRST_NAME_PAGE - 1 : query; if (internalQuery >= 0 && internalQuery <= FINAL_COVER_PAGE) { setPage(internalQuery); if (query >= 1 && query <= MEMORIAL_LIMIT) setEntered(true); } }, []);
  useEffect(() => { localStorage.setItem("memorial-last-page", String(page)); const publicPage = page >= FIRST_NAME_PAGE && page < BACK_COVER_PAGE ? namePage : page; const url = new URL(window.location.href); url.searchParams.set("page", String(publicPage)); window.history.replaceState({}, "", url); }, [page, namePage]);
  useEffect(() => { const refresh = () => refreshBookings((value) => value + 1); window.addEventListener("generation-2026-bookings-updated", refresh); window.addEventListener("storage", refresh); return () => { window.removeEventListener("generation-2026-bookings-updated", refresh); window.removeEventListener("storage", refresh); }; }, []);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "ArrowLeft") goTo(page + 1); if (event.key === "ArrowRight") goTo(page - 1); if (event.key === "Escape") { setMenuOpen(false); setBookingOpen(false); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [page, goTo]);
  useEffect(() => { document.body.style.overflow = !entered || bookingOpen ? "hidden" : "auto"; return () => { document.body.style.overflow = "auto"; }; }, [entered, bookingOpen]);
  return <main className="reader-shell" dir="rtl">
    {!entered && <div className="book-opening"><div className="opening-seal"><Sparkles /></div><span className="opening-kicker">السجل الرسمي · جيل 2026</span><h1>جيل 2026</h1><p>كتاب يحفظ كيف رأى جيل كامل العالم والمستقبل، لا أسماءه فقط.</p><button onClick={() => { setPage(INTRO_PAGE); setEntered(true); }}>افتح الكتاب <ArrowLeft /></button><button className="opening-skip" onClick={() => { setPage(FIRST_NAME_PAGE); setEntered(true); }}>تخطي المقدمة</button><small>إصدار 2026</small></div>}
    <header className="reader-topbar"><a href="#reader" className="reader-brand"><span><Sparkles className="h-4 w-4" /></span><div><b>جيل 2026</b><small>الكتاب المخلد</small></div></a><div className="reader-topbar-center"><div className="reader-scarcity"><div className="scarcity-label"><span className="scarcity-pulse" /><span>المقاعد المتبقية</span></div><strong>{remaining.toLocaleString("ar-EG")}</strong><small>من {MEMORIAL_LIMIT.toLocaleString("ar-EG")}</small><i><em style={{ width: `${(remaining / MEMORIAL_LIMIT) * 100}%` }} /></i></div><div className="reader-status"><BookOpen className="h-4 w-4" /><span>{readerStatus}</span></div></div><div className="reader-tools"><button className="reader-close-button" onClick={() => setEntered(false)} aria-label="العودة إلى الغلاف"><X /><span>الغلاف</span></button><button onClick={() => setMenuOpen(!menuOpen)} aria-label="فتح الفهرس">{menuOpen ? <X /> : <Menu />}</button></div></header>
    {menuOpen && <aside className="reader-menu" aria-label="فهرس الكتاب"><div className="menu-heading"><div><b>فهرس الأسماء</b><small>ابحث بالاسم أو رقم الصفحة</small></div><button onClick={() => setMenuOpen(false)} aria-label="إغلاق الفهرس"><X /></button></div><div className="menu-search"><Search /><input inputMode="search" value={search} onChange={(event) => { setSearch(event.target.value); setSearchMessage(""); }} onKeyDown={(event) => event.key === "Enter" && jumpToSearch()} placeholder="اسم أو رقم الصفحة مثل 27" aria-label="البحث في صفحات الكتاب" /><button onClick={jumpToSearch}>بحث</button></div>{searchMessage && <p className="search-message" role="status">{searchMessage}</p>}<div className="page-jump"><span>اذهب إلى صفحة</span><div>{[1, 2, 3, 100, 250, 500, 750, 1000].map((number) => <button key={number} onClick={() => { goTo(number + FIRST_NAME_PAGE - 1); setMenuOpen(false); }}>{number}</button>)}</div></div><p className="menu-note">الغلاف والمقدمة يسبقان الترقيم. كل صفحة أخرى تنتظر اسمًا جديدًا.</p></aside>}
    <section id="reader" className="reader-stage" onTouchStart={(event) => { const touch = event.touches[0]; setTouchStart({ x: touch.clientX, y: touch.clientY }); }} onTouchEnd={(event) => { if (touchStart === null) { setTouchStart(null); return; } const touch = event.changedTouches[0]; const distanceX = touch.clientX - touchStart.x; const distanceY = touch.clientY - touchStart.y; if (Math.abs(distanceX) > 40 && Math.abs(distanceX) > Math.abs(distanceY) * 1.1) goTo(page + (distanceX > 0 ? 1 : -1)); setTouchStart(null); }}><div className="book-page profile-book-page"><div className="page-inner"><div className="page-topline"><span>جيل 2026 · سجل الأسماء</span><strong>{page === 0 ? "غلاف" : page === INTRO_PAGE ? "مقدمة" : page === BACK_COVER_PAGE ? "الخاتمة" : page === FINAL_COVER_PAGE ? "غلاف النهاية" : pageNumber(namePage)}</strong></div>{page === 0 ? <FrontCover /> : page === INTRO_PAGE ? <BookIntroduction /> : page === BACK_COVER_PAGE ? <BackCover /> : page === FINAL_COVER_PAGE ? <FinalCover /> : pageIsPending ? <PendingProfile page={namePage} /> : current.person ? <Profile person={current.person} whatsapp={whatsapp} /> : <EmptyProfile page={namePage} onBook={() => { setBookingPage(namePage); setBookingOpen(true); }} />}<div className="page-footer"><span>صفحة {page === INTRO_PAGE ? "مقدمة" : page === BACK_COVER_PAGE ? "الخاتمة" : page === FINAL_COVER_PAGE ? "غلاف النهاية" : pageNumber(Math.max(1, namePage))}</span><strong className="footer-signature">{page === FINAL_COVER_PAGE ? "جيل 2026" : current?.person?.name || pendingBooking?.name || "جيل 2026"}</strong></div></div></div><div className="reader-controls"><button onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="الصفحة السابقة"><ArrowRight /></button><div className="reader-progress"><span style={{ width: `${(page / FINAL_COVER_PAGE) * 100}%` }} /></div><button onClick={() => goTo(page + 1)} disabled={page === FINAL_COVER_PAGE} aria-label="الصفحة التالية"><ArrowLeft /></button></div><div className="reader-hint">اسحب إلى اليمين للصفحة التالية، وإلى اليسار للعودة</div><button className="inner-glow-btn" type="button" onClick={() => { setBookingPage(undefined); setBookingOpen(true); }}><span className="inner-glow-btn__text">اترك بصمتك</span><span className="inner-glow-btn__icon-wrapper"><svg className="inner-glow-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg></span></button></section>
    <section className="manifesto-section" id="manifesto"><div className="section-eyebrow"><Crown /> البيان التأسيسي</div><h2>نحن لا نكتب أسماءً.<br /><span>نحن نثبت حضور جيل 2026.</span></h2><p>هذا السجل مفتوح لكل من عاصر جيل 2026: شابًا كان أو كبيرًا، من وُلد في زمن التقنية أو عاش ما قبلها. المهم أنك كنت حاضرًا في هذه اللحظة وتركت رأيًا يستحق أن يُقرأ.</p><div className="manifesto-signature">جيل 2026 <span>·</span> سجل كل من عاصر الحكاية</div></section>
    <section className="ownership-section" id="ownership"><div className="ownership-heading"><div className="section-eyebrow"><Sparkles /> مكانك يستحق أن يُرى</div><h2>اكتب اسمك في الصفحة<br /><span>التي سيتذكرها الجميع</span></h2><p>حجز الصفحة ليس شراء مساحة فقط. إنه امتلاك حضور موثق داخل أرشيف جيل 2026.</p></div><div className="ownership-grid"><OwnershipItem icon={<Crown />} title="صك ملكية رقمي" text="صفحة مرقمة باسمك داخل السجل الرسمي، لا تتكرر لشخص آخر." /><OwnershipItem icon={<BookOpen />} title="أرشيف لا ينسى" text="اسمك محفوظ داخل كتاب رقمي مصمم ليبقى قابلًا للقراءة والرجوع." /><OwnershipItem icon={<Check />} title="رؤيتك للعصر القادم" text="رؤيتك تصبح جزءًا من صفحة تحمل اسمك داخل الكتاب." /><OwnershipItem icon={<Sparkles />} title="نسخة فيزيائية" text="يظهر اسمك ضمن النسخة المطبوعة الرسمية عند اكتمال الإصدار." /></div></section>
    <footer className="reader-footer"><span>جيل 2026 · الكتاب المخلد</span><button onClick={() => { setBookingPage(undefined); setBookingOpen(true); }}>ثبّت حضورك</button></footer>{bookingOpen && <BookingExperience page={bookingPage} onClose={() => setBookingOpen(false)} />}
  </main>;
}

function OwnershipItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <article className="ownership-item"><span className="ownership-icon">{icon}</span><div><h3>{title}</h3><p>{text}</p></div></article>; }
function FrontCover() { return <div className="front-cover"><div className="back-cover-seal"><Sparkles /></div><span>السجل الرسمي</span><h1>جيل 2026</h1><span className="cover-location">(محافظة كفر الشيخ)</span><p>ألف صفحة، ألف صوت، وأثر واحد لا يتكرر.</p><small>إصدار 2026</small></div>; }
function BookIntroduction() { return <div className="book-introduction"><div className="section-eyebrow"><BookOpen /> مقدمة الكتاب</div><h2>رسالة من جيلنا</h2><p>بعد سنوات طويلة من الآن، ستتغير أشياء كثيرة. ستتغير التكنولوجيا، والمدن، وطريقة العمل، وربما الطريقة التي نعيش ونتواصل بها.</p><p>لكن سيبقى سؤال واحد مهم: <strong>كيف كان يفكر الناس في عام 2026؟</strong> ماذا كانوا يحلمون؟ ما الذي كانوا يخافون منه؟ وما الذي كانوا يؤمنون بإمكانية حدوثه؟</p><p>لهذا وُلد كتاب جيل 2026. ليس ليجمع أسماءً فقط، بل ليحفظ صورة كاملة عن جيل عاش واحدة من أكثر اللحظات تغيرًا في التاريخ الحديث. كل صفحة شهادة على وجود شخص، وكل إجابة جزء من صورة أكبر تتكوّن مع مرور الوقت.</p><p>ربما يقرأ هذا الكتاب شخص بعد عشرين عامًا، فيبتسم أمام حلم تحقق، أو يندهش من فكرة أصبحت واقعًا، أو يتساءل كيف كنا نرى المستقبل ونحن نعيش بدايته.</p><strong>لهذا نحن لا نكتب للحاضر فقط.<br />نحن نترك شيئًا للمستقبل.</strong><p>ربما يأتي يوم يفتح فيه أحدهم هذا الكتاب، لا ليبحث عن اسم… بل ليعرف كيف كان جيل 2026 يرى العالم.</p></div>; }
function BackCover() { return <div className="back-cover closing-page"><div className="back-cover-seal"><Sparkles /></div><span>خاتمة جيل 2026</span><h1>الأثر لا ينتهي هنا</h1><p>يظل هذا الكتاب محاولة واعية لالتقاط صورة حقيقية لجيل يعيش على حافة التحول. لن تكون هذه الصفحات مجرد سرد لأفكار عابرة، بل ستكون مرجعًا هادئًا لمن أراد يوماً أن يفهم كيف فكر إنسان 2026، وكيف واجه صراعاً مبكراً بين سرعة التقنية وحنينه الدائم إلى إنسانيته.</p><p>لقد حاولنا هنا أن نضع الأصبع على النبض الحقيقي للشارع والعقل البشري في هذه اللحظة من التاريخ. نترك هذا الأثر بين يدي القارئ، ليس لندعوه لشيء، بل لندعوه فقط أن يتأمل.. أين نقف الآن، وإلى أين نحن مقتبسون.</p><strong>يظل هذا الكتاب شهادة على لحظة كانت فيها التقنية أسرع من الإنسان، والإنسان أعمق من كل محرك.</strong><small>شكرًا لأنك كنت جزءًا من الحكاية.</small></div>; }
function FinalCover() { return <div className="front-cover final-cover"><div className="back-cover-seal"><Sparkles /></div><span>غلاف النهاية</span><h1>جيل 2026</h1><p>كتابٌ يترك أثرًا في القلوب، ويصير جزءًا من ذاكرة جيلٍ اختار أن يبقى.</p><small>انتهى السجل الرسمي · نسخة 2026</small></div>; }

function Profile({ person, whatsapp }: { person: MemorialPage; whatsapp: (number: string, name: string) => string }) {
  const instagram = instagramUrl(person.instagram);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(pageUrl(person.id))}`;
  const [votes, setVotes] = useState({ agree: person.agreeVotes ?? 0, disagree: person.disagreeVotes ?? 0 });
  const [voted, setVoted] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    let active = true;

    const syncVotes = async () => {
      try {
        const remoteVotes = await getPageVotes(person.id);
        if (active) setVotes(remoteVotes);
      } catch (error) {
        console.error(`[Votes] Unable to fetch counts for page ${person.id}:`, error);
      }
    };

    void syncVotes();

    const unsubscribe = subscribeToPageVotes(person.id, (remoteVotes) => {
      if (active) setVotes(remoteVotes);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [person.id]);

  useEffect(() => {
    const links = document.querySelector<HTMLElement>(".profile-links");
    if (!links) return;
    const instagramButton = links.querySelector<HTMLElement>(".Btn:first-child");
    const missingAccount = (platform: string) => window.alert(`لم يضف هذا الشخص حساب ${platform}.`);
    const instagramClick = (event: Event) => { if (!person.instagram.trim()) { event.preventDefault(); missingAccount("Instagram"); } };
    instagramButton?.addEventListener("click", instagramClick);
    const createdButtons: HTMLElement[] = [];
    {
      const facebookButton = document.createElement("a");
      facebookButton.className = "Btn facebook-trigger";
      facebookButton.href = person.facebook?.trim() ? facebookUrl(person.facebook) : "#";
      facebookButton.target = "_blank";
      facebookButton.rel = "noreferrer";
      facebookButton.setAttribute("aria-label", "حساب Facebook");
      const facebookContainer = document.createElement("span");
      facebookContainer.className = "svgContainer";
      const facebookIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      facebookIcon.setAttribute("viewBox", "0 0 320 512");
      facebookIcon.setAttribute("height", "1.3em");
      facebookIcon.setAttribute("class", "svgIcon");
      facebookIcon.setAttribute("fill", "white");
      const facebookPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      facebookPath.setAttribute("d", "M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z");
      facebookIcon.appendChild(facebookPath);
      facebookContainer.appendChild(facebookIcon);
      const facebookBackground = document.createElement("span");
      facebookBackground.className = "BG";
      facebookButton.append(facebookContainer, facebookBackground);
      const facebookClick = (event: Event) => { if (!person.facebook?.trim()) { event.preventDefault(); missingAccount("Facebook"); } };
      facebookButton.addEventListener("click", facebookClick);
      links.insertBefore(facebookButton, links.firstChild);
      createdButtons.push(facebookButton);
    }
    {
      const tiktokButton = document.createElement("a");
      tiktokButton.className = "Btn tiktok-trigger";
      tiktokButton.href = person.tiktok?.trim() ? tiktokUrl(person.tiktok) : "#";
      tiktokButton.target = "_blank";
      tiktokButton.rel = "noreferrer";
      tiktokButton.setAttribute("aria-label", "حساب TikTok");
      const tiktokContainer = document.createElement("span");
      tiktokContainer.className = "svgContainer";
      const tiktokIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      tiktokIcon.setAttribute("viewBox", "0 0 24 24");
      tiktokIcon.setAttribute("height", "1.3em");
      tiktokIcon.setAttribute("class", "svgIcon");
      tiktokIcon.setAttribute("fill", "white");
      const tiktokPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tiktokPath.setAttribute("d", "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.59 3.16-5.91 3.23-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.27 1.79-.14.68-.05 1.45.31 2.07.57 1.03 1.78 1.67 2.94 1.52.77-.01 1.51-.39 2.03-.99.43-.5.66-1.16.67-1.82.02-3.39-.02-6.78-.02-10.17.01-.76-.03-1.51-.02-2.27Z");
      tiktokIcon.appendChild(tiktokPath);
      tiktokContainer.appendChild(tiktokIcon);
      const tiktokBackground = document.createElement("span");
      tiktokBackground.className = "BG";
      tiktokButton.append(tiktokContainer, tiktokBackground);
      const tiktokClick = (event: Event) => { if (!person.tiktok?.trim()) { event.preventDefault(); missingAccount("TikTok"); } };
      tiktokButton.addEventListener("click", tiktokClick);
      links.insertBefore(tiktokButton, links.firstChild);
      createdButtons.push(tiktokButton);
    }
    return () => { instagramButton?.removeEventListener("click", instagramClick); createdButtons.forEach((button) => button.remove()); };
  }, [person.id, person.facebook, person.instagram, person.tiktok]);

  useEffect(() => {
    const qrImage = document.querySelector<HTMLImageElement>(".profile-qr");
    if (!qrImage) return;

    const shareUrl = pageUrl(person.id);
    const shareShell = document.createElement("div");
    shareShell.className = "profile-share-shell";
    const shareLink = document.createElement("a");
    shareLink.href = shareUrl;
    shareLink.target = "_blank";
    shareLink.rel = "noreferrer";
    shareLink.textContent = shareUrl;
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "نسخ الرابط";
    copyButton.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = shareUrl;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          textArea.remove();
        }
        copyButton.textContent = "تم النسخ";
        window.setTimeout(() => { copyButton.textContent = "نسخ الرابط"; }, 1200);
      } catch {
        copyButton.textContent = "تعذر النسخ";
      }
    });
    shareShell.append(shareLink, copyButton);
    qrImage.replaceWith(shareShell);
    return () => shareShell.replaceWith(qrImage);
  }, [person.id]);

  const vote = async (choice: "agree" | "disagree") => {
    if (isVoting) return;

    setIsVoting(true);
    const previousVotes = { ...votes };
    setVotes((current) => ({ ...current, [choice]: current[choice] + 1 }));
    setVoted(choice);

    try {
      const { data, error } = await castPageVote(person.id, choice);

      if (error) {
        console.error(`[Votes] Vote update failed for page ${person.id}. Reverting optimistic update.`, error);
        setVotes(previousVotes);
        setVoted(null);
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (result) {
        setVotes({ agree: result.agree_count, disagree: result.disagree_count });
      }
    } catch (error) {
      console.error(`[Votes] Unexpected vote error for page ${person.id}:`, error);
      setVotes(previousVotes);
      setVoted(null);
    } finally {
      setIsVoting(false);
    }
  };
  return <div className="profile-content"><div className="profile-identity">{person.image ? <div className="profile-avatar-shell"><div className="profile-photo-frame"><img className="profile-photo" src={person.image} alt={`صورة ${person.name}`} loading="eager" decoding="async" /></div></div> : <div className="profile-monogram">{person.name.trim().charAt(0)}</div>}<span className="book-kicker">اسم اختار أن يترك أثرًا</span><h1>{person.name}</h1><p className="profile-role">اسمك هنا ليبقى حين يمر كل شيء</p>{person.city && <span className="profile-city"><MapPin /> {person.city}</span>}</div><div className="profile-rule" /><p className="profile-bio">{person.bio || "صاحب أثر يستحق أن يُروى."}</p><div className="future-note"><span>رأي الكاتب</span><div className="future-answer-list"><div className="future-answer"><small>ما هو المحور الأساسي الذي ستدور حوله حكاية العالم في المستقبل</small><p>{person.questionTwo || person.visionChoice || "—"}</p></div><div className="future-answer"><small>رؤية المستقبل</small><p>«{person.questionThree || person.prediction || "لم يكتب إجابة."}»</p></div><div className="future-answer"><small>وجهة نظرك في التكنولوجيا</small><p>{person.questionFour || person.bio || "—"}</p></div></div><div className="prediction-votes"><button className={voted === "agree" ? "selected" : ""} onClick={() => void vote("agree")} disabled={isVoting}>أتفق <b>{votes.agree}</b></button><button className={voted === "disagree" ? "selected" : ""} onClick={() => void vote("disagree")} disabled={isVoting}>لا أتفق <b>{votes.disagree}</b></button></div></div><div className="profile-facts"><div><small>رقم الصفحة</small><strong>{pageNumber(person.id)}</strong></div><div><small>العصر</small><strong>{eraLabels[person.predictionEra ?? "next"]}</strong></div></div><div className="profile-links"><a className="Btn" href={instagram} target="_blank" rel="noreferrer" aria-label="حساب إنستجرام"><span className="svgContainer"><svg fill="white" className="svgIcon" viewBox="0 0 448 512" height="1.5em" xmlns="http://www.w3.org/2000/svg"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"></path></svg></span><span className="BG"></span></a><a className="Btn whatsapp-trigger" href={whatsapp(person.whatsapp, person.name)} target="_blank" rel="noreferrer" aria-label="تواصل عبر واتساب"><span className="svgContainer"><svg viewBox="0 0 16 16" height="2.5em" className="svgIcon" fill="white"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"></path></svg></span><span className="BG"></span></a></div><img className="profile-qr" src={qrUrl} alt="رمز الوصول إلى حساب إنستجرام" /></div>;
}
function EmptyProfile({ page, onBook }: { page: number; onBook: () => void }) { return <div className="profile-content empty-profile"><div className="empty-mark"><Sparkles /></div><span className="book-kicker">المكان رقم {pageNumber(page)}</span><h1>صفحتك يمكن أن تكون هنا</h1><p className="page-copy">اكتب ما يستحق أن يبقى، ليكون جزءًا من صفحة تحمل اسمك وتصل إلى من سيقرأ الكتاب بعد سنوات.</p><button className="profile-cta" onClick={onBook}>احجز هذه الصفحة <ArrowLeft /></button></div>; }
function PendingProfile({ page }: { page: number }) {
  const contacts = [
    { label: "دعم 1", number: "01028870568" },
    { label: "دعم 2", number: "01024659136" },
  ];

  return <div className="profile-content pending-profile pending-page-shell"><div className="empty-mark"><Sparkles /></div><span className="book-kicker">الصفحة رقم {pageNumber(page)} محجوزة</span><h1>معلومات التواصل</h1><p className="page-copy">محجوزة - بانتظار مراجعة الإدارة. تم حجز هذه الصفحة وسيتم تفعيلها قريباً بعد مراجعة الإدارة.</p><div className="pending-support">{contacts.map(({ label, number }) => <a key={number} href={`https://wa.me/966${number.replace(/^0/, "")}?text=${encodeURIComponent("مرحبًا، أريد متابعة حجز صفحة في كتاب جيل 2026")}`} target="_blank" rel="noreferrer" className="pending-support-link"><b>{label}</b><strong>{number}</strong><span>تواصل عبر واتساب</span></a> )}</div></div>;
}
