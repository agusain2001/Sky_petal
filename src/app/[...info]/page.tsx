import Link from "next/link";
import { notFound } from "next/navigation";
const pages: Record<
  string,
  { eyebrow: string; title: string; sections: [string, string][] }
> = {
  about: {
    eyebrow: "THE SKY PETAL PHILOSOPHY",
    title: "A softer way to be you.",
    sections: [
      [
        "Close to your skin. Closer to you.",
        "We believe everyday comfort is a little form of care. Sky Petal brings together beautiful intimates, easy loungewear and thoughtful self-care rituals, chosen for the way they make you feel.",
      ],
      [
        "Every version of lovely.",
        "Some days call for delicate lace. Some days call for a slow morning in silk. Some call for simply feeling at home in your own skin. There is no one way to be beautiful, and there is no one way to wear Sky Petal.",
      ],
      [
        "Thoughtful, down to the details.",
        "We focus on soft fabrics, considered fits and honest information. Our launch collection is being prepared with care. Product images are generated editorial illustrations; final merchant photography and verified specifications should be published before sales begin.",
      ],
    ],
  },
  "fit-guide": {
    eyebrow: "A GOOD FIT IS A BEAUTIFUL FEELING",
    title: "Let’s find your lovely fit.",
    sections: [
      [
        "A little measuring moment.",
        "Use a soft measuring tape, keep it level and relaxed, and measure over light clothing. Measure the fullest part of your bust, your natural waist and the fullest part of your hips.",
      ],
      [
        "Your size, at a glance.",
        "XS: bust 78–83 cm, waist 60–65 cm. S: bust 84–89 cm, waist 66–71 cm. M: bust 90–95 cm, waist 72–77 cm. L: bust 96–101 cm, waist 78–83 cm. XL: bust 102–109 cm, waist 84–91 cm. XXL: bust 110–117 cm, waist 92–99 cm.",
      ],
      [
        "Between sizes?",
        "Choose the larger size for a more relaxed feel. This general guide applies to our preview clothing sizes. Band-and-cup bra fitting requires the product’s specific size chart.",
      ],
    ],
  },
  "policies/shipping": {
    eyebrow: "A LITTLE SOFTNESS, DELIVERED",
    title: "On its way to you.",
    sections: [
      [
        "Delivery within India",
        "The preview shipping rule is complimentary standard delivery on orders of ₹2,990 or above, after discounts. Orders below this amount have a ₹99 delivery fee. Serviceability, dispatch estimates and carrier details must be confirmed by the merchant before launch.",
      ],
      [
        "Quietly, carefully packed",
        "Discreet outer packaging is the store’s intended fulfillment standard. Your shopping choices belong to you.",
      ],
      [
        "Follow your order",
        "Your account shows the server-recorded order status from payment through fulfillment. Tracking references are added by the store team at dispatch.",
      ],
    ],
  },
  "policies/returns": {
    eyebrow: "CARE IN EVERY DETAIL",
    title: "A thoughtful return policy.",
    sections: [
      [
        "What may be eligible",
        "Eligible unworn and unwashed apparel, with original tags and packaging, may be requested for return within 14 days of delivery. Each request is reviewed by the care team.",
      ],
      [
        "A note on hygiene",
        "Opened intimate bottoms, shapewear, and personal-care products are excluded for hygiene reasons unless damaged or defective. Please inspect your order on arrival and contact the store if something is wrong.",
      ],
      [
        "Before the store opens",
        "This is a draft operational policy for the local preview. The merchant must confirm eligibility, return costs, refund timelines and applicable legal obligations before accepting sales.",
      ],
    ],
  },
  "policies/privacy": {
    eyebrow: "YOUR TRUST, HELD CLOSE",
    title: "Your privacy comes first.",
    sections: [
      [
        "Only what we need",
        "The store uses your contact details, delivery address and order information to manage your account and fulfill purchases. Intimate shopping information is private and is not shown to other customers.",
      ],
      [
        "Your account, your choices",
        "You can download your account data or request deletion from the Privacy section of your account. Deletion requests are reviewed for any required retention of transaction records. Newsletter sign-up is separate from checkout.",
      ],
      [
        "Cookies and service providers",
        "Essential cookies keep your session and shopping bag working. Authentication and payments use the merchant’s configured providers. Provider policies and a complete privacy notice must be approved before public launch.",
      ],
    ],
  },
  "policies/terms": {
    eyebrow: "THE LITTLE DETAILS",
    title: "A few things to know.",
    sections: [
      [
        "Local preview",
        "Sky Petal is currently a local development store. The catalog and generated images are sample content. Payments remain unavailable until a verified merchant payment account is connected.",
      ],
      [
        "Orders and prices",
        "All amounts are in Indian rupees, stored as integer paise. The server calculates order totals and reserves available inventory. An order is marked paid only after a captured payment is verified on the server.",
      ],
      [
        "Before launch",
        "Merchant identity, contact information, actual product specifications, tax registration, consumer notices and service terms require review before accepting live customer orders.",
      ],
    ],
  },
  contact: {
    eyebrow: "WE’RE HERE FOR YOU",
    title: "A little conversation.",
    sections: [
      [
        "Your order",
        "Sign in to your account to see your order status and delivery progress. Eligible return requests can be submitted from a delivered order.",
      ],
      [
        "A question about fit?",
        "Start with our size and fit guide. For product-specific measurements, consult the details on each product page.",
      ],
      [
        "Care-team contact",
        "The merchant’s customer-care email, phone and operating hours have not yet been configured. These must be added before launch.",
      ],
    ],
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ info: string[] }>;
}) {
  const { info } = await params;
  return { title: pages[info.join("/")]?.title || "Sky Petal" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ info: string[] }>;
}) {
  const { info } = await params;
  const page = pages[info.join("/")];
  if (!page) notFound();
  return (
    <article className="policy-page">
      <span className="eyebrow">{page.eyebrow}</span>
      <h1>{page.title}</h1>
      {info[0] === "about" && (
        <img
          src="/images/hero.webp"
          alt="The soft silk and floral details of Sky Petal"
        />
      )}
      {page.sections.map(([title, body]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}
      <Link className="button outline" href="/shop">
        Explore a little softness →
      </Link>
    </article>
  );
}
