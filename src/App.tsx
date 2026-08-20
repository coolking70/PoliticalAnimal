import { useEffect, useMemo, useState } from 'react';
import type { GameSave } from './models/game';
import { getCurrentEvent, getEligible, createGame, choose, scenario } from './store/gameStore';
import { loadFromStorage, saveToStorage } from './engine/saveEngine';
import './styles.css';

type Tab = 'scene' | 'history' | 'archive' | 'settings' | 'debug';

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'scene', label: '总统办公室' },
  { id: 'history', label: '历史' },
  { id: 'archive', label: '政治档案' },
  { id: 'settings', label: '设置' },
  { id: 'debug', label: 'Debug' },
];

function randomSeed() {
  return Math.floor(Math.random() * 900000) + 100000;
}

export default function App() {
  const [seed, setSeed] = useState(872631);
  const [game, setGame] = useState<GameSave | null>(null);
  const [tab, setTab] = useState<Tab>('scene');
  const [notice, setNotice] = useState('');
  const current = game ? getCurrentEvent(game) : null;
  const eligible = useMemo(() => game ? getEligible(game) : [], [game]);

  const begin = (nextSeed = seed) => {
    setSeed(nextSeed);
    setGame(createGame(nextSeed));
    setTab('scene');
    setNotice('');
  };

  const selectChoice = (choiceId: string) => {
    if (!game || !current) return;
    if (current.id === 'E20') {
      begin(seed);
      return;
    }
    const choice = current.choices.find((item) => item.id === choiceId);
    if (!choice) return;
    try {
      setGame(choose(game, choice));
      setNotice(choice.response);
      window.setTimeout(() => setNotice(''), 3600);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '剧情推进失败');
    }
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
      setTab('scene');
      setNotice('存档已恢复。历史拒绝重新开始。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '存档读取失败');
    }
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }
      if (game && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        const index = tabs.findIndex((item) => item.id === tab);
        const direction = event.key === 'ArrowRight' ? 1 : -1;
        setTab(tabs[(index + direction + tabs.length) % tabs.length].id);
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
      turn: game.turn,
      seed: game.seed,
      event: current ? {
        id: current.id,
        title: current.title,
        actor: current.actor,
        scene: current.scene,
        choices: current.choices.map((choice, index) => ({ key: index + 1, id: choice.id, label: choice.label })),
      } : null,
      worldState: game.worldState,
      completedEvents: game.completedEvents,
      historyCount: game.history.length,
      memories: game.memories.map((memory) => ({ id: memory.id, topic: memory.topic, statement: memory.statement, public: memory.public, importance: memory.importance, active: memory.active })),
      debts: game.debts.map((debt) => ({ id: debt.id, creditor: debt.creditor, topic: debt.topic, pressure: debt.pressure, status: debt.status })),
      eligibleEvents: eligible.map((event) => event.id),
    } : { mode: 'menu', seed });
    window.advanceTime = () => undefined;
  }, [game, current, tab, eligible, seed]);

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
          </div>
        </header>

        {!game ? (
          <main className="menu-card">
            <div className="seal">🦊</div>
            <p className="eyebrow gold">STAGE 1 · MEMORY &amp; DEBT</p>
            <h2>{scenario.title}</h2>
            <p className="menu-copy">{scenario.opening}</p>
            <label className="seed-field">
              <span>共和国档案编号 / Seed</span>
              <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} />
            </label>
            <div className="menu-actions">
              <button id="start-btn" className="primary-button" onClick={() => begin()}>宣誓就职</button>
              <button className="secondary-button" onClick={() => setSeed(randomSeed())}>换一个档案</button>
            </div>
            <p className="controls">数字键 1–4 选择 · ←/→ 切换页面 · F 全屏 · Esc 退出全屏</p>
          </main>
        ) : (
          <main className="game-layout">
            <nav className="side-nav" aria-label="主要页面">
              {tabs.map((item) => (
                <button key={item.id} onClick={() => setTab(item.id)} className={tab === item.id ? 'active' : ''}>
                  {item.label}
                </button>
              ))}
              <div className="turn-card"><span>改革进程</span><strong>第 {game.turn + 1} 回合</strong></div>
            </nav>

            <section className="content-panel">
              {notice && <div className="notice">{notice}</div>}
              {tab === 'scene' && current && (
                <div className="scene-view">
                  <div className="event-meta"><span>{current.type.toUpperCase()}</span><span>{current.thread.join(' / ')}</span><span>{current.id}</span></div>
                  <div className="speaker-block">
                    <div className="portrait" aria-hidden="true">{current.actorEmoji}</div>
                    <div><p className="eyebrow">正在发言</p><h2>{current.actor}</h2></div>
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
                  <section className="archive-section"><h3>公开讲话与承诺</h3>{!game.memories.length ? <p className="empty">总统尚未留下可供未来引用的话。</p> : <div className="record-list">{[...game.memories].reverse().map((memory) => <article key={memory.id}><div><span>{memory.id} · 第 {memory.createdAtTurn} 回合</span><b>{memory.topic}</b></div><blockquote>“{memory.statement}”</blockquote><small>重要度 {memory.importance} · {memory.public ? '公开' : '内部'} · {memory.active ? '有效' : '失效'}</small></article>)}</div>}</section>
                  <section className="archive-section"><h3>政治债务</h3>{!game.debts.length ? <p className="empty">目前没有机构承认政府欠了它什么。</p> : <div className="record-list debt-list">{[...game.debts].reverse().map((debt) => <article key={debt.id} className={`debt-${debt.status}`}><div><span>{debt.id} · {Array.isArray(debt.creditor) ? debt.creditor.join('、') : debt.creditor}</span><b>{debt.status}</b></div><p>{debt.description}</p><small>强度 {debt.strength} · 压力 {debt.pressure} · {debt.topic}</small></article>)}</div>}</section>
                </div>
              )}
              {tab === 'settings' && (
                <div className="page-view"><p className="eyebrow gold">SETTINGS</p><h2>设置</h2><div className="settings-row"><div><strong>全屏模式</strong><p>演说需要更大的舞台。</p></div><button className="secondary-button" onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()}>切换（F）</button></div><div className="settings-row"><div><strong>重新开始</strong><p>使用相同 Seed 重演另一种历史。</p></div><button className="secondary-button" onClick={() => begin(seed)}>新一届政府</button></div></div>
              )}
              {tab === 'debug' && (
                <div className="page-view debug-view"><p className="eyebrow gold">ENGINE INSPECTOR</p><h2>Debug 面板</h2><div className="debug-grid"><section><h3>运行状态</h3><pre>{JSON.stringify({ turn: game.turn, seed: game.seed, rngState: game.rngState, currentEvent: game.currentEventId, eligibleEvents: eligible.map((event) => ({ id: event.id, priority: event.priority, weight: event.weight })), completedEvents: game.completedEvents }, null, 2)}</pre></section><section><h3>World State</h3><pre>{JSON.stringify(game.worldState, null, 2)}</pre></section><section><h3>Memories</h3><pre>{JSON.stringify(game.memories, null, 2)}</pre></section><section><h3>Debts</h3><pre>{JSON.stringify(game.debts, null, 2)}</pre></section></div></div>
              )}
            </section>
          </main>
        )}
        <footer><span>原型版本 0.2.0 · Stage 1</span><span>决定会结束，制度会留下。</span></footer>
      </div>
    </>
  );
}
