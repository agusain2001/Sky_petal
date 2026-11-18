# Sky Petal: product design audit and redesign brief

**Review date:** 10 November 2026, Asia/Kolkata  
**Reviewed application:** http://127.0.0.1:4317  
**Status:** Design recommendations ready for implementation planning. No redesign code has been applied.  
**Recommended direction:** Modern romantic commerce, preserving Sky Petal's existing identity.

## 1. Product designer's verdict

Sky Petal already feels like a coherent brand. The blush photography, plum palette, delicate wordmark and Cormorant typography work together. The strongest improvement is to make this identity support shopping more directly.

Today, the homepage gives atmosphere more attention than product selection. It repeats the ideas of softness, self-care and being yourself across many large sections. The catalog, fit guidance and product information need more practical detail. On mobile, important buying information arrives late.

**We can build a noticeably better site through a focused redesign:** a shorter homepage, clearer product discovery, more readable utility typography, accurate product imagery, stronger fit guidance and a faster mobile purchase path. A full brand replacement is unnecessary.

The design goal is: **help a shopper find a suitable piece, understand its fit and material, and buy with confidence, while keeping the shopping experience gentle and personal.**

These are product design judgments, not measured conversion results. No customer interviews, funnel analytics or A/B experiments were available for this review.

### Design read

Reading this as an Indian intimates, sleepwear and self-care storefront for shoppers seeking comfort and personal confidence, with a romantic editorial identity, leaning toward a more useful modern fashion-commerce experience.

The audience description is inferred from the current catalog, INR pricing and site copy. It needs validation with the merchant and actual customers.

| Design setting | Current reading, qualitative | Proposed direction |
| --- | --- | --- |
| Visual variation | About 7/10: asymmetry, arches, large display type | 6/10: expressive campaigns with predictable shopping layouts |
| Motion intensity | About 7/10: reveals, scroll effects, silk canvas, magnetic links | 3/10 across shopping; up to 5/10 for one optional editorial moment |
| Visual density | About 3/10: generous space, tiny utility text | 4/10: retain space while making useful information visible sooner |

These settings express design intent; they are not performance scores or usability ratings.

## 2. What was actually reviewed

The application was started with `npm.cmd run dev`. This repository uses one Next.js application for both frontend pages and backend API routes; it does not require a separate backend server.

| Check | Result in this session |
| --- | --- |
| Homepage HTTP response | 200 |
| `/api/catalog` | Responded with 11 products |
| `/api/home` | 200 |
| Public page availability | `/shop`, `/about`, `/fit-guide`, four policy pages, `/contact`, `/wishlist`, `/cart`, `/account`, `/admin` returned 200 |
| Desktop browser review | Brave, 100% browser zoom; homepage, category filter, product detail, size dialog, populated bag drawer, full cart, checkout sign-in entry, about and fit-guide pages |
| Mobile browser review | DevTools Responsive viewport at 400 × 689; homepage, menu, category listing, filter drawer, product detail and search dialog |
| Shopping interaction | Filtered to bras, selected M, added one Champagne Petal Bralette to the guest bag, opened cart and followed checkout to sign-in |
| Source review | Shared chrome, catalog, cards, product detail, bag, checkout, account, wishlist, information pages, order/support/returns/notifications components and Studio entry/navigation |

HTTP 200 confirms availability, not complete functionality. Client-side gates can still require authentication.

### Evidence boundaries

- The usable mobile visual review used the neutral Responsive profile. An initial iPhone device-profile preview rendered at an unreliable scale and was excluded from layout findings.
- This is an emulated mobile review, not physical iPhone/Android or Safari verification. Other widths, landscape, zoom and screen readers remain acceptance work.
- Signed-in account screens, full checkout, orders, returns, refunds and Studio were **source-reviewed**, not exercised through authenticated UI. No credentials were read or entered.
- No payment, order placement, newsletter subscription, customer message or merchant configuration change was performed.
- One sample item remains in this browser's local guest bag. No order was created.
- Screenshots were inspected through Computer Use. No new screenshot evidence files were saved, so this document does not claim a separate screenshot archive.
- Briefly faded or blank sections were re-observed after transitions settled. The motion finding concerns delayed presentation, not permanently missing content.
- Existing QA files are historical evidence. Their pass counts and measurements are not presented as fresh test results.

### Evidence index

| ID | Observation | Basis |
| --- | --- | --- |
| E01 | Hero has a clear brand image and visible primary CTA, plus multiple small decorative labels | Desktop and mobile UI; `home.tsx` |
| E02 | Philosophy, category edit and campaign precede the first priced product grid | Homepage scrolling and source order |
| E03 | Sections initially appear faint, then resolve after reveal animation | Repeated desktop observations; Reveal duration in `home.tsx` |
| E04 | Filtering bras changes the URL to `category=bras` and produces two products | Desktop UI |
| E05 | Active filter chip displays raw `category: bras` | Desktop and mobile UI; `catalog.tsx` |
| E06 | Petal Bralette image appears pink while default selected colour is Champagne | Desktop/mobile UI and populated bag |
| E07 | Product size dialog gives a general bust/waist chart, not a product-specific fit chart | Desktop UI; `store-provider.tsx` |
| E08 | Selecting M enables Add to bag; drawer shows the selected variant and subtotal | Desktop UI |
| E09 | Checkout from the guest cart leads to `/account?next=/checkout` | Desktop UI and checkout source |
| E10 | Mobile product first screen shows the large image and thumbnails before name, price and size controls | Responsive 400 × 689 UI |
| E11 | Mobile menu offers New in, Lingerie, Bras & bralettes, Sleep & lounge, Self-care, Our world, account and wishlist; no direct Shop all or fit-guide entry | Mobile UI; `chrome.tsx` |
| E12 | Fit-guide size ranges are written as a dense paragraph | Desktop UI and information-page source |
| E13 | Search uses a dialog with one input and static suggested links | Mobile UI; `chrome.tsx` |
| E14 | Current product schema lacks per-colour media and product-specific fit/support attributes | `types.ts`, `product-detail.tsx`, `store-provider.tsx` |
| E15 | Eye pillow sample product has apparel sizes XS through XXL | Current catalog API response |
| E16 | Card minimum price uses all variants, while filtered sorting uses matching variants | `product-card.tsx`, `catalog.ts`; conditional risk, not reproduced with unequal sample SKU prices |
| E17 | Bag shipping threshold and product shipping copy are hard-coded; checkout uses server quotes | `store-provider.tsx`, `product-detail.tsx`, checkout source; configuration-drift risk |

## 3. Preserve these strengths

1. **Recognizable colour system.** Plum on pale blush/ivory belongs to this site. Keep it recognizable across the storefront.
2. **Editorial photography direction.** The light, fabric and floral vocabulary are consistent. Campaign imagery can retain this mood while factual product photography becomes more complete.
3. **Distinctive display typography.** Cormorant Garamond is justified by the existing romantic editorial identity. Pair it with a more confident use of DM Sans for shopping information.
4. **Useful commerce foundations.** URL-based filters, SKU selection, a guest bag, product zoom, size dialog, cart drawer and server-backed checkout already exist. Improve them instead of planning them as missing features.
5. **Honest sample-content disclosures.** The site acknowledges generated imagery and a preview catalog. Keep those disclosures until real product evidence replaces the samples.
6. **Existing accessibility work.** The source includes a skip link, labelled controls, native dialogs, focus restoration, pause controls and reduced-motion handling. Preserve and retest these features.
7. **Privacy-conscious tone.** Discreet packaging and private customer care are relevant concerns for this category. Publish only promises the merchant can fulfill.

## 4. Prioritized findings

**P0:** resolve before presenting the catalog as trustworthy for real purchasing.  
**P1:** first redesign release.  
**P2:** subsequent iteration or an experiment after the main shopping path improves.

| ID | Priority | Finding and shopper consequence | Recommended response | Evidence |
| --- | --- | --- | --- | --- |
| D01 | P0 | Selected colour and displayed image can disagree. Shoppers cannot confidently identify what they will receive. | Add colour-specific product media. Default to the pictured colour when valid; identify missing imagery honestly. Keep cart imagery consistent with the SKU. | E06, E14 |
| D02 | P0 | Product descriptions and fit information are generic. The general chart cannot substantiate support, coverage or a specific garment's fit. | Publish merchant-verified specifications and product-specific size guides before real sales. Avoid inventing band/cup recommendations. | E07, E12, E14 |
| D03 | P0 | Sample data includes an eye pillow with XS-XXL variants. A shared apparel model creates an implausible product choice. | Define product-type-specific options and validate catalog data. Eye-pillow sizing must come from the merchant, not an assumed replacement. | E15 |
| D04 | P1 | Priced products arrive after several brand sections. Comparing and choosing takes more scrolling than necessary. | Move categories and a relevant product selection directly after the hero. Condense repeated philosophy sections. | E02 |
| D05 | P1 | Desktop nav and homepage utility text are very small. Important links and product details feel secondary to large headings. | Introduce explicit reading/utility type tokens and increase practical text sizes. This is a readability finding, not an assertion that a font-size rule in WCAG was violated. | E01; CSS |
| D06 | P1 | Slow reveal effects make content initially faint during browsing. The silk scene consumes a full section without helping product choice. | Show essential text/products immediately; shorten optional reveals; replace the silk scene with material evidence or move it to a campaign experience. | E03; homepage UI |
| D07 | P1 | Mobile PDP hides the product name and price until after the image and thumbnails. | Move name/price ahead of the gallery on mobile, reduce gallery height and introduce a contextual purchase bar after the main controls leave view. | E10 |
| D08 | P1 | Category pages devote much of the first screen to generic introductory text. | Use a compact category title and specific category guidance; bring product names and prices into the initial browsing area. | Desktop/mobile catalog UI |
| D09 | P1 | Machine-like filter chips and single-selection checkboxes create unclear expectations. | Use human labels such as Bras & bralettes. Either support multi-select within a facet or communicate single selection honestly. | E04, E05; catalog source |
| D10 | P1 | Guests meet account creation/sign-in when they try to check out. | First improve the explanation and return-to-checkout path. Assess guest checkout as a separate product/backend change. | E09 |
| D11 | P1 | Product cards use the same Choose your size action for apparel, oil and accessories. | Make the action reflect the product's actual option model: choose size, choose options, or add an eligible single variant. | Homepage/catalog UI; card source |
| D12 | P1 | Mobile navigation omits convenient entry to the full catalog and fit help. | Add direct access to both, retaining the current category destinations. | E11 |
| D13 | P1 | Draft contact and policies lack confirmed merchant/service facts. | Complete merchant identity, contact methods, operating hours and approved delivery/return facts before live commerce. Treat this as content/operations work, not styling. | Information-page source |
| D14 | P1 | Promotional shipping messaging can drift from configured checkout rules. | Have bag, PDP and policies use a shared published rule; retain authoritative address-based checkout quotes. | E17 |
| D15 | P1 | A filtered product card can display the minimum price of an unrelated variant. | Return/display the matching purchasable variant price, or label an overall minimum clearly as From. Match strike-through prices to that same variant. | E16 |
| D16 | P2 | Search requires submitting a term; suggestions are static. | Start with clearer result headings, relevant suggestions and recovery. Add autocomplete only if catalog growth or research justifies it. | E13; catalog source |
| D17 | P2 | Same hero/campaign assets recur across several sections. | Build a purposeful image set: garment front/back, texture, construction and accurate colour views. Reduce repeated campaign images. | Homepage/about/PDP UI |
| D18 | P2 | Studio uses many operational tabs and editorial greetings. | Plan a separate task-oriented admin design with queues, clear states and role-specific actions. Validate through authenticated review. | Studio source only |

## 5. Recommended visual direction

### Direction A: Modern romantic commerce, recommended

Keep the wordmark, plum, pale surfaces and selective Cormorant headings. Give DM Sans more responsibility: navigation, product names in compact cards, prices, stock, form fields and help. Use confident image crops and fewer decorative captions. Let real products create visual interest.

This direction fits the existing assets and can be implemented incrementally without replacing the commerce application.

| Alternative | What changes | Tradeoff |
| --- | --- | --- |
| B: Contemporary fashion | Sans-led display, sharper grid, more contrast, less italic | More visibly new, but weakens the current romantic editorial character and needs a broader asset refresh |
| C: Cinematic campaign | Larger moving scenes and immersive storytelling | Suitable for a distinct campaign experiment; adds complexity and delays practical shopping if made the default store experience |

Start with A. Explore B in a single visual prototype if the merchant wants a stronger identity shift. C should be justified by a campaign objective and a measured performance budget.

### Proposed design system

Current effective colours below come from `cinematic.css`, which overrides earlier values in `globals.css`.

| Token | Current effective value | Proposed use |
| --- | --- | --- |
| Main surface | `#fff9f6` | Keep as the recognizable base |
| Alternate surface | `#f4ece6` | Use sparingly to group useful content |
| Primary ink / action | `#4e2a40` | Primary buttons, headings and readable text |
| Rose | `#95616f` | Selective display emphasis; validate contrast for each text use |
| Blush | `#f4e6e4` | Quiet background accent |
| Muted text | `#775a62` | Secondary copy, subject to contrast verification |
| Divider | `#e7d9d6` | Dividers; do not rely on it alone to identify interactive controls |

This is an evolution of the present brand. No extra accent palette is needed.

| Element | Proposed specification |
| --- | --- |
| Hero heading | Cormorant 400/500, approximately 56-88 px desktop and 42-56 px mobile; fit copy and viewport together |
| Section heading | Cormorant, approximately 32-48 px; reserve italic for selective emphasis |
| Product title on PDP | 30-40 px desktop, 26-32 px mobile; test long names |
| Body / fields | DM Sans 16 px default, line-height about 1.5-1.65 |
| Navigation / controls | DM Sans 14-16 px |
| Secondary metadata | Usually 12-14 px; avoid tiny labels carrying purchase or consent information |
| Product price | DM Sans 16-20 px with strong contrast and a consistent number treatment |
| Layout width | Approximately 1280-1440 px maximum, validated against existing page widths |
| Page gutters | 20-24 px mobile; 40-64 px desktop |
| Section spacing | Usually 40-56 px mobile and 64-88 px desktop; tighter on catalog/checkout |
| Shape rules | Nearly square product imagery; 4-8 px controls; pill shapes only for chips/swatches where the role warrants them |
| Primary action | Solid plum with light text, consistent height 48-52 px |
| Layering | Shared scale for sticky header, contextual action bars and dialogs; ensure focus is never hidden |

These sizes are starting design tokens, not a requirement to force every element into one size. Review real pages at 100% and 200% zoom.

Keep the light editorial theme for this redesign proposal. A full dark theme is a separate design investment, not a prerequisite for improving the purchasing path. If pursued, design every surface and photograph treatment together using semantic tokens.

## 6. Homepage: proposed structure

### Current sequence

Hero → brand ribbon → philosophy → categories → Petal Edit campaign → featured products → silk scene → fit → another brand-story section → wellness → closing message → newsletter → footer.

### Proposed sequence

Hero → shop categories → selected products → fit/material confidence → one campaign feature → concise brand/operational proof → newsletter/footer.

The current stable section anchors, including `#collections`, `#our-world`, `#fit` and `#wellness`, need deliberate preservation or mapping if sections move. Do not break existing links silently.

| Section | Purpose and composition | Mobile behavior |
| --- | --- | --- |
| Hero | Existing editorial image, one headline, one short description and primary collection CTA. Secondary link may lead to fit help. Remove issue numbering, vertical slogans and decorative footnote copy. | Text and product image both matter; headline/CTA visible without waiting for animation. Avoid making the image only a faint decorative background. |
| Categories | Clear entry to Bras & bralettes, Lingerie sets, Sleep & lounge and Self-care. Prioritize according to merchant intent and actual assortment. | Compact two-column tiles or visible category links; keep labels outside image crops. No required carousel interaction. |
| Selected products | Four relevant purchasable products with readable names, prices, truthful availability and category-appropriate actions. | Two-column grid when names/prices remain readable; explicit one-column fallback at narrow widths or large text. |
| Fit/material confidence | A practical fit guide entry plus verified construction/material information. | Stack guidance naturally. Do not imply an accurate size recommendation until specific charts exist. |
| One campaign | Keep the Petal Edit as the main expressive moment. Make the image and linked product selection agree. | Crop deliberately; keep CTA visible and readable without hover. |
| Proof/story | A short brand statement paired with actual product or operational evidence. | Minimal text and direct service links. No invented reviews, factories, certifications or sustainability claims. |
| Newsletter/footer | Optional sign-up with explicit consent, useful navigation and merchant contact details. | Legible consent, clear submit action, compact grouping. |

### Specific content corrections

- The Petal Edit currently shows sleepwear imagery while linking to the lingerie category. Either select matching imagery or link to the relevant curated selection. Confirm the merchant's intended collection before changing the destination.
- Keep the main headline if the merchant likes it. Its supporting sentence should plainly name the actual assortment.
- Consolidate the repeated softness/philosophy statements into one substantive story.
- Remove section-number labels and ornamental microcopy that do not aid shopping. Keep any required preview disclosure easy to find.
- Replace generic claims such as thoughtful details with verified information: fabric composition, stretch, closure or care, when supplied.
- Curate the first product row intentionally. Currently a body oil leads the homepage's initial featured row. That is acceptable if self-care is the business priority; otherwise lead with the core intimates/sleepwear assortment.

## 7. Page-by-page product requirements

### Shared header and navigation

Keep search, bag, account and wishlist recognizable. Reduce header height carefully and increase link legibility. The present desktop header is 84 px before scrolling and 66 px after scrolling, excluding the announcement strip.

For the first implementation, preserve current primary labels and route slugs. Add Shop all and fit-guide access within the shop/mobile menus. A broader change to top-level category navigation is a separate merchant decision.

Use a compact shop panel with clear categories. Add product counts only if they are current and useful. Keep the announcement to one readable message; show an offer only when its eligibility matches the backend.

### Catalog and category pages

- Replace the large generic introduction with a compact category heading, count and useful category-specific guidance.
- Keep current URL query behavior and restore state after visiting a product and returning.
- Replace `category: bras`, `new: yes` and similar chips with human labels.
- Prioritize category, size, availability, colour and price. Show volume options only for products where they make sense.
- Do not add band/cup, padding, support or coverage filters until the product model contains verified values. Current apparel variants are letter sizes.
- Use checkbox multi-selection only if it genuinely works as multi-selection. Today `params.get()` stores one value for category and colour.
- Keep the mobile results button visible at the bottom of the filter panel. The current button exists after the entire filter list; make its location persistent and its count reflect settled results.
- Preserve skeleton, error, clear-filter and no-result paths. Avoid resetting all facets when removing only one is enough to recover.
- Derive displayed prices and sale labels from the same valid SKU context used for filtering and sorting.

### Product cards and quick shop

Cards should answer: What is it? What does it cost? Is my option available? What happens if I tap this action?

Use a clear product name, current price, relevant comparison price and truthful availability. Add a short verified descriptor only when it helps distinguish products. Display actual available sizes rather than a hard-coded range.

Keep image, title and quick action discoverable by keyboard. Swatches should either be functional buttons with selected-state feedback or clearly informational indicators. They are currently noninteractive spans on cards.

Quick shop must retain explicit size/colour selection. For a genuine single-variant item, use an appropriate action and label; an oil should not ask the shopper to choose a clothing size.

### Product detail

**Desktop:** Gallery on the left; purchase information on the right. Use a restrained sticky purchase column only if it fits the viewport and does not obstruct details or keyboard focus.

**Mobile:** Name, short factual descriptor and price → gallery → colour/size/fit guidance → primary action → delivery/return summary → details/reviews/related items.

Requirements:

1. Selected colour must match the visible image, thumbnail set and cart image. No CSS tinting of one photograph as a substitute for accurate product media.
2. Show verified front/back, fabric/construction and colour views. Generated campaign images can support mood, but must not establish factual product specifications.
3. Keep price and any comparison price linked to the selected SKU. Do not silently select an unpictured colour.
4. Add product-specific fit notes and size charts. Distinguish body measurements from garment measurements and identify units.
5. Provide meaningful attributes appropriate to the item: composition, lining, stretch, closure, support and care only when verified.
6. Keep the size instruction visible. Selecting colour currently resets size; explain or retain a compatible valid selection when the data supports it.
7. Distinguish unavailable size from an unavailable colour/size combination. Give a useful next step without fake scarcity.
8. Introduce a mobile action bar once the primary purchase controls leave view. Before selection, it should take the shopper to size selection; after selection, it may add that exact SKU. Never guess a size.
9. Keep a concise return/hygiene summary near the purchase decision, backed by merchant-approved policy and product eligibility.
10. Keep authentic reviews and an honest empty state. Do not manufacture social proof to fill the layout.

### Fit guide

Replace the paragraph of size ranges with a readable semantic size table. Use separate guides for garment types when verified data is available. Align the standalone guide, homepage fit section and product dialog so measurement instructions do not contradict each other.

A useful first version contains illustrated measuring steps, units, the relevant chart and a clear route back to the selected product. A size calculator is optional future work and needs validated sizing rules, explicit limitations and inclusive customer research.

### Bag drawer and full cart

The current bag gives useful feedback: it shows the item, option, quantity, subtotal and a checkout action. Keep that clarity.

Improve legibility of variant details and controls. Make shipping messaging conditional on actual published rules; label costs as estimates until serviceability and totals are confirmed. Keep product-specific return restrictions accessible before checkout.

On desktop, the full cart can use item list + sticky summary. On mobile, stack items and summary. Include an obvious continue-shopping route. Quantity changes, stock conflicts and failures must produce visible feedback without losing the bag.

### Checkout and sign-in

Observed behavior requires an account before checkout. This is a real product decision, not a cosmetic bug.

**First iteration:** Explain the requirement before or at entry, show that the bag is preserved, keep the return destination and make errors actionable. Do not advertise unavailable provider actions without a clear local-preview explanation.

**Separate proposal:** Explore guest checkout after validating merchant requirements. It needs an ownership/recovery model for orders, secure access, cart handling, notifications and support. Hiding the login page alone is not an implementation.

The signed-in form is source-reviewed only. It already has address selection, billing choice, payment-method configuration, delivery quotes, coupons, totals and payment-failure messaging. Improve the hierarchy around these existing capabilities rather than planning them as absent.

Use clear functional headings for delivery, payment and order summary. Preserve server quote validity and price recalculation. Before a final order action, show confirmed total, shipping, discount, applicable COD charge, included tax and relevant policy links. Distinguish unpaid, processing, failed and confirmed order states; never infer payment success from a completed animation.

### Wishlist

Source currently gates saved favourites behind sign-in. Make this requirement clear when the heart is first used. A guest wishlist could reduce early commitment, but needs a defined local storage/merge policy and is P2 work.

Saved cards should show price/availability changes and allow choosing the actual purchasable option. Preserve an actionable empty state and introduce a distinct loading/error state rather than interpreting an unsuccessful catalog request as an empty collection.

### Account, orders, support, returns and updates

These recommendations are based on source, not authenticated visual validation.

- Keep task names direct: Orders, Addresses, Customer care, Returns & refunds, Updates and Profile.
- Make order status understandable with the latest event, next step and expected timing when known. Technical payment/fulfillment/refund sub-states can remain available in detail.
- Reuse a clear status/timeline component across order detail, tracking, returns and notifications, while preserving each domain's actual state.
- Tie care conversations to orders where appropriate. Distinguish waiting for the shopper, waiting for the team and resolved.
- For returns, show item eligibility, reason, requested resolution, progress and separate refund status. A return request must not look like a completed refund.
- Add honest loading, empty, error, retry and long-history states. Source currently contains places where an empty collection is shown before the first request completes; verify before changing.
- Keep privacy/export/deletion-request language accurate. A request is not a completed deletion.

### About, contact and policies

The about page repeats the homepage hero and broad emotional claims. Retain a short philosophy, then add actual evidence supplied by the merchant: who designs/selects the products, verified materials, fit process and customer care.

The contact page source explicitly says care email, phone and hours are unconfigured. This is an operational gap. Present real contact methods and expected response times once confirmed. Maintain useful public help rather than requiring sign-in merely to understand delivery or returns.

Policy source is openly marked as draft/preview. Final publication needs merchant review of shipping charges, eligibility, hygiene exclusions, return costs, timelines and contact facts. This document does not provide legal approval or replace that review.

### Studio / administration

Plan a separate operations-focused pass after an authenticated walkthrough. Retain server role checks and domain rules.

The source already contains catalog, inventory, orders, shipping, homepage, offers, commerce, COD, support, payments, returns, refunds and background-work surfaces. Do not describe these as all missing based on older status documentation.

Replace the long flat tab row with role-appropriate groups such as Catalog, Orders, Customer care, Finance and Content/Settings if validated with operators. Prefer useful queue counts, filters and clear primary actions. Keep financial approvals, evidence trails, immutable outcomes and role boundaries intact. Apply the storefront's colour/font family lightly; dense operational tables need readable sans typography and compact hierarchy.

## 8. Required data and content work

Visual polish cannot solve missing merchandise evidence. Complete the first three rows before real-product sales.

| Work | Current basis | Required change | Dependency |
| --- | --- | --- | --- |
| Colour-specific media | Product has one `image` and `images[]`; variants have colour but no media association | Product/colour gallery association with alt text, order and accurate SKU/cart presentation | Merchant photography and backward-compatible data change |
| Product-specific fit | Shared hard-coded size chart | Versioned chart by style/product type, units and measurement instructions | Merchant-verified sizing |
| Real specifications | `material`, `care`, generic description | Verified composition and category-specific attributes, with an honest unknown state | Merchant product data |
| Product option types | Common size/colour picker | Type-aware apparel size, volume or genuine one-option model | Catalog validation and picker update |
| Matching card presentation | Filter result retains all variants | Matching-variant price/availability context, consistent comparison pricing | Catalog response/presentation contract |
| Shipping promises | Hard-coded bag threshold/PDP copy | One published source for promotional policy; server quotes remain authoritative | Commerce settings and content publication |
| Campaign merchandising | Image, copy and destination are independent | Explicit campaign product set/destination and publish validation | CMS scope decision |
| Contact/policies | Preview paragraphs | Confirmed merchant facts, reviewed content and revision dates | Merchant/operations review |
| Discovery attributes | No structured band/cup/support model in current `Product` type | Add only verified attributes needed by actual assortment | Customer research and category schema |

No body-measurement storage is required for the first fit-guide improvement. If a future fit tool stores personal measurements, define its purpose, retention and consent before implementing storage.

## 9. Motion, accessibility and performance

### Motion rules

- Essential headings, product images, prices, navigation and checkout controls are available immediately.
- Optional reveals should be brief, roughly 150-250 ms, without making text faint while it is being read.
- Keep native vertical scrolling. Avoid mandatory pinned/horizontal storytelling on shopping routes.
- Disable decorative pointer tilt and magnetic movement on touch devices.
- Preserve reduced-motion behavior and an obvious pause action wherever persistent decorative motion remains.
- Use the existing silk canvas only if research or a campaign objective gives it a concrete job. A static macro material photograph may provide more purchase confidence.

### Accessibility acceptance

Check contrast against actual surfaces, not the palette in isolation: 4.5:1 for normal text and 3:1 for qualifying large text. Validate meaningful control/focus indicators, keyboard order, dialog focus/return, text resizing and reflow. Follow the relevant requirements in the [W3C WCAG 2.2 reference](https://www.w3.org/WAI/WCAG22/quickref/).

Use 44 × 44 CSS px as the project's preferred touch target where practical. This is a design target; WCAG 2.2 AA's minimum target-size criterion is 24 × 24 CSS px with specified exceptions. Do not confuse the two.

Do not use tiny legal text or colour alone to communicate selection. Test long names, content expansion, 200% text resizing and narrow layouts. Keyboard focus must remain visible above sticky headers or purchase bars. Automated axe checks support, but do not replace, manual review.

### Performance acceptance

Target field p75 LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1, evaluated separately for mobile and desktop. These are targets from [Google's Web Vitals guidance](https://web.dev/articles/vitals), not measurements taken during this audit.

The [1 November recovery report](Sky_Petal_Local_Recovery_Report.md) records simulated mobile LCP of approximately 5.1 s for home, 4.3 s for shop and 4.9 s for PDP, with workstation calibration caveats. Treat these as historical local lab warnings. They are not fresh results, field metrics or proof that a specific animation caused the delay.

The browser also showed development image warnings during the walkthrough, including hero loading priority and image aspect-ratio guidance. Investigate them against the installed Next.js documentation and retest the production build. Do not equate development compile/navigation delay with deployed performance.

For the redesign: reserve image space, use correctly sized responsive assets, eagerly deliver only genuinely critical imagery, keep decorative WebGL out of the critical path and measure before/after with the same build/device/network conditions. Set a budget for added JavaScript after establishing the actual baseline rather than inventing an unsupported byte limit.

## 10. Implementation backlog

Effort is relative: **S** = one small component/content change, **M** = coordinated page/component work, **L** = cross-layer data or journey work. These are not calendar estimates. Existing in-progress changes must be reviewed before editing shared files.

| Ticket | Priority | Deliverable | Effort | Completion evidence |
| --- | --- | --- | --- | --- |
| SP-D01 | P0 | Fix colour/media truth and product-type option data | L | Each selectable colour has matching media or explicit missing-image treatment; eye-pillow options are merchant-verified; cart uses the selected SKU's media |
| SP-D02 | P0 | Publish verified product specifications and fit charts | L | Product-specific charts/units, useful specs and reviewed merchant content replace assumptions |
| SP-D03 | P1 | Establish shared type, spacing, control and colour tokens | M | Home, catalog, PDP, dialogs and forms use consistent tokens; keyboard/contrast checks pass |
| SP-D04 | P1 | Recompose homepage and campaign merchandising | M | Categories follow hero; priced selection follows categories; one main campaign; stable anchors; campaign imagery and linked assortment agree |
| SP-D05 | P1 | Improve category pages and mobile filters | M | Compact heading, understandable chips, clear selection model, persistent results action and back-navigation state |
| SP-D06 | P1 | Make cards category-aware and price-correct | M | Actions/sizes reflect product type; matching price and compare-price verified with unequal SKU-price fixtures |
| SP-D07 | P1 | Redesign mobile PDP and purchase access | M | Name/price precede gallery; relevant fit help; contextual bar cannot add an unselected SKU; no overlap at narrow widths/large text |
| SP-D08 | P1 | Align bag, policy and checkout delivery messaging | M | Shared published promotion rules; address quote changes update costs; estimates clearly identified |
| SP-D09 | P1 | Improve sign-in-to-checkout handoff | M | Requirement explained, bag retained, return path works, errors are recoverable |
| SP-D10 | P1 | Complete public help/contact/policy content | M | Merchant-confirmed details and reviewed publication; helpful routes remain publicly accessible |
| SP-D11 | P1 | Reduce reveals and verify mobile performance | M | Essential content immediate, reduced motion works, production measurements recorded on comparable profiles |
| SP-D12 | P2 | Improve search and wishlist recovery | M | Useful result/empty/error states; optional guest wishlist decision documented before storage/merge work |
| SP-D13 | P2 | Validate guest checkout proposal | L | Approved journey and secure ownership/recovery design before implementation |
| SP-D14 | P2 | Authenticated account and Studio design audit | M | Task-based review with real/synthetic authorized fixtures; queue/status/action recommendations supported by UI evidence |

### Suggested delivery order

1. **Foundation and truth:** SP-D01/02 merchandise work, SP-D03 tokens, confirmed primary assortment and content inventory. Prototype one category and one product page with long content.
2. **Shopping core:** SP-D05/06/07/08. Validate category → exact variant → bag before redesigning the entire homepage.
3. **Brand entry and help:** SP-D04/09/10/11. Recompose the homepage around the working shopping core and remeasure performance.
4. **Expansion:** SP-D12/13/14 after evidence shows what users/operators still need.

Separate content production from engineering estimates. Verified media, specifications and merchant decisions can be the critical path even when UI changes are small.

### Implementation map

| Area | Existing files to inspect/change in the future |
| --- | --- |
| Shared tokens and responsive rules | [globals.css](src/app/globals.css), [cinematic.css](src/app/cinematic.css), [landing-motion.css](src/app/landing-motion.css) |
| Header, menus, search, newsletter, footer | [chrome.tsx](src/components/chrome.tsx) |
| Homepage structure and motion | [home.tsx](src/components/home.tsx), [use-editorial-motion.ts](src/components/use-editorial-motion.ts), [petal-scene.tsx](src/components/petal-scene.tsx) |
| Catalog and card presentation | [catalog.tsx](src/components/catalog.tsx), [product-card.tsx](src/components/product-card.tsx), [catalog.ts](src/lib/catalog.ts) |
| Product page | [product-detail.tsx](src/components/product-detail.tsx), [product route](src/app/products/%5Bslug%5D/page.tsx) |
| Variant selection, dialogs, bag | [store-provider.tsx](src/components/store-provider.tsx), [cart page](src/app/cart/page.tsx) |
| Checkout | [checkout page](src/app/checkout/page.tsx), [pricing.ts](src/lib/pricing.ts), [commerce-config.ts](src/lib/commerce-config.ts) |
| Public information | [information pages](src/app/%5B...info%5D/page.tsx) |
| Account, wishlist, operations | [account.tsx](src/components/account.tsx), [wishlist page](src/app/wishlist/page.tsx), [order-card.tsx](src/components/order-card.tsx), [admin.tsx](src/components/admin.tsx) |
| Data/API contracts | [types.ts](src/lib/types.ts), [API route](src/app/api/%5B...path%5D/route.ts), existing migrations and domain modules |

Read the applicable installed Next.js guide in `node_modules/next/dist/docs/` before writing application code, as required by this repository's AGENTS.md. This audit creates documentation only.

## 11. Definition of done for the redesign

### Core shopping task

- [ ] From home, a new shopper can identify what Sky Petal sells and open a relevant category without interpreting poetic labels.
- [ ] Categories are the first substantial section after the hero, followed by a priced product selection.
- [ ] A product's chosen colour, size, price, gallery and cart representation agree.
- [ ] Long names, different prices, unavailable combinations and single-option products have sensible layouts and actions.
- [ ] Fit help answers the selected product's actual sizing question and clearly identifies any limitation.
- [ ] The shopper can understand return restrictions and delivery costs/estimates before committing.
- [ ] Sign-in and provider failures preserve context and give a useful next step.

### Responsive and accessible behavior

- [ ] Review at 320, 360, 390/400, 440, 768, 1024 and 1440 CSS px, including short viewports and landscape.
- [ ] On the proposed mobile PDP, product name and price appear before the gallery; controls are reachable without traversing oversized decorative content.
- [ ] At 200% zoom/text resizing, controls remain operable and sticky UI does not hide content or focused elements.
- [ ] No unintended horizontal page scrolling; size tables may use an accessible local overflow treatment when needed.
- [ ] All menu, filter, size, zoom, search and bag dialogs support keyboard entry, Escape, focus containment and focus return.
- [ ] All meaningful text/control states meet applicable contrast requirements; swatches have accessible names and non-colour selection cues.
- [ ] Reduced motion and WebGL failure retain all shopping content and functionality.
- [ ] Mobile keyboard, safe areas and dynamic browser chrome are checked on real devices.

### Reliability and evidence

- [ ] Loading, empty, slow, error, sold-out, expired-quote and payment-uncertain states are designed and verified where relevant.
- [ ] Existing cart persistence, SKU stock rules, account merge, pricing, role checks and payment verification are preserved.
- [ ] Changes to URLs, primary labels, wordmark or reviewed policy text are explicit decisions rather than incidental edits.
- [ ] Production before/after performance measurements include build, device/network profile and limitations.
- [ ] Existing relevant commerce tests pass; add focused tests for new media/price/option behavior rather than snapshotting decorative styling.
- [ ] New screenshots are captured during implementation for the agreed desktop/mobile acceptance matrix.
- [ ] No launch-readiness claim is made from a visual redesign alone. Existing recovery/production gates remain independent.

## 12. Validation and success measures

Run a small task-based study before broad rollout. Recruit actual or representative customers rather than treating the designer's taste as market evidence.

| Task | What to observe |
| --- | --- |
| Find an everyday bra in an available size | Category comprehension, filter use, time to a suitable product and recovery from unavailable options |
| Compare two sleepwear products | Ability to understand price, fabric, care and differences without relying only on imagery |
| Select a colour and size | Whether the photograph, option labels and fit guide support a confident choice |
| Understand return eligibility | Whether the shopper can find and correctly explain the applicable restriction |
| Add to bag and attempt checkout | Surprise at sign-in, lost context, clarity of costs and errors |

For analytics, establish a baseline first. Track category entry, product view, size-guide open, variant selection, successful add-to-bag, checkout entry, sign-in return and verified order completion. Define denominators and segment by device/category. Do not promise a percentage conversion lift without data.

Minimize sensitive commerce telemetry. Do not collect body measurements, credentials, free-text care messages or detailed intimate purchase information just to measure interface success. Follow the site's applicable consent and privacy decisions.

## 13. Decisions and inputs before implementation

The first design iteration can assume Direction A and preserve the current identity. Resolve these inputs when scoping the build:

| Input | Working assumption | What could change |
| --- | --- | --- |
| Core business category | Intimates and sleepwear lead; self-care supports | Homepage product order, category emphasis and campaign choice |
| Brand refresh scope | Preserve wordmark, palette and main editorial type | Direction B only if a larger identity change is desired |
| Product evidence | Current generated assets are preview/editorial material | Real photography/specifications and colour mapping determine launch catalog |
| Sizing | Use verified product charts; no automatic size prediction | A validated fit system could become a separate project |
| Checkout identity | Preserve current account requirement initially | Guest checkout needs a separate approved architecture/journey |
| Merchant promises | Publish only confirmed delivery, care and return facts | Final copy, serviceability and eligibility presentation |
| Campaign content | One strong campaign with a matching product set | New CMS capabilities if nontechnical merchandising control is required |

## 14. Related project evidence

- [README](README.md): startup, integrated architecture and local preview context.
- [Local recovery report](Sky_Petal_Local_Recovery_Report.md): newer implementation evidence and unresolved launch/performance limitations.
- [Implementation coverage audit](Sky_Petal_Implementation_Coverage_Audit.md): broader engineering requirements; this design backlog complements it.
- [Landing motion notes](docs/LANDING_MOTION.md): existing motion design and controls, not a fresh certification.
- [Commerce operations](docs/COMMERCE_OPERATIONS.md): operational context for quotes, orders and service workflows.
- [Original status document](docs/STATUS.md): historical context; some gaps listed there have newer implementation evidence in recovery notes/source.

**Recommended first build slice:** verify one product's real media/options/fit data, modernize the shared type/control tokens, then redesign the mobile product page and its category-to-bag path. Use that slice to establish the design system before expanding the homepage.
