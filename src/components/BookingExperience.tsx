import { useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowLeft, Check, Copy, ImagePlus, Sparkles, X } from "lucide-react";
import { getPagePrice, saveBookings, type Booking } from "@/data/memorial";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { reservePage } from "@/data/supabase";

interface BookingExperienceProps { onClose: () => void; page?: number; }
type EraChoice = "next" | "beforeTechnology" | "";
type PaymentMethod = "vodafone" | "instapay";
interface FormData { page: string; name: string; instagram: string; facebook: string; tiktok: string; whatsapp: string; image: string; questionTwo: string; questionThree: string; questionFour: string; predictionEra: EraChoice; paymentSender: string; paymentRecipient: string; paymentMethod: PaymentMethod; }
const PAYMENT_OPTIONS: Record<PaymentMethod, { label: string; number: string; hint: string }> = {
  vodafone: { label: "فودافون كاش", number: "01028870568", hint: "الدفع عبر فودافون كاش" },
  instapay: { label: "إنستا باي", number: "01028870568", hint: "الدفع عبر إنستا باي" },
};
const PAYMENT_NUMBERS = ["01028870568", "01024659136"];
const PAYMENT_NOTICE = "اختر طريقة الدفع المناسبة ثم أرسل المبلغ إلى الرقم التالي";
const pageUrl = (pageNumber: number) => { const url = new URL(window.location.origin); url.searchParams.set("page", String(pageNumber)); return url.toString(); };
const withTimeout = <T,>(promise: Promise<T>, milliseconds: number) => new Promise<T>((resolve, reject) => {
  const timer = window.setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), milliseconds);
  promise.then((value) => { window.clearTimeout(timer); resolve(value); }, (error) => { window.clearTimeout(timer); reject(error); });
});
const ERA_OPTIONS = [
  { value: "next", label: "العصر الحالي" },
  { value: "beforeTechnology", label: "العصر الماضي" },
];
const QUESTION_TWO_OPTIONS = [
  "التكنولوجيا تسرّع الحياة وتغيّرها.",
  "الإنسان يعود للطبيعة والهدوء.",
  "الطاقة والازمات تعيد ترتيب العالم.",
  "الذكاء الاصطناعي يغيّر كل شيء.",
];
const FUTURE_VISION_OPTIONS = [
  "عصر وفرة وتقدم تكنولوجي يحرر الإنسان من القيود.",
  "معركة بقاء تتطلب توازناً بين الفرص التقنية والمخاطر البيئية.",
  "تهديد إنساني يتمثل في سيطرة الآلة وضياع الوظائف والعزلة.",
  "عودة للبساطة والاستدامة والتوازن بين التكنولوجيا والطبيعة.",
];
const TECHNOLOGY_OPTIONS = [
  "التكنولوجيا تفيد البشرية.",
  "التكنولوجيا ستضمر البشرية.",
];
const initialForm: FormData = { page: "", name: "", instagram: "", facebook: "", tiktok: "", whatsapp: "", image: "", questionTwo: "", questionThree: "", questionFour: "", predictionEra: "", paymentSender: "", paymentRecipient: "", paymentMethod: "instapay" };

export default function BookingExperience({ onClose, page }: BookingExperienceProps) {
  const [form, setForm] = useState<FormData>({ ...initialForm, page: page ? String(page) : "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const selectedPageNumber = Number(form.page) || 1;
  const computedPrice = getPagePrice(selectedPageNumber);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm((current) => ({ ...current, [key]: value }));

  const validateFront = () => {
    const nameWords = form.name.trim().split(/\s+/).filter(Boolean);
    if (nameWords.length !== 2) {
      setSubmitError("اسم العميل يجب أن يكون ثنائيًا فقط: الاسم الأول + اسم العائلة.");
      return false;
    }
    if (!form.page || !form.name.trim() || !form.whatsapp.trim() || !form.image) {
      setSubmitError("أكمل رقم الصفحة، الاسم، واتساب، وصورة الشخص قبل المتابعة.");
      return false;
    }
    if (!form.predictionEra || !form.questionTwo.trim() || !form.questionThree.trim() || !form.questionFour.trim()) {
      setSubmitError("اختر العصر، اختر المحور الأساسي، اختر رؤية المستقبل، ثم اختر وجهة نظرك في التكنولوجيا قبل المتابعة.");
      return false;
    }
    return true;
  };

  const validateBack = () => {
    if (!form.paymentSender.trim() || !form.paymentRecipient.trim()) {
      setSubmitError("أكمل أرقام الدفع قبل إرسال الحجز.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setSubmitError("");
    if (!validateFront()) return;
    setIsFlipped(true);
  };

  const handleBack = () => {
    setSubmitError("");
    setIsFlipped(false);
  };

  const copyValue = async (value: string, key: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(trimmed);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = trimmed;
        textArea.setAttribute("readonly", "true");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedValue(key);
      window.setTimeout(() => setCopiedValue((current) => (current === key ? null : current)), 1200);
    } catch {
      setCopiedValue(null);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      if (!validateFront()) { setIsFlipped(false); return; }
      if (!validateBack()) { setIsFlipped(true); return; }
      const selectedEra = form.predictionEra as Exclude<EraChoice, "">;

      if (isSupabaseConfigured) {
        const { error } = await withTimeout(reservePage({
          page: Number(form.page),
          name: form.name,
          city: "كفر الشيخ",
          instagram: form.instagram,
          facebook: form.facebook,
          tiktok: form.tiktok,
          whatsapp: form.whatsapp,
          futureVision: form.questionThree,
          futureMessage: form.questionFour,
          imageUrl: form.image,
          questionTwo: form.questionTwo,
          predictionEra: selectedEra,
          paymentSender: form.paymentSender,
          paymentRecipient: form.paymentRecipient,
          paymentMethod: form.paymentMethod,
          pagePrice: computedPrice,
        }), 15000);

        if (error) {
          const message = error.message;
          setSubmitError(message.includes("PAGE_NOT_AVAILABLE") ? "هذه الصفحة محجوزة بالفعل. اختر صفحة أخرى." : message.includes("function") || message.includes("schema cache") ? "قاعدة البيانات تحتاج تشغيل آخر نسخة من schema.sql داخل Supabase SQL Editor." : `تعذر حفظ الحجز: ${message}`);
          return;
        }
      } else {
        const booking: Booking = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "new", name: form.name, city: "كفر الشيخ", instagram: form.instagram, facebook: form.facebook, tiktok: form.tiktok, whatsapp: form.whatsapp, image: form.image, prediction: form.questionThree, questionTwo: form.questionTwo, questionThree: form.questionThree, questionFour: form.questionFour, predictionEra: selectedEra, page: Number(form.page), price: computedPrice, paymentSender: form.paymentSender, paymentRecipient: form.paymentRecipient, paymentMethod: form.paymentMethod };
        saveBookings([booking, ...JSON.parse(localStorage.getItem("generation-2026-bookings") || "[]")]);
      }

      setSubmitted(true);
      window.dispatchEvent(new CustomEvent("generation-2026-booking-created", { detail: { page: Number(form.page) } }));
    } catch (error) {
      console.error("[Booking] Reservation request failed.", error);
      setSubmitError(error instanceof Error && error.message === "REQUEST_TIMEOUT" ? "انتهت مهلة الاتصال بقاعدة البيانات. تحقق من الاتصال وحاول مرة أخرى." : "تعذر إرسال الحجز بسبب خطأ في الاتصال. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  const uploadImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update("image", String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="booking-overlay">
      <button className="booking-backdrop" onClick={onClose} aria-label="إغلاق نموذج الحجز" />
      {submitted ? (
        <section className="booking-modal booking-success" role="dialog" aria-modal="true" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <div className="success-icon"><Check /></div>
          <span className="section-eyebrow"><Sparkles /> تم استلام طلبك</span>
          <h2>سيتم مراجعة طلبك</h2>
          <p>تم حفظ طلب حجز الصفحة رقم {form.page} بعد تسجيل بيانات الدفع.</p>
          <div className="booking-payment">
            {PAYMENT_NUMBERS.map((number) => <strong key={number}>{number}</strong>)}
          </div>
          <button className="booking-submit" onClick={onClose}>العودة إلى الكتاب <ArrowLeft /></button>
        </section>
      ) : (
        <form className="booking-modal simple-booking booking-flip-form" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="booking-title" style={{ maxHeight: "85vh", overflowY: "auto" }}>
          <button type="button" className="booking-close" onClick={onClose} aria-label="إغلاق"><X /></button>
          <span className="section-eyebrow"><Sparkles /> اترك بصمتك</span>
          <h2 id="booking-title">قبل أن نكتب اسمك…</h2>

          {submitError && <p className="booking-error" role="alert">{submitError}</p>}

          <div className="booking-card-stage">
            <div className={`booking-card-flip ${isFlipped ? "is-flipped" : ""}`}>
              <div className="booking-face form_front">
                <div className="booking-panel-header">
                  <span>الخطوة 1</span>
                  <b>بيانات الصفحة</b>
                </div>

                <div className="booking-section">
                  <div className="booking-section-header">بيانات العميل</div>
                  <div className="booking-fields booking-form-grid two-col">
                    {page ? (
                      <label>رقم الصفحة<input required readOnly value={form.page} /></label>
                    ) : (
                      <label>رقم الصفحة<input required type="number" min="1" max="1000" value={form.page} onChange={(event) => update("page", event.target.value)} /></label>
                    )}

                    <label className="full-width">
                      الاسم كما سيظهر في الكتاب
                      <small className="field-help">الاسم يجب أن يكون ثنائيًا فقط: الاسم الأول + اسم العائلة.</small>
                      <input required value={form.name} onChange={(event) => update("name", event.target.value)} />
                    </label>

                    <label>
                      اسم المستخدم على إنستجرام
                      <small className="field-help">اختياري</small>
                      <input placeholder="مثال: generation2026" value={form.instagram} onChange={(event) => update("instagram", event.target.value.replace(/^@/, ""))} />
                    </label>

                    <label>
                      رابط Facebook
                      <small className="field-help">اختياري</small>
                      <input type="url" placeholder="https://facebook.com/..." value={form.facebook} onChange={(event) => update("facebook", event.target.value)} />
                    </label>

                    <label>
                      رابط TikTok
                      <small className="field-help">اختياري</small>
                      <input type="url" placeholder="https://tiktok.com/@..." value={form.tiktok} onChange={(event) => update("tiktok", event.target.value)} />
                    </label>

                    <label>
                      واتساب
                      <input required inputMode="tel" placeholder="01012345678" value={form.whatsapp} onChange={(event) => update("whatsapp", event.target.value)} />
                    </label>

                    <label className="upload-field full-width"><ImagePlus /> صورة الشخص التي ستظهر في صفحتك (مطلوبة)<input required type="file" accept="image/*" onChange={uploadImage} /></label>
                  </div>
                </div>

                <div className="booking-section">
                  <div className="booking-section-header">الأسئلة</div>
                  <div className="booking-questions">
                    <label>
                      <b>من وجهة نظرك أي عصر أفضل؟</b>
                      <div className="choice-grid">
                        {ERA_OPTIONS.map((option) => (
                          <button type="button" key={option.value} className={form.predictionEra === option.value ? "choice-chip active" : "choice-chip"} onClick={() => update("predictionEra", option.value as EraChoice)}>{option.label}</button>
                        ))}
                      </div>
                    </label>

                    <label>
                      <b>ما هو المحور الأساسي الذي ستدور حوله حكاية العالم في المستقبل؟</b>
                      <div className="choice-grid compact">
                        {QUESTION_TWO_OPTIONS.map((option) => (
                          <button type="button" key={option} className={form.questionTwo === option ? "choice-chip active" : "choice-chip"} onClick={() => update("questionTwo", option)}>{option}</button>
                        ))}
                      </div>
                    </label>

                    <label>
                      <b>رؤية المستقبل</b>
                      <div className="choice-grid compact">
                        {FUTURE_VISION_OPTIONS.map((option) => (
                          <button type="button" key={option} className={form.questionThree === option ? "choice-chip active" : "choice-chip"} onClick={() => update("questionThree", option)}>{option}</button>
                        ))}
                      </div>
                    </label>

                    <label>
                      <b>وجهة نظرك في التكنولوجيا</b>
                      <div className="choice-grid compact">
                        {TECHNOLOGY_OPTIONS.map((option) => (
                          <button type="button" key={option} className={form.questionFour === option ? "choice-chip active" : "choice-chip"} onClick={() => update("questionFour", option)}>{option}</button>
                        ))}
                      </div>
                    </label>
                  </div>
                </div>

                <div className="booking-controls">
                  <button type="button" className="booking-submit" onClick={handleNext}>الخطوة التالية <ArrowLeft /></button>
                </div>
              </div>

              <div className="booking-face form_back">
                <div className="booking-panel-header">
                  <span>الخطوة 2</span>
                  <b>بيانات الدفع</b>
                </div>

                <div className="payment-banner"><strong>{PAYMENT_NOTICE}</strong></div>
                <p className="payment-intro">ادفع أولًا، ثم أرسل بيانات التحويل التي ستظهر في طلبك.</p>

                <div className="payment-selection">
                  <span className="payment-selection-title">طريقة التحويل</span>
                  <div className="payment-method-picker">
                    <button type="button" className={form.paymentMethod === "vodafone" ? "payment-option active" : "payment-option"} onClick={() => update("paymentMethod", "vodafone")}>
                      كاش
                    </button>
                    <button type="button" className={form.paymentMethod === "instapay" ? "payment-option active" : "payment-option"} onClick={() => update("paymentMethod", "instapay")}>
                      إنستا باي
                    </button>
                  </div>
                </div>

                <div className="payment-method-list">
                  <button type="button" className={copiedValue === "vodafone-number-1" ? "payment-method-card is-copied" : "payment-method-card"} onClick={() => copyValue("01028870568", "vodafone-number-1")} title="نسخ رقم فودافون كاش الأول">
                    <span className="method-label">فودافون كاش</span>
                    <strong>01028870568</strong>
                    <small>{copiedValue === "vodafone-number-1" ? "تم النسخ" : "اضغط للنسخ"}</small>
                  </button>
                  <button type="button" className={copiedValue === "vodafone-number-2" ? "payment-method-card is-copied" : "payment-method-card"} onClick={() => copyValue("01024659136", "vodafone-number-2")} title="نسخ رقم فودافون كاش الثاني">
                    <span className="method-label">فودافون كاش</span>
                    <strong>01024659136</strong>
                    <small>{copiedValue === "vodafone-number-2" ? "تم النسخ" : "اضغط للنسخ"}</small>
                  </button>
                  <button type="button" className={copiedValue === "instapay-number" ? "payment-method-card is-copied" : "payment-method-card"} onClick={() => copyValue(PAYMENT_OPTIONS.instapay.number, "instapay-number")} title="نسخ رقم إنستا باي">
                    <span className="method-label">إنستا باي</span>
                    <strong>{PAYMENT_OPTIONS.instapay.number}</strong>
                    <small>{copiedValue === "instapay-number" ? "تم النسخ" : "اضغط للنسخ"}</small>
                  </button>
                </div>

                <div className="booking-payment booking-price-summary">
                  <span>السعر الحالي</span>
                  <strong>{computedPrice.toLocaleString("ar-EG")} جنيه</strong>
                </div>

                <div className="booking-fields booking-form-grid two-col">
                  <label>الرقم الذي أرسلت منه الدفع<input required inputMode="tel" value={form.paymentSender} onChange={(event) => update("paymentSender", event.target.value)} /></label>
                  <label>الرقم الذي أرسلت إليه الدفع<input required inputMode="tel" value={form.paymentRecipient} onChange={(event) => update("paymentRecipient", event.target.value)} /></label>
                </div>

                <div className="booking-controls booking-controls-split">
                  <button type="button" className="booking-back" onClick={handleBack}>السابق</button>
                  <button className="booking-submit" disabled={submitting}>{submitting ? "جارٍ الإرسال…" : "إرسال الحجز النهائي"} <ArrowLeft /></button>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
