# Generating carousel imagery in Weave (Figma MCP)

When a carousel's concept needs imagery that doesn't exist yet — and the user explicitly
wants it generated rather than pulled from `assets/portfolio/` — the studio's own Weave
workspace is reachable from this session through the Figma MCP server:
`weave_list_tools`, `weave_get_tool_inputs`, `weave_run_tool`,
`weave_get_tool_run_output`, `weave_cancel_tool_run`.

This file records what a real run (2026-09-11, the "Это ИИ." carousel) learned, so the next
one doesn't rediscover it at 6–22 credits a try.

## Before anything else: check the tool's actual shape

`weave_list_tools` names the published workflows; `weave_get_tool_inputs` gives the input
contract. **The node graph behind a tool is the user's, and it decides everything you can't
control from here**: output resolution, aspect ratio, whether an upscaler exists. There is no
input for "make it 9:16" unless the owner wired one.

The 2026-09-11 workspace had a general-purpose tool ("генератор") whose text-to-image node was
fixed at 1024×768 landscape, whose edit branch preserved the input image's aspect ratio, and
which had no upscaler at all — unusable for a 1080×1920 carousel whose whole subject was
photorealism. The fix was not a cleverer prompt: it was asking the user to build a tool for the
job. **Ask early.** A tool request costs the user ten minutes; fighting a mis-shaped graph costs
credits and still ships a soft image.

The tool that worked ("Карусели это ИИ"):

```
Prompt ──► GPT Image 2.5 ──► Output главное          (1024x1536-class portrait render)
File   ──► Topaz Image Upscale ──► Output клоузап    (2x, 576x1024 -> 1152x2048)
```

Two independent branches, two outputs, one run fires both. Ask for exactly this shape:
a generation branch driven by `Prompt`, and an upscale branch whose image input is exposed
as a tool input so you can feed it your own crops.

## Practical notes

- **A required `File` input blocks a generation-only run.** Both tools declared `File` as
  required. Feed it a throwaway image; the generation branch ignores it. Push any placeholder
  to the repo branch and use its `raw.githubusercontent.com` URL — the repo is public, so this
  is the cheapest way to hand Weave a reachable https URL (no `weave_upload_asset` file picker,
  which needs the user to click). Delete the temp files in a later commit.
- **Every run fires every branch**, so a generation-only run still spends the upscale branch's
  time (and vice versa). Cancel the branch you don't need with `weave_cancel_tool_run` once the
  one you want has completed — failed/cancelled branches cost little; a completed Topaz pass is
  the expensive part.
- **One `weave_run_tool` call returns several run ids** (one per branch). Poll them all;
  a FAILED sibling doesn't mean your branch failed.
- **Don't put a Crop node between the file input and the upscaler.** It failed on every input
  with `Failed running Crop: Graphics node: Failed to execute rust-runner`, and it isn't needed:
  cut the crops locally with Pillow at exactly the aspect the upscaler expects.
- **Costs** (this workspace, 2026-09): the old general tool 6.1 credits/run; the
  generate+Topaz tool 22 credits/run. A full carousel cycle — one hero plus four macro
  close-ups, each upscaled — is 6 runs ≈ 132 credits. `weave_run_tool` gates on cost: always
  put the number to the user with a structured Approve/Cancel prompt before echoing
  `acknowledgedCost`, every run.
- **Topaz settings for a clean AI render**: model **High Fidelity V2** (fallbacks: Recovery V2
  for very small inputs, Standard V2 as a generic); never CGI (it smooths the image back toward
  looking rendered) and never Redefine/Wonder (generative — they invent detail, so the building
  drifts between slides and the "same object" promise breaks). Sharpen 0 and Denoise 0: Topaz's
  sharpening haloes dark window frames and roof edges, and denoise eats exactly the plaster
  grain and gravel texture the post is selling. Do any final sharpening locally.

## The one-photoset workflow (what the client asked for, and why it works)

The concept was "one object, several magnifications, proof it's all AI". The way to keep that
literally true:

1. Generate ONE hero frame, portrait, with the brand's lime (`#DBFC3B`) present in the scene as
   a real object — a front door, a bench, a canopy — not as a colour grade. Prompt in English,
   describe the camera (`35mm tilt-shift, f/8, vertical lines straight`), the light, and name
   the materials whose micro-texture the slides will point at.
2. **Crop the macro frames out of that hero with Pillow**, never generate them separately — a
   second generation gives a different building, which is exactly what the post claims isn't
   happening. Cut each crop to the upscaler's input size (576×1024 here) with `Image.resize`
   after cropping, so the upscale node has nothing to trim.
3. Run each crop, and the hero itself, through the upscaler. The hero needs it too: a
   608×1088 render stretched to a 1080×1920 cover is the softest image in the carousel,
   on the slide that has to sell realism.
4. Downsample the 1152×2048 results to 1080×1920 (`LANCZOS`, JPEG quality ~84) — downsampling
   adds apparent sharpness and keeps the seeded canvas under budget.

Pick crop regions that each contain their slide's bullet points — check by looking at a contact
sheet of the crops before spending upscale credits. It is worth choosing one crop that also
contains a piece of another slide's subject (the landscape crop here kept the lime bench in
frame): it quietly proves to the viewer that every slide is the same house.

The five finished frames from that run are kept in `assets/generated/` (see brand.md) so a
later carousel can reuse the house rather than paying to regenerate it.
