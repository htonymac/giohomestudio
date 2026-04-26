# GioHomeStudio — AI Disclosure Policy

**Effective Date:** 2026-04-26
**Last Updated:** 2026-04-26
**Version:** 1.0
**Contact:** legal@giohomestudio.com
**Jurisdiction:** Federal Republic of Nigeria — Federal High Court

> **This document is a product legal draft and is not a substitute for advice from a qualified lawyer.**

---

## 1. Introduction

GioHomeStudio is an AI-powered content creation platform. Every significant generation feature on the platform is powered by one or more third-party AI providers. This AI Disclosure Policy explains:

- Which AI providers the platform routes to for each type of generation
- What user data is transmitted to each provider
- Which providers offer training data opt-out
- How output ownership works on a per-vendor basis
- Known limitations and risks of AI-generated content
- Your responsibilities when publishing AI-generated content

This disclosure is provided in furtherance of transparency about the platform's AI use and in anticipation of evolving disclosure requirements under Nigerian law, the EU AI Act, and platform-specific rules (YouTube, Meta, TikTok, etc.).

---

## 2. AI Provider Registry

The following AI providers are currently integrated into the GioHomeStudio platform. This list is updated when providers are added or removed.

### 2.1 Anthropic (Claude)

| Field | Detail |
|---|---|
| Vendor | Anthropic PBC |
| Model Family | Claude (Haiku, Sonnet, Opus) |
| Service in GHS | LLM orchestration, prompt enhancement, script writing, story expansion, narration scripts |
| User Data Transmitted | Text prompts, story input, script content, narration instructions |
| Training Opt-Out | Available — Anthropic does not use API inputs to train models by default; see Anthropic's Privacy Policy at anthropic.com/privacy |
| Output Ownership | Anthropic assigns output ownership to the user per its Terms of Service |
| Key Limitation | May produce plausible but factually incorrect content (hallucination). All text output must be verified before publication. |

### 2.2 FAL.ai

| Field | Detail |
|---|---|
| Vendor | FAL.ai |
| Model Family | Various (FLUX, Stable Diffusion variants, video models) |
| Service in GHS | Image generation, image-to-video, scene visualization |
| User Data Transmitted | Text prompts, reference images (where provided) |
| Training Opt-Out | See FAL.ai privacy policy at fal.ai/privacy |
| Output Ownership | FAL.ai assigns output rights to the user per its Terms of Service |
| Key Limitation | May produce outputs that resemble existing copyrighted works or real persons. Review all outputs before publication. |

### 2.3 Kie.ai

| Field | Detail |
|---|---|
| Vendor | Kie.ai |
| Model Family | Kie music and media generation models |
| Service in GHS | Music generation, audio accompaniment |
| User Data Transmitted | Text prompts, genre and style parameters |
| Training Opt-Out | See Kie.ai terms at kie.ai |
| Output Ownership | Per Kie.ai Terms of Service — review for commercial use conditions |
| Key Limitation | Generated music may stylistically resemble existing compositions. Commercial use terms vary. |

### 2.4 Runway

| Field | Detail |
|---|---|
| Vendor | Runway AI, Inc. |
| Model Family | Gen-2, Gen-3, and related video generation models |
| Service in GHS | Video generation, video-to-video transformation |
| User Data Transmitted | Text prompts, reference images and video clips (where provided) |
| Training Opt-Out | Runway's privacy policy and terms govern; see runwayml.com/privacy-policy |
| Output Ownership | Runway assigns generated content ownership to the user per its Terms of Service, subject to restrictions |
| Key Limitation | May generate content depicting real-world elements or resembling existing media. Review all outputs carefully. |

### 2.5 ElevenLabs

| Field | Detail |
|---|---|
| Vendor | ElevenLabs Inc. |
| Model Family | Multilingual TTS, voice cloning models |
| Service in GHS | Voice narration, audio drama narrators, character voices |
| User Data Transmitted | Text scripts, voice settings, voice model identifiers |
| Training Opt-Out | Available via ElevenLabs account settings — see elevenlabs.io/privacy |
| Output Ownership | ElevenLabs assigns audio output ownership to the user per its Terms of Service |
| Key Limitation | Voice synthesis can be mistaken for authentic human speech. You must not use synthesized voice to impersonate real persons without consent. Disclosure is required where applicable law mandates it. |

### 2.6 MuAPI

| Field | Detail |
|---|---|
| Vendor | MuAPI |
| Model Family | Music generation API |
| Service in GHS | Background music, scene scoring |
| User Data Transmitted | Text prompts, genre and mood parameters |
| Training Opt-Out | See MuAPI documentation |
| Output Ownership | Per MuAPI terms — review for commercial use |
| Key Limitation | Output music may stylistically reference existing works. |

### 2.7 Segmind

| Field | Detail |
|---|---|
| Vendor | Segmind Technologies |
| Model Family | Image and video generation, SDXL, FLUX variants |
| Service in GHS | Image generation, style transfer, visual scene generation |
| User Data Transmitted | Text prompts, reference images (where provided) |
| Training Opt-Out | See Segmind privacy policy at segmind.com |
| Output Ownership | Per Segmind Terms of Service |
| Key Limitation | May produce photorealistic images of persons. Do not use to depict real people without consent. |

### 2.8 Suno

| Field | Detail |
|---|---|
| Vendor | Suno AI |
| Model Family | Suno music generation models |
| Service in GHS | Song generation, lyrical music, theme music |
| User Data Transmitted | Text prompts, lyrical input, style parameters |
| Training Opt-Out | See Suno's privacy policy at suno.com/privacy |
| Output Ownership | Suno's Terms of Service assign commercial use rights to paid subscribers; free tier has non-commercial restrictions |
| Key Limitation | Generated songs may exhibit stylistic similarities to existing artists. Commercial use requires a paid Suno plan. Always verify output licence before commercial publication. |

---

## 3. Output Ownership Summary

GioHomeStudio does not claim ownership over any AI-generated output produced using your instructions and uploaded materials. As between you and GioHomeStudio, generated outputs are yours, subject to:

- The terms of the specific AI provider used for that generation (see Section 2 above)
- Applicable Nigerian and international intellectual property law regarding AI-generated works
- Any rights embedded in source materials you uploaded
- Whether your subscription tier with the provider includes commercial use rights (particularly relevant for Suno)

GioHomeStudio makes no guarantee that generated outputs are exclusively owned by you, free from third-party claims, or registrable as intellectual property. Before publishing AI-generated content commercially, you should review the relevant provider's terms and consider independent legal advice.

---

## 4. Known Limitations and Risks

### 4.1 Hallucination

Large language models and generative AI systems can produce outputs that are plausible but factually incorrect. This is called "hallucination." You must not publish AI-generated factual claims without independent verification.

### 4.2 Bias

AI models are trained on large datasets that may contain historical, cultural, or demographic biases. Generated content may reflect these biases in ways that are unintentional but harmful. You are responsible for reviewing content for bias before publication.

### 4.3 Copyright Leakage Risk

AI image and music generation models trained on large datasets may produce outputs that closely resemble existing copyrighted works. While providers take steps to reduce this risk, it cannot be entirely eliminated. If you believe a generated output closely resembles a specific existing work, do not publish it without seeking legal advice.

### 4.4 Real-Person Risk

Image and video generation models may produce outputs that resemble real persons, including public figures, even when not instructed to do so. Review all outputs carefully before publication.

---

## 5. Your Disclosure Responsibilities

Where any of the following applies, you are responsible for making appropriate disclosure:

| Situation | Disclosure Required |
|---|---|
| Publishing on a platform that requires AI content labelling (YouTube, Meta, TikTok) | Follow platform-specific disclosure requirements |
| Publishing political content that is AI-assisted | Disclose per applicable Nigerian electoral law |
| Publishing AI-generated content in a professional, journalistic, or regulatory context | Disclose in accordance with applicable professional rules |
| Publishing AI-generated voice narration as authentic speech | Disclose where reasonably required to avoid deception |

---

## 6. Watermarking and C2PA

GioHomeStudio is monitoring developments in content provenance technology, including the Coalition for Content Provenance and Authenticity (C2PA) standard. Automatic watermarking and provenance metadata embedding are **planned features** and are **not yet implemented** on the platform. When implemented, the details will be described in an updated version of this document.

Some AI providers (including certain Anthropic outputs and some image generators) may embed their own provenance markers. GioHomeStudio does not strip such markers.

---

## 7. Changes to This Policy

As the AI landscape evolves, new providers may be added and existing providers may change their terms. GioHomeStudio will update this AI Disclosure Policy when material changes to its provider integrations occur. Users will be notified via in-platform notification or email.

---

## 8. Contact

For questions about this AI Disclosure Policy, contact: **legal@giohomestudio.com**
