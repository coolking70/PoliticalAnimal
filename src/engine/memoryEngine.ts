import type { MemoryTemplate, PoliticalMemory } from '../models/game';

export function addMemory(
  memories: PoliticalMemory[],
  template: MemoryTemplate,
  sourceEvent: string,
  turn: number,
  index = 0,
): PoliticalMemory[] {
  const memory: PoliticalMemory = {
    ...structuredClone(template),
    id: `M-${sourceEvent}-${turn}-${index + 1}`,
    sourceEvent,
    createdAtTurn: turn,
    active: true,
  };
  return [...memories, memory];
}

export function findMemories(
  memories: PoliticalMemory[],
  query: Partial<Pick<PoliticalMemory, 'topic' | 'speaker' | 'public' | 'active'>> & { tag?: string } = {},
): PoliticalMemory[] {
  return memories
    .filter((memory) => query.topic === undefined || memory.topic === query.topic)
    .filter((memory) => query.speaker === undefined || memory.speaker === query.speaker)
    .filter((memory) => query.public === undefined || memory.public === query.public)
    .filter((memory) => query.active === undefined || memory.active === query.active)
    .filter((memory) => query.tag === undefined || memory.tags.includes(query.tag))
    .sort((a, b) => b.importance - a.importance || b.createdAtTurn - a.createdAtTurn);
}

export function findMemory(memories: PoliticalMemory[], topic: string): PoliticalMemory | undefined {
  return findMemories(memories, { topic, active: true })[0];
}

export function deactivateMemory(memories: PoliticalMemory[], id: string): PoliticalMemory[] {
  return memories.map((memory) => memory.id === id ? { ...memory, active: false } : memory);
}

export function getMemoriesByTopic(memories: PoliticalMemory[], topic: string): PoliticalMemory[] {
  return findMemories(memories, { topic });
}

export function getPublicPromises(memories: PoliticalMemory[]): PoliticalMemory[] {
  return findMemories(memories, { public: true, active: true, tag: 'promise' });
}
