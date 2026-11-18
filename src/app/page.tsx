import { getDB, getProducts } from "@/lib/db";
import { Home } from "@/components/home";
export const dynamic = "force-dynamic";
export default async function Page() {
  const db = await getDB();
  const { rows } = await db.query<{
    content: {
      eyebrow: string;
      headline: string;
      description: string;
      story: string;
      storyBody: string;
    };
  }>("SELECT content FROM cms_content WHERE key='home'");
  return <Home products={await getProducts()} content={rows[0].content} />;
}
