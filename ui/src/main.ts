import "@fontsource-variable/inter";
import { mount } from "svelte";
import "./design/global.scss";
import App from "./App.svelte";
import { installUiScale } from "./integration/uiScale";

installUiScale();

const app = mount(App, {
  target: document.getElementById("app") as HTMLElement,
});

export default app;
