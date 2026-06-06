"use client";

// Overview tab — project status snapshot.
// Holds: production system toggle (Hybrid/Movie), Movie Mode sub-options,
// 4 stats bubbles (Content/Style/Preview/Safety), production progress bars,
// next-step nudge, demo scene gallery, demo videos strip, 4 quick-links,
// warnings panel.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 1.5, 2026-06-05).

import * as React from "react";
import * as Icon from "../../../components/icons";
import { ds } from "../../../../lib/designSystem";

export interface OverviewTabProps {
  // ── State READ ──
  productionSystem: "hybrid" | "movie";
  textContent: string;
  styleProgress: number;
  generatedVideoUrl: string;
  review1Done: boolean;
  review2Done: boolean;
  contentProgress: number;
  previewProgress: number;
  reviewProgress: number;
  lastAction: string;
  designComplete: boolean;
  contentImage: string | null;
  movieGenre: string;
  movieSceneCount: number;
  movieSceneDuration: string;
  // ── Constants ──
  MOVIE_GENRES: readonly string[];
  MOVIE_SCENE_COUNTS: readonly number[];
  MOVIE_SCENE_DURATIONS: readonly string[];
  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  childAccent: string;
  childSafe: string;
  muted: string;
  s2: string;
  border: string;
  C2: string;
  C3: string;
  C4: string;
  // ── State WRITE / nav ──
  setProductionSystem: (s: "hybrid" | "movie") => void;
  setMovieGenre: (g: string) => void;
  setMovieSceneCount: (n: number) => void;
  setMovieSceneDuration: (d: string) => void;
  // Accepts the parent's full WorkshopTab union literally — destinations include
  // design / content / sound / review1 / review2 / preview. Loosen to string so
  // we don't need to import WorkshopTab (avoid cycle).
  setActiveTab: (t: "design" | "content" | "sound" | "review1" | "review2" | "preview" | "assembly") => void;
  setContentImage: (s: string | null) => void;
  setLastAction: (s: string) => void;
}

// Inline ProgressBar — only used here. Avoids exporting it from parent.
function ProgressBar({ label, value, color, muted, border }: { label: string; value: number; color: string; muted: string; border: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: muted }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: border }}>
        <div style={{ width: `${value}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

export default function OverviewTab(props: OverviewTabProps) {
  const {
    productionSystem, textContent, styleProgress, generatedVideoUrl, review1Done, review2Done,
    contentProgress, previewProgress, reviewProgress, lastAction, designComplete, contentImage,
    movieGenre, movieSceneCount, movieSceneDuration,
    MOVIE_GENRES, MOVIE_SCENE_COUNTS, MOVIE_SCENE_DURATIONS,
    cardStyle, labelStyle, childAccent, childSafe, muted, s2, border, C2, C3, C4,
    setProductionSystem, setMovieGenre, setMovieSceneCount, setMovieSceneDuration,
    setActiveTab, setContentImage, setLastAction,
  } = props;

  return (
    <div>
      {/* Production System Toggle */}
      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <p style={labelStyle}>Production System</p>
        <div style={{ display: "flex", gap: 8, marginBottom: productionSystem === "movie" ? 16 : 0 }}>
          <button
            onClick={() => { setProductionSystem("hybrid"); setLastAction("System: Hybrid Story"); }}
            style={{ flex: 1, padding: "12px 10px", borderRadius: 12, border: `2px solid ${productionSystem === "hybrid" ? ds.color.lilac : ds.color.line}`, background: productionSystem === "hybrid" ? `${ds.color.lilac}10` : "transparent", cursor: "pointer", textAlign: "center" }}
          >
            <div style={{ width: 28, height: 28, borderRadius: 8, background: ds.grad.tile.c4, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon.Film size={14} color="#fff" />
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: productionSystem === "hybrid" ? ds.color.lilac : ds.color.ink }}>Hybrid Story</p>
            <p style={{ fontSize: 9, color: ds.color.mute }}>Text + images pipeline</p>
          </button>
          <button
            onClick={() => { setProductionSystem("movie"); setLastAction("System: Movie Mode"); }}
            style={{ flex: 1, padding: "12px 10px", borderRadius: 12, border: `2px solid ${productionSystem === "movie" ? ds.color.lilac : ds.color.line}`, background: productionSystem === "movie" ? `${ds.color.lilac}10` : "transparent", cursor: "pointer", textAlign: "center" }}
          >
            <div style={{ width: 28, height: 28, borderRadius: 8, background: ds.grad.tile.c7, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon.Monitor size={14} color="#fff" />
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: productionSystem === "movie" ? ds.color.lilac : ds.color.ink }}>Movie Mode</p>
            <p style={{ fontSize: 9, color: ds.color.mute }}>Scenes + video generation</p>
          </button>
        </div>

        {productionSystem === "movie" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, paddingTop: 4 }}>
            <div>
              <p style={labelStyle}>Genre</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {MOVIE_GENRES.map(g => (
                  <button
                    key={g}
                    onClick={() => { setMovieGenre(g); setLastAction(`Genre: ${g}`); }}
                    style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${movieGenre === g ? childAccent : border}`, background: movieGenre === g ? `${childAccent}12` : "transparent", color: movieGenre === g ? childAccent : "#fff", fontSize: 10, fontWeight: movieGenre === g ? 700 : 400, cursor: "pointer", textAlign: "left" }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={labelStyle}>Number of Scenes</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {MOVIE_SCENE_COUNTS.map(n => (
                  <button
                    key={n}
                    onClick={() => { setMovieSceneCount(n); setLastAction(`Scenes: ${n}`); }}
                    style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${movieSceneCount === n ? childAccent : border}`, background: movieSceneCount === n ? `${childAccent}12` : "transparent", color: movieSceneCount === n ? childAccent : "#fff", fontSize: 10, fontWeight: movieSceneCount === n ? 700 : 400, cursor: "pointer", textAlign: "left" }}
                  >
                    {n} scenes
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={labelStyle}>Scene Duration</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {MOVIE_SCENE_DURATIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => { setMovieSceneDuration(d); setLastAction(`Duration: ${d}`); }}
                    style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${movieSceneDuration === d ? childAccent : border}`, background: movieSceneDuration === d ? `${childAccent}12` : "transparent", color: movieSceneDuration === d ? childAccent : "#fff", fontSize: 10, fontWeight: movieSceneDuration === d ? 700 : 400, cursor: "pointer", textAlign: "left" }}
                  >
                    {d} per scene
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        {[
          { label: "Content", value: textContent ? "Ready!" : "Empty",   color: childAccent, ok: !!textContent },
          { label: "Style",   value: styleProgress === 100 ? "Set!" : "Pending", color: C3, ok: styleProgress === 100 },
          { label: "Preview", value: generatedVideoUrl ? "Done!" : "Not yet", color: C4, ok: !!generatedVideoUrl },
          { label: "Safety",  value: review1Done && review2Done ? "2/2" : review1Done ? "1/2" : "0/2", color: childSafe, ok: review1Done && review2Done },
        ].map(stat => (
          <div key={stat.label} style={{
            ...cardStyle, marginBottom: 0, textAlign: "center", padding: "18px 12px",
            border: `2px solid ${stat.ok ? stat.color + "50" : border}`,
            background: stat.ok ? `${stat.color}10` : ds.color.card,
            boxShadow: stat.ok ? `0 0 20px ${stat.color}20` : "none",
          }}>
            <p style={{ fontSize: 18, fontWeight: 900, color: stat.ok ? stat.color : muted, margin: "0 0 4px" }}>{stat.value}</p>
            <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Progress + Next Steps */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Production Progress</p>
          <ProgressBar label="Content" value={contentProgress} color={childAccent} muted={muted} border={border} />
          <ProgressBar label="Style"   value={styleProgress} color={childAccent} muted={muted} border={border} />
          <ProgressBar label="Preview" value={previewProgress} color="#00d4ff" muted={muted} border={border} />
          <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, marginTop: 6 }}>
            <ProgressBar label="Safety Reviews" value={reviewProgress} color={childSafe} muted={muted} border={border} />
          </div>
        </div>

        <div style={cardStyle}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Next Steps</p>
          <div style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}`, marginBottom: 8 }}>
            <p style={{ fontSize: 9, color: childAccent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Last Action</p>
            <p style={{ fontSize: 12, color: "#fff" }}>{lastAction}</p>
          </div>
          <div style={{ background: `${childSafe}08`, borderRadius: 10, padding: 12, border: `1px solid ${childSafe}20` }}>
            <p style={{ fontSize: 9, color: childSafe, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Next Step</p>
            <p style={{ fontSize: 12, color: "#fff" }}>
              {!designComplete ? "Set age group & learning mode" :
               !textContent ? "Enter your content" :
               styleProgress < 100 ? "Choose voice & style" :
               !review1Done ? "Complete safety review" :
               !generatedVideoUrl ? "Generate preview" :
               !review2Done ? "Complete final review" :
               "Ready to render!"}
            </p>
            <button
              onClick={() => {
                if (!designComplete) setActiveTab("design");
                else if (!textContent) setActiveTab("content");
                else if (styleProgress < 100) setActiveTab("sound");
                else if (!review1Done) setActiveTab("review1");
                else if (!generatedVideoUrl) setActiveTab("preview");
                else if (!review2Done) setActiveTab("review2");
                else setActiveTab("review2");
              }}
              style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}
            >
              Go
            </button>
          </div>
        </div>
      </div>

      {/* Demo Scene Gallery */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: childAccent }}>Sample Scenes</p>
            <p style={{ margin: 0, fontSize: 11, color: muted }}>Examples of what your children videos can look like</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            { img: "/api/media/demo/child_abc.png",       label: "ABC Learning",    color: C4 },
            { img: "/api/media/demo/child_colors.png",    label: "Color World",     color: C2 },
            { img: "/api/media/demo/child_counting.png",  label: "Counting Fun",    color: C3 },
            { img: "/api/media/demo/child_nursery.png",   label: "Nursery Rhyme",   color: "#c084fc" },
            { img: "/api/media/demo/child_story.png",     label: "Story Time",      color: childSafe },
          ].map(scene => (
            <div
              key={scene.label}
              style={{ position: "relative", borderRadius: 14, overflow: "hidden", cursor: "pointer", border: `2px solid ${scene.color}30`, transition: "all 0.2s" }}
              onClick={() => setContentImage(scene.img)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scene.img}
                alt={scene.label}
                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 8px", background: `linear-gradient(transparent, rgba(0,0,0,0.85))` }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: scene.color }}>{scene.label}</p>
              </div>
              <div style={{ position: "absolute", top: 6, right: 6, background: scene.color, borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700, color: "#000" }}>Demo</div>
            </div>
          ))}
        </div>
        {contentImage && (
          <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 12, background: `${childSafe}10`, border: `1px solid ${childSafe}30`, display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.Check style={{ width: 14, height: 14, color: childSafe, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: childSafe }}>Demo image selected as content reference</p>
            <button onClick={() => setContentImage(null)} style={{ marginLeft: "auto", fontSize: 10, padding: "3px 8px", borderRadius: 6, border: `1px solid ${childSafe}40`, background: "transparent", color: childSafe, cursor: "pointer" }}>Clear</button>
          </div>
        )}
      </div>

      {/* Demo Videos */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Icon.Film style={{ width: 18, height: 18, color: C2, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C2 }}>Demo Videos</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {[
            { src: "/api/media/demo/child_abc_scene.mp4",      label: "ABC Video",    color: C4 },
            { src: "/api/media/demo/child_colors_scene.mp4",   label: "Colors Video", color: C2 },
            { src: "/api/media/demo/child_counting_scene.mp4", label: "Count Video",  color: C3 },
            { src: "/api/media/demo/child_nursery_scene.mp4",  label: "Nursery",      color: "#c084fc" },
            { src: "/api/media/demo/child_story_scene.mp4",    label: "Story Video",  color: childSafe },
          ].map(v => (
            <div key={v.label} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${v.color}30` }}>
              <video
                src={v.src}
                muted
                loop
                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                onMouseEnter={e => (e.target as HTMLVideoElement).play()}
                onMouseLeave={e => (e.target as HTMLVideoElement).pause()}
              />
              <p style={{ margin: 0, padding: "6px 8px", fontSize: 10, fontWeight: 700, color: v.color, background: "rgba(0,0,0,0.6)" }}>▶ {v.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        {[
          { label: designComplete ? "Design Set" : "Set Design", color: C3, action: () => setActiveTab("design"), href: null as string | null },
          { label: "Open Editor",     color: childSafe, action: null, href: "/dashboard/collaborative-editor?from=children-planner" },
          { label: "Characters",      color: C2, action: null, href: "/dashboard/character-voices" },
          { label: "Children Video",  color: C4, action: null, href: "/dashboard/children-video" },
        ].map(link => {
          const inner = (
            <div
              onClick={link.action ?? undefined}
              style={{ ...cardStyle, cursor: "pointer", textAlign: "center", padding: "18px 8px", marginBottom: 0, border: `2px solid ${link.color}30`, transition: "all 0.18s" }}
            >
              <p style={{ fontSize: 11, color: link.color, fontWeight: 700, marginBottom: 0 }}>{link.label}</p>
            </div>
          );
          return link.href ? (
            <a key={link.label} href={link.href} style={{ textDecoration: "none" }}>{inner}</a>
          ) : (
            <React.Fragment key={link.label}>{inner}</React.Fragment>
          );
        })}
      </div>

      {/* Warnings */}
      {(!textContent || styleProgress < 100 || (!review1Done && generatedVideoUrl)) && (
        <div style={{ ...cardStyle, borderColor: "#f59e0b30", background: "rgba(245,158,11,0.04)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 10 }}>Warnings</p>
          {!textContent && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(245,158,11,0.06)", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#f59e0b" }}>!</span>
              <p style={{ fontSize: 11, color: "#f59e0b", flex: 1 }}>No content entered yet</p>
              <button onClick={() => setActiveTab("content")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "transparent", color: "#f59e0b", fontSize: 8, cursor: "pointer" }}>Fix</button>
            </div>
          )}
          {styleProgress < 100 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(245,158,11,0.06)", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#f59e0b" }}>!</span>
              <p style={{ fontSize: 11, color: "#f59e0b", flex: 1 }}>Style configuration incomplete</p>
              <button onClick={() => setActiveTab("sound")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "transparent", color: "#f59e0b", fontSize: 8, cursor: "pointer" }}>Fix</button>
            </div>
          )}
          {!review1Done && generatedVideoUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(245,158,11,0.06)", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#f59e0b" }}>!</span>
              <p style={{ fontSize: 11, color: "#f59e0b", flex: 1 }}>Safety review not completed</p>
              <button onClick={() => setActiveTab("review1")} style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(245,158,11,0.3)", background: "transparent", color: "#f59e0b", fontSize: 8, cursor: "pointer" }}>Fix</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
