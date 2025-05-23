import { TenzyGameCard } from "@/app/tenzy/views/StartScreen";
export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "While in Queue",
    url: "https://www.whileinqueue.io",
    description: "Quick games to play while you are waiting in queue.",
  };
  return (
    <div className="relative mx-auto max-w-screen-lg h-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="w-full mx-auto max-w-screen-sm p-4">
        <div className="">
          <TenzyGameCard />
        </div>
      </div>
    </div>
  );
}
