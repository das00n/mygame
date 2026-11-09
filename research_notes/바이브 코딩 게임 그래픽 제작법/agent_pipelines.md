# Coding agents wired to image-generation APIs (Claude Code / Cursor / Codex): MCP servers, pipelines, prices, limits

Research date: 2026-11-09. Pages were read on that date. Prices change often, so each figure carries its source, and figures that come only from third parties are marked **(secondary)**. Items seen only in search snippets, without fetching the page, are marked **(snippet only, unverified)**. Nothing was installed and no API was called.

## 1. MCP servers and integrations for image generation: what each exposes, and how mature it is

### Takeaway
Official or vendor-hosted MCP servers now exist for **Replicate** (`mcp.replicate.com`), **Scenario** (`mcp.scenario.com/mcp`, OAuth) and **ComfyUI** (`Comfy-Org/comfy-mcp` v0.10.0 for a local ComfyUI, announced 2026-08-11, plus a separate Comfy Cloud MCP). **fal.ai, Stability and Google image models** are mostly reached through community servers. Google's "genmedia" MCP is published by Google but labelled "not an officially supported Google product". **OpenAI** has no image MCP; Codex ships a built-in `$imagegen` skill instead. **Midjourney** has no official API, and the unofficial MCPs drive the consumer UI through browser automation, which its terms of service prohibit. Several game-specific vendors (Sprixen, Ludo, AutoSprite, Gamelabs) sell hosted MCPs that return finished sprite sheets or atlases.

### Cited Findings
**Replicate (official)**
- Replicate runs an official hosted MCP server and calls the remote option "the easiest" and recommended one. There is also a public npm package to run it locally. — [Replicate blog](https://replicate.com/blog/remote-mcp-server)
- The documented client config is `npx -y mcp-remote@latest https://mcp.replicate.com/sse`. Claude Code instructions use the user scope. — [Replicate MCP page](https://mcp.replicate.com/)
- The local version uses `REPLICATE_API_TOKEN` and "supports all HTTP API operations". The remote one opens a web auth flow where you paste a token. **(secondary)** — [Developers Digest](https://www.developersdigest.tech/mcp-servers/replicate)
- The older community `deepfates/mcp-replicate` is archived ("NOT IN ACTIVE DEVELOPMENT… The company now offers an official MCP server"). — [mcpservers.org listing](https://mcpservers.org/servers/deepfates/mcp-replicate)

**fal.ai (community only; no first-party fal MCP found)**
- `raveenb/fal-mcp-server`: MIT licence, about 61 stars, 137 commits, 29 open issues. It has 18 tools: `generate_image`, `generate_image_structured`, `generate_image_from_image`, `remove_background`, `upscale_image`, `edit_image`, `inpaint_image`, `resize_image`, `compose_images`, video and music tools, and `list_models`, `recommend_model`, `get_pricing`, `get_usage`, `upload_file`. It discovers fal's "600+" models dynamically with a TTL cache. Transports are stdio, HTTP/SSE and a dual mode. It installs as a Claude Code plugin (`/plugin marketplace add raveenb/fal-mcp-server`) and needs `FAL_KEY`. Long jobs use fal's queue API. The fetched page was mirrored under `luminarylane/fal-mcp-server`, so check which repository you mean. — [GitHub raveenb/fal-mcp-server](https://github.com/raveenb/fal-mcp-server)
- `Gravicity/fal-mcp-server` (npm `fal-mcp-server`) installs with one line: `claude mcp add fal --env "FAL_KEY=…" -- npx -y fal-mcp-server`. **(snippet only)** — [Glama listing](https://glama.ai/mcp/servers/@Gravicity/fal-mcp-server/blob/187bfbe2841238835d96ee3beb2bbcfcac123c00/README.md)
- `guillaumeboniface/fal-mcp` is a Python FastMCP server with generation, **reference-guided generation, LoRA**, and editing tools, configured through `.mcp.json` and run with `uv`. **(snippet only)** — [Glama listing](https://glama.ai/mcp/servers/@guillaumeboniface/fal-mcp/blob/ec79295065c1fbc7d00ed8ad61eda541ff35dd87/README.md)
- Single-model wrappers also exist for GPT-image-1 (htakeda777) and Nano Banana (dandadadandan). **(snippet only)** — [Glama htakeda777](https://glama.ai/mcp/servers/htakeda777/fal_openai_image1); [LobeHub dandadadandan](https://lobehub.com/mcp/dandadadandan-mcp-fal)

**ComfyUI**
- `Comfy-Org/comfy-mcp` (PyPI `comfy-mcp`, v0.10.0) was announced on 2026-08-11. It is a stdio server built on `comfy-cli` that drives a local ComfyUI (default `127.0.0.1:8188`). Named tools include `server_info`, `run_workflow`, `fetch_outputs`, `search_templates`, `fetch_template`, `partner_generate`, `system_stats` and `free_memory`. It also validates graphs, edits template slots, launches and stops ComfyUI, and tails logs. It works with Claude Code, Claude Desktop and Cursor. At startup it reports the machine's specs: machines with under 8 GB VRAM, no confirmed GPU, or Apple Silicon with under 32 GB are routed to partner nodes or to the **Comfy Cloud MCP** (docs.comfy.org/agent-tools/cloud, which runs workflows on Comfy Cloud GPUs over HTTP). `COMFYUI_URL` can point it at a remote machine. — [ComfyUI Wiki news, 2026-08-11](https://comfyui-wiki.com/en/news/2026-08-11-comfy-mcp-local-server)
- Many community ComfyUI MCPs exist: joenorton (Python, Apache-2.0), purlieu-studios (aimed at game assets, with `generate_image` and `list_workflows`), alecc08 (TypeScript), MetaBrain-Labs (npm, "transforms ComfyUI workflows into AI-callable tools"), ericwanghp, and miller-joe (streamable HTTP; submits, polls, and returns URLs). **(snippet only; maintenance not checked)** — [alecc08](https://github.com/alecc08/comfyui-mcp); [PurlieuStudios on Glama](https://glama.ai/mcp/servers/@PurlieuStudios/comfyui-mcp); [joenorton](https://awesome.ecosyste.ms/projects/github.com%2Fjoenorton%2Fcomfyui-mcp-server); [miller-joe](https://glama.ai/mcp/servers/miller-joe/comfyui-mcp); [MetaBrain-Labs](https://claudemarketplaces.com/mcp/io.github.metabrain-labs/comfyui-mcp-server)

**Scenario (official, aimed at game studios)**
- The official Scenario MCP server is at `https://mcp.scenario.com/mcp`, with OAuth recommended. It is documented for Claude, Cursor and VS Code. Help articles are dated 2026-04-09 and 2026-07-09. It "connects your AI coding agent directly to your Scenario workspace", and the resources reference lists an asset proxy and "Scenario Agent Skills". **(search summary of official pages)** — [Scenario help: getting started with MCP](https://help.scenario.com/en/articles/getting-started-with-the-scenario-mcp-server); [docs.scenario.com MCP](https://docs.scenario.com/get-started/mcp/mcp); [mcp.scenario.com docs](https://mcp.scenario.com/docs); [Scenario blog](https://www.scenario.com/blog/Scenario-Is-Now-Available-Directly-in-Your-AI-Agent)
- Community alternatives: `pasie15/scenario.com-mcp-server` (txt2img, img2img, inpainting, ControlNet, **model training**, asset management; uses `SCENARIO_API_KEY` and `SCENARIO_API_SECRET`) and a Unity-oriented Cloudflare Workers server with 10 tools. Do not confuse these with LangWatch's unrelated "Scenario" agent-testing MCP. **(snippet only)** — [Glama pasie15](https://glama.ai/mcp/servers/pasie15/scenario.com-mcp-server); [LobeHub scenario-asset-mcp](https://lobehub.com/mcp/yourusername-scenario-asset-mcp)

**Google (Gemini image / Imagen)**
- The "MCP Servers for Google Cloud Genmedia APIs" live in Google's Vertex AI Creative Studio repository. They cover image (Imagen/Gemini), video and other media, and need a GCP project, a region and a GCS bucket. They run over stdio, or over Streamable HTTP with a flag. The page says this is "not an officially supported Google product". **(search summary)** — [Genmedia MCP docs](https://googlecloudplatform.github.io/vertex-ai-creative-studio/experiments/mcp-genmedia/)
- Community options: `anton-proto/mcp-imagen` (Gemini API key or Vertex) and `gemini-media-mcp` on PyPI (images need only a Gemini API key; video needs Vertex). Imagen generally requires Vertex AI, while Gemini image models work on both AI Studio and Vertex. **(snippet only)** — [mcp-imagen](https://glama.ai/mcp/servers/anton-proto/mcp-imagen); [gemini-media-mcp on PyPI](https://pypi.org/project/gemini-media-mcp/)

**Stability AI (community only)**
- No official Stability MCP turned up. `tadasant/mcp-server-stability-ai` offers generate (`generate-image-sd35`), edit, upscale, and `remove-background` (about $0.02 per call), with Stable Image Ultra added later. `keizerkarel1` has a Python fork whose author says it was "vibecoded". `rmrfslashbin/mcp-server-images` covers both Stability and BFL Flux. **(snippet only)** — [mcpservers.org tadasant](https://mcpservers.org/servers/tadasant/mcp-server-stability-ai); [LobeHub keizerkarel1](https://lobehub.com/mcp/keizerkarel1-stability-ai-mcp-server); [Glama rmrfslashbin](https://glama.ai/mcp/servers/@rmrfslashbin/mcp-server-images/blob/0a26d70d9ad410d2a3af169a795187d88036f971/README.md)

**OpenAI images**
- Codex CLI generates images through a built-in `$imagegen` skill, not an MCP server. According to a third-party blog, gpt-image-2 launched on 2026-04-21 and became the default. The skill can be installed elsewhere with `npx skills add https://github.com/openai/codex --skill imagegen`. Sources disagree on whether it needs `OPENAI_API_KEY` or works with a ChatGPT login alone. **(secondary)** — [Daniel Vaughan, Codex CLI image generation (2026-04-27)](https://codex.danielvaughan.com/2026/04/27/codex-cli-image-generation-gpt-image-2-visual-development-workflows/); [skills.sh openai/codex/imagegen](https://skills.sh/openai/codex/imagegen)
- OpenAI's image guide says "You may need to complete API Organization Verification before using GPT Image models". — [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

**Leonardo**
- Leonardo's docs have an "MCP Server" page, but its content was not visible in results, so treat it as unverified. A community `leonardo-ai-mcp-server` by @nikolausm offers `generate_image`, `check_credits` and `list_models`. **(snippet only)** — [mcp.so Leonardo AI MCP](https://mcp.so/servers/leonardo-ai-mcp-server); [Leonardo docs: pricing calculator](https://docs.leonardo.ai/v2.0/docs/plan-with-the-pricing-calculator)

**Midjourney**
- No official public API: "as of September 30, 2026, Midjourney has not published a public developer API". The terms of service (effective 2026-05-27) prohibit automated access. Unofficial wrappers can break or get accounts banned. `ehmo/mj` is an unofficial CLI and MCP that drives a Camoufox browser with your own account. **(secondary, vendor blogs selling alternatives)** — [aifreeapi Midjourney API guide](https://www.aifreeapi.com/en/posts/midjourney-api-guide.md); [ehmo/mj on awesome.ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Fehmo%2Fmj); [Midjourney ToS summary](https://conductatlas.com/platform/midjourney/midjourney-terms-of-service/)

**Game-specific hosted MCPs (vendor marketing)**
- Sprixen, AutoSprite, Gamelabs Studio and Ludo.ai offer MCP servers that Claude Code connects to over HTTP. Generation is asynchronous: `generate_sprite` and `generate_animation` return a job ID straight away. **(snippet only, vendor claims)** — [Sprixen step-by-step](https://sprixen.com/blog/generate-game-sprites-from-claude-code-mcp); [AutoSprite Claude](https://www.autosprite.io/claude); [Gamelabs](https://gamelabstudio.co/blog/how-to-generate-spritesheet-claude-code); [Ludo](https://ludo.ai/tools/game-assets-in-claude)

**Claude Code's own MCP plumbing (relevant to image tools)**
- Servers are added with `claude mcp add --transport http|stdio`. Project scope is stored in `.mcp.json`, which can be committed, and supports `${VAR}` / `${VAR:-default}` expansion for API keys. Credential variables such as `ANTHROPIC_API_KEY` read as empty in a remote server's url and headers. SSE transport is deprecated. — [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)
- MCP tool output is capped at **25,000 tokens by default** (raise it with `MAX_MCP_OUTPUT_TOKENS`), with a warning above 10,000 tokens. Text results over 50,000 characters are saved to a file. A call idles out after 5 minutes without progress on HTTP servers or 30 minutes on stdio. Calls still running after 2 minutes move to the background. — [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)

### Inferences
- For a project where the developer supplies one API key, the lowest-friction official routes are **Replicate's hosted MCP** (one token, many models) and **Scenario's MCP** (if they pay for Scenario). fal.ai would need a community MCP or a short script the agent writes against fal's REST or Python client.
- Because of the 25k-token MCP output cap and the idle timeouts, image tools should **return file paths or URLs and job IDs, not base64 images**. Async and polling designs (fal queue, Sprixen job IDs) fit well with the auto-backgrounding of calls that run longer than 2 minutes.
- Many "MCP servers" are thin wrappers. An agent can just as easily write and run a `gen_assets.py` script against the REST API, which is the approach in the note.com and mcpmarket examples (§2). That avoids depending on unmaintained community MCPs.

### Gaps
- The full tool list and pricing of Scenario's official MCP could not be fetched; only search summaries were read.
- No first-party fal.ai MCP was found. It is unclear whether one exists.
- Cursor's own MCP documentation was not fetched. Cursor support is stated only by the Scenario and Comfy-Org pages.
- Leonardo's official MCP page content was not seen.
- Recent commit activity and maintenance of the community servers was not checked, apart from raveenb's.

## 2. Documented examples of coding agents producing game assets through an API

### Takeaway
Documented 2026 examples follow a common pattern: **a manifest (YAML/JSON) of briefs → batch generation with a fixed seed, profile or style lock → automatic background removal and trim → agent or human inspection → regenerate failures → export (atlas + manifest)**. The most concrete public write-ups are a Claude Code + ComfyUI pipeline (note.com, 2026-03-03, partly paywalled) and a vendor run with Sprixen MCP (2026-11-01). Atlas packing is usually done by the vendor or by a standard packer CLI, not by the image model.

### Cited Findings
**Batch from a spec (manifest-driven)**
- A Claude Code × ComfyUI pipeline (note.com, by どらちゃん, **2026-03-03**). It registers an MCP tool, `generate_image(prompt=…, output_path=…)`, that saves a transparent PNG, and it batch-generates with `python tools/gen_assets.py` from a **YAML manifest** with fields `id, kind, profile, size, transparent, prompt, seed` (for example `battle_warrior`, portrait, `anime_high`, `[768,1152]`, `transparent: true`, `seed: 99001`). "For 10 characters, write them in the YAML and run the command." — [note.com d0r4ch4n](https://note.com/d0r4ch4n/n/n47989157b56a?hl=en)
- The same pipeline has five profiles (anime_high ~20 s, photo_high ~25 s, neutral_high, pixel_art, fast_preview ~5 s). Each profile fixes the model, sampler, CFG, quality tags and background-removal model. Named models are RealVisXL V5.0 and **Pixel Art XL LoRA followed by a pixelize step**. Templates auto-add tags such as `seamless texture, tileable`. It needs an RTX GPU with 12 GB+ VRAM and about 20 GB of model disk. The author admits "icons are a bit difficult". It "automatically verifies quality and retries on failure", but how is in the paid section. — [note.com d0r4ch4n](https://note.com/d0r4ch4n/n/n47989157b56a?hl=en)
- A Claude Code skill calls a Replicate image model from a TypeScript script and saves output into the project. It needs a Replicate token in the environment. **(snippet only)** — [mcpmarket generate-image skill](https://mcpmarket.com/tools/skills/generate-image-1)

**Background removal and slicing into parts**
- In the note.com pipeline, generation, background removal, **trim** and PNG output run in one ComfyUI workflow. It uses **BiRefNet (toonout)** for anime, BiRefNet (general) for photorealistic images, and INSPYRENET for fast previews. — [note.com d0r4ch4n](https://note.com/d0r4ch4n/n/n47989157b56a?hl=en)
- The "Sprite Sheet Generator" Claude Code skill generates one **anchor** hero sprite (canonical view, idle) first, then directional and state sheets that are **sliced into individual sprites**. It relies on a separate Gemini image-generation skill. **(snippet only)** — [mcpmarket sprite-sheet-generator](https://mcpmarket.com/tools/skills/sprite-sheet-generator)

**Packing into sprite atlases**
- In Sprixen's MCP, `export_character_package` returns a ZIP with sliced sheets, an **atlas** and a manifest for Godot, Unity, GameMaker, Phaser or RPG Maker MZ. **(vendor post, 2026-11-01)** — [Sprixen: one style](https://sprixen.com/blog/make-all-your-game-art-with-claude-code-in-one-style)
- No independent write-up was found where a coding agent ran a general atlas packer on AI output. See §6 for packer CLIs an agent could call.

**Style consistency (reference images, LoRA, locks)**
- Sprixen uses a per-project **style lock** ("art style, resolution, view angle and palette"), with the project ID stored in CLAUDE.md or AGENTS.md so later sessions reuse it. It asks for related items in **packs of up to 8** so they share lighting and outlines. It renders 8-direction characters from 3D ("Character Studio") so every direction matches. **(vendor)** — [Sprixen: one style](https://sprixen.com/blog/make-all-your-game-art-with-claude-code-in-one-style)
- The note.com pipeline relies on fixed seeds per asset, **ControlNet pose control** from a reference image, and img2img from rough sketches (with `denoise` setting how much is kept). — [note.com d0r4ch4n](https://note.com/d0r4ch4n/n/n47989157b56a?hl=en)
- LoRA route on fal: training costs **$2 per run**, "scales linearly with steps", needs at least 4 images, and outputs `diffusers_lora_file`. Inference with FLUX.1 [dev] plus LoRAs (`fal-ai/flux-lora`) costs $0.035/MP. — [fal flux-lora-fast-training llms.txt](https://fal.ai/models/fal-ai/flux-lora-fast-training/llms.txt); [fal pricing](https://fal.ai/pricing)
- OpenAI's Image API edits endpoint accepts **multiple images**: the mask applies to the first image and the others act as references. — [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)
- A third-party write-up notes that independent draws from one prompt drift in style: "Generating thirty icons that look like they came from the same game is the actual problem." **(secondary)** — [DEV: The image agents — prompt to PNG](https://dev.to/esunitha/the-image-agents-prompt-to-png-34d0)

**Human and agent review loops**
- In the Sprixen run, the author had the agent **inspect each sheet**. It caught two walk frames facing the wrong way and a HUD pack with grey card backgrounds; both were fixed by regenerating. The agent polls `get_generation` while it keeps coding, and some animations took minutes. Too many parallel jobs return "too many active jobs" with a retry time, which happened on the 5th parallel request. A hero, four walk cycles, and 22 icons and HUD pieces cost **24 credits** (Pro plan: $10/month for 200 credits). **(vendor)** — [Sprixen: one style](https://sprixen.com/blog/make-all-your-game-art-with-claude-code-in-one-style)
- Mike Veerman (blog, 2026-01-17) used Claude Code to drive Google **Imagen 4 and Veo 3.1** to rebuild "Flying Toasters" sprites. Claude reviewed the generated frames itself and refined prompts over iterations. The first approach failed, and the author credits the iteration loop for the speed. **(snippet only: the page returned HTTP 503 when fetched)** — [mikeveerman.be: Claude After Dark](https://mikeveerman.be/blog/github-2026-01-17-claude-after-dark/)
- `achimala/dream-loop`: an agent skill combining Blender, image generation and a **subagent critic**. **(snippet only)** — [GitHub dream-loop](https://github.com/achimala/dream-loop)

### Inferences
- A workable design for our project: keep `art/briefs.yaml` (id, kind, size, transparent, seed, style ref) in the repo. The agent runs a generator script, writes PNGs plus a `manifest.json` (prompt, seed, model, cost), runs background removal, trim and quantization, packs an atlas, then opens a review gate (contact sheet or HTML gallery) for a human to accept or reject each asset.
- Anchor-first generation (one canonical hero, then derive variants from it with reference images or edits) recurs across independent sources and is the cheapest consistency lever when a LoRA is not available.

### Gaps
- No independent, non-vendor case study was found with full costs for a complete game's art made by Claude Code or Cursor through an API.
- The paid part of the note.com article (source, troubleshooting, retry logic) was not read.
- The Mike Veerman post could not be fetched (HTTP 503), so its details are snippet-only.
- No public example of a Cursor- or Windsurf-specific image pipeline was found; the examples are Claude Code and Codex.

## 3. Per-image API pricing (2026)

### Takeaway
At about 1 megapixel (1024²), draft-quality images cost **$0.001–0.006** (Sana, FLUX schnell, FLUX 2 Flash, gpt-image-2 low). Mid-tier images cost **$0.012–0.05** (FLUX 2, FLUX dev, Nano Banana / 2.1, Stable Image Core, gpt-image-2 medium). Premium images cost **$0.08–0.24** (Nano Banana Pro, gpt-image-2 high, Stable Image Ultra). Google's batch tier halves Gemini image prices, and OpenAI's batch tier halves its token prices. LoRA training on fal starts at $2 per run.

### Cited Findings
**fal.ai** (official pricing page, read 2026-11-09)
- FLUX.1 [schnell] $0.003/MP; FLUX.1 [dev] $0.025/MP; dev img2img $0.03/MP; **FLUX.1 [dev] with LoRAs $0.035/MP**; **FLUX 2 $0.012/MP**; FLUX 2 Edit $0.012/MP; **FLUX 2 Flash $0.005/MP**; "Flux 3 Image (edit)" `blackforestlabs/flux-3/edit-image` $0.048/MP; Z Image Turbo $0.005/MP; Sana $0.001/MP. — [fal pricing](https://fal.ai/pricing)
- Nano Banana $0.0398/image; Nano Banana 2 $0.08/image; Nano Banana Pro $0.15/image; Seedream V4.5 $0.04/image; Seedream 5.0 Pro $0.0675 per unit. "GPT Image 2 API" is listed at "$1 per unit", but the unit is not defined on the page. — [fal pricing](https://fal.ai/pricing)
- Utilities: Bria RMBG 2.0 background removal $0.018 per generation; BiRefNet v2 shown as "$0 per compute second", which is probably a display artefact, so treat it as unverified; SeedVR2 upscale $0.001/MP. "You are not charged for server errors or for time spent waiting in the queue." Live price per model: `https://fal.ai/models/<endpoint-id>/llms.txt`. — [fal pricing](https://fal.ai/pricing)
- LoRA training (`fal-ai/flux-lora-fast-training`): **$2 per training run**, scaling linearly with steps (steps 1–10,000; the example uses 1,000). — [fal llms.txt](https://fal.ai/models/fal-ai/flux-lora-fast-training/llms.txt)

**OpenAI** (official pricing page: tokens only; per-image figures are secondary)
- Per 1M tokens, standard tier, image output: **gpt-image-2 $30**, gpt-image-1.5 $32, **gpt-image-1-mini $8**, chatgpt-image-latest $32. Image input: $8 / $8 / $2.50 / $8. Batch is half price (gpt-image-2 output $15, mini $4). — [OpenAI pricing](https://developers.openai.com/api/docs/pricing)
- Per image at 1024×1024 for gpt-image-2: about **$0.006 (low), $0.053 (medium), $0.211 (high)**, attributed to OpenAI's calculator. **(secondary)** Segmind's own token-based estimate is $0.0078 (low) to $0.264 (high). — [Opper gpt-image-2](https://opper.ai/openai/gpt-image-2); [Segmind comparison](https://blog.segmind.com/ai-image-gen-pricing-compared-nano-banana-2-vs-seedream-5-0-vs-gpt-image-2-2026/)
- OpenAI's image guide (read 2026-11-09) also mentions `gpt-image-2.5-sunburst`, `gpt-image-2.5-flare` and "GPT Image 2.6", with quality levels up to `xhigh` and `max` (earlier models go up to `high`). Background can be "Transparent, opaque, or automatic". The pricing page lists only up to gpt-image-2, so the model line-up is changing quickly; check before you budget. — [OpenAI image generation guide](https://developers.openai.com/api/docs/guides/image-generation)

**Google Gemini API** (official, paid tier; **no free tier for image output**)
- Gemini 2.5 Flash Image (Nano Banana) **$0.039/image** (up to 1024²); batch or flex $0.0195; **shutdown on 2027-03-15**, migrate to 3.1 Flash Lite Image. — [Google AI Studio pricing](https://aistudio.google.com/docs/pricing)
- Gemini 3 Pro Image (Nano Banana Pro) **$0.134** per 1K/2K image and **$0.24** per 4K image; no batch. — [Google AI Studio pricing](https://aistudio.google.com/docs/pricing)
- Gemini 3.1 Flash Image (Nano Banana 2) $0.045 (0.5K), **$0.067 (1K)**, $0.101 (2K), $0.151 (4K). Nano Banana 2.1 $0.0336 (1K), batch $0.0168. Gemini 3.1 Flash Lite Image $0.0336 (1K), batch $0.0168. — [Google AI Studio pricing](https://aistudio.google.com/docs/pricing)

**Replicate**
- FLUX Dev **$0.025 per output image** (replicate.com/pricing snippet). FLUX Schnell about **$0.003/image** ($3 per 1,000; secondary). LoRA variants are quoted inconsistently ($0.02 vs $0.002). — [Replicate pricing](https://replicate.com/pricing); [pricepertoken FLUX Schnell](https://pricepertoken.com/image/model/black-forest-labs-flux-schnell)

**Stability AI** (only aggregators; the official page was not fetched)
- 1 credit = $0.01. **Stable Image Core 3 credits ($0.03)**, **Ultra 8 credits ($0.08)**, SD 3.5 Large 6.5 credits, Large Turbo 4, Medium 3.5, SD 3.5 Flash 2.5. Creative Upscale 60 credits ($0.60). New accounts get 25 free credits. **(secondary)** — [Puter tutorial (Jun 2026)](https://developer.puter.com/tutorials/stability-ai-api-pricing/); [costbench Stability API](https://www.costbench.com/software/ai-media-apis/stability-ai-api/)

**Scenario API**
- About **2–15 Compute Units (CU) per image**, depending on the model; enhancing costs about 5–15 CU. Adding `?dryRun=true` to `POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}` returns the exact CU cost without charging. API access needs a **Pro plan or above**. **(search summary of official help pages)** — [Scenario help: API usage and CU](https://help.scenario.com/en/articles/api-usage-and-credits-creative-units/); [Scenario API pricing](https://docs.scenario.com/page/api-pricing)
- This conflicts with an older Scenario page that claims "$0.004 per image" and does not mention CU, so it may be outdated. — [scenario.com/api-pricing](https://scenario.com/api-pricing)

**Leonardo**
- There is no flat per-image price. Leonardo offers a pricing calculator and returns a cost breakdown with each generation. Aggregators give about $0.01–0.014 per image, with an entry plan around $12/month; these figures conflict. **(secondary)** — [Leonardo docs pricing calculator](https://docs.leonardo.ai/v2.0/docs/plan-with-the-pricing-calculator); [pricepertoken Leonardo](https://pricepertoken.com/leonardo-ai-pricing)

**Vendor sprite services** (for comparison)
- Sprixen Pro is $10/month for 200 credits. One run (a hero, four walk cycles, 22 icons and HUD pieces) cost 24 credits. **(vendor)** — [Sprixen](https://sprixen.com/blog/make-all-your-game-art-with-claude-code-in-one-style)

### Inferences
- Rough budget: 300 final assets at about 4 attempts each is about 1,200 generations. That is about $4–15 on FLUX 2 or FLUX 2 Flash, about $20–80 on Nano Banana 2.1 or gpt-image-2 medium, and about $160–250 on Nano Banana Pro or gpt-image-2 high. Add a $2–5 LoRA training run and a few dollars of background removal. These are arithmetic estimates from the listed rates, not quotes.
- Paying per megapixel (fal FLUX) favours small sprites: a 512² sprite is 0.26 MP, about a quarter of the 1024² price. Per-image pricing (Gemini, Nano Banana on fal) does not shrink with size.

### Gaps
- Imagen 4 (Fast/Standard/Ultra) prices were not on the parts of Google's pricing page that were read.
- OpenAI's official per-image table was not fetched, so the per-image figures are secondary.
- fal's "per unit" price for GPT Image 2 is undefined, and fal's FLUX Pro, Kontext, Recraft and Qwen prices were not on the page.
- Stability's official pricing page was not read, so all its figures are from aggregators.
- Scenario's per-model CU table was not seen.

## 4. Rate limits and commercial terms of API outputs

### Takeaway
Rate limits are per project or account and depend on the spending tier. Official numbers for image models were not reachable, and developers report 429 errors on Gemini image models below their listed quota. A vendor's MCP hit its concurrency limit at 5 parallel jobs. On commercial use, OpenAI assigns outputs to the customer and offers IP indemnity for API outputs (per secondary summaries of its terms). Replicate explicitly allows commercial use of FLUX.1 [dev] outputs generated on Replicate, even though the open-weights licence is non-commercial. fal's position was not confirmed. Midjourney cannot be automated under its terms.

### Cited Findings
**Rate limits**
- Gemini API limits apply **per project, not per API key**. The daily quota resets at midnight Pacific time. Limits rise with the usage tier as spend grows, and preview or experimental models have stricter limits. — [Gemini rate limits (ko)](https://ai.google.dev/gemini-api/docs/rate-limits?hl=ko); [Gemini increase quota](https://ai.google.dev/docs/increase_quota)
- Third-party figures for paid Tier 1 conflict: 500 RPM for 2.5 Flash Image, and 300 RPM with 10,000 requests per day for Nano Banana Pro. One guide puts a separate images-per-minute limit at about 2 on the free tier. **(secondary)** — [laozhang Nano Banana Pro rate limit](https://blog.laozhang.ai/en/posts/nano-banana-pro-rate-limit); [yingtu 429 guide](https://yingtu.ai/blog/gemini-image-generation-error-429-fix)
- Paid Tier 1 developers report sporadic **429 RESOURCE_EXHAUSTED** errors on `gemini-2.5-flash-image` "well under quota". — [Google AI forum thread](https://discuss.ai.google.dev/t/paid-tier-1-sporadic-429-resource-exhausted-on-gemini-2-5-flash-image-despite-being-well-under-quota/130379)
- fal's pricing page gives no rate-limit or concurrency figures. — [fal pricing](https://fal.ai/pricing)
- Sprixen MCP returned "too many active jobs" on the 5th parallel request. **(vendor)** — [Sprixen](https://sprixen.com/blog/make-all-your-game-art-with-claude-code-in-one-style)
- OpenAI GPT Image models may require **API Organization Verification**. — [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation)

**Commercial terms**
- OpenAI: secondary summaries say that "as between you and OpenAI, you own the output", to the extent permitted by law, and that similar content may be generated for other users. OpenAI's service terms say indemnification for API customers covers third-party IP claims arising from use or distribution of Output. **(search summaries; the primary text was not fetched)** — [OpenAI service terms](https://openai.com/policies/service-terms/); [ConductAtlas OpenAI business terms output ownership](https://conductatlas.com/platform/openai/openai-business-terms/customer-output-ownership-and-ip-assignment/)
- Copyright caveat: under US law, copyright requires human authorship, so owning the output by contract does not guarantee copyright protection. **(secondary)** — [ConductAtlas OpenAI terms of use](https://conductatlas.com/platform/openai/openai-terms-of-use/user-generated-content-and-output-ownership/)
- Replicate and FLUX.1 [dev]: images generated on Replicate with FLUX.1 models and their fine-tunes can be used commercially. Images generated on your own computer from downloaded weights cannot. The Hugging Face model card still lists the FLUX.1 [dev] **Non-Commercial License**. — [Replicate flux-dev](https://replicate.com/black-forest-labs/flux-dev); [Hugging Face FLUX.1-dev](https://huggingface.co/black-forest-labs/FLUX.1-dev)
- fal and FLUX dev: the only evidence is a Hugging Face forum comment saying fal supports commercial use. **(anecdotal, unverified)** — [HF discussion #59](https://huggingface.co/black-forest-labs/FLUX.1-dev/discussions/59)
- Midjourney's terms prohibit automated access, so unofficial APIs and MCPs risk account suspension. **(secondary)** — [aifreeapi](https://www.aifreeapi.com/en/posts/midjourney-api-guide.md)
- Spine-related tool `GenielabsOpenSource/spine-animation-ai` is under **PolyForm Noncommercial**. **(snippet only)** — [GitHub spine-animation-ai](https://github.com/GenielabsOpenSource/spine-animation-ai)

### Inferences
- For a commercial game, prefer models whose hosted terms clearly allow commercial outputs (OpenAI, Google paid tier, Replicate for FLUX dev, and FLUX schnell or FLUX 2 variants with permissive licences). Check fal's terms per model before using FLUX.1 [dev] there.
- Store the provider, model, date and prompt for each asset in the manifest as provenance for licence questions and store disclosure requirements.

### Gaps
- Official OpenAI image rate limits (images per minute by tier) were not retrieved.
- Google's Gemini API terms on generated content ownership were not retrieved.
- fal.ai's and Scenario's output-licence terms were not retrieved.
- Stability's community licence and revenue thresholds for API outputs were not checked.

## 5. Practical limits: what agents can't judge, critique loops, failure modes

### Takeaway
A text-only agent cannot judge art. Every working loop in the sources has the agent look at the output through a multimodal model, or gets a human to. Practitioners use **structured critiques** (issues with severity), **a hard retry cap** (often one retry per item), **a reviewer from a different model family**, and **rendered in-game screenshots** rather than isolated PNGs. Known failure modes are style drift, silent per-call failures, wrong-facing frames and background artefacts, iterations that fix one attribute and break another, and stalls when the generator cannot render a requested attribute.

### Cited Findings
- Vision-in-the-loop: a multimodal critic returns a **structured critique (issues plus severity), not free-form prose**. The pipeline regenerates with a revised prompt, usually **once**, "with a per-scene cap to control cost". **(practitioner blog)** — [DEV: Vision-in-the-Loop](https://dev.to/humzakt/vision-in-the-loop-when-the-ai-rewrites-its-own-prompts-from-the-generated-frame-3ie1)
- ALIGN has one model draw and a **different model family critique the pixels**, because same-family reviewers "share habits and blind spots" even in a fresh thread. It ships skills for Claude Code and Codex. Note that it draws with p5.js, not diffusion. — [GitHub ALIGN](https://github.com/wanshuiyin/ALIGN-Agentic-Loop-Image-GeneratioN)
- SIDiffAgent (arXiv 2602.02051): "iterative regeneration may enhance certain features but inadvertently worsen others, preventing consistent improvement across iterations". Loops can stall when the generator cannot render a requested attribute. — [arXiv 2602.02051](https://arxiv.org/pdf/2602.02051)
- GameCraft-Bench (arXiv 2606.17861): without rendered visual feedback, "an agent may continue editing code while remaining blind to whether the player-facing game state is actually coherent". Screenshots are needed to catch framing and UI problems. — [arXiv 2606.17861](https://arxiv.org/pdf/2606.17861)
- Failure handling in an asset agent: image calls fail through timeouts, model errors and **rejected prompts**. The agent catches each failure, logs it, substitutes a placeholder and continues, then regenerates the gaps. There was also a "silent" bug where images were written but never displayed, with no console error or 404. **(practitioner blog)** — [DEV: The image agents](https://dev.to/esunitha/the-image-agents-prompt-to-png-34d0)
- A GitHub issue in an asset pipeline reports a recurring stale-prompt state after timeouts and asks for diagnosable, recoverable state. — [Toonflow-app issue #39](https://github.com/lechangbin/Toonflow-app/issues/39)
- Concrete errors an agent caught by looking: two walk frames facing the wrong way, and a HUD pack with grey card backgrounds. **(vendor)** — [Sprixen](https://sprixen.com/blog/make-all-your-game-art-with-claude-code-in-one-style)
- In the note.com ComfyUI pipeline, "icons are a bit difficult". — [note.com d0r4ch4n](https://note.com/d0r4ch4n/n/n47989157b56a?hl=en)
- OpenAI masks are "entirely prompt-based" and "may not follow its exact shape with complete precision". Higher complexity "can increase latency and introduce unwanted changes". — [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation)
- Claude reviewing its own generated frames and refining prompts drove the iteration in the Imagen and Veo sprite project. **(snippet only)** — [mikeveerman.be](https://mikeveerman.be/blog/github-2026-01-17-claude-after-dark/)

### Inferences
- Things that need **no** vision model can be checked in code: alpha coverage and empty-frame detection, bounding box and trim size, palette colour count, a background-colour residue check (for example grey corners), file dimensions, and perceptual-hash near-duplicates. These belong in a deterministic lint step before any vision critique.
- Things that need vision or a human: facing direction, anatomy, style match to the anchor, readability at game scale, and "does it look like our game". A two-stage gate fits these sources: automated lint, then vision critique against a rubric with one retry, then a human accept or reject in a gallery for anything shipped.
- Critique loops should compare the candidate **side by side with the anchor or reference image**, and should be judged on an in-engine screenshot (for example the PixiJS scene), in line with GameCraft-Bench.

### Gaps
- No quantitative data was found on how often a vision critic agrees with human art reviewers for game sprites.
- No source measured the cost overhead of critique loops (vision tokens per image) for game assets specifically.

## 6. Post-processing tooling for pipelines

### Takeaway
The common open toolchain is: **rembg or BiRefNet** for alpha mattes (BiRefNet "toonout" or anime variants for flat art), **Real-ESRGAN (anime model)** or a hosted upscaler such as SeedVR2, **palette quantization after background removal** (K-means++, NeuQuant, or fixed-block downscaling for pixel art), and a **CLI atlas packer** (TexturePacker CLI, which is paid; or free options such as free-tex-packer-core, FastPack, atlasify and muncher). Automatic layer separation and Spine rigging are emerging but immature. Esoteric (Spine's maker) said automated rigging is not on its roadmap, and the tools that do exist are vendor or community projects, some licensed non-commercially.

### Cited Findings
**Background removal**
- BiRefNet variants usable through rembg include `birefnet-general`, `birefnet-general-lite` and `birefnet-portrait`. One tool runs BiRefNet through rembg with alpha matting, then Real-ESRGAN, and notes that both are slow on CPU, so a GPU is recommended. — [GitHub dghai3/pep](https://github.com/dghai3/pep)
- The note.com pipeline uses BiRefNet "toonout" for anime, BiRefNet general for photo, and INSPYRENET for fast previews. — [note.com d0r4ch4n](https://note.com/d0r4ch4n/n/n47989157b56a?hl=en)
- Hosted options: fal Bria RMBG 2.0 at $0.018 per image, and fal BiRefNet v2. — [fal pricing](https://fal.ai/pricing). Stability `remove-background` costs about $0.02 through the tadasant MCP. — [mcpservers.org](https://mcpservers.org/servers/tadasant/mcp-server-stability-ai)
- rembg is the reference CLI and library for background removal. **(listing only)** — [rembg CLI docs (tessl)](https://tessl.io/registry/tessl/pypi-rembg/files/docs/cli.md); [rembg repo mirror](https://backiee.wasmer.app/https_github_com/danielgatis/rembg/tree/main)
- A practitioner comparison of BiRefNet, rembg and U2Net for production exists. **(snippet only)** — [DEV: BiRefNet vs rembg vs U2Net](https://dev.to/om_prakash_3311f8a4576605/birefnet-vs-rembg-vs-u2net-which-background-removal-model-actually-works-in-production-d2f)

**Upscaling**
- Real-ESRGAN `realesrgan-x4plus-anime` is used for flat or anime art. — [GitHub dghai3/pep](https://github.com/dghai3/pep); [aifilms: BiRefNet + Real-ESRGAN + SwinIR](https://studio.aifilms.ai/blog/birefnet-real-esrgan-swinir-open-source-matting-upscaling)
- Hosted: fal SeedVR2 at $0.001/MP; Stability Creative Upscale at about $0.60 **(secondary)**. — [fal pricing](https://fal.ai/pricing); [Puter Stability pricing](https://developer.puter.com/tutorials/stability-ai-api-pricing/)

**Palette quantization and pixel-art clean-up**
- An Aseprite extension snaps "fake" AI pixel art to a true grid with K-means++ (deterministic) or NeuQuant quantization engines. **(snippet only)** — [itch.io DeAI PixelKit](https://onlyjasoncando.itch.io/deai-pixelkit)
- One API service post-processes output to an 8 px block size and quantizes to 32 colours. Its write-up notes that the quantizer needs a **transparent source** so the background colour does not leak into the palette, which implies removing the background before quantizing. **(snippet only)** — [DEV: real pixel-art sprites via API](https://dev.to/om_prakash_3311f8a4576605/how-to-generate-real-pixel-art-sprites-via-api-with-transparent-backgrounds-keg)
- The note.com pixel_art profile adds a pixelize step after Pixel Art XL LoRA. — [note.com d0r4ch4n](https://note.com/d0r4ch4n/n/n47989157b56a?hl=en)

**Atlas packing**
- TexturePacker's command-line client runs without the GUI (`TexturePacker sheet.tps`, with CLI flags overriding the .tps settings). It requires a paid tier; the free Essential mode is limited. — [CodeAndWeb: TexturePacker command line](https://www.codeandweb.com/texturepacker/documentation/commandline); [CodeAndWeb licence comparison](https://www.codeandweb.com/texturepacker/licenses-comparison)
- Free alternatives: `free-tex-packer-core` (MIT, programmatic Node, padding and rotation, mustache templates); FastPack (Rust, headless `fastpack pack`); `atlasify` (npm, MaxRects); `muncher` (npm CLI sprite-sheet generator); and the libGDX texture packer. — [free-tex-packer-core README](https://cdn.jsdelivr.net/npm/free-tex-packer-core@0.3.8/README.md); [FastPack CLI](https://mintlify.com/Hexeption/FastPack/guides/cli); [atlasify](https://www.skypack.dev/view/atlasify); [muncher](https://github.com/sajmoni/muncher); [libGDX texture packer](https://libgdx.com/wiki/tools/texture-packer)

**Layer and part separation, and Spine rigging**
- Esoteric Software, on its forum: an automated rigging feature "is not yet on our roadmap as a concrete plan". The thread date was not checked. — [Esoteric forum: auto rig AI](https://ar.esotericsoftware.com/forum/d/24270-auto-rig-ai-)
- Layer.ai has a "Create Spine Components" tool that breaks a character image into separate, animatable Spine components. **(vendor)** — [Layer.ai Create Spine Components](https://www.layer.ai/tools/layer--create-spine-components)
- Scenario has a "2D animation rigging sheet" app. **(vendor, snippet only)** — [Scenario app](https://scenario.com/apps/2d-animation-rigging-sheet)
- `GenielabsOpenSource/spine-animation-ai` is a Claude skill that auto-positions body parts from reference images using SIFT + RANSAC, under the **PolyForm NC** (non-commercial) licence. **(snippet only)** — [GitHub spine-animation-ai](https://github.com/GenielabsOpenSource/spine-animation-ai)
- Other projects: `SSnemo/img2rig` (GitHub); "anysplit", a brush-assisted layer splitter introduced on the Esoteric forum; a community showcase that automates layer separation for Spine; and Pixa/Pixelcut, which auto-detects articulation points to rig a PNG or PSD. "see-through" reportedly splits one anime image into 23 rig-ready layers, but that claim is secondhand from Reddit. **(all snippet only, unverified)** — [img2rig](https://github.com/SSnemo/img2rig); [Esoteric forum: new tool feedback](https://fr.esotericsoftware.com/forum/d/30533-seeking-feedback-and-opinions-on-new-tool); [Esoteric showcase: layer separation](https://vi.esotericsoftware.com/forum/d/23849-automating-layer-separation-for-spine2d); [Pixa rigging](https://www.pixa.com/create/2d-character-rigging); [Reddit snapshot](https://reddit.sentinel-team.org/posts/1sjj7ta/snapshots/2026-04-13T16%3A49%3A44.836172Z)
- Keyframe.it is a standalone skeletal-animation editor that exports Spine bundles. **(snippet only)** — [keyframe.it.com](https://keyframe.it.com/)

### Inferences
- A pipeline order consistent with these sources: generate → background removal (BiRefNet anime or toonout variant) → trim and pad → optional upscale (before quantization) or downscale and pixelize → palette quantize to the project palette → lint → pack atlas → emit engine manifest. All of these are CLI or Python steps a coding agent can run without a GUI.
- For cut-out or Spine-style animation, generating **parts separately** from a part-list spec (head, torso, limbs on transparent backgrounds, fixed seed and reference) is more reliable for an agent today than decomposing a finished illustration automatically. The decomposition tools are vendor or early-stage, and some are non-commercial.

### Gaps
- pngquant and libimagequant were not covered by any source found.
- No benchmark of BiRefNet versus rembg on game sprites (hair, thin outlines, pixel art) was read; only a snippet-level comparison exists.
- The maturity, licences and output formats of img2rig, anysplit and see-through were not verified.
- arXiv 2503.09127 appeared in the Spine search results, but its content was not read.
