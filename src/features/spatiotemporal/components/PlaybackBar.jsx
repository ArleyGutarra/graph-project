/**
 * Barra de transporte tipo reproductor (idéntica a la maqueta):
 *
 *   |◀ « −5 ‹ −1  [▶ Reproducir]  +1 › +5 » ▶|      +100 pasos
 *   ──●───────────────────────────────────────────   (scrubber)
 *   Velocidad (pasos/s) · Micro-pasos (t⁻ → t⁺) · Mostrar cambios (Diff)
 *
 * Los botones ±1/±5 y el scrubber retroceden sobre la ventana de fotogramas
 * retenida por la cadena (`chain.seek`); `minT`/`maxT` marcan los límites.
 */
export default function PlaybackBar({
  playing,
  t,
  minT = 0,
  maxT = 0,
  speed = 2,
  subphase = 'plus',
  showDiff = true,
  fastSteps = 100,
  fastRunning = false,
  onToggle,
  onStep,
  onStepBy,
  onSeek,
  onRewind,
  onForward,
  onReset,
  onStop,
  onSpeed,
  onSubphase,
  onShowDiff,
}) {
  const canBack = t > minT;
  const canFwd = t < maxT;

  const button = (id, label, title, onClick, disabled, className = '') => (
    <button
      key={id}
      className={`playback__button ${className}`.trim()}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {label}
    </button>
  );

  return (
    <div className="playback playback--transport">
      <div className="transport__row">
        {button('first', '|◀', 'Ir al inicio (t = 0)', onRewind, !canBack)}
        {button('back5', '« −5', 'Retroceder 5 pasos', () => onStepBy?.(-5), !canBack)}
        {button('back1', '‹ −1', 'Retroceder 1 paso', () => onStepBy?.(-1), !canBack)}

        <button
          className="playback__button playback__button--main"
          type="button"
          onClick={onToggle}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? '❚❚ Pausar' : '▶ Reproducir'}
        </button>

        {button('fwd1', '+1 ›', 'Avanzar 1 paso', onStep, false)}
        {button('fwd5', '+5 »', 'Avanzar 5 pasos', () => onStepBy?.(5), false)}
        {button('last', '▶|', 'Ir al último fotograma retenido', onForward, !canFwd)}

        <span className="transport__spacer" />

        <button
          className="playback__button"
          type="button"
          onClick={() => onStepBy?.(fastSteps)}
          title={`Anexar ${fastSteps} pasos a la trayectoria`}
        >
          +{fastSteps} pasos
        </button>

        {button('reset', '↺', 'Reiniciar la cadena desde π₀', onReset, false)}
        {button('stop', '■', 'Detener la reproducción', onStop, false)}
      </div>

      <div className="scrubber">
        <span className="scrubber__bound">{minT}</span>
        <input
          type="range"
          min={minT}
          max={Math.max(maxT, minT)}
          step={1}
          value={Math.min(t, Math.max(maxT, minT))}
          onChange={(event) => onSeek?.(Number(event.target.value))}
          aria-label="Instante t de la trayectoria"
        />
        <span className="scrubber__bound">{maxT}</span>
        <span className="scrubber__readout">t = {t}</span>
      </div>

      <div className="playback__options">
        <label className="playback__option" htmlFor="playback-speed">
          Velocidad
          <select
            id="playback-speed"
            value={speed}
            onChange={(event) => onSpeed?.(Number(event.target.value))}
          >
            {[0.5, 1, 2, 5, 10].map((value) => (
              <option key={value} value={value}>
                {value} paso{value === 1 ? '' : 's'}/s
              </option>
            ))}
          </select>
        </label>

        <label className="playback__option">
          <input
            type="checkbox"
            checked={subphase === 'plus'}
            onChange={(event) => onSubphase?.(event.target.checked ? 'plus' : 'minus')}
          />
          Micro-pasos (t⁻ → t⁺)
        </label>

        <label className="playback__option">
          <input
            type="checkbox"
            checked={showDiff}
            onChange={(event) => onShowDiff?.(event.target.checked)}
          />
          Mostrar cambios (Diff)
        </label>

        {fastRunning ? (
          <span className="playback__busy" aria-live="polite">
            ejecutando {fastSteps} pasos…
          </span>
        ) : null}
      </div>
    </div>
  );
}
