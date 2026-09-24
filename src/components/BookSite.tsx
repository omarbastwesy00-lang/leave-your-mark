import BookReader from "./BookReader";
import type { MemorialPage } from "@/data/memorial";

interface BookSiteProps { pages: MemorialPage[]; }

export default function BookSite({ pages }: BookSiteProps) {
  return <BookReader pages={pages} />;
}