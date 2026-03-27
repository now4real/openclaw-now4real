import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "openclaw/plugin-sdk/runtime-store";

const store = createPluginRuntimeStore<PluginRuntime>(
  "Now4real plugin runtime not initialized",
);

export const setNow4realRuntime = store.setRuntime;
export const getNow4realRuntime = store.getRuntime;
export const tryGetNow4realRuntime = store.tryGetRuntime;
