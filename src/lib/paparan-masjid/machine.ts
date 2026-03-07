import { assign, setup } from "xstate";
import { IDLE_SCENE, type PaparanScene } from "./types";

type PaparanMachineEvent = {
  type: "SCHEDULE_UPDATED";
  scene: PaparanScene;
};

export const paparanMachine = setup({
  types: {
    context: {} as { scene: PaparanScene },
    events: {} as PaparanMachineEvent,
  },
  guards: {
    isIdle:               ({ event }) => event.scene.kind === "idle",
    isPreAzanCountdown:   ({ event }) => event.scene.kind === "preAzanCountdown",
    isAzanAlert:          ({ event }) => event.scene.kind === "azanAlert",
    isIqamatCountdown:    ({ event }) => event.scene.kind === "iqamatCountdownMain",
    isIqamatFinalAlert:   ({ event }) => event.scene.kind === "iqamatFinalAlert",
    isSolatPhase:         ({ event }) => event.scene.kind === "solatPhase",
    isFridayKhutbah:      ({ event }) => event.scene.kind === "fridayKhutbah",
  },
  actions: {
    assignScene: assign({ scene: ({ event }) => event.scene }),
  },
}).createMachine({
  id: "paparanMasjid",
  initial: "idle",
  context: { scene: IDLE_SCENE },
  states: {
    idle:                 { on: { SCHEDULE_UPDATED: scheduleTransitions() } },
    preAzanCountdown:     { on: { SCHEDULE_UPDATED: scheduleTransitions() } },
    azanAlert:            { on: { SCHEDULE_UPDATED: scheduleTransitions() } },
    iqamatCountdownMain:  { on: { SCHEDULE_UPDATED: scheduleTransitions() } },
    iqamatFinalAlert:     { on: { SCHEDULE_UPDATED: scheduleTransitions() } },
    solatPhase:           { on: { SCHEDULE_UPDATED: scheduleTransitions() } },
    fridayKhutbah:        { on: { SCHEDULE_UPDATED: scheduleTransitions() } },
  },
});

function scheduleTransitions() {
  return [
    { guard: "isIdle",             target: "idle",                actions: "assignScene" },
    { guard: "isPreAzanCountdown", target: "preAzanCountdown",    actions: "assignScene" },
    { guard: "isAzanAlert",        target: "azanAlert",           actions: "assignScene" },
    { guard: "isIqamatCountdown",  target: "iqamatCountdownMain", actions: "assignScene" },
    { guard: "isIqamatFinalAlert", target: "iqamatFinalAlert",    actions: "assignScene" },
    { guard: "isSolatPhase",       target: "solatPhase",          actions: "assignScene" },
    { guard: "isFridayKhutbah",    target: "fridayKhutbah",       actions: "assignScene" },
  ] as const;
}
