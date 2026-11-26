"use client";

import { useRef, useState } from "react";
import { LAUNCH_FILM_POSTER, LAUNCH_FILM_SRC } from "@/lib/career-map/constants";
import { LANDING_FILM } from "./landing-content";
import styles from "./landing.module.css";

/**
 * The launch film, self-hosted (the CSP has no media-src, so it must be same
 * origin). Native controls stay on so the film plays without JS too; the big
 * play button is a shortcut that disappears once the film has started.
 * preload="none" keeps the 2.7 MB file off the critical path; only the poster loads.
 */
export function LaunchFilm() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  function play() {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    void video.play().catch(() => {
      // Autoplay rules or a decode error: hand control back to the native controls.
      setStarted(false);
    });
  }

  return (
    <div className={styles.filmFrame}>
      <video
        ref={videoRef}
        className={styles.filmVideo}
        controls
        preload="none"
        playsInline
        poster={LAUNCH_FILM_POSTER}
        width={1280}
        height={720}
        aria-label={LANDING_FILM.posterAlt}
        onPlay={() => setStarted(true)}
        data-testid="launch-film"
      >
        <source src={LAUNCH_FILM_SRC} type="video/mp4" />
      </video>
      {started ? null : (
        <button type="button" className={styles.filmPlay} onClick={play} aria-label="Play the film" data-testid="cta-play-film" data-agent-action="play-launch-film" data-cta-location="film">
          <svg aria-hidden="true" width="30" height="34" viewBox="0 0 30 34" focusable="false">
            <path d="M4 2 L28 17 L4 32 Z" fill="#FFFFFF" />
          </svg>
        </button>
      )}
    </div>
  );
}
