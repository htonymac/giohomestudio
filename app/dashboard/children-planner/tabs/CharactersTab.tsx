"use client";

// Characters tab — character registry with vision AI selector, build-all-from-story,
// add by name, import from registry, build-from-photo dropzone, inline preview,
// per-character cards with visual identity builder, portrait model picker,
// generate / regenerate / AI-read look / save / import image / lock-look actions,
// import-image modal, CharacterPicker modal.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 2.5, 2026-06-05).

import * as React from "react";
import * as Icon from "../../../components/icons";
import CharacterPicker from "../../../components/CharacterPicker";
import type { ChildCharacterIdentity } from "./_shared-types";

export type { ChildCharacterIdentity };

export interface ImagePickerAsset { id: string; name: string; fileUrl?: string; filePath?: string; source?: string }
export interface CharRefImageShot { url: string; angle: string }

type VisionProvider = "auto" | "ollama" | "claude" | "gpt";

export interface CharactersTabProps {
  // Style tokens
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  s2: string;
  surface: string;
  border: string;
  muted: string;
  childAccent: string;
  C4: string;
  // ds palette (selective fields used)
  dsLilac: string;
  // Header / vision AI
  characters: ChildCharacterIdentity[];
  setCharacters: React.Dispatch<React.SetStateAction<ChildCharacterIdentity[]>>;
  visionProvider: VisionProvider;
  setVisionProvider: React.Dispatch<React.SetStateAction<VisionProvider>>;
  // Build All / Add
  buildAllStoryCharacters: () => void | Promise<void>;
  buildingAllChars: boolean;
  buildAllProgress: string | null;
  expandedContent: string;
  textContent: string;
  charTabName: string;
  setCharTabName: React.Dispatch<React.SetStateAction<string>>;
  buildCharacterInline: (name: string) => Promise<void>;
  charTabCreating: boolean;
  // Batch portraits
  batchPortraitProgress: string | null;
  setBatchPortraitProgress: React.Dispatch<React.SetStateAction<string | null>>;
  generateCharacterPortrait: (char: ChildCharacterIdentity) => void | Promise<void>;
  setLastAction: (s: string) => void;
  // Import registry modal
  showCharacterPicker: boolean;
  setShowCharacterPicker: React.Dispatch<React.SetStateAction<boolean>>;
  // UI error
  uiError: string | null;
  setUiError: React.Dispatch<React.SetStateAction<string | null>>;
  // Build from photo
  photoDragOver: boolean;
  setPhotoDragOver: React.Dispatch<React.SetStateAction<boolean>>;
  importingFromPhoto: boolean;
  photoImportName: string;
  setPhotoImportName: React.Dispatch<React.SetStateAction<string>>;
  importCharacterFromPhoto: (file: File, name: string) => void | Promise<void>;
  photoImportLog: string;
  setPhotoImportLog: React.Dispatch<React.SetStateAction<string>>;
  // Inline preview
  inlinePreview: ChildCharacterIdentity | null;
  setInlinePreview: React.Dispatch<React.SetStateAction<ChildCharacterIdentity | null>>;
  acceptInlineCharacter: () => void | Promise<void>;
  // Per-character editor
  editingCharId: string | null;
  setEditingCharId: React.Dispatch<React.SetStateAction<string | null>>;
  generatingPortrait: string | null;
  buildVisualDescription: (char: ChildCharacterIdentity) => string;
  normalizeImageUrl: (url: string | null | undefined) => string;
  analyzingCharacter: string | null;
  analyzeCharacterImage: (charId: string, imageUrl: string) => void | Promise<void>;
  savingCharacter: string | null;
  savedCharacter: string | null;
  saveCharacterToRegistry: (char: ChildCharacterIdentity) => void | Promise<void>;
  openImagePicker: (charId: string) => void;
  // Portrait model picker
  charPortraitModel: Record<string, string>;
  setCharPortraitModel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  charRefImages: Record<string, CharRefImageShot[]>;
  // Image picker modal
  imagePickerForCharId: string | null;
  setImagePickerForCharId: React.Dispatch<React.SetStateAction<string | null>>;
  imagePickerAssets: ImagePickerAsset[];
  imagePickerLoading: boolean;
  assignImageToCharacter: (charId: string, dataUrl: string) => void | Promise<void>;
  // Nav
  setActiveTab: (t: "content" | "sceneBoard") => void;
}

export default function CharactersTab(props: CharactersTabProps) {
  const {
    cardStyle, labelStyle, s2, surface, border, muted, childAccent, C4, dsLilac,
    characters, setCharacters, visionProvider, setVisionProvider,
    buildAllStoryCharacters, buildingAllChars, buildAllProgress, expandedContent, textContent,
    charTabName, setCharTabName, buildCharacterInline, charTabCreating,
    batchPortraitProgress, setBatchPortraitProgress, generateCharacterPortrait, setLastAction,
    showCharacterPicker, setShowCharacterPicker,
    uiError, setUiError,
    photoDragOver, setPhotoDragOver, importingFromPhoto, photoImportName, setPhotoImportName,
    importCharacterFromPhoto, photoImportLog, setPhotoImportLog,
    inlinePreview, setInlinePreview, acceptInlineCharacter,
    editingCharId, setEditingCharId, generatingPortrait, buildVisualDescription, normalizeImageUrl,
    analyzingCharacter, analyzeCharacterImage, savingCharacter, savedCharacter, saveCharacterToRegistry,
    openImagePicker,
    charPortraitModel, setCharPortraitModel, charRefImages,
    imagePickerForCharId, setImagePickerForCharId, imagePickerAssets, imagePickerLoading, assignImageToCharacter,
    setActiveTab,
  } = props;

  return (
    <div style={{ padding: "16px 32px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap" as const, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Character Registry ({characters.length})</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff08", border: "1px solid #ffffff15", borderRadius: 8, padding: "4px 10px" }}>
            <span style={{ fontSize: 10, color: "#888", fontWeight: 600, letterSpacing: 0.5 }}>VISION AI</span>
            {(["auto", "ollama", "claude", "gpt"] as const).map(p => (
              <button key={p} onClick={() => setVisionProvider(p)}
                style={{ padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  background: visionProvider === p ? (p === "ollama" ? "#16a34a" : p === "claude" ? "#7c3aed" : p === "gpt" ? "#0284c7" : childAccent) : "#ffffff10",
                  color: visionProvider === p ? "#fff" : "#aaa" }}>
                {p === "auto" ? "Auto" : p === "ollama" ? "Local" : p === "claude" ? "Claude" : "GPT"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
          <button onClick={buildAllStoryCharacters} disabled={buildingAllChars || !( expandedContent || textContent.trim())}
            style={{ padding: "10px 18px", borderRadius: 10, border: "none",
              background: buildingAllChars ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #059669)`,
              color: "#fff", fontSize: 11, fontWeight: 700, cursor: buildingAllChars ? "not-allowed" : "pointer" }}>
            {buildAllProgress || (buildingAllChars ? "Building..." : "Build Story Characters with AI")}
          </button>
          <div style={{ display: "flex", gap: 4 }}>
            <input value={charTabName} onChange={e => setCharTabName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && charTabName.trim()) { buildCharacterInline(charTabName.trim()).then(() => setCharTabName("")); }}}
              placeholder="Add character by name..."
              style={{ background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 11, outline: "none", width: 180 }} />
            <button onClick={() => { if (charTabName.trim()) buildCharacterInline(charTabName.trim()).then(() => setCharTabName("")); }}
              disabled={!charTabName.trim() || charTabCreating}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: charTabCreating ? "#2a2a40" : childAccent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
              {charTabCreating ? "..." : "+ Add"}
            </button>
          </div>
          {(() => {
            const charsWithoutImages = characters.filter(c => !c.imageUrl && !c.hasImage);
            return charsWithoutImages.length > 0 ? (
              <button disabled={!!batchPortraitProgress} onClick={async () => {
                let completed = 0;
                setBatchPortraitProgress(`0/${charsWithoutImages.length}`);
                for (const char of charsWithoutImages) {
                  try { await generateCharacterPortrait(char); completed++; setBatchPortraitProgress(`${completed}/${charsWithoutImages.length}`); if (completed < charsWithoutImages.length) await new Promise(r => setTimeout(r, 1500)); } catch { /* continue */ }
                }
                setBatchPortraitProgress(null);
                setLastAction(`Batch: ${completed}/${charsWithoutImages.length} portraits generated`);
              }}
                style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: batchPortraitProgress ? "not-allowed" : "pointer", opacity: batchPortraitProgress ? 0.7 : 1 }}>
                {batchPortraitProgress ? `Generating ${batchPortraitProgress}...` : `Generate All Portraits (${charsWithoutImages.length})`}
              </button>
            ) : null;
          })()}
          <button onClick={() => setShowCharacterPicker(true)}
            style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${dsLilac}30`, background: "transparent", color: dsLilac, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Import Existing
          </button>
        </div>
      </div>

      {uiError && (
        <div style={{ ...cardStyle, borderColor: "#ef444440", background: "#ef444410", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontSize: 12, color: "#ef4444" }}>{uiError}</p>
          <button onClick={() => setUiError(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>×</button>
        </div>
      )}

      {/* BUILD FROM PHOTO */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg, #ffffff18, transparent)" }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: "#ffffff40", letterSpacing: 2, textTransform: "uppercase" as const }}>Build from Photo</span>
          <div style={{ height: 1, flex: 1, background: "linear-gradient(270deg, #ffffff18, transparent)" }} />
        </div>
        <div
          onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
          onDragLeave={() => setPhotoDragOver(false)}
          onDrop={e => { e.preventDefault(); setPhotoDragOver(false); const file = e.dataTransfer.files?.[0]; if (file && file.type.startsWith("image/")) importCharacterFromPhoto(file, photoImportName); else setPhotoImportLog("[!] Drop an image file (JPG, PNG, WebP)"); }}
          style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 0, borderRadius: 14, overflow: "hidden", border: photoDragOver ? `2px solid ${childAccent}` : importingFromPhoto ? `2px solid ${dsLilac}60` : "2px solid #ffffff14", background: "#0d0d1a", transition: "border-color 0.2s ease" }}>
          <label style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 6, cursor: importingFromPhoto ? "not-allowed" : "pointer", background: photoDragOver ? `${childAccent}20` : importingFromPhoto ? `${dsLilac}15` : "#ffffff06", padding: "18px 10px", borderRight: "1px solid #ffffff10", minHeight: 90 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${photoDragOver ? childAccent : importingFromPhoto ? dsLilac : "#ffffff25"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: photoDragOver ? `${childAccent}18` : "#ffffff08" }}>
              {importingFromPhoto ? "..." : photoDragOver ? "Drop" : "+"}
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, color: photoDragOver ? childAccent : "#ffffff50", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
              {photoDragOver ? "Drop now" : importingFromPhoto ? "Reading…" : "Drop / Browse"}
            </span>
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={importingFromPhoto}
              onChange={e => { const file = e.target.files?.[0]; if (file) importCharacterFromPhoto(file, photoImportName); e.target.value = ""; }} />
          </label>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column" as const, justifyContent: "center", gap: 10 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Import any photo</p>
              <p style={{ fontSize: 10, color: muted, margin: 0 }}>AI reads the image, extracts visual traits, and builds a full character identity automatically.</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={photoImportName} onChange={e => setPhotoImportName(e.target.value)} placeholder="Character name (optional)"
                style={{ background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "7px 11px", color: "#fff", fontSize: 11, outline: "none", flex: 1 }}
                disabled={importingFromPhoto} />
              <label style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: importingFromPhoto ? "#1a1a2e" : `linear-gradient(135deg, ${childAccent}, #059669)`, color: importingFromPhoto ? "#444" : "#000", fontSize: 10, fontWeight: 800, cursor: importingFromPhoto ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const, flexShrink: 0, display: "flex", alignItems: "center" }}>
                {importingFromPhoto ? "Importing..." : "Choose Photo"}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={importingFromPhoto}
                  onChange={e => { const file = e.target.files?.[0]; if (file) importCharacterFromPhoto(file, photoImportName); e.target.value = ""; }} />
              </label>
            </div>
            {photoImportLog && <span style={{ fontSize: 9, fontWeight: 700, color: photoImportLog.startsWith("[!]") ? childAccent : "#22c55e" }}>{photoImportLog}</span>}
          </div>
        </div>
      </div>

      {/* Inline preview card */}
      {inlinePreview && (
        <div style={{ ...cardStyle, borderColor: `${childAccent}40`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            {inlinePreview.imageUrl ? (
              <img src={inlinePreview.imageUrl} alt={inlinePreview.displayName} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", border: `2px solid ${childAccent}40`, flexShrink: 0 }} />
            ) : (
              <Icon.User style={{ width: 20, height: 20 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{inlinePreview.displayName}</p>
                {inlinePreview.tags?.includes("photo-import") && <span style={{ fontSize: 9, fontWeight: 700, color: childAccent, background: `${childAccent}18`, padding: "2px 6px", borderRadius: 4 }}>FROM PHOTO</span>}
              </div>
              <p style={{ fontSize: 10, color: muted, margin: 0 }}>{inlinePreview.roleType} · {inlinePreview.gender} · {inlinePreview.ageRange}</p>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={acceptInlineCharacter} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: childAccent, color: "#000", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Add to Cast</button>
              <button onClick={() => { setInlinePreview(null); setPhotoImportLog(""); }} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>
                <Icon.X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6, marginBottom: 10 }}>
            {([["Species", inlinePreview.species], ["Build", inlinePreview.bodyBuild], ["Colours", inlinePreview.colorDescription], ["Face", inlinePreview.faceFeatures], ["Clothing", inlinePreview.clothingDetails], ["Distinctive", inlinePreview.distinctiveFeatures]] as [string, string | undefined][])
              .filter(([, v]) => v && v !== "not specified").map(([label, value]) => (
              <div key={label} style={{ padding: "6px 8px", borderRadius: 6, background: "#ffffff05" }}>
                <p style={{ fontSize: 8, color: muted, fontWeight: 600, textTransform: "uppercase" as const, marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 10, color: "#fff" }}>{(value as string).slice(0, 60)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {characters.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <Icon.Users style={{ width: 28, height: 28, color: muted, marginBottom: 12 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>No characters yet</p>
          <p style={{ fontSize: 12, color: muted, marginBottom: 20 }}>
            {(expandedContent || textContent.trim()) ? "Your story is ready — click above to let AI build all characters automatically." : "Write your story first, then AI will detect and build all characters for you."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" as const }}>
            {(expandedContent || textContent.trim()) && (
              <button onClick={buildAllStoryCharacters} disabled={buildingAllChars}
                style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: `linear-gradient(135deg, ${childAccent}, #059669)`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {buildAllProgress || "Build Story Characters with AI"}
              </button>
            )}
            <button onClick={() => setShowCharacterPicker(true)} style={{ padding: "12px 20px", borderRadius: 12, border: `1px solid ${dsLilac}40`, background: "transparent", color: dsLilac, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Import from Registry
            </button>
            {!(expandedContent || textContent.trim()) && (
              <button onClick={() => setActiveTab("content")} style={{ padding: "12px 20px", borderRadius: 12, border: `1px solid ${childAccent}40`, background: "transparent", color: childAccent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                ← Go to Story First
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
          {characters.map(char => {
            const isEditing = editingCharId === char.characterId;
            const isGenerating = generatingPortrait === char.characterId;
            const hasVisual = !!(char.species || char.colorDescription || char.clothingDetails || char.distinctiveFeatures);
            const visualDesc = buildVisualDescription(char);

            return (
              <div key={char.characterId} style={{ ...cardStyle, borderColor: char.imageLocked ? `${childAccent}40` : hasVisual ? `${dsLilac}30` : `${border}` }}>
                <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                  <div style={{ position: "relative", width: 80, height: 80, borderRadius: 14, background: `${dsLilac}20`, flexShrink: 0, overflow: "hidden", border: char.imageLocked ? `2px solid ${childAccent}` : `1px solid ${border}` }}>
                    {char.imageUrl
                      ? <img src={normalizeImageUrl(char.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.User style={{ width: 32, height: 32, color: muted }} /></div>
                    }
                    {char.imageLocked && <div style={{ position: "absolute", bottom: 2, right: 2, background: childAccent, borderRadius: 4, padding: "1px 4px", fontSize: 7, color: "#000", fontWeight: 800 }}>LOCKED</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{char.displayName}</p>
                        {char.imageLocked
                          ? <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${childAccent}20`, color: childAccent, fontWeight: 700 }}>Look Locked</span>
                          : hasVisual
                          ? <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${dsLilac}15`, color: dsLilac, fontWeight: 600 }}>AI-described</span>
                          : char.imageUrl
                          ? <span onClick={() => analyzeCharacterImage(char.characterId, char.imageUrl!)} style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${childAccent}10`, color: childAccent, fontWeight: 600, cursor: "pointer" }}>Click to AI-read image</span>
                          : <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${childAccent}10`, color: childAccent, fontWeight: 600 }}>Upload image first</span>
                        }
                      </div>
                      <button onClick={() => { if (confirm(`Remove ${char.displayName} from cast?`)) setCharacters(prev => prev.filter(x => x.characterId !== char.characterId)); }}
                        style={{ background: "#ef444415", border: "1px solid #ef444430", borderRadius: 6, color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 9px", flexShrink: 0 }}>
                        × Remove
                      </button>
                    </div>
                    {visualDesc ? (
                      <p style={{ fontSize: 9, color: "#aaa", lineHeight: 1.5, marginBottom: 4, background: `${dsLilac}06`, padding: "4px 6px", borderRadius: 6, border: `1px solid ${dsLilac}15` }}>
                        <span style={{ color: dsLilac, fontWeight: 600 }}>Visual: </span>{visualDesc.slice(0, 120)}{visualDesc.length > 120 ? "..." : ""}
                      </p>
                    ) : (
                      <p style={{ fontSize: 9, color: childAccent, background: `${childAccent}08`, padding: "4px 6px", borderRadius: 6, marginBottom: 4 }}>
                        Click &quot;Define Appearance&quot; to describe this character so scenes look consistent.
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                      <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${dsLilac}15`, color: dsLilac, fontWeight: 600 }}>{char.roleType}</span>
                      {char.gender && <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${C4}15`, color: C4, fontWeight: 600 }}>{char.gender}</span>}
                      {char.voiceId && <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${childAccent}15`, color: childAccent, fontWeight: 600 }}>Voice</span>}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: isEditing ? 12 : 0 }}>
                  <button onClick={() => setEditingCharId(isEditing ? null : char.characterId)}
                    style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isEditing ? dsLilac : border}`, background: isEditing ? `${dsLilac}15` : "transparent", color: isEditing ? dsLilac : muted, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    {isEditing ? "Close Builder" : "Define Appearance"}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>Model</span>
                    <select
                      value={charPortraitModel[char.characterId] || (char.tags?.includes("photo-import") ? "fal_flux_pulid" : "segmind_flux")}
                      onChange={e => setCharPortraitModel(prev => ({ ...prev, [char.characterId]: e.target.value }))}
                      style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "1px solid #ffffff20", background: "#0f172a", color: "#e2e8f0", outline: "none", flex: 1 }}>
                      <option value="segmind_flux">Flux Free ($0.0004) — drafts</option>
                      <option value="fal_flux_schnell">Flux Schnell ($0.003) — fast+good</option>
                      <option value="segmind_pruna">Pruna ($0.005) — fast</option>
                      <option value="fal_ideogram_v3_turbo">Ideogram v3 ($0.02) — text/ads</option>
                      <option value="fal_flux_dev">Flux Dev ($0.025) — quality</option>
                      <option value="fal_flux_pro">Flux Pro ($0.05) — best</option>
                      <option value="fal_flux_pulid">Face Lock / PuLID — real photo only</option>
                    </select>
                  </div>
                  <button onClick={() => generateCharacterPortrait(char)} disabled={isGenerating}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: isGenerating ? "#2a2a40" : `linear-gradient(135deg, ${C4}, #0084ff)`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer", opacity: isGenerating ? 0.7 : 1 }}>
                    {isGenerating ? "Generating 3 shots..." : char.imageUrl ? "Regenerate (3 shots)" : "Generate Portrait (3 shots)"}
                  </button>
                  {charRefImages[char.characterId]?.length > 0 && (
                    <div style={{ flexBasis: "100%", marginTop: 10, padding: "10px 12px", background: s2, borderRadius: 8, border: `1px solid ${border}` }}>
                      <p style={{ fontSize: 9, color: muted, marginBottom: 6, fontWeight: 600 }}>Full body shots — click to set as main</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        {charRefImages[char.characterId].map((shot, i) => {
                          const isMain = char.imageUrl === shot.url;
                          const ANGLE_NAME: Record<string, string> = { front: "Front", "three-quarter": "3/4 View", side: "Side" };
                          return (
                            <div key={i} onClick={() => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageUrl: shot.url } : c))}
                              style={{ cursor: "pointer", textAlign: "center" }}>
                              <img src={shot.url} alt={shot.angle} style={{ width: 56, height: 80, objectFit: "cover", borderRadius: 6, border: isMain ? `2px solid ${dsLilac}` : `1px solid ${border}`, display: "block" }} />
                              <span style={{ fontSize: 8, color: isMain ? dsLilac : muted, fontWeight: isMain ? 700 : 400 }}>{isMain ? "MAIN" : ANGLE_NAME[shot.angle] || shot.angle}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {char.imageUrl && (() => {
                    const isAnalyzing = analyzingCharacter === char.characterId;
                    return (
                      <button onClick={() => { if (!isAnalyzing) analyzeCharacterImage(char.characterId, char.imageUrl!); }} disabled={isAnalyzing}
                        style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${dsLilac}40`, background: isAnalyzing ? `${dsLilac}20` : `${dsLilac}08`, color: dsLilac, fontSize: 10, fontWeight: 700, cursor: isAnalyzing ? "wait" : "pointer", opacity: isAnalyzing ? 0.8 : 1 }}>
                        {isAnalyzing ? "Reading image..." : "AI Read Look"}
                      </button>
                    );
                  })()}
                  {(() => {
                    const isSaving = savingCharacter === char.characterId;
                    const isSaved = savedCharacter === char.characterId;
                    return (
                      <button onClick={() => { if (!isSaving) saveCharacterToRegistry(char); }} disabled={isSaving}
                        style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isSaved ? childAccent : "#e05c2040"}`, background: isSaved ? `${childAccent}18` : "#e05c2008", color: isSaved ? childAccent : "#e05c20", fontSize: 10, fontWeight: 700, cursor: isSaving ? "wait" : "pointer", opacity: isSaving ? 0.7 : 1 }}>
                        {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save Character"}
                      </button>
                    );
                  })()}
                  <button onClick={() => openImagePicker(char.characterId)}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #0ea5e940", background: "#0ea5e908", color: "#0ea5e9", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Import Image
                  </button>
                  {char.imageUrl && !char.imageLocked && (
                    <button onClick={() => { setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageLocked: true } : c)); setLastAction(`${char.displayName}'s look is LOCKED`); }}
                      style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      Lock this Look
                    </button>
                  )}
                  {char.imageLocked && (
                    <button onClick={() => { setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageLocked: false } : c)); }}
                      style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                      Unlock
                    </button>
                  )}
                </div>

                {/* Visual Identity Builder */}
                {isEditing && (
                  <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${dsLilac}20` }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: dsLilac, marginBottom: 10 }}>Visual Identity — fill in what makes this character unique</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Character Type / Species</label>
                        <input value={char.species || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, species: e.target.value } : c))}
                          placeholder='"rabbit", "human", "lion", "young boy"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Body Build / Size</label>
                        <input value={char.bodyBuild || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, bodyBuild: e.target.value } : c))}
                          placeholder='"small and round", "tall and slim"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Fur / Skin / Color Description</label>
                        <input value={char.colorDescription || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, colorDescription: e.target.value } : c))}
                          placeholder='"warm grey fur with white belly", "brown skin"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Face & Eyes</label>
                        <input value={char.faceFeatures || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, faceFeatures: e.target.value } : c))}
                          placeholder='"big round eyes, small button nose, wide smile"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Clothing (be specific)</label>
                        <input value={char.clothingDetails || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, clothingDetails: e.target.value } : c))}
                          placeholder='"red overalls, yellow shirt"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Accessories</label>
                        <input value={char.accessories || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, accessories: e.target.value } : c))}
                          placeholder='"small backpack, red hat"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Age / Posture</label>
                        <input value={char.ageAppearance || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, ageAppearance: e.target.value } : c))}
                          placeholder='"young child, age 6, cheerful expression"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ ...labelStyle, fontSize: 9 }}>Distinctive Features</label>
                        <input value={char.distinctiveFeatures || ""} onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, distinctiveFeatures: e.target.value } : c))}
                          placeholder='"fluffy white tail, very big ears, always smiling"'
                          style={{ width: "100%", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                      </div>
                    </div>
                    {buildVisualDescription(char) && (
                      <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: `${dsLilac}08`, border: `1px solid ${dsLilac}20` }}>
                        <p style={{ fontSize: 9, color: dsLilac, fontWeight: 600, marginBottom: 2 }}>→ This is what gets injected into every scene prompt:</p>
                        <p style={{ fontSize: 9, color: "#ccc", lineHeight: 1.6, fontStyle: "italic" }}>
                          CHARACTER {char.displayName.toUpperCase()} (EXACT FIXED APPEARANCE): {buildVisualDescription(char)}
                        </p>
                      </div>
                    )}
                    <button onClick={() => { generateCharacterPortrait(char); setEditingCharId(null); }} disabled={isGenerating}
                      style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C4}, #0084ff)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      Generate Portrait from This Description →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Next step CTA */}
      {characters.length > 0 && (
        <div style={{ ...cardStyle, borderColor: `${childAccent}20`, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {characters.filter(c => c.voiceId).length}/{characters.length} characters fully built
              </p>
              <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                {characters.filter(c => !c.voiceId).length > 0
                  ? `${characters.filter(c => !c.voiceId).length} still need AI build — click "Build Story Characters with AI" above`
                  : "All characters ready — proceed to Scene Board"}
              </p>
            </div>
            <button onClick={() => setActiveTab("sceneBoard")}
              style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C4}, #0084ff)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
              → Step 3: Scene Board
            </button>
          </div>
        </div>
      )}

      {/* CharacterPicker modal */}
      {showCharacterPicker && (
        <>
          <div onClick={() => setShowCharacterPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 299 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300, background: "#0f1117", border: "1px solid #ffffff18", borderRadius: 16, width: "min(680px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #ffffff10", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Import from Character Registry</p>
              <button onClick={() => setShowCharacterPicker(false)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}><Icon.X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <CharacterPicker
                onSelect={(char) => {
                  const newChar: ChildCharacterIdentity = {
                    characterId: char.characterId || char.id || `CC_IMP_${Date.now()}`,
                    dbId: char.id,
                    displayName: char.name,
                    roleType: char.role || "supporting",
                    gender: char.gender || "unknown",
                    ageRange: "child",
                    skinTone: "", hairStyle: "", wardrobeStyle: "",
                    speechStyle: "normal", accentType: "",
                    emotionProfile: "", voiceId: char.voiceId || "",
                    voiceType: "childlike", intonation: "playful", language: "English",
                    tags: ["imported"], hasVoice: !!char.voiceId, hasImage: !!char.imageUrl,
                    imageUrl: char.imageUrl ? (char.imageUrl.startsWith("http") || char.imageUrl.startsWith("/api/") ? char.imageUrl : `/api/media/${char.imageUrl.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`) : undefined,
                    visualDescription: char.visualDescription || undefined,
                  };
                  setCharacters(prev => prev.some(c => c.characterId === newChar.characterId) ? prev : [...prev, newChar]);
                  setShowCharacterPicker(false);
                  setLastAction(`Imported "${char.name}"`);
                }}
                onCreateNew={() => { window.open("/dashboard/character-voices?returnTo=children-planner", "_blank"); }}
                compact
              />
            </div>
          </div>
        </>
      )}

      {/* Image Picker Modal */}
      {imagePickerForCharId && (
        <>
          <div onClick={() => setImagePickerForCharId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 299 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300, background: "#0f1117", border: "1px solid #ffffff18", borderRadius: 16, width: "min(680px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column" as const, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #ffffff10", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Import Image</p>
                <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Pick an existing image for <strong style={{ color: "#0ea5e9" }}>{characters.find(c => c.characterId === imagePickerForCharId)?.displayName || imagePickerForCharId}</strong></p>
              </div>
              <button onClick={() => setImagePickerForCharId(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}><Icon.X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #ffffff08", background: "#ffffff04" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9" }}>Upload from computer</span>
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => { const dataUrl = ev.target?.result as string; if (dataUrl && imagePickerForCharId) assignImageToCharacter(imagePickerForCharId, dataUrl); };
                    reader.readAsDataURL(file);
                  }} />
                <span style={{ fontSize: 9, color: "#666" }}>JPG, PNG, WEBP</span>
              </label>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {imagePickerLoading ? <p style={{ textAlign: "center", color: "#888", fontSize: 12, padding: 40 }}>Loading assets...</p>
              : imagePickerAssets.length === 0 ? <div style={{ textAlign: "center", color: "#666", fontSize: 12, padding: 40 }}><p>No images found. Generate portrait images first.</p></div>
              : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {imagePickerAssets.map(asset => {
                    const displayUrl = asset.fileUrl || (asset.filePath ? `/api/media/${asset.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}` : "");
                    if (!displayUrl) return null;
                    return (
                      <div key={asset.id} onClick={() => imagePickerForCharId && assignImageToCharacter(imagePickerForCharId, displayUrl)}
                        style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "2px solid #ffffff10" }}>
                        <img src={displayUrl} alt={asset.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div style={{ padding: "5px 6px", background: "#ffffff06" }}>
                          <p style={{ fontSize: 9, color: "#ccc", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{asset.name}</p>
                          {asset.source === "character_registry" && <p style={{ fontSize: 8, color: "#7c3aed", marginTop: 1 }}>Character Registry</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
