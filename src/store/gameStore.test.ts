import { describe, expect, it } from 'vitest';
import { gameData } from '../data/schema';
import { createGameStore } from './gameStore';

function makeReadyStore(seed: number) {
  const store = createGameStore({ data: gameData, seed });
  const state = store.getState();
  state.setObjective('map-crops');
  state.setOrbit('leo');
  state.selectComponent('bus', 'cubesat-bus');
  state.selectComponent('power', 'compact-solar');
  state.selectComponent('antenna', 'high-gain-dish');
  state.selectComponent('launchVehicle', 'small-launcher');
  state.toggleInstrument('multispectral-camera');
  return store;
}

describe('game store', () => {
  it('does not leave Define without both an objective and orbit', () => {
    const store = createGameStore({ data: gameData });
    store.getState().goNext();
    expect(store.getState().screen).toBe('define');

    store.getState().setObjective('map-crops');
    store.getState().goNext();
    expect(store.getState().screen).toBe('define');

    store.getState().setOrbit('leo');
    store.getState().goNext();
    expect(store.getState().screen).toBe('design');
  });

  it('blocks Review-to-Launch until hard blockers pass, then launches a report', () => {
    const store = createGameStore({ data: gameData, seed: 42 });
    store.getState().setObjective('map-crops');
    store.getState().setOrbit('leo');
    store.getState().goNext();
    store.getState().goNext();
    expect(store.getState().screen).toBe('review');
    expect(store.getState().evaluation.canLaunch).toBe(false);
    store.getState().goNext();
    expect(store.getState().screen).toBe('review');

    store.getState().selectComponent('bus', 'cubesat-bus');
    store.getState().selectComponent('power', 'compact-solar');
    store.getState().selectComponent('antenna', 'high-gain-dish');
    store.getState().selectComponent('launchVehicle', 'small-launcher');
    store.getState().toggleInstrument('multispectral-camera');
    expect(store.getState().evaluation.canLaunch).toBe(true);
    store.getState().goNext();
    expect(store.getState().screen).toBe('launch');

    const report = store.getState().launch();
    expect(store.getState().screen).toBe('report');
    expect(store.getState().report).toEqual(report);
    expect(report.evaluation).toBe(store.getState().evaluation);
  });

  it('uses seeded hooks deterministically and refuses launch from the wrong screen', () => {
    const first = makeReadyStore(123);
    const second = makeReadyStore(123);

    expect(() => first.getState().launch()).toThrow('current screen is not launch');
    for (const store of [first, second]) {
      store.getState().goNext();
      store.getState().goNext();
      store.getState().goNext();
    }

    expect(first.getState().launch()).toEqual(second.getState().launch());
  });

  it('resetGame returns to Define, clears report, and sets a reproducible seed', () => {
    const store = makeReadyStore(1);
    store.getState().resetGame(99);

    expect(store.getState().screen).toBe('define');
    expect(store.getState().report).toBeNull();
    expect(store.getState().seed).toBe(99);
    expect(store.getState().selections.instrumentIds).toEqual([]);
  });
});
