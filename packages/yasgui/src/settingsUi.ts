/**
 * Building blocks of the settings pages: a group with a small heading and a list of rows, where each row has a
 * name and one line about it on the left and its control on the right.
 */

let controlCount = 0;

/** A unique id, for labels of controls (each tab has its own settings modal) */
export function controlId(name: string): string {
  return `yasgui-setting-${name}-${++controlCount}`;
}

/** A group of settings with a heading and an optional line under it; returns the list to add rows to */
export function settingsGroup(container: HTMLElement, title: string, description?: string): HTMLElement {
  const group = document.createElement("section");
  group.className = "settingsGroup";
  const heading = document.createElement("h3");
  heading.className = "settingsGroupTitle";
  heading.textContent = title;
  group.appendChild(heading);
  if (description) {
    const lede = document.createElement("p");
    lede.className = "settingsGroupLede";
    lede.textContent = description;
    group.appendChild(lede);
  }
  const list = document.createElement("div");
  list.className = "settingsList";
  group.appendChild(list);
  container.appendChild(group);
  return list;
}

/**
 * A row of a settings list. `labelFor` links the name to the control, so clicking the name focuses or toggles it.
 * Returns the row; extra content (such as an editor that opens under the row) can be appended to it.
 */
export function settingsRow(
  list: HTMLElement,
  title: string,
  description: string | undefined,
  controls: HTMLElement[],
  labelFor?: string,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "settingsRow";
  const main = document.createElement("div");
  main.className = "settingsRowMain";
  const text = document.createElement("div");
  text.className = "settingsRowText";
  const name = document.createElement(labelFor ? "label" : "div");
  name.className = "settingsRowTitle";
  name.textContent = title;
  if (labelFor) (name as HTMLLabelElement).htmlFor = labelFor;
  text.appendChild(name);
  if (description) {
    const line = document.createElement("div");
    line.className = "settingsRowDescription";
    line.textContent = description;
    text.appendChild(line);
  }
  main.appendChild(text);
  if (controls.length) {
    const box = document.createElement("div");
    box.className = "settingsRowControls";
    box.append(...controls);
    main.appendChild(box);
  }
  row.appendChild(main);
  list.appendChild(row);
  return row;
}

/** An on/off switch (a checkbox with the switch role) */
export function settingsSwitch(id: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = "settingsSwitch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = id;
  input.setAttribute("role", "switch");
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const track = document.createElement("span");
  track.className = "settingsSwitchTrack";
  track.setAttribute("aria-hidden", "true");
  wrapper.append(input, track);
  return wrapper;
}

/** Two or three choices side by side */
export function settingsSegmented(
  label: string,
  options: { value: string; label: string }[],
  value: string,
  onChange: (value: string) => void,
): HTMLElement {
  const group = document.createElement("div");
  group.className = "settingsSegmented";
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", label);
  const buttons: HTMLButtonElement[] = [];
  const select = (selected: string) => {
    for (const button of buttons) {
      const on = button.dataset.value === selected;
      button.classList.toggle("active", on);
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    }
  };
  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "radio");
    button.dataset.value = option.value;
    button.textContent = option.label;
    button.addEventListener("click", () => {
      select(option.value);
      onChange(option.value);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = buttons.indexOf(button) + (event.key === "ArrowRight" ? 1 : -1);
      const next = buttons[(index + buttons.length) % buttons.length];
      next.focus();
      next.click();
    });
    buttons.push(button);
    group.appendChild(button);
  }
  select(value);
  return group;
}

/** A select of the settings, with the class of the other settings controls */
export function settingsSelect(
  id: string,
  options: { value: string; label: string }[],
  value: string | undefined,
  onChange: (value: string) => void,
  ariaLabel?: string,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "settingsSelect";
  select.id = id;
  if (ariaLabel) select.setAttribute("aria-label", ariaLabel);
  for (const option of options) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    select.appendChild(element);
  }
  if (value !== undefined && options.some((option) => option.value === value)) select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}
