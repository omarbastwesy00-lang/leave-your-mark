import { useState, useEffect, useRef } from "react";
import AdminDashboard from "@/components/AdminDashboard";
import BookSite from "@/components/BookSite";
import { PAGES_STORAGE_KEY, PAGES_UPDATED_EVENT, clearLegacyLocalData, getStoredPages, savePages, type MemorialPage } from "@/data/memorial";
import { getRemotePages, subscribeToRemotePages } from "@/data/supabase";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export default function App() {
  const [pages, setPages] = useState<MemorialPage[]>([]);
  const pagesRequestId = useRef(0);

  const isAdminRoute = window.location.pathname === "/admin";

  const updatePages = (updatedPages: MemorialPage[]) => {
    setPages(updatedPages);
    savePages(updatedPages);
  };

  useEffect(() => {
    document.body.style.overflow = "auto";
    clearLegacyLocalData();

    const reloadPages = () => setPages(getStoredPages());
    const refreshFromSupabase = async () => {
      const requestId = ++pagesRequestId.current;
      console.log("[Book] Loading pages.", { requestId });
      const remotePages = await getRemotePages();
      if (requestId === pagesRequestId.current) { setPages(remotePages ?? []); console.log("[Book] Pages state updated.", { requestId, count: remotePages?.length ?? 0 }); }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === PAGES_STORAGE_KEY) reloadPages();
    };
    const refreshOnReturn = () => { if (document.visibilityState === "visible" && isSupabaseConfigured) void refreshFromSupabase(); };
    const refreshAfterBooking = (event: Event) => {
      const pageNumber = (event as CustomEvent<{ page?: number }>).detail?.page;
      if (pageNumber) {
        setPages((current) => current.some((page) => page.id === pageNumber)
          ? current.map((page) => page.id === pageNumber ? { ...page, status: "pending" } : page)
          : [...current, { id: pageNumber, name: "", image: "", status: "pending", instagram: "", whatsapp: "" }]);
        console.log("[Book] Optimistic pending state applied.", { page: pageNumber });
      }
      void refreshFromSupabase();
    };
    const refreshAfterApproval = (event: Event) => {
      const approvedPage = (event as CustomEvent<{ page?: MemorialPage }>).detail?.page;
      if (approvedPage) setPages((current) => [...current.filter((page) => page.id !== approvedPage.id), approvedPage]);
      void refreshFromSupabase();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(PAGES_UPDATED_EVENT, reloadPages);
    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);
    window.addEventListener("generation-2026-booking-created", refreshAfterBooking);
    window.addEventListener("generation-2026-page-approved", refreshAfterApproval);
    void refreshFromSupabase();
    const unsubscribeRemote = subscribeToRemotePages(() => { console.log("[Book] pages Realtime event received."); void refreshFromSupabase(); }, () => { console.warn("[Book] pages Realtime connection issue; refetching."); void refreshFromSupabase(); });
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(PAGES_UPDATED_EVENT, reloadPages);
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
      window.removeEventListener("generation-2026-booking-created", refreshAfterBooking);
      window.removeEventListener("generation-2026-page-approved", refreshAfterApproval);
      unsubscribeRemote();
    };
  }, []);

  if (isAdminRoute) {
    return <AdminDashboard pages={pages} onPagesChange={updatePages} />;
  }

  window.scrollTo(0, 0);
  return <BookSite pages={pages} />;
}
