import { assign, setup } from "xstate";
import { IDLE_SCENE, type PaparanScene } from "./types";

type PaparanMachineEvent = {
  type: "SCHEDULE_UPDATED";
  scene: PaparanScene;
};

const assignScene = assign({
  scene: ({ event }: { event: PaparanMachineEvent }) => event.scene,
});

const scheduleTransitions = [
  { guard: ({ event }: { event: PaparanMachineEvent }) => event.scene.kind === "idle", target: "idle", actions: assignScene },
  { guard: ({ event }: { event: PaparanMachineEvent }) => event.scene.kind === "preAzanCountdown", target: "preAzanCountdown", actions: assignScene },
  { guard: ({ event }: { event: PaparanMachineEvent }) => event.scene.kind === "azanAlert", target: "azanAlert", actions: assignScene },
  { guard: ({ event }: { event: PaparanMachineEvent }) => event.scene.kind === "iqamatCountdownMain", target: "iqamatCountdownMain", actions: assignScene },
  { guard: ({ event }: { event: PaparanMachineEvent }) => event.scene.kind === "iqamatFinalAlert", target: "iqamatFinalAlert", actions: assignScene },
  { guard: ({ event }: { event: PaparanMachineEvent }) => event.scene.kind === "solatPhase", target: "solatPhase", actions: assignScene },
  { guard: ({ event }: { event: PaparanMachineEvent }) => event.scene.kind === "fridayKhutbah", target: "fridayKhutbah", actions: assignScene },
];

export const paparanMachine = setup({
  types: {
    context: {} as { scene: PaparanScene },
    events: {} as PaparanMachineEvent,
  },
}).createMachine({
  id: "paparanMasjid",
  initial: "idle",
  context: {
    scene: IDLE_SCENE,
  },
  states: {
    idle: { on: { SCHEDULE_UPDATED: scheduleTransitions } },
    preAzanCountdown: { on: { SCHEDULE_UPDATED: scheduleTransitions } },
    azanAlert: { on: { SCHEDULE_UPDATED: scheduleTransitions } },
    iqamatCountdownMain: { on: { SCHEDULE_UPDATED: scheduleTransitions } },
    iqamatFinalAlert: { on: { SCHEDULE_UPDATED: scheduleTransitions } },
    solatPhase: { on: { SCHEDULE_UPDATED: scheduleTransitions } },
    fridayKhutbah: { on: { SCHEDULE_UPDATED: scheduleTransitions } },
  },
});