import { supabase, supabaseConfigDebug } from "@/lib/supabaseClient";
import type { Booking, MemorialPage } from "./memorial";

interface SupabaseParticipant { name: string; city: string | null; image_url: string | null; instagram_username: string; facebook_url: string | null; tiktok_url: string | null; whatsapp: string; future_vision_choice: string | null; future_vision: string; future_message: string | null; prediction_era: "next" | "beforeTechnology" | null; payment_sender: string | null; payment_recipient: string | null; }
interface SupabasePage { page_number: number; status: "available" | "pending" | "reserved"; participant: SupabaseParticipant | SupabaseParticipant[] | null; }
interface SupabaseBooking { id: string; page_number: number; page_price?: number | null; status: "pending" | "contacted" | "approved" | "rejected" | "cancelled"; created_at: string; participant: SupabaseParticipant | SupabaseParticipant[] | null; }

function firstParticipant(value: SupabasePage["participant"]): SupabaseParticipant | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getRemotePages(): Promise<MemorialPage[] | null> {
  if (!supabase) { console.warn("[Book] Supabase is not configured; pages cannot be fetched."); return null; }
  const { data, error } = await supabase.from("public_page_participants").select("page_number,page_status,name,city,image_url,instagram_username,facebook_url,tiktok_url,whatsapp,future_vision_choice,future_vision,future_message,prediction_era").order("page_number");
  if (error || !data) { console.error("[Book] Failed to fetch public pages. Verify schema.sql and security-hardening.sql were applied.", error); return null; }
  console.log("[Book] Public pages fetched.", { count: data.length, statuses: data.reduce<Record<string, number>>((summary, item) => { summary[item.page_status] = (summary[item.page_status] ?? 0) + 1; return summary; }, {}) });
  return (data as Array<SupabaseParticipant & { page_number: number; page_status: "pending" | "reserved" }>).map((participant) => {
    return [{
      id: participant.page_number,
      name: participant.name,
      image: participant.image_url ?? "",
      status: participant.page_status,
      city: "كفر الشيخ",
      bio: participant.future_message ?? "",
      prediction: participant.future_vision,
      visionChoice: participant.future_vision_choice ?? "",
      questionTwo: participant.future_vision_choice ?? "",
      questionThree: participant.future_vision,
      questionFour: participant.future_message ?? "",
      predictionEra: participant.prediction_era ?? "next",
      instagram: participant.instagram_username,
      facebook: participant.facebook_url ?? "",
      tiktok: participant.tiktok_url ?? "",
      whatsapp: participant.whatsapp,
    } satisfies MemorialPage];
  }).flat();
}

export interface ReservePageInput { page: number; name: string; city: string; instagram: string; facebook?: string; tiktok?: string; whatsapp: string; futureVision: string; futureMessage?: string; imageUrl?: string; questionTwo?: string; predictionEra: "next" | "beforeTechnology"; paymentSender: string; paymentRecipient: string; paymentMethod?: "vodafone" | "instapay"; paymentReceipt?: string; pagePrice?: number; }

export async function reservePage(input: ReservePageInput) {
  if (!supabase) return { data: null, error: new Error("Supabase is not configured") };
  const computedPrice = Number.isFinite(input.pagePrice) ? Math.max(0, Math.round(input.pagePrice ?? 0)) : 0;
  console.log("[Booking] Sending reservation.", { page: input.page, hasImage: Boolean(input.imageUrl), hasVisionChoice: Boolean(input.questionTwo), predictionEra: input.predictionEra, pagePrice: computedPrice });
  const result = await supabase.rpc("reserve_page", {
    p_page_number: input.page,
    p_name: input.name,
    p_city: input.city,
    p_instagram_username: input.instagram,
    p_facebook_url: input.facebook ?? "",
    p_tiktok_url: input.tiktok ?? "",
    p_whatsapp: input.whatsapp,
    p_future_vision: input.futureVision,
    p_future_message: input.futureMessage ?? null,
    p_image_url: input.imageUrl ?? null,
    p_future_vision_choice: input.questionTwo ?? "",
    p_prediction_era: input.predictionEra,
    p_payment_sender: input.paymentSender,
    p_payment_recipient: input.paymentRecipient,
    p_payment_receipt: input.paymentReceipt ?? null,
    p_page_price: computedPrice,
  });
  if (result.error) console.error("[Booking] Reservation failed.", { page: input.page, message: result.error.message, code: result.error.code });
  else console.log("[Booking] Reservation saved.", { page: input.page, result: result.data });
  return result;
}

export async function getRemoteBookings(): Promise<Booking[]> {
  if (!supabase) { console.warn("[Admin] Supabase is not configured; bookings cannot be fetched."); return []; }
  const { data, error } = await supabase
    .from("bookings")
    .select("id,page_number,page_price,status,created_at,participant:participants(name,city,image_url,instagram_username,facebook_url,tiktok_url,whatsapp,future_vision_choice,future_vision,future_message,prediction_era,payment_sender,payment_recipient)")
    .order("created_at", { ascending: false });
  if (error || !data) { console.error("[Admin] Failed to fetch bookings.", { message: error?.message, code: error?.code, hint: error?.hint }); return []; }
  console.log("[Admin] Bookings fetched.", { count: data.length, statuses: data.reduce<Record<string, number>>((summary, item) => { summary[item.status] = (summary[item.status] ?? 0) + 1; return summary; }, {}) });
  return (data as SupabaseBooking[]).map((booking) => {
    const participant = firstParticipant(booking.participant);
    return {
      id: booking.id,
      createdAt: booking.created_at,
      status: booking.status === "pending" ? "new" : booking.status === "cancelled" ? "rejected" : booking.status,
      name: participant?.name ?? "",
      city: "كفر الشيخ",
      instagram: participant?.instagram_username ?? "",
      facebook: participant?.facebook_url ?? "",
      tiktok: participant?.tiktok_url ?? "",
      whatsapp: participant?.whatsapp ?? "",
      prediction: participant?.future_vision ?? "",
      image: participant?.image_url ?? "",
      questionFour: participant?.future_message ?? "",
      questionTwo: participant?.future_vision_choice ?? "",
      visionChoice: participant?.future_vision_choice ?? "",
      predictionEra: participant?.prediction_era ?? "next",
      paymentSender: participant?.payment_sender ?? "",
      paymentRecipient: participant?.payment_recipient ?? "",
      page: booking.page_number,
      price: typeof booking.page_price === "number" ? booking.page_price : undefined,
    };
  });
}

export async function approveRemoteBooking(bookingId: string) {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  const { error } = await supabase.rpc("approve_booking", { p_booking_id: bookingId });
  return { error };
}

export async function deleteRemoteBooking(bookingId: string) {
  if (!supabase) return { error: new Error("Supabase is not configured") };
  try {
    const { error } = await supabase.rpc("delete_booking", { p_booking_id: bookingId });
    if (error) {
      console.error("[Admin] Failed to delete booking.", error);
    }
    return { error };
  } catch (error) {
    console.error("[Admin] Unexpected error while deleting booking.", error);
    return { error: error instanceof Error ? error : new Error("Unknown booking delete error") };
  }
}

export async function deleteRemotePage(pageNumber: number) {
  if (!supabase) return { error: new Error("Supabase is not configured") };

  const rpcName = "delete_page_admin";
  const rpcArgs = { target_page_number: pageNumber };

  console.log("[Admin] Attempting admin RPC page delete.", {
    rpcName,
    rpcArgs,
    clientConfig: supabaseConfigDebug,
    timestamp: new Date().toISOString(),
  });

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    console.log("[Admin] Supabase session before RPC delete.", {
      session: sessionData?.session ? { userId: sessionData.session.user?.id, email: sessionData.session.user?.email } : null,
      sessionError,
      clientConfig: supabaseConfigDebug,
    });

    const { data, error } = await supabase.rpc(rpcName, rpcArgs);

    console.log("[Admin] Raw RPC delete response.", {
      rpcName,
      rpcArgs,
      data,
      error,
      fullError: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint, stack: error.stack } : null,
    });

    if (error) {
      console.error("[Admin] Admin page delete RPC failed with full Supabase error.", {
        rpcName,
        rpcArgs,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        fullError: error,
      });
      return { error, data: null };
    }

    console.log("[Admin] Admin page delete RPC succeeded.", { rpcName, rpcArgs, data });
    return { error: null, data };
  } catch (error) {
    console.error("[Admin] Unexpected exception while invoking delete_page_admin RPC.", {
      rpcName,
      rpcArgs,
      error,
    });
    return { error: error instanceof Error ? error : new Error("Unknown page delete RPC error") };
  }
}

export interface PageVotes { agree: number; disagree: number; }

export async function getPageVotes(pageNumber: number): Promise<PageVotes> {
  if (!supabase) return { agree: 0, disagree: 0 };

  const { data, error } = await supabase
    .from("page_votes")
    .select("agree_count, disagree_count")
    .eq("page_number", pageNumber)
    .maybeSingle();

  if (error) {
    console.error(`[Votes] Failed to load counts for page ${pageNumber}:`, error.message, error);
    return { agree: 0, disagree: 0 };
  }

  return { agree: data?.agree_count ?? 0, disagree: data?.disagree_count ?? 0 };
}

export async function castPageVote(pageNumber: number, choice: "agree" | "disagree") {
  if (!supabase) {
    const error = new Error("Supabase is not configured");
    console.error("[Votes] Cannot cast vote because Supabase is not configured.", error);
    return { data: null, error };
  }

  // التحقق من أن المستخدم لم يصوت مسبقاً على هذه الصفحة من هذا المتصفح
  const voteKey = `voted_page_${pageNumber}`;
  const existingVote = localStorage.getItem(voteKey);

  if (existingVote) {
    const err = new Error("لقد قمت بالتصويت مسبقاً على هذه الصفحة.");
    console.warn(`[Votes] User already voted for page ${pageNumber} with choice: ${existingVote}`);
    return { data: null, error: err };
  }

  // 1. جلب القيم الحالية للتصويت للصفحة مباشرة من الجدول
  const { data: existing } = await supabase
    .from("page_votes")
    .select("agree_count, disagree_count")
    .eq("page_number", pageNumber)
    .maybeSingle();

  const agreeCount = existing?.agree_count ?? 0;
  const disagreeCount = existing?.disagree_count ?? 0;

  // 2. تحديث العداد (زيادة صوت واحد فقط)
  const updatedData = {
    page_number: pageNumber,
    agree_count: choice === "agree" ? agreeCount + 1 : agreeCount,
    disagree_count: choice === "disagree" ? disagreeCount + 1 : disagreeCount,
    updated_at: new Date().toISOString(),
  };

  const result = await supabase
    .from("page_votes")
    .upsert(updatedData, { onConflict: "page_number" })
    .select()
    .single();

  if (result.error) {
    console.error(`[Votes] Vote rejected for page ${pageNumber} with choice ${choice}:`, {
      code: result.error.code,
      message: result.error.message,
      details: result.error.details,
      hint: result.error.hint,
    });
  } else {
    // حفظ حالة التصويت محلياً لمنع التكرار
    localStorage.setItem(voteKey, choice);
  }

  return {
    data: result.data ? [{ page_number: result.data.page_number, agree_count: result.data.agree_count, disagree_count: result.data.disagree_count }] : null,
    error: result.error
  };
}

export function subscribeToPageVotes(pageNumber: number, onChange: (votes: PageVotes) => void) {
  const client = supabase;
  if (!client) return () => undefined;

  const channel = client.channel(`generation-2026-votes-${pageNumber}`).on(
    "postgres_changes",
    { event: "*", schema: "public", table: "page_votes", filter: `page_number=eq.${pageNumber}` },
    (payload) => {
      const row = (payload.new ?? payload.old) as { agree_count?: number; disagree_count?: number } | null;
      if (!row) return;
      onChange({ agree: row.agree_count ?? 0, disagree: row.disagree_count ?? 0 });
    }
  ).subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.info(`[Votes] Realtime subscribed for page ${pageNumber}.`);
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error(`[Votes] Realtime subscription failed for page ${pageNumber}. Status: ${status}`);
    }
  });

  return () => { void client.removeChannel(channel); };
}

export function subscribeToRemoteBookings(onChange: () => void, onError?: () => void) {
  const client = supabase;
  if (!client) return () => undefined;
  const channel = client.channel("generation-2026-bookings").on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, onChange).subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onError?.();
  });
  return () => { void client.removeChannel(channel); };
}

export function subscribeToRemotePages(onChange: () => void, onError?: () => void) {
  const client = supabase;
  if (!client) return () => undefined;
  const channel = client.channel("generation-2026-pages").on("postgres_changes", { event: "*", schema: "public", table: "pages" }, onChange).subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onError?.();
  });
  return () => { void client.removeChannel(channel); };
}