import styles from './Sidebar.module.css'
import { getLineColor } from '../utils/lines'

// ── SVG Icons ──────────────────────────────────────────────────────────────
function Ico({ size = 15, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const IcoTrain  = (p) => <Ico {...p}><rect x="6" y="2" width="12" height="17" rx="3"/><path d="M6 9h12"/><circle cx="9" cy="13.5" r="1"/><circle cx="15" cy="13.5" r="1"/><path d="M8 21l2-4"/><path d="M16 21l-2-4"/></Ico>
const IcoBus    = (p) => <Ico {...p}><path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-4.3c.3-2.7.2-3.7.2-3.7H2s-.1 1-.2 3.7C1.5 16.3 2 18 2 18h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="17" cy="18" r="2"/></Ico>
const IcoBell   = (p) => <Ico {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></Ico>
const IcoSignal = (p) => <Ico {...p}><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></Ico>
const IcoFilter = (p) => <Ico {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></Ico>
const IcoSearch = (p) => <Ico {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></Ico>
const IcoX      = (p) => <Ico {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Ico>
const IcoRefresh= (p) => <Ico {...p}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></Ico>
const IcoCheck  = (p) => <Ico {...p}><path d="M20 6 9 17l-5-5"/></Ico>
const IcoWarn   = (p) => <Ico {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></Ico>
const IcoZap    = (p) => <Ico {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Ico>
const IcoArrow  = ({ left, ...p }) => <Ico {...p}><path d="M5 12h14"/>{left ? <path d="m12 19-7-7 7-7"/> : <path d="m12 5 7 7-7 7"/>}</Ico>

const METRO_LINES = [
  { id: '1', name: 'Verte'  },
  { id: '2', name: 'Orange' },
  { id: '4', name: 'Jaune'  },
  { id: '5', name: 'Bleue'  },
]

const EFFECT_LABELS = {
  NO_SERVICE:           'Aucun service',
  REDUCED_SERVICE:      'Service réduit',
  SIGNIFICANT_DELAYS:   'Retards importants',
  DETOUR:               'Détour',
  ADDITIONAL_SERVICE:   'Service additionnel',
  MODIFIED_SERVICE:     'Service modifié',
  STOP_MOVED:           'Arrêt déplacé',
  OTHER_EFFECT:         'Autre',
  UNKNOWN_EFFECT:       'Inconnu',
}

const SEVERITY_COLOR = {
  NO_SERVICE:         '#ff4060',
  REDUCED_SERVICE:    '#ff6b1a',
  SIGNIFICANT_DELAYS: '#f4a100',
  DETOUR:             '#3390ff',
  ADDITIONAL_SERVICE: '#00c96b',
  OTHER_EFFECT:       '#8888aa',
  UNKNOWN_EFFECT:     '#8888aa',
}

function AlertCard({ alert }) {
  const color = SEVERITY_COLOR[alert.effect] ?? '#8888aa'
  return (
    <article className={styles.card} style={{ '--alert-color': color }}>
      <div className={styles.cardStripe} />
      <div className={styles.cardBody}>
        <header className={styles.cardHeader}>
          <span className={styles.effect} style={{ color }}>
            {EFFECT_LABELS[alert.effect] ?? alert.effect}
          </span>
          {alert.routes.length > 0 && (
            <div className={styles.tags}>
              {[...new Set(alert.routes)].map(r => (
                <span key={r} className={styles.tag} style={{ background: getLineColor(r) }}>{r}</span>
              ))}
            </div>
          )}
        </header>
        <p className={styles.alertTitle}>{alert.headerText}</p>
        {alert.description && <p className={styles.alertDesc}>{alert.description}</p>}
      </div>
    </article>
  )
}

function Stat({ icon, label, value, accent, error }) {
  return (
    <div className={styles.stat} style={{ '--accent': accent }}>
      <div className={styles.statIcon}>{icon}</div>
      <span className={`${styles.statValue} ${error ? styles.statError : ''}`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

export default function Sidebar({
  alerts, alertsError, alertsLoading,
  metroCount, busCount, shownMetro, shownBus, vehicleError,
  filter, onFilterChange, busRoutes,
  now,
  showDepots,
  onToggleDepots,
  showREM,
  onToggleREM,
}) {
  const showMetroFilters = filter.mode !== 'bus'
  const showBusFilters   = filter.mode !== 'metro'

  function toggleLine(id) {
    onFilterChange(prev => {
      const next = new Set(prev.metroLines)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...prev, metroLines: next }
    })
  }

  function setMode(mode) {
    onFilterChange(prev => ({ ...prev, mode }))
  }

  function setDirection(direction) {
    onFilterChange(prev => ({ ...prev, direction }))
  }

  function setBusRoute(busRoute) {
    onFilterChange(prev => ({ ...prev, busRoute }))
  }

  function resetFilters() {
    onFilterChange({
      mode:       'all',
      metroLines: new Set(['1','2','4','5']),
      busRoute:   '',
      direction:  null,
    })
  }

  const busRouteSuggestions = filter.busRoute.trim()
    ? busRoutes.filter(r => String(r).includes(filter.busRoute.trim())).slice(0, 8)
    : []

  const timeStr = now
    ? now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--'

  const isFiltered = filter.mode !== 'all'
    || filter.metroLines.size < 4
    || filter.busRoute !== ''
    || filter.direction !== null

  return (
    <aside className={styles.sidebar}>

      {/* En-tête */}
      <div className={styles.header}>
        <div className={styles.logoRow}>
          <div className={styles.logoMark}>
            <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0085CA"/>
                  <stop offset="100%" stopColor="#005fa3"/>
                </linearGradient>
              </defs>
              <rect width="38" height="38" rx="9" fill="url(#logo-grad)"/>
              <text x="19" y="27" textAnchor="middle" fill="white" fontSize="23" fontWeight="800" fontFamily="Inter, sans-serif">M</text>
            </svg>
          </div>
          <div className={styles.titleGroup}>
            <span className={styles.Title}> Par arobase </span>
            <span className={styles.appTitle}>STM Temps Réel</span>
            <span className={styles.appSub}>Montréal Transit</span>
          </div>
          <div className={styles.liveChip}>
            <span className={styles.liveDot} />
            <span>DIRECT</span>
          </div>
        </div>
        <div className={styles.clockRow}>
          <span className={styles.clockDisplay}>{timeStr}</span>
          <span className={styles.clockSub}>Heure locale</span>
        </div>
      </div>

      {/* Stats réseau */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <IcoSignal size={13} />
          Réseau
        </h2>
        <div className={styles.statsGrid}>
          <Stat icon={<IcoTrain size={17}/>} label="Rames métro" value={metroCount} accent="#00c96b" error={!!vehicleError} />
          <Stat icon={<IcoBus   size={17}/>} label="Autobus"     value={busCount}   accent="#0085CA" error={!!vehicleError} />
          <Stat icon={<IcoBell  size={17}/>} label="Alertes"     value={alertsLoading ? '…' : alerts.length}
                accent={alerts.length > 0 ? '#f4a100' : '#5e5e80'} />
        </div>
        {vehicleError && <p className={styles.warn}><IcoWarn size={13}/> {vehicleError}</p>}
      </section>

      {/* Filtres */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <IcoFilter size={13} />
          Filtres
          {isFiltered && (
            <button className={styles.resetBtn} onClick={resetFilters} title="Réinitialiser les filtres">
              <IcoRefresh size={11}/> Réinit.
            </button>
          )}
        </h2>

        {/* Mode : Tous / Métro / Bus */}
        <div className={styles.modeToggle}>
          {[
            ['all',   null,                'Tous'],
            ['metro', <IcoTrain size={13}/>, 'Métro'],
            ['bus',   <IcoBus   size={13}/>, 'Bus'],
          ].map(([m, ico, label]) => (
            <button
              key={m}
              className={`${styles.modeBtn} ${filter.mode === m ? styles.modeBtnActive : ''}`}
              onClick={() => setMode(m)}
            >{ico}{label}</button>
          ))}
        </div>

        {/* Depots toggle */}
        <div className={styles.filterGroup} style={{ marginTop: 10 }}>
          <span className={styles.filterLabel}>Dépôts</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`${styles.modeBtn} ${showDepots ? styles.modeBtnActive : ''}`}
              onClick={() => onToggleDepots && onToggleDepots()}
            >
              {showDepots ? 'Visible' : 'Masqué'}
            </button>
            <small style={{ color: '#8f92a8' }}>Afficher les garages/ateliers</small>
          </div>
        </div>

        {/* REM toggle */}
        <div className={styles.filterGroup} style={{ marginTop: 10 }}>
          <span className={styles.filterLabel}>REM (A1–A4)</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`${styles.modeBtn} ${showREM ? styles.modeBtnActive : ''}`}
              onClick={() => onToggleREM && onToggleREM()}
            >
              {showREM ? 'Visible' : 'Masqué'}
            </button>
            <small style={{ color: '#8f92a8' }}>Afficher le REM (A1–A4)</small>
          </div>
        </div>

        {/* Lignes métro */}
        {showMetroFilters && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Lignes métro</span>
            <div className={styles.lineToggles}>
              {METRO_LINES.map(({ id, name }) => {
                const active = filter.metroLines.has(id)
                const color  = getLineColor(id)
                return (
                  <button
                    key={id}
                    className={`${styles.lineBtn} ${active ? styles.lineBtnActive : ''}`}
                    style={{
                      borderColor: color,
                      background:  active ? color : 'transparent',
                      color:       active ? (id === '4' ? '#111' : '#fff') : color,
                    }}
                    onClick={() => toggleLine(id)}
                    title={`Ligne ${id} – ${name}`}
                  >
                    {id}
                  </button>
                )
              })}
            </div>
            <div className={styles.lineLegend}>
              {METRO_LINES.map(({ id, name }) => (
                <span key={id} className={styles.lineLegendItem}>
                  <span className={styles.lineDot} style={{ background: getLineColor(id) }} />
                  Ligne {id} — {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ligne d'autobus */}
        {showBusFilters && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Ligne d'autobus</span>
            <div className={styles.busInputWrap}>
              <span className={styles.busIcon}><IcoSearch size={14}/></span>
              <input
                type="text"
                className={styles.busInput}
                placeholder="Ex: 49, 141…"
                value={filter.busRoute}
                onChange={e => setBusRoute(e.target.value)}
              />
              {filter.busRoute && (
                <button className={styles.busClear} onClick={() => setBusRoute('')}><IcoX size={12}/></button>
              )}
            </div>
            {busRouteSuggestions.length > 0 && (
              <div className={styles.busSuggestions}>
                {busRouteSuggestions.map(r => (
                  <button
                    key={r}
                    className={`${styles.busSugBtn} ${filter.busRoute === String(r) ? styles.busSugBtnActive : ''}`}
                    onClick={() => setBusRoute(String(r))}
                  >{r}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Direction */}
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Direction</span>
          <div className={styles.dirBtns}>
            {[
              [null, null,                       'Toutes'],
              [0,    <IcoArrow size={13}/>,       'Aller'],
              [1,    <IcoArrow size={13} left/>,  'Retour'],
            ].map(([dir, dirIco, label]) => (
              <button
                key={String(dir)}
                className={`${styles.dirBtn} ${filter.direction === dir ? styles.dirBtnActive : ''}`}
                onClick={() => setDirection(dir)}
              >{dirIco}{label}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Alertes */}
      <section className={`${styles.section} ${styles.alertsSection}`}>
        <h2 className={styles.sectionTitle}>
          <IcoZap size={13} />
          État du service
          <span className={styles.badge} style={alerts.length > 0 ? { background: '#f4a10022', borderColor: '#f4a10055', color: '#f4a100' } : {}}>
            {alertsLoading ? '…' : alerts.length}
          </span>
        </h2>
        {alertsError && <p className={styles.warn}><IcoWarn size={13}/> {alertsError}</p>}
        <div className={styles.alertList}>
          {!alertsLoading && alerts.length === 0 && !alertsError && (
            <div className={styles.noAlert}>
              <span className={styles.noAlertIcon}><IcoCheck size={15}/></span>
              <span>Aucune perturbation signalée</span>
            </div>
          )}
          {alerts.map(a => <AlertCard key={a.id} alert={a} />)}
        </div>
      </section>

    </aside>
  )
}
