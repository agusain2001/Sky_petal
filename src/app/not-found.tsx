import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state page-shell">
      <span className="eyebrow">A LITTLE LOST?</span>
      <h1>This petal has drifted away.</h1>
      <p>Let’s find something lovely instead.</p>
      <Link className="button dark" href="/shop">
        Explore the collection
      </Link>
    </div>
  );
}
