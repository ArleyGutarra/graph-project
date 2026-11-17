/** Controles de reproducción de la cadena en vivo. */
export default function PlaybackBar({ playing, onToggle, onStep, onReset, onStop }) {
  return (
    <div className="playback">
      <button
        className="playback__button"
        type="button"
        onClick={onReset}
        aria-label="Reiniciar"
        title="Reiniciar"
      >
        ↺
      </button>

      <button
        className="playback__button"
        type="button"
        onClick={onStep}
        aria-label="Un paso"
        title="Un paso"
      >
        ⏭
      </button>

      <button
        className="playback__button playback__button--main"
        type="button"
        onClick={onToggle}
        aria-label={playing ? 'Pausar' : 'Reproducir'}
      >
        {playing ? '❚❚ Pausar' : '▶ Reproducir'}
      </button>

      <button
        className="playback__button"
        type="button"
        onClick={onStop}
        aria-label="Detener"
        title="Detener y dejar la trayectoria donde está"
      >
        ■
      </button>
    </div>
  );
}
