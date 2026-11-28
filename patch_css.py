import io

p = 'src/features/spatiotemporal/components/widgets.css'
s = io.open(p, encoding='utf-8').read()


def rep(old, new):
    global s
    assert old in s, 'NOT FOUND: ' + old[:120]
    s = s.replace(old, new, 1)


# Columna genérica (Estacionaria e Inspector)
rep(
    """/* --- Columna del Inspector -------------------------------------------- */

.analysis__inspector {
  flex: 0 0 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 12px;
  border-left: 1px solid var(--line-soft);
  overflow-y: auto;
}""",
    """/* --- Columnas arrastrables (Estacionaria e Inspector) ------------------ *
 * El ancho lo pone el divisor; con width: 0 la columna queda oculta pero
 * SIGUE MONTADA, así que no se pierden los resultados ni los parámetros. */

.analysis__column {
  flex: 0 0 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-x: hidden;
  overflow-y: auto;
}

.analysis__column.is-open {
  padding-left: 12px;
  border-left: 1px solid var(--line-soft);
}""",
)

# Rejilla: 1 columna → 4/8 · 2 columnas → 3/9
rep(
    """/* Con el Inspector abierto el escenario cede sitio a las gráficas y a la
   columna (sólo en pantallas donde la rejilla va en dos columnas). */
@media (min-width: 1181px) {
  .simulation.has-inspector .cell--stage {
    grid-column: span 4;
  }

  .simulation.has-inspector .cell--side {
    grid-column: span 8;
  }
}""",
    """/* Cuanto más columnas se abren, más cede el escenario al panel (sólo en
   pantallas donde la rejilla va en dos columnas):
     0 columnas → 5 / 7   ·   1 columna → 4 / 8   ·   2 columnas → 3 / 9 */
@media (min-width: 1181px) {
  .simulation.has-1col .cell--stage {
    grid-column: span 4;
  }

  .simulation.has-1col .cell--side {
    grid-column: span 8;
  }

  .simulation.has-2cols .cell--stage {
    grid-column: span 3;
  }

  .simulation.has-2cols .cell--side {
    grid-column: span 9;
  }
}""",
)

io.open(p, 'w', encoding='utf-8').write(s)
print('OK widgets.css')
