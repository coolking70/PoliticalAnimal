import { useEffect, useMemo, useState } from 'react';
import type { GameSave, ResolvedNarrativeFraming } from './models/game';
import { dismissCurrentFraming, getCurrentEvent, getCurrentFraming, getWeightedCandidates, createGame, choose } from './store/gameStore';
import { defaultScenarioId, getScenarioBundle, listScenarios } from './content/scenarioRegistry';
import { loadFromStorage, saveToStorage } from './engine/saveEngine';
import { getDebtPressureCap } from './engine/debtEngine';
import { formatPlayerValue } from './engine/historyEngine';
import './styles.css';

type Tab = 'scene' | 'history' | 'archive' | 'settings' | 'debug';

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

function randomSeed() {
  return Math.floor(Math.random() * 900000) + 100000;
}

const framingLabels = {
  newspaper: { format: '报纸', action: '翻过这一版' },
  tv_news: { format: '电视新闻', action: '结束收看' },
  government_memo: { format: '政府文件', action: '阅后归档' },
  internal_memo: { format: '内部备忘录', action: '阅后收起' },
} as const;

const framingStanceLabels = {
  government: '政府口径',
  media: '媒体报道',
  opposition: '对方视角',
  institution: '机构立场',
  foreign_observer: '国际观察',
} as const;

const eventTypeLabels = {
  core: '重要议程',
  reactive: '局势回应',
  ambient: '社会回声',
  debt: '承诺追索',
  ending: '历史终章',
} as const;

function FramingView({ framing, seenCount, pendingCount, onDismiss }: {
  framing: ResolvedNarrativeFraming;
  seenCount: number;
  pendingCount: number;
  onDismiss: () => void;
}) {
  const labels = framingLabels[framing.type];
  return (
    <div className={`framing-stage framing-${framing.type}`} data-framing-id={framing.id}>
      <article className="framing-document">
        <header className="framing-header">
          <div className="framing-source"><span>{framing.sourceEmoji ?? '◆'}</span><div><b>{framing.sourceName}</b><small>{labels.format} · {framingStanceLabels[framing.stance]}</small></div></div>
          <span className="framing-counter">已阅 {seenCount} · 待阅 {pendingCount}</span>
        </header>
        <div className="framing-rule" />
        {framing.renderedEyebrow && <p className="framing-eyebrow">{framing.renderedEyebrow}</p>}
        <h2>{framing.renderedTitle}</h2>
        <p className="framing-body">{framing.renderedBody}</p>
        {framing.renderedFooter && <footer className="framing-footer">{framing.renderedFooter}</footer>}
        <div className="framing-stamp">{framing.type === 'tv_news' ? 'ON AIR' : framing.type === 'newspaper' ? '号外' : framing.type === 'government_memo' ? '已阅' : '内部'}</div>
      </article>
      <button className="primary-button framing-dismiss" onClick={onDismiss}>{labels.action} →</button>
      <p className="framing-hint">读完这份材料后，局势将继续推进。</p>
    </div>
  );
}

export default function App() {
  const [seed, setSeed] = useState(872631);
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultScenarioId);
  const [game, setGame] = useState<GameSave | null>(null);
  const [tab, setTab] = useState<Tab>('scene');
  const [notice, setNotice] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const current = game ? getCurrentEvent(game) : null;
  const currentFraming = game ? getCurrentFraming(game) : null;
  const weightedCandidates = useMemo(() => game ? getWeightedCandidates(game) : [], [game]);
  const activeBundle = getScenarioBundle(game?.scenarioId ?? selectedScenarioId);
  const activeScenario = activeBundle.scenario;
  const currentPhase = activeScenario.phases.find((phase) => phase.id === game?.worldState.phase);
  const scenarios = useMemo(() => listScenarios(), []);
  const tabs: { id: Tab; label: string }[] = useMemo(() => [
    { id: 'scene', label: activeScenario.workspaceLabel },
    { id: 'history', label: '历史' },
    { id: 'archive', label: '政治档案' },
    { id: 'settings', label: '设置' },
    { id: 'debug', label: '调试' },
  ], [activeScenario.workspaceLabel]);

  const begin = (nextSeed = seed, scenarioId = selectedScenarioId) => {
    setSeed(nextSeed);
    setSelectedScenarioId(scenarioId);
    setGame(createGame(nextSeed, scenarioId));
    setTab('scene');
    setNotice('');
  };

  const selectChoice = (choiceId: string) => {
    if (!game || !current || currentFraming) return;
    const choice = current.choices.find((item) => item.id === choiceId);
    if (!choice) return;
    try {
      const next = choose(game, choice);
      setGame(next);
      if (next.pendingFramingIds.length) setNotice('');
      else {
        setNotice(choice.response);
        window.setTimeout(() => setNotice(''), 3600);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '剧情推进失败');
    }
  };

  const dismissFraming = () => {
    if (!game || !currentFraming) return;
    setGame(dismissCurrentFraming(game));
    setNotice('');
  };

  const save = () => {
    if (!game) return;
    saveToStorage(game);
    setNotice('存档已写入本机。制度暂时记住了你。');
  };

  const load = () => {
    try {
      const loaded = loadFromStorage();
      if (!loaded) return setNotice('尚无本地存档。');
      setGame(loaded);
      setSeed(loaded.seed);
      setSelectedScenarioId(loaded.scenarioId);
      setTab('scene');
      setNotice('存档已恢复。历史拒绝重新开始。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '存档读取失败');
    }
  };

  const returnToScenarioMenu = () => {
    setGame(null);
    setTab('scene');
    setNotice('');
    setShowExitConfirm(false);
  };

  const requestReturnToScenarioMenu = () => {
    if (!game) return;
    if (game.status === 'playing') setShowExitConfirm(true);
    else returnToScenarioMenu();
  };

  const entityName = (id: string) => activeBundle.actors.find((actor) => actor.id === id)?.name
    ?? activeBundle.institutions.find((institution) => institution.id === id)?.name
    ?? id;

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (showExitConfirm) {
        if (event.key === 'Escape') setShowExitConfirm(false);
        return;
      }
      if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }
      if (!game && ['enter', ' '].includes(event.key.toLowerCase())) {
        event.preventDefault();
        begin();
        return;
      }
      if (game && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        const index = tabs.findIndex((item) => item.id === tab);
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setTab(tabs[(index + direction + tabs.length) % tabs.length].id);
        return;
      }
      if (currentFraming && tab === 'scene' && ['enter', ' '].includes(event.key.toLowerCase())) {
        event.preventDefault();
        dismissFraming();
        return;
      }
      const shortcutIndex = event.key >= '1' && event.key <= '9'
        ? Number(event.key) - 1
        : event.key.toLowerCase() === 'b' ? 1
        : ['a', 'enter', ' '].includes(event.key.toLowerCase()) ? 0
        : -1;
      if (shortcutIndex >= 0 && current && tab === 'scene') {
        const choice = current.choices[shortcutIndex];
        if (choice) selectChoice(choice.id);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  useEffect(() => {
    window.render_game_to_text = () => JSON.stringify(game ? {
      coordinateSystem: 'DOM narrative UI; origin top-left, x right, y down',
      mode: tab,
      scenarioId: game.scenarioId,
      playerRole: activeScenario.playerRole,
      turn: game.turn,
      seed: game.seed,
      status: game.status,
      phase: game.worldState.phase,
      event: current ? {
        id: current.id,
        title: current.title,
        actor: current.actorName,
        institution: current.institutionName,
        scene: current.scene,
        choices: current.choices.map((choice, index) => ({ key: index + 1, id: choice.id, label: choice.label })),
      } : null,
      framing: currentFraming ? {
        id: currentFraming.id,
        type: currentFraming.type,
        stance: currentFraming.stance,
        source: currentFraming.sourceName,
        title: currentFraming.renderedTitle,
        body: currentFraming.renderedBody,
        pendingCount: game.pendingFramingIds.length,
        control: 'Enter/Space or framing button to continue',
      } : null,
      worldState: game.worldState,
      completedEvents: game.completedEvents,
      historyCount: game.history.length,
      memories: game.memories.map((memory) => ({ id: memory.id, topic: memory.topic, statement: memory.statement, public: memory.public, importance: memory.importance, active: memory.active })),
      debts: game.debts.map((debt) => ({ id: debt.id, creditor: debt.creditor, topic: debt.topic, pressure: debt.pressure, status: debt.status })),
      eligibleEvents: weightedCandidates.map((candidate) => ({ id: candidate.event.id, finalWeight: Number(candidate.finalWeight.toFixed(2)) })),
    } : { mode: 'menu', seed, selectedScenarioId, scenarios: scenarios.map((item) => ({ id: item.id, title: item.title, playerRole: item.playerRole })) });
    window.advanceTime = () => undefined;
  }, [game, current, currentFraming, tab, weightedCandidates, seed, selectedScenarioId, scenarios]);

  return (
    <>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark">PA</div>
          <div>
            <p className="eyebrow">狐狸共和国 · 共和国历 34 年</p>
            <h1>政治动物</h1>
          </div>
          <div className="top-actions">
            <span className="seed-chip">SEED {game?.seed ?? seed}</span>
            <button className="quiet-button" onClick={save} disabled={!game}>存档</button>
            <button className="quiet-button" onClick={load}>读取</button>
            {game && <button className="quiet-button home-button" onClick={requestReturnToScenarioMenu}>剧本首页</button>}
          </div>
        </header>

        {!game ? (
          <main className="menu-card">
            <div className="seal">🦊</div>
            <p className="eyebrow gold">狐狸共和国政治档案</p>
            <h2>{activeScenario.title}</h2>
            <p className="menu-role">玩家身份：{activeScenario.playerRole}</p>
            <p className="menu-copy">{activeScenario.opening}</p>
            <div className="scenario-picker" role="radiogroup" aria-label="选择剧本">
              {scenarios.map((item) => (
                <button key={item.id} role="radio" aria-checked={selectedScenarioId === item.id} className={selectedScenarioId === item.id ? 'selected' : ''} onClick={() => setSelectedScenarioId(item.id)}>
                  <span>{item.subtitle}</span><strong>{item.title}</strong><small>{item.playerRole}</small>
                </button>
              ))}
            </div>
            <label className="seed-field">
              <span>共和国档案编号 / Seed</span>
              <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
            </label>
            <div className="menu-actions">
              <button id="start-btn" className="primary-button" onClick={() => begin()}>开始剧本</button>
              <button className="secondary-button" onClick={() => setSeed(randomSeed())}>换一个档案</button>
            </div>
            <p className="controls">Enter / Space 开始 · 数字键 1–4 选择 · ←/→ 切换页面 · F 全屏</p>
          </main>
        ) : (
          <main className="game-layout">
            <nav className="side-nav" aria-label="主要页面">
              {tabs.map((item) => (
                <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'active' : ''}>
                  {item.label}
                </button>
              ))}
              <div className="turn-card"><span>{currentPhase?.label ?? '局势推进中'}</span><strong>{game.status === 'completed' ? '本局已归档' : `第 ${game.turn + 1} 回合`}</strong></div>
            </nav>

            <section className="content-panel">
              {notice && <div className="notice">{notice}</div>}
              {tab === 'scene' && currentFraming && (
                <FramingView framing={currentFraming} seenCount={game.seenFramingIds.length} pendingCount={game.pendingFramingIds.length} onDismiss={dismissFraming} />
              )}
              {tab === 'scene' && !currentFraming && game.status === 'completed' && (
                <div className="menu-card completion-card"><div className="seal">📚</div><p className="eyebrow gold">剧本完成</p><h2>本局已经进入历史</h2><p className="menu-copy">你的选择、承诺与留下的政治账目，已经成为这段历史的一部分。</p><div className="menu-actions"><button className="primary-button" onClick={returnToScenarioMenu}>返回剧本选择</button><button className="secondary-button" onClick={() => begin(seed, game.scenarioId)}>以相同档案重演</button></div></div>
              )}
              {tab === 'scene' && !currentFraming && current && (
                <div className="scene-view">
                  <div className="event-meta"><span>{currentPhase?.label ?? '共和国议程'}</span><span>{eventTypeLabels[current.type]}</span></div>
                  <div className="speaker-block">
                    <div className="portrait" aria-hidden="true">{current.actorEmoji}</div>
                    <div><p className="eyebrow">{current.institutionName} · {current.actorRole}</p><h2>{current.actorName}</h2></div>
                  </div>
                  <article className="dialogue-card">
                    <p className="event-number">议程 {String(game.turn + 1).padStart(2, '0')}</p>
                    <h3>{current.title}</h3>
                    <p>{current.scene}</p>
                  </article>
                  <div className="choices">
                    {current.choices.map((choice, index) => (
                      <button key={choice.id} onClick={() => selectChoice(choice.id)}>
                        <span className="choice-key">{index + 1}</span>
                        <span>{choice.label}</span>
                        <span className="arrow">→</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tab === 'history' && (
                <div className="page-view"><p className="eyebrow gold">共和国官方时间线</p><h2>你做过的决定</h2>
                  {!game.history.length ? <p className="empty">历史还没有来得及误解你。</p> :
                    <ol className="timeline">{[...game.history].reverse().map((entry) => <li key={`${entry.turn}-${entry.eventId}`}><span>第 {entry.turn} 回合 · {entry.eventId}</span><h3>{entry.title}</h3><p>{entry.choiceLabel}</p><small>{entry.response}</small></li>)}</ol>}
                </div>
              )}
              {tab === 'archive' && (
                <div className="page-view archive-view"><p className="eyebrow gold">POLITICAL ARCHIVE</p><h2>政治档案</h2>
                  <div className="archive-summary"><article><span>政治记忆</span><strong>{game.memories.length}</strong></article><article><span>未结债务</span><strong>{game.debts.filter((debt) => debt.status === 'active').length}</strong></article><article><span>官方措辞</span><strong>{Array.isArray(game.worldState.official_terms) ? game.worldState.official_terms.length : 0}</strong></article></div>
                  <section className="archive-section"><h3>公开讲话与承诺</h3>{!game.memories.length ? <p className="empty">政府尚未留下可供未来引用的话。</p> : <div className="record-list">{[...game.memories].reverse().map((memory) => <article key={memory.id}><div><span>第 {memory.createdAtTurn} 回合留下</span><b>{entityName(memory.speaker)}</b></div><blockquote>“{memory.statement}”</blockquote><small>{memory.public ? '公开表态' : '内部记录'} · {memory.active ? '仍可被引用' : '已经失效'}</small></article>)}</div>}</section>
                  <section className="archive-section"><h3>政治债务</h3>{!game.debts.length ? <p className="empty">目前没有机构承认政府欠了它什么。</p> : <div className="record-list debt-list">{[...game.debts].reverse().map((debt) => <article key={debt.id} className={`debt-${debt.status}`}><div><span>{(Array.isArray(debt.creditor) ? debt.creditor : [debt.creditor]).map(entityName).join('、')}</span><b>{formatPlayerValue(debt.status, activeScenario, 'debt.status')}</b></div><p>{debt.description}</p><small>政治压力 {debt.pressure}/{getDebtPressureCap(debt)} · 影响程度 {debt.strength}</small></article>)}</div>}</section>
                </div>
              )}
              {tab === 'settings' && (
                <div className="page-view"><p className="eyebrow gold">游戏选项</p><h2>设置</h2><div className="settings-row"><div><strong>全屏模式</strong><p>演说需要更大的舞台。</p></div><button className="secondary-button" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>切换（F）</button></div><div className="settings-row"><div><strong>重新开始</strong><p>使用相同档案编号重演另一种历史。</p></div><button className="secondary-button" onClick={() => begin(seed, game.scenarioId)}>重新开始当前剧本</button></div><div className="settings-row"><div><strong>返回剧本选择</strong><p>离开当前剧本，选择另一段政治生涯。</p></div><button className="secondary-button danger-button" onClick={requestReturnToScenarioMenu}>返回剧本首页</button></div></div>
              )}
              {tab === 'debug' && (
                <div className="page-view debug-view"><p className="eyebrow gold">ENGINE INSPECTOR</p><h2>Debug 面板</h2><div className="debug-grid"><section><h3>运行状态</h3><pre>{JSON.stringify({ status: game.status, phase: game.worldState.phase, turn: game.turn, scenarioId: game.scenarioId, seed: game.seed, rngState: game.rngState, currentEvent: game.currentEventId, completedEvents: game.completedEvents, pendingFramingIds: game.pendingFramingIds, seenFramingIds: game.seenFramingIds }, null, 2)}</pre></section><section><h3>候选事件权重</h3><pre>{JSON.stringify(weightedCandidates.map((candidate) => ({ id: candidate.event.id, base: candidate.baseWeight, priority: candidate.priorityBonus, debt: Number(candidate.debtBonus.toFixed(2)), memory: Number(candidate.memoryBonus.toFixed(2)), thread: candidate.threadBonus, urgency: Number(candidate.urgencyBonus.toFixed(2)), repetition: candidate.repetitionPenalty, final: Number(candidate.finalWeight.toFixed(2)) })), null, 2)}</pre></section><section><h3>World State</h3><pre>{JSON.stringify(game.worldState, null, 2)}</pre></section><section><h3>Memories</h3><pre>{JSON.stringify(game.memories, null, 2)}</pre></section><section><h3>Debts</h3><pre>{JSON.stringify(game.debts, null, 2)}</pre></section></div></div>
              )}
            </section>
          </main>
        )}
        <footer><span>《政治动物》试玩版</span><span>制度总会找到新的借口。</span></footer>
      </div>
      {showExitConfirm && (
        <div className="modal-backdrop">
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="exit-confirm-title">
            <p className="eyebrow gold">返回剧本选择</p>
            <h2 id="exit-confirm-title">要放弃当前剧本吗？</h2>
            <p>确定放弃当前剧本并返回首页吗？尚未保存的游戏进度将会丢失。已有的手动存档不会被删除。</p>
            <div className="modal-actions">
              <button className="secondary-button" autoFocus onClick={() => setShowExitConfirm(false)}>继续游戏</button>
              <button className="primary-button danger-primary" onClick={returnToScenarioMenu}>放弃并返回</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
