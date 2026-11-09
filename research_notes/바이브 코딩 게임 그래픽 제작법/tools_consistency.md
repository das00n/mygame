# AI Tools for Game Art Assets and Style-Consistency Techniques (as of Nov 2026)

Scope: tools and techniques a small team could use to make, in one consistent style, 8 cut-out (part-separated) hero rigs for Spine-style animation, ~47 enemy/ghost designs, ~314 card illustrations, 3 region backgrounds, a village and UI, for a 2D side-view card-combat roguelike with Korean shamanic folklore themes (painted / ink / hanji paper look). The team already has code-drawn composition sketches for all 314 cards and all characters.

Research date: 2026-11-09. Many sources are vendor pages or third-party aggregators; these are flagged. Prices change often, so treat all figures as "as of the cited page".

---

## Q1. General image generators: quality, style control, licence, API, price per image

### Takeaway
By late 2026 the frontier models are reference-driven "edit" models (OpenAI gpt-image-2 / 2.5 / 2.6, Google Gemini 3.x image models such as Nano Banana Pro and Nano Banana 2.1, Black Forest Labs FLUX.2) that take several reference images per call at roughly $0.02–$0.24 per image through an API. Midjourney still leads for painterly style exploration (--sref, moodboards, personalization), but its V8 line has weaker or unclear character-reference support and no documented public API. For a reproducible style across 300+ images, the options are a trained style (LoRA, Scenario, Ideogram or Recraft custom style) or a reference-image pack sent with every call.

### Cited Findings

**Midjourney**
- Omni Reference (`--oref`, weight `--ow`) is documented as a V7 feature; it uses 2x the GPU time of a normal V7 image and does not work with inpainting/outpainting, which still run on V6.1 (from search snippet of official doc; the page returned 403 to direct fetch) — [Midjourney Docs: Omni Reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997)
- Style Reference (`--sref` with image URL or sref code, weight `--sw`, version `--sv`) is an official feature — [Midjourney Docs: Style Reference](https://docs.midjourney.com/docs/style-reference)
- V8 timeline (third-party, Taiwanese design blog dated 2026-08-21): V8.0 internal test 2026-03-17; V8.1 released 2026-04-14 and default from 2026-06-10; V8.2 default from 2026-07-24. On V8.2: sref codes and moodboards supported; Character Reference (`--cref`) not supported; Omni Reference available but "silently falls back to V7"; personalization profiles from V7 work on V8; Draft/Turbo/Niji are V7-only; Pan/Zoom/Editor still on V6.1; seeds on V8 give "~99% similar", not identical, results — [rar.design, Midjourney V8.2 update guide](https://rar.design/posts/midjourney-v8-2-update-guide)
- Conflicting claims: a March 2026 comparison says V8 supports `--cref` and handles it "more reliably", applies `--sref` "with higher fidelity", and suits realistic/commercial work while V7 suits stylized/illustrative work — [MindStudio, V8 vs V7 (2026-03-20)](https://www.mindstudio.ai/blog/midjourney-v8-vs-v7-comparison); contradicted by [Medium: V8.2 is now the default](https://medium.com/@inchristiely/midjourney-v8-2-is-now-the-default-five-things-that-changed-30c8dffcc492) (cref absent) and [rar.design](https://rar.design/posts/midjourney-v8-2-update-guide). A third guide claims V8.2's new Edit model merges/replaces Omni Reference, Character Reference and Retexture — [Miraflow](https://miraflow.ai/blog/midjourney-v8-2-edit-model-guide-prompts-2026). **Unresolved; verify on the official docs before relying on character reference in Midjourney.**
- Licence: companies with >$1M annual gross revenue (incl. their employees) must use the Pro or Mega plan for commercial use; free-trial output is CC BY-NC 4.0 (third-party legal summary) — [terms.law, Midjourney commercial use 2026](https://terms.law/2026/01/15/midjourney-commercial-use-rights-complete-2026-guide/). Stealth (private) mode only on Pro and Mega (search snippet of official plans page) — [Midjourney Docs: Plans](https://docs.midjourney.com/docs/plans). Midjourney retains a licence to use content even in Stealth (secondary) — [terms.law](https://terms.law/ai-output-rights/midjourney/). ToS version dated 2026-05-27 — [Midjourney ToS](https://docs.midjourney.com/docs/terms-of-service)

**OpenAI image models**
- gpt-image-2 snapshot `gpt-image-2-2026-04-21`; supports generation, edits endpoint, inpainting, batch, and "high-fidelity image inputs" — [OpenAI model page: gpt-image-2](https://developers.openai.com/api/docs/models/gpt-image-2)
- Launch announced 2026-04-21 in the API and Codex — [OpenAI Community: Introducing gpt-image-2](https://community.openai.com/t/introducing-gpt-image-2-available-today-in-the-api-and-codex/1379479). Coverage reports reasoning before generation, ~2K output and better multilingual text rendering (incl. Korean) — [Neurohive](https://neurohive.io/en/news/chatgpt-images-2-0-openai-launches-image-generation-model-with-reasoning-2k-resolution-and-multilingual-text/) (Korean-text claim from search summary; unverified on the page)
- Official token prices (per 1M tokens): gpt-image-2 — image input $8, text input $5, image output $30; gpt-image-2.5-sunburst/-flare and gpt-image-2.6-sunburst/-flare — same rates; gpt-image-1.5 — image output $32; gpt-image-1-mini — image output $8. Batch is half price. Per-image prices are not listed; OpenAI points to a calculator — [OpenAI API Pricing](https://developers.openai.com/api/docs/pricing)
- For scale: at gpt-image-1's launch OpenAI estimated ~$0.02 / $0.07 / $0.19 per square image at low / medium / high quality (2025, older model) — [OpenAI: image generation API](https://openai.com/index/image-generation-api/)
- GPT Image 1.5 released 2025-12-16 — [DataNorth](https://datanorth.ai/news/openai-gpt-image-1-5-released). GPT-Image-2.5 "Flare" and "Sunburst" variants exist and are recommended over 2.0 for edit-heavy work (help page dated 2026-09-09) — [Artlist Help: GPT Image 2 family](https://help.artlist.io/hc/en-us/articles/39018863931165-GPT-Image-2-Family)
- Licence terms for OpenAI output: **not verified in this research** (no OpenAI terms page fetched).

**Google image models (Gemini API, official pricing page)**
- Per-image standard prices: Gemini 2.5 Flash Image (now marked deprecated) $0.039 (batch $0.0195, ≤1024px); Gemini 3 Pro Image ("Nano Banana Pro") $0.134 at 1K/2K, $0.24 at 4K; Gemini 3.1 Flash Image $0.045 (0.5K) / $0.067 (1K) / $0.101 (2K) / $0.151 (4K); Gemini 3.1 Flash Lite Image $0.0336 (1K, batch $0.0168); "Nano Banana 2.1" $0.0336 (1K) / $0.0504 (2K) / $0.113 (4K), batch half. Paid-tier data is not used to improve products — [Google AI Studio pricing](https://aistudio.google.com/docs/pricing)
- Google positioned 2.5 Flash Image on character consistency and "adhering to visual templates" — [Google Developers Blog (Aug 2025)](https://developers.googleblog.com/en/introducing-gemini-2-5-flash-image/)
- Gemini 3 Pro Image accepts up to 14 reference images per request (OpenRouter listing); other sources give 6 object + 5 character refs, or 20 — conflicting — [OpenRouter: gemini-3-pro-image](https://openrouter.ai/google/gemini-3-pro-image-20260528)

**Black Forest Labs FLUX**
- Official API prices: FLUX.2 [pro] $0.03 first MP + $0.015/extra MP; [flex] $0.05; [max] $0.07 + $0.03; [klein] 9B $0.015; [klein] 4B $0.014. Reference images billed per MP (each ref counted as 1 MP when multiple). FLUX.1 Kontext [max] $0.08/img, Kontext [pro] $0.04/img, FLUX 1.1 [pro] $0.04/img. The page also lists a "FLUX 3 Image" model whose references are not charged extra. Self-hosted commercial licences (Builder/Platform/Professional/Enterprise) have no public price — [BFL Pricing](https://bfl.ai/pricing)
- FLUX.2 launched 2025-11-25 with multi-reference support — [BFL blog: FLUX.2](https://bfl.ai/blog/flux-2); [The Decoder](https://the-decoder.com/black-forest-labs-launches-flux-2-with-a-new-multi-reference-feature/)
- Licence split: FLUX.2 [klein] 4B is Apache 2.0 (commercial OK); [klein] 9B and FLUX.2 [dev] are under the FLUX Non-Commercial License (commercial use needs a separate licence) — [VentureBeat (Jan 2026)](https://venturebeat.com/technology/black-forest-labs-launches-open-source-flux-2-klein-to-generate-ai-images-in)
- FLUX.1 Kontext (May 2025) was built for editing that keeps character identity across steps — [DeepLearning.AI The Batch](https://www.deeplearning.ai/the-batch/black-forest-labs-launches-flux-1-kontext-for-generating-and-alterating-images-with-consistent-details). Claim that Kontext editing chains beyond ~6 turns add artifacts comes from a reseller summary — **unverified**.

**Ideogram**
- Official pricing page: Plus $20/mo ($15 annual), Pro $60/mo ($42 annual), pay-as-you-go 1¢/credit; FAQ: "We do not claim ownership of your generated images, and you're free to use them for any purpose, including commercial use." API price table did not load at fetch time — [Ideogram Pricing](http://ideogram.ai/pricing/?pricing_tab=api)
- Search snippet of Ideogram's API pricing page: 3.0 custom models $0.06 (Turbo) / $0.12 (Default) / $0.18 (Quality) per image; self-serve custom-model training $40 one-time — [Ideogram API pricing](https://ideogram.ai/api-pricing/) (snippet only; page now redirects)
- Krea resells Ideogram 3.0 via API at $0.063, or $0.1575 with a character reference — [Krea API docs: Ideogram 3.0](https://www.krea.ai/docs/api-reference/image/ideogram-30.md)

**Recraft**
- Official API prices per image: V4.1 Flash $0.007 raster; V4.1 $0.035 raster / $0.08 SVG vector; V4 Styles $0.035 raster / $0.05 vector; V4 $0.04 / $0.08; V3 $0.04 / $0.08. Style creation $0.005 per request — [Recraft API pricing](https://www.recraft.ai/docs/api-reference/pricing)
- Every V4/V4.1 model accepts a `style_id` or attached style references; a style stores a "match" value — [Recraft API docs: V4 styles](https://www.recraft.ai/docs/api-reference/models/recraft-v4-styles)
- Web app: a custom style can be made from 3–5 reference images; Basic tier (~$10–12/mo) includes a full commercial licence and private images/styles (Recraft's own LLM guide, via search summary) — [Recraft llms.txt](https://www.recraft.ai/llms.txt); free-tier images carry no commercial licence (third-party) — [Flowith (2026-03-20)](https://flowith.io/blog/recraft-pricing-free-vs-pro-vs-team-plan/)

**Leonardo.ai** (official pricing page returned 403; all figures third-party and **unverified**)
- Third-party guides disagree: API tied to paid tiers (Artisan ~$30/mo) vs a separate "API Basic" $9/mo plan; free-tier commercial rights disputed; Consistent Character feature cited as Apprentice (~$12/mo) and above; character reference and custom LoRA/"Elements" training available — [eesel.ai, Leonardo pricing 2026](https://eesel.ai/blog/leonardo-ai-pricing); [Flowith](https://flowith.io/blog/leonardo-ai-pricing-free-vs-apprentice-vs-artisan/)

**Krea**
- Krea has developer docs for training an image style — [Krea docs: train image style](https://www.krea.ai/docs/developers/tutorials/train-image-style.md) (not fetched; pricing and dataset guidance not verified)

**Platform disclosure (relevant to any licence decision)**
- In January 2026 Valve narrowed Steam's AI disclosure to content players consume: "pre-generated" AI assets shipped in the game must be disclosed on the store page; behind-the-scenes efficiency tools need not be — [PC Gamer](https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes/); [Generation Amiga (2026-01-17)](https://www.generationamiga.com/2026/01/17/valve-rewrites-steams-ai-disclosure-rules-for-developers/)

### Inferences
- For 314 cards with existing composition sketches, the cheapest route that keeps both composition and style is an API edit model taking (sketch + 2–6 style reference images + prompt template). At $0.03–$0.13 per image and ~4–8 attempts per card, raw generation cost for all cards would be about $40–$330 (an estimate; human selection and paintover time is the real cost).
- Midjourney is best used for the style-exploration phase (finding the hanji/ink look, then freezing it as an sref code or moodboard), not as the production engine, because of the unclear V8 character-reference situation, the lack of a verified API, and the >$1M-revenue plan rule.
- Self-hosting open weights for commercial work needs care: FLUX.2 [dev] and [klein] 9B are non-commercial; [klein] 4B (Apache 2.0) and SDXL-family models are the clearly usable open options.
- Recraft's vector output ($0.05–$0.08/SVG) fits UI icons and frames more than painted illustrations.

### Gaps
- No official Midjourney source confirmed V8.2 reference-feature support or the existence of a public API.
- OpenAI and Google output-ownership terms were not fetched; per-image costs for gpt-image-2/2.5 by quality/size were not published on the pricing page.
- Ideogram 3.0/4.0 live API prices did not load; Leonardo, Krea pricing unverified.
- No independent, side-by-side benchmark of these models specifically on ink-wash / hanji / painted game art was found.

---

## Q2. Game-specific asset platforms (Scenario, Layer, Leonardo, Ludo)

### Takeaway
Scenario and Layer are "model hubs + training + workflow apps" aimed at studios: you upload your own art, train a private style or character model, then generate through many third-party base models (including OpenAI/Google/FLUX) inside one workspace. Scenario has public plan prices ($15–$75/mo; training needs Pro $45+); Layer is usage-based with no public price list. Ludo is more of an ideation + sprite-animation tool. Studio case studies exist but are vendor-published marketing.

### Cited Findings

**Scenario**
- Plans (official help page): Free $0 (50 CU/day, personal/evaluation use only); Starter from $15/mo (1,500 CU); Pro from $45/mo (5,000 CU, custom model training); Max from $75/mo (10,000 CU); Enterprise from $125/user. Model training requires "Pro or higher". Annual saves 33%. Free-plan outputs never gain commercial rights even after upgrading; paid-plan outputs keep commercial rights after cancelling — [Scenario Help: Pricing & Plans](https://help.scenario.com/en/articles/pricing-plans/)
- Training is a one-time CU charge at job start, "often an order of magnitude or more" than one generation; later generations with the custom model cost normal rates (search summary of Scenario help) — [Scenario Help: Model costs](https://help.scenario.com/articles/8811829644-model-costs-for-asset-generation)
- Dataset guidance varies by page/base model: current LoRA training docs recommend 5–15 images (max 50) — [Scenario Docs: Training models](https://docs.scenario.com/get-started/training/training-models/index.md); "even just 10 images can give you a great style model" — [Scenario Help: Train a Style Model](https://help.scenario.com/en/articles/train-a-style-model/); minimum 5, preferably ≥8 — [Scenario: Gritty comic style](https://help.scenario.com/training-a-gritty-comic-style-custom-generator); Scenario also has a dedicated "consistent character" model guide — [Scenario Help: Train a Consistent Character Model](https://help.scenario.com/en/articles/train-a-consistent-character-model/)
- InnoGames case study (vendor-published, undated, experiments since early 2023): models trained on InnoGames' own images for Elvenar character portraits in an oil-painted style "needed only minimal retouching"; also icons for Sunrise Village, backgrounds, loading screens; claimed "2x" productivity and up to 50% less time to create new assets (Head of Art Dario Berruti) — [Scenario: InnoGames case study](https://www.scenario.com/case-studies/inno-games)
- Ubisoft (Captain Laserhawk) reportedly produced 10,000+ AI-generated characters with Scenario (vendor case study, details thin) — [casestudies.com: Ubisoft x Scenario](https://www.casestudies.com/company/scenario/case-study/how-ubisoft-scaled-character-creation-with-aigc-for-captain-laserhawk). Other named users: Mighty Bear Games, Mad Brain Games, Age of Learning — [Scenario: Mighty Bear](https://www.scenario.com/case-studies/mighty-bear-games)
- Scenario "2D Animation Rigging Sheet" app turns a character concept into a parts sheet for Spine/Live2D/Moho, "separating limbs, torsos, and heads into individual, consistent assets ready for rigging"; listed model: "GPT Image 2.5 Sunburst"; export format and hidden-area handling not stated — [Scenario App: 2D Animation Rigging Sheet](https://www.scenario.com/apps/2d-animation-rigging-sheet)

**Layer.ai**
- Usage-based pricing in Creative Units, no seat fees, all workspaces get the same models/tools; options: one-time unit packs, subscription (cheaper units, partial rollover), Enterprise (sales). No prices on the help page — [Layer Help: subscriptions & pricing](https://help.layer.ai/en/articles/12037310-guide-to-layer-s-subscriptions-pricing); [Layer index](https://www.layer.ai/index.md)
- Layer has a "2D Animation Rigging Sheet / Create Spine Components" tool: input a character reference, output separated limbs/torso/head; PSD export and inpainting of hidden areas not mentioned; no per-run price — [Layer: Create Spine components](https://www.layer.ai/tools/layer--create-spine-components)
- Layer offers custom style training and image-to-video (vendor pages) — [Layer vs Scenario](https://www.layer.ai/alternatives/scenario); [Layer: image to video](https://layer.ai/features/image-to-video)
- Free-tier existence and concrete prices are disputed among aggregators — [Toolradar](https://toolradar.com/tools/layer-ai/pricing). No named Layer customers found except via vendor-run pages; Layer runs on fal infrastructure — [fal: Layer customer case](https://fal.ai/customer-case/layer) (not fetched)

**Ludo.ai**
- Sprite generator launched Oct 2025: animate any generated or uploaded sprite via text prompts (moves, poses, attacks) — [App Developer Magazine](https://appdevelopermagazine.com/ludo.ai-debuts-sprite-generator-for-instant-2d-animation-creation/amp/)
- Pricing page: text → animated character with downloadable sprite sheet; 30 free trial credits; Enterprise custom — [Ludo Pricing](https://ludo.ai/pricing). Indie plan ~$20/mo per third parties (unverified) — [Ludo vs Scenario (Ludo-authored)](https://ludo.ai/compare/ludo-vs-scenario)

**Leonardo game features**: see Q1 (unverified third-party data only).

### Inferences
- Scenario Pro ($45/mo, 5,000 CU) is the lowest-friction way to train a private hanji/ink style model plus per-hero character models without running ComfyUI; the InnoGames "oil-painted portrait" case is the closest documented analogue to a painted card-art style (vendor-sourced).
- The rigging-sheet apps on Scenario and Layer output a parts sheet, not a finished Spine-ready PSD with painted-under joints; expect manual cleanup (see Q4).

### Gaps
- No public Layer price list; no CU cost for Scenario/Layer rigging-sheet apps.
- No independent (non-vendor) review measuring consistency across hundreds of assets on Scenario or Layer.
- InnoGames' own blog post about Scenario returned HTTP 503 and could not be read.

---

## Q3. Consistency techniques (LoRA, style refs, IP-Adapter, ControlNet, turnarounds, seeds/templates, inpainting, img2img from sketches)

### Takeaway
The documented recipe for hundreds of consistent images is: (1) fix the style with a trained style model (LoRA or platform custom model, ~10–50 curated images) or a fixed set of style reference images; (2) fix composition with a structure input (ControlNet lineart/scribble/depth, or sketch-as-reference in an edit model); (3) fix characters with turnaround/model sheets used as references or a per-character LoRA; (4) use a fixed prompt template + style tokens; (5) fix defects by inpainting and human paintover. A 2026 academic card study using FLUX.1-dev + 2 style LoRAs + fixed style tokens got 88.4% "acceptable" images but ~1 in 10 still failed.

### Cited Findings

**LoRA / custom style training**
- Dataset sizes quoted range widely: 5–15 (max 50) for Scenario's current LoRA training — [Scenario Docs](https://docs.scenario.com/get-started/training/training-models/index.md); 50–100 or 50–200 images for a style LoRA with "quality over quantity" (third-party guides) — [MindStudio: SDXL LoRA styles](https://www.mindstudio.ai/blog/what-is-sdxl-lora-custom-styles/); an older Civitai-hosted SDXL style article aims for 300–500 varied images (mirror site, low reliability) — [civitai-proxy mirror](https://civitai-proxy.pages.dev/articles/14314)
- Caption advice for style LoRAs: describe the artistic elements, use a consistent trigger word; kohya needs a .txt caption per image; SDXL trains at 1024px (secondary guides) — [rentry SDXL LoRA Guide](https://rentry.co/SDXL-Lora-Guide); [rentry LoRA dataset creation (Feb 2025)](https://rentry.co/lora-dataset-creation)
- Repetitive datasets "limit the model's versatility" — [Scenario: training a style LoRA](https://help.scenario.com/en/articles/training-a-style-lora)
- Low-cost self-training is possible (2026 guide titled "12 steps, $2 or free") — [Tech Insider](https://tech-insider.org/train-custom-ai-image-lora-2026/) (not fetched; claim from title)

**Style reference images / codes**
- Midjourney `--sref` + `--sw`, sref codes, moodboards and personalization profiles (see Q1) — [Midjourney Docs: Style Reference](https://docs.midjourney.com/docs/style-reference); [rar.design](https://rar.design/posts/midjourney-v8-2-update-guide)
- Recraft style from 3–5 images, reusable `style_id` via API — [Recraft API docs](https://www.recraft.ai/docs/api-reference/models/recraft-v4-styles)
- Multi-reference edit models: FLUX.2 (all variants support multi-reference) — [The Decoder](https://the-decoder.com/black-forest-labs-launches-flux-2-with-a-new-multi-reference-feature/); Gemini 3 Pro Image up to 14 refs (conflicting counts) — [OpenRouter](https://openrouter.ai/google/gemini-3-pro-image-20260528)

**IP-Adapter + ControlNet (open-model route, ComfyUI)**
- Recipe: IP-Adapter for style transfer plus a lineart ControlNet so output contours match the uploaded lines; switching txt2img ↔ img2img style transfer by changing ControlNet strength — [InstaSD: SDXL style transfer with IPAdapter and ControlNet](https://instasd.com/post/sdxl-style-transfer-with-ipadapter-and-controlnet)
- For SDXL in IPAdapter Plus V2, set weight type "Style Transfer (SDXL)" — [RunComfy: IPAdapter Plus style transfer](https://www.runcomfy.com/comfyui-workflows/comfyui-ipadapter-plus-style-transfer-made-easy)
- MistoLine: SDXL ControlNet for arbitrary line art incl. sketches (openrail++ licence) — [Hugging Face: MistoLine](https://huggingface.co/TheMistoAI/MistoLine/blob/refs%2Fpr%2F3/README.md)
- When style transfer adds unwanted elements, raise ControlNet strength; choose a style reference with content similar to the target (tutorial advice) — [Comflowy](https://comflowy.substack.com/p/how-to-perform-style-transfer-using)

**Character turnaround / model sheets**
- Common practice: lock character identity with a turnaround (e.g., five orthographic views at consistent height/lighting) before making any other asset; pipeline "prompt → reference-locked turnaround → sprite/3D → animation" (vendor blogs) — [Wireflow](https://www.wireflow.ai/blog/how-to-design-characters-with-ai-for-games-and-animation); [Sorceress](https://sorceress.games/blog/ai-character-generator-stay-on-model-with-reference-images-2026)
- An indie forum post estimates ~70–80% consistency on a first pass from reference-based prompting (anecdotal) — [Jeff Bullas forum](https://www.jeffbullas.com/reply/125997/)
- A 2026 post claims a full sprite sheet from one reference with GPT Image 2.5 (title only, not read) — [Indie Hackers](https://www.indiehackers.com/post/gpt-image-2-5-a-full-sprite-sheet-from-one-reference-110562d19f)

**Seeds and prompt templates**
- Midjourney V8 seeds reproduce ~99% similar, not identical, images — [rar.design](https://rar.design/posts/midjourney-v8-2-update-guide)
- Card study used fixed general-purpose positive/negative style tokens appended to each card's name/type/description — [arXiv 2604.27972](https://arxiv.org/html/2604.27972v1)
- A solo card-game maker kept consistency with a fixed card grid layout and detailed style prompts — [Prototyp Digital](https://prototyp.digital/blog/how-to-build-card-game-with-ai/)

**Inpainting / fixing hands and faces**
- gpt-image-2 lists inpainting as a supported feature — [OpenAI: gpt-image-2](https://developers.openai.com/api/docs/models/gpt-image-2)
- Midjourney inpainting still runs on V6.1 and is incompatible with Omni Reference — [Midjourney Docs: Omni Reference](https://docs.midjourney.com/hc/en-us/articles/36285124473997) (snippet)
- Champions of Otherworldly Magic: "everything needs to be edited and filtered" to remove extra fingers etc. — [Game World Observer (2024-04-09)](https://gameworldobserver.com/2024/04/09/champions-of-otherworldly-magic-ai-artist-15k-per-month)

**img2img from rough sketches**
- Sketch-to-image via ControlNet (+ IP-Adapter for style) is an established research and practice area — [arXiv 2412.11519](https://arxiv.org/pdf/2412.11519v1); [MistoLine](https://huggingface.co/TheMistoAI/MistoLine/blob/refs%2Fpr%2F3/README.md)
- Hosted edit models accept image inputs (gpt-image-2 edits endpoint; FLUX.2 / Gemini multi-reference), so a sketch can be sent as one input alongside style references — [OpenAI](https://developers.openai.com/api/docs/models/gpt-image-2); [BFL Pricing](https://bfl.ai/pricing)

### Inferences
- The team's 314 code-drawn card sketches map directly onto either (a) ComfyUI: SDXL or FLUX.2 [klein] 4B + trained hanji/ink style LoRA + lineart/scribble ControlNet, or (b) hosted edit models: sketch + fixed style-reference pack + prompt template. Route (a) gives the most control and repeatability; route (b) needs less setup but less deterministic.
- A practical style "bible": 15–30 curated, varied images in the target hanji/ink look (made first with Midjourney/edit models and hand-corrected, or commissioned), used both as LoRA training data and as the standard reference pack.
- Budget for a ~10% outright failure rate plus touch-ups even with a locked pipeline (from the card study's 11.6% non-convincing rate).

### Gaps
- No primary kohya-ss or Civitai official documentation was read; dataset-size advice is from secondary guides and conflicts.
- No source tested ink-wash / hanji paper texture consistency specifically; paper-grain texture may need to be applied as a separate overlay (inference, untested).
- No 2026 data comparing LoRA vs reference-image consistency on the same project.

---

## Q4. From illustration to animation: part separation for Spine/Live2D, AI sprite/animation tools, video for VFX

### Takeaway
Automatic part separation became real in 2026 but is not yet "one click to Spine": See-through (open-source, Feb–Apr 2026) produces a ~23-layer PSD with inpainted hidden areas for anime-style characters; Qwen-Image-Layered (CVPR 2026, Apache 2.0) splits any image into RGBA layers but not into body parts; Scenario/Layer rigging-sheet apps output parts sheets. All need human cleanup to meet Spine's cutting rules (painted-under joints, overlaps, front/back layers). Pixel-art animation tools (PixelLab, Retro Diffusion) are mature but style-mismatched for painted/ink art; image-to-video works for loops and VFX reference but needs frame extraction and cleanup.

### Cited Findings

**What Spine needs from cut-out art (ground truth)**
- Draw the full shape of covered parts (e.g., hair behind head), round off overlapping ends at joints, put each animated part on its own layer, separate front/back elements, keep outlines on both sides of joints, start meshes from straight (not pre-bent) art, import PSD directly with tagged layer names, RGB not CMYK (Esoteric Software, 2025-03-06) — [Spine blog: How to cut your assets for animation](https://eu.esotericsoftware.com/blog/How-to-cut-your-assets-for-animation)

**AI layer / part separation**
- See-through (arXiv 2602.03749, submitted 2026-02-03): single anime illustration → fully inpainted, semantically distinct layers with inferred drawing order, aimed at turning static art into 2.5D (Live2D-style) models; trained with supervision bootstrapped from commercial Live2D models — [arXiv abstract](https://arxiv.org/abs/2602.03749v1). The HTML version describes 19 semantic body parts and a dataset of 9,102 annotated Live2D models (from search summary) — [arXiv HTML](https://arxiv.org/html/2602.03749)
- See-through code (Apache-2.0 repo; weights licence not stated): outputs a layered PSD with up to 23 layers (V3, 2026-04-14), ~12–16 GB VRAM default, 8 GB options; authors say it is not a full image-to-Live2D pipeline (no rigging/physics), and decomposition favors semantic correctness over a rigger's artistic layer choices; no Spine export; HF Spaces demo limited to ~1–2 runs/day — [GitHub: shitagaki-lab/see-through](https://github.com/shitagaki-lab/see-through)
- A third-party hands-on test of a 23-layer See-through decomposition exists — [lilting.ch test](https://lilting.ch/en/articles/see-through-anime-layer-decomposition) (not fetched)
- Qwen-Image-Layered (arXiv Dec 2025, CVPR 2026): one RGB image → variable number (e.g., 3 or 8) of semantically separated RGBA layers, recursive decomposition, Apache 2.0 code, weights on Hugging Face, diffusers pipeline — [GitHub: QwenLM/Qwen-Image-Layered](https://github.com/QwenLM/Qwen-Image-Layered); [CVPR 2026 paper](https://openaccess.thecvf.com/content/CVPR2026/html/Yin_Qwen-Image-Layered_Towards_Inherent_Editability_via_Layer_Decomposition_CVPR_2026_paper.html); [Hugging Face](https://huggingface.co/Qwen/Qwen-Image-Layered)
- Commercial splitters: KomikoAI "AI Layer Splitter" (claims Live2D/Spine-ready parts) — [Komiko blog](https://komiko-app-git-feat-setting-komiko.vercel.app/blog/how-to-instantly-split-anime-art-into-layers-for-animation-and-rigging); "anysplit" (layer separation + hidden-area inpainting, PSD export, seeking feedback on Spine forum) — [Spine forum](https://fr.esotericsoftware.com/forum/d/30533-seeking-feedback-and-opinions-on-new-tool); LlamaGen AI Layer Splitter — [LlamaGen](https://llamagen.ai/en-gb/features/ai-layer-splitter); an older Spine-forum showcase of segmentation-based automation — [Spine forum showcase](https://vi.esotericsoftware.com/forum/d/23849-automating-layer-separation-for-spine2d). All vendor/marketing; quality unverified.
- Scenario and Layer rigging-sheet apps: see Q2 — [Scenario](https://www.scenario.com/apps/2d-animation-rigging-sheet); [Layer](https://www.layer.ai/tools/layer--create-spine-components)

**AI 2D animation / sprite tools**
- PixelLab: pixel-art tool with API; "animate with skeleton" endpoint generates 4 frames from skeleton poses; text-to-animation cost scales with size and frame count; ~$0.011 per 64–128px call shown on the API page (unclear which tool) — [PixelLab API](https://pixellab.ai/pixellab-api); [PixelLab docs: animate with skeleton](https://www.pixellab.ai/docs/tools/animate-with-skeleton). Pricing page returned 404 at fetch.
- Retro Diffusion: pixel-art generator; third-party price list RD Fast $0.03/img, RD Pro $0.18/img, Animations from $0.07/clip (walk/combat, 8-direction) — [aipicks.jp](https://aipicks.jp/tool/retro-diffusion/pricing); Aseprite extension $65 on itch.io with licence inside the files — [itch.io](https://astropulse.itch.io/retrodiffusion); commercial use allowed per maker (secondary) — [MacMyths](https://macmyths.com/apps/retro-diffusion/)
- Ludo.ai sprite animation from text prompts (see Q2) — [App Developer Magazine](https://appdevelopermagazine.com/ludo.ai-debuts-sprite-generator-for-instant-2d-animation-creation/amp/)
- Scenario "Action Sprite Studio" app exists — [Scenario app](https://www.scenario.com/apps/action-sprite-studio) (not fetched)

**Image-to-video for loops and VFX**
- Loop advice: cyclical motions (idle, run, hover) loop best; flat background; ~12–15 fps; cut before repeat — [LoopSprite guide](https://loopsprite.pages.dev/extract/guide-ai-video-to-sprites.html); Kling suggests subtle continuous motion and trimming/crossfading ends — [Kling](https://kling.ai/topics/animate-pixel-art-ai); Veo image-to-video clips are 8 s — [Kaiber Help](https://helpcenter.kaiber.ai/articles/10001281-generating-videos)
- QA check: the loop join should not "pop" when the last frame returns to the first — [Sorceress](https://sorceress.games/blog/pick-an-ai-animation-image-generator-frame-loop-test)
- Layer offers image-to-video inside its platform — [Layer](https://layer.ai/features/image-to-video)

### Inferences
- What works today: (1) generating a hero in a neutral, straight-limbed pose from the locked style + turnaround; (2) auto-decomposition (See-through for anime-proportioned art, Qwen-Image-Layered or a rigging-sheet app otherwise) as a *draft*; (3) a human (or AI inpainting per part) paints the hidden areas and joint overlaps per Spine's rules; (4) human rigging in Spine. 8 heroes is a small enough number to make this manual step affordable.
- What does not work yet (per sources): a reliable one-step "illustration → Spine-ready, correctly layered PSD"; See-through is trained on anime/Live2D data, so painted/ink characters with non-anime proportions may decompose worse (untested inference).
- Pixel-art animators (PixelLab, Retro Diffusion) do not fit a painted/ink look; image-to-video is better suited to ambient loops (ghost flicker, talisman glow, background mist) and as VFX reference than to rig animation.

### Gaps
- No published quality evaluation of See-through or Qwen-Image-Layered on non-anime painted art.
- No source documented a complete AI-assisted Spine production pipeline for a shipped game.
- No verified per-run cost for Scenario/Layer rigging sheets; PixelLab official pricing not retrieved.
- No VFX-specific (alpha, additive blending) AI generation guidance found.

---

## Q5. 3D generators (Meshy, Tripo, Rodin/Hyper3D, Hunyuan3D) as they relate to 2D pipelines

### Takeaway
Image-to-3D tools are maturing (retopo, rigging, texturing), but no source documented a 3D → render → 2D painted-sprite pipeline. For a 2D painted card game their likely use is limited to pose/lighting blocking: make a rough 3D figure, render poses, feed renders as depth/pose ControlNet or reference inputs.

### Cited Findings
- Hunyuan3D Studio (Tencent, arXiv 2509.12815, Sept 2025) describes an end-to-end game-asset pipeline: geometry, segmentation, retopology, UV, texturing, animation — [arXiv 2509.12815](https://arxiv.org/abs/2509.12815)
- Scenario integrates multiple 3D generators and publishes a comparison — [Scenario Help: Comparing generative 3D models](https://help.scenario.com/en/articles/comparing-generative-3d-models/)
- Vendor blog view: Tripo covers generation, retopology, rigging, stylization and suits game-ready characters; Meshy is strong on hard-surface props, weaker on stylized creatures, with texture consistency varying between generations — [Sorceress](https://sorceress.games/blog/tripo-ai-image-to-3d-model-in-your-browser) (vendor/competitor content)

### Inferences
- For this project, 3D is optional: a rough 3D mannequin or generated 3D ghost could give consistent depth/pose maps for ControlNet across many card angles, but the existing code-drawn sketches already provide composition.

### Gaps
- No source found on render-to-2D sprite pipelines (orthographic renders, toon/ink shading, frame sheets) using Meshy/Tripo/Rodin/Hunyuan3D; Rodin/Hyper3D not researched (no results).

---

## Q6. Card games: documented cases of 100+ card illustrations with AI in a consistent style

### Takeaway
Documented cases are few. The best-documented is an April 2026 academic Pokémon-card study (196 cards, FLUX.1-dev + 2 style LoRAs + fixed style tokens, ~88% acceptable). The best-known commercial case, Champions of Otherworldly Magic (2024), used one experienced artist producing 1,000+ AI images over six months with editing and filtering of everything. Steam titles disclosing AI card art exist (e.g., Card&Dungeon) but do not publish pipeline details. Public backlash risk is documented.

### Cited Findings
- **Academic Pokémon-card study (arXiv 2604.27972, 2026-04-30):** local ComfyUI, FLUX.1-dev-Q8, two style LoRAs (Niji style + Ken Sugimori Pokémon style), fixed positive/negative style tokens added to card name/type/description; 49 participants produced 196 cards; ~20 s per image on an RTX 5090; visual aesthetics 4.25/5; expectation match: 35.5% convincing first try, 38.4% after slight polishing, 14.5% after adjustment, 11.6% not convincing (88.4% acceptable); only 0.9% of participants manually touched up images; authors say ~1 in 10 failures means "not yet production-ready" and that style constraints trade range for unity — [arXiv 2604.27972](https://arxiv.org/html/2604.27972v1)
- **Champions of Otherworldly Magic (digital TCG, reports April 2024 — outdated tools):** studio paid an anonymous "AI artist" $15,000/month for ~10 hours/month ($90,000 total); CEO Miles Malec said the artist made 1,000+ images in six months; "AI can do bulk of the work/initial generating but to make sure no errors, extra fingers, etc everything needs to be edited and filtered"; artist described as having 15 years of digital art experience; tools not named — [Game World Observer](https://gameworldobserver.com/2024/04/09/champions-of-otherworldly-magic-ai-artist-15k-per-month); [PC Gamer](https://www.pcgamer.com/games/card-games/champions-tcg-ai-artist/)
- **Card&Dungeon (Steam, SDBD Studio):** discloses generative AI for card, character, monster, UI and environment art; "All AI-assisted material was reviewed and selected by the developer, then edited or processed where appropriate" — [AI Transparency Index: Card&Dungeon](https://aitransparencyindex.com/products/steam/5006590)
- **Solo designer case:** each card had "its own vibe, effect and tone", making consistency hard; fixed by a fixed grid layout and detailed style prompts — [Prototyp Digital](https://prototyp.digital/blog/how-to-build-card-game-with-ai/)
- **Backlash example:** an itch.io developer replaced DALL-E card images with human art after criticism — [itch.io post](https://itch.io/post/11048035)
- **Vendor process advice:** generate controlled variants, pass a human review gate, assign cleanup (crop, transparency, palette, human paintover) explicitly — [Seeles](https://www.seeles.ai/resources/blogs/can-ai-art-be-used-in-steam-games)
- A 2026 blog lists several "200-card / 160-card" case studies with budgets, but names and figures could not be verified — [aimage.top](https://www.aimage.top/blog/tabletop-board-game-designers-using-ai-art-creative-cases-2026) (**unverified; do not rely**)

### Inferences
- Both documented cases point to the same shape: one locked style system (LoRA/tokens or one skilled operator), high volume of generations (1,000+ for a few hundred final cards), and a human editing/selection pass on every card. For 314 cards, planning ~3–5x generations per final card and a paintover/selection pass is consistent with these cases.
- Because Steam requires disclosure of shipped AI art (Q1) and backlash is documented, a visible human paintover layer (ink linework, hanji texture, frame) helps both quality and perception (opinion/inference).

### Gaps
- No documented 2025–2026 commercial roguelike deckbuilder publishing its AI card-art pipeline with iteration counts and paintover hours.
- No GDC 2025/2026 talk or 80.lv / Game Developer article on AI card-art pipelines was found in this search pass.
