"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state page-shell">
      <h1>A little pause.</h1>
      <p>We couldn’t load this page. Please try again.</p>
      <button className="button dark" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
